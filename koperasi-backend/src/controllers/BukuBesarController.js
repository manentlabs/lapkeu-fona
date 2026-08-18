// src/controllers/BukuBesarController.js
const { Akun, Jurnal, Transaksi, sequelize } = require('../models');
const { Op } = require('sequelize');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

function formatRupiah(value) {
  const num = parseFloat(value) || 0;
  return num.toLocaleString('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatTanggal(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

class BukuBesarController {
  // ─── Hitung saldo berdasarkan tipe akun ──────────────────
  hitungSaldo(akun, debet, kredit, saldoSebelumnya = 0) {
    const isNormalDebet = ['aset', 'beban'].includes(akun.tipe_akun?.toLowerCase() || '');
    if (isNormalDebet) {
      return saldoSebelumnya + debet - kredit;
    } else {
      return saldoSebelumnya - debet + kredit;
    }
  }

  // ─── Get akun dropdown (hanya yang ada di jurnal) ──────
  async getAkunDropdown() {
    const akunIds = await Jurnal.findAll({
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('akun_id')), 'akun_id']],
      raw: true,
    });
    const ids = akunIds.map(a => a.akun_id);
    return await Akun.findAll({
      where: { id: ids },
      order: [['kode_akun', 'ASC']],
    });
  }

 // ─── Build data buku besar ──────────────────────────────
