// controllers/PiutangAwalController.js
//
// ============================================================
// TAHAP 1 — INTEGRITAS MASTER & SALDO ANGGOTA
// ============================================================
// Scope controller ini SENGAJA dibatasi hanya pada:
//   ✓ Anggota valid
//   ✓ Jenis piutang aktif
//   ✓ Nominal > 0
//   ✓ Tanggal valid
//   ✓ Kombinasi anggota + jenis unik (dicek di level aplikasi)
//   ✓ jenis_piutang_id & anggota_id tidak boleh diubah setelah
//     dibuat (LOCK)
//   ✓ Soft delete (paranoid)
//   ✓ Import menggunakan KODE jenis piutang, bukan id
// ============================================================

const { Op } = require('sequelize');
const XLSX = require('xlsx');

const PiutangAwal = require('../models/PiutangAwal');
const Anggota = require('../models/Anggota');
const JenisPiutang = require('../models/JenisPiutang');

// ============================================================
// HELPER
// ============================================================

function parseJumlah(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const num = Number(value);

  if (Number.isNaN(num)) {
    return null;
  }

  return num;
}

function isValidTanggal(value) {
  if (!value) return false;

  const d = new Date(value);

  return !Number.isNaN(d.getTime());
}

function normalizeNoAnggota(value) {
  return String(value || '').trim();
}

function normalizeKodeJenis(value) {
  return String(value || '').trim().toUpperCase();
}

// ============================================================
// INCLUDE
// ============================================================

const anggotaInclude = {
  model: Anggota,
  as: 'anggota',
  attributes: ['id', 'no_anggota', 'nama'],
};

const jenisInclude = {
  model: JenisPiutang,
  as: 'jenis_piutang',
  attributes: ['id', 'kode', 'nama', 'urutan'],
};

// ============================================================
// VALIDATOR BERSAMA
// ============================================================

async function validasiAnggota(anggotaId) {
  if (!anggotaId) {
    return { error: 'Anggota wajib diisi.' };
  }

  const anggota = await Anggota.findByPk(anggotaId);

  if (!anggota) {
    return { error: 'Anggota tidak ditemukan.' };
  }

  // Jika model Anggota memiliki kolom status, aktifkan pengecekan:
  // if (anggota.status && anggota.status !== 'aktif') {
  //   return { error: `Anggota "${anggota.nama}" tidak aktif.` };
  // }

  return { anggota };
}

async function validasiJenisAktif(jenisPiutangId) {
  if (!jenisPiutangId) {
    return { error: 'Jenis piutang wajib diisi.' };
  }

  const jenis = await JenisPiutang.findOne({
    where: {
      id: jenisPiutangId,
      is_active: true,
    },
  });

  if (!jenis) {
    return { error: 'Jenis piutang tidak ditemukan atau sudah tidak aktif.' };
  }

  return { jenis };
}

async function cekKombinasiUnik(anggotaId, jenisPiutangId, excludeId = null) {
  const where = {
    anggota_id: anggotaId,
    jenis_piutang_id: jenisPiutangId,
  };

  if (excludeId) {
    where.id = { [Op.ne]: excludeId };
  }

  const existing = await PiutangAwal.findOne({ where });

  return existing || null;
}

// ============================================================
// GET /api/piutang-awal
// ============================================================

exports.index = async (req, res) => {
  try {
    const {
      page = 1,
      per_page = 10,
      nama_anggota,
      no_anggota,
    } = req.query;

    const limit = Math.max(1, parseInt(per_page, 10) || 10);
    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const offset = (currentPage - 1) * limit;

    const anggotaWhere = {};

    if (nama_anggota) {
      anggotaWhere.nama = { [Op.like]: `%${nama_anggota}%` };
    }

    if (no_anggota) {
      anggotaWhere.no_anggota = { [Op.like]: `%${no_anggota}%` };
    }

    const hasAnggotaFilter = Object.keys(anggotaWhere).length > 0;

    const { rows, count } = await PiutangAwal.findAndCountAll({
      include: [
        {
          ...anggotaInclude,
          where: hasAnggotaFilter ? anggotaWhere : undefined,
          required: hasAnggotaFilter,
        },
        jenisInclude,
      ],
      order: [
        ['tanggal', 'ASC'],
        ['id', 'ASC'],
      ],
      limit,
      offset,
      distinct: true,
    });

    const jenisPiutang = await JenisPiutang.findAll({
      where: { is_active: true },
      attributes: ['id', 'kode', 'nama', 'urutan'],
      order: [['urutan', 'ASC']],
    });

    const data = rows.map((row) => ({
      id: row.id,
      anggota_id: row.anggota_id,
      no_anggota: row.anggota?.no_anggota,
      nama_anggota: row.anggota?.nama,
      jenis_piutang_id: row.jenis_piutang_id,
      tanggal: row.tanggal,
      jumlah: row.jumlah,
    }));

    return res.json({
      data,
      jenisPiutang,
      pagination: {
        page: currentPage,
        per_page: limit,
        total: count,
        total_pages: Math.max(1, Math.ceil(count / limit)),
      },
    });

  } catch (err) {
    console.error('❌ Error index PiutangAwal:', err);

    return res.status(500).json({
      message: 'Gagal mengambil data saldo awal piutang.',
    });
  }
};

