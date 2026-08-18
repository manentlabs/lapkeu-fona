const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const Akun = require("../models/Akun");
const PengaturanWebsite = require("../models/PengaturanWebsite");
const { Op } = require("sequelize");

// ─── Helper: hitung saldo parent secara bottom-up ─────────────
function hitungSaldoParent(akuns) {
  const map = {};
  akuns.forEach((a) => { map[a.id] = a; });

  const children = {};
  akuns.forEach((a) => {
    if (a.parent_id) {
      if (!children[a.parent_id]) children[a.parent_id] = [];
      children[a.parent_id].push(a);
    }
  });

  const visited = new Set();

  function dfs(node) {
    if (visited.has(node.id)) return;
    visited.add(node.id);

    let total = 0;
    if (children[node.id] && children[node.id].length > 0) {
      for (const child of children[node.id]) {
        if (!visited.has(child.id)) {
          dfs(child);
        }
        total += parseFloat(child.saldo_awal) || 0;
      }
      node.saldo_awal = total;
    }
  }

  const roots = akuns.filter((a) => !a.parent_id);
  for (const root of roots) {
    if (!visited.has(root.id)) {
      dfs(root);
    }
  }
  for (const a of akuns) {
    if (!visited.has(a.id)) {
      dfs(a);
    }
  }

  return akuns;
}

