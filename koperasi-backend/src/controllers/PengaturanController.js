// src/controllers/PengaturanController.js
const PengaturanWebsite = require("../models/PengaturanWebsite");
const fs = require("fs");
const path = require("path");

// Folder upload
const UPLOAD_DIR = path.join(
  __dirname,
  "..",
  "..",
  "public",
  "uploads",
  "pengaturan"
);

// ─── Helper ──────────────────────────────────────────────────

function withImageUrl(data, req) {
  const json = data.toJSON ? data.toJSON() : { ...data };
  const fields = ["logo_website", "logo_koperasi", "background_website"];
  fields.forEach((field) => {
    json[`${field}_url`] = json[field]
      ? `${req.protocol}://${req.get("host")}/uploads/pengaturan/${json[field]}`
      : null;
  });
  return json;
}

async function deleteOldFile(filename) {
  if (!filename) return;
  const filePath = path.join(UPLOAD_DIR, filename);
  try {
    await fs.promises.access(filePath);
    await fs.promises.unlink(filePath);
  } catch {}
}

// ─── Controller ─────────────────────────────────────────────

exports.index = async (req, res) => {
  try {
    const data = await PengaturanWebsite.findOne();
    if (!data) return res.json({ data: null });

    return res.json({ data: withImageUrl(data, req) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Gagal mengambil pengaturan website." });
  }
};

exports.store = async (req, res) => {
  try {
    const {
      nama_koperasi,
      nama_ketua,
      alamat_koperasi,
      no_badan_hukum,
      tgl_badan_hukum,
      tgl_awal,
      nama_website,
      warna_layout,
    } = req.body;

    // ─── Validasi ────────────────────────────────────────────
    if (
      !nama_koperasi ||
      !nama_ketua ||
      !alamat_koperasi ||
      !no_badan_hukum ||
      !nama_website
    ) {
      return res.status(422).json({ message: "Semua field wajib diisi." });
    }

    const existing = await PengaturanWebsite.findOne();
    if (existing) {
      return res.status(422).json({ message: "Pengaturan sudah ada. Gunakan update." });
    }

    // ─── Buat data ───────────────────────────────────────────
    const files = req.files || {};
    const newData = {
      nama_koperasi,
      nama_ketua,
      alamat_koperasi,
      no_badan_hukum,
      tgl_badan_hukum: tgl_badan_hukum || null,
      tgl_awal: tgl_awal || null,
      nama_website,
      warna_layout: warna_layout || "#20c997",
      logo_website: files.logo_website?.[0]?.filename || null,
      logo_koperasi: files.logo_koperasi?.[0]?.filename || null,
      background_website: files.background_website?.[0]?.filename || null,
    };

    const pengaturan = await PengaturanWebsite.create(newData);
    console.log("✅ Data pengaturan awal dibuat.");

    return res.status(201).json({
      message: "Pengaturan website berhasil dibuat.",
      data: withImageUrl(pengaturan, req),
    });
  } catch (err) {
    console.error("❌ Error di store:", err);
    return res.status(500).json({ message: "Gagal membuat pengaturan website." });
  }
};

exports.update = async (req, res) => {
  try {
    const pengaturan = await PengaturanWebsite.findOne();
    if (!pengaturan) {
      return res.status(404).json({ message: "Pengaturan belum tersedia." });
    }

    const {
      nama_koperasi,
      nama_ketua,
      alamat_koperasi,
      no_badan_hukum,
      tgl_badan_hukum,
      tgl_awal,
      nama_website,
      warna_layout,
    } = req.body;

    // ─── Validasi ────────────────────────────────────────────
    if (
      !nama_koperasi ||
      !nama_ketua ||
      !alamat_koperasi ||
      !no_badan_hukum ||
      !nama_website
    ) {
      return res.status(422).json({ message: "Semua field wajib diisi." });
    }

    // ─── Update data ──────────────────────────────────────────
    const updateData = {
      nama_koperasi,
      nama_ketua,
      alamat_koperasi,
      no_badan_hukum,
      tgl_badan_hukum: tgl_badan_hukum || null,
      tgl_awal: tgl_awal || null,
      nama_website,
      warna_layout: warna_layout || "#20c997",
    };

    // File upload
    const files = req.files || {};
    if (files.logo_website) {
      await deleteOldFile(pengaturan.logo_website);
      updateData.logo_website = files.logo_website[0].filename;
    }
    if (files.logo_koperasi) {
      await deleteOldFile(pengaturan.logo_koperasi);
      updateData.logo_koperasi = files.logo_koperasi[0].filename;
    }
    if (files.background_website) {
      await deleteOldFile(pengaturan.background_website);
      updateData.background_website = files.background_website[0].filename;
    }

    await pengaturan.update(updateData);

    const updated = await PengaturanWebsite.findOne();

    return res.json({
      message: "Pengaturan website berhasil diperbarui.",
      data: withImageUrl(updated, req),
    });
  } catch (err) {
    console.error("❌ Error di update:", err);
    return res.status(500).json({ message: "Gagal memperbarui pengaturan website." });
  }
};