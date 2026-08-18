// src/controllers/AnalisaKeuanganController.js
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

class AnalisaKeuanganController {
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
    return normalDebet ? debet - kredit : kredit - debet;
  }

  // ─── Hitung mutasi sebelum periode ──────────────────────
  async getMutasiSebelum(akunId, dari, unit = null, normalDebet = true) {
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
    // normalDebet = true (aset, beban) → debet - kredit
    // normalDebet = false (pendapatan, kewajiban, modal) → kredit - debet
    return normalDebet ? debet - kredit : kredit - debet;
  }

  // ─── Ambil saldo akun (saldo_awal akun + mutasi sebelum periode + mutasi periode) ────────
  async getSaldoAkun(akunId, dari, sampai, unit = null, normalDebet = true) {
    const akun = await Akun.findByPk(akunId, { attributes: ['id', 'saldo_awal'] });
    const saldoAwalAkun = parseFloat(akun?.saldo_awal) || 0;
    const mutasiSebelum = await this.getMutasiSebelum(akunId, dari, unit, normalDebet);
    const mutasiPeriode = await this.getMutasiAkun(akunId, dari, sampai, unit, normalDebet);
    return saldoAwalAkun + mutasiSebelum + mutasiPeriode;
  }

  // ─── Dapatkan total grup akun berdasarkan parent kode ──
  async getTotalGroup(parentKode, dari, sampai, unit = null, normalDebet = true) {
    const parent = await Akun.findOne({ where: { kode_akun: parentKode } });
    if (!parent) return 0;
    const children = await Akun.findAll({
      where: { parent_id: parent.id },
    });
    let total = 0;
    for (const child of children) {
      total += await this.getSaldoAkun(child.id, dari, sampai, unit, normalDebet);
    }
    return total;
  }

  // ─── Build analisa ──────────────────────────────────────────
  async buildAnalisa(dari, sampai, unit = null) {
    // ── PENDAPATAN & BEBAN ────────────────────────────────
    const totalPendapatan = await this.getTotalGroup('4000', dari, sampai, unit, false);
    const totalBeban = await this.getTotalGroup('5000', dari, sampai, unit, true);
    const shu = totalPendapatan - totalBeban;

    // ── ASET ──────────────────────────────────────────────
    // Aset Lancar (1100)
    const parentAL = await Akun.findOne({ where: { kode_akun: '1100' } });
    let asetLancar = 0;
    if (parentAL) {
      const children = await Akun.findAll({ where: { parent_id: parentAL.id } });
      for (const child of children) {
        asetLancar += await this.getSaldoAkun(child.id, dari, sampai, unit, true);
      }
    }

    // Kas & setara kas (di bawah 1100, mengandung kas/bank)
    let kas = 0;
    if (parentAL) {
      const akunKasBank = await Akun.findAll({
        where: {
          parent_id: parentAL.id,
          [Op.or]: [
            { nama_akun: { [Op.like]: '%kas%' } },
            { nama_akun: { [Op.like]: '%bank%' } },
          ],
        },
      });
      for (const ak of akunKasBank) {
        kas += await this.getSaldoAkun(ak.id, dari, sampai, unit, true);
      }
    }

    // Piutang
    const akunPiutang = await Akun.findAll({
      where: {
        nama_akun: { [Op.like]: '%piutang%' },
        parent_id: { [Op.ne]: null },
      },
    });
    let piutang = 0;
    for (const ak of akunPiutang) {
      piutang += await this.getSaldoAkun(ak.id, dari, sampai, unit, true);
    }

    // Aset Tetap (1200 + 1300)
    let asetTetap = 0;
    for (const kode of ['1200', '1300']) {
      const parent = await Akun.findOne({ where: { kode_akun: kode } });
      if (parent) {
        const children = await Akun.findAll({ where: { parent_id: parent.id } });
        for (const child of children) {
          asetTetap += await this.getSaldoAkun(child.id, dari, sampai, unit, true);
        }
      }
    }

    const totalAset = asetLancar + asetTetap;

    // ── KEWAJIBAN ──────────────────────────────────────────
    // Kewajiban Lancar (2100)
    const parentKL = await Akun.findOne({ where: { kode_akun: '2100' } });
    let kewajibanLancar = 0;
    if (parentKL) {
      const children = await Akun.findAll({ where: { parent_id: parentKL.id } });
      for (const child of children) {
        kewajibanLancar += await this.getSaldoAkun(child.id, dari, sampai, unit, false);
      }
    }

    // Kewajiban Jangka Panjang (2200)
    const parentKP = await Akun.findOne({ where: { kode_akun: '2200' } });
    let kewajibanPanjang = 0;
    if (parentKP) {
      const children = await Akun.findAll({ where: { parent_id: parentKP.id } });
      for (const child of children) {
        kewajibanPanjang += await this.getSaldoAkun(child.id, dari, sampai, unit, false);
      }
    }

    const totalKewajiban = kewajibanLancar + kewajibanPanjang;

    // ── EKUITAS / MODAL ────────────────────────────────────
    const parentEkuitas = await Akun.findOne({ where: { kode_akun: '3000' } });
    let ekuitas = 0;
    if (parentEkuitas) {
      const children = await Akun.findAll({ where: { parent_id: parentEkuitas.id } });
      for (const child of children) {
        ekuitas += await this.getSaldoAkun(child.id, dari, sampai, unit, false);
      }
    }
    // Fallback
    if (Math.abs(ekuitas) < 0.01 && totalAset !== 0) {
      ekuitas = totalAset - totalKewajiban;
    }

    // ── RASIO KEUANGAN ────────────────────────────────────
    const currentRatio = kewajibanLancar !== 0 ? asetLancar / kewajibanLancar : null;
    const cashRatio = kewajibanLancar !== 0 ? kas / kewajibanLancar : null;
    const quickRatio = kewajibanLancar !== 0 ? (asetLancar - piutang) / kewajibanLancar : null;

    const dta = totalAset !== 0 ? totalKewajiban / totalAset : null;
    const dte = ekuitas !== 0 ? totalKewajiban / ekuitas : null;
    const etar = totalAset !== 0 ? ekuitas / totalAset : null;

    const npm = totalPendapatan !== 0 ? (shu / totalPendapatan) * 100 : null;
    const roa = totalAset !== 0 ? (shu / totalAset) * 100 : null;
    const roe = ekuitas !== 0 ? (shu / ekuitas) * 100 : null;

    const assetTurnover = totalAset !== 0 ? totalPendapatan / totalAset : null;

    // ── Interpretasi ──────────────────────────────────────
    const interpret = (val, tipe) => {
      if (val === null || val === undefined) return 'Data tidak cukup';
      switch (tipe) {
        case 'current_ratio':
          return val >= 2 ? 'Sangat Baik' : val >= 1 ? 'Baik' : 'Perlu Perhatian';
        case 'cash_ratio':
          return val >= 1 ? 'Sangat Baik' : val >= 0.5 ? 'Baik' : 'Perlu Perhatian';
        case 'dta':
          return val <= 0.5 ? 'Sangat Baik' : val <= 0.7 ? 'Baik' : 'Perlu Perhatian';
        case 'dte':
          return val <= 1 ? 'Sangat Baik' : val <= 2 ? 'Baik' : 'Perlu Perhatian';
        case 'npm':
          return val >= 10 ? 'Sangat Baik' : val >= 5 ? 'Baik' : val >= 0 ? 'Cukup' : 'Merugi';
        case 'roa':
          return val >= 5 ? 'Sangat Baik' : val >= 2 ? 'Baik' : val >= 0 ? 'Cukup' : 'Merugi';
        case 'roe':
          return val >= 10 ? 'Sangat Baik' : val >= 5 ? 'Baik' : val >= 0 ? 'Cukup' : 'Merugi';
        case 'turnover':
          return val >= 1 ? 'Efisien' : val >= 0.5 ? 'Cukup' : 'Perlu Perhatian';
        default:
          return '-';
      }
    };

    const getWarna = (status) => {
      const map = {
        'Sangat Baik': 'success',
        'Baik': 'primary',
        'Efisien': 'primary',
        'Cukup': 'warning',
        'Perlu Perhatian': 'danger',
        'Merugi': 'danger',
        'Data tidak cukup': 'secondary',
      };
      return map[status] || 'secondary';
    };

    const fmt = (v) => v !== null ? parseFloat(v).toFixed(2) : '-';
    const fmtRp = (v) => `Rp ${formatRupiah(v)}`;

    // ── Posisi Keuangan ──────────────────────────────────
    const posisi = [
      { label: 'Total Aset', nilai: fmtRp(totalAset) },
      { label: 'Total Kewajiban', nilai: fmtRp(totalKewajiban) },
      { label: 'Total Ekuitas / Modal', nilai: fmtRp(ekuitas) },
      { label: 'Total Pendapatan', nilai: fmtRp(totalPendapatan) },
      { label: 'Total Beban', nilai: fmtRp(totalBeban) },
      { label: 'Sisa Hasil Usaha (SHU)', nilai: fmtRp(shu) },
    ];

    // ── Kelompok Rasio ──────────────────────────────────
    const rasio = [
      {
        kelompok: 'Rasio Likuiditas',
        deskripsi: 'Mengukur kemampuan koperasi memenuhi kewajiban jangka pendek.',
        items: [
          {
            nama: 'Current Ratio',
            rumus: 'Aset Lancar ÷ Kewajiban Lancar',
            nilai: currentRatio,
            format: fmt(currentRatio) + 'x',
            status: interpret(currentRatio, 'current_ratio'),
            warna: getWarna(interpret(currentRatio, 'current_ratio')),
            acuan: '≥ 2x = Baik',
          },
          {
            nama: 'Cash Ratio',
            rumus: 'Kas & Setara Kas ÷ Kewajiban Lancar',
            nilai: cashRatio,
            format: fmt(cashRatio) + 'x',
            status: interpret(cashRatio, 'cash_ratio'),
            warna: getWarna(interpret(cashRatio, 'cash_ratio')),
            acuan: '≥ 1x = Baik',
          },
        ],
      },
      {
        kelompok: 'Rasio Solvabilitas',
        deskripsi: 'Mengukur kemampuan koperasi memenuhi seluruh kewajibannya.',
        items: [
          {
            nama: 'Debt to Asset Ratio',
            rumus: 'Total Kewajiban ÷ Total Aset',
            nilai: dta,
            format: fmt(dta) + 'x',
            status: interpret(dta, 'dta'),
            warna: getWarna(interpret(dta, 'dta')),
            acuan: '≤ 0.5x = Baik',
          },
          {
            nama: 'Debt to Equity Ratio',
            rumus: 'Total Kewajiban ÷ Ekuitas',
            nilai: dte,
            format: fmt(dte) + 'x',
            status: interpret(dte, 'dte'),
            warna: getWarna(interpret(dte, 'dte')),
            acuan: '≤ 1x = Baik',
          },
        ],
      },
      {
        kelompok: 'Rasio Profitabilitas',
        deskripsi: 'Mengukur kemampuan koperasi menghasilkan keuntungan (SHU).',
        items: [
          {
            nama: 'Net Profit Margin',
            rumus: 'SHU ÷ Total Pendapatan × 100%',
            nilai: npm,
            format: fmt(npm) + '%',
            status: interpret(npm, 'npm'),
            warna: getWarna(interpret(npm, 'npm')),
            acuan: '≥ 10% = Baik',
          },
          {
            nama: 'Return on Asset (ROA)',
            rumus: 'SHU ÷ Total Aset × 100%',
            nilai: roa,
            format: fmt(roa) + '%',
            status: interpret(roa, 'roa'),
            warna: getWarna(interpret(roa, 'roa')),
            acuan: '≥ 5% = Baik',
          },
          {
            nama: 'Return on Equity (ROE)',
            rumus: 'SHU ÷ Ekuitas × 100%',
            nilai: roe,
            format: fmt(roe) + '%',
            status: interpret(roe, 'roe'),
            warna: getWarna(interpret(roe, 'roe')),
            acuan: '≥ 10% = Baik',
          },
        ],
      },
      {
        kelompok: 'Rasio Aktivitas',
        deskripsi: 'Mengukur efisiensi penggunaan aset untuk menghasilkan pendapatan.',
        items: [
          {
            nama: 'Asset Turnover',
            rumus: 'Total Pendapatan ÷ Total Aset',
            nilai: assetTurnover,
            format: fmt(assetTurnover) + 'x',
            status: interpret(assetTurnover, 'turnover'),
            warna: getWarna(interpret(assetTurnover, 'turnover')),
            acuan: '≥ 1x = Efisien',
          },
        ],
      },
    ];

    return {
      posisi,
      rasio,
      totalAset,
      totalKewajiban,
      ekuitas,
      totalPendapatan,
      totalBeban,
      shu,
      asetLancar,
      kewajibanLancar,
      kas,
      piutang,
    };
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

      const data = await this.buildAnalisa(queryDari, querySampai, unit || null);

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
      console.error('Error Analisa Keuangan:', error);
      res.status(500).json({ message: 'Gagal mengambil data analisa keuangan', error: error.message });
    }
  }

  // ─── EXPORT ──────────────────────────────────────────────────
  async export(req, res) {
    try {
      let { dari, sampai, unit, export: exportType } = req.query;
      const now = new Date();
      const defaultDari = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
      const defaultSampai = now.toISOString().slice(0, 10);

      const queryDari = dari || defaultDari;
      const querySampai = sampai || defaultSampai;

      const data = await this.buildAnalisa(queryDari, querySampai, unit || null);
      const labelPeriode = `${formatTanggal(queryDari)} – ${formatTanggal(querySampai)}`;

      if (exportType === 'excel') {
        await this.exportExcel(res, data, labelPeriode, unit);
      } else if (exportType === 'pdf') {
        await this.exportPdf(res, data, labelPeriode, unit);
      } else {
        res.status(400).json({ message: 'Format export tidak didukung' });
      }
    } catch (error) {
      console.error('Error export Analisa Keuangan:', error);
      res.status(500).json({ message: 'Gagal mengekspor analisa keuangan', error: error.message });
    }
  }

  // ─── Export Excel ──────────────────────────────────────────
  async exportExcel(res, data, labelPeriode, unit) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Analisa Keuangan');

    // Header
    sheet.mergeCells('A1:E1');
    sheet.getCell('A1').value = 'ANALISA KEUANGAN';
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

    // Posisi Keuangan
    sheet.addRow(['POSISI KEUANGAN']);
    rowIndex++;
    sheet.getRow(rowIndex).font = { bold: true, size: 11 };
    rowIndex++;

    for (const item of data.posisi) {
      sheet.addRow([item.label, '', '', '', item.nilai]);
      rowIndex++;
    }
    rowIndex++;

    // Rasio
    for (const group of data.rasio) {
      sheet.addRow([group.kelompok]);
      rowIndex++;
      sheet.getRow(rowIndex).font = { bold: true, size: 11 };
      rowIndex++;

      const headerRow = sheet.addRow(['Rasio', 'Rumus', 'Nilai', 'Status', 'Acuan']);
      headerRow.font = { bold: true };
      rowIndex++;

      for (const item of group.items) {
        sheet.addRow([item.nama, item.rumus, item.format, item.status, item.acuan]);
        rowIndex++;
      }
      rowIndex++;
    }

    // Set column widths
    sheet.getColumn(1).width = 25;
    sheet.getColumn(2).width = 30;
    sheet.getColumn(3).width = 15;
    sheet.getColumn(4).width = 15;
    sheet.getColumn(5).width = 20;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=analisa-keuangan-${new Date().toISOString().slice(0, 10)}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  }

  // ─── Export PDF ─────────────────────────────────────────────
  async exportPdf(res, data, labelPeriode, unit) {
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=analisa-keuangan-${new Date().toISOString().slice(0, 10)}.pdf`);
    doc.pipe(res);

    doc.fontSize(16).font('Helvetica-Bold').text('ANALISA KEUANGAN', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`Periode: ${labelPeriode}`, { align: 'center' });
    if (unit) {
      doc.text(`Unit Usaha: ${unit}`, { align: 'center' });
    }
    doc.moveDown(1);

    let currentY = doc.y;

    // Posisi Keuangan
    doc.fontSize(10).font('Helvetica-Bold').text('POSISI KEUANGAN', { align: 'center' });
    currentY = doc.y + 6;

    const startX = 40;
    for (const item of data.posisi) {
      doc.fontSize(8).font('Helvetica').text(`${item.label}:`, startX, currentY);
      doc.text(item.nilai, doc.page.width - 80, currentY, { align: 'right', width: 60 });
      currentY = doc.y + 4;
    }
    currentY += 8;

    // Rasio
    for (const group of data.rasio) {
      if (currentY + 20 > 500) {
        doc.addPage();
        currentY = 40;
      }
      doc.fontSize(10).font('Helvetica-Bold').text(group.kelompok, startX, currentY);
      currentY = doc.y + 6;

      doc.fontSize(8).font('Helvetica').text(`Deskripsi: ${group.deskripsi}`, startX, currentY);
      currentY = doc.y + 6;

      for (const item of group.items) {
        if (currentY + 16 > 500) {
          doc.addPage();
          currentY = 40;
        }
        doc.fontSize(7).font('Helvetica-Bold').text(item.nama, startX, currentY);
        doc.fontSize(7).font('Helvetica').text(item.rumus, startX + 120, currentY);
        doc.text(item.format, startX + 280, currentY, { align: 'right', width: 60 });
        const statusColor = item.warna === 'success' ? '#00AA00' :
                           item.warna === 'primary' ? '#0066CC' :
                           item.warna === 'warning' ? '#FFAA00' :
                           item.warna === 'danger' ? '#CC0000' : '#999999';
        doc.fillColor(statusColor).text(item.status, startX + 350, currentY, { align: 'right', width: 80 });
        doc.fillColor('#000000');
        currentY = doc.y + 4;
      }
      currentY += 6;
    }

    doc.end();
  }
}

module.exports = new AnalisaKeuanganController();