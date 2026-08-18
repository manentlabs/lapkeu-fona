// src/controllers/KodeReferensiController.js
const KodeReferensi = require("../models/KodeReferensi");
const Akun = require("../models/Akun");
const { Op, Sequelize } = require("sequelize");

// Index dengan pagination, pencarian & ringkasan
exports.index = async (req, res) => {
  try {
    const { search, page = 1, per_page = 10 } = req.query;
    const where = {};
    if (search) {
      where[Op.or] = [
        { kode: { [Op.like]: `%${search}%` } },
        { uraian_transaksi: { [Op.like]: `%${search}%` } },
        { label: { [Op.like]: `%${search}%` } },
      ];
    }

    const { rows, count } = await KodeReferensi.findAndCountAll({
      where,
      include: [
        { model: Akun, as: "akunDebet", attributes: ["id", "kode_akun", "nama_akun"] },
        { model: Akun, as: "akunKredit", attributes: ["id", "kode_akun", "nama_akun"] },
      ],
      order: [
        [Sequelize.literal("CAST(kode AS UNSIGNED)"), "ASC"],
        ["kode", "ASC"],
      ],
      limit: parseInt(per_page),
      offset: (parseInt(page) - 1) * parseInt(per_page),
    });

    // Ringkasan (total keseluruhan, tidak terpengaruh pagination)
    const total = await KodeReferensi.count();
    const totalWithDebet = await KodeReferensi.count({ where: { akun_debet_id: { [Op.ne]: null } } });
    const totalWithKredit = await KodeReferensi.count({ where: { akun_kredit_id: { [Op.ne]: null } } });

    return res.json({
      data: rows,
      pagination: {
        page: parseInt(page),
        per_page: parseInt(per_page),
        total: count,
        total_pages: Math.ceil(count / per_page),
      },
      summary: { total, totalWithDebet, totalWithKredit },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Gagal mengambil data referensi." });
  }
};

// Show detail
exports.show = async (req, res) => {
  try {
    const data = await KodeReferensi.findByPk(req.params.id, {
      include: [
        { model: Akun, as: "akunDebet", attributes: ["id", "kode_akun", "nama_akun"] },
        { model: Akun, as: "akunKredit", attributes: ["id", "kode_akun", "nama_akun"] },
      ],
    });
    if (!data) return res.status(404).json({ message: "Referensi tidak ditemukan." });
    return res.json({ data });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Gagal mengambil detail referensi." });
  }
};

// Store
exports.store = async (req, res) => {
  try {
    const { kode, uraian_transaksi, label, akun_debet_id, akun_kredit_id } = req.body;

    if (!kode || !uraian_transaksi || !label) {
      return res.status(422).json({ message: "Kode, uraian, dan label wajib diisi." });
    }

    const existing = await KodeReferensi.findOne({ where: { kode } });
    if (existing) return res.status(422).json({ message: "Kode sudah digunakan." });

    // Cek akun debet jika ada
    let akunDebet = null;
    if (akun_debet_id) {
      akunDebet = await Akun.findByPk(akun_debet_id);
      if (!akunDebet) return res.status(422).json({ message: "Akun debet tidak ditemukan." });
    }

    let akunKredit = null;
    if (akun_kredit_id) {
      akunKredit = await Akun.findByPk(akun_kredit_id);
      if (!akunKredit) return res.status(422).json({ message: "Akun kredit tidak ditemukan." });
    }

    const data = await KodeReferensi.create({
      kode,
      uraian_transaksi,
      label,
      akun_debet: akunDebet ? akunDebet.nama_akun : null,
      akun_debet_id: akun_debet_id || null,
      akun_kredit: akunKredit ? akunKredit.nama_akun : null,
      akun_kredit_id: akun_kredit_id || null,
    });

    return res.status(201).json({ message: "Referensi berhasil ditambahkan.", data });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Gagal menambahkan referensi." });
  }
};

// Update
exports.update = async (req, res) => {
  try {
    const ref = await KodeReferensi.findByPk(req.params.id);
    if (!ref) return res.status(404).json({ message: "Referensi tidak ditemukan." });

    const { kode, uraian_transaksi, label, akun_debet_id, akun_kredit_id } = req.body;

    if (kode && kode !== ref.kode) {
      const existing = await KodeReferensi.findOne({ where: { kode } });
      if (existing) return res.status(422).json({ message: "Kode sudah digunakan." });
    }

    let akunDebet = null;
    if (akun_debet_id) {
      akunDebet = await Akun.findByPk(akun_debet_id);
      if (!akunDebet) return res.status(422).json({ message: "Akun debet tidak ditemukan." });
    }

    let akunKredit = null;
    if (akun_kredit_id) {
      akunKredit = await Akun.findByPk(akun_kredit_id);
      if (!akunKredit) return res.status(422).json({ message: "Akun kredit tidak ditemukan." });
    }

    await ref.update({
      kode: kode || ref.kode,
      uraian_transaksi: uraian_transaksi || ref.uraian_transaksi,
      label: label || ref.label,
      akun_debet: akunDebet ? akunDebet.nama_akun : null,
      akun_debet_id: akun_debet_id !== undefined ? akun_debet_id : ref.akun_debet_id,
      akun_kredit: akunKredit ? akunKredit.nama_akun : null,
      akun_kredit_id: akun_kredit_id !== undefined ? akun_kredit_id : ref.akun_kredit_id,
    });

    return res.json({ message: "Referensi berhasil diperbarui.", data: ref });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Gagal memperbarui referensi." });
  }
};

// Destroy
exports.destroy = async (req, res) => {
  try {
    const ref = await KodeReferensi.findByPk(req.params.id);
    if (!ref) return res.status(404).json({ message: "Referensi tidak ditemukan." });
    await ref.destroy();
    return res.json({ message: "Referensi berhasil dihapus." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Gagal menghapus referensi." });
  }
};

// List untuk dropdown akun
exports.listAkun = async (req, res) => {
  try {
    const akun = await Akun.findAll({
      attributes: ["id", "kode_akun", "nama_akun"],
      order: [["kode_akun", "ASC"]],
    });
    return res.json({ data: akun });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Gagal mengambil daftar akun." });
  }
};