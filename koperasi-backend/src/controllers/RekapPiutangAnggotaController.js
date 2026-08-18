// src/controllers/RekapPiutangAnggotaController.js
const { Anggota, PiutangAwal, Transaksi, JenisPiutang, sequelize } = require('../models');
const { Op, QueryTypes } = require('sequelize');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

// ─── Helper ──────────────────────────────────────────────
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

// ─── Controller ──────────────────────────────────────────
class RekapPiutangAnggotaController {
  // ─── Ambil daftar jenis piutang ──
  async getJenisPiutang() {
    return await JenisPiutang.findAll({
      where: { is_active: true },
      order: [['urutan', 'ASC'], ['id', 'ASC']],
      attributes: ['id', 'kode', 'nama', 'kolom_key', 'urutan'],
      raw: true,
    });
  }

  // ─── Daftar nama anggota untuk autocomplete ──
  async getDaftarNamaAnggota(search = '') {
    const where = {};
    if (search) {
      where.nama = { [Op.like]: `%${search}%` };
    }
    const anggota = await Anggota.findAll({
      where,
      attributes: ['nama'],
      order: [['nama', 'ASC']],
      raw: true,
      limit: search ? 20 : 100,
    });
    return anggota.map((a) => a.nama);
  }

  // ─── Hitung saldo awal piutang ──
  async getSaldoAwal(anggotaId, jenisIds, tanggalMulai) {
    if (jenisIds.length === 0) return 0;

    const [saldoAwalRow] = await sequelize.query(
      `
        SELECT COALESCE(SUM(pa.jumlah), 0) AS total
        FROM piutang_awal pa
        WHERE pa.anggota_id = :anggotaId
          AND pa.jenis_piutang_id IN (:jenisIds)
      `,
      {
        replacements: { anggotaId, jenisIds },
        type: QueryTypes.SELECT,
      }
    );

    let saldoAwal = parseFloat(saldoAwalRow.total) || 0;

    if (tanggalMulai) {
      const [transaksiSebelum] = await sequelize.query(
        `
          SELECT COALESCE(SUM(t.jumlah), 0) AS total
          FROM transaksi t
          WHERE t.anggota_id = :anggotaId
            AND t.jenis_piutang_id IN (:jenisIds)
            AND t.tanggal < :tanggalMulai
        `,
        {
          replacements: { anggotaId, jenisIds, tanggalMulai },
          type: QueryTypes.SELECT,
        }
      );
      saldoAwal += parseFloat(transaksiSebelum.total) || 0;
    }

    return saldoAwal;
  }

  // ─── Ambil daftar transaksi piutang ──
  async getTransaksiAnggota(anggotaId, jenisIds, tanggalMulai, tanggalSelesai, search) {
    if (jenisIds.length === 0) return [];

    let where = `
      WHERE t.anggota_id = :anggotaId
        AND t.jenis_piutang_id IN (:jenisIds)
    `;
    const replacements = { anggotaId, jenisIds };

    if (tanggalMulai) {
      where += ` AND t.tanggal >= :tanggalMulai`;
      replacements.tanggalMulai = tanggalMulai;
    }
    if (tanggalSelesai) {
      where += ` AND t.tanggal <= :tanggalSelesai`;
      replacements.tanggalSelesai = tanggalSelesai;
    }
    if (search) {
      where += ` AND (t.no_transaksi LIKE :search OR t.deskripsi LIKE :search)`;
      replacements.search = `%${search}%`;
    }

    const query = `
      SELECT
        t.id,
        t.tanggal,
        t.no_transaksi,
        t.deskripsi,
        t.jumlah,
        t.jenis_piutang_id,
        jp.nama AS jenis_nama,
        jp.kolom_key AS jenis_key
      FROM transaksi t
      LEFT JOIN jenis_piutang jp ON jp.id = t.jenis_piutang_id
      ${where}
      ORDER BY t.tanggal ASC, t.id ASC
    `;

    return await sequelize.query(query, { replacements, type: QueryTypes.SELECT });
  }

