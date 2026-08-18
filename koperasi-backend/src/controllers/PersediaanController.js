const { Op } = require('sequelize');
const { BukuPersediaan, Transaksi, Jurnal, Akun, KodeReferensi, PengaturanWebsite, PenjualanDetail } = require('../models');
const sequelize = require('../config/database');
const { generateNoTransaksi } = require('../utils/helper');
const AKUN = require('../config/akunReferensi');
const KODE_REF = require('../config/kodeReferensi');

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

// ─── Helper format Rupiah ─────────────────────────────────────
function formatRupiah(value) {
  const num = parseFloat(value) || 0;
  return num.toLocaleString('id-ID');
}

// ─── Helper: cari akun berdasarkan kode (dengan transaksi opsional) ──
async function getAkunByKode(kode, transaction = null) {
  if (!kode) throw new Error('Kode akun tidak diberikan');
  const akun = await Akun.findOne({ where: { kode_akun: kode }, transaction });
  if (!akun) throw new Error(`Akun dengan kode ${kode} tidak ditemukan`);
  return akun;
}

// ─── Helper: cari kode referensi berdasarkan kode (dengan transaksi opsional) ──
async function getKodeReferensiByKode(kode, transaction = null) {
  if (!kode) throw new Error('Kode referensi tidak diberikan');
  const ref = await KodeReferensi.findOne({ where: { kode }, transaction });
  if (!ref) throw new Error(`Kode referensi ${kode} tidak ditemukan`);
  return ref;
}

// ─── Helper: buat transaksi jurnal dengan dukungan transaksi ──
async function createJurnalTransaction(data, jurnalEntries, userId, transaction = null) {
  const t = transaction || await sequelize.transaction();
  try {
    let totalDebet = 0, totalKredit = 0;
    for (const row of jurnalEntries) {
      totalDebet += parseFloat(row.debet) || 0;
      totalKredit += parseFloat(row.kredit) || 0;
    }
    if (totalDebet !== totalKredit) {
      throw new Error('Total debet harus sama dengan total kredit');
    }

    const ref = await KodeReferensi.findByPk(data.kode_referensi_id, { transaction: t });
    if (!ref) throw new Error('Kode referensi tidak ditemukan');

    const transaksi = await Transaksi.create({
      no_transaksi: generateNoTransaksi(),
      kode_referensi_id: data.kode_referensi_id,
      label: ref.label,
      tanggal: data.tanggal,
      deskripsi: data.deskripsi,
      unit_usaha: data.unit_usaha || null,
      anggota_id: data.anggota_id || null,
      user_id: userId,
      akun_id: jurnalEntries[0]?.akun_id || null,
      akun_debet_id: jurnalEntries.find(r => r.debet > 0)?.akun_id || null,
      akun_kredit_id: jurnalEntries.find(r => r.kredit > 0)?.akun_id || null,
      akun: 'Persediaan',
      jumlah: data.jumlah != null ? data.jumlah : totalDebet,
    }, { transaction: t });

    for (const row of jurnalEntries) {
      await Jurnal.create({
        transaksi_id: transaksi.id,
        tanggal: data.tanggal,
        akun_id: row.akun_id,
        debet: row.debet,
        kredit: row.kredit,
        keterangan: row.keterangan || null,
      }, { transaction: t });
    }

    if (!transaction) await t.commit();
    return transaksi;
  } catch (error) {
    if (!transaction) await t.rollback();
    throw error;
  }
}

// ─── Helper: kembalikan stok pembelian & hapus jejak ──────────
async function kembalikanStokDanHapusJejakPembelian(transaksiId, transaction) {
  const barang = await BukuPersediaan.findOne({
    where: { transaksi_pembelian_id: transaksiId },
    transaction
  });
  if (barang) {
    const jumlah = parseFloat(barang.pembelian_pcs) || 0;
    const hargaBeli = parseFloat(barang.harga_pembelian) || 0;
    if (jumlah > 0 && hargaBeli > 0) {
      const stokLama = parseFloat(barang.stok_awal) || 0;
      const hargaRataLama = parseFloat(barang.harga_awal) || 0;
      const totalNilaiLama = stokLama * hargaRataLama;
      const totalNilaiBaru = totalNilaiLama - (jumlah * hargaBeli);
      const stokBaru = stokLama - jumlah;
      const hargaRataBaru = stokBaru > 0 ? totalNilaiBaru / stokBaru : 0;
      await barang.update({
        stok_awal: stokBaru,
        harga_awal: hargaRataBaru,
        pembelian_pcs: 0,
        harga_pembelian: 0,
        transaksi_pembelian_id: null,
      }, { transaction });
    }
  }
}

