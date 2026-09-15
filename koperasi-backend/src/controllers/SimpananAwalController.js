// controllers/SimpananAwalController.js
const { Op } = require('sequelize');
const XLSX = require('xlsx');

const sequelize = require('../config/database'); // ← sesuaikan path
const SimpananAwal = require('../models/SimpananAwal');
const Anggota = require('../models/Anggota');
const JenisSimpanan = require('../models/JenisSimpanan');

// ============================================================
// HELPER
// ============================================================

function parseJumlah(value) {
  if (value === undefined || value === null) return null;

  const raw = String(value).trim();
  if (raw === '') return null;

  const num = Number(raw);
  if (Number.isNaN(num)) return null;

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
  model: JenisSimpanan,
  as: 'jenis_simpanan',
  attributes: ['id', 'kode', 'nama', 'urutan'],
};

// ============================================================
// VALIDATOR BERSAMA
// ============================================================

async function validasiAnggota(noAnggota) {
  const normalized = normalizeNoAnggota(noAnggota);

  if (!normalized) {
    return { error: 'No. anggota wajib diisi.' };
  }

  const anggota = await Anggota.findOne({
    where: { no_anggota: normalized },
  });

  if (!anggota) {
    return {
      error: `Anggota dengan no_anggota "${normalized}" tidak ditemukan.`,
    };
  }

  return { anggota };
}

async function validasiJenisAktif(kodeJenis) {
  const normalized = normalizeKodeJenis(kodeJenis);

  if (!normalized) {
    return { error: 'Kode jenis simpanan wajib diisi.' };
  }

  const jenis = await JenisSimpanan.findOne({
    where: {
      kode: normalized,
      is_active: true,
    },
  });

  if (!jenis) {
    return {
      error: `Jenis simpanan dengan kode "${normalized}" tidak ditemukan atau sudah tidak aktif.`,
    };
  }

  return { jenis };
}

async function cekKombinasiUnik(anggotaId, jenisSimpananId, excludeId = null) {
  const where = {
    anggota_id: anggotaId,
    jenis_simpanan_id: jenisSimpananId,
  };

  if (excludeId) {
    where.id = { [Op.ne]: excludeId };
  }

  const existing = await SimpananAwal.findOne({ where });
  return existing || null;
}

// ============================================================
// GET /api/simpanan-awal
//
// Paginate di level ANGGOTA. Response.data berisi SEMUA baris
// transaksi untuk anggota di halaman aktif. Frontend yang
// membangun pivot per anggota dari data ini.
//
// Query params:
//   page, per_page, nama_anggota, no_anggota
// ============================================================