  // ─── Susun kartu piutang ──
  async buildKartuPiutang(anggota, jenisList, filters) {
    const { tanggal_mulai, tanggal_selesai, search, jenis_piutang_id } = filters;

    let filteredJenis = jenisList;
    if (jenis_piutang_id) {
      filteredJenis = jenisList.filter((j) => Number(j.id) === Number(jenis_piutang_id));
    }

    const jenisIds = filteredJenis.map((j) => Number(j.id));

    if (jenisIds.length === 0) {
      return { saldoAwal: 0, transaksi: [], detailPerJenis: [], grandTotal: { total: 0 } };
    }

    const saldoAwal = await this.getSaldoAwal(anggota.id, jenisIds, tanggal_mulai);
    const rawTransaksi = await this.getTransaksiAnggota(
      anggota.id,
      jenisIds,
      tanggal_mulai,
      tanggal_selesai,
      search
    );

    const jenisById = {};
    filteredJenis.forEach((j) => { jenisById[j.id] = j; });

    const saldoAwalPerJenis = {};
    for (const j of filteredJenis) {
      saldoAwalPerJenis[j.id] = await this.getSaldoAwal(anggota.id, [j.id], tanggal_mulai);
    }

    const berjalanPerJenis = { ...saldoAwalPerJenis };
    let saldoBerjalan = saldoAwal;

    const transaksi = rawTransaksi.map((t) => {
      const jumlah = parseFloat(t.jumlah) || 0;
      saldoBerjalan += jumlah;

      const jenis = jenisById[t.jenis_piutang_id];
      if (jenis && berjalanPerJenis[jenis.id] !== undefined) {
        berjalanPerJenis[jenis.id] += jumlah;
      }

      return {
        id: t.id,
        tanggal: t.tanggal,
        no_transaksi: t.no_transaksi,
        jenis_nama: jenis?.nama || t.jenis_nama || '-',
        jenis_key: jenis?.kolom_key || t.jenis_key,
        deskripsi: t.deskripsi,
        jumlah_efektif: jumlah,
        saldo: saldoBerjalan,
        is_saldo_awal: false,
      };
    });

    const detailPerJenis = filteredJenis.map((j) => ({
      kolom_key: j.kolom_key,
      jenis: j.nama,
      saldo_akhir: berjalanPerJenis[j.id] ?? saldoAwalPerJenis[j.id] ?? 0,
    }));

    const grandTotal = {
      total: detailPerJenis.reduce((sum, d) => sum + (parseFloat(d.saldo_akhir) || 0), 0),
    };

    return { saldoAwal, transaksi, detailPerJenis, grandTotal };
  }

  // ─── ENDPOINT: GET /api/rekap-piutang-anggota ──
  async index(req, res) {
    try {
      const {
        nama_anggota,
        tanggal_mulai,
        tanggal_selesai,
        search,
        jenis_piutang_id,
        page = 1,
        per_page = 10,
      } = req.query;

      const jenisList = await this.getJenisPiutang();
      const jenisPiutangOut = jenisList.map((j) => ({
        id: j.id,
        nama: j.nama,
        kolom_key: j.kolom_key,
      }));

      if (!nama_anggota) {
        const namaAnggota = await this.getDaftarNamaAnggota(search || '');
        return res.status(200).json({
          success: true,
          jenisPiutang: jenisPiutangOut,
          namaAnggota,
          transaksi: [],
          detailPerJenis: [],
          grandTotal: {},
          saldoAwal: 0,
          currentPage: 1,
          totalPages: 1,
          totalTransaksi: 0,
          perPage: Number(per_page) || 10,
        });
      }

      const anggota = await Anggota.findOne({
        where: sequelize.where(
          sequelize.fn('LOWER', sequelize.col('nama')),
          sequelize.fn('LOWER', nama_anggota.trim())
        ),
        attributes: ['id', 'no_anggota', 'nama', 'alamat'],
        raw: true,
      });

      const namaAnggota = await this.getDaftarNamaAnggota('');

      if (!anggota) {
        return res.status(404).json({
          success: false,
          message: `Anggota "${nama_anggota}" tidak ditemukan`,
          jenisPiutang: jenisPiutangOut,
          namaAnggota,
        });
      }

      const { saldoAwal, transaksi, detailPerJenis, grandTotal } = await this.buildKartuPiutang(
        anggota,
        jenisList,
        { tanggal_mulai, tanggal_selesai, search, jenis_piutang_id }
      );

      const totalTransaksi = transaksi.length;
      const currentPage = Number(page) || 1;
      const perPage = Number(per_page) || 10;
      const start = (currentPage - 1) * perPage;
      const paginatedTransaksi = transaksi.slice(start, start + perPage);

      return res.status(200).json({
        success: true,
        jenisPiutang: jenisPiutangOut,
        namaAnggota,
        selectedAnggota: {
          no_anggota: anggota.no_anggota,
          nama: anggota.nama,
          alamat: anggota.alamat,
        },
        transaksi: paginatedTransaksi,
        detailPerJenis,
        grandTotal,
        saldoAwal,
        currentPage,
        totalPages: Math.ceil(totalTransaksi / perPage) || 1,
        totalTransaksi,
        perPage,
      });
    } catch (error) {
      console.error('❌ Error RekapPiutangAnggota:', error);
      return res.status(500).json({
        success: false,
        message: 'Gagal mengambil data rekap piutang anggota',
        error: error.message,
      });
    }
  }

