// controllers/TransaksiController.js

const Transaksi = require("../models/Transaksi");
const Jurnal = require("../models/Jurnal");
const Akun = require("../models/Akun");
const Anggota = require("../models/Anggota");
const KodeReferensi = require("../models/KodeReferensi");
const Pinjaman = require("../models/Pinjaman");
const JenisSimpanan = require("../models/JenisSimpanan");
const JenisTabungan = require("../models/JenisTabungan");
const JenisPiutang = require("../models/JenisPiutang");
const JenisPendapatan = require("../models/JenisPendapatan");
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const { QueryTypes } = require("sequelize");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const PengaturanWebsite = require("../models/PengaturanWebsite");
const PenjualanDetail = require("../models/PenjualanDetail");
const { hapusJejakPenjualan } = require("../services/PenjualanService");
const KODE_REF = require("../config/kodeReferensi");
const User = require("../models/User");

// ============================================================
// HELPER FUNCTIONS
// ============================================================

const A4_LANDSCAPE = [841.89, 595.28];

function generateNoTransaksi() {
  const now = new Date();
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `TRX-${ymd}-${random}`;
}

function formatRupiah(value) {
  const num = parseFloat(value) || 0;
  return num.toLocaleString("id-ID");
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

async function resolveAkunSummary(jurnal, ref, transaction = null) {
  const akunIds = [...new Set(jurnal.map((r) => r.akun_id).filter(Boolean))];
  const akunRecords = await Akun.findAll({
    where: { id: akunIds },
    transaction,
  });
  const akunMap = {};
  akunRecords.forEach((a) => {
    akunMap[a.id] = a;
  });

  const missing = jurnal.find((r) => !akunMap[r.akun_id]);
  if (missing) {
    return { error: `Akun dengan id ${missing.akun_id} tidak ditemukan.` };
  }

  const akunDebetId =
    ref.akun_debet_id || jurnal.find((r) => parseFloat(r.debet) > 0)?.akun_id || null;
  const akunKreditId =
    ref.akun_kredit_id || jurnal.find((r) => parseFloat(r.kredit) > 0)?.akun_id || null;

  const akunLabel = [...new Set(jurnal.map((r) => akunMap[r.akun_id]?.nama_akun).filter(Boolean))].join(
    ", "
  );

  return {
    akunId: jurnal[0]?.akun_id || null,
    akunDebetId,
    akunKreditId,
    akunLabel,
  };
}

// ─── Index ────────────────────────────────────────────────────
exports.index = async (req, res) => {
  try {
    const {
      search,
      tanggal_mulai,
      tanggal_selesai,
      kode_transaksi,
      nama_akun,
      nama_anggota,
      page = 1,
      per_page = 10,
    } = req.query;

    const where = {};

    if (tanggal_mulai) {
      where.tanggal = { [Op.gte]: tanggal_mulai };
    }
    if (tanggal_selesai) {
      if (where.tanggal) {
        where.tanggal = { ...where.tanggal, [Op.lte]: tanggal_selesai };
      } else {
        where.tanggal = { [Op.lte]: tanggal_selesai };
      }
    }

    if (kode_transaksi && kode_transaksi.trim() !== "") {
      where.label = { [Op.like]: `%${kode_transaksi.trim()}%` };
    }
    if (nama_akun && nama_akun.trim() !== "") {
      where.akun = { [Op.like]: `%${nama_akun.trim()}%` };
    }
    if (nama_anggota && nama_anggota.trim() !== "") {
      where.anggota = { [Op.like]: `%${nama_anggota.trim()}%` };
    }
    if (search && search.trim() !== "") {
      where[Op.or] = [
        { no_transaksi: { [Op.like]: `%${search.trim()}%` } },
        { deskripsi: { [Op.like]: `%${search.trim()}%` } },
        { akun: { [Op.like]: `%${search.trim()}%` } },
        { anggota: { [Op.like]: `%${search.trim()}%` } },
        { label: { [Op.like]: `%${search.trim()}%` } },
      ];
    }

    console.log("🔍 Filter Transaksi:", JSON.stringify(where, null, 2));

    const { rows, count } = await Transaksi.findAndCountAll({
      where,
      include: [
        { model: Jurnal, as: "jurnalList", include: [{ model: Akun, as: "akun" }] },
        { model: Anggota, as: "anggotaDetail", attributes: ["id", "no_anggota", "nama"] },
        { model: KodeReferensi, as: "referensi" },
        { model: JenisSimpanan, as: "jenisSimpanan", attributes: ["id", "kode", "nama"] },
        { model: JenisTabungan, as: "jenisTabungan", attributes: ["id", "kode", "nama"] },
        { model: JenisPiutang, as: "jenisPiutang", attributes: ["id", "kode", "nama"] },
        { model: JenisPendapatan, as: "jenisPendapatan", attributes: ["id", "kode", "nama"] },
      ],
      order: [["tanggal", "DESC"], ["id", "DESC"]],
      limit: parseInt(per_page),
      offset: (parseInt(page) - 1) * parseInt(per_page),
    });

    const total = count;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const totalHariIni = await Transaksi.count({
      where: { ...where, tanggal: { [Op.gte]: today } },
    });
    const totalBulanIni = await Transaksi.count({
      where: { ...where, tanggal: { [Op.gte]: startOfMonth } },
    });
    const nominalTotal = await Transaksi.sum("jumlah", { where });
    const nominalHariIni = await Transaksi.sum("jumlah", {
      where: { ...where, tanggal: { [Op.gte]: today } },
    });
    const nominalBulanIni = await Transaksi.sum("jumlah", {
      where: { ...where, tanggal: { [Op.gte]: startOfMonth } },
    });

    const kodeTransaksiOptions = await KodeReferensi.findAll({
      attributes: ["label"],
      group: ["label"],
      order: [["label", "ASC"]],
      raw: true,
    });
    const namaAkunOptions = await Akun.findAll({
      attributes: ["nama_akun"],
      group: ["nama_akun"],
      order: [["nama_akun", "ASC"]],
      raw: true,
    });
    const namaAnggotaOptions = await Anggota.findAll({
      attributes: ["nama"],
      group: ["nama"],
      order: [["nama", "ASC"]],
      raw: true,
    });

    return res.json({
      data: rows,
      pagination: {
        page: parseInt(page),
        per_page: parseInt(per_page),
        total: count,
        total_pages: Math.ceil(count / per_page),
      },
      summary: {
        total,
        totalHariIni,
        totalBulanIni,
        nominalTotal,
        nominalHariIni,
        nominalBulanIni,
      },
      filters: {
        kodeTransaksi: kodeTransaksiOptions.map((r) => r.label).filter(Boolean),
        namaAkun: namaAkunOptions.map((r) => r.nama_akun).filter(Boolean),
        namaAnggota: namaAnggotaOptions.map((r) => r.nama).filter(Boolean),
      },
    });
  } catch (error) {
    console.error("❌ Error di index:", error);
    return res.status(500).json({ message: "Gagal mengambil data transaksi." });
  }
};

// ─── Data form ──────────────────────────────────────────────
exports.formData = async (req, res) => {
  try {
    const referensi = await KodeReferensi.findAll({
      include: [
        { model: Akun, as: "akunDebet", attributes: ["id", "kode_akun", "nama_akun"] },
        { model: Akun, as: "akunKredit", attributes: ["id", "kode_akun", "nama_akun"] },
      ],
      order: [["id", "ASC"]],
    });
    const anggota = await Anggota.findAll({
      attributes: ["id", "no_anggota", "nama"],
      order: [["nama", "ASC"]],
    });
    const akun = await Akun.findAll({
      attributes: ["id", "kode_akun", "nama_akun"],
      order: [["kode_akun", "ASC"]],
    });
    return res.json({ referensi, anggota, akun });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Gagal mengambil data form." });
  }
};

// ─── Store ────────────────────────────────────────────────────
exports.store = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const {
      no_transaksi,
      tanggal,
      deskripsi,
      unit_usaha,
      anggota_id,
      kode_referensi_id,
      jurnal,
      // Ambil field jenis dari request body
      jenis_simpanan_id,
      jenis_tabungan_id,
      jenis_piutang_id,
      jenis_pendapatan_id,
    } = req.body;

    if (!tanggal || !deskripsi || !kode_referensi_id || !jurnal || jurnal.length === 0) {
      await t.rollback();
      return res.status(422).json({ message: "Data tidak lengkap." });
    }

    let totalDebet = 0,
      totalKredit = 0;
    for (const row of jurnal) {
      totalDebet += parseFloat(row.debet) || 0;
      totalKredit += parseFloat(row.kredit) || 0;
    }
    if (totalDebet !== totalKredit) {
      await t.rollback();
      return res.status(422).json({ message: "Total debet harus sama dengan total kredit." });
    }

    if (no_transaksi) {
      const existing = await Transaksi.findOne({ where: { no_transaksi }, transaction: t });
      if (existing) {
        await t.rollback();
        return res.status(422).json({ message: "No. transaksi sudah digunakan." });
      }
    }

    const ref = await KodeReferensi.findByPk(kode_referensi_id, { transaction: t });
    if (!ref) {
      await t.rollback();
      return res.status(422).json({ message: "Kode referensi tidak ditemukan." });
    }

    // ✅ Validasi jenis dari referensi (tetap dipertahankan)
    if (ref.jenis_simpanan_id) {
      const simpanan = await JenisSimpanan.findOne({
        where: { id: ref.jenis_simpanan_id, is_active: true },
        transaction: t,
      });
      if (!simpanan) {
        await t.rollback();
        return res.status(422).json({ message: "Jenis simpanan pada referensi tidak aktif atau tidak ditemukan." });
      }
    }
    if (ref.jenis_tabungan_id) {
      const tabungan = await JenisTabungan.findOne({
        where: { id: ref.jenis_tabungan_id, is_active: true },
        transaction: t,
      });
      if (!tabungan) {
        await t.rollback();
        return res.status(422).json({ message: "Jenis tabungan pada referensi tidak aktif atau tidak ditemukan." });
      }
    }
    if (ref.jenis_piutang_id) {
      const piutang = await JenisPiutang.findOne({
        where: { id: ref.jenis_piutang_id, is_active: true },
        transaction: t,
      });
      if (!piutang) {
        await t.rollback();
        return res.status(422).json({ message: "Jenis piutang pada referensi tidak aktif atau tidak ditemukan." });
      }
    }
    if (ref.jenis_pendapatan_id) {
      const pendapatan = await JenisPendapatan.findOne({
        where: { id: ref.jenis_pendapatan_id, is_active: true },
        transaction: t,
      });
      if (!pendapatan) {
        await t.rollback();
        return res.status(422).json({ message: "Jenis pendapatan pada referensi tidak aktif atau tidak ditemukan." });
      }
    }

    // ✅ Validasi nilai yang dikirim dari form (jika ada)
    if (jenis_simpanan_id) {
      const simpanan = await JenisSimpanan.findOne({
        where: { id: jenis_simpanan_id, is_active: true },
        transaction: t,
      });
      if (!simpanan) {
        await t.rollback();
        return res.status(422).json({ message: "Jenis simpanan yang dipilih tidak aktif atau tidak ditemukan." });
      }
    }
    if (jenis_tabungan_id) {
      const tabungan = await JenisTabungan.findOne({
        where: { id: jenis_tabungan_id, is_active: true },
        transaction: t,
      });
      if (!tabungan) {
        await t.rollback();
        return res.status(422).json({ message: "Jenis tabungan yang dipilih tidak aktif atau tidak ditemukan." });
      }
    }
    if (jenis_piutang_id) {
      const piutang = await JenisPiutang.findOne({
        where: { id: jenis_piutang_id, is_active: true },
        transaction: t,
      });
      if (!piutang) {
        await t.rollback();
        return res.status(422).json({ message: "Jenis piutang yang dipilih tidak aktif atau tidak ditemukan." });
      }
    }
    if (jenis_pendapatan_id) {
      const pendapatan = await JenisPendapatan.findOne({
        where: { id: jenis_pendapatan_id, is_active: true },
        transaction: t,
      });
      if (!pendapatan) {
        await t.rollback();
        return res.status(422).json({ message: "Jenis pendapatan yang dipilih tidak aktif atau tidak ditemukan." });
      }
    }

    if (!req.userId) {
      await t.rollback();
      return res.status(401).json({ message: "Anda harus login untuk menyimpan transaksi." });
    }

    const userId = req.userId;
    const anggota = anggota_id ? await Anggota.findByPk(anggota_id, { transaction: t }) : null;

    const akunSummary = await resolveAkunSummary(jurnal, ref, t);
    if (akunSummary.error) {
      await t.rollback();
      return res.status(422).json({ message: akunSummary.error });
    }

    // Gunakan nilai dari request body (prioritas), fallback ke null
    const finalJenisSimpanan = jenis_simpanan_id || null;
    const finalJenisTabungan = jenis_tabungan_id || null;
    const finalJenisPiutang = jenis_piutang_id || null;
    const finalJenisPendapatan = jenis_pendapatan_id || null;

    const transaksi = await Transaksi.create(
      {
        no_transaksi: no_transaksi || generateNoTransaksi(),
        kode_referensi_id,
        label: ref.label,
        tanggal,
        deskripsi,
        unit_usaha: unit_usaha || null,
        anggota_id: anggota_id || null,
        anggota: anggota ? anggota.nama : null,
        user_id: userId,
        akun_id: akunSummary.akunId,
        akun_debet_id: akunSummary.akunDebetId,
        akun_kredit_id: akunSummary.akunKreditId,
        akun: akunSummary.akunLabel,
        jumlah: totalDebet,
        jenis_simpanan_id: finalJenisSimpanan,
        jenis_tabungan_id: finalJenisTabungan,
        jenis_piutang_id: finalJenisPiutang,
        jenis_pendapatan_id: finalJenisPendapatan,
      },
      { transaction: t }
    );

    for (const row of jurnal) {
      await Jurnal.create(
        {
          transaksi_id: transaksi.id,
          tanggal,
          akun_id: row.akun_id,
          debet: parseFloat(row.debet) || 0,
          kredit: parseFloat(row.kredit) || 0,
          keterangan: row.keterangan || null,
        },
        { transaction: t }
      );
    }

    await t.commit();
    return res.status(201).json({ message: "Transaksi berhasil disimpan.", data: transaksi });
  } catch (error) {
    await t.rollback();
    console.error(error);
    return res.status(500).json({ message: "Gagal menyimpan transaksi." });
  }
};

