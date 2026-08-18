// src/controllers/AlokasiSHUController.js
const { Akun, Jurnal, Transaksi, sequelize, PersentaseSHU, AlokasiPersentase } = require('../models');
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

class AlokasiSHUController {
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

  // ─── Hitung mutasi akun ──────────────────────────────────
  async getMutasiAkun(akunId, dari, sampai, normalDebet = true) {
    const ids = await this.getDescendantIds(akunId);
    const where = { akun_id: ids };
    if (dari) where.tanggal = { [Op.gte]: dari };
    if (sampai) where.tanggal = { ...where.tanggal, [Op.lte]: sampai };

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

// ─── Hitung SHU ──────────────────────────────────────────
async getSHU(dari, sampai) {
  // Pendapatan (4000) - normalDebet = false (kredit)
  const pendapatanRoot = await Akun.findOne({ where: { kode_akun: '4000' } });
  let totalPendapatan = 0;
  if (pendapatanRoot) {
    totalPendapatan = await this.getMutasiAkun(pendapatanRoot.id, dari, sampai, false);
  }

  // Beban (5000) - normalDebet = true (debet)
  const bebanRoot = await Akun.findOne({ where: { kode_akun: '5000' } });
  let totalBeban = 0;
  if (bebanRoot) {
    totalBeban = await this.getMutasiAkun(bebanRoot.id, dari, sampai, true);
  }

  return totalPendapatan - totalBeban;
}

  // ─── Bangun data alokasi ─────────────────────────────────
  async buildAlokasi(dari, sampai) {
    const shu = await this.getSHU(dari, sampai);

    // Alokasi utama dari tabel persentase_shu
    const persentaseItems = await PersentaseSHU.findAll({
      order: [['id', 'ASC']],
    });

    const items = persentaseItems.map((item) => {
      const persen = parseFloat(item.persentase) || 0;
      const jumlah = Math.round(shu * persen / 100);
      return {
        id: item.id,
        keterangan: item.keterangan,
        persentase: persen,
        jumlah: jumlah,
      };
    });

    const totalPersentase = items.reduce((sum, i) => sum + i.persentase, 0);
    const totalJumlah = items.reduce((sum, i) => sum + i.jumlah, 0);

    // Dana Bagian Anggota sebagai dasar alokasi jasa
    const danaAnggota = items.find(i => i.keterangan === 'Dana Bagian Anggota');
    const shuAnggota = danaAnggota ? danaAnggota.jumlah : 0;

    // Alokasi jasa dari tabel alokasi_persentase
    const alokasiPersentase = await AlokasiPersentase.findAll({
      order: [['id', 'ASC']],
    });

    const alokasiJasa = alokasiPersentase.map((item) => ({
      id: item.id,
      keterangan: item.keterangan,
      persentase: parseFloat(item.persentase) || 0,
      jumlah: Math.round(shuAnggota * (parseFloat(item.persentase) || 0) / 100),
    }));

    return {
      shu,
      items,
      totalPersentase,
      totalJumlah,
      shuAnggota,
      alokasiJasa,
    };
  }

  // ─── ENDPOINT ─────────────────────────────────────────────
  async index(req, res) {
    try {
      let { dari, sampai } = req.query;
      const now = new Date();
      const defaultDari = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
      const defaultSampai = now.toISOString().slice(0, 10);

      const queryDari = dari || defaultDari;
      const querySampai = sampai || defaultSampai;

      const data = await this.buildAlokasi(queryDari, querySampai);
      const labelPeriode = `${formatTanggal(queryDari)} – ${formatTanggal(querySampai)}`;

      res.json({
        data,
        labelPeriode,
        dari: queryDari,
        sampai: querySampai,
      });
    } catch (error) {
      console.error('Error Alokasi SHU:', error);
      res.status(500).json({ message: 'Gagal mengambil data alokasi SHU', error: error.message });
    }
  }

  // ─── CRUD Alokasi Persentase ─────────────────────────────

  // GET semua alokasi persentase
  async getAlokasiPersentase(req, res) {
    try {
      const items = await AlokasiPersentase.findAll({
        order: [['id', 'ASC']],
      });
      res.json({ data: items });
    } catch (error) {
      res.status(500).json({ message: 'Gagal mengambil data alokasi persentase', error: error.message });
    }
  }

  // POST tambah alokasi persentase
  async storeAlokasiPersentase(req, res) {
    try {
      const { keterangan, persentase } = req.body;
      if (!keterangan || persentase === undefined) {
        return res.status(422).json({ message: 'Keterangan dan persentase wajib diisi' });
      }
      const item = await AlokasiPersentase.create({
        keterangan,
        persentase: parseFloat(persentase) || 0,
      });
      res.status(201).json({ message: 'Alokasi persentase berhasil ditambahkan', data: item });
    } catch (error) {
      res.status(500).json({ message: 'Gagal menambah alokasi persentase', error: error.message });
    }
  }

  // PUT update alokasi persentase
  async updateAlokasiPersentase(req, res) {
    try {
      const { id } = req.params;
      const { keterangan, persentase } = req.body;
      const item = await AlokasiPersentase.findByPk(id);
      if (!item) {
        return res.status(404).json({ message: 'Data tidak ditemukan' });
      }
      await item.update({
        keterangan: keterangan || item.keterangan,
        persentase: parseFloat(persentase) !== undefined ? parseFloat(persentase) : item.persentase,
      });
      res.json({ message: 'Alokasi persentase berhasil diperbarui', data: item });
    } catch (error) {
      res.status(500).json({ message: 'Gagal update alokasi persentase', error: error.message });
    }
  }

  // DELETE alokasi persentase
  async destroyAlokasiPersentase(req, res) {
    try {
      const { id } = req.params;
      const item = await AlokasiPersentase.findByPk(id);
      if (!item) {
        return res.status(404).json({ message: 'Data tidak ditemukan' });
      }
      await item.destroy();
      res.json({ message: 'Alokasi persentase berhasil dihapus' });
    } catch (error) {
      res.status(500).json({ message: 'Gagal hapus alokasi persentase', error: error.message });
    }
  }

  // ─── Export ────────────────────────────────────────────────
  async export(req, res) {
    try {
      let { dari, sampai, export: exportType } = req.query;
      const now = new Date();
      const defaultDari = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
      const defaultSampai = now.toISOString().slice(0, 10);

      const queryDari = dari || defaultDari;
      const querySampai = sampai || defaultSampai;

      const data = await this.buildAlokasi(queryDari, querySampai);
      const labelPeriode = `${formatTanggal(queryDari)} – ${formatTanggal(querySampai)}`;

      if (exportType === 'excel') {
        await this.exportExcel(res, data, labelPeriode);
      } else if (exportType === 'pdf') {
        await this.exportPdf(res, data, labelPeriode);
      } else {
        res.status(400).json({ message: 'Format export tidak didukung' });
      }
    } catch (error) {
      console.error('Error export Alokasi SHU:', error);
      res.status(500).json({ message: 'Gagal mengekspor alokasi SHU' });
    }
  }

  // ─── Export Excel ──────────────────────────────────────────
  async exportExcel(res, data, labelPeriode) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Alokasi SHU');

    sheet.mergeCells('A1:D1');
    sheet.getCell('A1').value = 'ALOKASI SISA HASIL USAHA (SHU)';
    sheet.getCell('A1').font = { size: 16, bold: true };
    sheet.getCell('A1').alignment = { horizontal: 'center' };

    sheet.mergeCells('A2:D2');
    sheet.getCell('A2').value = `Periode: ${labelPeriode}`;
    sheet.getCell('A2').alignment = { horizontal: 'center' };

    let rowIndex = 3;

    // SHU
    sheet.addRow(['Sisa Hasil Usaha (SHU)', formatRupiah(data.shu)]);
    sheet.getRow(rowIndex).font = { bold: true };
    rowIndex++;

    // Alokasi utama
    sheet.addRow(['ALOKASI SHU']);
    sheet.getRow(rowIndex).font = { bold: true };
    rowIndex++;

    const headers = ['Keterangan', 'Persentase', 'Jumlah'];
    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.alignment = { horizontal: 'center' };
    rowIndex++;

    for (const item of data.items) {
      sheet.addRow([item.keterangan, `${item.persentase}%`, formatRupiah(item.jumlah)]);
      rowIndex++;
    }

    sheet.addRow(['TOTAL', `${data.totalPersentase}%`, formatRupiah(data.totalJumlah)]);
    sheet.getRow(rowIndex).font = { bold: true };
    rowIndex += 2;

    // Alokasi jasa
    sheet.addRow(['ALOKASI JASA (DARI DANA BAGIAN ANGGOTA)']);
    sheet.getRow(rowIndex).font = { bold: true };
    rowIndex++;

    sheet.addRow(['Dana Bagian Anggota', '', formatRupiah(data.shuAnggota)]);
    rowIndex++;

    const jasaHeaders = ['Keterangan', 'Persentase', 'Jumlah'];
    const jasaHeaderRow = sheet.addRow(jasaHeaders);
    jasaHeaderRow.font = { bold: true };
    jasaHeaderRow.alignment = { horizontal: 'center' };
    rowIndex++;

    for (const item of data.alokasiJasa) {
      sheet.addRow([item.keterangan, `${item.persentase}%`, formatRupiah(item.jumlah)]);
      rowIndex++;
    }

    sheet.getColumn(1).width = 35;
    sheet.getColumn(2).width = 15;
    sheet.getColumn(3).width = 20;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=alokasi-shu-${new Date().toISOString().slice(0, 10)}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  }