  // ─── ENDPOINT: EXPORT ──
  async export(req, res) {
    try {
      const {
        nama_anggota,
        tanggal_mulai,
        tanggal_selesai,
        search,
        jenis_piutang_id,
        export: exportType,
      } = req.query;

      if (!nama_anggota) {
        return res.status(422).json({
          success: false,
          message: 'Pilih nama anggota terlebih dahulu',
        });
      }

      const jenisList = await this.getJenisPiutang();
      const anggota = await Anggota.findOne({
        where: sequelize.where(
          sequelize.fn('LOWER', sequelize.col('nama')),
          sequelize.fn('LOWER', nama_anggota.trim())
        ),
        attributes: ['id', 'no_anggota', 'nama', 'alamat'],
        raw: true,
      });

      if (!anggota) {
        return res.status(404).json({ success: false, message: 'Anggota tidak ditemukan' });
      }

      const { saldoAwal, transaksi, detailPerJenis, grandTotal } = await this.buildKartuPiutang(
        anggota,
        jenisList,
        { tanggal_mulai, tanggal_selesai, search, jenis_piutang_id }
      );

      if (transaksi.length === 0 && saldoAwal === 0) {
        return res.status(404).json({
          success: false,
          message: 'Tidak ada transaksi piutang untuk anggota tersebut pada periode ini.',
        });
      }

      const exportData = { anggota, saldoAwal, transaksi, detailPerJenis, grandTotal, title: 'Piutang' };

      if (exportType === 'excel') {
        return this.exportExcel(res, exportData);
      } else if (exportType === 'pdf') {
        return this.exportPdf(res, exportData);
      } else {
        return res.status(400).json({ success: false, message: 'Format export tidak didukung' });
      }
    } catch (error) {
      console.error('Error export piutang:', error);
      return res.status(500).json({ success: false, message: 'Gagal mengekspor data' });
    }
  }

  // ─── Export Excel ──
  async exportExcel(res, { anggota, saldoAwal, transaksi, grandTotal, title }) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(`Kartu ${title}`);
    const totalColumns = 8;

    sheet.mergeCells(1, 1, 1, totalColumns);
    sheet.getCell('A1').value = `KARTU ${title.toUpperCase()} ANGGOTA`;
    sheet.getCell('A1').font = { size: 16, bold: true };
    sheet.getCell('A1').alignment = { horizontal: 'center' };

    sheet.mergeCells(2, 1, 2, totalColumns);
    sheet.getCell('A2').value = `Nama Anggota: ${anggota?.nama || '-'}  (${anggota?.no_anggota || '-'})`;
    sheet.getCell('A2').alignment = { horizontal: 'center' };

    sheet.mergeCells(3, 1, 3, totalColumns);
    sheet.getCell('A3').value = `Tanggal Cetak: ${formatTanggal(new Date())}`;
    sheet.getCell('A3').alignment = { horizontal: 'center' };

    sheet.addRow([]);

    const headers = ['No', 'Tanggal', 'No Bukti', 'Jenis', 'Uraian', 'Penambahan', 'Pembayaran', 'Saldo'];
    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.alignment = { horizontal: 'center' };

    let no = 1;
    if (saldoAwal) {
      const row = sheet.addRow([
        '-', '', '', '', 'Saldo Awal', saldoAwal > 0 ? saldoAwal : 0, saldoAwal < 0 ? Math.abs(saldoAwal) : 0, saldoAwal,
      ]);
      row.font = { italic: true };
    }

    transaksi.forEach((t) => {
      const tambah = t.jumlah_efektif > 0 ? t.jumlah_efektif : 0;
      const kurang = t.jumlah_efektif < 0 ? Math.abs(t.jumlah_efektif) : 0;
      sheet.addRow([
        no++,
        formatTanggal(t.tanggal),
        t.no_transaksi || '-',
        t.jenis_nama || t.jenis_key || '-',
        t.deskripsi || '-',
        tambah,
        kurang,
        t.saldo,
      ]);
    });

    const totalTambah = transaksi.reduce((s, t) => s + (t.jumlah_efektif > 0 ? t.jumlah_efektif : 0), 0);
    const totalKurang = transaksi.reduce((s, t) => s + (t.jumlah_efektif < 0 ? Math.abs(t.jumlah_efektif) : 0), 0);
    const totalRow = sheet.addRow(['', '', '', '', 'TOTAL', totalTambah, totalKurang, grandTotal.total]);
    totalRow.font = { bold: true };

