// src/controllers/RencanaAnggaranController.js
const { Akun, Jurnal, Transaksi, RencanaAnggaran, sequelize } = require('../models');
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

class RencanaAnggaranController {
  // ── Helper: realisasi akun dalam tahun ────────────────────
  async getRealisasi(akunId, tahun) {
    const result = await Jurnal.findOne({
      attributes: [
        [sequelize.fn('SUM', sequelize.col('debet')), 'totalDebet'],
        [sequelize.fn('SUM', sequelize.col('kredit')), 'totalKredit'],
      ],
      where: {
        akun_id: akunId,
        tanggal: {
          [Op.gte]: `${tahun}-01-01`,
          [Op.lte]: `${tahun}-12-31`,
        }
      },
      raw: true,
    });
    const debet = parseFloat(result?.totalDebet) || 0;
    const kredit = parseFloat(result?.totalKredit) || 0;
    // Pendapatan di kredit, beban di debet; untuk ringkasan kita pakai selisih tergantung tipe akun
    // Tapi kita akan gunakan di konteks pendapatan (kredit - debet) dan beban (debet - kredit)
    // Kita seragamkan: kita ambil nilai absolut? Lebih baik kita kembalikan debet dan kredit, atau kita gunakan konteks.
    // Di sini kita hanya butuh angka total untuk pendapatan atau beban. Kita akan handle di level pemanggil.
    return { debet, kredit };
  }

  // ── Helper: rencana akun untuk tahun tertentu ─────────────
  async getRencana(akunId, tahun) {
    const r = await RencanaAnggaran.findOne({
      where: { akun_id: akunId, tahun },
    });
    return r ? parseFloat(r.jumlah) : 0;
  }

  // ── Build laporan ──────────────────────────────────────────
  async buildLaporan(tahunRealisasi) {
    const tahunRencanaBefore = tahunRealisasi;
    const tahunRencanaNext = tahunRealisasi + 1;

    const buildGroup = async (parentKode, isPendapatan = true) => {
      const parent = await Akun.findOne({ where: { kode_akun: parentKode } });
      if (!parent) return { items: [], totalRencanaBefore: 0, totalRealisasi: 0, totalRencanaNext: 0 };

      const children = await Akun.findAll({
        where: { parent_id: parent.id },
        order: [['kode_akun', 'ASC']],
      });

      const items = [];
      for (const akun of children) {
        const rencanaBefore = await this.getRencana(akun.id, tahunRencanaBefore);
        const realisasiData = await this.getRealisasi(akun.id, tahunRealisasi);
        // Untuk pendapatan: realisasi = kredit - debet (pendapatan di kredit)
        // Untuk beban: realisasi = debet - kredit (beban di debet)
        const realisasi = isPendapatan
          ? realisasiData.kredit - realisasiData.debet
          : realisasiData.debet - realisasiData.kredit;
        const rencanaNext = await this.getRencana(akun.id, tahunRencanaNext);

        const persentase = realisasi !== 0
          ? ((rencanaNext - realisasi) / Math.abs(realisasi)) * 100
          : (rencanaNext !== 0 ? 100 : 0);

        items.push({
          akun_id: akun.id,
          kode_akun: akun.kode_akun,
          nama: akun.nama_akun,
          rencanaBefore,
          realisasi,
          rencanaNext,
          persentase: parseFloat(persentase.toFixed(2)),
        });
      }

      return {
        items,
        totalRencanaBefore: items.reduce((s, i) => s + i.rencanaBefore, 0),
        totalRealisasi: items.reduce((s, i) => s + i.realisasi, 0),
        totalRencanaNext: items.reduce((s, i) => s + i.rencanaNext, 0),
      };
    };

    const pendapatan = await buildGroup('4000', true);
    const beban = await buildGroup('5000', false);

    const shuRencanaBefore = pendapatan.totalRencanaBefore - beban.totalRencanaBefore;
    const shuRealisasi = pendapatan.totalRealisasi - beban.totalRealisasi;
    const shuRencanaNext = pendapatan.totalRencanaNext - beban.totalRencanaNext;
    const shuPersentase = shuRealisasi !== 0
      ? ((shuRencanaNext - shuRealisasi) / Math.abs(shuRealisasi)) * 100
      : 0;

    return {
      pendapatan,
      beban,
      shuRencanaBefore,
      shuRealisasi,
      shuRencanaNext,
      shuPersentase: parseFloat(shuPersentase.toFixed(2)),
      tahunRencanaBefore,
      tahunRealisasi,
      tahunRencanaNext,
    };
  }