// ─── Index ─────────────────────────────────────────────────────
exports.index = async (req, res) => {
  try {
    const { tipe_akun, search, page = 1, per_page = 10 } = req.query;

    let where = { is_active: 1 };
    if (tipe_akun) where.tipe_akun = tipe_akun;

    let akuns = await Akun.findAll({
      where,
      order: [["kode_akun", "ASC"]],
    });

    if (search) {
      const q = search.toLowerCase();
      akuns = akuns.filter(
        (a) =>
          a.kode_akun.toLowerCase().includes(q) ||
          a.nama_akun.toLowerCase().includes(q)
      );
    }

    akuns = hitungSaldoParent(akuns);

    const parentIds = Object.keys(
      akuns.reduce((acc, a) => {
        if (a.parent_id) acc[a.parent_id] = true;
        return acc;
      }, {})
    ).map(Number);

    const leafAkuns = akuns.filter((a) => !parentIds.includes(a.id));

    const totalAset = leafAkuns
      .filter((a) => a.tipe_akun === "aset")
      .reduce((s, a) => s + (parseFloat(a.saldo_awal) || 0), 0);

    const totalBeban = leafAkuns
      .filter((a) => a.tipe_akun === "beban")
      .reduce((s, a) => s + (parseFloat(a.saldo_awal) || 0), 0);

    const totalKewajiban = leafAkuns
      .filter((a) => a.tipe_akun === "kewajiban")
      .reduce((s, a) => s + (parseFloat(a.saldo_awal) || 0), 0);

    const totalModal = leafAkuns
      .filter((a) => a.tipe_akun === "modal")
      .reduce((s, a) => s + (parseFloat(a.saldo_awal) || 0), 0);

    const totalPendapatan = leafAkuns
      .filter((a) => a.tipe_akun === "pendapatan")
      .reduce((s, a) => s + (parseFloat(a.saldo_awal) || 0), 0);

    const totalKeseluruhan =
      totalAset + totalBeban - totalKewajiban - totalModal - totalPendapatan;

    const totalPajak = leafAkuns.reduce(
      (s, a) => s + (parseFloat(a.pajak) || 0),
      0
    );

    const totalAkunBerSaldo = leafAkuns.filter(
      (a) => (parseFloat(a.saldo_awal) || 0) !== 0
    ).length;

    const start = (parseInt(page) - 1) * parseInt(per_page);
    const end = start + parseInt(per_page);
    const paginated = akuns.slice(start, end);
    const totalData = akuns.length;

    return res.json({
      data: paginated,
      parentIds: parentIds,
      totalAset,
      totalBeban,
      totalKewajiban,
      totalModal,
      totalPendapatan,
      totalKeseluruhan,
      totalPajak,
      totalAkunBerSaldo,
      pagination: {
        page: parseInt(page),
        per_page: parseInt(per_page),
        total: totalData,
        total_pages: Math.ceil(totalData / per_page),
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Gagal mengambil data saldo awal." });
  }
};

// ─── Show ──────────────────────────────────────────────────────
exports.show = async (req, res) => {
  try {
    const akun = await Akun.findByPk(req.params.id);
    if (!akun) return res.status(404).json({ message: "Akun tidak ditemukan." });
    return res.json({ data: akun });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Gagal mengambil detail akun." });
  }
};

// ─── Update ────────────────────────────────────────────────────
exports.update = async (req, res) => {
  try {
    const akun = await Akun.findByPk(req.params.id);
    if (!akun) return res.status(404).json({ message: "Akun tidak ditemukan." });

    const { saldo_awal, pajak } = req.body;
    await akun.update({
      saldo_awal: saldo_awal !== undefined ? saldo_awal : akun.saldo_awal,
      pajak: pajak !== undefined ? pajak : akun.pajak,
    });

    return res.json({ message: "Saldo awal berhasil diperbarui.", data: akun });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Gagal memperbarui saldo awal." });
  }
};

// ─── Destroy (Reset) ──────────────────────────────────────────
exports.destroy = async (req, res) => {
  try {
    const akun = await Akun.findByPk(req.params.id);
    if (!akun) return res.status(404).json({ message: "Akun tidak ditemukan." });

    await akun.update({ saldo_awal: 0, pajak: 0 });
    return res.json({ message: "Saldo awal berhasil direset ke 0." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Gagal mereset saldo awal." });
  }
};

// ─── Export (CSV) ─────────────────────────────────────────────
exports.export = async (req, res) => {
  try {
    const { tipe_akun } = req.query;
    let where = { is_active: 1 };
    if (tipe_akun) where.tipe_akun = tipe_akun;

    let akuns = await Akun.findAll({
      where,
      order: [["kode_akun", "ASC"]],
    });
    akuns = hitungSaldoParent(akuns);
    return res.json({ data: akuns });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Gagal mengekspor data." });
  }
};

// ─── Export PDF ───────────────────────────────────────────────
exports.exportPdf = async (req, res) => {
  try {
    const { tipe_akun, search } = req.query;

    let where = { is_active: 1 };
    if (tipe_akun) where.tipe_akun = tipe_akun;

    let akuns = await Akun.findAll({
      where,
      order: [["kode_akun", "ASC"]],
    });

    if (search) {
      const q = search.toLowerCase();
      akuns = akuns.filter(
        (a) =>
          a.kode_akun.toLowerCase().includes(q) ||
          a.nama_akun.toLowerCase().includes(q)
      );
    }

    akuns = hitungSaldoParent(akuns);

    // Ambil pengaturan untuk kop surat
    const pengaturan = await PengaturanWebsite.findOne();

    // Buat PDF
    const doc = new PDFDocument({
      margin: 40,
      size: "A4",
      layout: "portrait",
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=saldo-awal-${new Date().toISOString().slice(0, 10)}.pdf`
    );
    doc.pipe(res);

    // Helper format akuntansi
    function fmtAkuntansi(nilai) {
      const n = parseFloat(nilai) || 0;
      if (n < 0) {
        return "(" + Math.abs(n).toLocaleString("id-ID") + ")";
      }
      return n.toLocaleString("id-ID");
    }

    // ─── KOP SURAT ────────────────────────────────────────────
    const startX = 40;
    let currentY = 40;

    // Logo
    const logoPath = pengaturan?.logo_koperasi
      ? path.join(
          __dirname,
          "..",
          "..",
          "public",
          "uploads",
          "pengaturan",
          pengaturan.logo_koperasi
        )
      : null;

    if (logoPath && fs.existsSync(logoPath)) {
      doc.image(logoPath, startX, currentY, { width: 60, height: 60 });
    }

    // Nama koperasi
    const namaKoperasi = pengaturan?.nama_koperasi || "KOPERASI";
    doc.fontSize(14)
      .font("Helvetica-Bold")
      .text(namaKoperasi, startX + 70, currentY + 5, {
        width: 420,
        align: "center",
      });

    // Info koperasi
    doc.fontSize(8).font("Helvetica");
    const infoY = currentY + 25;
    const infoLines = [
      `Nomor : ${pengaturan?.no_badan_hukum || "-"}`,
      `Tanggal : ${pengaturan?.tgl_badan_hukum || "-"}`,
      pengaturan?.alamat_koperasi || "Alamat Belum Diatur",
    ];
    infoLines.forEach((line, i) => {
      doc.text(line, startX + 70, infoY + i * 12, {
        width: 420,
        align: "center",
      });
    });

    // Atur posisi setelah kop
    const kopEndY = infoY + 36; // 3 baris info + spasi

    // ─── GARIS KOP (di bawah info, sebelum judul) ─────────────
    const lineY = kopEndY + 5;
    doc.moveTo(startX, lineY)
      .lineTo(startX + 510, lineY)
      .lineWidth(3)
      .stroke("#000");

    const lineY2 = lineY + 2;
    doc.moveTo(startX, lineY2)
      .lineTo(startX + 510, lineY2)
      .lineWidth(1)
      .stroke("#000");

    // ─── JUDUL (di bawah garis kop) ────────────────────────────
    const titleY = lineY2 + 15;
    doc.fontSize(11)
      .font("Helvetica-Bold")
      .text("DAFTAR SALDO AWAL AKUN", startX, titleY, {
        width: 510,
        align: "center",
      });

    // Filter subtitle
    doc.fontSize(9).font("Helvetica");
    let filterText = "";
    if (tipe_akun) {
      filterText = `Filter: Jenis Akun = ${tipe_akun.toUpperCase()}`;
    }
    if (search) {
      filterText += filterText ? `, Cari: "${search}"` : `Cari: "${search}"`;
    }
    if (filterText) {
      const filterY = doc.y + 4;
      doc.text(filterText, startX, filterY, {
        width: 510,
        align: "center",
      });
    }

    // ─── TABEL ──────────────────────────────────────────────────
    let tableTopY = doc.y + 12;
    const colWidths = [30, 65, 175, 70, 100, 70];
    const headers = ["No", "Kode", "Nama Akun", "Tipe", "Saldo Awal (Rp)", "Pajak"];

    // Fungsi untuk menggambar header di posisi y tertentu
    function drawHeader(y) {
      // Header baris 1
      doc.rect(startX, y, 510, 18)
        .fill("#6c757d");
      doc.fillColor("#fff")
        .font("Helvetica-Bold")
        .fontSize(8);

      let x = startX;
      headers.forEach((h, i) => {
        const align = i === 4 || i === 5 ? "right" : (i === 0 ? "center" : "left");
        doc.text(h, x + 4, y + 4, {
          width: colWidths[i] - 8,
          align: align,
        });
        x += colWidths[i];
      });

      // Header baris 2 (nomor kolom)
      const y2 = y + 18;
      doc.rect(startX, y2, 510, 16)
        .fill("#dee2e6");
      doc.fillColor("#000")
        .font("Helvetica-Bold")
        .fontSize(7);

      const colNumbers = ["1", "2", "3", "4", "5", "6"];
      x = startX;
      colNumbers.forEach((num, i) => {
        const align = i === 4 || i === 5 ? "right" : (i === 0 ? "center" : "left");
        doc.text(num, x + 4, y2 + 4, {
          width: colWidths[i] - 8,
          align: align,
        });
        x += colWidths[i];
      });

      return y2 + 16; // return y untuk row data
    }

    let rowY = drawHeader(tableTopY);

    // ─── DATA ROWS ──────────────────────────────────────────────
    doc.fillColor("#000")
      .font("Helvetica")
      .fontSize(8);

    const totalData = akuns.length;
    let rowCount = 0;

    for (const akun of akuns) {
      rowCount++;
      const saldo = parseFloat(akun.saldo_awal) || 0;
      const isNegatif = saldo < 0;
      const pajak = parseFloat(akun.pajak) || 0;

      // Jika halaman penuh, buat halaman baru
      if (rowY + 18 > 760) {
        doc.addPage();
        rowY = 40;
        rowY = drawHeader(rowY);
      }

      // Border row
      doc.rect(startX, rowY, 510, 17)
        .stroke();

      const rowData = [
        rowCount.toString(),
        akun.kode_akun,
        akun.nama_akun,
        (akun.tipe_akun || "").toUpperCase(),
        fmtAkuntansi(saldo),
        pajak > 0 ? pajak.toLocaleString("id-ID") + "%" : "0%",
      ];

      let x = startX;
      rowData.forEach((text, i) => {
        const align = i === 4 || i === 5 ? "right" : (i === 0 ? "center" : "left");
        const color = i === 4 && isNegatif ? "#c0392b" : "#000";
        doc.fillColor(color).text(text, x + 4, rowY + 3, {
          width: colWidths[i] - 8,
          align: align,
        });
        x += colWidths[i];
      });

      rowY += 17;
    }

    // ─── TOTAL ──────────────────────────────────────────────────
    if (totalData > 0) {
      const parentIds = Object.keys(
        akuns.reduce((acc, a) => {
          if (a.parent_id) acc[a.parent_id] = true;
          return acc;
        }, {})
      ).map(Number);

      const leafAkuns = akuns.filter((a) => !parentIds.includes(a.id));
      const totalSaldoAwal = leafAkuns.reduce(
        (sum, a) => sum + (parseFloat(a.saldo_awal) || 0),
        0
      );
      const totalPajakAll = leafAkuns.reduce(
        (sum, a) => sum + (parseFloat(a.pajak) || 0),
        0
      );
      const isTotalNegatif = totalSaldoAwal < 0;

      doc.rect(startX, rowY, 510, 20)
        .fill("#eeeeee");

      const totalTexts = [
        "",
        "",
        "TOTAL",
        "",
        fmtAkuntansi(totalSaldoAwal),
        totalPajakAll.toLocaleString("id-ID") + "%",
      ];

      doc.fillColor(isTotalNegatif ? "#c0392b" : "#000")
        .font("Helvetica-Bold")
        .fontSize(8);

      let x = startX;
      totalTexts.forEach((text, i) => {
        const align = i === 4 || i === 5 ? "right" : (i === 0 ? "center" : "left");
        doc.text(text, x + 4, rowY + 4, {
          width: colWidths[i] - 8,
          align: align,
        });
        x += colWidths[i];
      });
    }

    doc.end();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Gagal mengekspor PDF." });
  }
};