// ============================================================
// GET /api/piutang-awal/:id
// ============================================================

exports.show = async (req, res) => {
  try {
    const { id } = req.params;

    const item = await PiutangAwal.findByPk(id, {
      include: [anggotaInclude, jenisInclude],
    });

    if (!item) {
      return res.status(404).json({
        message: 'Saldo awal piutang tidak ditemukan.',
      });
    }

    return res.json({ data: item });

  } catch (err) {
    console.error('❌ Error show PiutangAwal:', err);

    return res.status(500).json({
      message: 'Gagal mengambil data saldo awal piutang.',
    });
  }
};

// ============================================================
// GET /api/piutang-awal/anggota/:id
// ============================================================

exports.byAnggota = async (req, res) => {
  try {
    const { id: anggotaId } = req.params;

    const anggota = await Anggota.findByPk(anggotaId, {
      attributes: ['id', 'no_anggota', 'nama'],
    });

    if (!anggota) {
      return res.status(404).json({
        message: 'Anggota tidak ditemukan.',
      });
    }

    const data = await PiutangAwal.findAll({
      where: { anggota_id: anggotaId },
      include: [jenisInclude],
      order: [['tanggal', 'ASC']],
    });

    return res.json({ data });

  } catch (err) {
    console.error('❌ Error byAnggota PiutangAwal:', err);

    return res.status(500).json({
      message: 'Gagal mengambil detail saldo awal piutang anggota.',
    });
  }
};

// ============================================================
// POST /api/piutang-awal
// ============================================================

exports.store = async (req, res) => {
  try {
    const {
      anggota_id,
      jenis_piutang_id,
      tanggal,
      jumlah,
    } = req.body;

    // 1. Anggota valid
    const anggotaCheck = await validasiAnggota(anggota_id);

    if (anggotaCheck.error) {
      return res.status(422).json({ message: anggotaCheck.error });
    }

    // 2. Jenis piutang aktif
    const jenisCheck = await validasiJenisAktif(jenis_piutang_id);

    if (jenisCheck.error) {
      return res.status(422).json({ message: jenisCheck.error });
    }

    // 3. Nominal > 0
    const parsedJumlah = parseJumlah(jumlah);

    if (parsedJumlah === null || parsedJumlah <= 0) {
      return res.status(422).json({
        message: 'Jumlah harus berupa angka lebih dari 0.',
      });
    }

    // 4. Tanggal valid
    if (!isValidTanggal(tanggal)) {
      return res.status(422).json({
        message: 'Tanggal tidak valid.',
      });
    }

    // 5. Kombinasi anggota + jenis unik
    const duplikat = await cekKombinasiUnik(anggota_id, jenis_piutang_id);

    if (duplikat) {
      return res.status(422).json({
        message: `Saldo awal piutang untuk anggota "${anggotaCheck.anggota.nama}" pada jenis piutang "${jenisCheck.jenis.nama}" sudah ada.`,
      });
    }

    // 6. Simpan
    const created = await PiutangAwal.create({
      anggota_id,
      jenis_piutang_id,
      tanggal,
      jumlah: parsedJumlah,
    });

    const result = await PiutangAwal.findByPk(created.id, {
      include: [anggotaInclude, jenisInclude],
    });

    return res.status(201).json({
      message: 'Saldo awal piutang berhasil ditambahkan.',
      data: result,
    });

  } catch (err) {
    console.error('❌ Error store PiutangAwal:', err);

    return res.status(500).json({
      message: 'Gagal menambahkan saldo awal piutang.',
    });
  }
};

// ============================================================
// PUT /api/piutang-awal/:id
//
// ATURAN FIELD:
//   anggota_id         -> LOCK
//   jenis_piutang_id   -> LOCK
//   tanggal            -> EDITABLE
//   jumlah             -> EDITABLE
// ============================================================

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { tanggal, jumlah } = req.body;

    const item = await PiutangAwal.findByPk(id);

    if (!item) {
      return res.status(404).json({
        message: 'Saldo awal piutang tidak ditemukan.',
      });
    }

    const updateData = {};

    // UPDATE TANGGAL
    if (tanggal !== undefined) {
      if (!isValidTanggal(tanggal)) {
        return res.status(422).json({
          message: 'Tanggal tidak valid.',
        });
      }

      updateData.tanggal = tanggal;
    }

    // UPDATE JUMLAH
    if (jumlah !== undefined) {
      const parsedJumlah = parseJumlah(jumlah);

      if (parsedJumlah === null || parsedJumlah <= 0) {
        return res.status(422).json({
          message: 'Jumlah harus berupa angka lebih dari 0.',
        });
      }

      updateData.jumlah = parsedJumlah;
    }

    await item.update(updateData);

    const updated = await PiutangAwal.findByPk(item.id, {
      include: [anggotaInclude, jenisInclude],
    });

    return res.json({
      message: 'Saldo awal piutang berhasil diperbarui.',
      data: updated,
    });

  } catch (err) {
    console.error('❌ Error update PiutangAwal:', err);

    return res.status(500).json({
      message: 'Gagal memperbarui saldo awal piutang.',
    });
  }
};