  // ── ENDPOINT: GET data ────────────────────────────────────
  async index(req, res) {
    try {
      const tahun = parseInt(req.query.tahun) || new Date().getFullYear();
      const data = await this.buildLaporan(tahun);

      // Daftar tahun untuk filter dropdown
      const currentYear = new Date().getFullYear();
      const daftarTahun = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

      // Akun untuk form input rencana (opsional, untuk edit inline)
      const akunPendapatan = await Akun.findAll({
        where: { parent_id: { [Op.in]: sequelize.literal('(SELECT id FROM akun WHERE kode_akun = "4000")') } },
        order: [['kode_akun', 'ASC']],
      });
      const akunBeban = await Akun.findAll({
        where: { parent_id: { [Op.in]: sequelize.literal('(SELECT id FROM akun WHERE kode_akun = "5000")') } },
        order: [['kode_akun', 'ASC']],
      });

      // Existing rencana untuk pre-fill
      const rencanaExisting = await RencanaAnggaran.findAll({
        where: {
          tahun: { [Op.in]: [tahun, tahun + 1] },
        },
      });
      const rencanaMap = {};
      for (const r of rencanaExisting) {
        rencanaMap[`${r.akun_id}_${r.tahun}`] = r;
      }

      res.json({
        data,
        tahun,
        daftarTahun,
        akunPendapatan,
        akunBeban,
        rencanaMap,
      });
    } catch (error) {
      console.error('Error Rencana Anggaran:', error);
      res.status(500).json({ message: 'Gagal mengambil data', error: error.message });
    }
  }

  // ── ENDPOINT: POST simpan rencana ────────────────────────
  async store(req, res) {
    try {
      const { tahun, rencana } = req.body;
      if (!tahun || !rencana || typeof rencana !== 'object') {
        return res.status(422).json({ message: 'Data tidak lengkap' });
      }

      const t = await sequelize.transaction();
      try {
        for (const [akunId, jumlah] of Object.entries(rencana)) {
          if (jumlah === null || jumlah === '' || isNaN(jumlah)) continue;
          await RencanaAnggaran.upsert({
            akun_id: parseInt(akunId),
            tahun: parseInt(tahun),
            jumlah: parseFloat(jumlah) || 0,
          }, { transaction: t });
        }
        await t.commit();
        res.json({ message: `Rencana anggaran tahun ${tahun} berhasil disimpan` });
      } catch (err) {
        await t.rollback();
        throw err;
      }
    } catch (error) {
      console.error('Error store rencana:', error);
      res.status(500).json({ message: 'Gagal menyimpan rencana anggaran', error: error.message });
    }
  }

  // ── ENDPOINT: Export ──────────────────────────────────────
  async export(req, res) {
    try {
      const tahun = parseInt(req.query.tahun) || new Date().getFullYear();
      const exportType = req.query.export || 'pdf';
      const data = await this.buildLaporan(tahun);

      if (exportType === 'excel') {
        await this.exportExcel(res, data, tahun);
      } else if (exportType === 'pdf') {
        await this.exportPdf(res, data, tahun);
      } else {
        res.status(400).json({ message: 'Format export tidak didukung' });
      }
    } catch (error) {
      console.error('Error export:', error);
      res.status(500).json({ message: 'Gagal mengekspor', error: error.message });
    }
  }

  // ─── Export Excel ──────────────────────────────────────────
  async exportExcel(res, data, tahun) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Rencana Anggaran');

    // Header
    sheet.mergeCells('A1:G1');
    sheet.getCell('A1').value = 'RENCANA DAN REALISASI ANGGARAN';
    sheet.getCell('A1').font = { size: 16, bold: true };
    sheet.getCell('A1').alignment = { horizontal: 'center' };

