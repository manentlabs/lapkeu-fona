const { PenjualanDetail, BukuPersediaan, Jurnal, Akun } = require('../models');
const AKUN = require('../config/akunReferensi');

// Helper dengan dukungan transaction
async function getAkunByKode(kode, transaction = null) {
  const akun = await Akun.findOne({ where: { kode_akun: kode }, transaction });
  if (!akun) throw new Error(`Akun dengan kode ${kode} tidak ditemukan`);
  return akun;
}

/**
 * Mengembalikan stok semua barang pada suatu transaksi penjualan,
 * berdasarkan penjualan_detail yang masih tercatat.
 */
async function reverseStokPenjualan(transaksiId, t) {
  const detailLama = await PenjualanDetail.findAll({
    where: { transaksi_id: transaksiId },
    transaction: t,
  });

  for (const d of detailLama) {
    const barang = await BukuPersediaan.findByPk(d.barang_id, { transaction: t });
    if (barang) {
      await barang.update(
        { stok_awal: barang.stok_awal + d.jumlah },
        { transaction: t }
      );
    }
  }

  return detailLama;
}

/**
 * Hapus seluruh jejak transaksi penjualan: kembalikan stok, hapus
 * penjualan_detail, hapus jurnal. Transaksi header TIDAK dihapus.
 */
async function hapusJejakPenjualan(transaksiId, t) {
  await reverseStokPenjualan(transaksiId, t);
  await PenjualanDetail.destroy({ where: { transaksi_id: transaksiId }, transaction: t });
  await Jurnal.destroy({ where: { transaksi_id: transaksiId }, transaction: t });
}

/**
 * Validasi & kurangi stok untuk item-item baru, mengembalikan detail
 * + totalPenjualan + totalHPP. TIDAK menyimpan penjualan_detail.
 */
async function prosesItemPenjualan(items, t) {
  let totalPenjualan = 0;
  let totalHPP = 0;
  const detailBaru = [];

  for (const item of items) {
    const barang = await BukuPersediaan.findByPk(item.barang_id, { transaction: t });
    if (!barang) throw new Error(`Barang ID ${item.barang_id} tidak ditemukan`);
    if (barang.stok_awal < item.jumlah) {
      throw new Error(`Stok ${barang.nama_barang} tidak mencukupi (tersisa: ${barang.stok_awal})`);
    }

    const hargaJual = parseFloat(item.harga_jual) || 0;
    const hargaRata = parseFloat(barang.harga_awal) || 0;
    totalPenjualan += item.jumlah * hargaJual;
    totalHPP += item.jumlah * hargaRata;

    detailBaru.push({ barang, jumlah: item.jumlah, harga_jual: hargaJual, hpp_per_pcs: hargaRata });
  }

  for (const db of detailBaru) {
    await db.barang.update(
      { stok_awal: db.barang.stok_awal - db.jumlah },
      { transaction: t }
    );
  }

  return { detailBaru, totalPenjualan, totalHPP };
}

/**
 * Simpan penjualan_detail + jurnal baru untuk sebuah transaksi penjualan.
 */
async function simpanDetailDanJurnalPenjualan({ transaksiId, tanggal, detailBaru, totalPenjualan, totalHPP }, t) {
  const akunKasWaserda = await getAkunByKode(AKUN.KAS_WASERDA, t);
  const akunPendapatan = await getAkunByKode(AKUN.PENDAPATAN_WASERDA, t);
  const akunHPP = await getAkunByKode(AKUN.HPP_TOKO, t);
  const akunPersediaan = await getAkunByKode(AKUN.PERSEDIAAN, t);

  const jurnalEntries = [
    { akun_id: akunKasWaserda.id, debet: totalPenjualan, kredit: 0, keterangan: 'Kas Waserda' },
    { akun_id: akunPendapatan.id, debet: 0, kredit: totalPenjualan, keterangan: 'Pendapatan Waserda' },
    { akun_id: akunHPP.id, debet: totalHPP, kredit: 0, keterangan: 'HPP Toko' },
    { akun_id: akunPersediaan.id, debet: 0, kredit: totalHPP, keterangan: 'Pengurangan Persediaan' },
  ];

  for (const row of jurnalEntries) {
    await Jurnal.create(
      {
        transaksi_id: transaksiId,
        tanggal,
        akun_id: row.akun_id,
        debet: row.debet,
        kredit: row.kredit,
        keterangan: row.keterangan,
      },
      { transaction: t }
    );
  }

  for (const db of detailBaru) {
    await PenjualanDetail.create(
      {
        transaksi_id: transaksiId,
        barang_id: db.barang.id,
        jumlah: db.jumlah,
        harga_jual: db.harga_jual,
        hpp_per_pcs: db.hpp_per_pcs,
      },
      { transaction: t }
    );
  }
}

module.exports = {
  reverseStokPenjualan,
  hapusJejakPenjualan,
  prosesItemPenjualan,
  simpanDetailDanJurnalPenjualan,
};