// ─── CRUD Barang ──────────────────────────────────────────────
exports.index = async (req, res) => {
  try {
    const barang = await BukuPersediaan.findAll({
      order: [['kode_barang', 'ASC']]
    });
    res.json({ data: barang });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal mengambil data barang' });
  }
};

exports.store = async (req, res) => {
  try {
    const { kode_barang, nama_barang, satuan, stok_awal, harga_awal } = req.body;
    const barang = await BukuPersediaan.create({
      kode_barang,
      nama_barang,
      satuan: satuan || 'Pcs',
      stok_awal: stok_awal || 0,
      harga_awal: harga_awal || 0,
    });
    res.status(201).json({ data: barang, message: 'Barang berhasil ditambahkan' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal menambah barang' });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { nama_barang, satuan, harga_awal } = req.body;
    const barang = await BukuPersediaan.findByPk(id);
    if (!barang) return res.status(404).json({ message: 'Barang tidak ditemukan' });

    await barang.update({ nama_barang, satuan, harga_awal });
    res.json({ data: barang, message: 'Barang berhasil diupdate' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal update barang' });
  }
};

exports.destroy = async (req, res) => {
  try {
    const { id } = req.params;
    const barang = await BukuPersediaan.findByPk(id);
    if (!barang) return res.status(404).json({ message: 'Barang tidak ditemukan' });
    if (barang.stok_awal > 0) {
      return res.status(422).json({ message: 'Tidak bisa hapus barang yang masih ada stok' });
    }
    await barang.destroy();
    res.json({ message: 'Barang berhasil dihapus' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal hapus barang' });
  }
};

exports.autocomplete = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.json({ data: [] });
    }

    const list = await BukuPersediaan.findAll({
      where: {
        [Op.or]: [
          { nama_barang: { [Op.like]: `%${q}%` } },
          { kode_barang: { [Op.like]: `%${q}%` } },
        ],
      },
      limit: 10,
      order: [["nama_barang", "ASC"]],
    });

    res.json({
      data: list.map((b) => ({
        id: b.id,
        kode_barang: b.kode_barang,
        nama_barang: b.nama_barang,
        satuan: b.satuan,
        stok_awal: b.stok_awal,
        harga_awal: b.harga_awal,
      })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Gagal mengambil data barang." });
  }
};

// ─── PEMBELIAN (CREATE) ──────────────────────────────────────
exports.pembelian = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const {
      barang_id, jumlah, harga_beli, tanggal, supplier, no_faktur, keterangan,
      metode, // 'tunai' atau 'kredit'
      kode_referensi_id
    } = req.body;

    if (!barang_id || !jumlah || jumlah <= 0 || !harga_beli || harga_beli <= 0) {
      return res.status(422).json({ message: 'Data pembelian tidak lengkap' });
    }

    const barang = await BukuPersediaan.findByPk(barang_id, { transaction: t });
    if (!barang) return res.status(404).json({ message: 'Barang tidak ditemukan' });

    const stokLama = parseFloat(barang.stok_awal) || 0;
    const hargaRataLama = parseFloat(barang.harga_awal) || 0;
    const totalNilaiLama = stokLama * hargaRataLama;
    const totalNilaiBaru = totalNilaiLama + (jumlah * harga_beli);
    const stokBaru = stokLama + jumlah;
    const hargaRataBaru = stokBaru > 0 ? totalNilaiBaru / stokBaru : 0;

    const akunPersediaan = await getAkunByKode(AKUN.PERSEDIAAN, t);
    const akunKasWaserda = await getAkunByKode(AKUN.KAS_WASERDA, t);
    const isKredit = metode === 'kredit';
    const akunLawan = isKredit
      ? await getAkunByKode(AKUN.UTANG_DAGANG, t)
      : akunKasWaserda;

    const jurnalEntries = [
      { akun_id: akunPersediaan.id, debet: jumlah * harga_beli, kredit: 0, keterangan: `Pembelian ${barang.nama_barang}` },
      { akun_id: akunLawan.id, debet: 0, kredit: jumlah * harga_beli, keterangan: isKredit ? 'Utang Dagang/Toko' : 'Kas Waserda' },
    ];

    let refId = kode_referensi_id;
    if (!refId) {
      const ref = await getKodeReferensiByKode(KODE_REF.PEMBELIAN, t);
      refId = ref.id;
    }

    const transaksi = await createJurnalTransaction({
      tanggal: tanggal || new Date().toISOString().slice(0, 10),
      deskripsi: `Pembelian ${barang.nama_barang} ${jumlah} ${barang.satuan} dari ${supplier || '-'} (${isKredit ? 'Kredit' : 'Tunai'})`,
      unit_usaha: 'Waserda',
      anggota_id: null,
      kode_referensi_id: refId,
      jumlah: jumlah * harga_beli,
    }, jurnalEntries, req.userId, t);

    await barang.update({
      stok_awal: stokBaru,
      harga_awal: hargaRataBaru,
      pembelian_pcs: jumlah,
      harga_pembelian: harga_beli,
      tanggal: tanggal || new Date().toISOString().slice(0, 10),
      keterangan: keterangan || `Pembelian dari ${supplier || '-'}`,
      transaksi_pembelian_id: transaksi.id,
    }, { transaction: t });

    await t.commit();
    res.status(201).json({
      message: 'Pembelian berhasil dicatat',
      data: { barang, transaksi }
    });
  } catch (error) {
    await t.rollback();
    console.error(error);
    res.status(500).json({ message: error.message || 'Gagal mencatat pembelian' });
  }
};

// ─── PEMBELIAN UPDATE ────────────────────────────────────────
exports.updatePembelian = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { barang_id, jumlah, harga_beli, tanggal, supplier, no_faktur, keterangan, metode, kode_referensi_id } = req.body;

    const transaksi = await Transaksi.findByPk(id, { transaction: t });
    if (!transaksi) return res.status(404).json({ message: 'Transaksi tidak ditemukan' });

    const refPembelian = await getKodeReferensiByKode(KODE_REF.PEMBELIAN, t);
    if (transaksi.kode_referensi_id !== refPembelian.id) {
      return res.status(400).json({ message: 'Transaksi ini bukan pembelian' });
    }

    await kembalikanStokDanHapusJejakPembelian(id, t);
    await Jurnal.destroy({ where: { transaksi_id: id }, transaction: t });

    if (!barang_id || !jumlah || jumlah <= 0 || !harga_beli || harga_beli <= 0) {
      return res.status(422).json({ message: 'Data pembelian tidak lengkap untuk update' });
    }

    const barang = await BukuPersediaan.findByPk(barang_id, { transaction: t });
    if (!barang) return res.status(404).json({ message: 'Barang tidak ditemukan' });

    const stokLama = parseFloat(barang.stok_awal) || 0;
    const hargaRataLama = parseFloat(barang.harga_awal) || 0;
    const totalNilaiLama = stokLama * hargaRataLama;
    const totalNilaiBaru = totalNilaiLama + (jumlah * harga_beli);
    const stokBaru = stokLama + jumlah;
    const hargaRataBaru = stokBaru > 0 ? totalNilaiBaru / stokBaru : 0;

    const akunPersediaan = await getAkunByKode(AKUN.PERSEDIAAN, t);
    const akunKasWaserda = await getAkunByKode(AKUN.KAS_WASERDA, t);
    const isKredit = metode === 'kredit';
    const akunLawan = isKredit
      ? await getAkunByKode(AKUN.UTANG_DAGANG, t)
      : akunKasWaserda;

    const jurnalEntries = [
      { akun_id: akunPersediaan.id, debet: jumlah * harga_beli, kredit: 0, keterangan: `Pembelian ${barang.nama_barang}` },
      { akun_id: akunLawan.id, debet: 0, kredit: jumlah * harga_beli, keterangan: isKredit ? 'Utang Dagang/Toko' : 'Kas Waserda' },
    ];

    let refId = kode_referensi_id;
    if (!refId) {
      const ref = await getKodeReferensiByKode(KODE_REF.PEMBELIAN, t);
      refId = ref.id;
    }

    const dataTransaksi = {
      tanggal: tanggal || transaksi.tanggal,
      deskripsi: `Pembelian ${barang.nama_barang} ${jumlah} ${barang.satuan} dari ${supplier || '-'} (${isKredit ? 'Kredit' : 'Tunai'})`,
      unit_usaha: 'Waserda',
      anggota_id: null,
      kode_referensi_id: refId,
      jumlah: jumlah * harga_beli,
    };

    await transaksi.update({
      tanggal: dataTransaksi.tanggal,
      deskripsi: dataTransaksi.deskripsi,
      jumlah: dataTransaksi.jumlah,
      kode_referensi_id: dataTransaksi.kode_referensi_id,
    }, { transaction: t });

    for (const row of jurnalEntries) {
      await Jurnal.create({
        transaksi_id: transaksi.id,
        tanggal: dataTransaksi.tanggal,
        akun_id: row.akun_id,
        debet: row.debet,
        kredit: row.kredit,
        keterangan: row.keterangan || null,
      }, { transaction: t });
    }

    await barang.update({
      stok_awal: stokBaru,
      harga_awal: hargaRataBaru,
      pembelian_pcs: jumlah,
      harga_pembelian: harga_beli,
      tanggal: dataTransaksi.tanggal,
      keterangan: keterangan || `Pembelian dari ${supplier || '-'}`,
      transaksi_pembelian_id: transaksi.id,
    }, { transaction: t });

    await t.commit();
    res.json({
      message: 'Pembelian berhasil diupdate',
      data: { barang, transaksi }
    });
  } catch (error) {
    await t.rollback();
    console.error(error);
    res.status(500).json({ message: error.message || 'Gagal update pembelian' });
  }
};

// ─── PEMBELIAN DELETE ─────────────────────────────────────────
exports.deletePembelian = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const transaksi = await Transaksi.findByPk(id, { transaction: t });
    if (!transaksi) return res.status(404).json({ message: 'Transaksi tidak ditemukan' });

    await kembalikanStokDanHapusJejakPembelian(id, t);
    await Jurnal.destroy({ where: { transaksi_id: id }, transaction: t });
    await transaksi.destroy({ transaction: t });

    await t.commit();
    res.json({ message: 'Pembelian berhasil dihapus, stok dikembalikan' });
  } catch (error) {
    await t.rollback();
    console.error(error);
    res.status(500).json({ message: error.message || 'Gagal hapus pembelian' });
  }
};

