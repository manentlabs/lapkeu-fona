const { Op } = require('sequelize');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const Anggota = require('../models/Anggota');
const Role = require('../models/Role');

// Helper untuk format response
function formatUser(user) {
  const json = user.toJSON ? user.toJSON() : user;
  // Hapus password dari response
  delete json.password;
  return json;
}

// ========== INDEX ==========
exports.index = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.per_page) || 10;
    const search = req.query.search || '';

    const where = {};
    if (search) {
      where[Op.or] = [
        { username: { [Op.like]: `%${search}%` } },
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }

    const { rows, count } = await User.findAndCountAll({
      where,
      include: [
        { model: Role, as: 'role', attributes: ['id', 'name'] },
        { model: Anggota, as: 'anggota', attributes: ['id', 'no_anggota', 'nama'] },
      ],
      order: [['created_at', 'DESC']],
      limit: perPage,
      offset: (page - 1) * perPage,
    });

    return res.json({
      data: rows.map(formatUser),
      pagination: {
        page,
        per_page: perPage,
        total: count,
        total_pages: Math.ceil(count / perPage),
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal mengambil data user.' });
  }
};

// ========== SUMMARY ==========
exports.summary = async (req, res) => {
  try {
    const total = await User.count();
    const active = await User.count({ where: { is_active: 1 } });
    const inactive = await User.count({ where: { is_active: 0 } });

    return res.json({
      total,
      active,
      inactive,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Gagal mengambil ringkasan user." });
  }
};

// ========== SHOW ==========
exports.show = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      include: [
        { model: Role, as: 'role', attributes: ['id', 'name'] },
        { model: Anggota, as: 'anggota', attributes: ['id', 'no_anggota', 'nama'] },
      ],
    });
    if (!user) {
      return res.status(404).json({ message: 'User tidak ditemukan.' });
    }
    return res.json({ data: formatUser(user) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal mengambil detail user.' });
  }
};

// ========== STORE ==========
exports.store = async (req, res) => {
  try {
    const { username, name, email, password, role_id, is_active, anggota_id } = req.body;

    // Validasi wajib
    if (!username || !name || !email || !password || !role_id) {
      return res.status(422).json({ message: 'Semua field wajib diisi (username, name, email, password, role_id).' });
    }

    // Cek duplikat username / email
    const existing = await User.findOne({
      where: { [Op.or]: [{ email }, { username }] },
    });
    if (existing) {
      return res.status(422).json({ message: 'Username atau email sudah terdaftar.' });
    }

    // Validasi anggota_id jika diberikan
    if (anggota_id) {
      const anggota = await Anggota.findByPk(anggota_id);
      if (!anggota) {
        return res.status(422).json({ message: 'Anggota tidak ditemukan.' });
      }
      const userWithAnggota = await User.findOne({ where: { anggota_id } });
      if (userWithAnggota) {
        return res.status(422).json({ message: 'Anggota ini sudah memiliki akun user.' });
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Buat user
    const user = await User.create({
      username,
      name,
      email,
      password: hashedPassword,
      role_id,
      is_active: is_active !== undefined ? is_active : true,
      anggota_id: anggota_id || null,
    });

    // Ambil data user dengan relasi untuk response
    const createdUser = await User.findByPk(user.id, {
      include: [
        { model: Role, as: 'role' },
        { model: Anggota, as: 'anggota' },
      ],
    });

    return res.status(201).json({
      message: 'User berhasil dibuat.',
      data: formatUser(createdUser),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal membuat user.' });
  }
};

// ========== UPDATE ==========
exports.update = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User tidak ditemukan.' });
    }

    const { username, name, email, password, role_id, is_active, anggota_id } = req.body;

    // Cek duplikat username/email (kecuali dirinya sendiri)
    if (username && username !== user.username) {
      const exists = await User.findOne({ where: { username } });
      if (exists) return res.status(422).json({ message: 'Username sudah digunakan.' });
    }
    if (email && email !== user.email) {
      const exists = await User.findOne({ where: { email } });
      if (exists) return res.status(422).json({ message: 'Email sudah digunakan.' });
    }

    // Validasi perubahan anggota_id
    if (anggota_id !== undefined && anggota_id !== user.anggota_id) {
      if (anggota_id) {
        const anggota = await Anggota.findByPk(anggota_id);
        if (!anggota) {
          return res.status(422).json({ message: 'Anggota tidak ditemukan.' });
        }
        const userWithAnggota = await User.findOne({ where: { anggota_id } });
        if (userWithAnggota && userWithAnggota.id !== user.id) {
          return res.status(422).json({ message: 'Anggota ini sudah memiliki akun user lain.' });
        }
      }
    }

    // Siapkan data update
    const updateData = {
      username: username || user.username,
      name: name || user.name,
      email: email || user.email,
      role_id: role_id || user.role_id,
      is_active: is_active !== undefined ? is_active : user.is_active,
      anggota_id: anggota_id !== undefined ? anggota_id : user.anggota_id,
    };

    // Update password jika diisi
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    await user.update(updateData);

    // Ambil data user terbaru dengan relasi
    const updatedUser = await User.findByPk(user.id, {
      include: [
        { model: Role, as: 'role' },
        { model: Anggota, as: 'anggota' },
      ],
    });

    return res.json({
      message: 'User berhasil diperbarui.',
      data: formatUser(updatedUser),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal memperbarui user.' });
  }
};

// ========== DESTROY ==========
exports.destroy = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User tidak ditemukan.' });
    }

    await user.destroy();
    return res.json({ message: 'User berhasil dihapus.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal menghapus user.' });
  }
};

// ========== AUTOCOMPLETE ==========
// Untuk pencarian user di frontend (filter)
exports.autocomplete = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.json({ data: [] });
    }

    const users = await User.findAll({
      where: {
        [Op.or]: [
          { username: { [Op.like]: `%${q}%` } },
          { name: { [Op.like]: `%${q}%` } },
          { email: { [Op.like]: `%${q}%` } },
        ],
      },
      attributes: ['id', 'username', 'name', 'email'],
      limit: 5,
      order: [['username', 'ASC']],
    });

    return res.json({ data: users });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal mengambil saran user.' });
  }
};

// controllers/UserController.js
exports.checkDuplicate = async (req, res) => {
  try {
    const { username, email } = req.query;
    const where = {};
    if (username) where.username = username;
    if (email) where.email = email;
    
    if (Object.keys(where).length === 0) {
      return res.status(400).json({ message: 'Query parameter username atau email diperlukan.' });
    }

    // Jika sedang edit, abaikan data sendiri
    const excludeId = req.query.exclude_id;
    if (excludeId) {
      where.id = { [Op.ne]: excludeId };
    }

    const user = await User.findOne({ where });
    return res.json({ exists: !!user });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Gagal mengecek duplikat.' });
  }
};