const { hitungAngsuranUangMenengah } = require("../utils/angsuranPinjaman");
const PotonganGaji = require("../models/PotonganGaji");
const Anggota = require("../models/Anggota");
const Transaksi = require("../models/Transaksi");
const Jurnal = require("../models/Jurnal");
const Akun = require("../models/Akun");
const KodeReferensi = require("../models/KodeReferensi");
const Pinjaman = require("../models/Pinjaman");
const PengaturanWebsite = require("../models/PengaturanWebsite");
const sequelize = require("../config/database");
const { QueryTypes, Op } = require("sequelize");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

// ─── Daftar bulan (harus sinkron dengan BULAN_LIST di frontend,
// src/pages/bendahara/PotonganGajiPage.jsx) ───────────────────
const BULAN_LIST = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

// Harus sinkron dengan DEFAULT_SIMPANAN_WAJIB di frontend
// (src/pages/bendahara/PotonganGajiPage.jsx).
const DEFAULT_SIMPANAN_WAJIB = 180000;

// ─── Helper format Rupiah ────────────────────────────────────
function formatRupiah(value) {
  const num = parseFloat(value) || 0;
  return num.toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatTanggalIndonesia(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "-";
  const bulan = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];
  return `${date.getDate()} ${bulan[date.getMonth()]} ${date.getFullYear()}`;
}

// ─── Helper: bulan & tahun sebelumnya dari BULAN_LIST ───────
// Dipakai untuk mengambil nilai simpanan sukarela bulan lalu sebagai
// default di modal Input per Instansi.
function getBulanSebelumnya(bulan, tahun) {
  const idx = BULAN_LIST.indexOf(bulan);
  const tahunNum = parseInt(tahun, 10);
  if (idx === -1 || Number.isNaN(tahunNum)) {
    return { bulan: null, tahun: null };
  }
  if (idx === 0) {
    return { bulan: BULAN_LIST[11], tahun: tahunNum - 1 };
  }
  return { bulan: BULAN_LIST[idx - 1], tahun: tahunNum };
}

// ─── Helper: kondisi `where` untuk filter tabel Anggota ─────
// Dipakai bersama oleh index, summary, exportExcel & exportPdf supaya
// filter "instansi" (exact match) dan "anggota" (pencarian sebagian pada
// nama ATAU no. anggota, dari AnggotaFilterAutocomplete di frontend) selalu
// konsisten dan tidak saling menimpa saat keduanya dipakai bersamaan.
// Return `null` kalau tidak ada filter sama sekali, supaya pemanggil bisa
// tahu apakah perlu meng-JOIN/where ke Anggota atau tidak.
function buildAnggotaFilterWhere(instansi, anggota) {
  const cond = {};
  if (instansi) cond.instansi = instansi;
  if (anggota) {
    cond[Op.or] = [
      { nama: { [Op.like]: `%${anggota}%` } },
      { no_anggota: { [Op.like]: `%${anggota}%` } },
    ];
  }
  return Object.keys(cond).length > 0 ? cond : null;
}

// ─── Helper: generate no transaksi ──────────────────────────
async function generateNoTransaksi(t) {
  const now = new Date();
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, "");
  for (let attempt = 0; attempt < 5; attempt++) {
    const random = Math.floor(Math.random() * 1000000).toString().padStart(6, "0");
    const candidate = `POT-${ymd}-${random}`;
    const exists = await Transaksi.findOne({
      where: { no_transaksi: candidate },
      transaction: t,
    });
    if (!exists) return candidate;
  }
  return `POT-${ymd}-${Date.now()}`;
}

