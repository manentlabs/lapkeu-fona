// src/controllers/BukuBesarPersediaanController.js
const { BukuPersediaan, Transaksi, Akun, sequelize } = require('../models');
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

// Konversi Date ke string YYYY-MM-DD berdasarkan tanggal LOKAL,
// bukan UTC. toISOString() bawaan JS mengonversi ke UTC dulu,
// sehingga di zona waktu UTC+ (mis. WIB/UTC+7) tanggal bisa
// "mundur" satu hari saat jam lokal masih pagi/dini hari.
function toLocalISODate(d) {
  const tzOffsetMs = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 10);
}

class BukuBesarPersediaanController {
  // ─── Hitung laba/rugi ──────────────────────────────────────
  hitungLabaRugi(data) {
    const hargaJual = parseFloat(data.harga_penjualan) || 0;
    const hpp = parseFloat(data.hpp_per_pcs) || 0;
    const qty = parseInt(data.penjualan_pcs) || 0;
    const selisih = hargaJual - hpp;

    if (data.keuntungan === undefined || data.kerugian === undefined) {
      if (selisih > 0) {
        data.keuntungan = selisih * qty;
        data.kerugian = 0;
      } else if (selisih < 0) {
        data.kerugian = Math.abs(selisih) * qty;
        data.keuntungan = 0;
      } else {
        data.keuntungan = 0;
        data.kerugian = 0;
      }
    }
    return data;
  }

  // ─── Ambil data dengan computed fields ─────────────────────
  async getItems(tanggalMulai, tanggalSelesai) {
    const items = await BukuPersediaan.findAll({
      where: {
        tanggal: { [Op.between]: [tanggalMulai, tanggalSelesai] },
      },
      include: [
        { model: Transaksi, as: 'transaksiPembelian' },
        { model: Transaksi, as: 'transaksiPenjualan' },
      ],
      order: [
        ['kode_barang', 'ASC'],
        ['tanggal', 'ASC'],
      ],
    });

    return items.map(item => {
      const data = item.toJSON();
      // Computed fields
      data.total_pembelian = (parseFloat(data.pembelian_pcs) || 0) * (parseFloat(data.harga_pembelian) || 0);
      data.total_penjualan = (parseFloat(data.penjualan_pcs) || 0) * (parseFloat(data.harga_penjualan) || 0);
      data.total_hpp = (parseFloat(data.penjualan_pcs) || 0) * (parseFloat(data.hpp_per_pcs) || 0);
      data.saldo_akhir = (parseFloat(data.stok_awal) || 0) + (parseFloat(data.pembelian_pcs) || 0) - (parseFloat(data.penjualan_pcs) || 0);
      return this.hitungLabaRugi(data);
    });
  }

  // ─── Hitung totals ──────────────────────────────────────────
  hitungTotals(items) {
    return {
      totalSaldoAwal: items.reduce((sum, i) => sum + (parseFloat(i.stok_awal) || 0), 0),
      totalPembelian: items.reduce((sum, i) => sum + (parseFloat(i.total_pembelian) || 0), 0),
      totalHpp: items.reduce((sum, i) => sum + (parseFloat(i.total_hpp) || 0), 0),
      totalPenjualan: items.reduce((sum, i) => sum + (parseFloat(i.total_penjualan) || 0), 0),
      totalSaldoAkhir: items.reduce((sum, i) => sum + (parseFloat(i.saldo_akhir) || 0), 0),
      totalKeuntungan: items.reduce((sum, i) => sum + (parseFloat(i.keuntungan) || 0), 0),
      totalKerugian: items.reduce((sum, i) => sum + (parseFloat(i.kerugian) || 0), 0),
    };
  }

  // ─── Ambil transaksi persediaan untuk dropdown ─────────────
  async getTransaksiPersediaan() {
    const akunPersediaan = await Akun.findAll({
      where: { nama_akun: { [Op.like]: '%persediaan%' } },
      attributes: ['id'],
    });
    const akunIds = akunPersediaan.map(a => a.id);

    if (akunIds.length === 0) {
      return { transaksiPembelian: [], transaksiPenjualan: [] };
    }

    const transaksiPembelian = await Transaksi.findAll({
      where: { akun_debet_id: akunIds },
      include: [
        { model: Akun, as: 'akunDebet' },
        { model: Akun, as: 'akunKredit' },
      ],
      order: [['tanggal', 'DESC']],
    });

    const transaksiPenjualan = await Transaksi.findAll({
      where: { akun_kredit_id: akunIds },
      include: [
        { model: Akun, as: 'akunDebet' },
        { model: Akun, as: 'akunKredit' },
      ],
      order: [['tanggal', 'DESC']],
    });

    return { transaksiPembelian, transaksiPenjualan };
  }

