// controllers/AnggotaDashboardController.js
const Anggota = require('../models/Anggota');
const User = require('../models/User');
const SimpananAwal = require('../models/SimpananAwal');
const TabunganAwal = require('../models/TabunganAwal');
const PiutangAwal = require('../models/PiutangAwal');
const Pinjaman = require('../models/Pinjaman');
const Transaksi = require('../models/Transaksi');
const JenisSimpanan = require('../models/JenisSimpanan');

exports.index = async (req, res) => {
  try {
    // Ambil user dari token (sudah ada req.userId dari verifyToken)
    const userId = req.userId;
    const user = await User.findByPk(userId, {
      include: [{ model: Anggota, as: 'anggota' }]
    });

    if (!user || !user.anggota) {
      return res.status(404).json({ message: 'Anggota tidak ditemukan' });
    }

    const anggotaId = user.anggota.id;

    // ---------- Total Simpanan (Pokok, Wajib, Sukarela) ----------
    // Ambil dulu id jenis_simpanan berdasarkan kode, baru sum tanpa include
    // supaya tidak kena ONLY_FULL_GROUP_BY

    const jenisSimpananList = await JenisSimpanan.findAll({
    where: { kode: ['SP', 'SW', 'SS'] },
    attributes: ['id', 'kode'],
    raw: true,
    });

    const jenisIdByKode = jenisSimpananList.reduce((acc, j) => {
    acc[j.kode] = j.id;
    return acc;
    }, {});

    const sumByKode = async (kode) => {
    const jenisId = jenisIdByKode[kode];
    if (!jenisId) return 0;
    const total = await SimpananAwal.sum('jumlah', {
        where: { anggota_id: anggotaId, jenis_simpanan_id: jenisId },
    });
    return total || 0;
    };

    const simpananPokok = await sumByKode('SP');
    const simpananWajib = await sumByKode('SW');
    const simpananSukarela = await sumByKode('SS');

    const totalSimpanan = simpananPokok + simpananWajib + simpananSukarela;

    // ---------- Total Tabungan ----------
    const totalTabungan = await TabunganAwal.sum('jumlah', {
      where: { anggota_id: anggotaId }
    }) || 0;

    // ---------- Total Piutang ----------
    const totalPiutang = await PiutangAwal.sum('jumlah', {
      where: { anggota_id: anggotaId }
    }) || 0;

    // ---------- Data Pinjaman ----------
    const pinjaman = await Pinjaman.findAll({
      where: { anggota_id: anggotaId },
      attributes: ['status', 'plafon', 'sisa_angsuran']
    });

    let totalPlafon = 0;
    let pinjamanAktif = 0;
    let pinjamanLunas = 0;
    let totalSisaAngsuran = 0;

    pinjaman.forEach((p) => {
      totalPlafon += parseFloat(p.plafon) || 0;
      if (p.status === 'aktif') {
        pinjamanAktif++;
        totalSisaAngsuran += parseInt(p.sisa_angsuran) || 0;
      } else if (p.status === 'lunas') {
        pinjamanLunas++;
      }
    });

    const rataSisaAngsuran = pinjamanAktif > 0 ? Math.round(totalSisaAngsuran / pinjamanAktif) : 0;

    // ---------- Transaksi Terbaru (5 data) ----------
    const transaksiTerbaru = await Transaksi.findAll({
      where: { anggota_id: anggotaId },
      attributes: ['tanggal', 'deskripsi', 'jumlah'],
      order: [['tanggal', 'DESC']],
      limit: 5
    });

    // ---------- Kirim Response ----------
    return res.json({
      totalSimpanan,
      totalSimpananPokok: simpananPokok,
      totalSimpananWajib: simpananWajib,
      totalSimpananSukarela: simpananSukarela,
      totalTabungan,
      totalPiutang,
      totalPlafon,
      pinjamanAktif,
      pinjamanLunas,
      sisaAngsuran: rataSisaAngsuran,
      transaksiTerbaru: transaksiTerbaru.map((t) => ({
        tanggal: t.tanggal,
        deskripsi: t.deskripsi,
        jumlah: parseFloat(t.jumlah) || 0
      }))
    });

  } catch (error) {
    console.error('❌ Error pada dashboard anggota:', error);
    return res.status(500).json({
      message: 'Gagal mengambil data dashboard anggota',
      detail: error.message
    });
  }
};