// ─── Index (dengan filter instansi & anggota) ───────────────
exports.index = async (req, res) => {
  try {
    const { bulan, tahun, instansi, anggota, is_processed, page = 1, per_page = 10 } = req.query;

    const where = {};
    if (bulan) where.bulan = bulan;
    if (tahun) where.tahun = tahun;
    // 🆕 Filter status proses. Dipakai oleh tab "Pengajuan Potongan" di
    // halaman Transaksi (frontend) untuk hanya menampilkan baris yang
    // belum diproses ke jurnal (is_processed=false), tanpa mengubah
    // perilaku default endpoint ini (kalau param tidak dikirim, semua
    // status tetap ikut tampil seperti sebelumnya).
    if (is_processed !== undefined) {
      where.is_processed = is_processed === "true" || is_processed === "1" || is_processed === true;
    }

    const include = [{
      model: Anggota,
      as: "anggota",
      attributes: ["id", "no_anggota", "nama", "instansi"],
    }];

    // 🆕 Filter anggota: pencarian sebagian nama / no. anggota, dikirim dari
    // AnggotaFilterAutocomplete di panel Filter frontend. Digabung dengan
    // "instansi" (kalau ada) lewat buildAnggotaFilterWhere supaya keduanya
    // bisa dipakai bersamaan.
    const anggotaWhere = buildAnggotaFilterWhere(instansi, anggota);
    if (anggotaWhere) {
      include[0].where = anggotaWhere;
    }

    const { rows, count } = await PotonganGaji.findAndCountAll({
      where,
      include,
      order: [["tahun", "DESC"], ["bulan", "DESC"], ["no_urut", "ASC"]],
      limit: parseInt(per_page),
      offset: (parseInt(page) - 1) * parseInt(per_page),
    });

    // Ringkasan per bulan (dengan filter instansi & anggota)
    const summaryWhere = {};
    if (bulan) summaryWhere.bulan = bulan;
    if (tahun) summaryWhere.tahun = tahun;
    if (is_processed !== undefined) {
      summaryWhere.is_processed = where.is_processed;
    }

    // Untuk summary, perlu join dengan anggota untuk filter instansi/anggota.
    // CATATAN: sengaja TIDAK membatasi status:"aktif" di sini, supaya
    // konsisten dengan query `rows` di atas yang juga tidak membatasi
    // status anggota -- kalau tidak, total di kartu ringkasan bulanan
    // bisa berbeda dari total yang sebenarnya tampil di tabel ketika ada
    // potongan milik anggota yang sudah nonaktif.
    let summary = [];
    if (anggotaWhere) {
      const anggotaIds = await Anggota.findAll({
        where: anggotaWhere,
        attributes: ["id"],
        raw: true,
      });
      const ids = anggotaIds.map(a => a.id);
      if (ids.length > 0) {
        summary = await PotonganGaji.findAll({
          attributes: ["bulan", "tahun", [sequelize.fn("SUM", sequelize.col("total")), "total"]],
          where: { ...summaryWhere, anggota_id: ids },
          group: ["bulan", "tahun"],
          order: [["tahun", "DESC"], ["bulan", "DESC"]],
          raw: true,
        });
      }
    } else {
      summary = await PotonganGaji.findAll({
        attributes: ["bulan", "tahun", [sequelize.fn("SUM", sequelize.col("total")), "total"]],
        where: summaryWhere,
        group: ["bulan", "tahun"],
        order: [["tahun", "DESC"], ["bulan", "DESC"]],
        raw: true,
      });
    }

    return res.json({
      data: rows,
      pagination: {
        page: parseInt(page),
        per_page: parseInt(per_page),
        total: count,
        total_pages: Math.ceil(count / per_page),
      },
      summary,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Gagal mengambil data potongan." });
  }
};

// ─── Store (import manual) ──────────────────────────────────
exports.store = async (req, res) => {
  try {
    const { bulan, tahun, data } = req.body;
    if (!bulan || !tahun || !data || !Array.isArray(data) || data.length === 0) {
      return res.status(422).json({ message: "Data tidak lengkap." });
    }

    const existing = await PotonganGaji.count({
      where: { bulan, tahun, sumber: "manual" },
    });
    if (existing > 0) {
      return res.status(422).json({
        message: `Data import manual untuk ${bulan} ${tahun} sudah ada. Hapus data lama dulu jika ingin import ulang.`,
      });
    }

    const potonganData = [];
    for (const row of data) {
      let anggota = null;
      if (row.no_anggota) {
        anggota = await Anggota.findOne({ where: { no_anggota: row.no_anggota } });
      }
      if (!anggota && row.nama) {
        anggota = await Anggota.findOne({ where: { nama: { [Op.like]: `%${row.nama}%` } } });
      }
      if (!anggota) continue;

      const total = (parseFloat(row.simpanan_wajib) || 0) +
        (parseFloat(row.simpanan_sukarela) || 0) +
        (parseFloat(row.utang_barang_pokok) || 0) +
        (parseFloat(row.utang_barang_jasa) || 0) +
        (parseFloat(row.utang_uang_menengah_pokok) || 0) +
        (parseFloat(row.utang_uang_menengah_jasa) || 0) +
        (parseFloat(row.utang_uang_pendek_pokok) || 0) +
        (parseFloat(row.utang_uang_pendek_jasa) || 0) +
        (parseFloat(row.simpanan_pokok) || 0);

      potonganData.push({
        anggota_id: anggota.id,
        bulan,
        tahun,
        no_urut: row.no_urut || null,
        sumber: "manual",
        plafon: row.plafon || null,
        jangka_waktu: row.jangka_waktu || null,
        angsuran_ke: row.angsuran_ke || null,
        simpanan_wajib: row.simpanan_wajib || 0,
        simpanan_sukarela: row.simpanan_sukarela || 0,
        utang_barang_pokok: row.utang_barang_pokok || 0,
        utang_barang_jasa: row.utang_barang_jasa || 0,
        utang_uang_menengah_pokok: row.utang_uang_menengah_pokok || 0,
        utang_uang_menengah_jasa: row.utang_uang_menengah_jasa || 0,
        utang_uang_pendek_pokok: row.utang_uang_pendek_pokok || 0,
        utang_uang_pendek_jasa: row.utang_uang_pendek_jasa || 0,
        simpanan_pokok: row.simpanan_pokok || 0,
        metode_potongan: row.metode_potongan || {},
        total,
      });
    }

    if (potonganData.length === 0) {
      return res.status(422).json({ message: "Tidak ada data valid untuk disimpan." });
    }

    await PotonganGaji.bulkCreate(potonganData);
    return res.status(201).json({ message: `Berhasil import ${potonganData.length} data potongan.` });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Gagal menyimpan data potongan." });
  }
};

// ─── Create Manual ──────────────────────────────────────────
exports.create = async (req, res) => {
  try {
    const {
      anggota_id, no_anggota, bulan, tahun, keterangan,
      simpanan_wajib, simpanan_sukarela,
      utang_barang_pokok, utang_barang_jasa,
      utang_uang_menengah_pokok, utang_uang_menengah_jasa,
      utang_uang_pendek_pokok, utang_uang_pendek_jasa,
      simpanan_pokok, metode_potongan,
    } = req.body;

    if (!bulan || !tahun || (!anggota_id && !no_anggota)) {
      return res.status(422).json({ message: "Anggota, bulan, dan tahun wajib diisi." });
    }

    let anggota = anggota_id
      ? await Anggota.findByPk(anggota_id)
      : await Anggota.findOne({ where: { no_anggota } });

    if (!anggota) {
      return res.status(404).json({ message: "Anggota tidak ditemukan." });
    }

    // Cegah anggota yang sama punya lebih dari satu baris potongan untuk
    // bulan/tahun yang sama (mencegah total ganda saat diproses ke
    // jurnal). Baris dari sumber "pinjaman" boleh berdampingan dengan
    // baris manual lain -- yang dicegah hanya duplikat baris manual.
    const existing = await PotonganGaji.findOne({
      where: { anggota_id: anggota.id, bulan, tahun, sumber: "manual" },
    });
    if (existing) {
      return res.status(422).json({
        message: `${anggota.nama} sudah punya potongan manual untuk ${bulan} ${tahun}. Edit baris yang sudah ada, jangan tambah baru.`,
      });
    }

    const total =
      (parseFloat(simpanan_wajib) || 0) +
      (parseFloat(simpanan_sukarela) || 0) +
      (parseFloat(utang_barang_pokok) || 0) +
      (parseFloat(utang_barang_jasa) || 0) +
      (parseFloat(utang_uang_menengah_pokok) || 0) +
      (parseFloat(utang_uang_menengah_jasa) || 0) +
      (parseFloat(utang_uang_pendek_pokok) || 0) +
      (parseFloat(utang_uang_pendek_jasa) || 0) +
      (parseFloat(simpanan_pokok) || 0);

    const maxUrut = await PotonganGaji.max("no_urut", { where: { bulan, tahun } });

    const potongan = await PotonganGaji.create({
      anggota_id: anggota.id,
      bulan,
      tahun,
      no_urut: (maxUrut || 0) + 1,
      sumber: "manual",
      keterangan: keterangan || null,
      simpanan_wajib: simpanan_wajib || 0,
      simpanan_sukarela: simpanan_sukarela || 0,
      utang_barang_pokok: utang_barang_pokok || 0,
      utang_barang_jasa: utang_barang_jasa || 0,
      utang_uang_menengah_pokok: utang_uang_menengah_pokok || 0,
      utang_uang_menengah_jasa: utang_uang_menengah_jasa || 0,
      utang_uang_pendek_pokok: utang_uang_pendek_pokok || 0,
      utang_uang_pendek_jasa: utang_uang_pendek_jasa || 0,
      simpanan_pokok: simpanan_pokok || 0,
      metode_potongan: metode_potongan || {},
      total,
      is_processed: false,
    });

    return res.status(201).json({ message: "Potongan manual berhasil ditambahkan.", data: potongan });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Gagal menambahkan potongan." });
  }
};

// ─── Update ──────────────────────────────────────────────────
exports.update = async (req, res) => {
  try {
    const potongan = await PotonganGaji.findByPk(req.params.id);
    if (!potongan) return res.status(404).json({ message: "Potongan tidak ditemukan." });

    if (potongan.sumber === "pinjaman") {
      return res.status(403).json({
        message: "Potongan dari pinjaman dibuat otomatis dan tidak bisa diedit. Tambahkan item potongan manual baru jika perlu.",
      });
    }
    if (potongan.is_processed) {
      return res.status(422).json({ message: "Potongan sudah diproses ke jurnal, tidak bisa diedit." });
    }

    const fields = [
      "keterangan", "simpanan_wajib", "simpanan_sukarela",
      "utang_barang_pokok", "utang_barang_jasa",
      "utang_uang_menengah_pokok", "utang_uang_menengah_jasa",
      "utang_uang_pendek_pokok", "utang_uang_pendek_jasa",
      "simpanan_pokok",
    ];
    const updates = {};
    fields.forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f] || 0;
    });
    if (req.body.keterangan !== undefined) updates.keterangan = req.body.keterangan;
    if (req.body.metode_potongan !== undefined) updates.metode_potongan = req.body.metode_potongan || {};

    updates.total =
      (parseFloat(updates.simpanan_wajib ?? potongan.simpanan_wajib) || 0) +
      (parseFloat(updates.simpanan_sukarela ?? potongan.simpanan_sukarela) || 0) +
      (parseFloat(updates.utang_barang_pokok ?? potongan.utang_barang_pokok) || 0) +
      (parseFloat(updates.utang_barang_jasa ?? potongan.utang_barang_jasa) || 0) +
      (parseFloat(updates.utang_uang_menengah_pokok ?? potongan.utang_uang_menengah_pokok) || 0) +
      (parseFloat(updates.utang_uang_menengah_jasa ?? potongan.utang_uang_menengah_jasa) || 0) +
      (parseFloat(updates.utang_uang_pendek_pokok ?? potongan.utang_uang_pendek_pokok) || 0) +
      (parseFloat(updates.utang_uang_pendek_jasa ?? potongan.utang_uang_pendek_jasa) || 0) +
      (parseFloat(updates.simpanan_pokok ?? potongan.simpanan_pokok) || 0);

    await potongan.update(updates);
    return res.json({ message: "Potongan berhasil diperbarui.", data: potongan });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Gagal memperbarui potongan." });
  }
};