// ─── Show ─────────────────────────────────────────────────────
exports.show = async (req, res) => {
  try {
    const transaksi = await Transaksi.findByPk(req.params.id, {
      include: [
        { model: Jurnal, as: "jurnalList", include: [{ model: Akun, as: "akun" }] },
        { model: Anggota, as: "anggotaDetail", attributes: ["id", "no_anggota", "nama"] },
        { model: KodeReferensi, as: "referensi" },
        { model: JenisSimpanan, as: "jenisSimpanan", attributes: ["id", "kode", "nama"] },
        { model: JenisTabungan, as: "jenisTabungan", attributes: ["id", "kode", "nama"] },
        { model: JenisPiutang, as: "jenisPiutang", attributes: ["id", "kode", "nama"] },
        { model: JenisPendapatan, as: "jenisPendapatan", attributes: ["id", "kode", "nama"] },
      ],
    });
    if (!transaksi) return res.status(404).json({ message: "Transaksi tidak ditemukan." });
    return res.json({ data: transaksi });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Gagal mengambil detail transaksi." });
  }
};

// ─── Update ──────────────────────────────────────────────────
exports.update = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const transaksi = await Transaksi.findByPk(req.params.id, { transaction: t });
    if (!transaksi) {
      await t.rollback();
      return res.status(404).json({ message: "Transaksi tidak ditemukan." });
    }

    const refPembelian = await KodeReferensi.findOne({ where: { kode: KODE_REF.PEMBELIAN_TRANSFER }, transaction: t });
    const refPenjualan = await KodeReferensi.findOne({ where: { kode: KODE_REF.PENJUALAN }, transaction: t });

    if (refPembelian && transaksi.kode_referensi_id === refPembelian.id) {
      await t.rollback();
      return res.status(403).json({
        message: "Transaksi pembelian tidak dapat diedit dari sini. Gunakan menu Pembelian Toko.",
      });
    }

    const detailPenjualan = await PenjualanDetail.findAll({
      where: { transaksi_id: transaksi.id },
      transaction: t,
    });

    if (detailPenjualan.length > 0) {
      const { tanggal, deskripsi } = req.body;
      await transaksi.update({ tanggal, deskripsi }, { transaction: t });
      if (tanggal) {
        await Jurnal.update({ tanggal }, { where: { transaksi_id: transaksi.id }, transaction: t });
      }
      await t.commit();
      return res.json({
        message:
          "Transaksi penjualan hanya bisa diubah tanggal & deskripsinya dari sini. Untuk mengubah barang/harga, gunakan menu Penjualan Toko.",
        data: transaksi,
      });
    }

    const {
      tanggal,
      deskripsi,
      unit_usaha,
      anggota_id,
      kode_referensi_id,
      jurnal,
      no_transaksi,
      // Ambil field jenis dari request body
      jenis_simpanan_id,
      jenis_tabungan_id,
      jenis_piutang_id,
      jenis_pendapatan_id,
    } = req.body;

    if (!tanggal || !deskripsi || !kode_referensi_id || !jurnal || jurnal.length === 0) {
      await t.rollback();
      return res.status(422).json({ message: "Data tidak lengkap." });
    }

    let totalDebet = 0,
      totalKredit = 0;
    for (const row of jurnal) {
      totalDebet += parseFloat(row.debet) || 0;
      totalKredit += parseFloat(row.kredit) || 0;
    }
    if (totalDebet !== totalKredit) {
      await t.rollback();
      return res.status(422).json({ message: "Total debet harus sama dengan total kredit." });
    }

    if (no_transaksi && no_transaksi !== transaksi.no_transaksi) {
      const existing = await Transaksi.findOne({ where: { no_transaksi }, transaction: t });
      if (existing) {
        await t.rollback();
        return res.status(422).json({ message: "No. transaksi sudah digunakan." });
      }
    }

    const ref = await KodeReferensi.findByPk(kode_referensi_id, { transaction: t });
    if (!ref) {
      await t.rollback();
      return res.status(422).json({ message: "Kode referensi tidak ditemukan." });
    }

    // ✅ Validasi jenis dari referensi (tetap dipertahankan)
    if (ref.jenis_simpanan_id) {
      const simpanan = await JenisSimpanan.findOne({
        where: { id: ref.jenis_simpanan_id, is_active: true },
        transaction: t,
      });
      if (!simpanan) {
        await t.rollback();
        return res.status(422).json({ message: "Jenis simpanan pada referensi tidak aktif atau tidak ditemukan." });
      }
    }
    if (ref.jenis_tabungan_id) {
      const tabungan = await JenisTabungan.findOne({
        where: { id: ref.jenis_tabungan_id, is_active: true },
        transaction: t,
      });
      if (!tabungan) {
        await t.rollback();
        return res.status(422).json({ message: "Jenis tabungan pada referensi tidak aktif atau tidak ditemukan." });
      }
    }
    if (ref.jenis_piutang_id) {
      const piutang = await JenisPiutang.findOne({
        where: { id: ref.jenis_piutang_id, is_active: true },
        transaction: t,
      });
      if (!piutang) {
        await t.rollback();
        return res.status(422).json({ message: "Jenis piutang pada referensi tidak aktif atau tidak ditemukan." });
      }
    }
    if (ref.jenis_pendapatan_id) {
      const pendapatan = await JenisPendapatan.findOne({
        where: { id: ref.jenis_pendapatan_id, is_active: true },
        transaction: t,
      });
      if (!pendapatan) {
        await t.rollback();
        return res.status(422).json({ message: "Jenis pendapatan pada referensi tidak aktif atau tidak ditemukan." });
      }
    }

    // ✅ Validasi nilai yang dikirim dari form (jika ada)
    if (jenis_simpanan_id) {
      const simpanan = await JenisSimpanan.findOne({
        where: { id: jenis_simpanan_id, is_active: true },
        transaction: t,
      });
      if (!simpanan) {
        await t.rollback();
        return res.status(422).json({ message: "Jenis simpanan yang dipilih tidak aktif atau tidak ditemukan." });
      }
    }
    if (jenis_tabungan_id) {
      const tabungan = await JenisTabungan.findOne({
        where: { id: jenis_tabungan_id, is_active: true },
        transaction: t,
      });
      if (!tabungan) {
        await t.rollback();
        return res.status(422).json({ message: "Jenis tabungan yang dipilih tidak aktif atau tidak ditemukan." });
      }
    }
    if (jenis_piutang_id) {
      const piutang = await JenisPiutang.findOne({
        where: { id: jenis_piutang_id, is_active: true },
        transaction: t,
      });
      if (!piutang) {
        await t.rollback();
        return res.status(422).json({ message: "Jenis piutang yang dipilih tidak aktif atau tidak ditemukan." });
      }
    }
    if (jenis_pendapatan_id) {
      const pendapatan = await JenisPendapatan.findOne({
        where: { id: jenis_pendapatan_id, is_active: true },
        transaction: t,
      });
      if (!pendapatan) {
        await t.rollback();
        return res.status(422).json({ message: "Jenis pendapatan yang dipilih tidak aktif atau tidak ditemukan." });
      }
    }

    const anggota = anggota_id ? await Anggota.findByPk(anggota_id, { transaction: t }) : null;
    const akunSummary = await resolveAkunSummary(jurnal, ref, t);
    if (akunSummary.error) {
      await t.rollback();
      return res.status(422).json({ message: akunSummary.error });
    }

    // Gunakan nilai dari request body (prioritas), fallback ke null
    const finalJenisSimpanan = jenis_simpanan_id || null;
    const finalJenisTabungan = jenis_tabungan_id || null;
    const finalJenisPiutang = jenis_piutang_id || null;
    const finalJenisPendapatan = jenis_pendapatan_id || null;

    await transaksi.update(
      {
        no_transaksi: no_transaksi || transaksi.no_transaksi,
        kode_referensi_id,
        label: ref.label,
        tanggal,
        deskripsi,
        unit_usaha: unit_usaha || null,
        anggota_id: anggota_id || null,
        anggota: anggota ? anggota.nama : null,
        akun_id: akunSummary.akunId,
        akun_debet_id: akunSummary.akunDebetId,
        akun_kredit_id: akunSummary.akunKreditId,
        akun: akunSummary.akunLabel,
        jumlah: totalDebet,
        jenis_simpanan_id: finalJenisSimpanan,
        jenis_tabungan_id: finalJenisTabungan,
        jenis_piutang_id: finalJenisPiutang,
        jenis_pendapatan_id: finalJenisPendapatan,
      },
      { transaction: t }
    );

    await Jurnal.destroy({ where: { transaksi_id: transaksi.id }, transaction: t });
    for (const row of jurnal) {
      await Jurnal.create(
        {
          transaksi_id: transaksi.id,
          tanggal,
          akun_id: row.akun_id,
          debet: parseFloat(row.debet) || 0,
          kredit: parseFloat(row.kredit) || 0,
          keterangan: row.keterangan || null,
        },
        { transaction: t }
      );
    }

    await t.commit();
    return res.json({ message: "Transaksi berhasil diperbarui.", data: transaksi });
  } catch (error) {
    await t.rollback();
    console.error(error);
    return res.status(500).json({ message: "Gagal memperbarui transaksi." });
  }
};