  // ─── ENDPOINT: GET /api/bendahara/buku-besar-persediaan ───
  async index(req, res) {
    try {
      const { tanggal_mulai, tanggal_selesai } = req.query;
      const now = new Date();
      const defaultMulai = toLocalISODate(new Date(now.getFullYear(), now.getMonth(), 1));
      const defaultSelesai = toLocalISODate(now);

      const mulai = tanggal_mulai || defaultMulai;
      const selesai = tanggal_selesai || defaultSelesai;

      const items = await this.getItems(mulai, selesai);
      const totals = this.hitungTotals(items);

      res.json({
        items,
        ...totals,
        tanggal_mulai: mulai,
        tanggal_selesai: selesai,
      });
    } catch (error) {
      console.error('Error Buku Besar Persediaan:', error);
      res.status(500).json({ message: 'Gagal mengambil data', error: error.message });
    }
  }

  // ─── ENDPOINT: GET /api/bendahara/buku-besar-persediaan/export ──
  async export(req, res) {
    try {
      const { tanggal_mulai, tanggal_selesai, export: exportType } = req.query;
      const now = new Date();
      const defaultMulai = toLocalISODate(new Date(now.getFullYear(), now.getMonth(), 1));
      const defaultSelesai = toLocalISODate(now);

      const mulai = tanggal_mulai || defaultMulai;
      const selesai = tanggal_selesai || defaultSelesai;

      const items = await this.getItems(mulai, selesai);
      const totals = this.hitungTotals(items);

      if (exportType === 'excel') {
        await this.exportExcel(res, items, totals, mulai, selesai);
      } else if (exportType === 'pdf') {
        await this.exportPdf(res, items, totals, mulai, selesai);
      } else {
        res.status(400).json({ message: 'Format export tidak didukung' });
      }
    } catch (error) {
      console.error('Error export:', error);
      res.status(500).json({ message: 'Gagal mengekspor data', error: error.message });
    }
  }

  // ─── Export Excel ──────────────────────────────────────────
  async exportExcel(res, items, totals, mulai, selesai) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Buku Besar Persediaan');

    // Header
    sheet.mergeCells('A1:P1');
    sheet.getCell('A1').value = 'BUKU BESAR PERSEDIAAN';
    sheet.getCell('A1').font = { size: 16, bold: true };
    sheet.getCell('A1').alignment = { horizontal: 'center' };

    sheet.mergeCells('A2:P2');
    sheet.getCell('A2').value = `Periode: ${formatTanggal(mulai)} - ${formatTanggal(selesai)}`;
    sheet.getCell('A2').alignment = { horizontal: 'center' };

    const headers = [
      'Kode Barang', 'Nama Barang', 'Satuan', 'Stok Awal', 'Harga Awal',
      'Pembelian (Pcs)', 'Harga Beli', 'Total Pembelian',
      'Penjualan (Pcs)', 'Harga Jual', 'Total Penjualan',
      'HPP/Pcs', 'Total HPP', 'Saldo Akhir',
      'Keuntungan', 'Kerugian',
    ];
    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.alignment = { horizontal: 'center' };

    for (const item of items) {
      sheet.addRow([
        item.kode_barang,
        item.nama_barang,
        item.satuan,
        item.stok_awal,
        formatRupiah(item.harga_awal),
        item.pembelian_pcs || 0,
        formatRupiah(item.harga_pembelian || 0),
        formatRupiah(item.total_pembelian || 0),
        item.penjualan_pcs || 0,
        formatRupiah(item.harga_penjualan || 0),
        formatRupiah(item.total_penjualan || 0),
        formatRupiah(item.hpp_per_pcs || 0),
        formatRupiah(item.total_hpp || 0),
        item.saldo_akhir,
        formatRupiah(item.keuntungan || 0),
        formatRupiah(item.kerugian || 0),
      ]);
    }

    // Total row
    const totalRow = sheet.addRow([
      'TOTAL', '', '',
      totals.totalSaldoAwal, '',
      '', '', formatRupiah(totals.totalPembelian),
      '', '', formatRupiah(totals.totalPenjualan),
      '', formatRupiah(totals.totalHpp),
      totals.totalSaldoAkhir,
      formatRupiah(totals.totalKeuntungan),
      formatRupiah(totals.totalKerugian),
    ]);
    totalRow.font = { bold: true };

