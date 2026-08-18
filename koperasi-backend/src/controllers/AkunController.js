const Akun = require("../models/Akun");
const { Op } = require("sequelize");

// Helper: build tree (hierarki)
function buildTree(akunList, parentId = null, level = 0) {
  const result = [];
  const children = akunList.filter(a => a.parent_id === parentId);
  for (const child of children) {
    const node = { ...child.toJSON(), level };
    const grandChildren = buildTree(akunList, child.id, level + 1);
    if (grandChildren.length > 0) node.children = grandChildren;
    result.push(node);
  }
  return result;
}

// Index - daftar akun dengan paginasi dan pencarian
exports.index = async (req, res) => {
  try {
    const { search, page = 1, per_page = 10 } = req.query;
    const where = {};
    if (search) {
      where[Op.or] = [
        { kode_akun: { [Op.like]: `%${search}%` } },
        { nama_akun: { [Op.like]: `%${search}%` } },
      ];
    }

    const { rows, count } = await Akun.findAndCountAll({
      where,
      order: [["kode_akun", "ASC"]],
      limit: parseInt(per_page),
      offset: (parseInt(page) - 1) * parseInt(per_page),
    });

    // Hitung ringkasan
    const total = await Akun.count();
    const induk = await Akun.count({ where: { parent_id: null } });
    const sub = total - induk;

    return res.json({
      data: rows,
      pagination: {
        page: parseInt(page),
        per_page: parseInt(per_page),
        total: count,
        total_pages: Math.ceil(count / per_page),
      },
      summary: { total, induk, sub },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Gagal mengambil data akun." });
  }
};

// Ambil semua akun untuk dropdown (parent)
exports.list = async (req, res) => {
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

// Detail
exports.show = async (req, res) => {
  try {
    const akun = await Akun.findByPk(req.params.id);
    if (!akun) return res.status(404).json({ message: "Akun tidak ditemukan." });
    return res.json({ data: akun });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Gagal mengambil detail akun." });
  }
};

// Store
exports.store = async (req, res) => {
  try {
    const { kode_akun, nama_akun, tipe_akun, parent_id, is_active, saldo_awal, pajak } = req.body;
    if (!kode_akun || !nama_akun || !tipe_akun) {
      return res.status(422).json({ message: "Kode, nama, dan tipe akun wajib diisi." });
    }
    const existing = await Akun.findOne({ where: { kode_akun } });
    if (existing) return res.status(422).json({ message: "Kode akun sudah digunakan." });

    const akun = await Akun.create({
      kode_akun,
      nama_akun,
      tipe_akun,
      parent_id: parent_id || null,
      is_active: is_active !== undefined ? is_active : 1,
      saldo_awal: saldo_awal || 0,
      pajak: pajak || null,
    });
    return res.status(201).json({ message: "Akun berhasil ditambahkan.", data: akun });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Gagal menambahkan akun." });
  }
};

// Update
exports.update = async (req, res) => {
  try {
    const akun = await Akun.findByPk(req.params.id);
    if (!akun) return res.status(404).json({ message: "Akun tidak ditemukan." });

    const { kode_akun, nama_akun, tipe_akun, parent_id, is_active, saldo_awal, pajak } = req.body;
    if (kode_akun && kode_akun !== akun.kode_akun) {
      const existing = await Akun.findOne({ where: { kode_akun } });
      if (existing) return res.status(422).json({ message: "Kode akun sudah digunakan." });
    }

    await akun.update({
      kode_akun: kode_akun || akun.kode_akun,
      nama_akun: nama_akun || akun.nama_akun,
      tipe_akun: tipe_akun || akun.tipe_akun,
      parent_id: parent_id !== undefined ? parent_id : akun.parent_id,
      is_active: is_active !== undefined ? is_active : akun.is_active,
      saldo_awal: saldo_awal !== undefined ? saldo_awal : akun.saldo_awal,
      pajak: pajak !== undefined ? pajak : akun.pajak,
    });
    return res.json({ message: "Akun berhasil diperbarui.", data: akun });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Gagal memperbarui akun." });
  }
};

// Destroy
exports.destroy = async (req, res) => {
  try {
    const akun = await Akun.findByPk(req.params.id);
    if (!akun) return res.status(404).json({ message: "Akun tidak ditemukan." });
    // Cek apakah ada anak
    const children = await Akun.count({ where: { parent_id: req.params.id } });
    if (children > 0) {
      return res.status(422).json({ message: "Akun ini memiliki sub-akun. Hapus sub-akun terlebih dahulu." });
    }
    await akun.destroy();
    return res.json({ message: "Akun berhasil dihapus." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Gagal menghapus akun." });
  }
};