// ─── Destroy ──────────────────────────────────────────────────
exports.destroy = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const transaksi = await Transaksi.findByPk(req.params.id, { transaction: t });
    if (!transaksi) {
      await t.rollback();
      return res.status(404).json({ message: "Transaksi tidak ditemukan." });
    }

    const refPembelian = await KodeReferensi.findOne({ where: { kode: KODE_REF.PEMBELIAN_TRANSFER }, transaction: t });
    if (refPembelian && transaksi.kode_referensi_id === refPembelian.id) {
      await t.rollback();
      return res.status(403).json({
        message: "Transaksi pembelian tidak dapat dihapus dari sini. Gunakan menu Pembelian Toko.",
      });
    }

    const detailPenjualan = await PenjualanDetail.findAll({
      where: { transaksi_id: transaksi.id },
      transaction: t,
    });

    if (detailPenjualan.length > 0) {
      await hapusJejakPenjualan(transaksi.id, t);
    } else {
      await Jurnal.destroy({ where: { transaksi_id: transaksi.id }, transaction: t });
    }

    await transaksi.destroy({ transaction: t });
    await t.commit();

    return res.json({
      message:
        detailPenjualan.length > 0
          ? "Transaksi penjualan berhasil dihapus, stok telah dikembalikan."
          : "Transaksi berhasil dihapus.",
    });
  } catch (error) {
    await t.rollback();
    console.error(error);
    return res.status(500).json({ message: error.message || "Gagal menghapus transaksi." });
  }
};