exports.index = async (req, res) => {
  try {
    const {
      page = 1,
      per_page = 5,
      nama_anggota,
      no_anggota,
    } = req.query;

    const limit = Math.max(1, parseInt(per_page, 10) || 5);
    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const offset = (currentPage - 1) * limit;

    // --------------------------------------------------------
    // 1. Filter anggota
    // --------------------------------------------------------
    const anggotaWhere = {};

    if (nama_anggota) {
      anggotaWhere.nama = { [Op.like]: `%${nama_anggota}%` };
    }
    if (no_anggota) {
      anggotaWhere.no_anggota = { [Op.like]: `%${no_anggota}%` };
    }

    const hasAnggotaFilter = Object.keys(anggotaWhere).length > 0;

    // --------------------------------------------------------
    // 2. Paginate ANGGOTA yang punya minimal 1 saldo awal.
    //
    //    INNER JOIN ke SimpananAwal dengan required:true.
    //    subQuery:false penting agar LIMIT diterapkan ke
    //    query utama (Anggota), bukan ke subquery.
    // --------------------------------------------------------
    const {
      rows: anggotaRows,
      count: totalAnggota,
    } = await Anggota.findAndCountAll({
      where: anggotaWhere,
      attributes: ['id', 'no_anggota', 'nama'],
      include: [
        {
          model: SimpananAwal,
          as: 'simpanan_awal', // ← sesuaikan alias di asosiasi Anda
          attributes: [],
          required: true,
        },
      ],
      order: [['no_anggota', 'ASC']],
      limit,
      offset,
      distinct: true,
      subQuery: false,
    });

    const anggotaIds = anggotaRows.map((a) => a.id);

    // --------------------------------------------------------
    // 3. Ambil SELURUH transaksi untuk anggota di halaman ini
    // --------------------------------------------------------
    let data = [];

    if (anggotaIds.length > 0) {
      const transaksi = await SimpananAwal.findAll({
        where: { anggota_id: { [Op.in]: anggotaIds } },
        include: [anggotaInclude, jenisInclude],
        order: [
          ['anggota_id', 'ASC'],
          ['tanggal', 'ASC'],
          ['id', 'ASC'],
        ],
      });

      data = transaksi.map((row) => ({
        id: row.id,
        anggota_id: row.anggota_id,
        no_anggota: row.anggota?.no_anggota,
        nama_anggota: row.anggota?.nama,
        jenis_simpanan_id: row.jenis_simpanan_id,
        kode_jenis: row.jenis_simpanan?.kode,
        nama_jenis: row.jenis_simpanan?.nama,
        tanggal: row.tanggal,
        jumlah: row.jumlah,
      }));
    }

    // --------------------------------------------------------
    // 4. Daftar jenis simpanan aktif (untuk header kolom pivot)
    // --------------------------------------------------------
    const jenisSimpanan = await JenisSimpanan.findAll({
      where: { is_active: true },
      attributes: ['id', 'kode', 'nama', 'urutan'],
      order: [['urutan', 'ASC']],
    });

    return res.json({
      data,
      jenisSimpanan,
      pagination: {
        page: currentPage,
        per_page: limit,
        total: totalAnggota, // ← JUMLAH ANGGOTA, bukan transaksi
        total_pages: Math.max(1, Math.ceil(totalAnggota / limit)),
      },
    });
  } catch (err) {
    console.error('❌ Error index SimpananAwal:', err);
    return res.status(500).json({
      message: 'Gagal mengambil data saldo awal.',
    });
  }
};

// ============================================================
// GET /api/simpanan-awal/summary
//
// Ringkasan LINTAS HALAMAN (dihitung dari SELURUH data yang match
// filter, bukan hanya halaman aktif). Dipakai untuk kartu ringkasan
// di frontend: total anggota, total saldo, per jenis.
// ============================================================

exports.summary = async (req, res) => {
  try {
    const { nama_anggota, no_anggota } = req.query;

    const anggotaWhere = {};
    if (nama_anggota) anggotaWhere.nama = { [Op.like]: `%${nama_anggota}%` };
    if (no_anggota) anggotaWhere.no_anggota = { [Op.like]: `%${no_anggota}%` };

    const hasAnggotaFilter = Object.keys(anggotaWhere).length > 0;

    const rows = await SimpananAwal.findAll({
      attributes: ['anggota_id', 'jenis_simpanan_id', 'jumlah'],
      include: [
        {
          ...anggotaInclude,
          where: hasAnggotaFilter ? anggotaWhere : undefined,
          required: hasAnggotaFilter,
        },
      ],
    });

    const perJenis = {};
    const anggotaSet = new Set();
    let totalSemua = 0;

    rows.forEach((r) => {
      const val = parseFloat(r.jumlah) || 0;
      perJenis[r.jenis_simpanan_id] = (perJenis[r.jenis_simpanan_id] || 0) + val;
      totalSemua += val;
      anggotaSet.add(r.anggota_id);
    });

    return res.json({
      perJenis,
      totalSemua,
      jumlahAnggota: anggotaSet.size,
    });
  } catch (err) {
    console.error('❌ Error summary SimpananAwal:', err);
    return res.status(500).json({
      message: 'Gagal mengambil ringkasan saldo awal.',
    });
  }
};

// ============================================================
// GET /api/simpanan-awal/:id
// ============================================================