// ─── PENJUALAN (CREATE) ──────────────────────────────────────
const {
  hapusJejakPenjualan,
  prosesItemPenjualan,
  simpanDetailDanJurnalPenjualan,
} = require('../services/penjualanService');

exports.penjualan = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const {
      items,
      tanggal, deskripsi, anggota_id,
      metode = 'tunai',
      kode_referensi_id,
      unit_usaha = 'Waserda'
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(422).json({ message: 'Minimal satu item' });
    }

    let totalPenjualan = 0;
    let totalHPP = 0;
    const detailPenjualan = [];

    for (const item of items) {
      const barang = await BukuPersediaan.findByPk(item.barang_id, { transaction: t });
      if (!barang) throw new Error(`Barang ID ${item.barang_id} tidak ditemukan`);
      if (barang.stok_awal < item.jumlah) {
        throw new Error(`Stok ${barang.nama_barang} tidak mencukupi (tersisa: ${barang.stok_awal})`);
      }

      const hargaJual = parseFloat(item.harga_jual) || 0;
      const hargaRata = parseFloat(barang.harga_awal) || 0;
      const subtotal = item.jumlah * hargaJual;
      const hppTotal = item.jumlah * hargaRata;
      totalPenjualan += subtotal;
      totalHPP += hppTotal;

      detailPenjualan.push({ barang, jumlah: item.jumlah, harga_jual: hargaJual, hpp_per_pcs: hargaRata });
    }

    for (const dp of detailPenjualan) {
      await dp.barang.update({
        stok_awal: dp.barang.stok_awal - dp.jumlah,
      }, { transaction: t });
    }

    const akunKasWaserda = await getAkunByKode(AKUN.KAS_WASERDA, t);
    const akunPendapatan = await getAkunByKode(AKUN.PENDAPATAN_WASERDA, t);
    const akunHPP = await getAkunByKode(AKUN.HPP_TOKO, t);
    const akunPersediaan = await getAkunByKode(AKUN.PERSEDIAAN, t);

    const jurnalEntries = [
      { akun_id: akunKasWaserda.id, debet: totalPenjualan, kredit: 0, keterangan: metode === 'transfer' ? 'Kas Waserda (Transfer)' : 'Kas Waserda (Tunai)' },
      { akun_id: akunPendapatan.id, debet: 0, kredit: totalPenjualan, keterangan: 'Pendapatan Waserda' },
      { akun_id: akunHPP.id, debet: totalHPP, kredit: 0, keterangan: 'HPP Toko' },
      { akun_id: akunPersediaan.id, debet: 0, kredit: totalHPP, keterangan: 'Pengurangan Persediaan' },
    ];

    let refId = kode_referensi_id;
    if (!refId) {
      const ref = await getKodeReferensiByKode(KODE_REF.PENJUALAN, t);
      refId = ref.id;
    }

    const transaksi = await createJurnalTransaction({
      tanggal: tanggal || new Date().toISOString().slice(0, 10),
      deskripsi: deskripsi || `Penjualan ${items.length} item (${metode === 'transfer' ? 'Transfer' : 'Tunai'})`,
      unit_usaha: unit_usaha,
      anggota_id: anggota_id || null,
      kode_referensi_id: refId,
      jumlah: totalPenjualan,
    }, jurnalEntries, req.userId, t);

    for (const dp of detailPenjualan) {
      await PenjualanDetail.create({
        transaksi_id: transaksi.id,
        barang_id: dp.barang.id,
        jumlah: dp.jumlah,
        harga_jual: dp.harga_jual,
        hpp_per_pcs: dp.hpp_per_pcs,
      }, { transaction: t });
    }

    await t.commit();
    res.status(201).json({
      message: 'Penjualan berhasil dicatat',
      data: { transaksi, totalPenjualan, totalHPP }
    });
  } catch (error) {
    await t.rollback();
    console.error(error);
    res.status(500).json({ message: error.message || 'Gagal mencatat penjualan' });
  }
};

