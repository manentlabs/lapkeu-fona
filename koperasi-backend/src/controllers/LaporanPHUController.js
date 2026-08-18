// src/controllers/LaporanPhuController.js
const { Akun, Jurnal, Transaksi, PengaturanWebsite, sequelize } = require('../models');
const { Op } = require('sequelize');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

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

class LaporanPhuController {
  // ─── Ambil semua child (descendant) ──────────────────────
  async getDescendantIds(parentId) {
    const ids = [parentId];
    const children = await Akun.findAll({
      where: { parent_id: parentId },
      attributes: ['id'],
    });
    for (const child of children) {
      const childIds = await this.getDescendantIds(child.id);
      ids.push(...childIds);
    }
    return ids;
  }

  // ─── Hitung total mutasi akun ────────────────────────────
  // normalDebet: true untuk akun yang normalnya di debet (aset, beban)
  // false untuk akun yang normalnya di kredit (pendapatan, kewajiban, modal)
  async getMutasiAkun(akunId, dari, sampai, unit = null, normalDebet = true) {
    const ids = await this.getDescendantIds(akunId);
    const where = { akun_id: ids };
    if (dari) where.tanggal = { [Op.gte]: dari };
    if (sampai) where.tanggal = { ...where.tanggal, [Op.lte]: sampai };
    if (unit) {
      const transaksiIds = await Transaksi.findAll({
        where: { unit_usaha: unit },
        attributes: ['id'],
        raw: true,
      });
      const idsTrx = transaksiIds.map(t => t.id);
      if (idsTrx.length > 0) {
        where.transaksi_id = idsTrx;
      } else {
        return 0;
      }
    }

    const result = await Jurnal.findOne({
      attributes: [
        [sequelize.fn('SUM', sequelize.col('debet')), 'totalDebet'],
        [sequelize.fn('SUM', sequelize.col('kredit')), 'totalKredit'],
      ],
      where,
      raw: true,
    });
    const debet = parseFloat(result?.totalDebet) || 0;
    const kredit = parseFloat(result?.totalKredit) || 0;

    // Jika normalDebet = true (aset, beban) → debet - kredit
    // Jika normalDebet = false (pendapatan, kewajiban, modal) → kredit - debet
    return normalDebet ? debet - kredit : kredit - debet;
  }

  // ─── Build PHU ────────────────────────────────────────────
  async buildPhu(dari, sampai, unit = null) {
    // 1. Pendapatan (akun kode 4000) - normalDebet = false
    const pendapatanRoot = await Akun.findOne({ where: { kode_akun: '4000' } });
    const totalPendapatan = pendapatanRoot
      ? await this.getMutasiAkun(pendapatanRoot.id, dari, sampai, unit, false)
      : 0;

    // 2. Beban (akun kode 5000) - normalDebet = true
    const bebanRoot = await Akun.findOne({ where: { kode_akun: '5000' } });
    const totalBeban = bebanRoot
      ? await this.getMutasiAkun(bebanRoot.id, dari, sampai, unit, true)
      : 0;

    const shu = totalPendapatan - totalBeban;

    // Detail pendapatan (child akun 4000) - normalDebet = false
    let detailPendapatan = [];
    if (pendapatanRoot) {
      const children = await Akun.findAll({
        where: { parent_id: pendapatanRoot.id },
        order: [['kode_akun', 'ASC']],
      });
      for (const child of children) {
        const nilai = await this.getMutasiAkun(child.id, dari, sampai, unit, false);
        if (nilai !== 0) {
          detailPendapatan.push({
            kode: child.kode_akun,
            nama: child.nama_akun,
            nilai: nilai,
          });
        }
      }
    }

    // Detail beban (child akun 5000) - normalDebet = true
    let detailBeban = [];
    if (bebanRoot) {
      const children = await Akun.findAll({
        where: { parent_id: bebanRoot.id },
        order: [['kode_akun', 'ASC']],
      });
      for (const child of children) {
        const nilai = await this.getMutasiAkun(child.id, dari, sampai, unit, true);
        if (nilai !== 0) {
          detailBeban.push({
            kode: child.kode_akun,
            nama: child.nama_akun,
            nilai: nilai,
          });
        }
      }
    }

    return {
      totalPendapatan,
      detailPendapatan,
      totalBeban,
      detailBeban,
      shu,
    };
  }