  // ─── Export PDF ─────────────────────────────────────────────
  async exportPdf(res, data, labelPeriode) {
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'portrait' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=alokasi-shu-${new Date().toISOString().slice(0, 10)}.pdf`);
    doc.pipe(res);

    doc.fontSize(16).font('Helvetica-Bold').text('ALOKASI SISA HASIL USAHA (SHU)', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`Periode: ${labelPeriode}`, { align: 'center' });
    doc.moveDown(1);

    let currentY = doc.y;
    const startX = 40;

    // SHU
    doc.fontSize(10).font('Helvetica-Bold').text(`Sisa Hasil Usaha (SHU): ${formatRupiah(data.shu)}`, startX, currentY);
    currentY = doc.y + 10;

    // Alokasi utama
    doc.fontSize(11).font('Helvetica-Bold').text('ALOKASI SHU', startX, currentY);
    currentY = doc.y + 6;

    const colWidths = [180, 70, 100];
    const headers = ['Keterangan', 'Persentase', 'Jumlah'];
    const headerY = currentY;
    doc.rect(startX, headerY, colWidths.reduce((a, b) => a + b, 0), 18).fill('#6c757d');
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(8);
    let x = startX;
    headers.forEach((h, i) => {
      const align = i === 0 ? 'left' : 'right';
      doc.text(h, x + 4, headerY + 4, { width: colWidths[i] - 8, align });
      x += colWidths[i];
    });
    currentY = headerY + 18;
    doc.fillColor('#000').font('Helvetica').fontSize(8);

    for (const item of data.items) {
      if (currentY + 16 > doc.page.height - 50) {
        doc.addPage();
        currentY = 30;
        // Ulangi header
        const hY = currentY;
        doc.rect(startX, hY, colWidths.reduce((a, b) => a + b, 0), 18).fill('#6c757d');
        doc.fillColor('#fff').font('Helvetica-Bold').fontSize(8);
        x = startX;
        headers.forEach((h, i) => {
          const align = i === 0 ? 'left' : 'right';
          doc.text(h, x + 4, hY + 4, { width: colWidths[i] - 8, align });
          x += colWidths[i];
        });
        currentY = hY + 18;
        doc.fillColor('#000').font('Helvetica').fontSize(8);
      }
      doc.rect(startX, currentY, colWidths.reduce((a, b) => a + b, 0), 14).stroke();
      const row = [item.keterangan, `${item.persentase}%`, formatRupiah(item.jumlah)];
      x = startX;
      row.forEach((text, i) => {
        const align = i === 0 ? 'left' : 'right';
        doc.text(text, x + 4, currentY + 2, { width: colWidths[i] - 8, align });
        x += colWidths[i];
      });
      currentY += 14;
    }

    // Total
    doc.rect(startX, currentY, colWidths.reduce((a, b) => a + b, 0), 16).fill('#dee2e6');
    doc.fillColor('#000').font('Helvetica-Bold').fontSize(8);
    const totalRow = ['TOTAL', `${data.totalPersentase}%`, formatRupiah(data.totalJumlah)];
    x = startX;
    totalRow.forEach((text, i) => {
      const align = i === 0 ? 'left' : 'right';
      doc.text(text, x + 4, currentY + 2, { width: colWidths[i] - 8, align });
      x += colWidths[i];
    });
    currentY += 18;
    doc.moveDown(1);

    // Alokasi Jasa
    if (currentY + 40 > doc.page.height - 50) {
      doc.addPage();
      currentY = 30;
    }
    doc.fontSize(11).font('Helvetica-Bold').text('ALOKASI JASA (DARI DANA BAGIAN ANGGOTA)', startX, currentY);
    currentY = doc.y + 6;
    doc.fontSize(9).font('Helvetica').text(`Dana Bagian Anggota: ${formatRupiah(data.shuAnggota)}`, startX, currentY);
    currentY = doc.y + 8;

    const jasaHeaders = ['Keterangan', 'Persentase', 'Jumlah'];
    const jasaHeaderY = currentY;
    doc.rect(startX, jasaHeaderY, colWidths.reduce((a, b) => a + b, 0), 18).fill('#6c757d');
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(8);
    x = startX;
    jasaHeaders.forEach((h, i) => {
      const align = i === 0 ? 'left' : 'right';
      doc.text(h, x + 4, jasaHeaderY + 4, { width: colWidths[i] - 8, align });
      x += colWidths[i];
    });
    currentY = jasaHeaderY + 18;
    doc.fillColor('#000').font('Helvetica').fontSize(8);

    for (const item of data.alokasiJasa) {
      if (currentY + 16 > doc.page.height - 50) {
        doc.addPage();
        currentY = 30;
        // ulangi header
        const hY = currentY;
        doc.rect(startX, hY, colWidths.reduce((a, b) => a + b, 0), 18).fill('#6c757d');
        doc.fillColor('#fff').font('Helvetica-Bold').fontSize(8);
        x = startX;
        jasaHeaders.forEach((h, i) => {
          const align = i === 0 ? 'left' : 'right';
          doc.text(h, x + 4, hY + 4, { width: colWidths[i] - 8, align });
          x += colWidths[i];
        });
        currentY = hY + 18;
        doc.fillColor('#000').font('Helvetica').fontSize(8);
      }
      doc.rect(startX, currentY, colWidths.reduce((a, b) => a + b, 0), 14).stroke();
      const row = [item.keterangan, `${item.persentase}%`, formatRupiah(item.jumlah)];
      x = startX;
      row.forEach((text, i) => {
        const align = i === 0 ? 'left' : 'right';
        doc.text(text, x + 4, currentY + 2, { width: colWidths[i] - 8, align });
        x += colWidths[i];
      });
      currentY += 14;
    }

    doc.end();
  }
}

module.exports = new AlokasiSHUController();