// ─── GET PENJUALAN ────────────────────────────────────────────
exports.getPenjualan = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.per_page) || 10;
    const { search, tanggal_mulai, tanggal_selesai } = req.query;

    const ref = await getKodeReferensiByKode(KODE_REF.PENJUALAN);
    const where = { kode_referensi_id: ref.id };

    if (search) {
      where[Op.or] = [
        { no_transaksi: { [Op.like]: `%${search}%` } },
        { deskripsi: { [Op.like]: `%${search}%` } },
      ];
    }
    if (tanggal_mulai || tanggal_selesai) {
      where.tanggal = {};
      if (tanggal_mulai) where.tanggal[Op.gte] = tanggal_mulai;
      if (tanggal_selesai) where.tanggal[Op.lte] = tanggal_selesai;
    }

    const { rows, count } = await Transaksi.findAndCountAll({
      where,
      include: [{
        model: PenjualanDetail,
        as: 'penjualanDetail',
        include: [{ model: BukuPersediaan, as: 'barang' }],
      }],
      limit: perPage,
      offset: (page - 1) * perPage,
      order: [['tanggal', 'DESC'], ['id', 'DESC']],
      distinct: true,
    });

    const data = rows.map((trx) => {
      const json = trx.toJSON();
      json.penjualanBarang = (json.penjualanDetail || []).map((d) => ({
        id: d.id,
        barang_id: d.barang_id,
        kode_barang: d.barang?.kode_barang || '',
        nama_barang: d.barang?.nama_barang || '-',
        satuan: d.barang?.satuan || 'Pcs',
        penjualan_pcs: d.jumlah,
        harga_penjualan: parseFloat(d.harga_jual),
      }));
      return json;
    });

    const allPenjualan = await Transaksi.findAll({
      where: { kode_referensi_id: ref.id },
      attributes: ['jumlah', 'tanggal'],
    });
    const today = new Date().toISOString().slice(0, 10);
    const totalPenjualan = allPenjualan.reduce((s, t) => s + (parseFloat(t.jumlah) || 0), 0);
    const totalHariIni = allPenjualan
      .filter((t) => t.tanggal === today)
      .reduce((s, t) => s + (parseFloat(t.jumlah) || 0), 0);

    res.json({
      data,
      pagination: {
        page,
        per_page: perPage,
        total: count,
        total_pages: Math.ceil(count / perPage),
      },
      summary: {
        totalPenjualan,
        totalHariIni,
        totalTransaksi: allPenjualan.length,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal mengambil data penjualan' });
  }
};

// ─── UPDATE PENJUALAN ────────────────────────────────────────
exports.updatePenjualan = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { tanggal, deskripsi, items } = req.body;

    const transaksi = await Transaksi.findByPk(id, { transaction: t });
    if (!transaksi) {
      await t.rollback();
      return res.status(404).json({ message: 'Transaksi tidak ditemukan' });
    }

    if (!items) {
      await transaksi.update({ tanggal, deskripsi }, { transaction: t });
      if (tanggal) {
        await Jurnal.update({ tanggal }, { where: { transaksi_id: id }, transaction: t });
      }
      await t.commit();
      return res.json({ data: transaksi, message: 'Penjualan berhasil diupdate' });
    }

    if (items.length === 0) {
      await t.rollback();
      return res.status(422).json({ message: 'Minimal satu item' });
    }

    await hapusJejakPenjualan(id, t);

    const { detailBaru, totalPenjualan, totalHPP } = await prosesItemPenjualan(items, t);

    const tanggalBaru = tanggal || transaksi.tanggal;
    await simpanDetailDanJurnalPenjualan(
      { transaksiId: id, tanggal: tanggalBaru, detailBaru, totalPenjualan, totalHPP },
      t
    );

    await transaksi.update(
      { tanggal: tanggalBaru, deskripsi: deskripsi || transaksi.deskripsi, jumlah: totalPenjualan },
      { transaction: t }
    );

    await t.commit();
    res.json({
      message: 'Penjualan berhasil diupdate, stok telah disesuaikan',
      data: { transaksi, totalPenjualan, totalHPP },
    });
  } catch (error) {
    await t.rollback();
    console.error(error);
    res.status(500).json({ message: error.message || 'Gagal update penjualan' });
  }
};

