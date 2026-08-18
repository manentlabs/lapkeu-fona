// controllers/PendapatanController.js

const Anggota = require("../models/Anggota");
const Transaksi = require("../models/Transaksi");
const JenisPendapatan = require("../models/JenisPendapatan");
const Akun = require("../models/Akun");
const sequelize = require("../config/database");
const { QueryTypes } = require("sequelize");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");

// ============================================================
// HELPER (sama)
// ============================================================
function formatRupiah(value) {
  const num = parseFloat(value) || 0;
  return num.toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatTanggal(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
}

// ============================================================
// CONTROLLER
// ============================================================
class PendapatanController {
  // ----------------------------------------------------------
  // GET JENIS PENDAPATAN
  // ----------------------------------------------------------
  async getJenisPendapatan() {
    return await JenisPendapatan.findAll({
      where: { is_active: true },
      include: [
        {
          model: Akun,
          as: "akun",
          attributes: ["id", "kode_akun", "nama_akun"],
        },
      ],
      order: [["urutan", "ASC"], ["id", "ASC"]],
      attributes: ["id", "kode", "nama", "kolom_key", "akun_id", "urutan"],
      raw: true,
      nest: true,
    });
  }

  // ----------------------------------------------------------
  // BUILD PIVOT QUERY (Pendapatan = total Kredit)
  // ----------------------------------------------------------
  async buildPivotQuery(
    jenisList,
    tanggal_dari,
    tanggal_sampai,
    whereAnggota = "",
    filterJenisId = null
  ) {
    let filteredJenis = jenisList;
    if (filterJenisId) {
      filteredJenis = jenisList.filter((j) => Number(j.id) === Number(filterJenisId));
    }
    if (filteredJenis.length === 0) return null;

    const akunIds = filteredJenis.map((j) => Number(j.akun_id)).filter(Boolean);
    if (akunIds.length === 0) return null;
    const uniqueAkunIds = [...new Set(akunIds)];

    const jenisIds = filteredJenis.map((j) => Number(j.id));

    const pivotSelects = filteredJenis
      .map((jenis) => {
        const akunId = Number(jenis.akun_id);
        if (!akunId) return "";
        return `
          SUM(
            CASE
              WHEN jenis_id = ${jenis.id}
              THEN total_akhir
              ELSE 0
            END
          ) AS \`${jenis.kolom_key}\`
        `;
      })
      .filter(Boolean)
      .join(",");

    if (!pivotSelects) return null;

    const params = {};
    if (tanggal_dari) params.tanggal_dari = tanggal_dari;
    if (tanggal_sampai) params.tanggal_sampai = tanggal_sampai;

    // Pendapatan hanya dari transaksi kredit ke akun pendapatan
    let transaksiKreditSub = `
      SELECT
        t.anggota_id,
        t.akun_kredit_id AS akun_id,
        t.jenis_pendapatan_id,
        SUM(t.jumlah) AS total_kredit
      FROM transaksi t
      WHERE t.anggota_id IS NOT NULL
        AND t.akun_kredit_id IN (${uniqueAkunIds.join(",")})
    `;
    if (tanggal_dari) transaksiKreditSub += ` AND t.tanggal >= :tanggal_dari`;
    if (tanggal_sampai) transaksiKreditSub += ` AND t.tanggal <= :tanggal_sampai`;
    transaksiKreditSub += `
      GROUP BY t.anggota_id, t.akun_kredit_id, t.jenis_pendapatan_id
    `;

    // Pemetaan Jenis Pendapatan -> Akun
    const jenisAkunSub = `
      SELECT
        jp.id AS jenis_id,
        jp.kolom_key,
        jp.akun_id,
        COUNT(*) OVER (PARTITION BY jp.akun_id) AS akun_share_count
      FROM jenis_pendapatan jp
      WHERE jp.is_active = 1
        AND jp.id IN (${jenisIds.join(",")})
        AND jp.akun_id IS NOT NULL
    `;

    // Query Utama: total pendapatan = total kredit
    const query = `
      WITH
      transaksi_kredit AS ( ${transaksiKreditSub} ),
      jenis_akun AS ( ${jenisAkunSub} ),
      combined AS (
        SELECT
          a.id,
          a.no_anggota,
          a.nama,
          ja.jenis_id,
          ja.kolom_key,
          ja.akun_id,
          COALESCE(tk.total_kredit, 0) AS total_akhir
        FROM anggota a
        CROSS JOIN jenis_akun ja
        LEFT JOIN transaksi_kredit tk
          ON tk.anggota_id = a.id
          AND tk.akun_id = ja.akun_id
          AND (
            tk.jenis_pendapatan_id = ja.jenis_id
            OR (tk.jenis_pendapatan_id IS NULL AND ja.akun_share_count = 1)
          )
        WHERE 1=1 ${whereAnggota}
      )
      SELECT
        id,
        no_anggota,
        nama,
        ${pivotSelects},
        SUM(total_akhir) AS total_pendapatan
      FROM combined
      GROUP BY id, no_anggota, nama
      HAVING SUM(total_akhir) <> 0
      ORDER BY no_anggota ASC
    `;

    return { query, params };
  }

  // ----------------------------------------------------------
  // INDEX
  // ----------------------------------------------------------
  async index(req, res) {
    try {
      const {
        page = 1,
        per_page = 10,
        nama_anggota,
        no_anggota,
        tanggal_dari,
        tanggal_sampai,
        search,
        jenis_pendapatan_id,
      } = req.query;

      const jenisList = await this.getJenisPendapatan();
      if (jenisList.length === 0) {
        return res.json({
          data: [],
          pagination: { page: 1, per_page: Number(per_page) || 10, total: 0, total_pages: 0 },
          summary: { saldo: {}, totalPendapatan: 0, jumlahAnggota: 0 },
          jenisPendapatan: [],
          filters: { daftarAnggota: [], daftarNoAnggota: [] },
          filterActive: {
            nama_anggota: nama_anggota || "",
            no_anggota: no_anggota || "",
            tanggal_dari: tanggal_dari || "",
            tanggal_sampai: tanggal_sampai || "",
            search: search || "",
            jenis_pendapatan_id: jenis_pendapatan_id || "",
          },
          message: "Belum ada jenis pendapatan yang dikonfigurasi.",
        });
      }

      let whereAnggota = "";
      const params = {};
      if (nama_anggota) {
        whereAnggota += ` AND a.nama LIKE :nama_anggota`;
        params.nama_anggota = `%${nama_anggota}%`;
      }
      if (no_anggota) {
        whereAnggota += ` AND a.no_anggota LIKE :no_anggota`;
        params.no_anggota = `%${no_anggota}%`;
      }
      if (search) {
        whereAnggota += ` AND (a.nama LIKE :search OR a.no_anggota LIKE :search)`;
        params.search = `%${search}%`;
      }

      const result = await this.buildPivotQuery(
        jenisList,
        tanggal_dari,
        tanggal_sampai,
        whereAnggota,
        jenis_pendapatan_id
      );
      if (!result) {
        return res.json({
          data: [],
          pagination: { page: 1, per_page: Number(per_page) || 10, total: 0, total_pages: 0 },
          summary: { saldo: {}, totalPendapatan: 0, jumlahAnggota: 0 },
          jenisPendapatan: jenisList,
          filters: { daftarAnggota: [], daftarNoAnggota: [] },
          message: "Jenis pendapatan belum memiliki akun.",
        });
      }

      const { query, params: queryParams } = result;
      const allData = await sequelize.query(query, {
        replacements: { ...params, ...queryParams },
        type: QueryTypes.SELECT,
      });

      const total = allData.length;
      const currentPage = Number(page) || 1;
      const perPage = Number(per_page) || 10;
      const start = (currentPage - 1) * perPage;
      const end = start + perPage;
      const paginatedData = allData.slice(start, end);

      const filteredJenis = jenis_pendapatan_id
        ? jenisList.filter((j) => Number(j.id) === Number(jenis_pendapatan_id))
        : jenisList;

      const saldo = {};
      filteredJenis.forEach((jenis) => {
        saldo[jenis.kolom_key] = allData.reduce(
          (sum, item) => sum + (parseFloat(item[jenis.kolom_key]) || 0),
          0
        );
      });
      const totalPendapatan = allData.reduce((sum, item) => sum + (parseFloat(item.total_pendapatan) || 0), 0);
      const jumlahAnggota = allData.length;

      const daftarAnggota = await Anggota.findAll({
        attributes: ["nama"],
        order: [["nama", "ASC"]],
        group: ["nama"],
        raw: true,
      });
      const daftarNoAnggota = await Anggota.findAll({
        attributes: ["no_anggota"],
        order: [["no_anggota", "ASC"]],
        group: ["no_anggota"],
        raw: true,
      });

      return res.json({
        data: paginatedData,
        pagination: {
          page: currentPage,
          per_page: perPage,
          total,
          total_pages: Math.ceil(total / perPage),
        },
        summary: {
          saldo,
          totalPendapatan,
          jumlahAnggota,
          detail: filteredJenis.map((jenis) => ({
            id: jenis.id,
            nama: jenis.nama,
            kolom_key: jenis.kolom_key,
            akun_id: jenis.akun_id,
            total: saldo[jenis.kolom_key] || 0,
          })),
        },
        jenisPendapatan: jenisList.map((jenis) => ({
          id: jenis.id,
          kode: jenis.kode,
          nama: jenis.nama,
          kolom_key: jenis.kolom_key,
          akun_id: jenis.akun_id,
          akun: jenis.akun,
        })),
        filters: {
          daftarAnggota: daftarAnggota.map((a) => a.nama).filter(Boolean),
          daftarNoAnggota: daftarNoAnggota.map((a) => a.no_anggota).filter(Boolean),
        },
        filterActive: {
          nama_anggota: nama_anggota || "",
          no_anggota: no_anggota || "",
          tanggal_dari: tanggal_dari || "",
          tanggal_sampai: tanggal_sampai || "",
          search: search || "",
          jenis_pendapatan_id: jenis_pendapatan_id || "",
        },
      });
    } catch (error) {
      console.error("ERROR PENDAPATAN:", error);
      return res.status(500).json({ message: "Gagal mengambil data pendapatan", error: error.message });
    }
  }

  // ----------------------------------------------------------
  // EXPORT
  // ----------------------------------------------------------
  async export(req, res) {
    try {
      const {
        export: exportType,
        nama_anggota,
        no_anggota,
        tanggal_dari,
        tanggal_sampai,
        search,
        jenis_pendapatan_id,
      } = req.query;

      const jenisList = await this.getJenisPendapatan();
      if (jenisList.length === 0) {
        return res.status(422).json({ message: "Belum ada jenis pendapatan yang dikonfigurasi." });
      }

      let whereAnggota = "";
      const params = {};
      if (nama_anggota) {
        whereAnggota += ` AND a.nama LIKE :nama_anggota`;
        params.nama_anggota = `%${nama_anggota}%`;
      }
      if (no_anggota) {
        whereAnggota += ` AND a.no_anggota LIKE :no_anggota`;
        params.no_anggota = `%${no_anggota}%`;
      }
      if (search) {
        whereAnggota += ` AND (a.nama LIKE :search OR a.no_anggota LIKE :search)`;
        params.search = `%${search}%`;
      }

      const result = await this.buildPivotQuery(
        jenisList,
        tanggal_dari,
        tanggal_sampai,
        whereAnggota,
        jenis_pendapatan_id
      );
      if (!result) {
        return res.status(422).json({ message: "Jenis pendapatan belum memiliki akun." });
      }

      const { query, params: queryParams } = result;
      const data = await sequelize.query(query, {
        replacements: { ...params, ...queryParams },
        type: QueryTypes.SELECT,
      });

      const filteredJenis = jenis_pendapatan_id
        ? jenisList.filter((j) => Number(j.id) === Number(jenis_pendapatan_id))
        : jenisList;

      const kolomKeys = filteredJenis.map((j) => j.kolom_key);
      const labels = filteredJenis.map((j) => j.nama);

      const totals = {};
      kolomKeys.forEach((key) => {
        totals[key] = data.reduce((sum, item) => sum + (parseFloat(item[key]) || 0), 0);
      });
      const totalAkhir = data.reduce((sum, item) => sum + (parseFloat(item.total_pendapatan) || 0), 0);

      if (exportType === "excel") {
        return this.exportExcel(res, data, kolomKeys, labels, totals, totalAkhir, "Pendapatan");
      }
      if (exportType === "pdf") {
        return this.exportPdf(res, data, kolomKeys, labels, totals, totalAkhir, "Pendapatan");
      }
      return res.status(400).json({ message: "Format export tidak didukung." });
    } catch (error) {
      console.error("ERROR EXPORT PENDAPATAN:", error);
      return res.status(500).json({ message: "Gagal mengekspor data pendapatan", error: error.message });
    }
  }

  // ----------------------------------------------------------
  // EXPORT EXCEL
  // ----------------------------------------------------------
  async exportExcel(res, data, kolomKeys, labels, totals, totalAkhir, title = "Pendapatan") {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(`Rekap ${title}`);
    const totalColumns = 3 + kolomKeys.length;

    sheet.mergeCells(1, 1, 1, totalColumns);
    sheet.getCell("A1").value = `REKAP ${title.toUpperCase()} ANGGOTA`;
    sheet.getCell("A1").font = { size: 16, bold: true };
    sheet.getCell("A1").alignment = { horizontal: "center" };

    sheet.mergeCells(2, 1, 2, totalColumns);
    sheet.getCell("A2").value = `Tanggal Cetak: ${formatTanggal(new Date())}`;
    sheet.getCell("A2").alignment = { horizontal: "center" };

    const headers = ["No Anggota", "Nama Anggota", ...labels, "Total"];
    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.alignment = { horizontal: "center" };

    data.forEach((item) => {
      const row = [item.no_anggota, item.nama];
      kolomKeys.forEach((key) => row.push(parseFloat(item[key]) || 0));
      row.push(parseFloat(item.total_pendapatan) || 0);
      sheet.addRow(row);
    });

    const totalRow = ["TOTAL", ""];
    kolomKeys.forEach((key) => totalRow.push(totals[key] || 0));
    totalRow.push(totalAkhir);
    const totalExcelRow = sheet.addRow(totalRow);
    totalExcelRow.font = { bold: true };

    for (let i = 3; i <= headers.length; i++) {
      sheet.getColumn(i).numFmt = "#,##0";
      sheet.getColumn(i).alignment = { horizontal: "right" };
      sheet.getColumn(i).width = 18;
    }
    sheet.getColumn(1).width = 18;
    sheet.getColumn(2).width = 30;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=rekap-${title.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.xlsx`
    );
    await workbook.xlsx.write(res);
    res.end();
  }

  // ----------------------------------------------------------
  // EXPORT PDF
  // ----------------------------------------------------------
  async exportPdf(res, data, kolomKeys, labels, totals, totalAkhir, title = "Pendapatan") {
    const doc = new PDFDocument({ margin: 30, size: "A4", layout: "landscape" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=rekap-${title.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`
    );
    doc.pipe(res);

    doc.fontSize(14).font("Helvetica-Bold").text(`REKAP ${title.toUpperCase()} ANGGOTA`, { align: "center" });
    doc.fontSize(10).font("Helvetica").text(`Tanggal Cetak: ${formatTanggal(new Date())}`, { align: "center" });
    doc.moveDown(1);

    const startX = 30;
    const headers = ["No Anggota", "Nama", ...labels, "Total"];
    const colWidths = [70, 110, ...labels.map(() => 75), 80];
    const totalWidth = colWidths.reduce((a, b) => a + b, 0);

    const drawHeader = (y) => {
      doc.rect(startX, y, totalWidth, 20).fill("#6c757d");
      doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(7);
      let x = startX;
      headers.forEach((header, i) => {
        const align = i < 2 ? "left" : "right";
        doc.text(header, x + 4, y + 5, { width: colWidths[i] - 8, align });
        x += colWidths[i];
      });
      doc.fillColor("#000000").font("Helvetica");
      return y + 20;
    };

    let rowY = drawHeader(doc.y);
    const pageBottom = 550;

    const drawRow = (cells, bold = false) => {
      if (rowY + 16 > pageBottom) {
        doc.addPage({ layout: "landscape" });
        rowY = drawHeader(30);
      }
      if (bold) {
        doc.rect(startX, rowY, totalWidth, 16).fill("#dee2e6");
        doc.fillColor("#000000").font("Helvetica-Bold").fontSize(7);
      } else {
        doc.rect(startX, rowY, totalWidth, 14).stroke();
        doc.fillColor("#000000").font("Helvetica").fontSize(6.5);
      }
      let x = startX;
      cells.forEach((cell, i) => {
        const align = i < 2 ? "left" : "right";
        doc.text(String(cell ?? ""), x + 4, rowY + 3, { width: colWidths[i] - 8, align });
        x += colWidths[i];
      });
      rowY += bold ? 16 : 14;
    };

    data.forEach((item) => {
      const row = [item.no_anggota, item.nama];
      kolomKeys.forEach((key) => row.push(formatRupiah(item[key] || 0)));
      row.push(formatRupiah(item.total_pendapatan || 0));
      drawRow(row);
    });

    const totalRow = ["TOTAL", ""];
    kolomKeys.forEach((key) => totalRow.push(formatRupiah(totals[key] || 0)));
    totalRow.push(formatRupiah(totalAkhir));
    drawRow(totalRow, true);

    doc.end();
  }
}

module.exports = new PendapatanController();