  // ─── Endpoint ─────────────────────────────────────────────
  async index(req, res) {
    try {
      const { dari, sampai, unit } = req.query;
      const now = new Date();
      const defaultDari = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const defaultSampai = now.toISOString().slice(0, 10);

      const queryDari = dari || defaultDari;
      const querySampai = sampai || defaultSampai;

      const data = await this.buildPhu(queryDari, querySampai, unit || null);

      // Daftar unit untuk filter dropdown
      const units = await Transaksi.findAll({
        attributes: [[sequelize.fn('DISTINCT', sequelize.col('unit_usaha')), 'unit_usaha']],
        where: { unit_usaha: { [Op.ne]: null } },
        raw: true,
        order: [['unit_usaha', 'ASC']],
      });
      const unitList = units.map(u => u.unit_usaha).filter(Boolean);

      const labelPeriode = `${formatTanggal(queryDari)} – ${formatTanggal(querySampai)}`;

      res.json({
        data,
        labelPeriode,
        dari: queryDari,
        sampai: querySampai,
        unit: unit || null,
        daftarUnit: unitList,
      });
    } catch (error) {
      console.error('Error PHU:', error);
      res.status(500).json({ message: 'Gagal mengambil data PHU', error: error.message });
    }
  }

  // ─── Export ────────────────────────────────────────────────
  async export(req, res) {
    try {
      const { dari, sampai, unit, export: exportType } = req.query;
      const now = new Date();
      const queryDari = dari || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const querySampai = sampai || now.toISOString().slice(0, 10);

      const data = await this.buildPhu(queryDari, querySampai, unit || null);
      const labelPeriode = `${formatTanggal(queryDari)} – ${formatTanggal(querySampai)}`;

      if (exportType === 'excel') {
        await this.exportExcel(res, data, labelPeriode, unit);
      } else if (exportType === 'pdf') {
        // Ambil data pengaturan koperasi untuk kop surat (sama seperti neraca & arus kas)
        const pengaturan = await PengaturanWebsite.findOne();
        await this.exportPdf(res, data, labelPeriode, unit, pengaturan);
      } else {
        res.status(400).json({ message: 'Format export tidak didukung' });
      }
    } catch (error) {
      console.error('Error export PHU:', error);
      res.status(500).json({ message: 'Gagal mengekspor PHU' });
    }
  }

  // ─── Export Excel ──────────────────────────────────────────
  async exportExcel(res, data, labelPeriode, unit) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('PHU');

    sheet.mergeCells('A1:D1');
    sheet.getCell('A1').value = 'PERHITUNGAN HASIL USAHA (PHU)';
    sheet.getCell('A1').font = { size: 16, bold: true };
    sheet.getCell('A1').alignment = { horizontal: 'center' };

    sheet.mergeCells('A2:D2');
    sheet.getCell('A2').value = `Periode: ${labelPeriode}`;
    sheet.getCell('A2').alignment = { horizontal: 'center' };
    if (unit) {
      sheet.mergeCells('A3:D3');
      sheet.getCell('A3').value = `Unit Usaha: ${unit}`;
      sheet.getCell('A3').alignment = { horizontal: 'center' };
    }

    let rowIndex = 4;

    const addSection = (title, items, total, isBeban = false) => {
      sheet.addRow([title]);
      sheet.getRow(rowIndex).font = { bold: true, size: 11 };
      rowIndex++;
      let subtotal = 0;
      for (const item of items) {
        const val = isBeban ? -item.nilai : item.nilai;
        sheet.addRow([`  ${item.kode} - ${item.nama}`, '', '', formatRupiah(val)]);
        subtotal += val;
        rowIndex++;
      }
      if (items.length === 0) {
        sheet.addRow(['  (Tidak ada data)', '', '', '']);
        rowIndex++;
      }
      sheet.addRow([`Total ${title}`, '', '', formatRupiah(total)]);
      sheet.getRow(rowIndex).font = { bold: true };
      rowIndex += 2;
    };

    addSection('A. PENDAPATAN', data.detailPendapatan, data.totalPendapatan, false);
    addSection('B. BEBAN', data.detailBeban, data.totalBeban, true);

    // SHU
    sheet.addRow(['S H U (Laba / Rugi)', '', '', formatRupiah(data.shu)]);
    sheet.getRow(rowIndex).font = { bold: true, size: 11 };
    if (data.shu >= 0) {
      sheet.getRow(rowIndex).font = { color: { argb: 'FF00AA00' } };
    } else {
      sheet.getRow(rowIndex).font = { color: { argb: 'FFFF0000' } };
    }