    sheet.mergeCells('A2:G2');
    sheet.getCell('A2').value = `Tahun: ${tahun}`;
    sheet.getCell('A2').alignment = { horizontal: 'center' };

    let rowIndex = 3;

    const addSection = (title, group, isPendapatan = true) => {
      sheet.addRow([title]);
      sheet.getRow(rowIndex).font = { bold: true, size: 12 };
      rowIndex++;

      const headers = ['Kode Akun', 'Nama Akun', `Rencana ${tahun}`, `Realisasi ${tahun}`, `Rencana ${tahun+1}`, 'Persentase (%)'];
      const headerRow = sheet.addRow(headers);
      headerRow.font = { bold: true };
      headerRow.alignment = { horizontal: 'center' };
      rowIndex++;

      for (const item of group.items) {
        sheet.addRow([
          item.kode_akun,
          item.nama,
          formatRupiah(item.rencanaBefore),
          formatRupiah(item.realisasi),
          formatRupiah(item.rencanaNext),
          item.persentase.toFixed(2)
        ]);
        rowIndex++;
      }

      // Total
      const totalRow = sheet.addRow([
        'TOTAL',
        '',
        formatRupiah(group.totalRencanaBefore),
        formatRupiah(group.totalRealisasi),
        formatRupiah(group.totalRencanaNext),
        ''
      ]);
      totalRow.font = { bold: true };
      rowIndex += 2;
    };

    addSection('PENDAPATAN', data.pendapatan, true);
    addSection('BEBAN', data.beban, false);

    // SHU
    sheet.addRow(['SISA HASIL USAHA (SHU)']);
    sheet.getRow(rowIndex).font = { bold: true };
    rowIndex++;

    const shuHeaders = ['', 'Rencana', 'Realisasi', 'Rencana Next', 'Persentase'];
    const shuHeaderRow = sheet.addRow(shuHeaders);
    shuHeaderRow.font = { bold: true };
    shuHeaderRow.alignment = { horizontal: 'center' };
    rowIndex++;

    sheet.addRow([
      'SHU',
      formatRupiah(data.shuRencanaBefore),
      formatRupiah(data.shuRealisasi),
      formatRupiah(data.shuRencanaNext),
      data.shuPersentase.toFixed(2)
    ]);
    rowIndex++;

