// controllers/TabunganAwalController.js
//
// ============================================================
// TAHAP 1 — INTEGRITAS MASTER & SALDO ANGGOTA
// ============================================================
// Scope controller ini SENGAJA dibatasi hanya pada:
//   ✓ Anggota valid
//   ✓ Jenis tabungan aktif
//   ✓ Nominal > 0
//   ✓ Tanggal valid
//   ✓ Kombinasi anggota + jenis unik (dicek di level aplikasi)
//   ✓ jenis_tabungan_id & anggota_id tidak boleh diubah setelah
//     dibuat (LOCK)
//   ✓ Soft delete (paranoid)
//   ✓ Import menggunakan KODE jenis tabungan, bukan id
// ============================================================

const { Op } = require('sequelize');
const XLSX = require('xlsx');

const TabunganAwal = require('../models/TabunganAwal');
const Anggota = require('../models/Anggota');
const JenisTabungan = require('../models/JenisTabungan');

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
  model: JenisTabungan,
  as: 'jenis_tabungan',
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

async function validasiJenisAktif(jenisTabunganId) {
  if (!jenisTabunganId) {
    return { error: 'Jenis tabungan wajib diisi.' };
  }

  const jenis = await JenisTabungan.findOne({
    where: {
      id: jenisTabunganId,
      is_active: true,
    },
  });

  if (!jenis) {
    return { error: 'Jenis tabungan tidak ditemukan atau sudah tidak aktif.' };
  }

  return { jenis };
}

async function cekKombinasiUnik(anggotaId, jenisTabunganId, excludeId = null) {
  const where = {
    anggota_id: anggotaId,
    jenis_tabungan_id: jenisTabunganId,
  };

  if (excludeId) {
    where.id = { [Op.ne]: excludeId };
  }

  const existing = await TabunganAwal.findOne({ where });

  return existing || null;
}

// ============================================================
// GET /api/tabungan-awal
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

    const { rows, count } = await TabunganAwal.findAndCountAll({
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

    const jenisTabungan = await JenisTabungan.findAll({
      where: { is_active: true },
      attributes: ['id', 'kode', 'nama', 'urutan'],
      order: [['urutan', 'ASC']],
    });

    const data = rows.map((row) => ({
      id: row.id,
      anggota_id: row.anggota_id,
      no_anggota: row.anggota?.no_anggota,
      nama_anggota: row.anggota?.nama,
      jenis_tabungan_id: row.jenis_tabungan_id,
      tanggal: row.tanggal,
      jumlah: row.jumlah,
    }));

    return res.json({
      data,
      jenisTabungan,
      pagination: {
        page: currentPage,
        per_page: limit,
        total: count,
        total_pages: Math.max(1, Math.ceil(count / limit)),
      },
    });

  } catch (err) {
    console.error('❌ Error index TabunganAwal:', err);

    return res.status(500).json({
      message: 'Gagal mengambil data saldo awal tabungan.',
    });
  }
};

// ============================================================
// GET /api/tabungan-awal/:id
// ============================================================

exports.show = async (req, res) => {
  try {
    const { id } = req.params;

    const item = await TabunganAwal.findByPk(id, {
      include: [anggotaInclude, jenisInclude],
    });

    if (!item) {
      return res.status(404).json({
        message: 'Saldo awal tabungan tidak ditemukan.',
      });
    }

    return res.json({ data: item });

  } catch (err) {
    console.error('❌ Error show TabunganAwal:', err);

    return res.status(500).json({
      message: 'Gagal mengambil data saldo awal tabungan.',
    });
  }
};

// ============================================================
// GET /api/tabungan-awal/anggota/:id
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

    const data = await TabunganAwal.findAll({
      where: { anggota_id: anggotaId },
      include: [jenisInclude],
      order: [['tanggal', 'ASC']],
    });

    return res.json({ data });

  } catch (err) {
    console.error('❌ Error byAnggota TabunganAwal:', err);

    return res.status(500).json({
      message: 'Gagal mengambil detail saldo awal tabungan anggota.',
    });
  }
};

// ============================================================
// POST /api/tabungan-awal
// ============================================================

