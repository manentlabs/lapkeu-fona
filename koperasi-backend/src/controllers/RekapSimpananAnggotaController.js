// src/controllers/RekapSimpananAnggotaController.js
//
// PERUBAHAN BESAR dari versi sebelumnya:
// Versi lama = REKAP PIVOT lintas-anggota (1 baris = 1 anggota, kolom = total per jenis simpanan).
// Versi ini  = KARTU SIMPANAN per anggota (1 baris = 1 transaksi, dengan saldo berjalan),
//              sesuai bentuk data yang dipakai RekapSimpananAnggotaPage.jsx
//              (field: transaksi, detailPerJenis, grandTotal, saldoAwal, namaAnggota, dst).
//
// Kolom transaksi yang dipakai: t.no_transaksi (No Bukti) dan t.deskripsi (Uraian).
//
// FIX: transaksi difilter WAJIB berdasarkan t.jenis_simpanan_id IN (jenisIds yang aktif dipilih),
// bukan cuma berdasarkan akun_kredit_id/akun_debet_id. Kalau cuma cek akun, transaksi dari
// produk lain yang kebetulan berbagi akun GL yang sama (mis. "Tabungan Hari Raya") akan ikut
// ketarik ke kartu simpanan, dan kolom Jenis-nya tampil kosong karena tidak match di jenis_simpanan.

const { Anggota, SimpananAwal, Transaksi, JenisSimpanan, Akun, sequelize } = require('../models');
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
class RekapSimpananAnggotaController {
  // ─── Ambil daftar jenis simpanan aktif ──────────────────
  async getJenisSimpanan() {
    return await JenisSimpanan.findAll({
      where: { is_active: true },
      include: [
        {
          model: Akun,
          as: 'akun',
          attributes: ['id', 'kode_akun', 'nama_akun'],
        },
      ],
      order: [['urutan', 'ASC'], ['id', 'ASC']],
      attributes: ['id', 'kode', 'nama', 'kolom_key', 'akun_id', 'urutan'],
      raw: true,
      nest: true,
    });
  }

  // ─── Daftar nama anggota untuk autocomplete (array of string, sesuai frontend) ──
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

  // ─── Tentukan scope jenis simpanan + akun terkait, sesuai filter jenis_simpanan_id ──
  resolveJenisScope(jenisList, jenisSimpananId) {
    const filtered = jenisSimpananId
      ? jenisList.filter((j) => Number(j.id) === Number(jenisSimpananId))
      : jenisList;
    const jenisIds = filtered.map((j) => Number(j.id));
    const akunIds = [...new Set(filtered.map((j) => Number(j.akun_id)).filter(Boolean))];

    // akun yang HANYA dipakai oleh satu jenis di dalam scope ini (tidak "berbagi" dengan
    // jenis simpanan lain yang sedang tampil). Dipakai sebagai fallback untuk transaksi lama
    // yang belum punya jenis_simpanan_id terisi — aman diatribusikan ke jenis itu.
    const akunCount = {};
    filtered.forEach((j) => {
      if (j.akun_id) akunCount[j.akun_id] = (akunCount[j.akun_id] || 0) + 1;
    });
    const uniqueAkunIds = Object.keys(akunCount)
      .filter((akunId) => akunCount[akunId] === 1)
      .map(Number);
    const jenisByUniqueAkun = {};
    filtered.forEach((j) => {
      if (j.akun_id && uniqueAkunIds.includes(Number(j.akun_id))) {
        jenisByUniqueAkun[Number(j.akun_id)] = j;
      }
    });

    return { filtered, jenisIds, akunIds, uniqueAkunIds, jenisByUniqueAkun };
  }