// ─── DELETE PENJUALAN ────────────────────────────────────────
exports.deletePenjualan = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const transaksi = await Transaksi.findByPk(id, { transaction: t });
    if (!transaksi) {
      await t.rollback();
      return res.status(404).json({ message: 'Transaksi tidak ditemukan' });
    }

    await hapusJejakPenjualan(id, t);
    await transaksi.destroy({ transaction: t });

    await t.commit();
    res.json({ message: 'Penjualan berhasil dihapus, stok telah dikembalikan' });
  } catch (error) {
    await t.rollback();
    console.error(error);
    res.status(500).json({ message: error.message || 'Gagal menghapus penjualan' });
  }
};

// ─── GET PEMBELIAN ────────────────────────────────────────────
exports.getPembelian = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.per_page) || 10;
    const { search, tanggal_mulai, tanggal_selesai } = req.query;

    const ref = await getKodeReferensiByKode(KODE_REF.PEMBELIAN);
    const where = { kode_referensi_id: ref.id };

    if (search) {
      where[Op.or] = [
        { no_transaksi: { [Op.like]: `%${search}%` } },
        { deskripsi: { [Op.like]: `%${search}%` } },
      ];
    }
    if (tanggal_mulai || tanggal_selesai) {
      where.tanggal = {};
      if (tanggal_mulai) where.tanggal[Op.gte] = tanggal_mulai;
      if (tanggal_selesai) where.tanggal[Op.lte] = tanggal_selesai;
    }

    const { rows, count } = await Transaksi.findAndCountAll({
      where,
      include: [
        { model: KodeReferensi, as: 'referensi' },
        // Kita tidak punya detail pembelian, tapi kita bisa ambil dari barang yang terakhir
      ],
      limit: perPage,
      offset: (page - 1) * perPage,
      order: [['tanggal', 'DESC'], ['id', 'DESC']],
      distinct: true,
    });

    // Ambil data barang terkait dari BukuPersediaan yang memiliki transaksi_pembelian_id
    const transaksiIds = rows.map(r => r.id);
    const barangMap = {};
    if (transaksiIds.length > 0) {
      const barangList = await BukuPersediaan.findAll({
        where: { transaksi_pembelian_id: transaksiIds },
        attributes: ['transaksi_pembelian_id', 'id', 'kode_barang', 'nama_barang', 'satuan', 'pembelian_pcs', 'harga_pembelian'],
      });
      barangList.forEach(b => {
        barangMap[b.transaksi_pembelian_id] = b;
      });
    }

    const data = rows.map((trx) => {
      const json = trx.toJSON();
      const barang = barangMap[trx.id];
      return {
        ...json,
        barang_id: barang?.id || null,
        kode_barang: barang?.kode_barang || null,
        nama_barang: barang?.nama_barang || null,
        satuan: barang?.satuan || 'Pcs',
        jumlah_barang: barang?.pembelian_pcs || 0,
        harga_beli: barang?.harga_pembelian || 0,
        total: parseFloat(trx.jumlah) || 0,
      };
    });

    const allPembelian = await Transaksi.findAll({
      where: { kode_referensi_id: ref.id },
      attributes: ['jumlah', 'tanggal'],
    });
    const today = new Date().toISOString().slice(0, 10);
    const totalPembelian = allPembelian.reduce((s, t) => s + (parseFloat(t.jumlah) || 0), 0);
    const totalHariIni = allPembelian
      .filter((t) => t.tanggal === today)
      .reduce((s, t) => s + (parseFloat(t.jumlah) || 0), 0);

    res.json({
      data,
      pagination: {
        page,
        per_page: perPage,
        total: count,
        total_pages: Math.ceil(count / perPage),
      },
      summary: {
        totalPembelian,
        totalHariIni,
        totalTransaksi: allPembelian.length,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal mengambil data pembelian' });
  }
};

// ─── EXPORT EXCEL ─────────────────────────────────────────────
exports.exportExcel = async (req, res) => {
  try {
    const { search } = req.query;
    const where = search
      ? {
          [Op.or]: [
            { nama_barang: { [Op.like]: `%${search}%` } },
            { kode_barang: { [Op.like]: `%${search}%` } },
          ],
        }
      : {};

    const data = await BukuPersediaan.findAll({
      where,
      order: [['kode_barang', 'ASC']],
    });

    const headers = ['Kode Barang', 'Nama Barang', 'Satuan', 'Stok', 'Harga Rata-rata'];
    const rows = data.map((item) => [
      item.kode_barang || '-',
      item.nama_barang || '-',
      item.satuan || 'Pcs',
      item.stok_awal || 0,
      parseFloat(item.harga_awal) || 0,
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=stok-barang-${new Date().toISOString().slice(0, 10)}.csv`
    );
    res.send(csv);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal mengekspor data.' });
  }
};

// ─── EXPORT PDF ───────────────────────────────────────────────
exports.exportPdf = async (req, res) => {
  try {
    const { search } = req.query;
    const where = search
      ? {
          [Op.or]: [
            { nama_barang: { [Op.like]: `%${search}%` } },
            { kode_barang: { [Op.like]: `%${search}%` } },
          ],
        }
      : {};

    const data = await BukuPersediaan.findAll({
      where,
      order: [['kode_barang', 'ASC']],
    });

    const pengaturan = await PengaturanWebsite.findOne();
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'portrait' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=stok-barang-${new Date().toISOString().slice(0, 10)}.pdf`
    );
    doc.pipe(res);

    const startX = 40;
    let currentY = 40;

    const logoPath = pengaturan?.logo_koperasi
      ? path.join(__dirname, '..', '..', 'public', 'uploads', 'pengaturan', pengaturan.logo_koperasi)
      : null;
    if (logoPath && fs.existsSync(logoPath)) {
      doc.image(logoPath, startX, currentY, { width: 60, height: 60 });
    }

    const namaKoperasi = pengaturan?.nama_koperasi || 'KOPERASI';
    doc.fontSize(14).font('Helvetica-Bold').text(namaKoperasi, startX + 70, currentY + 5, {
      width: 420,
      align: 'center',
    });

    doc.fontSize(8).font('Helvetica');
    const infoY = currentY + 25;
    const infoLines = [
      `Nomor : ${pengaturan?.no_badan_hukum || '-'}`,
      `Tanggal : ${pengaturan?.tgl_badan_hukum || '-'}`,
      pengaturan?.alamat_koperasi || 'Alamat Belum Diatur',
    ];
    infoLines.forEach((line, i) => {
      doc.text(line, startX + 70, infoY + i * 12, { width: 420, align: 'center' });
    });

    currentY += 75;
    doc.moveTo(startX, currentY).lineTo(startX + 510, currentY).lineWidth(3).stroke('#000');
    currentY += 2;
    doc.moveTo(startX, currentY).lineTo(startX + 510, currentY).lineWidth(1).stroke('#000');
    currentY += 15;

    doc.fontSize(11).font('Helvetica-Bold').text('DAFTAR STOK BARANG', startX, currentY, {
      width: 510,
      align: 'center',
    });
    currentY = doc.y + 12;

    const colWidths = [30, 80, 180, 60, 60, 100];
    const headers = ['No', 'Kode', 'Nama Barang', 'Satuan', 'Stok', 'Harga Rata-rata'];

    let headerY = currentY;
    doc.rect(startX, headerY, 510, 18).fill('#6c757d');
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(7);
    let x = startX;
    headers.forEach((h, i) => {
      const align = i >= 3 ? 'right' : i === 0 ? 'center' : 'left';
      doc.text(h, x + 4, headerY + 4, { width: colWidths[i] - 8, align });
      x += colWidths[i];
    });

    let rowY = headerY + 18;
    doc.fillColor('#000').font('Helvetica').fontSize(7);

    const drawHeaderRow = (y) => {
      doc.rect(startX, y, 510, 18).fill('#6c757d');
      doc.fillColor('#fff').font('Helvetica-Bold').fontSize(7);
      let hx = startX;
      headers.forEach((h, i) => {
        const align = i >= 3 ? 'right' : i === 0 ? 'center' : 'left';
        doc.text(h, hx + 4, y + 4, { width: colWidths[i] - 8, align });
        hx += colWidths[i];
      });
      doc.fillColor('#000').font('Helvetica').fontSize(7);
      return y + 18;
    };

    data.forEach((item, index) => {
      if (rowY + 16 > 780) {
        doc.addPage();
        rowY = 40;
        rowY = drawHeaderRow(rowY);
      }
      doc.rect(startX, rowY, 510, 16).stroke();
      const rowData = [
        (index + 1).toString(),
        item.kode_barang || '-',
        item.nama_barang || '-',
        item.satuan || 'Pcs',
        String(item.stok_awal || 0),
        `Rp ${formatRupiah(item.harga_awal || 0)}`,
      ];
      x = startX;
      rowData.forEach((text, i) => {
        const align = i >= 3 ? 'right' : i === 0 ? 'center' : 'left';
        doc.text(text, x + 4, rowY + 3, { width: colWidths[i] - 8, align });
        x += colWidths[i];
      });
      rowY += 16;
    });

    if (data.length > 0) {
      const totalStok = data.reduce((sum, item) => sum + (parseInt(item.stok_awal) || 0), 0);
      const totalNilai = data.reduce(
        (sum, item) => sum + (parseFloat(item.stok_awal) || 0) * (parseFloat(item.harga_awal) || 0),
        0
      );

      doc.rect(startX, rowY, 510, 18).fill('#eeeeee');
      doc.fillColor('#000').font('Helvetica-Bold').fontSize(7);
      const totalTexts = ['', '', '', 'TOTAL', String(totalStok), `Rp ${formatRupiah(totalNilai)}`];
      x = startX;
      totalTexts.forEach((text, i) => {
        const align = i >= 3 ? 'right' : i === 0 ? 'center' : 'left';
        doc.text(text, x + 4, rowY + 4, { width: colWidths[i] - 8, align });
        x += colWidths[i];
      });
    }

    doc.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal mengekspor PDF.' });
  }
};