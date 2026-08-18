const { Op, fn, col } = require("sequelize");
const Wilayah = require("../models/Wilayah");

// GET /api/wilayah/kecamatan?q=...  -> maksimal 5 saran teratas
exports.searchKecamatan = async (req, res) => {
  try {
    const { q } = req.query;
    const where = q ? { kecamatan: { [Op.like]: `%${q}%` } } : {};

    const rows = await Wilayah.findAll({
      attributes: [[fn("DISTINCT", col("kecamatan")), "kecamatan"]],
      where,
      order: [["kecamatan", "ASC"]],
      limit: 5,
    });

    return res.json({ data: rows.map((r) => r.kecamatan) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Gagal mengambil data kecamatan." });
  }
};

// GET /api/wilayah/desa?q=...&kecamatan=... -> maksimal 5 saran teratas,
// otomatis dibatasi ke kecamatan yang sedang dipilih jika ada
exports.searchDesa = async (req, res) => {
  try {
    const { q, kecamatan } = req.query;
    const where = {};
    if (q) where.desa = { [Op.like]: `%${q}%` };
    if (kecamatan) where.kecamatan = kecamatan;

    const rows = await Wilayah.findAll({
      attributes: [[fn("DISTINCT", col("desa")), "desa"]],
      where,
      order: [["desa", "ASC"]],
      limit: 5,
    });

    return res.json({ data: rows.map((r) => r.desa) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Gagal mengambil data desa." });
  }
};