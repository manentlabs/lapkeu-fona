// controllers/JenisPendapatanController.js

const JenisPendapatan = require('../models/JenisPendapatan');
const Akun = require('../models/Akun');

// ============================================================
// HELPER
// ============================================================

function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_');
}

function normalizeKode(kode) {
  return String(kode || '')
    .trim()
    .toUpperCase();
}

function parseUrutan(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const number = Number(value);

  if (!Number.isInteger(number) || number < 1) {
    return null;
  }

  return number;
}

// ============================================================
// INCLUDE AKUN
// ============================================================

const akunInclude = {
  model: Akun,
  as: 'akun',
  attributes: ['id', 'kode_akun', 'nama_akun'],
};

// ============================================================
// GET /api/pengaturan/jenis-pendapatan
// ============================================================

exports.index = async (req, res) => {
  try {
    const { include_inactive } = req.query;

    const where = {};

    if (include_inactive !== 'true') {
      where.is_active = true;
    }

    const data = await JenisPendapatan.findAll({
      where,
      include: [akunInclude],
      order: [
        ['urutan', 'ASC'],
        ['id', 'ASC'],
      ],
    });

    return res.json({ data });
  } catch (err) {
    console.error('❌ Error index JenisPendapatan:', err);

    return res.status(500).json({
      message: 'Gagal mengambil data jenis pendapatan.',
    });
  }
};

// ============================================================
// GET /api/pengaturan/jenis-pendapatan/:id
// ============================================================

exports.show = async (req, res) => {
  try {
    const { id } = req.params;

    const item = await JenisPendapatan.findByPk(id, {
      include: [akunInclude],
    });

    if (!item) {
      return res.status(404).json({
        message: 'Jenis pendapatan tidak ditemukan.',
      });
    }

    return res.json({
      data: item,
    });
  } catch (err) {
    console.error('❌ Error show JenisPendapatan:', err);

    return res.status(500).json({
      message: 'Gagal mengambil data jenis pendapatan.',
    });
  }
};

// ============================================================
// POST /api/pengaturan/jenis-pendapatan
// ============================================================

exports.store = async (req, res) => {
  try {
    const { kode, nama, akun_id, urutan } = req.body;

    // --------------------------------------------------------
    // 1. Validasi kode
    // --------------------------------------------------------

    const normalizedKode = normalizeKode(kode);

    if (!normalizedKode) {
      return res.status(422).json({
        message: 'Kode jenis pendapatan wajib diisi.',
      });
    }

    // --------------------------------------------------------
    // 2. Validasi nama
    // --------------------------------------------------------

    const normalizedNama = String(nama || '').trim();

    if (!normalizedNama) {
      return res.status(422).json({
        message: 'Nama jenis pendapatan wajib diisi.',
      });
    }

    // --------------------------------------------------------
    // 3. Validasi akun
    // --------------------------------------------------------

    if (akun_id === undefined || akun_id === null || akun_id === '') {
      return res.status(422).json({
        message: 'Akun pendapatan wajib dipilih.',
      });
    }

    const akun = await Akun.findOne({
      where: {
        id: akun_id,
        is_active: 1,
      },
    });

    if (!akun) {
      return res.status(422).json({
        message: 'Akun yang dipilih tidak ditemukan.',
      });
    }

    // --------------------------------------------------------
    // 4. Cek duplikat kode
    // --------------------------------------------------------

    const existingKode = await JenisPendapatan.findOne({
      where: {
        kode: normalizedKode,
      },
    });

    if (existingKode) {
      return res.status(422).json({
        message: `Kode "${normalizedKode}" sudah digunakan.`,
      });
    }

    // --------------------------------------------------------
    // 5. Generate kolom_key
    // --------------------------------------------------------

    const kolomKey = slugify(normalizedNama);

    if (!kolomKey) {
      return res.status(422).json({
        message: 'Nama tidak valid untuk dijadikan key.',
      });
    }

    // --------------------------------------------------------
    // 6. Cek duplikat kolom_key
    // --------------------------------------------------------

    const existingKey = await JenisPendapatan.findOne({
      where: {
        kolom_key: kolomKey,
      },
    });

    if (existingKey) {
      return res.status(422).json({
        message: `Jenis pendapatan dengan nama serupa ("${existingKey.nama}") sudah ada.`,
      });
    }

    // --------------------------------------------------------
    // 7. Tentukan urutan
    // --------------------------------------------------------

    let finalUrutan = parseUrutan(urutan);

    if (finalUrutan === null) {
      const last = await JenisPendapatan.findOne({
        order: [['urutan', 'DESC']],
      });

      finalUrutan = last ? Number(last.urutan) + 1 : 1;
    }

    // --------------------------------------------------------
    // 8. Buat jenis pendapatan
    // --------------------------------------------------------

    const created = await JenisPendapatan.create({
      kode: normalizedKode,
      nama: normalizedNama,
      kolom_key: kolomKey,
      akun_id: akun_id,
      urutan: finalUrutan,
      is_active: true,
    });

    // --------------------------------------------------------
    // 9. Ambil kembali dengan relasi akun
    // --------------------------------------------------------

    const result = await JenisPendapatan.findByPk(created.id, {
      include: [akunInclude],
    });

    return res.status(201).json({
      message: 'Jenis pendapatan berhasil ditambahkan.',
      data: result,
    });
  } catch (err) {
    console.error('❌ Error store JenisPendapatan:', err);

    return res.status(500).json({
      message: 'Gagal menambahkan jenis pendapatan.',
    });
  }
};

