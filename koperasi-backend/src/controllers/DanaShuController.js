// src/controllers/DanaShuController.js

const {
  DanaShu,
  PersentaseSHU,
  sequelize,
} = require("../models");

const { QueryTypes } = require("sequelize");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");

// ============================================================
// HELPER
// ============================================================

function formatRupiah(value) {
  const num = parseFloat(value) || 0;

  return num.toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatTanggal(dateStr) {
  if (!dateStr) return "-";

  const d = new Date(dateStr);

  if (Number.isNaN(d.getTime())) {
    return "-";
  }

  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ============================================================
// CONTROLLER
// ============================================================

class DanaShuController {
  // ==========================================================
  // 1. AMBIL MASTER PERSENTASE SHU
  // ==========================================================

  async getPersentaseSHU() {
    const rows = await PersentaseSHU.findAll({
      order: [
        ["id", "ASC"],
      ],
      raw: true,
    });

    return rows.map((item) => {
      const id =
        item.id ??
        item.persentase_shu_id;

      const keterangan =
        item.keterangan ||
        item.nama ||
        item.nama_shu ||
        `Dana SHU ${id}`;

      const persentase =
        item.persentase ??
        item.nilai ??
        item.persen ??
        0;

      return {
        id,
        persentase_shu_id: id,

        keterangan,

        persentase: Number(persentase) || 0,

        slug: slugify(keterangan),
      };
    });
  }

  // ==========================================================
  // 2. ENDPOINT MENU DANA SHU
  // ==========================================================

  async menu(req, res) {
    try {
      const data =
        await this.getPersentaseSHU();

      console.log(
        "MENU DANA SHU:",
        JSON.stringify(data, null, 2)
      );

      return res.status(200).json({
        success: true,

        data,

        // dibuat juga untuk kompatibilitas
        persentaseSHU: data,

        total: data.length,
      });
    } catch (error) {
      console.error(
        "❌ Error menu Dana SHU:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Gagal mengambil menu dana SHU",
        data: [],
        persentaseSHU: [],
        error: error.message,
      });
    }
  }

  // ==========================================================
  // 3. ENDPOINT PERSENTASE SHU
  // ==========================================================
  //
  // INI DIGUNAKAN OLEH:
  //
  // GET /bendahara/alokasi-shu/persentase
  //
  // ==========================================================

  async persentase(req, res) {
    try {
      const data =
        await this.getPersentaseSHU();

      return res.status(200).json({
        success: true,
        data,
        persentaseSHU: data,
        total: data.length,
      });
    } catch (error) {
      console.error(
        "❌ Error persentase Dana SHU:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Gagal mengambil persentase SHU",
        data: [],
        persentaseSHU: [],
        error: error.message,
      });
    }
  }

  // ==========================================================
  // 4. RESOLVE SLUG
  // ==========================================================

  async resolvePersentase(slug) {
    if (!slug) {
      const error =
        new Error(
          "Slug dana SHU wajib diisi"
        );

      error.status = 400;

      throw error;
    }

    const semuaPersentase =
      await PersentaseSHU.findAll({
        raw: true,
      });

    const item =
      semuaPersentase.find(
        (p) =>
          slugify(
            p.keterangan
          ) ===
          String(slug).toLowerCase()
      );

    if (!item) {
      const error =
        new Error(
          `Dana SHU dengan slug "${slug}" tidak ditemukan`
        );

      error.status = 404;

      throw error;
    }

    return item;
  }

  // ==========================================================
  // 5. SALDO AWAL
  // ==========================================================

  async getSaldoAwal(
    persentaseShuId,
    tanggalMulai
  ) {
    let where = `
      WHERE persentase_shu_id = :persentaseShuId
    `;

    const replacements = {
      persentaseShuId,
    };

    if (tanggalMulai) {
      where += `
        AND tanggal < :tanggalMulai
      `;

      replacements.tanggalMulai =
        tanggalMulai;
    }

    const [row] =
      await sequelize.query(
        `
        SELECT
          COALESCE(SUM(debet), 0) AS total_debet,
          COALESCE(SUM(kredit), 0) AS total_kredit
        FROM dana_shu
        ${where}
        `,
        {
          replacements,
          type: QueryTypes.SELECT,
        }
      );

    const debet =
      parseFloat(
        row?.total_debet
      ) || 0;

    const kredit =
      parseFloat(
        row?.total_kredit
      ) || 0;

    return debet - kredit;
  }

  // ==========================================================
  // 6. TRANSAKSI
  // ==========================================================

  async getTransaksi(
    persentaseShuId,
    tanggalMulai,
    tanggalSelesai,
    search = ""
  ) {
    let where = `
      WHERE ds.persentase_shu_id = :persentaseShuId
    `;

    const replacements = {
      persentaseShuId,
    };

    if (tanggalMulai) {
      where += `
        AND ds.tanggal >= :tanggalMulai
      `;

      replacements.tanggalMulai =
        tanggalMulai;
    }

    if (tanggalSelesai) {
      where += `
        AND ds.tanggal <= :tanggalSelesai
      `;

      replacements.tanggalSelesai =
        tanggalSelesai;
    }

    if (search) {
      where += `
        AND (
          ds.keterangan LIKE :search
          OR ds.catatan LIKE :search
        )
      `;

      replacements.search =
        `%${search}%`;
    }

    return await sequelize.query(
      `
      SELECT
        ds.id,
        ds.tanggal,
        ds.persentase_shu_id,
        ds.keterangan,
        ds.debet,
        ds.kredit,
        ds.saldo,
        ds.catatan
      FROM dana_shu ds

      ${where}

      ORDER BY
        ds.tanggal ASC,
        ds.id ASC
      `,
      {
        replacements,
        type: QueryTypes.SELECT,
      }
    );
  }

  // ==========================================================
  // 7. SALDO BERJALAN
  // ==========================================================

  buildTransaksiDenganSaldo(
    rows,
    saldoAwal
  ) {
    let saldoBerjalan =
      Number(saldoAwal) || 0;

    return rows.map((row) => {
      const debet =
        Number(row.debet) || 0;

      const kredit =
        Number(row.kredit) || 0;

      saldoBerjalan += debet;
      saldoBerjalan -= kredit;

      return {
        id: row.id,
        tanggal: row.tanggal,

        persentase_shu_id:
          row.persentase_shu_id,

        keterangan:
          row.keterangan,

        debet,
        kredit,

        saldo:
          saldoBerjalan,

        catatan:
          row.catatan,
      };
    });
  }

  // ==========================================================
  // 8. INDEX
  // ==========================================================

  async index(req, res) {
    try {
      const {
        dana,
        dari,
        sampai,
        search = "",
        page = 1,
        per_page = 10,
      } = req.query;

      // ======================================================
      // JIKA DANA TIDAK DIPILIH
      // ======================================================

      if (!dana) {
        const menu =
          await this.getPersentaseSHU();

        return res.status(200).json({
          success: true,

          message:
            "Silakan pilih jenis dana SHU",

          menu,

          data: [],
        });
      }

      // ======================================================
      // CARI MASTER
      // ======================================================

      const persentase =
        await this.resolvePersentase(
          dana
        );

      // ======================================================
      // TANGGAL
      // ======================================================

      const sekarang =
        new Date();

      const awalBulan =
        new Date(
          sekarang.getFullYear(),
          sekarang.getMonth(),
          1
        );

      const tanggalMulai =
        dari ||
        awalBulan
          .toISOString()
          .slice(0, 10);

      const tanggalSelesai =
        sampai ||
        sekarang
          .toISOString()
          .slice(0, 10);

      // ======================================================
      // SALDO AWAL
      // ======================================================

      const saldoAwal =
        await this.getSaldoAwal(
          persentase.id,
          tanggalMulai
        );

      // ======================================================
      // TRANSAKSI
      // ======================================================

      const rawRows =
        await this.getTransaksi(
          persentase.id,
          tanggalMulai,
          tanggalSelesai,
          search
        );

      const rows =
        this.buildTransaksiDenganSaldo(
          rawRows,
          saldoAwal
        );

      // ======================================================
      // TOTAL
      // ======================================================

      const totalDebet =
        rows.reduce(
          (sum, row) =>
            sum +
            Number(
              row.debet || 0
            ),
          0
        );

      const totalKredit =
        rows.reduce(
          (sum, row) =>
            sum +
            Number(
              row.kredit || 0
            ),
          0
        );

      const saldoAkhir =
        rows.length > 0
          ? Number(
              rows[
                rows.length - 1
              ].saldo || 0
            )
          : Number(
              saldoAwal || 0
            );

      const totalTransaksi =
        rows.length;

      // ======================================================
      // PAGINATION
      // ======================================================

      const currentPage =
        Math.max(
          Number(page) || 1,
          1
        );

      const perPage =
        Math.max(
          Number(per_page) || 10,
          1
        );

      const start =
        (currentPage - 1) *
        perPage;

      const paginatedRows =
        rows.slice(
          start,
          start + perPage
        );

      const totalPages =
        Math.max(
          Math.ceil(
            totalTransaksi /
              perPage
          ),
          1
        );

      // ======================================================
      // MENU
      // ======================================================

      const menu =
        await this.getPersentaseSHU();

      // ======================================================
      // RESPONSE
      // ======================================================

      return res.status(200).json({
        success: true,

        persentase: {
          id: persentase.id,

          keterangan:
            persentase.keterangan,

          persentase:
            persentase.persentase,

          slug:
            slugify(
              persentase.keterangan
            ),
        },

        menu,

        persentaseSHU: menu,

        filter: {
          dana,
          dari: tanggalMulai,
          sampai:
            tanggalSelesai,
          search,
        },

        saldoAwal,

        totalDebet,

        totalKredit,

        saldoAkhir,

        totalTransaksi,

        transaksi:
          paginatedRows,

        currentPage,

        totalPages,

        perPage,
      });
    } catch (error) {
      console.error(
        "❌ Error Dana SHU index:",
        error
      );

      return res
        .status(
          error.status || 500
        )
        .json({
          success: false,

          message:
            error.status === 404
              ? error.message
              : "Gagal mengambil data dana SHU",

          error:
            error.message,

          data: [],
        });
    }
  }

  // ==========================================================
  // 9. STORE
  // ==========================================================

  async store(req, res) {
    try {
      const { dana } =
        req.params;

      const persentase =
        await this.resolvePersentase(
          dana
        );

      const {
        tanggal,
        keterangan,
        debet,
        kredit,
        catatan,
      } = req.body;

      if (!tanggal) {
        return res.status(422).json({
          success: false,
          message:
            "Tanggal wajib diisi",
        });
      }

      if (
        !keterangan ||
        !String(keterangan).trim()
      ) {
        return res.status(422).json({
          success: false,
          message:
            "Keterangan wajib diisi",
        });
      }

      const nilaiDebet =
        debet === undefined ||
        debet === null ||
        debet === ""
          ? 0
          : Number(debet);

      const nilaiKredit =
        kredit === undefined ||
        kredit === null ||
        kredit === ""
          ? 0
          : Number(kredit);

      if (
        Number.isNaN(
          nilaiDebet
        ) ||
        Number.isNaN(
          nilaiKredit
        )
      ) {
        return res.status(422).json({
          success: false,
          message:
            "Nilai debet/kredit tidak valid",
        });
      }

      if (
        nilaiDebet < 0 ||
        nilaiKredit < 0
      ) {
        return res.status(422).json({
          success: false,
          message:
            "Debet dan kredit tidak boleh negatif",
        });
      }

      if (
        nilaiDebet > 0 &&
        nilaiKredit > 0
      ) {
        return res.status(422).json({
          success: false,
          message:
            "Debet dan kredit tidak boleh diisi bersamaan",
        });
      }

      const record =
        await DanaShu.create({
          persentase_shu_id:
            persentase.id,

          tanggal,

          keterangan:
            String(
              keterangan
            ).trim(),

          debet:
            nilaiDebet,

          kredit:
            nilaiKredit,

          saldo: 0,

          catatan:
            catatan
              ? String(
                  catatan
                ).trim()
              : null,
        });

      await this.recalculateSaldo(
        persentase.id
      );

      const updatedRecord =
        await DanaShu.findByPk(
          record.id,
          {
            raw: true,
          }
        );

      return res.status(201).json({
        success: true,

        message:
          `${persentase.keterangan} berhasil ditambahkan`,

        data:
          updatedRecord,
      });
    } catch (error) {
      console.error(
        "❌ Error Dana SHU store:",
        error
      );

      return res
        .status(
          error.status || 500
        )
        .json({
          success: false,

          message:
            error.status === 404
              ? error.message
              : "Gagal menambahkan dana SHU",

          error:
            error.message,
        });
    }
  }

  // ==========================================================
  // 10. UPDATE
  // ==========================================================

  async update(req, res) {
    try {
      const {
        dana,
        id,
      } = req.params;

      const persentase =
        await this.resolvePersentase(
          dana
        );

      const record =
        await DanaShu.findOne({
          where: {
            id,
            persentase_shu_id:
              persentase.id,
          },
        });

      if (!record) {
        return res.status(404).json({
          success: false,
          message:
            "Data dana SHU tidak ditemukan",
        });
      }

      const {
        tanggal,
        keterangan,
        debet,
        kredit,
        catatan,
      } = req.body;

      if (!tanggal) {
        return res.status(422).json({
          success: false,
          message:
            "Tanggal wajib diisi",
        });
      }

      if (
        !keterangan ||
        !String(keterangan).trim()
      ) {
        return res.status(422).json({
          success: false,
          message:
            "Keterangan wajib diisi",
        });
      }

      const nilaiDebet =
        debet === undefined ||
        debet === null ||
        debet === ""
          ? 0
          : Number(debet);

      const nilaiKredit =
        kredit === undefined ||
        kredit === null ||
        kredit === ""
          ? 0
          : Number(kredit);

      if (
        Number.isNaN(
          nilaiDebet
        ) ||
        Number.isNaN(
          nilaiKredit
        )
      ) {
        return res.status(422).json({
          success: false,
          message:
            "Nilai debet/kredit tidak valid",
        });
      }

      if (
        nilaiDebet < 0 ||
        nilaiKredit < 0
      ) {
        return res.status(422).json({
          success: false,
          message:
            "Debet dan kredit tidak boleh negatif",
        });
      }

      if (
        nilaiDebet > 0 &&
        nilaiKredit > 0
      ) {
        return res.status(422).json({
          success: false,
          message:
            "Debet dan kredit tidak boleh diisi bersamaan",
        });
      }

      await record.update({
        tanggal,

        keterangan:
          String(
            keterangan
          ).trim(),

        debet:
          nilaiDebet,

        kredit:
          nilaiKredit,

        catatan:
          catatan
            ? String(
                catatan
              ).trim()
            : null,
      });

      await this.recalculateSaldo(
        persentase.id
      );

      const updatedRecord =
        await DanaShu.findByPk(
          record.id,
          {
            raw: true,
          }
        );

      return res.status(200).json({
        success: true,

        message:
          `${persentase.keterangan} berhasil diperbarui`,

        data:
          updatedRecord,
      });
    } catch (error) {
      console.error(
        "❌ Error Dana SHU update:",
        error
      );

      return res
        .status(
          error.status || 500
        )
        .json({
          success: false,

          message:
            error.status === 404
              ? error.message
              : "Gagal memperbarui dana SHU",

          error:
            error.message,
        });
    }
  }

  // ==========================================================
  // 11. DELETE
  // ==========================================================

  async destroy(req, res) {
    try {
      const {
        dana,
        id,
      } = req.params;

      const persentase =
        await this.resolvePersentase(
          dana
        );

      const record =
        await DanaShu.findOne({
          where: {
            id,
            persentase_shu_id:
              persentase.id,
          },
        });

      if (!record) {
        return res.status(404).json({
          success: false,
          message:
            "Data dana SHU tidak ditemukan",
        });
      }

      await record.destroy();

      await this.recalculateSaldo(
        persentase.id
      );

      return res.status(200).json({
        success: true,

        message:
          `${persentase.keterangan} berhasil dihapus`,
      });
    } catch (error) {
      console.error(
        "❌ Error Dana SHU delete:",
        error
      );

      return res
        .status(
          error.status || 500
        )
        .json({
          success: false,

          message:
            error.status === 404
              ? error.message
              : "Gagal menghapus dana SHU",

          error:
            error.message,
        });
    }
  }

  // ==========================================================
  // 12. RECALCULATE SALDO
  // ==========================================================

  async recalculateSaldo(
    persentaseShuId
  ) {
    const rows =
      await DanaShu.findAll({
        where: {
          persentase_shu_id:
            persentaseShuId,
        },

        order: [
          ["tanggal", "ASC"],
          ["id", "ASC"],
        ],
      });

    let saldo = 0;

    for (const row of rows) {
      const debet =
        Number(row.debet) || 0;

      const kredit =
        Number(row.kredit) || 0;

      saldo += debet;
      saldo -= kredit;

      await row.update(
        {
          saldo,
        },
        {
          hooks: false,
          silent: true,
        }
      );
    }

    return saldo;
  }

  // ==========================================================
  // 13. EXPORT
  // ==========================================================

  async export(req, res) {
    try {
      const {
        dana,
        dari,
        sampai,
        search = "",
        export: exportType,
      } = req.query;

      if (!dana) {
        return res.status(422).json({
          success: false,
          message:
            "Jenis dana SHU wajib dipilih",
        });
      }

      const persentase =
        await this.resolvePersentase(
          dana
        );

      const sekarang =
        new Date();

      const awalBulan =
        new Date(
          sekarang.getFullYear(),
          sekarang.getMonth(),
          1
        );

      const tanggalMulai =
        dari ||
        awalBulan
          .toISOString()
          .slice(0, 10);

      const tanggalSelesai =
        sampai ||
        sekarang
          .toISOString()
          .slice(0, 10);

      const saldoAwal =
        await this.getSaldoAwal(
          persentase.id,
          tanggalMulai
        );

      const rawRows =
        await this.getTransaksi(
          persentase.id,
          tanggalMulai,
          tanggalSelesai,
          search
        );

      const rows =
        this.buildTransaksiDenganSaldo(
          rawRows,
          saldoAwal
        );

      const totalDebet =
        rows.reduce(
          (sum, row) =>
            sum +
            Number(
              row.debet || 0
            ),
          0
        );

      const totalKredit =
        rows.reduce(
          (sum, row) =>
            sum +
            Number(
              row.kredit || 0
            ),
          0
        );

      const saldoAkhir =
        rows.length
          ? Number(
              rows[
                rows.length - 1
              ].saldo || 0
            )
          : Number(
              saldoAwal || 0
            );

      const label =
        `${formatTanggal(
          tanggalMulai
        )} - ${formatTanggal(
          tanggalSelesai
        )}`;

      const exportData = {
        persentase,
        rows,
        saldoAwal,
        totalDebet,
        totalKredit,
        saldoAkhir,
        label,
      };

      if (
        exportType ===
        "excel"
      ) {
        return this.exportExcel(
          res,
          exportData
        );
      }

      if (
        exportType ===
        "pdf"
      ) {
        return this.exportPdf(
          res,
          exportData
        );
      }

      return res.status(400).json({
        success: false,
        message:
          "Format export tidak didukung",
      });
    } catch (error) {
      console.error(
        "❌ Error export Dana SHU:",
        error
      );

      return res
        .status(
          error.status || 500
        )
        .json({
          success: false,

          message:
            error.status === 404
              ? error.message
              : "Gagal mengekspor dana SHU",

          error:
            error.message,
        });
    }
  }

  // ==========================================================
  // 14. EXPORT EXCEL
  // ==========================================================

  async exportExcel(
    res,
    {
      persentase,
      rows,
      saldoAwal,
      totalDebet,
      totalKredit,
      saldoAkhir,
      label,
    }
  ) {
    const workbook =
      new ExcelJS.Workbook();

    const sheet =
      workbook.addWorksheet(
        String(
          persentase.keterangan
        ).substring(0, 31)
      );

    const totalColumns = 7;

    sheet.mergeCells(
      1,
      1,
      1,
      totalColumns
    );

    sheet.getCell(
      "A1"
    ).value =
      `DANA SHU - ${String(
        persentase.keterangan
      ).toUpperCase()}`;

    sheet.getCell(
      "A1"
    ).font = {
      size: 16,
      bold: true,
    };

    sheet.getCell(
      "A1"
    ).alignment = {
      horizontal: "center",
    };

    sheet.mergeCells(
      2,
      1,
      2,
      totalColumns
    );

    sheet.getCell(
      "A2"
    ).value =
      `Periode: ${label}`;

    sheet.getCell(
      "A2"
    ).alignment = {
      horizontal: "center",
    };

    sheet.mergeCells(
      3,
      1,
      3,
      totalColumns
    );

    sheet.getCell(
      "A3"
    ).value =
      `Persentase: ${
        persentase.persentase ??
        0
      }%`;

    sheet.getCell(
      "A3"
    ).alignment = {
      horizontal: "center",
    };

    sheet.addRow([]);

    const summaryHeader =
      sheet.addRow([
        "Saldo Awal",
        "Total Debet",
        "Total Kredit",
        "Saldo Akhir",
      ]);

    summaryHeader.font = {
      bold: true,
    };

    sheet.addRow([
      saldoAwal,
      totalDebet,
      totalKredit,
      saldoAkhir,
    ]);

    sheet.addRow([]);

    const headerRow =
      sheet.addRow([
        "No",
        "Tanggal",
        "Keterangan",
        "Debet",
        "Kredit",
        "Saldo",
        "Catatan",
      ]);

    headerRow.font = {
      bold: true,
    };

    headerRow.alignment = {
      horizontal: "center",
    };

    sheet.addRow([
      "-",
      "",
      "Saldo Awal",
      "",
      "",
      saldoAwal,
      "",
    ]);

    rows.forEach(
      (row, index) => {
        sheet.addRow([
          index + 1,
          formatTanggal(
            row.tanggal
          ),
          row.keterangan ||
            "-",
          row.debet,
          row.kredit,
          row.saldo,
          row.catatan ||
            "-",
        ]);
      }
    );

    sheet.addRow([]);

    const totalRow =
      sheet.addRow([
        "",
        "",
        "TOTAL",
        totalDebet,
        totalKredit,
        saldoAkhir,
        "",
      ]);

    totalRow.font = {
      bold: true,
    };

    ["A", "D", "E", "F"].forEach(
      (col) => {
        sheet.getColumn(
          col
        ).numFmt =
          "#,##0";
      }
    );

    sheet.getColumn(1).width = 8;
    sheet.getColumn(2).width = 18;
    sheet.getColumn(3).width = 35;
    sheet.getColumn(4).width = 18;
    sheet.getColumn(5).width = 18;
    sheet.getColumn(6).width = 18;
    sheet.getColumn(7).width = 40;

    const filename =
      `${slugify(
        persentase.keterangan
      )}-${new Date()
        .toISOString()
        .slice(
          0,
          10
        )}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );

    await workbook.xlsx.write(
      res
    );

    res.end();
  }

  // ==========================================================
  // 15. EXPORT PDF
  // ==========================================================

  async exportPdf(
    res,
    {
      persentase,
      rows,
      saldoAwal,
      totalDebet,
      totalKredit,
      saldoAkhir,
      label,
    }
  ) {
    const doc =
      new PDFDocument({
        margin: 30,
        size: "A4",
        layout: "portrait",
      });

    const filename =
      `${slugify(
        persentase.keterangan
      )}-${new Date()
        .toISOString()
        .slice(
          0,
          10
        )}.pdf`;

    res.setHeader(
      "Content-Type",
      "application/pdf"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );

    doc.pipe(res);

    doc
      .font("Helvetica-Bold")
      .fontSize(15)
      .text(
        `DANA SHU - ${String(
          persentase.keterangan
        ).toUpperCase()}`,
        {
          align: "center",
        }
      );

    doc.moveDown(0.4);

    doc
      .font("Helvetica")
      .fontSize(9)
      .text(
        `Persentase: ${
          persentase.persentase ??
          0
        }%`,
        {
          align: "center",
        }
      );

    doc.text(
      `Periode: ${label}`,
      {
        align: "center",
      }
    );

    doc.moveDown(1);

    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .text("Ringkasan");

    doc.moveDown(0.3);

    doc
      .font("Helvetica")
      .fontSize(9)
      .text(
        `Saldo Awal : Rp ${formatRupiah(
          saldoAwal
        )}`
      )
      .text(
        `Total Debet : Rp ${formatRupiah(
          totalDebet
        )}`
      )
      .text(
        `Total Kredit : Rp ${formatRupiah(
          totalKredit
        )}`
      )
      .text(
        `Saldo Akhir : Rp ${formatRupiah(
          saldoAkhir
        )}`
      );

    doc.moveDown(1);

    const startX = 30;

    const headers = [
      "No",
      "Tanggal",
      "Keterangan",
      "Debet",
      "Kredit",
      "Saldo",
    ];

    const widths = [
      30,
      70,
      170,
      80,
      80,
      90,
    ];

    const tableWidth =
      widths.reduce(
        (a, b) => a + b,
        0
      );

    let y = doc.y;

    const drawHeader = (
      posY
    ) => {
      doc
        .rect(
          startX,
          posY,
          tableWidth,
          22
        )
        .fill("#4b5563");

      doc
        .fillColor("#ffffff")
        .font(
          "Helvetica-Bold"
        )
        .fontSize(7);

      let x = startX;

      headers.forEach(
        (
          header,
          index
        ) => {
          const align =
            index >= 3
              ? "right"
              : "left";

          doc.text(
            header,
            x + 3,
            posY + 6,
            {
              width:
                widths[index] -
                6,
              align,
            }
          );

          x +=
            widths[index];
        }
      );

      doc.fillColor(
        "#000000"
      );

      return posY + 22;
    };

    y =
      drawHeader(y);

    const pageBottom = 760;

    const drawRow = (
      cells,
      bold = false
    ) => {
      if (
        y + 20 >
        pageBottom
      ) {
        doc.addPage();

        y = 30;

        y =
          drawHeader(y);
      }

      const height = 18;

      if (bold) {
        doc
          .rect(
            startX,
            y,
            tableWidth,
            height
          )
          .fill("#e5e7eb");

        doc
          .fillColor(
            "#000000"
          )
          .font(
            "Helvetica-Bold"
          )
          .fontSize(7);
      } else {
        doc
          .rect(
            startX,
            y,
            tableWidth,
            height
          )
          .stroke();

        doc
          .fillColor(
            "#000000"
          )
          .font("Helvetica")
          .fontSize(6.5);
      }

      let x = startX;

      cells.forEach(
        (
          cell,
          index
        ) => {
          const align =
            index >= 3
              ? "right"
              : "left";

          doc.text(
            String(
              cell ?? ""
            ),
            x + 3,
            y + 5,
            {
              width:
                widths[index] -
                6,
              align,
            }
          );

          x +=
            widths[index];
        }
      );

      y += height;
    };

    drawRow([
      "-",
      "",
      "Saldo Awal",
      "",
      "",
      formatRupiah(
        saldoAwal
      ),
    ]);

    rows.forEach(
      (row, index) => {
        drawRow([
          index + 1,

          formatTanggal(
            row.tanggal
          ),

          row.keterangan ||
            "-",

          formatRupiah(
            row.debet
          ),

          formatRupiah(
            row.kredit
          ),

          formatRupiah(
            row.saldo
          ),
        ]);
      }
    );

    drawRow(
      [
        "",
        "",
        "TOTAL",
        formatRupiah(
          totalDebet
        ),
        formatRupiah(
          totalKredit
        ),
        formatRupiah(
          saldoAkhir
        ),
      ],
      true
    );

    doc.end();
  }
}

module.exports =
  new DanaShuController();