    sheet.getColumn(1).width = 15;
    sheet.getColumn(2).width = 30;
    sheet.getColumn(3).width = 18;
    sheet.getColumn(4).width = 18;
    sheet.getColumn(5).width = 18;
    sheet.getColumn(6).width = 15;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=rencana-anggaran-${tahun}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  }

  // ─── Export PDF ────────────────────────────────────────────
  async exportPdf(res, data, tahun) {
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=rencana-anggaran-${tahun}.pdf`);
    doc.pipe(res);

    doc.fontSize(16).font('Helvetica-Bold').text('RENCANA DAN REALISASI ANGGARAN', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`Tahun: ${tahun}`, { align: 'center' });
    doc.moveDown(1);

    const startX = 30;
    let currentY = doc.y;

    const drawSection = (title, group) => {
      if (currentY + 40 > doc.page.height - 50) {
        doc.addPage({ layout: 'landscape' });
        currentY = 30;
      }
      doc.fontSize(11).font('Helvetica-Bold').text(title, startX, currentY);
      currentY = doc.y + 6;

      const colWidths = [80, 150, 80, 80, 80, 70];
      const headers = ['Kode', 'Nama Akun', `Rencana ${tahun}`, `Realisasi ${tahun}`, `Rencana ${tahun+1}`, '%'];

      // Header tabel
      const headerY = currentY;
      doc.rect(startX, headerY, colWidths.reduce((a, b) => a + b, 0), 18).fill('#6c757d');
      doc.fillColor('#fff').font('Helvetica-Bold').fontSize(7);
      let x = startX;
      headers.forEach((h, i) => {
        const align = i === 0 ? 'left' : 'right';
        doc.text(h, x + 4, headerY + 4, { width: colWidths[i] - 8, align });
        x += colWidths[i];
      });
      currentY = headerY + 18;
      doc.fillColor('#000').font('Helvetica').fontSize(7);

      for (const item of group.items) {
        if (currentY + 16 > doc.page.height - 50) {
          doc.addPage({ layout: 'landscape' });
          currentY = 30;
          // ulangi header
          const hY = currentY;
          doc.rect(startX, hY, colWidths.reduce((a, b) => a + b, 0), 18).fill('#6c757d');
          doc.fillColor('#fff').font('Helvetica-Bold').fontSize(7);
          x = startX;
          headers.forEach((h, i) => {
            const align = i === 0 ? 'left' : 'right';
            doc.text(h, x + 4, hY + 4, { width: colWidths[i] - 8, align });
            x += colWidths[i];
          });
          currentY = hY + 18;
          doc.fillColor('#000').font('Helvetica').fontSize(7);
        }
        doc.rect(startX, currentY, colWidths.reduce((a, b) => a + b, 0), 14).stroke();
        const row = [
          item.kode_akun,
          item.nama,
          formatRupiah(item.rencanaBefore),
          formatRupiah(item.realisasi),
          formatRupiah(item.rencanaNext),
          item.persentase.toFixed(2)
        ];
        x = startX;
        row.forEach((text, i) => {
          const align = i === 0 ? 'left' : 'right';
          doc.text(text, x + 4, currentY + 2, { width: colWidths[i] - 8, align });
          x += colWidths[i];
        });
        currentY += 14;
      }

      // Total
      if (currentY + 16 > doc.page.height - 50) {
        doc.addPage({ layout: 'landscape' });
        currentY = 30;
      }
      doc.rect(startX, currentY, colWidths.reduce((a, b) => a + b, 0), 16).fill('#dee2e6');
      doc.fillColor('#000').font('Helvetica-Bold').fontSize(8);
      const totalRow = [
        'TOTAL',
        '',
        formatRupiah(group.totalRencanaBefore),
        formatRupiah(group.totalRealisasi),
        formatRupiah(group.totalRencanaNext),
        ''
      ];
      x = startX;
      totalRow.forEach((text, i) => {
        const align = i === 0 ? 'left' : 'right';
        doc.text(text, x + 4, currentY + 2, { width: colWidths[i] - 8, align });
        x += colWidths[i];
      });
      currentY += 18;
      doc.moveDown(1);
    };

    drawSection('PENDAPATAN', data.pendapatan);
    drawSection('BEBAN', data.beban);

    // SHU
    if (currentY + 40 > doc.page.height - 50) {
      doc.addPage({ layout: 'landscape' });
      currentY = 30;
    }
    doc.fontSize(11).font('Helvetica-Bold').text('SISA HASIL USAHA (SHU)', startX, currentY);
    currentY = doc.y + 6;

    const shuCols = [120, 80, 80, 80];
    const shuHeaders2 = ['', 'Rencana', 'Realisasi', 'Rencana Next'];
    const shuHeaderY = currentY;
    doc.rect(startX, shuHeaderY, shuCols.reduce((a, b) => a + b, 0), 16).fill('#6c757d');
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(8);
    x = startX;
    shuHeaders2.forEach((h, i) => {
      const align = i === 0 ? 'left' : 'right';
      doc.text(h, x + 4, shuHeaderY + 3, { width: shuCols[i] - 8, align });
      x += shuCols[i];
    });
    currentY = shuHeaderY + 16;
    doc.fillColor('#000').font('Helvetica').fontSize(8);

    const shuRow = [
      'SHU',
      formatRupiah(data.shuRencanaBefore),
      formatRupiah(data.shuRealisasi),
      formatRupiah(data.shuRencanaNext)
    ];
    doc.rect(startX, currentY, shuCols.reduce((a, b) => a + b, 0), 14).stroke();
    x = startX;
    shuRow.forEach((text, i) => {
      const align = i === 0 ? 'left' : 'right';
      doc.text(text, x + 4, currentY + 2, { width: shuCols[i] - 8, align });
      x += shuCols[i];
    });
    currentY += 14;

    doc.end();
  }
}

module.exports = new RencanaAnggaranController();