// ─── KREDIT_MAP & buildJurnalForPotongan ────────────────────
const KREDIT_MAP = [
  ["simpanan_wajib", "3120", "Simpanan Wajib"],
  ["simpanan_sukarela", "2101", "Simpanan Sukarela"],
  ["utang_barang_pokok", "1106", "Utang Barang Pokok"],
  ["utang_barang_jasa", "1104", "Utang Barang Jasa"],
  ["utang_uang_menengah_pokok", "1103", "Utang Uang Menengah Pokok"],
  ["utang_uang_menengah_jasa", "1104", "Utang Uang Menengah Jasa"],
  ["utang_uang_pendek_pokok", "1103", "Utang Uang Pendek Pokok"],
  ["utang_uang_pendek_jasa", "1104", "Utang Uang Pendek Jasa"],
  ["simpanan_pokok", "3110", "Simpanan Pokok"],
];

async function buildJurnalForPotongan(potongan, userId, t) {
  const akunKas = await Akun.findOne({ where: { kode_akun: "1102" }, transaction: t });
  if (!akunKas) throw new Error("Akun Kas Bank (kode 1102) tidak ditemukan.");

  const neededCodes = new Map();
  for (const [field, kodeAkun, label] of KREDIT_MAP) {
    const nilai = parseFloat(potongan[field]) || 0;
    if (nilai > 0 && !neededCodes.has(kodeAkun)) {
      neededCodes.set(kodeAkun, label);
    }
  }

  const akunCache = new Map();
  for (const [kodeAkun, label] of neededCodes) {
    const akun = await Akun.findOne({ where: { kode_akun: kodeAkun }, transaction: t });
    if (!akun) {
      throw new Error(`Akun untuk "${label}" (kode ${kodeAkun}) tidak ditemukan di master akun.`);
    }
    akunCache.set(kodeAkun, akun);
  }

  const kreditEntries = [];
  for (const [field, kodeAkun, label] of KREDIT_MAP) {
    const nilai = parseFloat(potongan[field]) || 0;
    if (nilai > 0) {
      const akun = akunCache.get(kodeAkun);
      kreditEntries.push({ akun, nilai, label });
    }
  }

  const firstKredit = kreditEntries.length > 0 ? kreditEntries[0].akun : null;

  let pinjamanTerkait = null;
  if (potongan.sumber === "pinjaman") {
    if (!potongan.pinjaman_id) {
      throw new Error("Baris potongan pinjaman tidak punya pinjaman_id.");
    }
    pinjamanTerkait = await Pinjaman.findByPk(potongan.pinjaman_id, { transaction: t });
    if (!pinjamanTerkait) {
      throw new Error(`Pinjaman terkait (id ${potongan.pinjaman_id}) tidak ditemukan.`);
    }
  }

  let referensi = await KodeReferensi.findOne({ where: { kode: "POT-001" }, transaction: t });
  if (!referensi) {
    referensi = await KodeReferensi.create(
      {
        kode: "POT-001",
        uraian_transaksi: "Potongan Gaji",
        label: "Potongan Gaji",
        akun_debet: "Kas Bank",
        akun_kredit: "Beragam (lihat rincian jurnal)",
      },
      { transaction: t }
    );
  }

  const noTransaksi = await generateNoTransaksi(t);

  const transaksi = await Transaksi.create(
    {
      no_transaksi: noTransaksi,
      kode_referensi_id: referensi.id,
      label: referensi.label,
      tanggal: new Date(),
      deskripsi: `Potongan gaji ${potongan.anggota.nama} - ${potongan.bulan} ${potongan.tahun}`,
      jumlah: potongan.total,
      akun_id: akunKas.id,
      akun_debet_id: akunKas.id,
      akun_kredit_id: firstKredit?.id || null,
      akun: [
        akunKas.nama_akun,
        ...kreditEntries.map(e => e.akun.nama_akun)
      ].join(", "),
      anggota_id: potongan.anggota_id,
      anggota: potongan.anggota.nama,
      unit_usaha: "Simpan Pinjam",
      user_id: userId,
    },
    { transaction: t }
  );

  await Jurnal.create(
    {
      transaksi_id: transaksi.id,
      tanggal: new Date(),
      akun_id: akunKas.id,
      debet: potongan.total,
      kredit: 0,
      keterangan: `Penerimaan potongan ${potongan.anggota.nama}`,
    },
    { transaction: t }
  );

  for (const { akun, nilai, label } of kreditEntries) {
    await Jurnal.create(
      {
        transaksi_id: transaksi.id,
        tanggal: new Date(),
        akun_id: akun.id,
        debet: 0,
        kredit: nilai,
        keterangan: label,
      },
      { transaction: t }
    );
  }

  await potongan.update({ is_processed: true }, { transaction: t });

  if (pinjamanTerkait) {
    const sisaBaru = (pinjamanTerkait.sisa_angsuran || 0) - 1;
    await pinjamanTerkait.update(
      {
        sisa_angsuran: sisaBaru,
        angsuran_ke: (pinjamanTerkait.angsuran_ke || 0) + 1,
        status: sisaBaru <= 0 ? "lunas" : "aktif",
      },
      { transaction: t }
    );
  }

  return transaksi;
}

exports.processToJurnal = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const potongan = await PotonganGaji.findByPk(id, {
      include: [{ model: Anggota, as: "anggota" }],
      transaction: t,
    });
    if (!potongan) {
      await t.rollback();
      return res.status(404).json({ message: "Potongan tidak ditemukan." });
    }
    if (potongan.is_processed) {
      await t.rollback();
      return res.status(422).json({ message: "Potongan sudah diproses." });
    }

    const transaksi = await buildJurnalForPotongan(potongan, req.userId, t);

    await t.commit();
    return res.json({ message: "Potongan berhasil diproses ke jurnal.", data: transaksi });
  } catch (error) {
    await t.rollback();
    console.error(error);
    return res.status(500).json({ message: error.message || "Gagal memproses potongan." });
  }
};