    // Column widths
    sheet.getColumn(1).width = 15;
    sheet.getColumn(2).width = 25;
    sheet.getColumn(3).width = 10;
    sheet.getColumn(4).width = 12;
    sheet.getColumn(5).width = 15;
    sheet.getColumn(6).width = 15;
    sheet.getColumn(7).width = 15;
    sheet.getColumn(8).width = 18;
    sheet.getColumn(9).width = 15;
    sheet.getColumn(10).width = 15;
    sheet.getColumn(11).width = 18;
    sheet.getColumn(12).width = 15;
    sheet.getColumn(13).width = 18;
    sheet.getColumn(14).width = 15;
    sheet.getColumn(15).width = 18;
    sheet.getColumn(16).width = 18;

    // Align numbers
    for (let i = 4; i <= 16; i++) {
      sheet.getColumn(i).alignment = { horizontal: 'right' };
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=buku-besar-persediaan-${toLocalISODate(new Date())}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  }

  // ─── Export PDF ─────────────────────────────────────────────
  async exportPdf(res, items, totals, mulai, selesai) {
    const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=buku-besar-persediaan-${toLocalISODate(new Date())}.pdf`);
    doc.pipe(res);

    // Header
    doc.fontSize(14).font('Helvetica-Bold').text('BUKU BESAR PERSEDIAAN', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`Periode: ${formatTanggal(mulai)} - ${formatTanggal(selesai)}`, { align: 'center' });
    doc.moveDown(1);

    const startX = 30;
    let currentY = doc.y;

    const colWidths = [50, 70, 30, 35, 40, 40, 40, 50, 40, 40, 50, 40, 50, 40, 45, 45];
    const headers = [
      'Kode', 'Nama', 'Sat', 'Stok Awal', 'Hrg Awal',
      'Pembelian', 'Hrg Beli', 'Total Beli',
      'Penjualan', 'Hrg Jual', 'Total Jual',
      'HPP', 'Total HPP', 'S Akhir',
      'Untung', 'Rugi',
    ];

    const drawHeader = (y) => {
      doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), 18).fill('#6c757d');
      doc.fillColor('#fff').font('Helvetica-Bold').fontSize(6);
      let x = startX;
      headers.forEach((h, i) => {
        const align = (i === 0 || i === 1 || i === 2) ? 'left' : 'right';
        doc.text(h, x + 2, y + 4, { width: colWidths[i] - 4, align });
        x += colWidths[i];
      });
      doc.fillColor('#000').font('Helvetica').fontSize(6);
      return y + 18;
    };

    let rowY = drawHeader(currentY);
    const pageHeight = doc.page.height - doc.page.margins.bottom;

    const drawRow = (cells, isBold = false) => {
      if (rowY + 14 > pageHeight) {
        doc.addPage({ layout: 'landscape' });
        rowY = 30;
        rowY = drawHeader(rowY);
      }
      if (isBold) {
        doc.rect(startX, rowY, colWidths.reduce((a, b) => a + b, 0), 14).fill('#dee2e6');
        doc.fillColor('#000').font('Helvetica-Bold').fontSize(6);
      } else {
        doc.rect(startX, rowY, colWidths.reduce((a, b) => a + b, 0), 12).stroke();
        doc.fillColor('#000').font('Helvetica').fontSize(6);
      }
      let x = startX;
      cells.forEach((text, i) => {
        const align = (i === 0 || i === 1 || i === 2) ? 'left' : 'right';
        doc.text(text, x + 2, rowY + 2, { width: colWidths[i] - 4, align });
        x += colWidths[i];
      });
      rowY += isBold ? 14 : 12;
    };

    // Data rows
    for (const item of items) {
      drawRow([
        item.kode_barang,
        item.nama_barang,
        item.satuan,
        item.stok_awal,
        formatRupiah(item.harga_awal),
        item.pembelian_pcs || 0,
        formatRupiah(item.harga_pembelian || 0),
        formatRupiah(item.total_pembelian || 0),
        item.penjualan_pcs || 0,
        formatRupiah(item.harga_penjualan || 0),
        formatRupiah(item.total_penjualan || 0),
        formatRupiah(item.hpp_per_pcs || 0),
        formatRupiah(item.total_hpp || 0),
        item.saldo_akhir,
        formatRupiah(item.keuntungan || 0),
        formatRupiah(item.kerugian || 0),
      ]);
    }

    // Total row
    drawRow([
      'TOTAL', '', '',
      totals.totalSaldoAwal, '',
      '', '', formatRupiah(totals.totalPembelian),
      '', '', formatRupiah(totals.totalPenjualan),
      '', formatRupiah(totals.totalHpp),
      totals.totalSaldoAkhir,
      formatRupiah(totals.totalKeuntungan),
      formatRupiah(totals.totalKerugian),
    ], true);

    doc.end();
  }
}

module.exports = new BukuBesarPersediaanController();