    for (let i = 6; i <= 8; i++) {
      sheet.getColumn(i).numFmt = '#,##0';
      sheet.getColumn(i).alignment = { horizontal: 'right' };
      sheet.getColumn(i).width = 18;
    }
    sheet.getColumn(2).width = 16;
    sheet.getColumn(3).width = 16;
    sheet.getColumn(4).width = 16;
    sheet.getColumn(5).width = 28;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=kartu-${title.toLowerCase()}-${anggota?.no_anggota || 'export'}-${new Date().toISOString().slice(0, 10)}.xlsx`
    );
    await workbook.xlsx.write(res);
    res.end();
  }

  // ─── Export PDF ──
  async exportPdf(res, { anggota, saldoAwal, transaksi, grandTotal, title }) {
    const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=kartu-${title.toLowerCase()}-${anggota?.no_anggota || 'export'}-${new Date().toISOString().slice(0, 10)}.pdf`
    );
    doc.pipe(res);

    doc.fontSize(14).font('Helvetica-Bold').text(`KARTU ${title.toUpperCase()} ANGGOTA`, { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`Nama Anggota: ${anggota?.nama || '-'}  (${anggota?.no_anggota || '-'})`, { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`Tanggal Cetak: ${formatTanggal(new Date())}`, { align: 'center' });
    doc.moveDown(1);

    const startX = 30;
    const headers = ['No', 'Tanggal', 'No Bukti', 'Jenis', 'Uraian', 'Penambahan', 'Pembayaran', 'Saldo'];
    const colWidths = [30, 70, 80, 90, 200, 90, 90, 90];
    const totalWidth = colWidths.reduce((a, b) => a + b, 0);

    const drawHeader = (y) => {
      doc.rect(startX, y, totalWidth, 20).fill('#6c757d');
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(7);
      let x = startX;
      headers.forEach((header, i) => {
        const align = i <= 4 ? 'left' : 'right';
        doc.text(header, x + 4, y + 5, { width: colWidths[i] - 8, align });
        x += colWidths[i];
      });
      doc.fillColor('#000000').font('Helvetica');
      return y + 20;
    };

    let rowY = drawHeader(doc.y);
    const pageBottom = 550;

    const drawRow = (cells, bold = false) => {
      if (rowY + 16 > pageBottom) {
        doc.addPage({ layout: 'landscape' });
        rowY = drawHeader(30);
      }
      if (bold) {
        doc.rect(startX, rowY, totalWidth, 16).fill('#dee2e6');
        doc.fillColor('#000000').font('Helvetica-Bold').fontSize(7);
      } else {
        doc.rect(startX, rowY, totalWidth, 14).stroke();
        doc.fillColor('#000000').font('Helvetica').fontSize(6.5);
      }
      let x = startX;
      cells.forEach((cell, i) => {
        const align = i <= 4 ? 'left' : 'right';
        doc.text(String(cell ?? ''), x + 4, rowY + 3, { width: colWidths[i] - 8, align });
        x += colWidths[i];
      });
      rowY += bold ? 16 : 14;
    };

    if (saldoAwal) {
      drawRow(['-', '', '', '', 'Saldo Awal', saldoAwal > 0 ? formatRupiah(saldoAwal) : '-', saldoAwal < 0 ? formatRupiah(Math.abs(saldoAwal)) : '-', formatRupiah(saldoAwal)]);
    }

    let no = 1;
    transaksi.forEach((t) => {
      const tambah = t.jumlah_efektif > 0 ? t.jumlah_efektif : 0;
      const kurang = t.jumlah_efektif < 0 ? Math.abs(t.jumlah_efektif) : 0;
      drawRow([
        no++,
        formatTanggal(t.tanggal),
        t.no_transaksi || '-',
        t.jenis_nama || t.jenis_key || '-',
        t.deskripsi || '-',
        tambah > 0 ? formatRupiah(tambah) : '-',
        kurang > 0 ? formatRupiah(kurang) : '-',
        formatRupiah(t.saldo),
      ]);
    });

    const totalTambah = transaksi.reduce((s, t) => s + (t.jumlah_efektif > 0 ? t.jumlah_efektif : 0), 0);
    const totalKurang = transaksi.reduce((s, t) => s + (t.jumlah_efektif < 0 ? Math.abs(t.jumlah_efektif) : 0), 0);
    drawRow(['', '', '', '', 'TOTAL', formatRupiah(totalTambah), formatRupiah(totalKurang), formatRupiah(grandTotal.total)], true);

    doc.end();
  }
}

module.exports = new RekapPiutangAnggotaController();