// ─── Ambil data pinjaman anggota ────────────────────────────
exports.getPinjamanAnggota = async (req, res) => {
  try {
    const { anggota_id } = req.query;
    if (!anggota_id) {
      return res.status(400).json({ message: "anggota_id wajib diisi." });
    }

    const pinjaman = await Pinjaman.findOne({
      where: {
        anggota_id,
        status: "aktif",
      },
      include: [{ model: Anggota, as: "anggota", attributes: ["id", "no_anggota", "nama"] }],
      order: [["created_at", "DESC"]],
    });

    if (!pinjaman) {
      return res.status(404).json({ message: "Tidak ada pinjaman aktif untuk anggota ini." });
    }

    const sisa = pinjaman.sisa_angsuran > 0 ? pinjaman.sisa_angsuran - 1 : 0;

    return res.json({
      data: {
        ...pinjaman.toJSON(),
        sisa_angsuran: sisa,
        angsuran_ke: pinjaman.angsuran_ke + 1,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Gagal mengambil data pinjaman." });
  }
};

// ─── Riwayat Transaksi untuk Anggota (by user login) ───
exports.riwayatAnggota = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findByPk(userId, {
      include: [{ model: Anggota, as: 'anggota' }]
    });

    if (!user || !user.anggota) {
      return res.status(404).json({
        success: false,
        message: 'Anggota tidak ditemukan'
      });
    }

    const anggotaId = user.anggota.id;

    const transaksi = await Transaksi.findAll({
      where: { anggota_id: anggotaId },
      include: [
        {
          model: KodeReferensi,
          as: 'referensi',
          attributes: ['uraian_transaksi', 'label']
        },
        {
          model: JenisSimpanan,
          as: 'jenisSimpanan',
          attributes: ['nama', 'kode']
        },
        {
          model: JenisTabungan,
          as: 'jenisTabungan',
          attributes: ['nama', 'kode']
        },
        {
          model: JenisPiutang,
          as: 'jenisPiutang',
          attributes: ['nama', 'kode']
        },
        {
          model: JenisPendapatan,
          as: 'jenisPendapatan',
          attributes: ['nama', 'kode']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    return res.status(200).json({
      success: true,
      data: transaksi
    });

  } catch (error) {
    console.error('❌ Error riwayatAnggota:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil riwayat transaksi',
      error: error.message
    });
  }
};

// ─── Simpan potongan gaji ────────────────────────────────────
// DINONAKTIFKAN (410 Gone).
//
// Alasan: logika pemrosesan jurnal + penurunan sisa_angsuran pinjaman di
// endpoint ini sudah dipindahkan ke PotonganGajiController.processToJurnal /
// processAll (fungsi buildJurnalForPotongan), yang memakai KREDIT_MAP dengan
// kode akun yang benar-benar ada di master akun (1102 Kas Bank, 1103 Piutang
// Pinjaman, 1104 Piutang Jasa/Bunga, 1106 Piutang Dagang/Toko, 2101 Simpanan
// Sukarela, 3110 Simpanan Pokok, 3120 Simpanan Wajib).
//
// Endpoint lama ini memakai `mapAkun` dengan kode akun (3001, 3002,
// 2001–2007, 3003) yang TIDAK ADA di tabel akun manapun, sehingga setiap
// pemanggilan akan selalu berakhir dengan `totalKredit === 0` dan merespons
// 422 "Tidak ada potongan valid atau akun kas tidak ditemukan." Karena itu,
// logika penurunan sisa_angsuran/angsuran_ke/status pinjaman yang ada di
// bagian bawah fungsi ini pada praktiknya tidak pernah tereksekusi.
//
// Alur yang benar sekarang:
// 1. PinjamanController.verifikasi membuat baris PotonganGaji (sumber:
//    "pinjaman") + jurnal pencairan (Dr Piutang / Cr Kas) otomatis saat
//    pinjaman disetujui.
// 2. PotonganGajiController.processToJurnal (satu per satu) atau processAll
//    (per bulan/instansi) memproses baris tersebut ke jurnal DAN menurunkan
//    sisa_angsuran/angsuran_ke pinjaman terkait, sampai jangka waktu selesai.
//
// Fungsi ini tetap diekspor (bukan dihapus) supaya route yang masih
// meng-require-nya tidak error saat startup; kalau masih ada yang
// memanggilnya dari frontend, sebaiknya diarahkan ke menu Potongan Gaji.
exports.storePotongan = async (req, res) => {
  return res.status(410).json({
    message:
      "Endpoint ini sudah tidak digunakan. Proses potongan gaji (termasuk cicilan pinjaman) sekarang dilakukan lewat menu Potongan Gaji (processToJurnal / processAll).",
  });
};



// ============================================================
// EXPORT
// ============================================================

// ─── Export Excel ─────────────────────────────────────────────
exports.exportExcel = async (req, res) => {
  try {
    const { search, tanggal_mulai, tanggal_selesai, kode_transaksi, nama_akun, nama_anggota } = req.query;

    const where = {};

    if (tanggal_mulai) {
      where.tanggal = { [Op.gte]: tanggal_mulai };
    }
    if (tanggal_selesai) {
      if (where.tanggal) {
        where.tanggal = { ...where.tanggal, [Op.lte]: tanggal_selesai };
      } else {
        where.tanggal = { [Op.lte]: tanggal_selesai };
      }
    }

    if (kode_transaksi && kode_transaksi.trim() !== "") {
      where.label = { [Op.like]: `%${kode_transaksi.trim()}%` };
    }
    if (nama_akun && nama_akun.trim() !== "") {
      where.akun = { [Op.like]: `%${nama_akun.trim()}%` };
    }
    if (nama_anggota && nama_anggota.trim() !== "") {
      where.anggota = { [Op.like]: `%${nama_anggota.trim()}%` };
    }
    if (search && search.trim() !== "") {
      where[Op.or] = [
        { no_transaksi: { [Op.like]: `%${search.trim()}%` } },
        { deskripsi: { [Op.like]: `%${search.trim()}%` } },
        { akun: { [Op.like]: `%${search.trim()}%` } },
        { anggota: { [Op.like]: `%${search.trim()}%` } },
        { label: { [Op.like]: `%${search.trim()}%` } },
      ];
    }

    console.log("📊 Export Excel Filter:", JSON.stringify(where, null, 2));

    const data = await Transaksi.findAll({
      where,
      include: [
        { model: Jurnal, as: "jurnalList", include: [{ model: Akun, as: "akun" }] },
        { model: Anggota, as: "anggotaDetail", attributes: ["id", "no_anggota", "nama"] },
        { model: KodeReferensi, as: "referensi" },
      ],
      order: [["tanggal", "DESC"]],
    });

    if (data.length === 0) {
      return res.status(422).json({ message: "Tidak ada data transaksi untuk diekspor." });
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Transaksi");

    sheet.columns = [
      { header: "No Transaksi", key: "no_transaksi", width: 20 },
      { header: "Tanggal", key: "tanggal", width: 15 },
      { header: "Kode Referensi", key: "label", width: 25 },
      { header: "Deskripsi", key: "deskripsi", width: 35 },
      { header: "Akun", key: "akun", width: 30 },
      { header: "Jumlah", key: "jumlah", width: 20 },
      { header: "Unit Usaha", key: "unit_usaha", width: 18 },
      { header: "Anggota", key: "anggota", width: 25 },
    ];
    sheet.getRow(1).font = { bold: true };

    data.forEach((trx) => {
      const akunNames = trx.jurnalList.map((j) => j.akun?.nama_akun || "-").join(", ");
      sheet.addRow({
        no_transaksi: trx.no_transaksi,
        tanggal: trx.tanggal,
        label: trx.label,
        deskripsi: trx.deskripsi,
        akun: akunNames,
        jumlah: parseFloat(trx.jumlah) || 0,
        unit_usaha: trx.unit_usaha || "-",
        anggota: trx.anggota || "-",
      });
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=transaksi-${new Date().toISOString().slice(0,10)}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Gagal mengekspor Excel." });
  }
};

// ─── Export PDF ──────────────────────────────────────────────
exports.exportPdf = async (req, res) => {
  try {
    const { search, tanggal_mulai, tanggal_selesai, kode_transaksi, nama_akun, nama_anggota } = req.query;

    const where = {};

    if (tanggal_mulai) {
      where.tanggal = { [Op.gte]: tanggal_mulai };
    }
    if (tanggal_selesai) {
      if (where.tanggal) {
        where.tanggal = { ...where.tanggal, [Op.lte]: tanggal_selesai };
      } else {
        where.tanggal = { [Op.lte]: tanggal_selesai };
      }
    }

    if (kode_transaksi && kode_transaksi.trim() !== "") {
      where.label = { [Op.like]: `%${kode_transaksi.trim()}%` };
    }
    if (nama_akun && nama_akun.trim() !== "") {
      where.akun = { [Op.like]: `%${nama_akun.trim()}%` };
    }
    if (nama_anggota && nama_anggota.trim() !== "") {
      where.anggota = { [Op.like]: `%${nama_anggota.trim()}%` };
    }
    if (search && search.trim() !== "") {
      where[Op.or] = [
        { no_transaksi: { [Op.like]: `%${search.trim()}%` } },
        { deskripsi: { [Op.like]: `%${search.trim()}%` } },
        { akun: { [Op.like]: `%${search.trim()}%` } },
        { anggota: { [Op.like]: `%${search.trim()}%` } },
        { label: { [Op.like]: `%${search.trim()}%` } },
      ];
    }

    console.log("📄 Export PDF Filter:", JSON.stringify(where, null, 2));

    const data = await Transaksi.findAll({
      where,
      include: [
        { model: Jurnal, as: "jurnalList", include: [{ model: Akun, as: "akun" }] },
        { model: Anggota, as: "anggotaDetail", attributes: ["id", "no_anggota", "nama"] },
        { model: KodeReferensi, as: "referensi" },
      ],
      order: [["tanggal", "DESC"]],
    });

    if (data.length === 0) {
      return res.status(422).json({ message: "Tidak ada data transaksi untuk diekspor." });
    }

    const pengaturan = await PengaturanWebsite.findOne();

    const doc = new PDFDocument({ margin: 40, size: A4_LANDSCAPE });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=transaksi-${new Date().toISOString().slice(0,10)}.pdf`);
    doc.pipe(res);

    const startX = 40;
    let currentY = 40;

    const logoPath = pengaturan?.logo_koperasi
      ? path.join(__dirname, "..", "..", "public", "uploads", "pengaturan", pengaturan.logo_koperasi)
      : null;
    if (logoPath && fs.existsSync(logoPath)) {
      doc.image(logoPath, startX, currentY, { width: 60, height: 60 });
    }

    const namaKoperasi = pengaturan?.nama_koperasi || "KOPERASI";
    doc.fontSize(14).font("Helvetica-Bold").text(namaKoperasi, startX + 70, currentY + 5, {
      width: 700,
      align: "center",
    });

    doc.fontSize(8).font("Helvetica");
    const infoY = currentY + 25;
    const infoLines = [
      `Nomor : ${pengaturan?.no_badan_hukum || "-"}`,
      `Tanggal : ${formatTanggalIndonesia(pengaturan?.tgl_badan_hukum)}`,
      pengaturan?.alamat_koperasi || "Alamat Belum Diatur",
    ];
    infoLines.forEach((line, i) => {
      doc.text(line, startX + 70, infoY + i * 12, { width: 700, align: "center" });
    });

    currentY += 75;
    doc.moveTo(startX, currentY).lineTo(startX + 750, currentY).lineWidth(3).stroke("#000");
    currentY += 2;
    doc.moveTo(startX, currentY).lineTo(startX + 750, currentY).lineWidth(1).stroke("#000");
    currentY += 15;

    doc.fontSize(11).font("Helvetica-Bold").text("DAFTAR TRANSAKSI", startX, currentY, {
      width: 750,
      align: "center",
    });
    currentY = doc.y + 12;

    const colWidths = [60, 80, 120, 150, 100, 80, 80, 100];
    const headers = ["No Transaksi", "Tanggal", "Kode Ref", "Deskripsi", "Akun", "Jumlah", "Unit Usaha", "Anggota"];

    let headerY = currentY;
    doc.rect(startX, headerY, 750, 18).fill("#6c757d");
    doc.fillColor("#fff").font("Helvetica-Bold").fontSize(7);
    let x = startX;
    headers.forEach((h, i) => {
      doc.text(h, x + 4, headerY + 4, { width: colWidths[i] - 8, align: i === 5 ? "right" : "left" });
      x += colWidths[i];
    });

    let rowY = headerY + 18;
    doc.fillColor("#000").font("Helvetica").fontSize(7);

    data.forEach((trx, index) => {
      if (rowY + 18 > 550) {
        doc.addPage({ size: A4_LANDSCAPE, margin: 40 });
        rowY = 40;
        doc.rect(startX, rowY, 750, 18).fill("#6c757d");
        doc.fillColor("#fff").font("Helvetica-Bold").fontSize(7);
        x = startX;
        headers.forEach((h, i) => {
          doc.text(h, x + 4, rowY + 4, { width: colWidths[i] - 8, align: i === 5 ? "right" : "left" });
          x += colWidths[i];
        });
        rowY += 18;
      }

      doc.rect(startX, rowY, 750, 16).stroke();
      const rowData = [
        trx.no_transaksi,
        trx.tanggal,
        trx.label,
        trx.deskripsi,
        trx.jurnalList.map((j) => j.akun?.nama_akun || "-").join(", "),
        formatRupiah(trx.jumlah),
        trx.unit_usaha || "-",
        trx.anggota || "-",
      ];
      x = startX;
      rowData.forEach((text, i) => {
        const align = i === 5 ? "right" : "left";
        doc.text(text, x + 4, rowY + 3, { width: colWidths[i] - 8, align });
        x += colWidths[i];
      });
      rowY += 16;
    });

    doc.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Gagal mengekspor PDF." });
  }
};