const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const Anggota = require("../models/Anggota");
const User = require("../models/User");
const PengaturanWebsite = require('../models/PengaturanWebsite');
const QRCode = require('qrcode');

function buildFilter(query) {
  const { search, status, kecamatan, desa, gabung_dari, gabung_sampai } = query;
  const where = {};

  if (search) {
    where[Op.or] = [
      { nama: { [Op.like]: `%${search}%` } },
      { no_anggota: { [Op.like]: `%${search}%` } },
    ];
  }
  if (status && ["aktif", "nonaktif"].includes(status)) where.status = status;
  if (kecamatan) where.kecamatan = kecamatan;
  if (desa) where.desa = desa;
  if (gabung_dari || gabung_sampai) {
    where.tanggal_gabung = {};
    if (gabung_dari) where.tanggal_gabung[Op.gte] = gabung_dari;
    if (gabung_sampai) where.tanggal_gabung[Op.lte] = gabung_sampai;
  }
  return where;
}

// Ubah path fisik file jadi URL yang bisa diakses frontend
function withFotoUrl(anggota, req) {
  const json = anggota.toJSON ? anggota.toJSON() : anggota;
  json.foto_url = json.foto
    ? `${req.protocol}://${req.get("host")}/uploads/anggota/${json.foto}`
    : null;
  return json;
}