// ============================================================
// DELETE /api/piutang-awal/:id
// ============================================================

exports.destroy = async (req, res) => {
  try {
    const { id } = req.params;

    const item = await PiutangAwal.findByPk(id);

    if (!item) {
      return res.status(404).json({
        message: 'Saldo awal piutang tidak ditemukan.',
      });
    }

    await item.destroy(); // soft delete

    return res.json({
      message: 'Saldo awal piutang berhasil dihapus.',
    });

  } catch (err) {
    console.error('❌ Error destroy PiutangAwal:', err);

    return res.status(500).json({
      message: 'Gagal menghapus saldo awal piutang.',
    });
  }
};

// ============================================================
// POST /api/piutang-awal/import
// ============================================================

exports.import = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(422).json({
        message: 'File tidak ditemukan. Silakan pilih file Excel/CSV.',
      });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rows.length === 0) {
      return res.status(422).json({
        message: 'File kosong atau format tidak dikenali.',
      });
    }

    // Preload referensi
    const semuaAnggota = await Anggota.findAll({
      attributes: ['id', 'no_anggota', 'nama'],
    });
    const anggotaByNoAnggota = new Map(
      semuaAnggota.map((a) => [normalizeNoAnggota(a.no_anggota), a])
    );

    const semuaJenisAktif = await JenisPiutang.findAll({
      where: { is_active: true },
      attributes: ['id', 'kode', 'nama'],
    });
    const jenisByKode = new Map(
      semuaJenisAktif.map((j) => [normalizeKodeJenis(j.kode), j])
    );

    const results = {
      success: 0,
      failed: 0,
      errors: [],
    };

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2;
      const row = rows[i];

      const noAnggota = normalizeNoAnggota(row.no_anggota);
      const kodeJenis = normalizeKodeJenis(row.jenis_piutang);
      const tanggal = row.tanggal;
      const parsedJumlah = parseJumlah(row.jumlah);

      // Anggota
      const anggota = anggotaByNoAnggota.get(noAnggota);
      if (!noAnggota || !anggota) {
        results.failed++;
        results.errors.push(
          `Baris ${rowNumber}: anggota dengan no_anggota "${row.no_anggota}" tidak ditemukan.`
        );
        continue;
      }

      // Jenis piutang aktif
      const jenis = jenisByKode.get(kodeJenis);
      if (!kodeJenis || !jenis) {
        results.failed++;
        results.errors.push(
          `Baris ${rowNumber}: kode jenis piutang "${row.jenis_piutang}" tidak ditemukan atau tidak aktif.`
        );
        continue;
      }

      // Nominal
      if (parsedJumlah === null || parsedJumlah <= 0) {
        results.failed++;
        results.errors.push(
          `Baris ${rowNumber}: jumlah "${row.jumlah}" tidak valid (harus > 0).`
        );
        continue;
      }

      // Tanggal
      if (!isValidTanggal(tanggal)) {
        results.failed++;
        results.errors.push(
          `Baris ${rowNumber}: tanggal "${row.tanggal}" tidak valid.`
        );
        continue;
      }

      // Cek duplikat
      const duplikat = await cekKombinasiUnik(anggota.id, jenis.id);
      if (duplikat) {
        results.failed++;
        results.errors.push(
          `Baris ${rowNumber}: saldo awal piutang untuk "${anggota.nama}" pada jenis "${jenis.nama}" sudah ada.`
        );
        continue;
      }

      // Simpan
      try {
        await PiutangAwal.create({
          anggota_id: anggota.id,
          jenis_piutang_id: jenis.id,
          tanggal,
          jumlah: parsedJumlah,
        });
        results.success++;
      } catch (rowErr) {
        console.error(`❌ Error import baris ${rowNumber}:`, rowErr);
        results.failed++;
        results.errors.push(`Baris ${rowNumber}: gagal disimpan (${rowErr.message}).`);
      }
    }

    return res.json({
      message: 'Import piutang awal selesai diproses.',
      results,
    });

  } catch (err) {
    console.error('❌ Error import PiutangAwal:', err);

    return res.status(500).json({
      message: 'Gagal memproses file import piutang awal.',
    });
  }
};