// src/controllers/CatatanKeuanganController.js
const { Akun, Jurnal, Transaksi, sequelize } = require('../models');
const { Op } = require('sequelize');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

// ─── Helper ────────────────────────────────────────────────────
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

class CatatanKeuanganController {
  // ─── Helper: ambil semua descendant ID ────────────────────
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

  // ─── Hitung total mutasi (debet - kredit / kredit - debet) ──
  async getMutasiAkun(akunId, dari, sampai, unit = null, normalDebet = true) {
    const ids = await this.getDescendantIds(akunId);
    const where = { akun_id: ids };
    if (dari) where.tanggal = { [Op.gte]: dari };
    if (sampai) where.tanggal = { ...where.tanggal, [Op.lte]: sampai };
    if (unit) {
      const trxIds = await Transaksi.findAll({
        where: { unit_usaha: unit },
        attributes: ['id'],
        raw: true,
      });
      const idsTrx = trxIds.map(t => t.id);
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
    return normalDebet ? debet - kredit : kredit - debet;
  }

  // ─── Hitung total transaksi SEBELUM periode ──────────────
  async getMutasiSebelum(akunId, dari, unit = null) {
    if (!dari) return 0;
    const ids = await this.getDescendantIds(akunId);
    const where = { akun_id: ids };
    where.tanggal = { [Op.lt]: dari };
    if (unit) {
      const trxIds = await Transaksi.findAll({
        where: { unit_usaha: unit },
        attributes: ['id'],
        raw: true,
      });
      const idsTrx = trxIds.map(t => t.id);
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
    // Untuk akun normal kredit (pendapatan, modal, kewajiban), saldo = kredit - debet
    return kredit - debet;
  }

  // ─── Cek apakah blok punya nilai ──────────────────────────
  hasNilai(blok) {
    return blok.saldoAwal !== 0 ||
      blok.penambahan !== 0 ||
      blok.pengurangan !== 0 ||
      blok.saldoAkhir !== 0;
  }

  // ─── Ambil akun by kode ────────────────────────────────────
  async getAkunByKode(kode) {
    return await Akun.findOne({ where: { kode_akun: kode } });
  }

  // ─── Ambil akun by parent dan filter nama ─────────────────
  async getAkunByParentAndName(parentId, keyword) {
    return await Akun.findAll({
      where: {
        parent_id: parentId,
        nama_akun: { [Op.like]: `%${keyword}%` },
      },
      order: [['kode_akun', 'ASC']],
    });
  }

  async getAkunByName(keyword) {
    return await Akun.findAll({
      where: {
        nama_akun: { [Op.like]: `%${keyword}%` },
        parent_id: { [Op.ne]: null },
      },
      order: [['kode_akun', 'ASC']],
    });
  }

  // ─── Bangun seluruh catatan ───────────────────────────────
  async buildCatatan(dari, sampai, unit = null) {
    const tglAwal = dari ? new Date(dari) : new Date();
    const tglAkhi = sampai ? new Date(sampai) : new Date();
    const tahun = tglAkhi.getFullYear();
    const labelAwal = formatTanggal(new Date(tglAwal.getTime() - 86400000)); // H-1
    const labelAkhir = formatTanggal(sampai);

    const catatan = [];
    let nomor = 1;

    // ── 1. KAS dan Setara Kas ──────────────────────────────
    const parentKas = await this.getAkunByKode('1100');
    if (parentKas) {
      const akunKas = await this.getAkunByParentAndName(parentKas.id, 'kas');
      const akunBank = await this.getAkunByParentAndName(parentKas.id, 'bank');
      const semuaKas = [...akunKas, ...akunBank];
      const blokKas = [];

      for (const ak of semuaKas) {
        const saldoAwal = (parseFloat(ak.saldo_awal) || 0) + await this.getMutasiSebelum(ak.id, dari, unit);
        const penambahan = await this.getMutasiAkun(ak.id, dari, sampai, unit, true); // normalDebet = true (aset)
        // Untuk kas, penambahan = debet, pengurangan = 0 (karena kita tidak punya akun pengurang khusus)
        // Kita anggap semua mutasi sebagai penambahan, saldo akhir = saldo awal + penambahan
        const saldoAkhir = saldoAwal + penambahan;

        const blok = {
          nama: ak.nama_akun,
          labelSaldoAwal: `Saldo ${ak.nama_akun} Per ${labelAwal}`,
          labelPenambahan: `Penerimaan s.d ${labelAkhir}`,
          labelPengurangan: `Pengeluaran s.d ${labelAkhir}`,
          labelSaldoAkhir: `Saldo ${ak.nama_akun} ${labelAkhir}`,
          saldoAwal: saldoAwal,
          penambahan: penambahan,
          pengurangan: 0,
          saldoAkhir: saldoAkhir,
        };

        if (this.hasNilai(blok)) {
          blokKas.push(blok);
        }
      }

      if (blokKas.length > 0) {
        catatan.push({
          nomor: nomor++,
          judul: 'Kas dan Setara Kas',
          blok: blokKas,
        });
      }
    }

    // ── 2. PIUTANG ──────────────────────────────────────────
    const akunPiutang = await this.getAkunByName('piutang');
    for (const ak of akunPiutang) {
      const saldoAwal = (parseFloat(ak.saldo_awal) || 0) + await this.getMutasiSebelum(ak.id, dari, unit);
      const penambahan = await this.getMutasiAkun(ak.id, dari, sampai, unit, true);
      const saldoAkhir = saldoAwal + penambahan;

      const blok = {
        nama: ak.nama_akun,
        labelSaldoAwal: `Saldo Per ${labelAwal}`,
        labelPenambahan: `Pemberian pinjaman selama ${tahun}`,
        labelPengurangan: `Angsuran Pinjaman selama Tahun ${tahun}`,
        labelSaldoAkhir: `Saldo Per ${labelAkhir}`,
        saldoAwal: saldoAwal,
        penambahan: penambahan,
        pengurangan: 0,
        saldoAkhir: saldoAkhir,
      };

      if (this.hasNilai(blok)) {
        catatan.push({
          nomor: nomor++,
          judul: ak.nama_akun,
          blok: [blok],
        });
      }
    }

    // ── 3. PERSEDIAAN ───────────────────────────────────────
    const akunPersediaan = await this.getAkunByName('persediaan');
    for (const ak of akunPersediaan) {
      const saldoAwal = (parseFloat(ak.saldo_awal) || 0) + await this.getMutasiSebelum(ak.id, dari, unit);
      const penambahan = await this.getMutasiAkun(ak.id, dari, sampai, unit, true);
      const saldoAkhir = saldoAwal + penambahan;

      const blok = {
        nama: ak.nama_akun,
        labelSaldoAwal: `Saldo Per ${labelAwal}`,
        labelPenambahan: `Penambahan selama ${tahun}`,
        labelPengurangan: `Pengurangan selama ${tahun}`,
        labelSaldoAkhir: `Saldo Per ${labelAkhir}`,
        saldoAwal: saldoAwal,
        penambahan: penambahan,
        pengurangan: 0,
        saldoAkhir: saldoAkhir,
      };

      if (this.hasNilai(blok)) {
        catatan.push({
          nomor: nomor++,
          judul: ak.nama_akun,
          blok: [blok],
        });
      }
    }

    // ── 4. ASET TETAP ──────────────────────────────────────
    const parentAsetTetap = await Akun.findAll({
      where: {
        kode_akun: { [Op.in]: ['1200', '1300'] },
      },
    });
    for (const parent of parentAsetTetap) {
      const children = await Akun.findAll({
        where: { parent_id: parent.id },
        order: [['kode_akun', 'ASC']],
      });
      for (const ak of children) {
        if (ak.nama_akun.toLowerCase().includes('akumulasi')) continue;
        if (ak.nama_akun.toLowerCase().includes('penyusutan')) continue;

        const saldoAwal = (parseFloat(ak.saldo_awal) || 0) + await this.getMutasiSebelum(ak.id, dari, unit);
        const penambahan = await this.getMutasiAkun(ak.id, dari, sampai, unit, true);
        const saldoAkhir = saldoAwal + penambahan;

        const blok = {
          nama: ak.nama_akun,
          labelSaldoAwal: `Saldo Per ${labelAwal}`,
          labelPenambahan: `Penambahan selama ${tahun}`,
          labelPengurangan: `Pengurangan selama ${tahun}`,
          labelSaldoAkhir: `Saldo Per ${labelAkhir}`,
          saldoAwal: saldoAwal,
          penambahan: penambahan,
          pengurangan: 0,
          saldoAkhir: saldoAkhir,
        };

        if (this.hasNilai(blok)) {
          catatan.push({
            nomor: nomor++,
            judul: ak.nama_akun,
            blok: [blok],
          });
        }
      }
    }

    return catatan;
  }

  // ─── ENDPOINT ──────────────────────────────────────────────
  async index(req, res) {
    try {
      let { dari, sampai, unit } = req.query;
      const now = new Date();
      const defaultDari = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
      const defaultSampai = now.toISOString().slice(0, 10);

      const queryDari = dari || defaultDari;
      const querySampai = sampai || defaultSampai;

      const catatan = await this.buildCatatan(queryDari, querySampai, unit || null);

      const daftarUnit = await Transaksi.findAll({
        attributes: [[sequelize.fn('DISTINCT', sequelize.col('unit_usaha')), 'unit_usaha']],
        where: { unit_usaha: { [Op.ne]: null } },
        raw: true,
        order: [['unit_usaha', 'ASC']],
      });
      const unitList = daftarUnit.map(u => u.unit_usaha).filter(Boolean);

      const labelPeriode = `${formatTanggal(queryDari)} – ${formatTanggal(querySampai)}`;
      const tahunBuku = new Date(querySampai).getFullYear();

      res.json({
        data: catatan,
        labelPeriode,
        tahunBuku,
        dari: queryDari,
        sampai: querySampai,
        unit: unit || null,
        daftarUnit: unitList,
      });
    } catch (error) {
      console.error('Error Catatan Keuangan:', error);
      res.status(500).json({ message: 'Gagal mengambil catatan keuangan', error: error.message });
    }
  }

  // ─── EXPORT ─────────────────────────────────────────────────
  async export(req, res) {
    try {
      let { dari, sampai, unit, export: exportType } = req.query;
      const now = new Date();
      const defaultDari = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
      const defaultSampai = now.toISOString().slice(0, 10);

      const queryDari = dari || defaultDari;
      const querySampai = sampai || defaultSampai;

      const catatan = await this.buildCatatan(queryDari, querySampai, unit || null);
      const labelPeriode = `${formatTanggal(queryDari)} – ${formatTanggal(querySampai)}`;
      const tahunBuku = new Date(querySampai).getFullYear();

      if (exportType === 'excel') {
        await this.exportExcel(res, catatan, labelPeriode, tahunBuku, unit);
      } else if (exportType === 'pdf') {
        await this.exportPdf(res, catatan, labelPeriode, tahunBuku, unit);
      } else {
        res.status(400).json({ message: 'Format export tidak didukung' });
      }
    } catch (error) {
      console.error('Error export Catatan Keuangan:', error);
      res.status(500).json({ message: 'Gagal mengekspor catatan keuangan', error: error.message });
    }
  }

  // ─── Export Excel ──────────────────────────────────────────
  async exportExcel(res, catatan, labelPeriode, tahunBuku, unit) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Catatan Keuangan');

    // Header
    sheet.mergeCells('A1:E1');
    sheet.getCell('A1').value = 'CATATAN ATAS LAPORAN KEUANGAN';
    sheet.getCell('A1').font = { size: 16, bold: true };
    sheet.getCell('A1').alignment = { horizontal: 'center' };

    sheet.mergeCells('A2:E2');
    sheet.getCell('A2').value = `Periode: ${labelPeriode}`;
    sheet.getCell('A2').alignment = { horizontal: 'center' };
    if (unit) {
      sheet.mergeCells('A3:E3');
      sheet.getCell('A3').value = `Unit Usaha: ${unit}`;
      sheet.getCell('A3').alignment = { horizontal: 'center' };
    }

    let rowIndex = 4;

    for (const item of catatan) {
      // Judul seksi
      sheet.addRow([`${item.nomor}. ${item.judul}`]);
      const titleRow = sheet.getRow(rowIndex);
      titleRow.font = { bold: true, size: 11 };
      rowIndex++;

      // Header tabel
      const headers = ['Uraian', 'Saldo Awal', 'Penambahan', 'Pengurangan', 'Saldo Akhir'];
      const headerRow = sheet.addRow(headers);
      headerRow.font = { bold: true };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
      rowIndex++;

      // Data
      for (const blok of item.blok) {
        const rows = [
          [blok.labelSaldoAwal || 'Saldo Awal', blok.saldoAwal, 0, 0, 0],
          [blok.labelPenambahan || 'Penambahan', 0, blok.penambahan, 0, 0],
          [blok.labelPengurangan || 'Pengurangan', 0, 0, blok.pengurangan, 0],
          [blok.labelSaldoAkhir || 'Saldo Akhir', 0, 0, 0, blok.saldoAkhir],
        ];
        for (const row of rows) {
          sheet.addRow(row);
          rowIndex++;
        }
        // Tambah baris kosong antar blok
        sheet.addRow([]);
        rowIndex++;
      }

      // Spasi antar seksi
      sheet.addRow([]);
      rowIndex++;
    }

    // Set column widths
    sheet.getColumn(1).width = 40;
    sheet.getColumn(2).width = 18;
    sheet.getColumn(3).width = 18;
    sheet.getColumn(4).width = 18;
    sheet.getColumn(5).width = 18;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=catatan-keuangan-${new Date().toISOString().slice(0, 10)}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  }

  // ─── Export PDF ─────────────────────────────────────────────
  async exportPdf(res, catatan, labelPeriode, tahunBuku, unit) {
    // Ambil data pengaturan koperasi untuk kop surat
    const PengaturanWebsite = require('../models').PengaturanWebsite;
    const pengaturan = await PengaturanWebsite.findOne();

    const doc = new PDFDocument({ margin: 40, size: 'A4' }); // default portrait
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=catatan-keuangan-${new Date().toISOString().slice(0, 10)}.pdf`);
    doc.pipe(res);

    const startX = 40;
    const pageWidth = doc.page.width - 80; // A4 portrait ~515 pt
    let y = 40;

    const resetColor = () => doc.fillColor('#000');

    // ── 1. KOP KOPERASI ──
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
      .text('CATATAN ATAS LAPORAN KEUANGAN', startX, y, { width: pageWidth, align: 'center' });
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
    const pageHeight = doc.page.height - 60;

    // ── 3. TABEL ──
    const colWidths = [180, 80, 80, 80, 80]; // Uraian, Saldo Awal, Penambahan, Pengurangan, Saldo Akhir
    const headers = ['Uraian', 'Saldo Awal', 'Penambahan', 'Pengurangan', 'Saldo Akhir'];
    const headerHeight = 16;
    const rowHeight = 13;
    const totalRowHeight = 16;

    const drawHeader = (yPos) => {
      resetColor();
      doc.rect(startX, yPos, colWidths.reduce((a, b) => a + b, 0), headerHeight).fill('#6c757d');
      doc.fillColor('#fff').font('Helvetica-Bold').fontSize(7);
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

    const drawRow = (cells, isBold = false, isTotal = false, bgColor = null) => {
      if (currentY + rowHeight + 5 > pageHeight) {
        doc.addPage();
        currentY = 40;
        currentY = drawHeader(currentY);
      }

      const rowH = isTotal ? totalRowHeight : rowHeight;
      if (bgColor) {
        doc.rect(startX, currentY, colWidths.reduce((a, b) => a + b, 0), rowH).fill(bgColor);
        resetColor();
      } else {
        doc.rect(startX, currentY, colWidths.reduce((a, b) => a + b, 0), rowH).stroke();
        resetColor();
      }

      doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(6.5);
      let x = startX;
      cells.forEach((text, i) => {
        const align = i === 0 ? 'left' : 'right';
        doc.text(text, x + 3, currentY + 2, { width: colWidths[i] - 6, align });
        x += colWidths[i];
      });
      currentY += rowH;
    };

    // ── Loop setiap item catatan ──
    for (const item of catatan) {
      // Judul seksi (misal "1. Kas dan Setara Kas")
      const title = `${item.nomor}. ${item.judul}`;
      drawRow([title, '', '', '', ''], true, false, '#e9ecef');

      for (const blok of item.blok) {
        // Nama akun sebagai sub-judul (opsional)
        drawRow([blok.nama || '', '', '', '', ''], true, false, '#f1f3f5');

        // Baris Saldo Awal
        drawRow([
          blok.labelSaldoAwal || 'Saldo Awal',
          formatRupiah(blok.saldoAwal),
          '',
          '',
          ''
        ]);

        // Baris Penambahan
        drawRow([
          blok.labelPenambahan || 'Penambahan',
          '',
          formatRupiah(blok.penambahan),
          '',
          ''
        ]);

        // Baris Pengurangan
        drawRow([
          blok.labelPengurangan || 'Pengurangan',
          '',
          '',
          formatRupiah(blok.pengurangan),
          ''
        ]);

        // Baris Saldo Akhir (dengan latar abu-abu)
        drawRow([
          blok.labelSaldoAkhir || 'Saldo Akhir',
          '',
          '',
          '',
          formatRupiah(blok.saldoAkhir)
        ], true, true, '#dee2e6');

        // Spasi antar blok
        currentY += 4;
      }

      // Spasi antar seksi
      currentY += 6;
    }

    doc.end();
  }
}

module.exports = new CatatanKeuanganController();