exports.processAll = async (req, res) => {
  try {
    const { bulan, tahun, instansi } = req.body;
    if (!bulan || !tahun) {
      return res.status(422).json({ message: "Bulan dan tahun wajib diisi." });
    }

    const includeAnggota = { model: Anggota, as: "anggota", attributes: ["id", "nama", "instansi"] };
    if (instansi) {
      includeAnggota.where = { instansi };
    }

    const rows = await PotonganGaji.findAll({
      where: { bulan, tahun, is_processed: false },
      include: [includeAnggota],
    });

    if (rows.length === 0) {
      return res.status(422).json({
        message: `Tidak ada potongan yang belum diproses untuk ${bulan} ${tahun}${instansi ? ` (${instansi})` : ""}.`,
      });
    }

    let success = 0;
    let failed = 0;
    let skippedZero = 0;
    const errors = [];

    for (const potongan of rows) {
      if (parseFloat(potongan.total) <= 0) {
        skippedZero++;
        continue;
      }
      const t = await sequelize.transaction();
      try {
        await buildJurnalForPotongan(potongan, req.userId, t);
        await t.commit();
        success++;
      } catch (err) {
        await t.rollback();
        failed++;
        errors.push({ anggota_id: potongan.anggota_id, nama: potongan.anggota?.nama, message: err.message });
      }
    }

    return res.json({
      message: `Selesai memproses ${bulan} ${tahun}: ${success} transaksi berhasil dibuat${failed ? `, ${failed} gagal` : ""}${skippedZero ? `, ${skippedZero} dilewati (total 0)` : ""}.`,
      success,
      failed,
      skippedZero,
      errors,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Gagal memproses semua potongan." });
  }
};

// ─── Generate otomatis baris potongan cicilan pinjaman ──────
exports.generatePinjamanBulanIni = async (req, res) => {
  try {
    const now = new Date();
    // FIX: sebelumnya pakai `now.toLocaleString("id-ID", { month: "long" })`,
    // yang hasilnya bergantung pada dukungan ICU penuh di runtime Node
    // server. Kalau Node di-build dengan small-icu (umum di image Docker
    // default), ini bisa menghasilkan nama bulan berbahasa Inggris atau
    // format lain yang tidak match dengan BULAN_LIST -- akibatnya baris
    // yang tergenerate di sini tidak match dengan `where: { bulan, tahun }`
    // di endpoint lain (index, getAnggotaByInstansi, dst). Pakai BULAN_LIST
    // yang sama seperti frontend supaya selalu konsisten.
    const bulan = BULAN_LIST[now.getMonth()];
    const tahun = now.getFullYear();

    const pinjamanAktif = await Pinjaman.findAll({
      where: {
        status: "aktif",
        metode_pembayaran: "potong_gaji",
        sisa_angsuran: { [Op.gt]: 0 },
      },
    });

    let created = 0;
    let skipped = 0;
    const errors = [];

    for (const pinjaman of pinjamanAktif) {
      try {
        const existing = await PotonganGaji.findOne({
          where: { pinjaman_id: pinjaman.id, bulan, tahun },
        });
        if (existing) {
          skipped++;
          continue;
        }

        const maxUrut = await PotonganGaji.max("no_urut", { where: { bulan, tahun } });
        const angsuranKe = (pinjaman.angsuran_ke || 0) + 1;

        // ── FIX: hitung ulang cicilan Uang Menengah dari plafon &
        // jangka_waktu memakai util yang sama dengan PinjamanController,
        // BUKAN sekadar copy pinjaman.utang_uang_menengah_pokok/jasa.
        //
        // Alasan: field itu pada pinjaman lama (dibuat sebelum rumus ini
        // ada / sempat diedit manual di DB) bisa tidak akurat atau kosong.
        // Kalau dibiarkan copy-paste, cicilan bulanan yang tergenerate di
        // sini akan salah terus tiap bulan mengikuti kesalahan awal.
        // Menghitung ulang dari plafon+jangka_waktu setiap kali generate
        // menjamin baris cicilan selalu konsisten dengan rumus resmi:
        //   Pokok = plafon / jangka_waktu
        //   Jasa  = 2,75% x plafon
        const { pokok: uangMenengahPokok, jasa: uangMenengahJasa } =
          hitungAngsuranUangMenengah(pinjaman.plafon, pinjaman.jangka_waktu);

        await PotonganGaji.create({
          anggota_id: pinjaman.anggota_id,
          pinjaman_id: pinjaman.id,
          bulan,
          tahun,
          no_urut: (maxUrut || 0) + 1,
          sumber: "pinjaman",
          keterangan: `Angsuran pinjaman ke-${angsuranKe} dari ${pinjaman.jangka_waktu} bulan`,
          plafon: pinjaman.plafon,
          jangka_waktu: `${pinjaman.jangka_waktu}x`,
          angsuran_ke: angsuranKe,
          simpanan_wajib: pinjaman.simpanan_wajib || 0,
          simpanan_sukarela: pinjaman.simpanan_sukarela || 0,
          utang_barang_pokok: pinjaman.utang_brg_pokok || 0,
          utang_barang_jasa: pinjaman.utang_brg_jasa || 0,
          utang_uang_menengah_pokok: uangMenengahPokok,
          utang_uang_menengah_jasa: uangMenengahJasa,
          utang_uang_pendek_pokok: pinjaman.utang_uang_pendek_pokok || 0,
          utang_uang_pendek_jasa: pinjaman.utang_uang_pendek_jasa || 0,
          simpanan_pokok: pinjaman.simpanan_pokok || 0,
          total:
            (parseFloat(pinjaman.simpanan_wajib) || 0) +
            (parseFloat(pinjaman.simpanan_sukarela) || 0) +
            (parseFloat(pinjaman.utang_brg_pokok) || 0) +
            (parseFloat(pinjaman.utang_brg_jasa) || 0) +
            uangMenengahPokok +
            uangMenengahJasa +
            (parseFloat(pinjaman.utang_uang_pendek_pokok) || 0) +
            (parseFloat(pinjaman.utang_uang_pendek_jasa) || 0) +
            (parseFloat(pinjaman.simpanan_pokok) || 0),
          is_processed: false,
        });
        created++;
      } catch (err) {
        errors.push({ pinjaman_id: pinjaman.id, anggota_id: pinjaman.anggota_id, message: err.message });
      }
    }

    return res.json({
      message: `Generate potongan pinjaman ${bulan} ${tahun}: ${created} baris baru dibuat${skipped ? `, ${skipped} dilewati (sudah ada)` : ""}${errors.length ? `, ${errors.length} gagal` : ""}.`,
      created,
      skipped,
      errors,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Gagal generate potongan pinjaman bulan ini." });
  }
};

// ─── Destroy ──────────────────────────────────────────────────
exports.destroy = async (req, res) => {
  try {
    const potongan = await PotonganGaji.findByPk(req.params.id);
    if (!potongan) return res.status(404).json({ message: "Potongan tidak ditemukan." });
    if (potongan.is_processed) {
      return res.status(422).json({ message: "Potongan sudah diproses, tidak bisa dihapus." });
    }
    await potongan.destroy();
    return res.json({ message: "Potongan berhasil dihapus." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Gagal menghapus potongan." });
  }
};

// ─── FIELD CONFIG ─────────────────────────────────────────────
const FIELDS_POTONGAN = [
  "simpanan_wajib",
  "simpanan_sukarela",
  "simpanan_pokok",
  "utang_barang_pokok",
  "utang_barang_jasa",
  "utang_uang_menengah_pokok",
  "utang_uang_menengah_jasa",
  "utang_uang_pendek_pokok",
  "utang_uang_pendek_jasa",
];

const FIELD_LABELS = {
  simpanan_wajib: "Simpanan Wajib",
  simpanan_sukarela: "Simpanan Sukarela",
  simpanan_pokok: "Simpanan Pokok",
  utang_barang_pokok: "Utang Barang Pokok",
  utang_barang_jasa: "Utang Barang Jasa",
  utang_uang_menengah_pokok: "Utang Uang Menengah Pokok",
  utang_uang_menengah_jasa: "Utang Uang Menengah Jasa",
  utang_uang_pendek_pokok: "Utang Uang Pendek Pokok",
  utang_uang_pendek_jasa: "Utang Uang Pendek Jasa",
};

// Field cicilan uang menengah yang bisa muncul sebagai pratinjau otomatis
// dari pinjaman aktif anggota (lihat pinjaman_preview di getAnggotaByInstansi).
// Harus sinkron dengan PINJAMAN_PREVIEW_FIELDS di frontend.
const PINJAMAN_PREVIEW_FIELDS = ["utang_uang_menengah_pokok", "utang_uang_menengah_jasa"];

// ─── Daftar instansi aktif ──────────────────────────────────
exports.listInstansi = async (req, res) => {
  try {
    const rows = await Anggota.findAll({
      attributes: [[sequelize.fn("DISTINCT", sequelize.col("instansi")), "instansi"]],
      where: { instansi: { [Op.ne]: null, [Op.ne]: "" }, status: "aktif" },
      order: [["instansi", "ASC"]],
      raw: true,
    });
    return res.json({ data: rows.map((r) => r.instansi).filter(Boolean) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Gagal mengambil daftar instansi." });
  }
};

// ─── Get Anggota by Instansi ────────────────────────────────
// Mengembalikan daftar anggota aktif di sebuah instansi untuk bulan/tahun
// tertentu, lengkap dengan nilai yang sudah pernah diisi (kalau ada) DAN
// nilai default yang siap dipakai modal Input per Instansi di frontend:
//   - default_simpanan_wajib   : nominal simpanan wajib standar
//   - default_simpanan_sukarela: nilai simpanan sukarela anggota di bulan
//                                 sebelumnya (kalau ada), supaya bendahara
//                                 tidak perlu isi ulang tiap bulan
//   - pinjaman_preview          : true kalau utang_uang_menengah_* di baris
//                                 ini adalah pratinjau cicilan dari pinjaman
//                                 aktif anggota (belum digenerate resmi lewat
//                                 generatePinjamanBulanIni untuk bulan ini)
exports.getAnggotaByInstansi = async (req, res) => {
  try {
    const { instansi, bulan, tahun } = req.query;
    if (!instansi || !bulan || !tahun) {
      return res.status(422).json({ message: "Instansi, bulan, dan tahun wajib diisi." });
    }

    const anggotaList = await Anggota.findAll({
      where: { instansi, status: "aktif" },
      attributes: ["id", "no_anggota", "nama", "instansi"],
      order: [["nama", "ASC"]],
    });

    if (anggotaList.length === 0) {
      return res.json({ data: [] });
    }

    const anggotaIds = anggotaList.map((a) => a.id);

    // Baris yang sudah ada untuk bulan/tahun yang dipilih
    const existingRows = await PotonganGaji.findAll({
      where: { anggota_id: anggotaIds, bulan, tahun },
    });
    const existingMap = {};
    existingRows.forEach((p) => {
      existingMap[p.anggota_id] = p;
    });

    // Simpanan sukarela bulan sebelumnya, dipakai sebagai default
    const { bulan: bulanLalu, tahun: tahunLalu } = getBulanSebelumnya(bulan, tahun);
    let simpananSukarelaLaluMap = {};
    if (bulanLalu && tahunLalu) {
      const bulanLaluRows = await PotonganGaji.findAll({
        where: { anggota_id: anggotaIds, bulan: bulanLalu, tahun: tahunLalu },
        attributes: ["anggota_id", "simpanan_sukarela"],
        raw: true,
      });
      bulanLaluRows.forEach((r) => {
        simpananSukarelaLaluMap[r.anggota_id] = parseFloat(r.simpanan_sukarela) || 0;
      });
    }

    // Pinjaman aktif bermetode potong-gaji, untuk pratinjau cicilan Uang
    // Menengah. Kalau anggota tidak punya baris potongan untuk bulan ini
    // sama sekali (belum pernah digenerate), tunjukkan pratinjau supaya
    // bendahara tahu ada cicilan yang akan otomatis muncul lewat menu
    // "Generate Potongan Pinjaman", tanpa perlu isi manual di sini.
    const pinjamanAktifList = await Pinjaman.findAll({
      where: {
        anggota_id: anggotaIds,
        status: "aktif",
        metode_pembayaran: "potong_gaji",
        sisa_angsuran: { [Op.gt]: 0 },
      },
    });
    const pinjamanMap = {};
    pinjamanAktifList.forEach((pj) => {
      // Kalau anggota punya lebih dari satu pinjaman aktif, pratinjau di
      // sini cukup pakai satu (yang pertama ditemukan) sebagai indikator
      // "ada cicilan otomatis". Baris resmi untuk SEMUA pinjaman aktif
      // tetap dibuat satu per satu lewat generatePinjamanBulanIni,
      // sehingga sisa_angsuran masing-masing pinjaman tetap sinkron.
      if (!pinjamanMap[pj.anggota_id]) pinjamanMap[pj.anggota_id] = pj;
    });

    const data = anggotaList.map((a) => {
      const p = existingMap[a.id];
      const defaultSimpananWajib = DEFAULT_SIMPANAN_WAJIB;
      const defaultSimpananSukarela = simpananSukarelaLaluMap[a.id] || 0;

      const row = {
        anggota_id: a.id,
        no_anggota: a.no_anggota,
        nama: a.nama,
        potongan_id: p ? p.id : null,
        sumber: p ? p.sumber : null,
        is_processed: p ? !!p.is_processed : false,
        keterangan: p ? p.keterangan || "" : "",
        metode_potongan: p ? p.metode_potongan || {} : {},
        default_simpanan_wajib: defaultSimpananWajib,
        default_simpanan_sukarela: defaultSimpananSukarela,
        pinjaman_preview: false,
      };

      FIELDS_POTONGAN.forEach((f) => {
        row[f] = p ? parseFloat(p[f]) || 0 : 0;
      });

      // Hanya isi default & pratinjau kalau belum ada baris apa pun untuk
      // anggota ini di bulan/tahun tersebut. Kalau sudah ada baris
      // (manual atau pinjaman), nilai yang tersimpan itu yang jadi acuan
      // -- jangan ditimpa default supaya data yang sudah diinput/diproses
      // tidak berubah diam-diam.
      if (!p) {
        row.simpanan_wajib = defaultSimpananWajib;
        row.simpanan_sukarela = defaultSimpananSukarela;

        const pinjaman = pinjamanMap[a.id];
        if (pinjaman) {
          const { pokok, jasa } = hitungAngsuranUangMenengah(pinjaman.plafon, pinjaman.jangka_waktu);
          row.utang_uang_menengah_pokok = pokok;
          row.utang_uang_menengah_jasa = jasa;
          row.pinjaman_preview = true;
        }
      }

      return row;
    });

    return res.json({ data });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Gagal mengambil data anggota per instansi." });
  }
};

// ─── Batch Store ─────────────────────────────────────────────
exports.batchStore = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { instansi, bulan, tahun, data } = req.body;
    if (!instansi || !bulan || !tahun || !Array.isArray(data) || data.length === 0) {
      await t.rollback();
      return res.status(422).json({ message: "Instansi, bulan, tahun, dan data wajib diisi." });
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of data) {
      if (!row.anggota_id) {
        skipped++;
        continue;
      }

      const total = FIELDS_POTONGAN.reduce((sum, f) => sum + (parseFloat(row[f]) || 0), 0);
      if (total <= 0) {
        skipped++;
        continue;
      }

      const anggota = await Anggota.findByPk(row.anggota_id, { transaction: t });
      if (!anggota || anggota.instansi !== instansi) {
        skipped++;
        continue;
      }

      const existing = await PotonganGaji.findOne({
        where: { anggota_id: row.anggota_id, bulan, tahun },
        transaction: t,
      });

      if (existing) {
        // Baris yang SUDAH diproses ke jurnal tetap terkunci total.
        if (existing.is_processed) {
          skipped++;
          continue;
        }

        if (existing.sumber === "pinjaman") {
          const updates = {
            keterangan: row.keterangan || existing.keterangan,
            metode_potongan: row.metode_potongan || existing.metode_potongan || {},
          };
          FIELDS_POTONGAN.forEach((f) => {
            if (PINJAMAN_PREVIEW_FIELDS.includes(f)) {
              // abaikan nilai kiriman untuk 2 field ini, pertahankan nilai asli
              updates[f] = parseFloat(existing[f]) || 0;
            } else {
              updates[f] = parseFloat(row[f]) || 0;
            }
          });
          updates.total = FIELDS_POTONGAN.reduce((sum, f) => sum + (updates[f] || 0), 0);

          await existing.update(updates, { transaction: t });
          updated++;
          continue;
        }

        // Baris manual biasa -- update seperti semula.
        const updates = {
          keterangan: row.keterangan || existing.keterangan,
          metode_potongan: row.metode_potongan || {},
          total,
        };
        FIELDS_POTONGAN.forEach((f) => {
          updates[f] = parseFloat(row[f]) || 0;
        });
        await existing.update(updates, { transaction: t });
        updated++;
      } else {
        const maxUrut = await PotonganGaji.max("no_urut", {
          where: { bulan, tahun },
          transaction: t,
        });
        const payload = {
          anggota_id: row.anggota_id,
          bulan,
          tahun,
          no_urut: (maxUrut || 0) + 1,
          sumber: "manual",
          keterangan: row.keterangan || null,
          metode_potongan: row.metode_potongan || {},
          total,
          is_processed: false,
        };
        FIELDS_POTONGAN.forEach((f) => {
          payload[f] = parseFloat(row[f]) || 0;
        });
        await PotonganGaji.create(payload, { transaction: t });
        created++;
      }
    }

    await t.commit();
    return res.status(201).json({
      message: `Berhasil disimpan untuk instansi ${instansi}: ${created} baru, ${updated} diperbarui${skipped ? `, ${skipped} dilewati (kosong / sudah diproses / dari pinjaman)` : ""}.`,
      created,
      updated,
      skipped,
    });
  } catch (error) {
    await t.rollback();
    console.error(error);
    return res.status(500).json({ message: "Gagal menyimpan potongan per instansi." });
  }
};

// ─── Export Excel ─────────────────────────────────────────────
exports.exportExcel = async (req, res) => {
  try {
    const { bulan, tahun, instansi, anggota } = req.query;
    const where = {};
    if (bulan) where.bulan = bulan;
    if (tahun) where.tahun = tahun;

    const includeAnggota = {
      model: Anggota,
      as: "anggota",
      attributes: ["id", "no_anggota", "nama", "instansi"],
    };
    // 🆕 Filter anggota (pencarian sebagian nama / no. anggota), sinkron
    // dengan panel Filter di frontend -- digabung dengan instansi lewat
    // buildAnggotaFilterWhere supaya keduanya bisa dipakai bersamaan.
    const anggotaWhere = buildAnggotaFilterWhere(instansi, anggota);
    if (anggotaWhere) {
      includeAnggota.where = anggotaWhere;
    }

    const data = await PotonganGaji.findAll({
      where,
      include: [includeAnggota],
      order: [["tahun", "DESC"], ["bulan", "DESC"], ["no_urut", "ASC"]],
    });

    if (data.length === 0) {
      return res.status(422).json({ message: "Tidak ada data potongan untuk diekspor." });
    }

    const ExcelJS = require("exceljs");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Potongan Gaji");

    const fieldConfig = [
      { key: "simpanan_wajib", label: "Simpanan Wajib" },
      { key: "simpanan_sukarela", label: "Simpanan Sukarela" },
      { key: "utang_barang_pokok", label: "Utang Barang Pokok" },
      { key: "utang_barang_jasa", label: "Utang Barang Jasa" },
      { key: "utang_uang_menengah_pokok", label: "Utang Uang Menengah Pokok" },
      { key: "utang_uang_menengah_jasa", label: "Utang Uang Menengah Jasa" },
      { key: "utang_uang_pendek_pokok", label: "Utang Uang Pendek Pokok" },
      { key: "utang_uang_pendek_jasa", label: "Utang Uang Pendek Jasa" },
      { key: "simpanan_pokok", label: "Simpanan Pokok" },
    ];

    const columns = [
      { header: "No", key: "no", width: 8 },
      { header: "No Anggota", key: "no_anggota", width: 15 },
      { header: "Nama", key: "nama", width: 30 },
      { header: "Instansi", key: "instansi", width: 25 },
      { header: "Bulan", key: "bulan", width: 15 },
      { header: "Tahun", key: "tahun", width: 10 },
      { header: "Sumber", key: "sumber", width: 15 },
      { header: "Keterangan", key: "keterangan", width: 30 },
      ...fieldConfig.map((f) => ({ header: f.label, key: f.key, width: 20 })),
      { header: "Total", key: "total", width: 18 },
      { header: "Status", key: "status", width: 15 },
    ];

    sheet.columns = columns;
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { horizontal: "center" };

    data.forEach((item, idx) => {
      const rowData = {
        no: idx + 1,
        no_anggota: item.anggota?.no_anggota || "-",
        nama: item.anggota?.nama || "-",
        instansi: item.anggota?.instansi || "-",
        bulan: item.bulan,
        tahun: item.tahun,
        sumber: item.sumber === "pinjaman" ? "Otomatis" : "Manual",
        keterangan: item.keterangan || "",
        total: parseFloat(item.total) || 0,
        status: item.is_processed ? "Diproses" : "Belum",
      };
      fieldConfig.forEach(({ key }) => {
        rowData[key] = parseFloat(item[key]) || 0;
      });
      sheet.addRow(rowData);
    });

    const numberKeys = ["total", ...fieldConfig.map((f) => f.key)];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      numberKeys.forEach((key) => {
        const cell = row.getCell(key);
        if (cell) {
          cell.alignment = { horizontal: "right" };
          cell.numFmt = "#,##0";
        }
      });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=potongan-gaji-${Date.now()}.xlsx`
    );
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("❌ Export Excel error:", error);
    res.status(500).json({ message: "Gagal mengekspor Excel." });
  }
};

// ─── Export PDF ──────────────────────────────────────────────
exports.exportPdf = async (req, res) => {
  try {
    const { bulan, tahun, instansi, anggota } = req.query;
    const where = {};
    if (bulan) where.bulan = bulan;
    if (tahun) where.tahun = tahun;

    const includeAnggota = {
      model: Anggota,
      as: "anggota",
      attributes: ["id", "no_anggota", "nama", "instansi"],
    };
    // 🆕 Filter anggota (pencarian sebagian nama / no. anggota), sinkron
    // dengan panel Filter di frontend -- digabung dengan instansi lewat
    // buildAnggotaFilterWhere supaya keduanya bisa dipakai bersamaan.
    const anggotaWhere = buildAnggotaFilterWhere(instansi, anggota);
    if (anggotaWhere) {
      includeAnggota.where = anggotaWhere;
    }

    const data = await PotonganGaji.findAll({
      where,
      include: [includeAnggota],
      order: [["tahun", "DESC"], ["bulan", "DESC"], ["no_urut", "ASC"]],
    });

    if (data.length === 0) {
      return res.status(422).json({ message: "Tidak ada data potongan untuk diekspor." });
    }

    const pengaturan = await PengaturanWebsite.findOne();

    // ── Field config ──
    // FIX: kolom "waserba" dihapus. Field ini tidak ada di model
    // PotonganGaji maupun FIELDS_POTONGAN -- item.waserba selalu
    // undefined, jadi kolomnya di PDF selalu kosong. Kalau nanti memang
    // dibutuhkan, tambahkan dulu kolomnya di model & alur input sebelum
    // dimasukkan lagi ke sini.
    const fieldKeys = [
      "simpanan_wajib",
      "simpanan_sukarela",
      "utang_barang_pokok",
      "utang_barang_jasa",
      "utang_uang_menengah_pokok",
      "utang_uang_menengah_jasa",
      "utang_uang_pendek_pokok",
      "utang_uang_pendek_jasa",
      "simpanan_pokok",
    ];

    // ── Tentukan judul periode (fallback jika query bulan/tahun kosong) ──
    const bulanTahunSet = new Set(data.map((d) => `${d.bulan}|${d.tahun}`));
    const isSinglePeriode = bulanTahunSet.size === 1;
    let judulPeriode;
    if (bulan && tahun) {
      judulPeriode = `POTONGAN BULAN ${String(bulan).toUpperCase()} ${tahun}`;
    } else if (isSinglePeriode) {
      const [b, y] = [...bulanTahunSet][0].split("|");
      judulPeriode = `POTONGAN BULAN ${String(b).toUpperCase()} ${y}`;
    } else {
      judulPeriode = "REKAP POTONGAN GAJI (SEMUA PERIODE)";
    }

    // ── Kelompokkan data per instansi ──
    const groupsMap = new Map();
    data.forEach((item) => {
      const namaInstansi = item.anggota?.instansi || "Tanpa Instansi";
      if (!groupsMap.has(namaInstansi)) groupsMap.set(namaInstansi, []);
      groupsMap.get(namaInstansi).push(item);
    });
    const groups = [...groupsMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    // ── Buat PDF (A4 Landscape) ──
    const doc = new PDFDocument({ margin: 20, size: "A4", layout: "landscape" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=potongan-gaji-${Date.now()}.pdf`);
    doc.pipe(res);

    const pageWidth = 841.89;
    const pageHeight = 595.28;
    const marginX = 20;
    const contentWidth = pageWidth - marginX * 2;
    const startX = marginX;
    const bottomLimit = pageHeight - 40;

    // ── Resolusi path logo ──
    const logoPath = pengaturan?.logo_koperasi
      ? path.join(__dirname, "../../public/uploads/pengaturan", pengaturan.logo_koperasi)
      : null;
    const logoExists = logoPath ? fs.existsSync(logoPath) : false;

    const namaKoperasi = pengaturan?.nama_koperasi || "KOPERASI KONSUMEN MITRA HUSADA SEJAHTERA";

    // ── Fungsi gambar kop surat + judul + nama instansi, return Y setelah kop ──
    const drawKopAndTitle = (namaInstansi) => {
      let y = 20;
      let logoLoaded = false;

      if (logoExists) {
        try {
          doc.image(logoPath, startX, y, { width: 55, height: 55 });
          logoLoaded = true;
        } catch (err) {
          console.error("Logo GAGAL dimuat di doc.image(), error lengkap:", err);
        }
      }

      const leftOffset = logoLoaded ? 65 : 0;
      doc.fillColor("#000");
      doc.fontSize(15).font("Helvetica-Bold").text(namaKoperasi, startX + leftOffset, y + 4, {
        width: contentWidth - leftOffset,
        align: "center",
      });

      doc.fontSize(8.5).font("Helvetica");
      const infoY = y + 26;
      const infoLines = [
        `Nomor : ${pengaturan?.no_badan_hukum || "-"}`,
        `Tanggal : ${formatTanggalIndonesia(pengaturan?.tgl_badan_hukum)}`,
        pengaturan?.alamat_koperasi || "Alamat Belum Diatur",
      ];
      infoLines.forEach((line, i) => {
        doc.text(line, startX + leftOffset, infoY + i * 12, {
          width: contentWidth - leftOffset,
          align: "center",
        });
      });

      y += 75;
      doc.moveTo(startX, y).lineTo(startX + contentWidth, y).lineWidth(2).stroke("#000");
      y += 3;
      doc.moveTo(startX, y).lineTo(startX + contentWidth, y).lineWidth(1).stroke("#000");
      y += 14;

      doc.fillColor("#000").fontSize(12).font("Helvetica-Bold").text(judulPeriode, startX, y, {
        width: contentWidth,
        align: "center",
      });
      y = doc.y + 4;

      doc.fontSize(9).font("Helvetica-Bold").text(`Instansi: ${namaInstansi}`, startX, y, {
        width: contentWidth,
        align: "left",
      });
      y = doc.y + 8;

      return y;
    };

    // ── Lebar kolom (total ≈ 736, muat dalam contentWidth ≈ 801.89) ──
    const colWidths = [
      42,  // No Anggota
      32,  // No Urut
      120, // Nama
      50,  // Plafon
      26,  // JW
      20,  // Ke
      44,  // Simp. Wajib
      44,  // Simp. Sukarela
      44,  // Utang Brg. Pokok
      42,  // Utang Brg. Jasa
      48,  // Utang Uang Menengah Pokok
      50,  // Utang Uang Menengah Jasa 2,75%
      48,  // Utang Uang Pendek Pokok
      50,  // Utang Uang Pendek Jasa 2,75%
      42,  // Simp. Pokok
      54,  // Jumlah
    ];

    const headers = [
      "No.\nAnggota",
      "No.\nUrut",
      "Nama",
      "Plafon",
      "JW",
      "Ke",
      "Simp.\nWajib",
      "Simp.\nSukarela",
      "Utang Brg.\nPokok",
      "Utang Brg.\nJasa",
      "Utang Uang\nMenengah\nPokok",
      "Utang Uang\nMenengah\nJasa 2,75%",
      "Utang Uang\nPendek\nPokok",
      "Utang Uang\nPendek\nJasa 2,75%",
      "Simp.\nPokok",
      "Jumlah",
    ];

    const HEADER_H = 34;
    const ROW_H = 18;
    const HEADER_FONT = 7;
    const BODY_FONT = 7.5;
    const BORDER_COLOR = "#000000"; // garis pemisah tegas, cell putih polos

    const drawHeader = (y) => {
      let x = startX;
      for (let i = 0; i < headers.length; i++) {
        // Cell putih saja, garis pemisah hitam.
        // PENTING: pakai fillAndStroke(), BUKAN fill() lalu stroke() terpisah.
        // .fill() menutup/mengonsumsi path saat itu juga, sehingga .stroke()
        // setelahnya tidak punya path lagi untuk digambar — itu sebabnya
        // sebelumnya cell terisi warna tapi garis tabelnya tidak pernah muncul.
        doc.lineWidth(0.75).rect(x, y, colWidths[i], HEADER_H).fillAndStroke("#ffffff", BORDER_COLOR);
        doc
          .fillColor("#000")
          .fontSize(HEADER_FONT)
          .font("Helvetica-Bold")
          .text(headers[i], x + 2, y + 4, {
            width: colWidths[i] - 4,
            align: i === 2 ? "left" : "center",
          });
        x += colWidths[i];
      }
      return y + HEADER_H;
    };

    // ── Loop tiap instansi → halaman baru per instansi ──
    groups.forEach(([namaInstansi, rows], groupIdx) => {
      if (groupIdx > 0) {
        doc.addPage({ size: "A4", margin: 20, layout: "landscape" });
      }

      let rowY = drawKopAndTitle(namaInstansi);
      rowY = drawHeader(rowY);

      const subtotal = {};
      fieldKeys.forEach((k) => (subtotal[k] = 0));
      let subtotalGrand = 0;

      rows.forEach((item, idx) => {
        if (rowY + ROW_H > bottomLimit) {
          doc.addPage({ size: "A4", margin: 20, layout: "landscape" });
          rowY = 20;
          rowY = drawHeader(rowY);
        }

        const y = rowY;
        let x = startX;

        // Semua baris: fill putih, garis pemisah hitam — tanpa selang-seling warna.
        // fillAndStroke() dipakai supaya garis benar-benar tergambar (lihat
        // catatan di drawHeader di atas soal kenapa fill()+stroke() terpisah gagal).
        for (let i = 0; i < colWidths.length; i++) {
          doc.lineWidth(0.75).rect(x, y, colWidths[i], ROW_H).fillAndStroke("#ffffff", BORDER_COLOR);
          x += colWidths[i];
        }

        doc.fillColor("#000").fontSize(BODY_FONT).font("Helvetica");

        x = startX;
        const cellText = (text, i, align = "right") => {
          doc.text(text, x + 3, y + 5, { width: colWidths[i] - 6, align, lineBreak: false });
          x += colWidths[i];
        };

        // Tanda (*) menandai komponen yang dipotong dari Tukin (bukan
        // Gaji), sesuai catatan di panel Export frontend. Dibaca dari
        // metode_potongan (field virtual di model, alias kolom
        // sumber_field) -- default "gaji" kalau field tidak ada di peta.
        const metodeItem = item.metode_potongan || {};
        const isTukin = (field) => metodeItem[field] === "tukin";
        const valWithMark = (field, val) => {
          if (val <= 0) return "";
          const text = formatRupiah(val);
          return isTukin(field) ? `${text}*` : text;
        };

        cellText(item.anggota?.no_anggota || "-", 0, "center");
        cellText(item.no_urut != null ? String(item.no_urut) : String(idx + 1), 1, "center");
        cellText((item.anggota?.nama || "-").substring(0, 30), 2, "left");
        cellText(item.plafon ? formatRupiah(item.plafon) : "", 3, "right");
        cellText(item.jangka_waktu || "", 4, "center");
        cellText(item.angsuran_ke ? String(item.angsuran_ke) : "", 5, "center");

        fieldKeys.forEach((key, fi) => {
          const val = parseFloat(item[key]) || 0;
          subtotal[key] += val;
          cellText(valWithMark(key, val), 6 + fi, "right");
        });

        subtotalGrand += parseFloat(item.total) || 0;

        doc.font("Helvetica-Bold");
        cellText(formatRupiah(item.total), 15, "right"); // kolom Jumlah = index terakhir

        rowY += ROW_H;
      });

      // ── Baris Subtotal Instansi ──
      if (rowY + ROW_H + 4 > bottomLimit) {
        doc.addPage({ size: "A4", margin: 20, layout: "landscape" });
        rowY = 20;
        rowY = drawHeader(rowY);
      }

      const y = rowY;
      const totalRowH = ROW_H + 2;
      let x = startX;

      for (let i = 0; i < colWidths.length; i++) {
        doc.lineWidth(0.75).rect(x, y, colWidths[i], totalRowH).fillAndStroke("#ffffff", BORDER_COLOR);
        x += colWidths[i];
      }

      doc.fillColor("#000").fontSize(7).font("Helvetica-Bold");
      x = startX;
      const labelWidth =
        colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5];
      doc.text(`TOTAL ${namaInstansi}`, x + 3, y + 5, { width: labelWidth - 6, align: "center" });
      x += labelWidth;

      fieldKeys.forEach((key, fi) => {
        const val = subtotal[key] || 0;
        const display = val > 0 ? formatRupiah(val) : "";
        doc.text(display, x + 3, y + 5, { width: colWidths[6 + fi] - 6, align: "right" });
        x += colWidths[6 + fi];
      });

      doc.text(formatRupiah(subtotalGrand), x + 3, y + 5, { width: colWidths[colWidths.length - 1] - 6, align: "right" });
      rowY += totalRowH;

      doc
        .fontSize(7)
        .font("Helvetica-Oblique")
        .fillColor("#555")
        .text(`Dicetak: ${formatTanggalIndonesia(new Date())}   (*) dipotong dari Tunjangan Kinerja (Tukin)`, startX, rowY + 10, {
          width: contentWidth,
          align: "right",
        });
    });

    doc.end();
  } catch (error) {
    console.error("❌ Export PDF error:", error);
    res.status(500).json({ message: "Gagal mengekspor PDF." });
  }
};