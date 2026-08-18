// controllers/AnggotaKeuanganController.js
const Anggota = require('../models/Anggota');
const User = require('../models/User');
const SimpananAwal = require('../models/SimpananAwal');
const TabunganAwal = require('../models/TabunganAwal');
const PiutangAwal = require('../models/PiutangAwal');
const JenisSimpanan = require('../models/JenisSimpanan');
const JenisTabungan = require('../models/JenisTabungan');
const JenisPiutang = require('../models/JenisPiutang');

async function getAnggotaByUserId(userId) {
  const user = await User.findByPk(userId, {
    include: [{ model: Anggota, as: 'anggota' }]
  });
  if (!user || !user.anggota) {
    throw new Error('Anggota tidak ditemukan');
  }
  return user.anggota;
}

// ─── SIMPANAN ────────────────────────────────────────────────
exports.getSimpanan = async (req, res) => {
  try {
    const userId = req.userId;
    const anggota = await getAnggotaByUserId(userId);
    const anggotaId = anggota.id;

    const simpanan = await SimpananAwal.findAll({
      where: { anggota_id: anggotaId },
      include: [{ model: JenisSimpanan, as: 'jenis_simpanan' }],
      order: [['tanggal', 'DESC']]
    });

    const grouped = {};
    simpanan.forEach(item => {
      const key = item.jenis_simpanan?.nama || 'Lainnya';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    });

    const totalPerJenis = {};
    Object.keys(grouped).forEach(key => {
      totalPerJenis[key] = grouped[key].reduce((sum, item) => sum + parseFloat(item.jumlah || 0), 0);
    });

    return res.json({
      success: true,
      data: simpanan,
      grouped,
      totalPerJenis,
      totalKeseluruhan: simpanan.reduce((sum, item) => sum + parseFloat(item.jumlah || 0), 0)
    });
  } catch (error) {
    console.error('Error getSimpanan:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── TABUNGAN ────────────────────────────────────────────────
exports.getTabungan = async (req, res) => {
  try {
    const userId = req.userId;
    const anggota = await getAnggotaByUserId(userId);
    const anggotaId = anggota.id;

    const tabungan = await TabunganAwal.findAll({
      where: { anggota_id: anggotaId },
      include: [{ model: JenisTabungan, as: 'jenis_tabungan' }],
      order: [['tanggal', 'DESC']]
    });

    const grouped = {};
    tabungan.forEach(item => {
      const key = item.jenis_tabungan?.nama || 'Lainnya';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    });

    const totalPerJenis = {};
    Object.keys(grouped).forEach(key => {
      totalPerJenis[key] = grouped[key].reduce((sum, item) => sum + parseFloat(item.jumlah || 0), 0);
    });

    return res.json({
      success: true,
      data: tabungan,
      grouped,
      totalPerJenis,
      totalKeseluruhan: tabungan.reduce((sum, item) => sum + parseFloat(item.jumlah || 0), 0)
    });
  } catch (error) {
    console.error('Error getTabungan:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── PIUTANG ──────────────────────────────────────────────────
exports.getPiutang = async (req, res) => {
  try {
    const userId = req.userId;
    const anggota = await getAnggotaByUserId(userId);
    const anggotaId = anggota.id;

    const piutang = await PiutangAwal.findAll({
      where: { anggota_id: anggotaId },
      include: [{ model: JenisPiutang, as: 'jenis_piutang' }],
      order: [['tanggal', 'DESC']]
    });

    const grouped = {};
    piutang.forEach(item => {
      const key = item.jenis_piutang?.nama || 'Lainnya';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    });

    const totalPerJenis = {};
    Object.keys(grouped).forEach(key => {
      totalPerJenis[key] = grouped[key].reduce((sum, item) => sum + parseFloat(item.jumlah || 0), 0);
    });

    return res.json({
      success: true,
      data: piutang,
      grouped,
      totalPerJenis,
      totalKeseluruhan: piutang.reduce((sum, item) => sum + parseFloat(item.jumlah || 0), 0)
    });
  } catch (error) {
    console.error('Error getPiutang:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};