// ============================================================
// PUT /api/pengaturan/jenis-pendapatan/:id
//
// ATURAN FIELD:
//   id          -> LOCK
//   kode        -> LOCK
//   nama        -> EDITABLE
//   kolom_key   -> LOCK
//   akun_id     -> LOCK
//   urutan      -> EDITABLE
//   is_active   -> EDITABLE
//
// Field yang LOCK tidak diproses sama sekali di sini, meskipun
// dikirim di body request nilainya akan diabaikan.
// ============================================================

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { nama, is_active, urutan } = req.body;

    const item = await JenisPendapatan.findByPk(id);

    if (!item) {
      return res.status(404).json({
        message: 'Jenis pendapatan tidak ditemukan.',
      });
    }

    const updateData = {};

    // --------------------------------------------------------
    // UPDATE NAMA
    // --------------------------------------------------------

    if (nama !== undefined) {
      const newNama = String(nama).trim();

      if (!newNama) {
        return res.status(422).json({
          message: 'Nama jenis pendapatan tidak boleh kosong.',
        });
      }

      if (newNama !== item.nama) {
        updateData.nama = newNama;
      }
    }

    // --------------------------------------------------------
    // KODE & AKUN_ID -> LOCKED
    // --------------------------------------------------------

    // --------------------------------------------------------
    // UPDATE STATUS
    // --------------------------------------------------------

    if (is_active !== undefined) {
      if (
        is_active !== true &&
        is_active !== false &&
        is_active !== 1 &&
        is_active !== 0 &&
        is_active !== '1' &&
        is_active !== '0'
      ) {
        return res.status(422).json({
          message: 'Status aktif tidak valid.',
        });
      }

      updateData.is_active =
        is_active === true || is_active === 1 || is_active === '1';
    }

    // --------------------------------------------------------
    // UPDATE URUTAN
    // --------------------------------------------------------

    if (urutan !== undefined) {
      const newUrutan = parseUrutan(urutan);

      if (newUrutan === null) {
        return res.status(422).json({
          message: 'Urutan harus berupa angka bulat lebih dari 0.',
        });
      }

      updateData.urutan = newUrutan;
    }

    // --------------------------------------------------------
    // SIMPAN
    // --------------------------------------------------------

    await item.update(updateData);

    // --------------------------------------------------------
    // AMBIL DATA TERBARU
    // --------------------------------------------------------

    const updated = await JenisPendapatan.findByPk(item.id, {
      include: [akunInclude],
    });

    return res.json({
      message: 'Jenis pendapatan berhasil diperbarui.',
      data: updated,
    });
  } catch (err) {
    console.error('❌ Error update JenisPendapatan:', err);

    return res.status(500).json({
      message: 'Gagal memperbarui jenis pendapatan.',
    });
  }
};

// ============================================================
// DELETE /api/pengaturan/jenis-pendapatan/:id
//
// DELETE = NONAKTIFKAN
// Bukan menghapus data secara fisik.
// ============================================================

exports.destroy = async (req, res) => {
  try {
    const { id } = req.params;

    const item = await JenisPendapatan.findByPk(id);

    if (!item) {
      return res.status(404).json({
        message: 'Jenis pendapatan tidak ditemukan.',
      });
    }

    if (!item.is_active) {
      return res.status(422).json({
        message: 'Jenis pendapatan sudah tidak aktif.',
      });
    }

    await item.update({
      is_active: false,
    });

    const updated = await JenisPendapatan.findByPk(item.id, {
      include: [akunInclude],
    });

    return res.json({
      message: 'Jenis pendapatan berhasil dinonaktifkan.',
      data: updated,
    });
  } catch (err) {
    console.error('❌ Error destroy JenisPendapatan:', err);

    return res.status(500).json({
      message: 'Gagal menonaktifkan jenis pendapatan.',
    });
  }
};