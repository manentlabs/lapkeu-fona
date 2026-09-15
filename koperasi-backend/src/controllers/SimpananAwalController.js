// controllers/SimpananAwalController.js
//
// ============================================================
// TAHAP 1 — INTEGRITAS MASTER & SALDO ANGGOTA
// ============================================================
// Scope controller ini SENGAJA dibatasi hanya pada:
//   ✓ Anggota valid (dicari via no_anggota)
//   ✓ Jenis simpanan aktif (dicari via kode)
//   ✓ Nominal > 0
//   ✓ Tanggal valid
//   ✓ Kombinasi anggota + jenis unik (dicek di level aplikasi,
//     BUKAN mengandalkan UNIQUE index di MySQL — lihat catatan
//     di bagian cekKombinasiUnik())
//   ✓ jenis_simpanan_id & anggota_id tidak boleh diubah setelah
//     dibuat (LOCK, sama seperti kode/akun_id di JenisSimpanan)
//   ✓ Soft delete (paranoid)
//   ✓ Import menggunakan KODE jenis simpanan & NO_ANGGOTA
//
// KONSISTENSI INPUT:
//   Semua endpoint tulis (store & import) menerima BUSINESS KEY:
//     - no_anggota  (bukan anggota_id)
//     - kode_jenis  (bukan jenis_simpanan_id)
//   Frontend tidak perlu tahu id internal DB.
//
// Belum termasuk di sini (Tahap 2): keterhubungan ke Saldo
// Anggota, Jurnal Pembukaan, Buku Besar, Neraca. Controller ini
// tidak melakukan efek samping ke luar tabel simpanan_awal.
// ============================================================

const { Op } = require('sequelize');
const XLSX = require('xlsx');

const SimpananAwal = require('../models/SimpananAwal');
const Anggota = require('../models/Anggota');
const JenisSimpanan = require('../models/JenisSimpanan');

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
  model: JenisSimpanan,
  as: 'jenis_simpanan',
  attributes: ['id', 'kode', 'nama', 'urutan'],
};

// ============================================================
// VALIDATOR BERSAMA (dipakai store, update, import)
// ============================================================

/**
 * Cari anggota berdasarkan NO_ANGGOTA (business key).
 * Sesuaikan field status jika model Anggota Anda punya kolom
 * status keanggotaan (mis. 'aktif' / 'nonaktif').
 */
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

  // Jika model Anggota memiliki kolom status, aktifkan pengecekan ini:
  // if (anggota.status && anggota.status !== 'aktif') {
  //   return { error: `Anggota "${anggota.nama}" tidak aktif.` };
  // }

  return { anggota };
}

/**
 * Cari jenis simpanan aktif berdasarkan KODE (business key).
 */
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