async buildLedgerData(akunId, tanggalMulai, tanggalSelesai) {
  const akun = await Akun.findByPk(akunId);
  if (!akun) {
    throw new Error('Akun tidak ditemukan');
  }

  // Saldo awal = saldo_awal master akun + mutasi jurnal sebelum tanggalMulai
  let saldoAwal = parseFloat(akun.saldo_awal) || 0;

  if (tanggalMulai) {
    const result = await Jurnal.findOne({
      attributes: [
        [sequelize.fn('COALESCE', sequelize.fn('SUM', sequelize.col('debet')), 0), 'totalDebet'],
        [sequelize.fn('COALESCE', sequelize.fn('SUM', sequelize.col('kredit')), 0), 'totalKredit'],
      ],
      where: {
        akun_id: akunId,
        tanggal: { [Op.lt]: tanggalMulai },
      },
      raw: true,
    });
    const debet = parseFloat(result?.totalDebet) || 0;
    const kredit = parseFloat(result?.totalKredit) || 0;
    saldoAwal = this.hitungSaldo(akun, debet, kredit, saldoAwal);
  }

  // Query jurnal periode
  const where = { akun_id: akunId };
  if (tanggalMulai && tanggalSelesai) {
    where.tanggal = { [Op.between]: [tanggalMulai, tanggalSelesai] };
  } else if (tanggalMulai) {
    where.tanggal = { [Op.gte]: tanggalMulai };
  } else if (tanggalSelesai) {
    where.tanggal = { [Op.lte]: tanggalSelesai };
  }

  const jurnalData = await Jurnal.findAll({
    where,
    include: [
      { model: Transaksi, as: 'transaksi' },
    ],
    order: [
      ['tanggal', 'ASC'],
      ['id', 'ASC'],
    ],
  });

  // Hitung saldo berjalan
  let saldo = saldoAwal;
  let totalDebet = 0;
  let totalKredit = 0;

  const data = jurnalData.map((jurnal) => {
    const debet = parseFloat(jurnal.debet) || 0;
    const kredit = parseFloat(jurnal.kredit) || 0;
    totalDebet += debet;
    totalKredit += kredit;
    saldo = this.hitungSaldo(akun, debet, kredit, saldo);

    return {
      tanggal: jurnal.tanggal,
      no_bukti: jurnal.transaksi?.no_transaksi || '-',
      keterangan: jurnal.keterangan || jurnal.transaksi?.referensi?.label || '-',
      debet,
      kredit,
      saldo,
    };
  });

  const saldoAkhir = saldo;

  return {
    akun,
    data,
    saldoAwal,
    totalDebet,
    totalKredit,
    saldoAkhir,
  };
}

  // ─── ENDPOINT: GET /api/bendahara/buku-besar ─────────────
  async index(req, res) {
    try {
      const { akun_id, tanggal_mulai, tanggal_selesai } = req.query;

      const akunDropdown = await this.getAkunDropdown();

      if (!akun_id) {
        return res.json({
          akunDropdown,
          data: [],
          akun: null,
          saldoAwal: 0,
          totalDebet: 0,
          totalKredit: 0,
          saldoAkhir: 0,
          tanggal_mulai: tanggal_mulai || null,
          tanggal_selesai: tanggal_selesai || null,
        });
      }

      const result = await this.buildLedgerData(akun_id, tanggal_mulai, tanggal_selesai);

      res.json({
        akunDropdown,
        data: result.data,
        akun: result.akun,
        saldoAwal: result.saldoAwal,
        totalDebet: result.totalDebet,
        totalKredit: result.totalKredit,
        saldoAkhir: result.saldoAkhir,
        tanggal_mulai: tanggal_mulai || null,
        tanggal_selesai: tanggal_selesai || null,
      });
    } catch (error) {
      console.error('Error Buku Besar:', error);
      res.status(500).json({
        message: 'Gagal mengambil data buku besar',
        error: error.message,
      });
    }
  }

  // ─── ENDPOINT: GET /api/bendahara/buku-besar/export ──────
  async export(req, res) {
    try {
      const { akun_id, tanggal_mulai, tanggal_selesai, export: exportType } = req.query;

      if (!akun_id) {
        return res.status(422).json({ message: 'Pilih akun terlebih dahulu' });
      }

      const result = await this.buildLedgerData(akun_id, tanggal_mulai, tanggal_selesai);

      if (exportType === 'excel') {
        await this.exportExcel(res, result);
      } else if (exportType === 'pdf') {
        await this.exportPdf(res, result);
      } else {
        res.status(400).json({ message: 'Format export tidak didukung' });
      }
    } catch (error) {
      console.error('Error export Buku Besar:', error);
      res.status(500).json({ message: 'Gagal mengekspor buku besar' });
    }
  }

  // ─── Export Excel ──────────────────────────────────────────
  async exportExcel(res, result) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Buku Besar');

    // Header
    sheet.mergeCells('A1:E1');
    sheet.getCell('A1').value = `BUKU BESAR - ${result.akun.kode_akun} ${result.akun.nama_akun}`;
    sheet.getCell('A1').font = { size: 14, bold: true };
    sheet.getCell('A1').alignment = { horizontal: 'center' };

    sheet.mergeCells('A2:E2');
    sheet.getCell('A2').value = `Periode: ${formatTanggal(result.tanggal_mulai)} - ${formatTanggal(result.tanggal_selesai)}`;
    sheet.getCell('A2').alignment = { horizontal: 'center' };

    // Saldo awal
    sheet.addRow(['']);
    sheet.addRow(['Saldo Awal', '', '', '', formatRupiah(result.saldoAwal)]);
    sheet.getRow(4).font = { bold: true };

    // Header tabel
    const headers = ['Tanggal', 'No. Bukti', 'Keterangan', 'Debet', 'Kredit'];
    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.alignment = { horizontal: 'center' };

    // Data
    for (const row of result.data) {
      sheet.addRow([
        row.tanggal,
        row.no_bukti,
        row.keterangan,
        formatRupiah(row.debet),
        formatRupiah(row.kredit),
      ]);
    }

    // Total
    const totalRow = sheet.addRow([
      '',
      '',
      'TOTAL',
      formatRupiah(result.totalDebet),
      formatRupiah(result.totalKredit),
    ]);
    totalRow.font = { bold: true };

    // Saldo akhir
    sheet.addRow(['']);
    sheet.addRow(['Saldo Akhir', '', '', '', formatRupiah(result.saldoAkhir)]);
    sheet.getRow(sheet.rowCount).font = { bold: true };

    // Column widths
    sheet.getColumn(1).width = 15;
    sheet.getColumn(2).width = 20;
    sheet.getColumn(3).width = 35;
    sheet.getColumn(4).width = 18;
    sheet.getColumn(5).width = 18;

    // Align numbers
    for (let i = 4; i <= 5; i++) {
      sheet.getColumn(i).alignment = { horizontal: 'right' };
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=buku-besar-${result.akun.kode_akun}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  }

  // ─── Export PDF ─────────────────────────────────────────────
  async exportPdf(res, result) {
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=buku-besar-${result.akun.kode_akun}-${new Date().toISOString().slice(0, 10)}.pdf`);
    doc.pipe(res);

    // Header
    doc.fontSize(14).font('Helvetica-Bold').text(
      `BUKU BESAR - ${result.akun.kode_akun} ${result.akun.nama_akun}`,
      { align: 'center' }
    );
    doc.fontSize(10).font('Helvetica').text(
      `Periode: ${formatTanggal(result.tanggal_mulai)} - ${formatTanggal(result.tanggal_selesai)}`,
      { align: 'center' }
    );
    doc.moveDown(0.5);

    // Saldo Awal
    doc.fontSize(9).font('Helvetica-Bold').text(`Saldo Awal: ${formatRupiah(result.saldoAwal)}`);
    doc.moveDown(0.5);

    const startX = 30;
    let currentY = doc.y;

    const colWidths = [80, 100, 140, 80, 80];
    const headers = ['Tanggal', 'No. Bukti', 'Keterangan', 'Debet', 'Kredit'];

    const drawHeader = (y) => {
      doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), 18).fill('#6c757d');
      doc.fillColor('#fff').font('Helvetica-Bold').fontSize(8);
      let x = startX;
      headers.forEach((h, i) => {
        const align = i >= 3 ? 'right' : 'left';
        doc.text(h, x + 4, y + 4, { width: colWidths[i] - 8, align });
        x += colWidths[i];
      });
      doc.fillColor('#000').font('Helvetica').fontSize(7);
      return y + 18;
    };

    let rowY = drawHeader(currentY);
    const pageHeight = 500;

    const drawRow = (cells, isBold = false) => {
      if (rowY + 16 > pageHeight) {
        doc.addPage({ layout: 'landscape' });
        rowY = 30;
        rowY = drawHeader(rowY);
      }
      if (isBold) {
        doc.rect(startX, rowY, colWidths.reduce((a, b) => a + b, 0), 16).fill('#dee2e6');
        doc.fillColor('#000').font('Helvetica-Bold').fontSize(7);
      } else {
        doc.rect(startX, rowY, colWidths.reduce((a, b) => a + b, 0), 14).stroke();
        doc.fillColor('#000').font('Helvetica').fontSize(7);
      }
      let x = startX;
      cells.forEach((text, i) => {
        const align = i >= 3 ? 'right' : 'left';
        doc.text(text, x + 4, rowY + 2, { width: colWidths[i] - 8, align });
        x += colWidths[i];
      });
      rowY += isBold ? 16 : 14;
    };

    // Data rows
    for (const row of result.data) {
      drawRow([
        row.tanggal,
        row.no_bukti,
        row.keterangan,
        formatRupiah(row.debet),
        formatRupiah(row.kredit),
      ]);
    }

    // Total
    drawRow([
      '',
      '',
      'TOTAL',
      formatRupiah(result.totalDebet),
      formatRupiah(result.totalKredit),
    ], true);

    // Saldo Akhir
    doc.moveDown(1);
    doc.fontSize(9).font('Helvetica-Bold').text(`Saldo Akhir: ${formatRupiah(result.saldoAkhir)}`);

    doc.end();
  }
}

module.exports = new BukuBesarController();