const { Akun, Jurnal, Transaksi, PengaturanWebsite, sequelize } = require('../models');
const { Op } = require('sequelize');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const AKUN = require('../config/akunReferensi');

// ─── Helper format Rupiah ────────────────────────────────────
function formatRupiah(value) {
  const num = parseFloat(value) || 0;
  return num.toLocaleString('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

// ─── Helper format tanggal ──────────────────────────────────
function formatTanggal(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

class PerubahanModalController {
  // ─── Dapatkan semua descendant IDs ──────────────────────
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

  // ─── Hitung total mutasi akun (debet - kredit atau kredit - debet) ──
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

    // normalDebet = true (aset, beban) → debet - kredit
    // normalDebet = false (pendapatan, kewajiban, modal) → kredit - debet
    return normalDebet ? debet - kredit : kredit - debet;
  }

  // ─── Hitung total transaksi sebelum periode (untuk saldo awal) ──
  async getMutasiSebelum(akunId, dari, unit = null) {
    if (!dari) return 0;
    const ids = await this.getDescendantIds(akunId);
    const where = { akun_id: ids };
    where.tanggal = { [Op.lt]: dari };
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
    // Untuk modal (normal kredit), saldo = kredit - debet
    return kredit - debet;
  }

  // ─── Ambil akun by kode ────────────────────────────────────
  async getAkunByKode(kode) {
    if (!kode) return null;
    return await Akun.findOne({ where: { kode_akun: kode } });
  }

  // ─── Bangun data laporan perubahan modal ──────────────────
  async buildData(dari, sampai, unit = null) {
    // Mapping kode akun — semua diambil dari config/akunReferensi.js
    const kodes = {
      sp_pokok: AKUN.SP_POKOK,
      sp_wajib: AKUN.SP_WAJIB,
      shu: AKUN.SHU,
      cadangan: AKUN.CADANGAN,
      ekuitas: AKUN.EKUITAS_LAIN, // array, misal ['3160', '3170', '3180']
    };

    // ── 1. Saldo Awal ──────────────────────────────────────
    const saldoAwal = {
      sp_pokok: 0,
      sp_wajib: 0,
      shu: 0,
      cadangan: 0,
      ekuitas: 0,
    };

    // Simpanan Pokok
    const akunSpPokok = await this.getAkunByKode(kodes.sp_pokok);
    if (akunSpPokok) {
      saldoAwal.sp_pokok = (parseFloat(akunSpPokok.saldo_awal) || 0) +
        await this.getMutasiSebelum(akunSpPokok.id, dari, unit);
    }

    // Simpanan Wajib
    const akunSpWajib = await this.getAkunByKode(kodes.sp_wajib);
    if (akunSpWajib) {
      saldoAwal.sp_wajib = (parseFloat(akunSpWajib.saldo_awal) || 0) +
        await this.getMutasiSebelum(akunSpWajib.id, dari, unit);
    }

    // SHU
    const akunShu = await this.getAkunByKode(kodes.shu);
    if (akunShu) {
      saldoAwal.shu = (parseFloat(akunShu.saldo_awal) || 0) +
        await this.getMutasiSebelum(akunShu.id, dari, unit);
    }

    // Cadangan
    const akunCadangan = await this.getAkunByKode(kodes.cadangan);
    if (akunCadangan) {
      saldoAwal.cadangan = (parseFloat(akunCadangan.saldo_awal) || 0) +
        await this.getMutasiSebelum(akunCadangan.id, dari, unit);
    }

    // Ekuitas Lain (dari AKUN.EKUITAS_LAIN, misal 3160, 3170, 3180)
    saldoAwal.ekuitas = 0;
    for (const kode of kodes.ekuitas) {
      const akun = await this.getAkunByKode(kode);
      if (akun) {
        saldoAwal.ekuitas += (parseFloat(akun.saldo_awal) || 0) +
          await this.getMutasiSebelum(akun.id, dari, unit);
      }
    }

    // ── 2. Perubahan selama periode ────────────────────────

    // 2a. Sisa hasil usaha (SHU periode) = Pendapatan - Beban
    const akunPendapatan = await this.getAkunByKode(AKUN.PENDAPATAN);
    let totalPendapatan = 0;
    if (akunPendapatan) {
      const ids = await this.getDescendantIds(akunPendapatan.id);
      for (const id of ids) {
        totalPendapatan += await this.getMutasiAkun(id, dari, sampai, unit, false); // normalDebet = false
      }
    }

    const akunBeban = await this.getAkunByKode(AKUN.BEBAN);
    let totalBeban = 0;
    if (akunBeban) {
      const ids = await this.getDescendantIds(akunBeban.id);
      for (const id of ids) {
        totalBeban += await this.getMutasiAkun(id, dari, sampai, unit, true); // normalDebet = true
      }
    }

    const shuPeriode = totalPendapatan - totalBeban;

    // 2b. Penghasilan komprehensif lain
    const akunPkl = await this.getAkunByKode(AKUN.PKL);
    const pkl = akunPkl ? await this.getMutasiAkun(akunPkl.id, dari, sampai, unit, false) : 0;

    // 2c. Pembagian SHU
    const akunShuPeriod = await this.getAkunByKode(AKUN.SHU);
    const pembagianShu = akunShuPeriod ? await this.getMutasiAkun(akunShuPeriod.id, dari, sampai, unit, false) : 0;

    // 2d. Penambahan modal (simpanan pokok + wajib)
    const tambahPokok = akunSpPokok ? await this.getMutasiAkun(akunSpPokok.id, dari, sampai, unit, false) : 0;
    const tambahWajib = akunSpWajib ? await this.getMutasiAkun(akunSpWajib.id, dari, sampai, unit, false) : 0;

    // 2e. Pengurangan modal
    const akunKurang = await this.getAkunByKode(AKUN.PENGURANGAN_MODAL);
    let kurangPokok = 0;
    let kurangWajib = 0;
    if (akunKurang) {
      const totalKurang = await this.getMutasiAkun(akunKurang.id, dari, sampai, unit, false);
      // Asumsikan pengurangan modal dibagi rata ke pokok dan wajib (atau bisa sesuaikan)
      // Atau bisa ditampung di ekuitas lain. Di sini kita masukkan ke pengurangan.
      kurangPokok = totalKurang;
    }

    // 2f. Cadangan
    const tambahCadangan = akunCadangan ? await this.getMutasiAkun(akunCadangan.id, dari, sampai, unit, false) : 0;

    // ── Baris perubahan ──────────────────────────────────────
    const perubahan = [
      {
        label: 'Sisa hasil usaha',
        sp_pokok: 0,
        sp_wajib: 0,
        shu: shuPeriode,
        cadangan: 0,
        ekuitas: 0,
      },
      {
        label: 'Penghasilan komprehensif lain',
        sp_pokok: 0,
        sp_wajib: 0,
        shu: 0,
        cadangan: 0,
        ekuitas: pkl,
      },
      {
        label: 'Pembagian sisa hasil usaha',
        sp_pokok: 0,
        sp_wajib: 0,
        shu: -pembagianShu,
        cadangan: tambahCadangan,
        ekuitas: 0,
      },
      {
        label: 'Penambahan modal',
        sp_pokok: tambahPokok,
        sp_wajib: tambahWajib,
        shu: 0,
        cadangan: 0,
        ekuitas: 0,
      },
      {
        label: 'Pengurangan modal',
        sp_pokok: -kurangPokok,
        sp_wajib: -kurangWajib,
        shu: 0,
        cadangan: 0,
        ekuitas: 0,
      },
    ];

    // ── 3. Saldo Akhir ──────────────────────────────────────
    const cols = ['sp_pokok', 'sp_wajib', 'shu', 'cadangan', 'ekuitas'];
    const saldoAkhir = {};
    for (const col of cols) {
      const totalPerubahan = perubahan.reduce((sum, row) => sum + (row[col] || 0), 0);
      saldoAkhir[col] = (saldoAwal[col] || 0) + totalPerubahan;
    }

    // Label kolom untuk tampilan
    const labelCols = {
      sp_pokok: 'Simpanan Pokok',
      sp_wajib: 'Simpanan Wajib',
      shu: 'Sisa Hasil Usaha (SHU)',
      cadangan: 'Dana Cadangan',
      ekuitas: 'Ekuitas Lain',
    };

    return {
      saldoAwal,
      saldoAkhir,
      perubahan,
      labelCols,
    };
  }

  // ─── ENDPOINT: GET /api/bendahara/perubahan-modal ──────────
  async index(req, res) {
    try {
      let { dari, sampai, unit } = req.query;
      const now = new Date();
      const defaultDari = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10); // awal tahun
      const defaultSampai = now.toISOString().slice(0, 10);

      const queryDari = dari || defaultDari;
      const querySampai = sampai || defaultSampai;

      const data = await this.buildData(queryDari, querySampai, unit || null);

      // Daftar unit untuk filter dropdown
      const units = await Transaksi.findAll({
        attributes: [[sequelize.fn('DISTINCT', sequelize.col('unit_usaha')), 'unit_usaha']],
        where: { unit_usaha: { [Op.ne]: null } },
        raw: true,
        order: [['unit_usaha', 'ASC']],
      });
      const unitList = units.map(u => u.unit_usaha).filter(Boolean);

      const labelPeriode = `${formatTanggal(queryDari)} – ${formatTanggal(querySampai)}`;
      const tahunBuku = new Date(querySampai).getFullYear();

      res.json({
        data,
        labelPeriode,
        tahunBuku,
        dari: queryDari,
        sampai: querySampai,
        unit: unit || null,
        daftarUnit: unitList,
      });
    } catch (error) {
      console.error('Error Perubahan Modal:', error);
      res.status(500).json({ message: 'Gagal mengambil data perubahan modal', error: error.message });
    }
  }

  // ─── ENDPOINT: GET /api/bendahara/perubahan-modal/export ──
  async export(req, res) {
    try {
      let { dari, sampai, unit, export: exportType } = req.query;
      const now = new Date();
      const defaultDari = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
      const defaultSampai = now.toISOString().slice(0, 10);

      const queryDari = dari || defaultDari;
      const querySampai = sampai || defaultSampai;

      const data = await this.buildData(queryDari, querySampai, unit || null);
      const labelPeriode = `${formatTanggal(queryDari)} – ${formatTanggal(querySampai)}`;
      const tahunBuku = new Date(querySampai).getFullYear();

      if (exportType === 'excel') {
        await this.exportExcel(res, data, labelPeriode, tahunBuku, unit);
      } else if (exportType === 'pdf') {
        // Ambil data pengaturan koperasi untuk kop surat (sama seperti laporan lain)
        const pengaturan = await PengaturanWebsite.findOne();
        await this.exportPdf(res, data, labelPeriode, tahunBuku, unit, pengaturan);
      } else {
        res.status(400).json({ message: 'Format export tidak didukung' });
      }
    } catch (error) {
      console.error('Error export Perubahan Modal:', error);
      res.status(500).json({ message: 'Gagal mengekspor perubahan modal', error: error.message });
    }
  }

  // ─── Export Excel ──────────────────────────────────────────
  async exportExcel(res, data, labelPeriode, tahunBuku, unit) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Perubahan Modal');

    // Header
    sheet.mergeCells('A1:F1');
    sheet.getCell('A1').value = `LAPORAN PERUBAHAN MODAL`;
    sheet.getCell('A1').font = { size: 16, bold: true };
    sheet.getCell('A1').alignment = { horizontal: 'center' };

    sheet.mergeCells('A2:F2');
    sheet.getCell('A2').value = `Periode: ${labelPeriode}`;
    sheet.getCell('A2').alignment = { horizontal: 'center' };

    if (unit) {
      sheet.mergeCells('A3:F3');
      sheet.getCell('A3').value = `Unit Usaha: ${unit}`;
      sheet.getCell('A3').alignment = { horizontal: 'center' };
    }

    let rowIndex = 4;

    // Header tabel
    const headers = ['Uraian', 'Simpanan Pokok', 'Simpanan Wajib', 'Sisa Hasil Usaha', 'Dana Cadangan', 'Ekuitas Lain'];
    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 25;
    rowIndex++;

    // Saldo Awal
    const saldoAwalRow = sheet.addRow([
      'SALDO AWAL',
      formatRupiah(data.saldoAwal.sp_pokok),
      formatRupiah(data.saldoAwal.sp_wajib),
      formatRupiah(data.saldoAwal.shu),
      formatRupiah(data.saldoAwal.cadangan),
      formatRupiah(data.saldoAwal.ekuitas),
    ]);
    saldoAwalRow.font = { bold: true };
    rowIndex++;

    // Perubahan
    for (const row of data.perubahan) {
      sheet.addRow([
        row.label,
        formatRupiah(row.sp_pokok || 0),
        formatRupiah(row.sp_wajib || 0),
        formatRupiah(row.shu || 0),
        formatRupiah(row.cadangan || 0),
        formatRupiah(row.ekuitas || 0),
      ]);
      rowIndex++;
    }

    // Saldo Akhir
    const saldoAkhirRow = sheet.addRow([
      'SALDO AKHIR',
      formatRupiah(data.saldoAkhir.sp_pokok),
      formatRupiah(data.saldoAkhir.sp_wajib),
      formatRupiah(data.saldoAkhir.shu),
      formatRupiah(data.saldoAkhir.cadangan),
      formatRupiah(data.saldoAkhir.ekuitas),
    ]);
    saldoAkhirRow.font = { bold: true, size: 10 };
    rowIndex++;

    // Set column widths
    sheet.getColumn(1).width = 35;
    sheet.getColumn(2).width = 18;
    sheet.getColumn(3).width = 18;
    sheet.getColumn(4).width = 18;
    sheet.getColumn(5).width = 18;
    sheet.getColumn(6).width = 18;

    // Align numbers
    for (let i = 2; i <= 6; i++) {
      sheet.getColumn(i).alignment = { horizontal: 'right' };
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=perubahan-modal-${new Date().toISOString().slice(0, 10)}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  }

 // ─── Export PDF ─────────────────────────────────────────────
async exportPdf(res, data, labelPeriode, tahunBuku, unit, pengaturan) {
  // Hapus 'layout: landscape' → default portrait
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=perubahan-modal-${new Date().toISOString().slice(0, 10)}.pdf`);
  doc.pipe(res);

  const startX = 40;
  const pageWidth = doc.page.width - 80; // A4 portrait: 595.28 - 80 = 515.28
  let y = 40;

  const resetColor = () => doc.fillColor('#000');

  // ── 1. KOP KOPERASI (tetap) ──
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
    .text('LAPORAN PERUBAHAN MODAL', startX, y, { width: pageWidth, align: 'center' });
  y = doc.y + 6;

  resetColor();
  doc.fontSize(8).font('Helvetica')
    .text(`Periode: ${labelPeriode}`, startX, y, { width: pageWidth, align: 'center' });
  y = doc.y + 2;

  if (unit) {
    resetColor();
    doc.fontSize(8).font('Helvetica')
      .text(`Unit Usaha: ${unit}`, startX, y, { width: pageWidth, align: 'center' });
    y = doc.y + 2;
  }
  y += 12;

  let currentY = y;

  // ── LEBAR KOLOM DI SESUAIKAN UNTUK PORTRAIT ──
  // Total = 105 + 5*80 = 505 pt (masih di bawah 515 pt)
  const colWidths = [105, 80, 80, 80, 80, 80];
  const headers = ['Uraian', 'Simpanan Pokok', 'Simpanan Wajib', 'Sisa Hasil Usaha', 'Dana Cadangan', 'Ekuitas Lain'];

  // Tinggi header & baris disesuaikan
  const headerHeight = 16;
  const rowHeight = 13;
  const totalRowHeight = 16;

  const drawHeader = (yPos) => {
    resetColor();
    doc.rect(startX, yPos, colWidths.reduce((a, b) => a + b, 0), headerHeight).fill('#6c757d');
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(7); // ukuran font header 7
    let x = startX;
    headers.forEach((h, i) => {
      const align = i === 0 ? 'left' : 'right';
      doc.text(h, x + 3, yPos + 2, { width: colWidths[i] - 6, align });
      x += colWidths[i];
    });
    resetColor();
    doc.font('Helvetica').fontSize(7);
    return yPos + headerHeight;
  };

  let rowY = drawHeader(currentY);
  const pageHeight = doc.page.height - 60;

  const drawRow = (cells, isBold = false, isTotal = false) => {
    if (rowY + rowHeight + 5 > pageHeight) {
      doc.addPage({ margin: 40 });
      rowY = 40;
      rowY = drawHeader(rowY);
    }

    const rowH = isTotal ? totalRowHeight : rowHeight;
    if (isTotal) {
      doc.rect(startX, rowY, colWidths.reduce((a, b) => a + b, 0), rowH).fill('#dee2e6');
      resetColor();
    } else {
      doc.rect(startX, rowY, colWidths.reduce((a, b) => a + b, 0), rowH).stroke();
      resetColor();
    }

    doc.font(isBold || isTotal ? 'Helvetica-Bold' : 'Helvetica').fontSize(6.5); // ukuran data 6.5
    let x = startX;
    cells.forEach((text, i) => {
      const align = i === 0 ? 'left' : 'right';
      doc.text(text, x + 3, rowY + 2, { width: colWidths[i] - 6, align });
      x += colWidths[i];
    });
    rowY += rowH;
  };

  // ── ISI TABEL ──
  // Saldo Awal
  drawRow([
    'SALDO AWAL',
    formatRupiah(data.saldoAwal.sp_pokok),
    formatRupiah(data.saldoAwal.sp_wajib),
    formatRupiah(data.saldoAwal.shu),
    formatRupiah(data.saldoAwal.cadangan),
    formatRupiah(data.saldoAwal.ekuitas),
  ], true, false);

  // Perubahan
  for (const row of data.perubahan) {
    drawRow([
      row.label,
      formatRupiah(row.sp_pokok || 0),
      formatRupiah(row.sp_wajib || 0),
      formatRupiah(row.shu || 0),
      formatRupiah(row.cadangan || 0),
      formatRupiah(row.ekuitas || 0),
    ]);
  }

  // Saldo Akhir
  drawRow([
    'SALDO AKHIR',
    formatRupiah(data.saldoAkhir.sp_pokok),
    formatRupiah(data.saldoAkhir.sp_wajib),
    formatRupiah(data.saldoAkhir.shu),
    formatRupiah(data.saldoAkhir.cadangan),
    formatRupiah(data.saldoAkhir.ekuitas),
  ], true, true);

  doc.end();
}
}

module.exports = new PerubahanModalController();