    sheet.getColumn(1).width = 40;
    sheet.getColumn(2).width = 15;
    sheet.getColumn(3).width = 15;
    sheet.getColumn(4).width = 20;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=phu-${new Date().toISOString().slice(0, 10)}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  }

  // ─── Export PDF ─────────────────────────────────────────────
  // Kop surat dibuat sama persis dengan neraca & arus kas (logo, nama
  // koperasi, nomor/tanggal badan hukum, alamat, garis pemisah tebal-tipis).
  // Kolom label/nilai pakai posisi x/width eksplisit (bukan `doc.page.width - 80`
  // dengan width sempit) supaya nama akun panjang tidak bertabrakan dengan
  // kolom nominal, dan warna teks selalu di-reset ke hitam sebelum menulis.
  async exportPdf(res, data, labelPeriode, unit, pengaturan) {
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'portrait' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=phu-${new Date().toISOString().slice(0, 10)}.pdf`);
    doc.pipe(res);

    const startX = 40;
    const pageWidth = doc.page.width - 80; // area konten (margin kiri+kanan 40)
    const labelX = startX;
    const labelWidth = pageWidth - 150;    // kolom uraian
    const valueX = startX + labelWidth;    // kolom nilai (rata kanan)
    const valueWidth = 150;
    const bottomLimit = doc.page.height - 60;
    const lineHeight = 16;

    const resetColor = () => doc.fillColor('#000');

    let y = 40;

    const ensureSpace = (needed = lineHeight) => {
      if (y + needed > bottomLimit) {
        doc.addPage({ margin: 40 });
        y = 40;
      }
    };

    const writeSectionTitle = (title) => {
      ensureSpace(lineHeight + 4);
      resetColor();
      doc.fontSize(10).font('Helvetica-Bold')
        .text(title, labelX, y, { width: pageWidth, underline: true });
      y += lineHeight;
    };

    const writeItemRow = (label, value, opts = {}) => {
      ensureSpace(lineHeight);
      const bold = !!opts.bold;
      const indent = opts.indent || 0;
      const color = opts.color || '#000';

      doc.fillColor(color).fontSize(9).font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .text(label, labelX + indent, y, { width: labelWidth - indent });

      doc.fillColor(color).fontSize(9).font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .text(formatRupiah(value), valueX, y, { width: valueWidth, align: 'right' });

      resetColor();
      y += lineHeight;
    };

    // ── 1. KOP KOPERASI (sama seperti neraca & arus kas) ──
    const logoPath = pengaturan?.logo_koperasi
      ? path.join(__dirname, '..', '..', 'public', 'uploads', 'pengaturan', pengaturan.logo_koperasi)
      : null;
    if (logoPath && fs.existsSync(logoPath)) {
      doc.image(logoPath, startX, y, { width: 60, height: 60 });
    }

    const namaKoperasi = pengaturan?.nama_koperasi || 'KOPERASI';
    resetColor();
    doc.fontSize(14).font('Helvetica-Bold').text(namaKoperasi, startX + 70, y + 5, {
      width: pageWidth - 70,
      align: 'center',
    });

    resetColor();
    doc.fontSize(8).font('Helvetica');
    const infoY = y + 25;
    const infoLines = [
      `Nomor : ${pengaturan?.no_badan_hukum || '-'}`,
      `Tanggal : ${formatTanggal(pengaturan?.tgl_badan_hukum)}`,
      pengaturan?.alamat_koperasi || 'Alamat Belum Diatur',
    ];
    infoLines.forEach((line, i) => {
      doc.text(line, startX + 70, infoY + i * 12, { width: pageWidth - 70, align: 'center' });
    });

    y += 75;
    doc.moveTo(startX, y).lineTo(startX + pageWidth, y).lineWidth(3).stroke('#000');
    y += 2;
    doc.moveTo(startX, y).lineTo(startX + pageWidth, y).lineWidth(1).stroke('#000');
    y += 15;

    // ── 2. JUDUL LAPORAN ──
    resetColor();
    doc.fontSize(11).font('Helvetica-Bold')
      .text('PERHITUNGAN HASIL USAHA (PHU)', labelX, y, { width: pageWidth, align: 'center' });
    y = doc.y + 6;

    resetColor();
    doc.fontSize(8).font('Helvetica')
      .text(`Periode: ${labelPeriode}`, labelX, y, { width: pageWidth, align: 'center' });
    y = doc.y + 2;

    if (unit) {
      resetColor();
      doc.fontSize(8).font('Helvetica')
        .text(`Unit Usaha: ${unit}`, labelX, y, { width: pageWidth, align: 'center' });
      y = doc.y + 2;
    }
    y += 12;

    // ── A. PENDAPATAN ──
    writeSectionTitle('A. PENDAPATAN');
    if (data.detailPendapatan.length > 0) {
      for (const item of data.detailPendapatan) {
        writeItemRow(`${item.kode} - ${item.nama}`, item.nilai, { indent: 10 });
      }
    } else {
      writeItemRow('(Tidak ada data)', 0, { indent: 10 });
    }
    writeItemRow('Total Pendapatan', data.totalPendapatan, { bold: true });
    y += 6;

    // ── B. BEBAN ──
    writeSectionTitle('B. BEBAN');
    if (data.detailBeban.length > 0) {
      for (const item of data.detailBeban) {
        writeItemRow(`${item.kode} - ${item.nama}`, -item.nilai, { indent: 10 });
      }
    } else {
      writeItemRow('(Tidak ada data)', 0, { indent: 10 });
    }
    writeItemRow('Total Beban', -data.totalBeban, { bold: true });
    y += 10;

    // ── SHU ──
    ensureSpace(lineHeight + 4);
    const shuColor = data.shu >= 0 ? '#00AA00' : '#FF0000';
    writeItemRow('S H U (Laba / Rugi)', data.shu, { bold: true, color: shuColor });

    doc.end();
  }
}

module.exports = new LaporanPhuController();