exports.show = async (req, res) => {
  try {
    const { id } = req.params;

    const item = await SimpananAwal.findByPk(id, {
      include: [anggotaInclude, jenisInclude],
    });

    if (!item) {
      return res.status(404).json({
        message: 'Saldo awal tidak ditemukan.',
      });
    }

    return res.json({ data: item });
  } catch (err) {
    console.error('❌ Error show SimpananAwal:', err);
    return res.status(500).json({
      message: 'Gagal mengambil data saldo awal.',
    });
  }
};

// ============================================================
// GET /api/simpanan-awal/anggota/:id
//
// :id = anggota_id. Untuk modal detail di frontend.
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

    const data = await SimpananAwal.findAll({
      where: { anggota_id: anggotaId },
      include: [jenisInclude],
      order: [['tanggal', 'ASC']],
    });

    return res.json({ data });
  } catch (err) {
    console.error('❌ Error byAnggota SimpananAwal:', err);
    return res.status(500).json({
      message: 'Gagal mengambil detail saldo awal anggota.',
    });
  }
};

// ============================================================
// POST /api/simpanan-awal
//
// Body: no_anggota, kode_jenis, tanggal, jumlah
// ============================================================

exports.store = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { no_anggota, kode_jenis, tanggal, jumlah } = req.body;

    // 1. Anggota valid
    const anggotaCheck = await validasiAnggota(no_anggota);
    if (anggotaCheck.error) {
      await t.rollback();
      return res.status(422).json({ message: anggotaCheck.error });
    }
    const anggota = anggotaCheck.anggota;

    // 2. Jenis simpanan aktif
    const jenisCheck = await validasiJenisAktif(kode_jenis);
    if (jenisCheck.error) {
      await t.rollback();
      return res.status(422).json({ message: jenisCheck.error });
    }
    const jenis = jenisCheck.jenis;

    // 3. Nominal > 0
    const parsedJumlah = parseJumlah(jumlah);
    if (parsedJumlah === null || parsedJumlah <= 0) {
      await t.rollback();
      return res.status(422).json({
        message: 'Jumlah harus berupa angka lebih dari 0.',
      });
    }

    // 4. Tanggal valid
    if (!isValidTanggal(tanggal)) {
      await t.rollback();
      return res.status(422).json({ message: 'Tanggal tidak valid.' });
    }

    // 5. Kombinasi unik — dengan row lock agar aman dari race condition
    const duplikat = await SimpananAwal.findOne({
      where: {
        anggota_id: anggota.id,
        jenis_simpanan_id: jenis.id,
      },
      lock: t.LOCK.UPDATE,
      transaction: t,
    });

    if (duplikat) {
      await t.rollback();
      return res.status(422).json({
        message: `Saldo awal untuk anggota "${anggota.nama}" pada jenis simpanan "${jenis.nama}" sudah ada.`,
      });
    }

    // 6. Simpan
    const created = await SimpananAwal.create(
      {
        anggota_id: anggota.id,
        jenis_simpanan_id: jenis.id,
        tanggal,
        jumlah: parsedJumlah,
      },
      { transaction: t }
    );

    await t.commit();

    const result = await SimpananAwal.findByPk(created.id, {
      include: [anggotaInclude, jenisInclude],
    });

    return res.status(201).json({
      message: 'Saldo awal berhasil ditambahkan.',
      data: result,
    });
  } catch (err) {
    await t.rollback();
    console.error('❌ Error store SimpananAwal:', err);
    return res.status(500).json({
      message: 'Gagal menambahkan saldo awal.',
    });
  }
};

// ============================================================
// PUT /api/simpanan-awal/:id
//
// anggota_id & jenis_simpanan_id LOCK — tidak diambil dari body.
// ============================================================

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { tanggal, jumlah } = req.body;

    const item = await SimpananAwal.findByPk(id);

    if (!item) {
      return res.status(404).json({
        message: 'Saldo awal tidak ditemukan.',
      });
    }

    const updateData = {};

    if (tanggal !== undefined) {
      if (!isValidTanggal(tanggal)) {
        return res.status(422).json({ message: 'Tanggal tidak valid.' });
      }
      updateData.tanggal = tanggal;
    }

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

    const updated = await SimpananAwal.findByPk(item.id, {
      include: [anggotaInclude, jenisInclude],
    });

    return res.json({
      message: 'Saldo awal berhasil diperbarui.',
      data: updated,
    });
  } catch (err) {
    console.error('❌ Error update SimpananAwal:', err);
    return res.status(500).json({
      message: 'Gagal memperbarui saldo awal.',
    });
  }
};