  // ─── Hitung saldo awal (posisi sebelum tanggal_mulai) untuk anggota + scope jenis ──
  async getSaldoAwal(anggotaId, jenisIds, akunIds, uniqueAkunIds, tanggalMulai) {
    if (jenisIds.length === 0 || akunIds.length === 0) return 0;

    // 1) Saldo awal tercatat (dari tabel simpanan_awal)
    const [saldoAwalRow] = await sequelize.query(
      `
        SELECT COALESCE(SUM(sa.jumlah), 0) AS total
        FROM simpanan_awal sa
        WHERE sa.anggota_id = :anggotaId
          AND sa.jenis_simpanan_id IN (:jenisIds)
      `,
      {
        replacements: { anggotaId, jenisIds },
        type: QueryTypes.SELECT,
      }
    );

    // 2) Akumulasi transaksi sebelum tanggal_mulai (kalau ada filter tanggal)
    let historisKredit = 0;
    let historisDebit = 0;
    if (tanggalMulai) {
      // Match via jenis_simpanan_id eksplisit, ATAU (fallback) transaksi lama tanpa
      // jenis_simpanan_id yang akunnya unik/eksklusif milik satu jenis di scope ini.
      const jenisMatch = uniqueAkunIds.length > 0
        ? `(t.jenis_simpanan_id IN (:jenisIds) OR (t.jenis_simpanan_id IS NULL AND t.akun_kredit_id IN (:uniqueAkunIds)))`
        : `t.jenis_simpanan_id IN (:jenisIds)`;
      const jenisMatchDebit = uniqueAkunIds.length > 0
        ? `(t.jenis_simpanan_id IN (:jenisIds) OR (t.jenis_simpanan_id IS NULL AND t.akun_debet_id IN (:uniqueAkunIds)))`
        : `t.jenis_simpanan_id IN (:jenisIds)`;

      const [kreditRow] = await sequelize.query(
        `
          SELECT COALESCE(SUM(t.jumlah), 0) AS total
          FROM transaksi t
          WHERE t.anggota_id = :anggotaId
            AND t.akun_kredit_id IN (:akunIds)
            AND ${jenisMatch}
            AND t.tanggal < :tanggalMulai
        `,
        { replacements: { anggotaId, akunIds, jenisIds, uniqueAkunIds: uniqueAkunIds.length ? uniqueAkunIds : [0], tanggalMulai }, type: QueryTypes.SELECT }
      );
      const [debitRow] = await sequelize.query(
        `
          SELECT COALESCE(SUM(t.jumlah), 0) AS total
          FROM transaksi t
          WHERE t.anggota_id = :anggotaId
            AND t.akun_debet_id IN (:akunIds)
            AND ${jenisMatchDebit}
            AND t.tanggal < :tanggalMulai
        `,
        { replacements: { anggotaId, akunIds, jenisIds, uniqueAkunIds: uniqueAkunIds.length ? uniqueAkunIds : [0], tanggalMulai }, type: QueryTypes.SELECT }
      );
      historisKredit = parseFloat(kreditRow.total) || 0;
      historisDebit = parseFloat(debitRow.total) || 0;
    }

    return (parseFloat(saldoAwalRow.total) || 0) + historisKredit - historisDebit;
  }

