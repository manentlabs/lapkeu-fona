// controllers/JenisPiutangController.js

const JenisPiutang = require('../models/JenisPiutang');
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
// GET /api/pengaturan/jenis-piutang
// ============================================================

exports.index = async (req, res) => {
  try {
    const { include_inactive } = req.query;

    const where = {};

    if (include_inactive !== 'true') {
      where.is_active = true;
    }

    const data = await JenisPiutang.findAll({
      where,
      include: [akunInclude],
      order: [
        ['urutan', 'ASC'],
        ['id', 'ASC'],
      ],
    });

    return res.json({ data });
  } catch (err) {
    console.error('❌ Error index JenisPiutang:', err);

    return res.status(500).json({
      message: 'Gagal mengambil data jenis piutang.',
    });
  }
};

// ============================================================
// GET /api/pengaturan/jenis-piutang/:id
// ============================================================

exports.show = async (req, res) => {
  try {
    const { id } = req.params;

    const item = await JenisPiutang.findByPk(id, {
      include: [akunInclude],
    });

    if (!item) {
      return res.status(404).json({
        message: 'Jenis piutang tidak ditemukan.',
      });
    }

    return res.json({
      data: item,
    });
  } catch (err) {
    console.error('❌ Error show JenisPiutang:', err);

    return res.status(500).json({
      message: 'Gagal mengambil data jenis piutang.',
    });
  }
};

// ============================================================
// POST /api/pengaturan/jenis-piutang
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
        message: 'Kode jenis piutang wajib diisi.',
      });
    }

    // --------------------------------------------------------
    // 2. Validasi nama
    // --------------------------------------------------------

    const normalizedNama = String(nama || '').trim();

    if (!normalizedNama) {
      return res.status(422).json({
        message: 'Nama jenis piutang wajib diisi.',
      });
    }

    // --------------------------------------------------------
    // 3. Validasi akun
    // --------------------------------------------------------

    if (akun_id === undefined || akun_id === null || akun_id === '') {
      return res.status(422).json({
        message: 'Akun piutang wajib dipilih.',
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

    const existingKode = await JenisPiutang.findOne({
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

    const existingKey = await JenisPiutang.findOne({
      where: {
        kolom_key: kolomKey,
      },
    });

    if (existingKey) {
      return res.status(422).json({
        message: `Jenis piutang dengan nama serupa ("${existingKey.nama}") sudah ada.`,
      });
    }

    // --------------------------------------------------------
    // 7. Tentukan urutan
    // --------------------------------------------------------

    let finalUrutan = parseUrutan(urutan);

    if (finalUrutan === null) {
      const last = await JenisPiutang.findOne({
        order: [['urutan', 'DESC']],
      });

      finalUrutan = last ? Number(last.urutan) + 1 : 1;
    }

    // --------------------------------------------------------
    // 8. Buat jenis piutang
    // --------------------------------------------------------

    const created = await JenisPiutang.create({
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

    const result = await JenisPiutang.findByPk(created.id, {
      include: [akunInclude],
    });

    return res.status(201).json({
      message: 'Jenis piutang berhasil ditambahkan.',
      data: result,
    });
  } catch (err) {
    console.error('❌ Error store JenisPiutang:', err);

    return res.status(500).json({
      message: 'Gagal menambahkan jenis piutang.',
    });
  }
};

// ============================================================
// PUT /api/pengaturan/jenis-piutang/:id
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

    const item = await JenisPiutang.findByPk(id);

    if (!item) {
      return res.status(404).json({
        message: 'Jenis piutang tidak ditemukan.',
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
          message: 'Nama jenis piutang tidak boleh kosong.',
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

    const updated = await JenisPiutang.findByPk(item.id, {
      include: [akunInclude],
    });

    return res.json({
      message: 'Jenis piutang berhasil diperbarui.',
      data: updated,
    });
  } catch (err) {
    console.error('❌ Error update JenisPiutang:', err);

    return res.status(500).json({
      message: 'Gagal memperbarui jenis piutang.',
    });
  }
};

// ============================================================
// DELETE /api/pengaturan/jenis-piutang/:id
//
// DELETE = NONAKTIFKAN
// Bukan menghapus data secara fisik.
// ============================================================

exports.destroy = async (req, res) => {
  try {
    const { id } = req.params;

    const item = await JenisPiutang.findByPk(id);

    if (!item) {
      return res.status(404).json({
        message: 'Jenis piutang tidak ditemukan.',
      });
    }

    if (!item.is_active) {
      return res.status(422).json({
        message: 'Jenis piutang sudah tidak aktif.',
      });
    }

    await item.update({
      is_active: false,
    });

    const updated = await JenisPiutang.findByPk(item.id, {
      include: [akunInclude],
    });

    return res.json({
      message: 'Jenis piutang berhasil dinonaktifkan.',
      data: updated,
    });
  } catch (err) {
    console.error('❌ Error destroy JenisPiutang:', err);

    return res.status(500).json({
      message: 'Gagal menonaktifkan jenis piutang.',
    });
  }
};