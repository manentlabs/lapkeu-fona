// src/controllers/ArusKasController.js
const { Transaksi, Akun, PengaturanWebsite, Jurnal, sequelize } = require('../models');
const { Op } = require('sequelize');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const akunRef = require('../config/akunReferensi');

// ─── Helper format Rupiah ────────────────────────────────────
function formatRupiah(value) {
  const num = parseFloat(value) || 0;
  return num.toLocaleString('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

// ─── Helper format tanggal ────────────────────────────────────
function formatTanggal(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

class ArusKasController {
  // ─── Helper: ambil total dari transaksi untuk akun tertentu ──
  async getTotalAkun(akunId, dari, sampai, unit = null) {
    const where = {
      [Op.or]: [
        { akun_debet_id: akunId },
        { akun_kredit_id: akunId }
      ]
    };
    if (dari) where.tanggal = { [Op.gte]: dari };
    if (sampai) where.tanggal = { ...where.tanggal, [Op.lte]: sampai };
    if (unit) where.unit_usaha = { [Op.like]: unit };

    const result = await Transaksi.sum('jumlah', { where });
    return parseFloat(result) || 0;
  }

  // ─── Helper: ambil akun berdasarkan kode ─────────────────────
  async getAkunByKode(kode) {
    return await Akun.findOne({ where: { kode_akun: kode } });
  }

  // ─── Helper: ambil semua anak akun dari parent kode ──────────
  async getAkunsByParentKode(kode) {
    const parent = await this.getAkunByKode(kode);
    if (!parent) return [];
    return await Akun.findAll({
      where: { parent_id: parent.id },
      order: [['kode_akun', 'ASC']]
    });
  }

  // ─── Helper: ambil detail akun dengan total ──────────────────
  async getAkunDetail(kode, dari, sampai, unit = null) {
    const akun = await this.getAkunByKode(kode);
    if (!akun) return null;
    const nilai = await this.getTotalAkun(akun.id, dari, sampai, unit);
    if (nilai === 0) return null;
    return { nama: akun.nama_akun, nilai };
  }

  // ─── Helper: ambil semua anak akun dengan total ──────────────
  async getGroupDetail(parentKode, dari, sampai, unit = null) {
    const parent = await this.getAkunByKode(parentKode);
    if (!parent) return [];
    const children = await Akun.findAll({
      where: { parent_id: parent.id },
      order: [['kode_akun', 'ASC']]
    });
    const result = [];
    for (const child of children) {
      const nilai = await this.getTotalAkun(child.id, dari, sampai, unit);
      if (nilai !== 0) {
        result.push({ nama: child.nama_akun, nilai });
      }
    }
    return result;
  }

  // ─── Helper: ambil total dari group ──────────────────────────
  async getGroupTotal(parentKode, dari, sampai, unit = null) {
    const items = await this.getGroupDetail(parentKode, dari, sampai, unit);
    return items.reduce((sum, item) => sum + item.nilai, 0);
  }

  // ─── Helper: ambil detail untuk daftar kode akun (bukan parent/child) ──
  async getKodeListDetail(kodeList, dari, sampai, unit = null, balik = false) {
    const result = [];
    for (const kode of kodeList) {
      const item = await this.getAkunDetail(kode, dari, sampai, unit);
      if (item) {
        result.push({ nama: item.nama, nilai: balik ? -item.nilai : item.nilai });
      }
    }
    return result;
  }

  // ─── Build Arus Kas ──────────────────────────────────────────
  async buildArusKas(dari, sampai, unit = null) {
    // ── A. AKTIVITAS OPERASI ──
    // Pendapatan
    const totalPendapatan = await this.getGroupTotal(akunRef.PENDAPATAN, dari, sampai, unit);
    // Beban
    const totalBeban = await this.getGroupTotal(akunRef.BEBAN, dari, sampai, unit);
    const shu = totalPendapatan - totalBeban;

    // Penyesuaian: Aset lancar operasional (kenaikan = penggunaan kas, negatif)
    const penyesuaianAset = await this.getKodeListDetail(
      akunRef.ASET_LANCAR_OPERASIONAL, dari, sampai, unit, true
    );

    // Kewajiban lancar (kenaikan = sumber kas, positif)
    const penyesuaianKewajiban = await this.getKodeListDetail(
      akunRef.KEWAJIBAN_LANCAR, dari, sampai, unit, false
    );

    const penyesuaian = [...penyesuaianAset, ...penyesuaianKewajiban];
    const totalPenyesuaian = penyesuaian.reduce((sum, item) => sum + item.nilai, 0);
    const totalOperasi = shu + totalPenyesuaian;

    // ── B. AKTIVITAS INVESTASI ──
    const investasi = await this.getKodeListDetail(
      akunRef.INVESTASI, dari, sampai, unit, true
    );
    const totalInvestasi = investasi.reduce((sum, item) => sum + item.nilai, 0);

    // ── C. AKTIVITAS PENDANAAN ──
    // Modal (positif)
    const pendanaanModal = await this.getKodeListDetail(
      akunRef.MODAL, dari, sampai, unit, false
    );

    // Utang jangka panjang (positif)
    const pendanaanUtang = await this.getKodeListDetail(
      akunRef.UTANG_JANGKA_PANJANG, dari, sampai, unit, false
    );

    const pendanaan = [...pendanaanModal, ...pendanaanUtang];
    const totalPendanaan = pendanaan.reduce((sum, item) => sum + item.nilai, 0);

    // ── D. SALDO KAS ──
    // Ambil semua akun kas (child dari akunRef.ASET_LANCAR yang namanya mengandung 'kas')
    const parentAsetLancar = await Akun.findOne({ where: { kode_akun: akunRef.ASET_LANCAR } });
    let akunKas = [];
    if (parentAsetLancar) {
      akunKas = await Akun.findAll({
        where: {
          parent_id: parentAsetLancar.id,
          nama_akun: { [Op.like]: '%kas%' } // perbaikan: Op.like untuk MySQL
        }
      });
    }

    // Kas awal: saldo awal + transaksi sebelum periode
    let kasAwal = 0;
    for (const akun of akunKas) {
      const saldoAwal = parseFloat(akun.saldo_awal) || 0;
      let transaksiSebelum = 0;
      if (dari) {
        const where = {
          [Op.or]: [
            { akun_debet_id: akun.id },
            { akun_kredit_id: akun.id }
          ],
          tanggal: { [Op.lt]: dari }
        };
        if (unit) where.unit_usaha = { [Op.like]: unit };
        transaksiSebelum = await Transaksi.sum('jumlah', { where }) || 0;
      }
      kasAwal += saldoAwal + transaksiSebelum;
    }

    const kasAkhir = kasAwal + totalOperasi + totalInvestasi + totalPendanaan;

    return {
      shu,
      penyesuaian,
      totalPenyesuaian,
      totalOperasi,
      investasi,
      totalInvestasi,
      pendanaan,
      totalPendanaan,
      kasAwal,
      kasAkhir
    };
  }

  // ─── ENDPOINT: GET /bendahara/arus-kas ──────────────────────
  async index(req, res) {
    try {
      const { dari, sampai, unit_usaha } = req.query;
      const queryDari = dari || new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0,10);
      const querySampai = sampai || new Date().toISOString().slice(0,10);

      const data = await this.buildArusKas(queryDari, querySampai, unit_usaha);
      const labelPeriode = formatTanggal(queryDari) + ' – ' + formatTanggal(querySampai);

      const daftarUnit = await Transaksi.findAll({
        attributes: [[sequelize.fn('DISTINCT', sequelize.col('unit_usaha')), 'unit']],
        where: { unit_usaha: { [Op.ne]: null } },
        raw: true
      });

      res.json({
        data,
        labelPeriode,
        dari: queryDari,
        sampai: querySampai,
        unit: unit_usaha || null,
        daftarUnit: daftarUnit.map(u => u.unit).filter(Boolean)
      });
    } catch (error) {
      console.error('Error Arus Kas:', error);
      res.status(500).json({ message: 'Gagal mengambil data arus kas', error: error.message });
    }
  }

  // ─── ENDPOINT: GET /bendahara/arus-kas/export ──────────────
  async export(req, res) {
    try {
      const { dari, sampai, unit_usaha, export: exportType } = req.query;
      const queryDari = dari || new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0,10);
      const querySampai = sampai || new Date().toISOString().slice(0,10);

      const data = await this.buildArusKas(queryDari, querySampai, unit_usaha);
      const labelBerjalan = formatTanggal(queryDari) + ' – ' + formatTanggal(querySampai);
      const namaFile = `arus-kas-${new Date().toISOString().slice(0,10)}`;

      // Ambil data pengaturan koperasi untuk kop surat (sama seperti neraca)
      const pengaturan = await PengaturanWebsite.findOne();

      if (exportType === 'pdf') {
        await this.exportPdf(res, data, labelBerjalan, queryDari, querySampai, unit_usaha, namaFile, pengaturan);
      } else if (exportType === 'excel') {
        await this.exportExcel(res, data, labelBerjalan, namaFile);
      } else {
        res.status(400).json({ message: 'Format export tidak didukung' });
      }
    } catch (error) {
      console.error('Error export arus kas:', error);
      res.status(500).json({ message: 'Gagal mengekspor arus kas' });
    }
  }

  // ─── Export PDF ─────────────────────────────────────────────
  // Kop surat dibuat sama persis dengan neraca (logo, nama koperasi,
  // nomor/tanggal badan hukum, alamat, garis pemisah tebal-tipis),
  // lalu isi laporan pakai posisi kolom eksplisit (x/y tetap) supaya
  // angka rupiah selalu sejajar dan tidak hilang saat pindah halaman.
  async exportPdf(res, data, labelBerjalan, dari, sampai, unit, namaFile, pengaturan) {
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'portrait' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${namaFile}.pdf`);
    doc.pipe(res);

    const startX = 40;
    const pageWidth = doc.page.width - 80; // area konten (margin kiri+kanan 40)
    const labelX = startX;
    const labelWidth = pageWidth - 150;    // kolom label
    const valueX = startX + labelWidth;    // kolom nilai (rata kanan)
    const valueWidth = 150;
    const bottomLimit = doc.page.height - 60;
    const lineHeight = 16;

    const formatRp = (val) => `Rp ${formatRupiah(val)}`;

    // Pastikan warna teks selalu hitam sebelum menulis apa pun
    const resetColor = () => doc.fillColor('#000');

    let y = 40;

    // Cek & pindah halaman kalau posisi y akan melewati batas bawah
    const ensureSpace = (needed = lineHeight) => {
      if (y + needed > bottomLimit) {
        doc.addPage({ margin: 40 });
        y = 40;
      }
    };

    // Tulis baris judul section (bold, underline)
    const writeSectionTitle = (title) => {
      ensureSpace(lineHeight + 4);
      resetColor();
      doc.fontSize(10).font('Helvetica-Bold')
        .text(title, labelX, y, { width: pageWidth, underline: true });
      y += lineHeight;
    };

    // Tulis satu baris label + nilai sejajar kolom
    const writeItemRow = (label, value, opts = {}) => {
      ensureSpace(lineHeight);
      resetColor();
      const bold = !!opts.bold;
      const indent = opts.indent || 0;

      doc.fontSize(9).font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .text(label, labelX + indent, y, { width: labelWidth - indent });

      doc.fontSize(9).font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .text(formatRp(value), valueX, y, { width: valueWidth, align: 'right' });

      y += lineHeight;
    };

    // ── 1. KOP KOPERASI (sama seperti neraca) ──
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
      .text('LAPORAN ARUS KAS', labelX, y, { width: pageWidth, align: 'center' });
    y = doc.y + 6;

    resetColor();
    doc.fontSize(8).font('Helvetica')
      .text(`Periode: ${labelBerjalan}`, labelX, y, { width: pageWidth, align: 'center' });
    y = doc.y + 2;

    if (unit) {
      resetColor();
      doc.fontSize(8).font('Helvetica')
        .text(`Unit Usaha: ${unit}`, labelX, y, { width: pageWidth, align: 'center' });
      y = doc.y + 2;
    }
    y += 12;

    // ── A. AKTIVITAS OPERASI ──
    writeSectionTitle('A. AKTIVITAS OPERASI');
    writeItemRow('SHU (Laba/Rugi)', data.shu, { indent: 10 });

    if (data.penyesuaian.length > 0) {
      writeItemRow('Penyesuaian:', '', { bold: true, indent: 10 });
      for (const p of data.penyesuaian) {
        writeItemRow(p.nama, p.nilai, { indent: 20 });
      }
    }
    writeItemRow('Total Penyesuaian', data.totalPenyesuaian, { bold: true, indent: 10 });
    writeItemRow('Arus Kas dari Aktivitas Operasi', data.totalOperasi, { bold: true });
    y += 6;

    // ── B. AKTIVITAS INVESTASI ──
    writeSectionTitle('B. AKTIVITAS INVESTASI');
    if (data.investasi.length > 0) {
      for (const p of data.investasi) {
        writeItemRow(p.nama, p.nilai, { indent: 10 });
      }
    } else {
      writeItemRow('Tidak ada transaksi', 0, { indent: 10 });
    }
    writeItemRow('Arus Kas dari Aktivitas Investasi', data.totalInvestasi, { bold: true });
    y += 6;

    // ── C. AKTIVITAS PENDANAAN ──
    writeSectionTitle('C. AKTIVITAS PENDANAAN');
    if (data.pendanaan.length > 0) {
      for (const p of data.pendanaan) {
        writeItemRow(p.nama, p.nilai, { indent: 10 });
      }
    } else {
      writeItemRow('Tidak ada transaksi', 0, { indent: 10 });
    }
    writeItemRow('Arus Kas dari Aktivitas Pendanaan', data.totalPendanaan, { bold: true });
    y += 6;

    // ── D. SALDO KAS ──
    writeSectionTitle('D. SALDO KAS');
    writeItemRow('Kas Awal', data.kasAwal, { indent: 10 });
    writeItemRow('Kas Akhir', data.kasAkhir, { bold: true, indent: 10 });

    doc.end();
  }

  // ─── Export Excel ───────────────────────────────────────────
  async exportExcel(res, data, labelBerjalan, namaFile) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Arus Kas');

    // Header
    sheet.mergeCells('A1:B1');
    sheet.getCell('A1').value = 'LAPORAN ARUS KAS';
    sheet.getCell('A1').font = { size: 14, bold: true };
    sheet.getCell('A1').alignment = { horizontal: 'center' };

    sheet.mergeCells('A2:B2');
    sheet.getCell('A2').value = `Periode: ${labelBerjalan}`;
    sheet.getCell('A2').font = { size: 10 };
    sheet.getCell('A2').alignment = { horizontal: 'center' };

    sheet.addRow([]);

    const formatRp = (val) => `Rp ${formatRupiah(val)}`;

    const sections = [
      { title: 'A. AKTIVITAS OPERASI', items: [] },
      { title: 'SHU (Laba/Rugi)', items: [{ label: 'SHU', value: data.shu }] },
      { title: 'Penyesuaian:', items: data.penyesuaian.map(p => ({ label: p.nama, value: p.nilai })) },
      { title: 'Total Penyesuaian', items: [{ label: '', value: data.totalPenyesuaian }] },
      { title: 'Arus Kas dari Operasi', items: [{ label: '', value: data.totalOperasi }] },
      { title: 'B. AKTIVITAS INVESTASI', items: data.investasi.length ? data.investasi.map(p => ({ label: p.nama, value: p.nilai })) : [{ label: 'Tidak ada transaksi', value: 0 }] },
      { title: 'Total Investasi', items: [{ label: '', value: data.totalInvestasi }] },
      { title: 'C. AKTIVITAS PENDANAAN', items: data.pendanaan.length ? data.pendanaan.map(p => ({ label: p.nama, value: p.nilai })) : [{ label: 'Tidak ada transaksi', value: 0 }] },
      { title: 'Total Pendanaan', items: [{ label: '', value: data.totalPendanaan }] },
      { title: 'D. SALDO KAS', items: [] },
      { title: 'Kas Awal', items: [{ label: '', value: data.kasAwal }] },
      { title: 'Kas Akhir', items: [{ label: '', value: data.kasAkhir }] },
    ];

    for (const section of sections) {
      if (section.items.length === 0) {
        const row = sheet.addRow([section.title]);
        row.font = { bold: true };
        continue;
      }

      // Section title
      let row = sheet.addRow([section.title]);
      row.font = { bold: true };
      row = sheet.addRow([]);

      for (const item of section.items) {
        const label = item.label;
        const value = item.value;
        const formatted = formatRp(value);
        if (label) {
          sheet.addRow([label, formatted]);
        } else {
          const r = sheet.addRow(['', formatted]);
          r.font = { bold: true };
        }
      }
      sheet.addRow([]);
    }

    // Set column widths
    sheet.getColumn(1).width = 40;
    sheet.getColumn(2).width = 25;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${namaFile}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  }
}

module.exports = new ArusKasController();