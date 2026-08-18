const PersentaseShu = require("../models/PersentaseShu");
const { Op } = require("sequelize");

// Index dengan pagination, pencarian & ringkasan
exports.index = async (req, res) => {
  try {
    const { search, page = 1, per_page = 10 } = req.query;
    const where = {};
    if (search) {
      where.keterangan = { [Op.like]: `%${search}%` };
    }

    const { rows, count } = await PersentaseShu.findAndCountAll({
      where,
      order: [["id", "ASC"]],
      limit: parseInt(per_page),
      offset: (parseInt(page) - 1) * parseInt(per_page),
    });

    // Ringkasan
    const total = await PersentaseShu.count();
    const totalPersentase = await PersentaseShu.sum("persentase");

    return res.json({
      data: rows,
      pagination: {
        page: parseInt(page),
        per_page: parseInt(per_page),
        total: count,
        total_pages: Math.ceil(count / per_page),
      },
      summary: { total, totalPersentase: totalPersentase || 0 },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Gagal mengambil data persentase SHU." });
  }
};

// Show detail
exports.show = async (req, res) => {
  try {
    const data = await PersentaseShu.findByPk(req.params.id);
    if (!data) return res.status(404).json({ message: "Data tidak ditemukan." });
    return res.json({ data });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Gagal mengambil detail." });
  }
};

// Store
exports.store = async (req, res) => {
  try {
    const { keterangan, persentase } = req.body;
    if (!keterangan || persentase === undefined || persentase === null) {
      return res.status(422).json({ message: "Keterangan dan persentase wajib diisi." });
    }
    const data = await PersentaseShu.create({ keterangan, persentase });
    return res.status(201).json({ message: "Data berhasil ditambahkan.", data });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Gagal menambahkan data." });
  }
};

// Update
exports.update = async (req, res) => {
  try {
    const data = await PersentaseShu.findByPk(req.params.id);
    if (!data) return res.status(404).json({ message: "Data tidak ditemukan." });

    const { keterangan, persentase } = req.body;
    await data.update({
      keterangan: keterangan || data.keterangan,
      persentase: persentase !== undefined ? persentase : data.persentase,
    });
    return res.json({ message: "Data berhasil diperbarui.", data });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Gagal memperbarui data." });
  }
};

// Destroy
exports.destroy = async (req, res) => {
  try {
    const data = await PersentaseShu.findByPk(req.params.id);
    if (!data) return res.status(404).json({ message: "Data tidak ditemukan." });
    await data.destroy();
    return res.json({ message: "Data berhasil dihapus." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Gagal menghapus data." });
  }
};