exports.store = async (req, res) => {
  try {
    const {
      anggota_id,
      jenis_tabungan_id,
      tanggal,
      jumlah,
    } = req.body;

    // 1. Anggota valid
    const anggotaCheck = await validasiAnggota(anggota_id);

    if (anggotaCheck.error) {
      return res.status(422).json({ message: anggotaCheck.error });
    }

    // 2. Jenis tabungan aktif
    const jenisCheck = await validasiJenisAktif(jenis_tabungan_id);

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
    const duplikat = await cekKombinasiUnik(anggota_id, jenis_tabungan_id);

    if (duplikat) {
      return res.status(422).json({
        message: `Saldo awal tabungan untuk anggota "${anggotaCheck.anggota.nama}" pada jenis tabungan "${jenisCheck.jenis.nama}" sudah ada.`,
      });
    }

    // 6. Simpan
    const created = await TabunganAwal.create({
      anggota_id,
      jenis_tabungan_id,
      tanggal,
      jumlah: parsedJumlah,
    });

    const result = await TabunganAwal.findByPk(created.id, {
      include: [anggotaInclude, jenisInclude],
    });

    return res.status(201).json({
      message: 'Saldo awal tabungan berhasil ditambahkan.',
      data: result,
    });

  } catch (err) {
    console.error('❌ Error store TabunganAwal:', err);

    return res.status(500).json({
      message: 'Gagal menambahkan saldo awal tabungan.',
    });
  }
};

// ============================================================
// PUT /api/tabungan-awal/:id
//
// ATURAN FIELD:
//   anggota_id         -> LOCK
//   jenis_tabungan_id  -> LOCK
//   tanggal            -> EDITABLE
//   jumlah             -> EDITABLE
// ============================================================

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { tanggal, jumlah } = req.body;

    const item = await TabunganAwal.findByPk(id);

    if (!item) {
      return res.status(404).json({
        message: 'Saldo awal tabungan tidak ditemukan.',
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

    const updated = await TabunganAwal.findByPk(item.id, {
      include: [anggotaInclude, jenisInclude],
    });

    return res.json({
      message: 'Saldo awal tabungan berhasil diperbarui.',
      data: updated,
    });

  } catch (err) {
    console.error('❌ Error update TabunganAwal:', err);

    return res.status(500).json({
      message: 'Gagal memperbarui saldo awal tabungan.',
    });
  }
};

// ============================================================
// DELETE /api/tabungan-awal/:id
// ============================================================

exports.destroy = async (req, res) => {
  try {
    const { id } = req.params;

    const item = await TabunganAwal.findByPk(id);

    if (!item) {
      return res.status(404).json({
        message: 'Saldo awal tabungan tidak ditemukan.',
      });
    }

    await item.destroy(); // soft delete

    return res.json({
      message: 'Saldo awal tabungan berhasil dihapus.',
    });

  } catch (err) {
    console.error('❌ Error destroy TabunganAwal:', err);

    return res.status(500).json({
      message: 'Gagal menghapus saldo awal tabungan.',
    });
  }
};

// ============================================================
// POST /api/tabungan-awal/import
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

    const semuaJenisAktif = await JenisTabungan.findAll({
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
      const kodeJenis = normalizeKodeJenis(row.jenis_tabungan);
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

      // Jenis tabungan aktif
      const jenis = jenisByKode.get(kodeJenis);
      if (!kodeJenis || !jenis) {
        results.failed++;
        results.errors.push(
          `Baris ${rowNumber}: kode jenis tabungan "${row.jenis_tabungan}" tidak ditemukan atau tidak aktif.`
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
          `Baris ${rowNumber}: saldo awal tabungan untuk "${anggota.nama}" pada jenis "${jenis.nama}" sudah ada.`
        );
        continue;
      }

      // Simpan
      try {
        await TabunganAwal.create({
          anggota_id: anggota.id,
          jenis_tabungan_id: jenis.id,
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
      message: 'Import tabungan awal selesai diproses.',
      results,
    });

  } catch (err) {
    console.error('❌ Error import TabunganAwal:', err);

    return res.status(500).json({
      message: 'Gagal memproses file import tabungan awal.',
    });
  }
};