exports.index = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.per_page) || 10;
    const where = buildFilter(req.query);

    const { rows, count } = await Anggota.findAndCountAll({
      where,
      order: [["created_at", "DESC"]],
      limit: perPage,
      offset: (page - 1) * perPage,
    });

    return res.json({
      data: rows.map((r) => withFotoUrl(r, req)),
      pagination: {
        page, per_page: perPage, total: count,
        total_pages: Math.ceil(count / perPage),
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Gagal mengambil data anggota." });
  }
};

exports.summary = async (req, res) => {
  try {
    const where = buildFilter(req.query);
    const total = await Anggota.count({ where });
    const aktif = await Anggota.count({ where: { ...where, status: "aktif" } });
    const nonaktif = await Anggota.count({ where: { ...where, status: "nonaktif" } });

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    const baruBulanIni = await Anggota.count({
      where: {
        ...where,
        tanggal_gabung: { ...(where.tanggal_gabung || {}), [Op.gte]: startOfMonth },
      },
    });

    return res.json({
      total_anggota: total,
      anggota_aktif: aktif,
      anggota_nonaktif: nonaktif,
      anggota_baru_bulan_ini: baruBulanIni,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Gagal mengambil ringkasan anggota." });
  }
};

exports.show = async (req, res) => {
  const anggota = await Anggota.findByPk(req.params.id);
  if (!anggota) return res.status(404).json({ message: "Anggota tidak ditemukan." });
  return res.json({ data: withFotoUrl(anggota, req) });
};

// POST /api/anggota  (multipart/form-data, field foto = "foto")
exports.store = async (req, res) => {
  try {
    const {
      no_anggota, nama, jenis_kelamin, alamat, desa, kecamatan,
      no_hp, tanggal_gabung, tanggal_keluar, status,
    } = req.body;

    if (!no_anggota || !nama || !tanggal_gabung) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(422).json({ message: "No. anggota, nama, dan tanggal gabung wajib diisi." });
    }

    const exists = await Anggota.findOne({ where: { no_anggota } });
    if (exists) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(422).json({ message: "No. anggota sudah terdaftar." });
    }

    const anggota = await Anggota.create({
      no_anggota, nama,
      jenis_kelamin: jenis_kelamin || "L",
      foto: req.file ? req.file.filename : null,
      alamat, desa, kecamatan, no_hp,
      tanggal_gabung, tanggal_keluar: tanggal_keluar || null,
      status: status || "aktif",
    });

    return res.status(201).json({ message: "Anggota berhasil ditambahkan.", data: withFotoUrl(anggota, req) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Gagal menambahkan anggota." });
  }
};

// PUT /api/anggota/:id  (multipart/form-data jika ganti foto)
exports.update = async (req, res) => {
  try {
    const anggota = await Anggota.findByPk(req.params.id);
    if (!anggota) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: "Anggota tidak ditemukan." });
    }

    const {
      no_anggota, nama, jenis_kelamin, alamat, desa, kecamatan,
      no_hp, tanggal_gabung, tanggal_keluar, status,
    } = req.body;

    if (no_anggota && no_anggota !== anggota.no_anggota) {
      const exists = await Anggota.findOne({ where: { no_anggota } });
      if (exists) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(422).json({ message: "No. anggota sudah digunakan anggota lain." });
      }
    }

    const dataUpdate = {
      no_anggota, nama, jenis_kelamin, alamat, desa, kecamatan,
      no_hp, tanggal_gabung, tanggal_keluar: tanggal_keluar || null, status,
    };

    // Kalau ada foto baru, hapus foto lama & pakai yang baru
    if (req.file) {
      if (anggota.foto) {
        const oldPath = path.join(__dirname, "..", "..", "public", "uploads", "anggota", anggota.foto);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      dataUpdate.foto = req.file.filename;
    }

    await anggota.update(dataUpdate);

    return res.json({ message: "Anggota berhasil diperbarui.", data: withFotoUrl(anggota, req) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Gagal memperbarui anggota." });
  }
};

exports.destroy = async (req, res) => {
  const anggota = await Anggota.findByPk(req.params.id);
  if (!anggota) return res.status(404).json({ message: "Anggota tidak ditemukan." });

  if (anggota.foto) {
    const filePath = path.join(__dirname, "..", "..", "public", "uploads", "anggota", anggota.foto);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  await anggota.destroy();
  return res.json({ message: "Anggota berhasil dihapus." });
};

exports.autocomplete = async (req, res) => {
  try {
    const { q, exclude_has_user } = req.query;
    if (!q || q.length < 2) {
      return res.json({ data: [] });
    }

    const list = await Anggota.findAll({
      where: {
        [Op.or]: [
          { nama: { [Op.like]: `%${q}%` } },
          { no_anggota: { [Op.like]: `%${q}%` } },
        ],
      },
      include: [{ model: User, as: "user", attributes: ["id"] }],
      limit: 10,
      order: [["nama", "ASC"]],
    });

    // Filter "belum punya user" hanya jika diminta secara eksplisit
    const filtered = exclude_has_user === "1" ? list.filter((a) => !a.user) : list;

    res.json({
      data: filtered.map((a) => ({
        id: a.id,
        no_anggota: a.no_anggota,
        nama: a.nama,
      })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Gagal mengambil data anggota." });
  }
};

// Export Excel — tambah kolom Jenis Kelamin
exports.exportExcel = async (req, res) => {
  try {
    const where = buildFilter(req.query);
    const data = await Anggota.findAll({ where, order: [["nama", "ASC"]] });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Anggota");

    sheet.columns = [
      { header: "No. Anggota", key: "no_anggota", width: 16 },
      { header: "Nama", key: "nama", width: 25 },
      { header: "Jenis Kelamin", key: "jenis_kelamin", width: 14 },
      { header: "Alamat", key: "alamat", width: 30 },
      { header: "Desa", key: "desa", width: 18 },
      { header: "Kecamatan", key: "kecamatan", width: 18 },
      { header: "No. HP", key: "no_hp", width: 16 },
      { header: "Tgl Gabung", key: "tanggal_gabung", width: 14 },
      { header: "Tgl Keluar", key: "tanggal_keluar", width: 14 },
      { header: "Status", key: "status", width: 12 },
    ];
    sheet.getRow(1).font = { bold: true };

    data.forEach((a) => {
      sheet.addRow({
        no_anggota: a.no_anggota,
        nama: a.nama,
        jenis_kelamin: a.jenis_kelamin === "L" ? "Laki-laki" : "Perempuan",
        alamat: a.alamat,
        desa: a.desa,
        kecamatan: a.kecamatan,
        no_hp: a.no_hp,
        tanggal_gabung: a.tanggal_gabung,
        tanggal_keluar: a.tanggal_keluar || "-",
        status: a.status,
      });
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=data-anggota.xlsx");
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal mengekspor Excel." });
  }
};

// Export PDF — tambah kolom Jenis Kelamin
exports.exportPdf = async (req, res) => {
  try {
    const where = buildFilter(req.query);
    const data = await Anggota.findAll({ where, order: [["nama", "ASC"]] });

    const doc = new PDFDocument({ margin: 30, size: "A4", layout: "landscape" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=data-anggota.pdf");
    doc.pipe(res);

    doc.fontSize(14).text("Data Anggota Koperasi Mitra Husada Sejahtera", { align: "center" });
    doc.moveDown(1);

    const headers = ["No. Anggota", "Nama", "JK", "Desa", "Kecamatan", "No. HP", "Gabung", "Keluar", "Status"];
    const colWidths = [75, 100, 25, 80, 80, 70, 65, 65, 55];
    let y = doc.y;
    const startX = 30;

    doc.fontSize(9).font("Helvetica-Bold");
    let x = startX;
    headers.forEach((h, i) => {
      doc.text(h, x, y, { width: colWidths[i] });
      x += colWidths[i];
    });

    doc.moveDown(0.5);
    doc.font("Helvetica");
    y = doc.y;

    data.forEach((a) => {
      x = startX;
      const row = [
        a.no_anggota, a.nama, a.jenis_kelamin, a.desa || "-", a.kecamatan || "-",
        a.no_hp || "-", a.tanggal_gabung, a.tanggal_keluar || "-", a.status,
      ];
      row.forEach((val, i) => {
        doc.text(String(val), x, y, { width: colWidths[i] });
        x += colWidths[i];
      });
      y += 18;
      if (y > 500) {
        doc.addPage({ layout: "landscape" });
        y = 30;
      }
    });

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal mengekspor PDF." });
  }
};

// ─── CETAK KARTU ANGGOTA (VERSI RAPI) ─────────────────────
exports.cetakKartu = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findByPk(userId, {
      include: [{ model: Anggota, as: 'anggota' }]
    });

    if (!user || !user.anggota) {
      return res.status(404).json({ message: 'Anggota tidak ditemukan' });
    }

    const anggota = user.anggota;
    const pengaturan = await PengaturanWebsite.findOne();

    // ── QR Code ──
    const qrData = JSON.stringify({
      no_anggota: anggota.no_anggota,
      nama: anggota.nama
    });
    const qrBuffer = await QRCode.toBuffer(qrData, {
      width: 120,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' }
    });

    // ── PDF ──
    const doc = new PDFDocument({
      size: [380, 240], // ukuran kartu
      margin: 12
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="kartu-anggota-${anggota.no_anggota}.pdf"`);
    doc.pipe(res);

    // ── Background ──
    doc.rect(0, 0, 380, 240).fill('#f8fafc');

    // ── Border ──
    doc.rect(5, 5, 370, 230).stroke('#e2e8f0');

    // ── Logo ──
    const logoPath = pengaturan?.logo_koperasi
      ? path.join(__dirname, '..', '..', 'public', 'uploads', 'pengaturan', pengaturan.logo_koperasi)
      : null;

    let logoWidth = 0;
    if (logoPath && fs.existsSync(logoPath)) {
      try {
        doc.image(logoPath, 15, 12, { width: 45, height: 45 });
        logoWidth = 45;
      } catch (err) {
        // ignore
      }
    }

    // ── Header (Nama Koperasi) ──
    const namaKoperasi = pengaturan?.nama_koperasi || 'KOPERASI';
    const startHeaderX = logoWidth > 0 ? 70 : 15;
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e293b');
    if (logoWidth > 0) {
      doc.text(namaKoperasi, startHeaderX, 14, { width: 230, align: 'left' });
    } else {
      doc.text(namaKoperasi, startHeaderX, 14, { width: 350, align: 'center' });
    }

    doc.fontSize(8).font('Helvetica').fillColor('#64748b');
    if (logoWidth > 0) {
      doc.text('Kartu Anggota', startHeaderX, 28, { width: 230, align: 'left' });
    } else {
      doc.text('Kartu Anggota', startHeaderX, 28, { width: 350, align: 'center' });
    }

    // ── Garis pemisah ──
    const lineY = 52;
    doc.moveTo(15, lineY).lineTo(365, lineY).stroke('#cbd5e1');

    // ── Foto ──
    const fotoPath = anggota.foto
      ? path.join(__dirname, '..', '..', 'public', 'uploads', 'anggota', anggota.foto)
      : null;

    let fotoWidth = 70;
    let fotoHeight = 85;
    if (fotoPath && fs.existsSync(fotoPath)) {
      try {
        doc.image(fotoPath, 18, 60, { width: fotoWidth, height: fotoHeight, fit: [fotoWidth, fotoHeight] });
      } catch (err) {
        // fallback
        doc.rect(18, 60, fotoWidth, fotoHeight).fill('#e2e8f0');
        doc.fontSize(9).fillColor('#94a3b8').text('Foto', 32, 95, { width: 42, align: 'center' });
      }
    } else {
      doc.rect(18, 60, fotoWidth, fotoHeight).fill('#e2e8f0');
      doc.fontSize(9).fillColor('#94a3b8').text('Foto', 32, 95, { width: 42, align: 'center' });
    }

    // ── Data Anggota ──
    const dataStartX = 100;
    let dataY = 62;
    const lineHeight = 17;
    const labelWidth = 80;
    const valueStartX = dataStartX + labelWidth;

    const fields = [
      { label: 'Nama', value: anggota.nama || '-' },
      { label: 'No. Anggota', value: anggota.no_anggota || '-' },
      { label: 'Jenis Kelamin', value: anggota.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan' },
      { label: 'No. HP', value: anggota.no_hp || '-' },
    ];

    doc.fontSize(9);
    fields.forEach((field) => {
      // Label
      doc.font('Helvetica-Bold').fillColor('#334155');
      doc.text(field.label + ':', dataStartX, dataY, { width: labelWidth - 5, align: 'right' });

      // Value
      doc.font('Helvetica').fillColor('#0f172a');
      doc.text(field.value, valueStartX, dataY, { width: 200, align: 'left' });

      dataY += lineHeight;
    });

    // ── Alamat (khusus, wrap jika panjang) ──
    const alamat = `${anggota.alamat || ''}, ${anggota.desa || ''}, Kec. ${anggota.kecamatan || ''}`.replace(/, , /g, ', ').replace(/^, /, '');
    const alamatY = dataY + 2;
    doc.font('Helvetica-Bold').fillColor('#334155');
    doc.text('Alamat:', dataStartX, alamatY, { width: labelWidth - 5, align: 'right' });

    doc.font('Helvetica').fillColor('#0f172a');
    doc.text(alamat || '-', valueStartX, alamatY, { width: 190, align: 'left', lineGap: 2 });

    // hitung tinggi alamat yang terpakai (kira-kira)
    const alamatLines = Math.ceil(doc.widthOfString(alamat, { width: 190 }) / 190) || 1;
    const alamatHeight = alamatLines * 13;

    // ── QR Code ──
    const qrX = 310;
    const qrY = 60;
    doc.image(qrBuffer, qrX, qrY, { width: 60, height: 60 });

    // ── Footer (garis + teks) ──
    const footerY = Math.max(195, 60 + fotoHeight + 10, 60 + alamatHeight + 10);
    const footerYPos = Math.min(footerY, 210);

    doc.moveTo(15, footerYPos).lineTo(365, footerYPos).stroke('#cbd5e1');

    doc.fontSize(7).font('Helvetica').fillColor('#94a3b8');
    const dateStr = new Date().toLocaleString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    doc.text(`Dicetak: ${dateStr} | Kartu berlaku selama menjadi anggota aktif.`, 15, footerYPos + 6, {
      width: 350,
      align: 'center'
    });

    doc.end();
  } catch (error) {
    console.error('❌ Error cetak kartu:', error);
    return res.status(500).json({ message: 'Gagal mencetak kartu anggota', error: error.message });
  }
};