/**
 * Cek kombinasi anggota + jenis simpanan belum pernah ada.
 *
 * PENTING: kita TIDAK mengandalkan UNIQUE(anggota_id, jenis_simpanan_id,
 * deleted_at) di MySQL, karena MySQL memperlakukan setiap NULL sebagai
 * nilai berbeda pada index unik — artinya banyak baris dengan
 * deleted_at NULL (belum dihapus) tetap bisa lolos sebagai "unik".
 * Jadi validasi keunikan dilakukan di sini, terhadap baris yang masih
 * hidup saja. Sequelize paranoid otomatis menambahkan
 * `WHERE deleted_at IS NULL` pada findOne/findAll, jadi baris yang
 * sudah di-soft-delete tidak akan ikut dicek.
 *
 * Catatan race condition: dua request bersamaan tetap bisa lolos
 * validasi ini sebelum salah satunya sempat INSERT. Untuk keamanan
 * penuh, tetap disarankan menjaga UNIQUE index di database sebagai
 * jaring pengaman terakhir (walau tidak sempurna untuk soft delete),
 * atau membungkus create dalam transaction + row lock jika volume
 * input serentak tinggi.
 */
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

    const { rows, count } = await SimpananAwal.findAndCountAll({
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

    const jenisSimpanan = await JenisSimpanan.findAll({
      where: { is_active: true },
      attributes: ['id', 'kode', 'nama', 'urutan'],
      order: [['urutan', 'ASC']],
    });

    const data = rows.map((row) => ({
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

    return res.json({
      data,
      jenisSimpanan,
      pagination: {
        page: currentPage,
        per_page: limit,
        total: count,
        total_pages: Math.max(1, Math.ceil(count / limit)),
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
// Dipakai modal detail: seluruh saldo awal milik satu anggota.
// :id di sini adalah anggota_id (untuk navigasi/detail, bukan input tulis).
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
// INPUT (body):
//   no_anggota   -> business key anggota
//   kode_jenis   -> business key jenis simpanan (mis. "SP")
//   tanggal      -> tanggal saldo awal
//   jumlah       -> nominal > 0
//
// Frontend TIDAK perlu mengirim anggota_id / jenis_simpanan_id.
// ============================================================

exports.store = async (req, res) => {
  try {
    const {
      no_anggota,
      kode_jenis,
      tanggal,
      jumlah,
    } = req.body;

    // --------------------------------------------------------
    // 1. Anggota valid (by no_anggota)
    // --------------------------------------------------------

    const anggotaCheck = await validasiAnggota(no_anggota);

    if (anggotaCheck.error) {
      return res.status(422).json({ message: anggotaCheck.error });
    }

    const anggota = anggotaCheck.anggota;

    // --------------------------------------------------------
    // 2. Jenis simpanan aktif (by kode)
    // --------------------------------------------------------

    const jenisCheck = await validasiJenisAktif(kode_jenis);

    if (jenisCheck.error) {
      return res.status(422).json({ message: jenisCheck.error });
    }

    const jenis = jenisCheck.jenis;

    // --------------------------------------------------------
    // 3. Nominal > 0
    // --------------------------------------------------------

    const parsedJumlah = parseJumlah(jumlah);

    if (parsedJumlah === null || parsedJumlah <= 0) {
      return res.status(422).json({
        message: 'Jumlah harus berupa angka lebih dari 0.',
      });
    }

    // --------------------------------------------------------
    // 4. Tanggal valid
    // --------------------------------------------------------

    if (!isValidTanggal(tanggal)) {
      return res.status(422).json({
        message: 'Tanggal tidak valid.',
      });
    }

    // --------------------------------------------------------
    // 5. Kombinasi anggota + jenis harus unik
    // --------------------------------------------------------

    const duplikat = await cekKombinasiUnik(anggota.id, jenis.id);

    if (duplikat) {
      return res.status(422).json({
        message: `Saldo awal untuk anggota "${anggota.nama}" pada jenis simpanan "${jenis.nama}" sudah ada.`,
      });
    }

    // --------------------------------------------------------
    // 6. Simpan — di sini baru pakai id hasil lookup
    // --------------------------------------------------------

    const created = await SimpananAwal.create({
      anggota_id: anggota.id,
      jenis_simpanan_id: jenis.id,
      tanggal,
      jumlah: parsedJumlah,
    });

    const result = await SimpananAwal.findByPk(created.id, {
      include: [anggotaInclude, jenisInclude],
    });

    return res.status(201).json({
      message: 'Saldo awal berhasil ditambahkan.',
      data: result,
    });

  } catch (err) {
    console.error('❌ Error store SimpananAwal:', err);

    return res.status(500).json({
      message: 'Gagal menambahkan saldo awal.',
    });
  }
};

// ============================================================
// PUT /api/simpanan-awal/:id
//
// ATURAN FIELD:
//   anggota_id         -> LOCK (tidak bisa diubah)
//   jenis_simpanan_id   -> LOCK (tidak bisa diubah)
//   tanggal             -> EDITABLE
//   jumlah              -> EDITABLE
//
// anggota_id & jenis_simpanan_id sengaja tidak diambil dari
// req.body sama sekali — walau dikirim, nilainya diabaikan.
// Ini konsisten dengan aturan LOCK di JenisSimpananController.
// ============================================================

exports.update = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      tanggal,
      jumlah,
    } = req.body;

    const item = await SimpananAwal.findByPk(id);

    if (!item) {
      return res.status(404).json({
        message: 'Saldo awal tidak ditemukan.',
      });
    }

    const updateData = {};

    // --------------------------------------------------------
    // UPDATE TANGGAL
    // --------------------------------------------------------

    if (tanggal !== undefined) {
      if (!isValidTanggal(tanggal)) {
        return res.status(422).json({
          message: 'Tanggal tidak valid.',
        });
      }

      updateData.tanggal = tanggal;
    }

    // --------------------------------------------------------
    // UPDATE JUMLAH
    // --------------------------------------------------------

    if (jumlah !== undefined) {
      const parsedJumlah = parseJumlah(jumlah);

      if (parsedJumlah === null || parsedJumlah <= 0) {
        return res.status(422).json({
          message: 'Jumlah harus berupa angka lebih dari 0.',
        });
      }

      updateData.jumlah = parsedJumlah;
    }

    // --------------------------------------------------------
    // SIMPAN
    // --------------------------------------------------------

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
// DELETE /api/simpanan-awal/:id
//
// Soft delete murni (Sequelize paranoid). Pastikan model
// SimpananAwal didefinisikan dengan:
//   { paranoid: true, deletedAt: 'deleted_at' }
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

    await item.destroy(); // soft delete, mengisi deleted_at

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
// Format kolom wajib: no_anggota, jenis_simpanan, tanggal, jumlah
// Kolom `jenis_simpanan` diisi KODE jenis simpanan (mis. "SP"),
// bukan nama dan bukan id — supaya import tidak rapuh terhadap
// perubahan nama/kolom_key.
//
// Membutuhkan middleware upload (mis. multer) yang mengisi
// req.file.buffer sebelum handler ini dipanggil.
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

    // ------------------------------------------------------
    // Preload referensi supaya tidak query berulang per baris
    // ------------------------------------------------------

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
      const rowNumber = i + 2; // +2: baris 1 = header, data mulai baris 2
      const row = rows[i];

      const noAnggota = normalizeNoAnggota(row.no_anggota);
      const kodeJenis = normalizeKodeJenis(row.jenis_simpanan);
      const tanggal = row.tanggal;
      const parsedJumlah = parseJumlah(row.jumlah);

      // ---- Anggota valid ----
      const anggota = anggotaByNoAnggota.get(noAnggota);

      if (!noAnggota || !anggota) {
        results.failed++;
        results.errors.push(
          `Baris ${rowNumber}: anggota dengan no_anggota "${row.no_anggota}" tidak ditemukan.`
        );
        continue;
      }

      // ---- Jenis simpanan aktif ----
      const jenis = jenisByKode.get(kodeJenis);

      if (!kodeJenis || !jenis) {
        results.failed++;
        results.errors.push(
          `Baris ${rowNumber}: kode jenis simpanan "${row.jenis_simpanan}" tidak ditemukan atau tidak aktif.`
        );
        continue;
      }

      // ---- Nominal > 0 ----
      if (parsedJumlah === null || parsedJumlah <= 0) {
        results.failed++;
        results.errors.push(
          `Baris ${rowNumber}: jumlah "${row.jumlah}" tidak valid (harus > 0).`
        );
        continue;
      }

      // ---- Tanggal valid ----
      if (!isValidTanggal(tanggal)) {
        results.failed++;
        results.errors.push(
          `Baris ${rowNumber}: tanggal "${row.tanggal}" tidak valid.`
        );
        continue;
      }

      // ---- Kombinasi anggota + jenis harus unik ----
      // eslint-disable-next-line no-await-in-loop
      const duplikat = await cekKombinasiUnik(anggota.id, jenis.id);

      if (duplikat) {
        results.failed++;
        results.errors.push(
          `Baris ${rowNumber}: saldo awal untuk "${anggota.nama}" pada jenis "${jenis.nama}" sudah ada.`
        );
        continue;
      }

      // ---- Simpan ----
      try {
        // eslint-disable-next-line no-await-in-loop
        await SimpananAwal.create({
          anggota_id: anggota.id,
          jenis_simpanan_id: jenis.id,
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