  // ─── Ambil daftar transaksi (mentah, belum saldo berjalan) untuk anggota + scope ──
  async getTransaksiAnggota(anggotaId, akunIds, jenisIds, uniqueAkunIds, tanggalMulai, tanggalSelesai, search) {
    if (akunIds.length === 0 || jenisIds.length === 0) return [];

    // Match via jenis_simpanan_id eksplisit, ATAU (fallback) transaksi lama tanpa
    // jenis_simpanan_id yang akunnya unik/eksklusif milik satu jenis di scope ini.
    // Ini mencegah transaksi produk lain (mis. "Tabungan Hari Raya") ikut ketarik,
    // sekaligus tetap menampilkan transaksi lama yang memang valid simpanan.
    const jenisMatch = uniqueAkunIds.length > 0
      ? `(
          t.jenis_simpanan_id IN (:jenisIds)
          OR (
            t.jenis_simpanan_id IS NULL
            AND (t.akun_kredit_id IN (:uniqueAkunIds) OR t.akun_debet_id IN (:uniqueAkunIds))
          )
        )`
      : `t.jenis_simpanan_id IN (:jenisIds)`;

    let where = `
      WHERE t.anggota_id = :anggotaId
        AND (t.akun_kredit_id IN (:akunIds) OR t.akun_debet_id IN (:akunIds))
        AND ${jenisMatch}
    `;
    const replacements = {
      anggotaId,
      akunIds,
      jenisIds,
      uniqueAkunIds: uniqueAkunIds.length ? uniqueAkunIds : [0],
    };
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
        t.no_transaksi     AS no_transaksi,
        t.deskripsi        AS deskripsi,
        t.jumlah,
        t.akun_kredit_id,
        t.akun_debet_id,
        t.jenis_simpanan_id,
        js.nama            AS jenis_nama,
        js.kolom_key        AS jenis_key,
        ak.nama_akun        AS akun
      FROM transaksi t
      LEFT JOIN jenis_simpanan js ON js.id = t.jenis_simpanan_id
      LEFT JOIN akun ak ON ak.id = COALESCE(
        CASE WHEN t.akun_kredit_id IN (:akunIds) THEN t.akun_kredit_id END,
        CASE WHEN t.akun_debet_id IN (:akunIds) THEN t.akun_debet_id END
      )
      ${where}
      ORDER BY t.tanggal ASC, t.id ASC
    `;

    return await sequelize.query(query, { replacements, type: QueryTypes.SELECT });
  }

  // ─── Susun kartu simpanan: saldo awal + transaksi + saldo berjalan ─────────
  async buildKartuSimpanan(anggota, jenisList, filters) {
    const { tanggal_mulai, tanggal_selesai, search, jenis_simpanan_id } = filters;
    const { filtered, jenisIds, akunIds, uniqueAkunIds, jenisByUniqueAkun } = this.resolveJenisScope(
      jenisList,
      jenis_simpanan_id
    );

    if (jenisIds.length === 0 || akunIds.length === 0) {
      return { saldoAwal: 0, transaksi: [], detailPerJenis: [], grandTotal: { total: 0 } };
    }

    const saldoAwal = await this.getSaldoAwal(anggota.id, jenisIds, akunIds, uniqueAkunIds, tanggal_mulai);
    const rawTransaksi = await this.getTransaksiAnggota(
      anggota.id,
      akunIds,
      jenisIds,
      uniqueAkunIds,
      tanggal_mulai,
      tanggal_selesai,
      search
    );

    // Peta jenis_id -> jenis (nama, kolom_key, akun_id), untuk resolusi cepat per transaksi
    const jenisById = {};
    filtered.forEach((j) => { jenisById[j.id] = j; });

    // Untuk detail per jenis, hitung saldo awal & pergerakan masing-masing jenis secara terpisah.
    // uniqueAkunIds untuk scope satu-jenis ini selalu trivial ([akun_id milik jenis itu sendiri]).
    const saldoAwalPerJenis = {};
    for (const j of filtered) {
      const akunJenis = j.akun_id ? [Number(j.akun_id)] : [];
      saldoAwalPerJenis[j.id] = await this.getSaldoAwal(
        anggota.id,
        [j.id],
        akunJenis,
        akunJenis,
        tanggal_mulai
      );
    }
    const berjalanPerJenis = { ...saldoAwalPerJenis };

    let saldoBerjalan = saldoAwal;

    const transaksi = rawTransaksi.map((t) => {
      // Resolusi jenis efektif: pakai jenis_simpanan_id eksplisit kalau ada,
      // kalau tidak (transaksi lama) fallback ke jenis yang akunnya unik dalam scope ini.
      let jenisEfektif = t.jenis_simpanan_id != null ? jenisById[t.jenis_simpanan_id] : null;
      if (!jenisEfektif) {
        jenisEfektif = jenisByUniqueAkun[Number(t.akun_kredit_id)] || jenisByUniqueAkun[Number(t.akun_debet_id)] || null;
      }

      const isKredit = jenisEfektif
        ? Number(t.akun_kredit_id) === Number(jenisEfektif.akun_id)
        : akunIds.includes(Number(t.akun_kredit_id)); // fallback terakhir kalau jenis tetap tidak dikenali
      const jumlahEfektif = isKredit ? parseFloat(t.jumlah) : -parseFloat(t.jumlah);

      saldoBerjalan += jumlahEfektif;

      if (jenisEfektif && berjalanPerJenis[jenisEfektif.id] !== undefined) {
        berjalanPerJenis[jenisEfektif.id] += jumlahEfektif;
      }

      return {
        id: t.id,
        tanggal: t.tanggal,
        no_transaksi: t.no_transaksi,
        jenis_nama: jenisEfektif?.nama || t.jenis_nama || '-',
        jenis_key: jenisEfektif?.kolom_key || t.jenis_key,
        deskripsi: t.deskripsi,
        akun: t.akun,
        jumlah_efektif: jumlahEfektif,
        saldo: saldoBerjalan,
        is_saldo_awal: false,
      };
    });

    const detailPerJenis = filtered.map((j) => ({
      kolom_key: j.kolom_key,
      jenis: j.nama,
      saldo_akhir: berjalanPerJenis[j.id] ?? saldoAwalPerJenis[j.id] ?? 0,
    }));

    const grandTotal = {
      total: detailPerJenis.reduce((sum, d) => sum + (parseFloat(d.saldo_akhir) || 0), 0),
    };

    return { saldoAwal, transaksi, detailPerJenis, grandTotal };
  }

  // ─── ENDPOINT: GET /api/rekap-simpanan-anggota ──────────
  async index(req, res) {
    try {
      const {
        nama_anggota,
        tanggal_mulai,
        tanggal_selesai,
        search,
        jenis_simpanan_id,
        page = 1,
        per_page = 10,
      } = req.query;

      const jenisList = await this.getJenisSimpanan();
      const jenisSimpananOut = jenisList.map((j) => ({
        id: j.id,
        nama: j.nama,
        kolom_key: j.kolom_key,
        akun: j.akun,
      }));

      // ── Mode 1: belum pilih anggota -> hanya untuk isi autocomplete ──
      if (!nama_anggota) {
        const namaAnggota = await this.getDaftarNamaAnggota(search || '');
        return res.status(200).json({
          success: true,
          jenisSimpanan: jenisSimpananOut,
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

      // ── Mode 2: anggota dipilih -> ambil kartu simpanannya ──
      const anggota = await Anggota.findOne({
        where: sequelize.where(
          sequelize.fn('LOWER', sequelize.col('nama')),
          sequelize.fn('LOWER', nama_anggota.trim())
        ),
        attributes: ['id', 'no_anggota', 'nama', 'alamat'],
        raw: true,
      });

      // Daftar nama tetap dikirim supaya autocomplete tidak "hilang" setelah anggota dipilih
      const namaAnggota = await this.getDaftarNamaAnggota('');

      if (!anggota) {
        return res.status(404).json({
          success: false,
          message: `Anggota "${nama_anggota}" tidak ditemukan`,
          jenisSimpanan: jenisSimpananOut,
          namaAnggota,
        });
      }

      const { saldoAwal, transaksi, detailPerJenis, grandTotal } = await this.buildKartuSimpanan(
        anggota,
        jenisList,
        { tanggal_mulai, tanggal_selesai, search, jenis_simpanan_id }
      );

      // ── Paginasi di level transaksi (bukan di level anggota) ──
      const totalTransaksi = transaksi.length;
      const currentPage = Number(page) || 1;
      const perPage = Number(per_page) || 10;
      const start = (currentPage - 1) * perPage;
      const paginatedTransaksi = transaksi.slice(start, start + perPage);

      return res.status(200).json({
        success: true,
        jenisSimpanan: jenisSimpananOut,
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
      console.error('❌ Error RekapSimpananAnggota:', error);
      return res.status(500).json({
        success: false,
        message: 'Gagal mengambil data rekap simpanan anggota',
        error: error.message,
      });
    }
  }

  // ─── ENDPOINT: EXPORT ────────────────────────────────────
  async export(req, res) {
    try {
      const {
        nama_anggota,
        tanggal_mulai,
        tanggal_selesai,
        search,
        jenis_simpanan_id,
        export: exportType,
      } = req.query;

      if (!nama_anggota) {
        return res.status(422).json({
          success: false,
          message: 'Pilih nama anggota terlebih dahulu',
        });
      }

      const jenisList = await this.getJenisSimpanan();
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

      // Export selalu ambil SELURUH transaksi (tanpa paginasi)
      const { saldoAwal, transaksi, detailPerJenis, grandTotal } = await this.buildKartuSimpanan(
        anggota,
        jenisList,
        { tanggal_mulai, tanggal_selesai, search, jenis_simpanan_id }
      );

      if (transaksi.length === 0 && saldoAwal === 0) {
        return res.status(404).json({
          success: false,
          message: 'Tidak ada transaksi untuk anggota tersebut pada periode ini.',
        });
      }

      const exportData = { anggota, saldoAwal, transaksi, detailPerJenis, grandTotal, title: 'Simpanan' };

      if (exportType === 'excel') {
        return this.exportExcel(res, exportData);
      } else if (exportType === 'pdf') {
        return this.exportPdf(res, exportData);
      } else {
        return res.status(400).json({ success: false, message: 'Format export tidak didukung' });
      }
    } catch (error) {
      console.error('Error export:', error);
      return res.status(500).json({ success: false, message: 'Gagal mengekspor data' });
    }
  }

  // ─── Export Excel (kartu simpanan) ──────────────────────
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

    const headers = ['No', 'Tanggal', 'No Bukti', 'Jenis', 'Uraian', 'Tambah', 'Kurang', 'Saldo'];
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
        t.deskripsi || t.akun || '-',
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

  // ─── Export PDF (kartu simpanan) ────────────────────────
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
    const headers = ['No', 'Tanggal', 'No Bukti', 'Jenis', 'Uraian', 'Tambah', 'Kurang', 'Saldo'];
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
        t.deskripsi || t.akun || '-',
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

module.exports = new RekapSimpananAnggotaController();