// ============================================================
// DELETE /api/simpanan-awal/:id (soft delete)
// ============================================================

exports.destroy = async (req, res) => {
  try {
    const { id } = req.params;

    const item = await SimpananAwal.findByPk(id);

    if (!item) {
      return res.status(404).json({
        message: 'Saldo awal tidak ditemukan.',
      });
    }

    await item.destroy();

    return res.json({
      message: 'Saldo awal berhasil dihapus.',
    });
  } catch (err) {
    console.error('❌ Error destroy SimpananAwal:', err);
    return res.status(500).json({
      message: 'Gagal menghapus saldo awal.',
    });
  }
};

// ============================================================
// POST /api/simpanan-awal/import
//
// Kolom: no_anggota, jenis_simpanan (KODE), tanggal, jumlah
// Dijalankan dalam transaction per-baris supaya baris valid tetap
// masuk walau ada baris gagal (partial success by design).
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

    const semuaJenisAktif = await JenisSimpanan.findAll({
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
      const kodeJenis = normalizeKodeJenis(row.jenis_simpanan);
      const tanggal = row.tanggal;
      const parsedJumlah = parseJumlah(row.jumlah);

      // Validasi
      const anggota = anggotaByNoAnggota.get(noAnggota);
      if (!noAnggota || !anggota) {
        results.failed++;
        results.errors.push(
          `Baris ${rowNumber}: anggota dengan no_anggota "${row.no_anggota}" tidak ditemukan.`
        );
        continue;
      }

      const jenis = jenisByKode.get(kodeJenis);
      if (!kodeJenis || !jenis) {
        results.failed++;
        results.errors.push(
          `Baris ${rowNumber}: kode jenis simpanan "${row.jenis_simpanan}" tidak ditemukan atau tidak aktif.`
        );
        continue;
      }

      if (parsedJumlah === null || parsedJumlah <= 0) {
        results.failed++;
        results.errors.push(
          `Baris ${rowNumber}: jumlah "${row.jumlah}" tidak valid (harus > 0).`
        );
        continue;
      }

      if (!isValidTanggal(tanggal)) {
        results.failed++;
        results.errors.push(
          `Baris ${rowNumber}: tanggal "${row.tanggal}" tidak valid.`
        );
        continue;
      }

      // Cek duplikat
      // eslint-disable-next-line no-await-in-loop
      const duplikat = await cekKombinasiUnik(anggota.id, jenis.id);
      if (duplikat) {
        results.failed++;
        results.errors.push(
          `Baris ${rowNumber}: saldo awal untuk "${anggota.nama}" pada jenis "${jenis.nama}" sudah ada.`
        );
        continue;
      }

      // Simpan per baris dengan transaction
      const t = await sequelize.transaction();
      try {
        // eslint-disable-next-line no-await-in-loop
        await SimpananAwal.create(
          {
            anggota_id: anggota.id,
            jenis_simpanan_id: jenis.id,
            tanggal,
            jumlah: parsedJumlah,
          },
          { transaction: t }
        );

        // eslint-disable-next-line no-await-in-loop
        await t.commit();
        results.success++;
      } catch (rowErr) {
        // eslint-disable-next-line no-await-in-loop
        await t.rollback();
        console.error(`❌ Error import baris ${rowNumber}:`, rowErr);
        results.failed++;
        results.errors.push(
          `Baris ${rowNumber}: gagal disimpan (${rowErr.message}).`
        );
      }
    }

    return res.json({
      message: 'Import selesai diproses.',
      results,
    });
  } catch (err) {
    console.error('❌ Error import SimpananAwal:', err);
    return res.status(500).json({
      message: 'Gagal memproses file import.',
    });
  }
};