const { Op } = require('sequelize');
const { Anggota, Transaksi, TabunganAwal, sequelize } = require('../models');
const { QueryTypes } = require('sequelize');

class TabunganService {
  // Dapatkan daftar jenis tabungan dari kolom yang ada di tabel tabungan_awal (atau dari konfigurasi)
  static getJenisTabungan() {
    // Bisa diambil dari konfigurasi atau dari struktur tabel
    // Untuk contoh, kita hardcode atau ambil dari konfigurasi
    return [
      'tabungan_wajib',
      'tabungan_sukarela',
      'tabungan_qurban',
      'tabungan_pokok',
      // tambahkan sesuai kebutuhan
    ];
  }

  static getKeyFromKolom(kolom) {
    return kolom.replace('tabungan_', '');
  }

  static hitungDariTransaksi(transaksi, jenisTabungan) {
    const hasil = {};
    jenisTabungan.forEach(k => hasil[k] = 0);

    transaksi.forEach(t => {
      const ket = (t.akun || '').toLowerCase();
      const jumlah = parseFloat(t.jumlah) || 0;

      for (const kolom of jenisTabungan) {
        const key = this.getKeyFromKolom(kolom);
        if (ket.includes(key)) {
          hasil[kolom] += jumlah;
          break;
        }
      }
    });

    // Pastikan tidak negatif
    for (const k in hasil) {
      hasil[k] = Math.max(0, hasil[k]);
    }

    return hasil;
  }

  // Ambil semua anggota dan map dengan saldo tabungan
  static async mapAnggotaWithTabungan(filters = {}) {
    const { tanggal_dari, tanggal_sampai, nama_anggota, no_anggota } = filters;

    // Include tabungan awal hanya jika tidak ada filter tanggal
    const includeTabunganAwal = !tanggal_dari && !tanggal_sampai;

    // Query anggota
    const whereAnggota = {};
    if (nama_anggota) whereAnggota.nama = { [Op.like]: `%${nama_anggota}%` };
    if (no_anggota) whereAnggota.no_anggota = { [Op.like]: `%${no_anggota}%` };

    const semuaAnggota = await Anggota.findAll({
      where: whereAnggota,
      include: [
        {
          model: Transaksi,
          as: 'transaksi',
        },
      ],
      order: [['no_anggota', 'ASC']],
    });

    // Ambil tabungan awal (jika tidak ada filter tanggal)
    let tabunganAwalMap = {};
    if (includeTabunganAwal) {
      const tabAwal = await TabunganAwal.findAll();
      tabunganAwalMap = tabAwal.reduce((acc, curr) => {
        acc[curr.anggota_id] = curr;
        return acc;
      }, {});
    }

    const jenisTabungan = this.getJenisTabungan();

    const mapped = semuaAnggota.map(anggota => {
      // Filter transaksi yang terkait tabungan
      let transaksi = anggota.transaksi.filter(t => {
        const ket = (t.akun || '').toLowerCase();
        return jenisTabungan.some(kolom => ket.includes(this.getKeyFromKolom(kolom)));
      });

      // Filter tanggal
      if (tanggal_dari) {
        transaksi = transaksi.filter(t => new Date(t.tanggal) >= new Date(tanggal_dari));
      }
      if (tanggal_sampai) {
        transaksi = transaksi.filter(t => new Date(t.tanggal) <= new Date(tanggal_sampai));
      }

      // Hitung dari transaksi
      const dariTransaksi = this.hitungDariTransaksi(transaksi, jenisTabungan);

      // Ambil tabungan awal
      const tabAwal = includeTabunganAwal ? tabunganAwalMap[anggota.id] : null;

      let total = 0;
      const result = { ...anggota.toJSON() };
      for (const kolom of jenisTabungan) {
        const nilaiTransaksi = dariTransaksi[kolom] || 0;
        const nilaiTabAwal = tabAwal ? (parseFloat(tabAwal.saldo_awal[kolom]) || 0) : 0;
        const nilaiAkhir = nilaiTransaksi + nilaiTabAwal;
        result[kolom] = nilaiAkhir;
        total += nilaiAkhir;
      }
      result.total_tabungan = total;

      return result;
    });

    return {
      data: mapped,
      jenisTabungan,
    };
  }

  // Untuk summary
  static async getSummary(mappedData, jenisTabungan) {
    const saldo = {};
    for (const kolom of jenisTabungan) {
      saldo[kolom] = mappedData.reduce((sum, item) => sum + (item[kolom] || 0), 0);
    }
    const totalTabunganAkhir = mappedData.reduce((sum, item) => sum + (item.total_tabungan || 0), 0);
    const jumlahAnggotaMenabung = mappedData.filter(item => item.total_tabungan > 0).length;

    // Saldo awal (dari tabungan_awal + transaksi sampai akhir bulan lalu)
    const bulanLalu = new Date();
    bulanLalu.setMonth(bulanLalu.getMonth() - 1);
    bulanLalu.setHours(0, 0, 0, 0);

    const semuaTabunganAwal = await TabunganAwal.findAll();
    let totalDariTabunganAwal = 0;
    for (const ta of semuaTabunganAwal) {
      for (const kolom of jenisTabungan) {
        totalDariTabunganAwal += parseFloat(ta.saldo_awal[kolom]) || 0;
      }
    }

    // Transaksi sampai akhir bulan lalu
    const semuaAnggota = await Anggota.findAll({ include: ['transaksi'] });
    let totalTransaksiBulanLalu = 0;
    for (const anggota of semuaAnggota) {
      const transaksiLalu = anggota.transaksi.filter(t => new Date(t.tanggal) <= bulanLalu);
      const hasil = this.hitungDariTransaksi(transaksiLalu, jenisTabungan);
      for (const kolom of jenisTabungan) {
        totalTransaksiBulanLalu += hasil[kolom];
      }
    }

    const totalSaldoAwal = totalDariTabunganAwal + totalTransaksiBulanLalu;

    // Label bulan lalu
    const bulanLaluLabel = bulanLalu.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

    return {
      saldo,
      totalTabunganAkhir,
      jumlahAnggotaMenabung,
      totalSaldoAwal,
      labelBulanLalu: bulanLaluLabel,
    };
  }
}

module.exports = TabunganService;