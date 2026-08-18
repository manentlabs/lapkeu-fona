const { Jurnal, Akun, PengaturanWebsite, sequelize } = require('../models');
const { Op } = require('sequelize');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

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

// ─── Helper format angka untuk PDF (negatif pakai kurung) ───
function fmtAngka(val) {
  const num = parseFloat(val) || 0;
  if (num === 0) return '-';
  return num < 0 ? `(${Math.abs(num).toLocaleString('id-ID')})` : num.toLocaleString('id-ID');
}

// ─── Helper konversi ke romawi (1-10) ────────────────────────
function toRoman(n) {
  const map = {1:'I',2:'II',3:'III',4:'IV',5:'V',6:'VI',7:'VII',8:'VIII',9:'IX',10:'X'};
  return map[n] || String(n);
}

// ─── Class NeracaController ──────────────────────────────────
class NeracaController {
  constructor() {
    this.descendantCache = {};
    // Untuk menyimpan periode yang digunakan di export (digunakan di header PDF)
    this.dari = null;
    this.sampai = null;
    this.tahunBerjalan = null;
    this.tahunSebelum = null;
  }

  resetCache() {
    this.descendantCache = {};
  }

  // ─── Dapatkan semua ID anak (rekursif) ──────────────────────
  async getDescendantIds(parentId) {
    if (this.descendantCache[parentId]) {
      return this.descendantCache[parentId];
    }

    const ids = [parentId];
    const children = await Akun.findAll({
      where: { parent_id: parentId },
      attributes: ['id'],
    });

    for (const child of children) {
      const childIds = await this.getDescendantIds(child.id);
      ids.push(...childIds);
    }

    this.descendantCache[parentId] = ids;
    return ids;
  }

  // ─── Hitung saldo akun (termasuk anak) ──────────────────────
  async getSaldo(akunId, dari, sampai, normalDebet = true) {
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

    // Jumlahkan pajak semua leaf di bawah akun ini
    const pajakResult = await Akun.findOne({
      attributes: [[sequelize.fn('SUM', sequelize.col('pajak')), 'totalPajak']],
      where: { id: ids },
      raw: true,
    });
    const pajak = parseFloat(pajakResult?.totalPajak) || 0;

    const saldo = normalDebet ? (debet - kredit) : (kredit - debet);
    return saldo - pajak;
  }

  // ─── Ambil saldo awal dari tabel akun ──────────────────────
  async getSaldoAwal(akunId) {
    const ids = await this.getDescendantIds(akunId);
    const result = await Akun.findOne({
      attributes: [[sequelize.fn('SUM', sequelize.col('saldo_awal')), 'totalSaldoAwal']],
      where: { id: ids },
      raw: true,
    });
    return parseFloat(result?.totalSaldoAwal) || 0;
  }

  // ─── Hitung SHU (Laba/Rugi) ────────────────────────────────
  async getSHU(dari, sampai) {
    // Pendapatan (normalDebet = false, karena pendapatan di kredit)
    let totalPendapatan = 0;
    const pendapatanRoots = await Akun.findAll({
      where: { parent_id: null, tipe_akun: 'pendapatan' },
    });
    for (const akun of pendapatanRoots) {
      totalPendapatan += await this.getSaldo(akun.id, dari, sampai, false);
    }

    // Beban (normalDebet = true)
    let totalBeban = 0;
    const bebanRoots = await Akun.findAll({
      where: { parent_id: null, tipe_akun: 'beban' },
    });
    for (const akun of bebanRoots) {
      totalBeban += await this.getSaldo(akun.id, dari, sampai, true);
    }

    return totalPendapatan - totalBeban;
  }

  // ─── SHU awal ──────────────────────────────────────────────
  async getSHUAwal() {
    let totalPendapatan = 0;
    const pendapatanRoots = await Akun.findAll({
      where: { parent_id: null, tipe_akun: 'pendapatan' },
    });
    for (const akun of pendapatanRoots) {
      totalPendapatan += await this.getSaldoAwal(akun.id);
    }

    let totalBeban = 0;
    const bebanRoots = await Akun.findAll({
      where: { parent_id: null, tipe_akun: 'beban' },
    });
    for (const akun of bebanRoots) {
      totalBeban += await this.getSaldoAwal(akun.id);
    }

    return totalPendapatan - totalBeban;
  }

  // ─── Build node rekursif ────────────────────────────────────
  async buildNode(akun, dari, sampai, normalDebet) {
    const children = await Akun.findAll({
      where: { parent_id: akun.id },
      order: [['kode_akun', 'ASC']],
    });

    if (children.length === 0) {
      const totalAwal = parseFloat(akun.saldo_awal) || 0;
      const mutasi = await this.getSaldo(akun.id, dari, sampai, normalDebet);
      return {
        id: akun.id,
        kode_akun: akun.kode_akun,
        nama_akun: akun.nama_akun,
        children: [],
        total: totalAwal + mutasi,
        total_awal: totalAwal,
        is_leaf: true,
      };
    }

    // Parent: rekursi
    const childNodes = [];
    for (const child of children) {
      childNodes.push(await this.buildNode(child, dari, sampai, normalDebet));
    }

    return {
      id: akun.id,
      kode_akun: akun.kode_akun,
      nama_akun: akun.nama_akun,
      children: childNodes,
      total: childNodes.reduce((sum, n) => sum + n.total, 0),
      total_awal: childNodes.reduce((sum, n) => sum + n.total_awal, 0),
      is_leaf: false,
    };
  }

  // ─── Flatten leaves untuk tabel ─────────────────────────────
  flattenLeaves(nodes, depth = 0, skipSelf = false) {
    const result = [];
    for (const node of nodes) {
      if (skipSelf) {
        result.push(...this.flattenLeaves(node.children, depth));
        continue;
      }

      if (node.is_leaf) {
        // Skip leaf yang totalnya nol semua
        if (node.total === 0 && node.total_awal === 0) continue;

        result.push({
          id: node.id,
          kode_akun: node.kode_akun,
          nama_akun: node.nama_akun,
          total: node.total,
          total_awal: node.total_awal,
          depth: depth,
          is_parent: false,
        });
      } else {
        const children = this.flattenLeaves(node.children, depth + 1);

        // Skip sub-heading jika seluruh anaknya kosong
        if (children.length === 0) continue;

        result.push({
          id: node.id,
          kode_akun: node.kode_akun,
          nama_akun: node.nama_akun,
          total: null,
          total_awal: null,
          depth: depth,
          is_parent: true,
        });
        result.push(...children);
      }
    }
    return result;
  }

  // ─── Build seksi (aset/kewajiban/modal) ────────────────────
  async buildSeksi(tipe, dari, sampai, normalDebet = true) {
    const roots = await Akun.findAll({
      where: { parent_id: null, tipe_akun: tipe },
      order: [['kode_akun', 'ASC']],
    });

    if (roots.length === 0) {
      return { groups: [], total: 0, total_awal: 0 };
    }

    const groups = {};

    for (const root of roots) {
      const subGrups = await Akun.findAll({
        where: { parent_id: root.id },
        order: [['kode_akun', 'ASC']],
      });

      if (subGrups.length === 0) {
        // Root langsung punya leaf
        const node = await this.buildNode(root, dari, sampai, normalDebet);
        const labelJumlah = root.keterangan || `Jumlah ${root.nama_akun}`;

        groups[root.kode_akun] = {
          kode_akun: root.kode_akun,
          label: root.nama_akun.toUpperCase(),
          jumlah: labelJumlah,
          rows: node.is_leaf
            ? this.flattenLeaves([node])
            : this.flattenLeaves(node.children),
          total: node.total,
          total_awal: node.total_awal,
        };
        continue;
      }

      for (const subGrup of subGrups) {
        const node = await this.buildNode(subGrup, dari, sampai, normalDebet);
        const labelJumlah = subGrup.keterangan || `Jumlah ${subGrup.nama_akun}`;

        const rows = node.is_leaf
          ? [node]
          : this.flattenLeaves(node.children);

        groups[subGrup.kode_akun] = {
          kode_akun: subGrup.kode_akun,
          label: subGrup.nama_akun.toUpperCase(),
          jumlah: labelJumlah,
          rows: rows,
          total: node.total,
          total_awal: node.total_awal,
        };
      }
    }

    // Filter group kosong
    for (const key in groups) {
      if (
        groups[key].rows.length === 0 &&
        groups[key].total === 0 &&
        groups[key].total_awal === 0
      ) {
        delete groups[key];
      }
    }

    return {
      groups,
      total: Object.values(groups).reduce((sum, g) => sum + g.total, 0),
      total_awal: Object.values(groups).reduce((sum, g) => sum + g.total_awal, 0),
    };
  }

  async buildNeraca(dariSaldo, dari, sampai) {
    this.resetCache();

    // ── Aktiva (pakai dariSaldo, bukan dari) ──
    const seksiAset = await this.buildSeksi('aset', dariSaldo, sampai, true);
    const aset = seksiAset.groups;
    const totalAset = seksiAset.total;
    const totalAsetAwal = seksiAset.total_awal;

    // ── Kewajiban ──
    const seksiKewajiban = await this.buildSeksi('kewajiban', dariSaldo, sampai, false);
    const kewajiban = seksiKewajiban.groups;
    const totalKewajiban = seksiKewajiban.total;
    const totalKewajibanAwal = seksiKewajiban.total_awal;

    // ── Modal ──
    const seksiModal = await this.buildSeksi('modal', dariSaldo, sampai, false);
    const grupModal = seksiModal.groups;
    const totalModal = seksiModal.total;
    const totalModalAwal = seksiModal.total_awal;

    const rowsModal = [];
    for (const key in grupModal) {
      rowsModal.push(...grupModal[key].rows);
    }

    // ── SHU tetap pakai dari/sampai sesuai mode (per-periode) ──
    const shu = await this.getSHU(dari, sampai);
    const shuAwal = await this.getSHUAwal();

    const totalEkuitas = totalModal + shu;
    const totalEkuitasAwal = totalModalAwal + shuAwal;
    const totalKewajibanModal = totalKewajiban + totalEkuitas;
    const totalKewajibanModalAwal = totalKewajibanAwal + totalEkuitasAwal;

    return {
      aset, totalAset, totalAsetAwal,
      kewajiban, totalKewajiban, totalKewajibanAwal,
      grupModal, rowsModal, totalModal, totalModalAwal,
      shu, shuAwal, totalEkuitas, totalEkuitasAwal,
      totalKewajibanModal, totalKewajibanModalAwal,
    };
  }

  // ─── Helpers untuk flat rows ────────────────────────────────
  buildFlatRows(groups, isNegative = false) {
    const flat = [];
    for (const key in groups) {
      const group = groups[key];
      if (group.rows.length === 0 && group.total === 0 && group.total_awal === 0) continue;

      flat.push({ type: 'group', label: group.label });

      let no = 1;
      for (const row of group.rows) {
        if (row.is_parent) {
          flat.push({
            type: 'parent',
            nama: row.nama_akun,
            kode: row.kode_akun,
            depth: row.depth || 0,
          });
        } else {
          const valBerjalan = isNegative ? -Math.abs(row.total) : row.total;
          const valSebelumnya = isNegative ? -Math.abs(row.total_awal) : row.total_awal;
          flat.push({
            type: 'row',
            no: no++,
            nama: row.nama_akun,
            kode: row.kode_akun,
            depth: row.depth || 0,
            berjalan: valBerjalan,
            sebelumnya: valSebelumnya,
          });
        }
      }

      flat.push({
        type: 'subtotal',
        label: group.jumlah || `Jumlah ${group.label}`,
        berjalan: isNegative ? -Math.abs(group.total) : group.total,
        sebelumnya: isNegative ? -Math.abs(group.total_awal) : group.total_awal,
      });
    }
    return flat;
  }

  // ─── Build Side untuk PDF (mirip logika Laravel) ──────────
  buildSide(flatRows, abs = false) {
    const out = [];
    const groupCounter = { value: 0 };

    let i = 0;
    while (i < flatRows.length) {
      const item = flatRows[i];
      if (item.type === 'group') {
        const groupLabel = item.label;
        const groupRows = [];
        i++;
        while (i < flatRows.length && flatRows[i].type !== 'subtotal') {
          groupRows.push(flatRows[i]);
          i++;
        }
        const subtotal = (i < flatRows.length && flatRows[i].type === 'subtotal') ? flatRows[i] : null;
        if (subtotal) i++;

        // Bersihkan parent tanpa anak
        const cleanedRows = [];
        for (let j = 0; j < groupRows.length; j++) {
          const r = groupRows[j];
          if (r.type === 'parent') {
            const depth = r.depth || 0;
            let hasChild = false;
            for (let k = j + 1; k < groupRows.length; k++) {
              if (groupRows[k].type === 'row' && (groupRows[k].depth || 0) > depth) {
                hasChild = true;
                break;
              }
              if (groupRows[k].type === 'parent' && (groupRows[k].depth || 0) <= depth) {
                break;
              }
            }
            if (!hasChild) continue;
          }
          cleanedRows.push(r);
        }

        const tb = abs ? Math.abs(subtotal?.berjalan || 0) : (subtotal?.berjalan || 0);
        const ts = abs ? Math.abs(subtotal?.sebelumnya || 0) : (subtotal?.sebelumnya || 0);

        if (cleanedRows.length === 0 && tb === 0 && ts === 0) continue;

        groupCounter.value++;
        const roman = toRoman(groupCounter.value);
        out.push({ type: 'group', label: groupLabel, roman });

        for (const row of cleanedRows) {
          if (row.type === 'parent') {
            out.push({ type: 'parent', nama: row.nama, depth: row.depth || 0 });
          } else if (row.type === 'row') {
            const b = abs ? Math.abs(row.berjalan || 0) : (row.berjalan || 0);
            const s = abs ? Math.abs(row.sebelumnya || 0) : (row.sebelumnya || 0);
            if (b === 0 && s === 0) continue;
            out.push({ type: 'row', no: row.no, nama: row.nama, depth: row.depth || 0, b, s });
          }
        }

        out.push({ type: 'subtotal', label: `Jumlah ${groupLabel}`, b: tb, s: ts });
      } else {
        i++;
      }
    }
    return out;
  }

  // ─── ENDPOINT: GET /bendahara/neraca ────────────────────────
  async index(req, res) {
    try {
      const pengaturan = await PengaturanWebsite.findOne();
      const tglAwalMutasi = pengaturan?.tgl_awal
        ? new Date(pengaturan.tgl_awal).toISOString().slice(0, 10)
        : new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);

      const mode = req.query.mode || 'mutasi';
      let dari, sampai, labelBerjalan, labelSebelumnya;

      if (mode === 'tahunan') {
        const tahun = parseInt(req.query.tahun) || new Date().getFullYear();
        dari = `${tahun}-01-01`;
        sampai = `${tahun}-12-31`;
        labelBerjalan = `31 Desember ${tahun}`;
        labelSebelumnya = `31 Desember ${tahun - 1}`;
      } else {
        dari = tglAwalMutasi;
        sampai = req.query.sampai || new Date().toISOString().slice(0, 10);
        labelBerjalan = formatTanggal(sampai);
        labelSebelumnya = `Saldo Awal (${formatTanggal(tglAwalMutasi)})`;
      }

      const berjalan = await this.buildNeraca(tglAwalMutasi, dari, sampai);

      const dataAktiva = this.buildFlatRows(berjalan.aset, false);
      const dataPasiva = this.buildFlatRows(berjalan.kewajiban, true);
      const dataModal = this.buildFlatRows(berjalan.grupModal, true);
      dataPasiva.push(...dataModal);

      dataPasiva.push({
        type: 'row',
        no: '',
        nama: 'SHU',
        kode: 'SHU',
        depth: 0,
        berjalan: berjalan.shu,
        sebelumnya: berjalan.shuAwal,
      });

      dataPasiva.push({
        type: 'subtotal',
        label: 'Total Kekayaan Bersih',
        berjalan: berjalan.totalEkuitas,
        sebelumnya: berjalan.totalEkuitasAwal,
      });

      const isBalance = Math.round(berjalan.totalAset) === Math.round(berjalan.totalKewajibanModal);

      res.json({
        labelBerjalan,
        labelSebelumnya,
        dataAktiva,
        dataPasiva,
        totalAset: berjalan.totalAset,
        totalAsetAwal: berjalan.totalAsetAwal,
        totalKewajiban: berjalan.totalKewajiban,
        totalKewajibanModal: berjalan.totalKewajibanModal,
        totalKewajibanModalAwal: berjalan.totalKewajibanModalAwal,
        totalEkuitas: berjalan.totalEkuitas,
        isBalance,
        mode,
        dari,
        sampai,
      });
    } catch (error) {
      console.error('Error Neraca:', error);
      res.status(500).json({ message: 'Gagal mengambil data neraca', error: error.message });
    }
  }

  // ─── ENDPOINT: GET /bendahara/neraca/export ────────────────
  async export(req, res) {
    try {
      const pengaturan = await PengaturanWebsite.findOne();
      const tglAwalMutasi = pengaturan?.tgl_awal
        ? new Date(pengaturan.tgl_awal).toISOString().slice(0, 10)
        : new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);

      const mode = req.query.mode || 'mutasi';
      let dari, sampai, labelBerjalan, labelSebelumnya;

      if (mode === 'tahunan') {
        const tahun = parseInt(req.query.tahun) || new Date().getFullYear();
        dari = `${tahun}-01-01`;
        sampai = `${tahun}-12-31`;
        labelBerjalan = `31 Desember ${tahun}`;
        labelSebelumnya = `31 Desember ${tahun - 1}`;
      } else {
        dari = tglAwalMutasi;
        sampai = req.query.sampai || new Date().toISOString().slice(0, 10);
        labelBerjalan = formatTanggal(sampai);
        labelSebelumnya = `Saldo Awal (${formatTanggal(tglAwalMutasi)})`;
      }

      // Simpan periode untuk digunakan di PDF header
      this.dari = dari;
      this.sampai = sampai;
      this.tahunBerjalan = new Date(sampai).getFullYear();
      this.tahunSebelum = this.tahunBerjalan - 1;

      const berjalan = await this.buildNeraca(tglAwalMutasi, dari, sampai);

      const nomorSurat = req.query.nomor || '---';
      const tanggalCetak = req.query.tanggal
        ? formatTanggal(req.query.tanggal)
        : formatTanggal(new Date().toISOString().slice(0, 10));

      // Buat flat rows biasa
      const dataAktiva = this.buildFlatRows(berjalan.aset, false);
      const dataPasiva = this.buildFlatRows(berjalan.kewajiban, true);
      const dataModal = this.buildFlatRows(berjalan.grupModal, true);
      dataPasiva.push(...dataModal);
      dataPasiva.push({
        type: 'row',
        no: '',
        nama: 'SHU',
        kode: 'SHU',
        depth: 0,
        berjalan: berjalan.shu,
        sebelumnya: berjalan.shuAwal,
      });
      dataPasiva.push({
        type: 'subtotal',
        label: 'Total Kekayaan Bersih',
        berjalan: berjalan.totalEkuitas,
        sebelumnya: berjalan.totalEkuitasAwal,
      });

      // Bangun side dengan buildSide
      const sideA = this.buildSide(dataAktiva, false);
      const sideP = this.buildSide(dataPasiva, true);
      // Tambahkan SHU dan grandtotal secara manual
      sideP.push({ type: 'shu', b: berjalan.shu, s: berjalan.shuAwal });
      sideP.push({ type: 'grandtotal', label: 'TOTAL PASIVA', b: berjalan.totalKewajibanModal, s: berjalan.totalKewajibanModalAwal });
      sideA.push({ type: 'grandtotal', label: 'TOTAL AKTIVA', b: berjalan.totalAset, s: berjalan.totalAsetAwal });

      const maxRows = Math.max(sideA.length, sideP.length);
      const isBalance = Math.round(berjalan.totalAset) === Math.round(berjalan.totalKewajibanModal);

      const exportType = req.query.export || 'pdf';

      if (exportType === 'pdf') {
        await this.exportPdf(
          res,
          sideA,
          sideP,
          labelBerjalan,
          labelSebelumnya,
          berjalan,
          nomorSurat,
          tanggalCetak,
          maxRows,
          isBalance,
          pengaturan
        );
      } else if (exportType === 'excel') {
        // Excel tetap menggunakan data flat asli, bukan side
        const flatA = this.buildFlatRows(berjalan.aset, false);
        const flatP = this.buildFlatRows(berjalan.kewajiban, true);
        const flatModal = this.buildFlatRows(berjalan.grupModal, true);
        flatP.push(...flatModal);
        flatP.push({
          type: 'row',
          no: '',
          nama: 'SHU',
          kode: 'SHU',
          depth: 0,
          berjalan: berjalan.shu,
          sebelumnya: berjalan.shuAwal,
        });
        flatP.push({
          type: 'subtotal',
          label: 'Total Kekayaan Bersih',
          berjalan: berjalan.totalEkuitas,
          sebelumnya: berjalan.totalEkuitasAwal,
        });
        const maxRowsExcel = Math.max(flatA.length, flatP.length);
        await this.exportExcel(
          res,
          flatA,
          flatP,
          labelBerjalan,
          labelSebelumnya,
          berjalan,
          nomorSurat,
          tanggalCetak,
          maxRowsExcel,
          isBalance
        );
      } else {
        res.status(400).json({ message: 'Format export tidak didukung' });
      }
    } catch (error) {
      console.error('Error export neraca:', error);
      res.status(500).json({ message: 'Gagal mengekspor neraca' });
    }
  }

  // ─── Export PDF (dua sisi seperti Laravel) ───────────────────
  async exportPdf(res, sideA, sideP, labelBerjalan, labelSebelumnya,
                   berjalan, nomorSurat, tanggalCetak, maxRows, isBalance, pengaturan) {
    const A4_LANDSCAPE = [841.89, 595.28];
    const doc = new PDFDocument({ margin: 40, size: A4_LANDSCAPE });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=neraca-${new Date().toISOString().slice(0, 10)}.pdf`);
    doc.pipe(res);

    const startX = 40;
    let currentY = 40;

    // ── 1. KOP KOPERASI ──
    const logoPath = pengaturan?.logo_koperasi
      ? path.join(__dirname, '..', '..', 'public', 'uploads', 'pengaturan', pengaturan.logo_koperasi)
      : null;
    if (logoPath && fs.existsSync(logoPath)) {
      doc.image(logoPath, startX, currentY, { width: 60, height: 60 });
    }

    const namaKoperasi = pengaturan?.nama_koperasi || 'KOPERASI';
    doc.fillColor('#000');
    doc.fontSize(14).font('Helvetica-Bold').text(namaKoperasi, startX + 70, currentY + 5, {
      width: 700,
      align: 'center',
    });

    doc.fontSize(8).font('Helvetica');
    const infoY = currentY + 25;
    const infoLines = [
      `Nomor : ${pengaturan?.no_badan_hukum || '-'}`,
      `Tanggal : ${formatTanggal(pengaturan?.tgl_badan_hukum)}`,
      pengaturan?.alamat_koperasi || 'Alamat Belum Diatur',
    ];
    infoLines.forEach((line, i) => {
      doc.text(line, startX + 70, infoY + i * 12, { width: 700, align: 'center' });
    });

    currentY += 75;
    doc.moveTo(startX, currentY).lineTo(startX + 750, currentY).lineWidth(3).stroke('#000');
    currentY += 2;
    doc.moveTo(startX, currentY).lineTo(startX + 750, currentY).lineWidth(1).stroke('#000');
    currentY += 15;

    // ── 2. JUDUL LAPORAN ──
    doc.fillColor('#000');
    doc.fontSize(11).font('Helvetica-Bold').text('NERACA KOMPERATIF', startX, currentY, {
      width: 750,
      align: 'center',
    });
    currentY = doc.y + 6;
    doc.fontSize(8).font('Helvetica')
      .text(`Periode: ${formatTanggal(this.dari)} s/d ${formatTanggal(this.sampai)}`, startX, currentY, {
        width: 750,
        align: 'center',
      });
    currentY = doc.y + 12;

    // ── 3. TABEL ──
    const colWidths = [30, 160, 80, 80, 15, 30, 160, 80, 80];
    const totalWidth = colWidths.reduce((a, b) => a + b, 0);

    const drawHeader = (y) => {
      // Baris pertama: AKTIVA dan PASIVA
      const h1y = y;
      doc.rect(startX, h1y, colWidths[0]+colWidths[1]+colWidths[2]+colWidths[3], 16).fill('#f0f0f0');
      doc.fillColor('#000').font('Helvetica-Bold').fontSize(9)
        .text('AKTIVA', startX + 5, h1y + 4, {
          width: colWidths[0]+colWidths[1]+colWidths[2]+colWidths[3] - 10,
          align: 'center'
        });
      const xPasiva = startX + colWidths[0]+colWidths[1]+colWidths[2]+colWidths[3] + colWidths[4];
      doc.rect(xPasiva, h1y, colWidths[5]+colWidths[6]+colWidths[7]+colWidths[8], 16).fill('#f0f0f0');
      doc.fillColor('#000');
      doc.text('PASIVA', xPasiva + 5, h1y + 4, {
        width: colWidths[5]+colWidths[6]+colWidths[7]+colWidths[8] - 10,
        align: 'center'
      });

      // Baris kedua: header detail
      const h2y = h1y + 16;
      const headersA = ['NO.', 'URAIAN', `TAHUN ${this.tahunBerjalan}`, `TAHUN ${this.tahunSebelum}`];
      const headersP = ['', 'URAIAN', `TAHUN ${this.tahunBerjalan}`, `TAHUN ${this.tahunSebelum}`];
      let x = startX;
      for (let i=0; i<4; i++) {
        doc.rect(x, h2y, colWidths[i], 16).stroke();
        doc.fillColor('#000').fontSize(7).font('Helvetica-Bold')
          .text(headersA[i], x + 2, h2y + 4, {
            width: colWidths[i] - 4,
            align: i===0 ? 'center' : 'left'
          });
        x += colWidths[i];
      }
      // Separator
      doc.rect(x, h2y, colWidths[4], 16).stroke();
      x += colWidths[4];
      for (let i=5; i<9; i++) {
        doc.rect(x, h2y, colWidths[i], 16).stroke();
        const align = (i===5) ? 'center' : (i===7||i===8) ? 'right' : 'left';
        doc.fillColor('#000').fontSize(7).font('Helvetica-Bold')
          .text(headersP[i-5], x + 2, h2y + 4, {
            width: colWidths[i] - 4,
            align: align
          });
        x += colWidths[i];
      }
      return h2y + 16;
    };

    let rowY = drawHeader(currentY);
    const pageHeight = 520;

    const drawRow = (rowA, rowP, isGrandTotal = false) => {
      if (rowY + 16 > pageHeight) {
        doc.addPage({ size: A4_LANDSCAPE, margin: 40 });
        rowY = 40;
        rowY = drawHeader(rowY);
      }

      let bgColor = '#ffffff';
      if (rowA?.type === 'group' || rowP?.type === 'group') bgColor = '#f2f2f2';
      else if (rowA?.type === 'subtotal' || rowP?.type === 'subtotal') bgColor = '#e6e6e6';
      else if (isGrandTotal) bgColor = '#d9d9d9';

      let x = startX;
      const y = rowY;
      const rowHeight = 14;

      // Gambar semua sel
      for (let i=0; i<4; i++) {
        doc.rect(x, y, colWidths[i], rowHeight).fill(bgColor).stroke();
        x += colWidths[i];
      }
      doc.rect(x, y, colWidths[4], rowHeight).fill(bgColor).stroke();
      x += colWidths[4];
      for (let i=5; i<9; i++) {
        doc.rect(x, y, colWidths[i], rowHeight).fill(bgColor).stroke();
        x += colWidths[i];
      }

      // ⬇️ FIX: reset warna isi teks ke hitam setelah .fill(bgColor)
      // (.fill() di pdfkit mengubah fillColor aktif, jadi tanpa reset ini
      // semua teks di bawah ikut kewarnain bgColor dan jadi tidak terlihat)
      doc.fillColor('#000');

      // ── Isi Aktiva ──
      x = startX;
      // Kolom 0: No
      let text = '';
      let align = 'center';
      let fontStyle = 'Helvetica';
      let fontSize = 7;
      if (rowA) {
        switch (rowA.type) {
          case 'group':
            text = rowA.roman || '';
            fontStyle = 'Helvetica-Bold';
            break;
          case 'parent':
            text = '';
            align = 'left';
            fontStyle = 'Helvetica-Bold';
            break;
          case 'row':
            text = rowA.no || '';
            fontStyle = 'Helvetica';
            break;
          case 'subtotal':
            text = '';
            fontStyle = 'Helvetica-Bold';
            break;
          case 'grandtotal':
            text = '';
            fontStyle = 'Helvetica-Bold';
            break;
          case 'shu':
            text = '';
            fontStyle = 'Helvetica-Bold';
            break;
          default:
            text = '';
        }
      }
      doc.font(fontStyle).fontSize(fontSize)
        .text(text, x + 2, y + 2, { width: colWidths[0]-4, align });
      x += colWidths[0];

      // Kolom 1: Uraian
      let uraianA = '';
      let indentA = 0;
      if (rowA) {
        switch (rowA.type) {
          case 'group':
            uraianA = rowA.label || '';
            align = 'left';
            fontStyle = 'Helvetica-Bold';
            break;
          case 'parent':
            uraianA = rowA.nama || '';
            indentA = (rowA.depth || 0) * 10;
            align = 'left';
            fontStyle = 'Helvetica-Bold';
            break;
          case 'row':
            uraianA = rowA.nama || '';
            indentA = (rowA.depth || 0) * 10;
            align = 'left';
            fontStyle = 'Helvetica';
            break;
          case 'subtotal':
            uraianA = rowA.label || '';
            align = 'left';
            fontStyle = 'Helvetica-Bold';
            break;
          case 'grandtotal':
            uraianA = rowA.label || '';
            align = 'center';
            fontStyle = 'Helvetica-Bold';
            break;
          default:
            uraianA = '';
        }
      }
      doc.font(fontStyle).fontSize(fontSize)
        .text(uraianA, x + 2 + indentA, y + 2, { width: colWidths[1]-4-indentA, align });
      x += colWidths[1];

      // Kolom 2 & 3: Angka
      const valBerjalanA = rowA ? (rowA.b !== undefined ? fmtAngka(rowA.b) : '') : '';
      const valSebelumA = rowA ? (rowA.s !== undefined ? fmtAngka(rowA.s) : '') : '';
      doc.font('Helvetica').fontSize(7)
        .text(valBerjalanA, x + 2, y + 2, { width: colWidths[2]-4, align: 'right' });
      x += colWidths[2];
      doc.text(valSebelumA, x + 2, y + 2, { width: colWidths[3]-4, align: 'right' });
      x += colWidths[3];

      // Separator
      x += colWidths[4];

      // ── Isi Pasiva ──
      let textP = '';
      if (rowP) {
        switch (rowP.type) {
          case 'group':
            textP = rowP.roman || '';
            fontStyle = 'Helvetica-Bold';
            break;
          case 'parent':
            textP = '';
            align = 'left';
            fontStyle = 'Helvetica-Bold';
            break;
          case 'row':
            textP = rowP.no || '';
            fontStyle = 'Helvetica';
            break;
          case 'subtotal':
            textP = '';
            fontStyle = 'Helvetica-Bold';
            break;
          case 'grandtotal':
            textP = '';
            fontStyle = 'Helvetica-Bold';
            break;
          case 'shu':
            textP = '';
            fontStyle = 'Helvetica-Bold';
            break;
          default:
            textP = '';
        }
      }
      doc.font(fontStyle).fontSize(fontSize)
        .text(textP, x + 2, y + 2, { width: colWidths[5]-4, align: 'center' });
      x += colWidths[5];

      let uraianP = '';
      let indentP = 0;
      if (rowP) {
        switch (rowP.type) {
          case 'group':
            uraianP = rowP.label || '';
            align = 'left';
            fontStyle = 'Helvetica-Bold';
            break;
          case 'parent':
            uraianP = rowP.nama || '';
            indentP = (rowP.depth || 0) * 10;
            align = 'left';
            fontStyle = 'Helvetica-Bold';
            break;
          case 'row':
            uraianP = rowP.nama || '';
            indentP = (rowP.depth || 0) * 10;
            align = 'left';
            fontStyle = 'Helvetica';
            break;
          case 'subtotal':
            uraianP = rowP.label || '';
            align = 'left';
            fontStyle = 'Helvetica-Bold';
            break;
          case 'grandtotal':
            uraianP = rowP.label || '';
            align = 'center';
            fontStyle = 'Helvetica-Bold';
            break;
          case 'shu':
            uraianP = 'SHU';
            align = 'left';
            fontStyle = 'Helvetica-Bold';
            break;
          default:
            uraianP = '';
        }
      }
      doc.font(fontStyle).fontSize(fontSize)
        .text(uraianP, x + 2 + indentP, y + 2, { width: colWidths[6]-4-indentP, align });
      x += colWidths[6];

      const valBerjalanP = rowP ? (rowP.b !== undefined ? fmtAngka(rowP.b) : '') : '';
      const valSebelumP = rowP ? (rowP.s !== undefined ? fmtAngka(rowP.s) : '') : '';
      doc.font('Helvetica').fontSize(7)
        .text(valBerjalanP, x + 2, y + 2, { width: colWidths[7]-4, align: 'right' });
      x += colWidths[7];
      doc.text(valSebelumP, x + 2, y + 2, { width: colWidths[8]-4, align: 'right' });

      rowY += rowHeight;
    };

    // ── Loop baris ──
    for (let i = 0; i < maxRows; i++) {
      const rowA = sideA[i] || null;
      const rowP = sideP[i] || null;
      const isGrandTotal = (rowA?.type === 'grandtotal' || rowP?.type === 'grandtotal');
      drawRow(rowA, rowP, isGrandTotal);
    }

    // ── 4. STATUS ──
    doc.moveDown(1);
    doc.fillColor('#000');
    doc.fontSize(8).font('Helvetica');
    const statusText = isBalance ? 'SEIMBANG' : 'TIDAK SEIMBANG';
    doc.text(`Status Neraca: ${statusText}`, startX, rowY + 10);
    doc.text(`Total Aset : Rp ${formatRupiah(berjalan.totalAset)}`, startX, rowY + 22);
    doc.text(`Total Pasiva: Rp ${formatRupiah(berjalan.totalKewajibanModal)}`, startX, rowY + 34);

    doc.end();
  }

  // ─── Export Excel (tetap seperti sebelumnya) ────────────────
  async exportExcel(res, dataAktiva, dataPasiva, labelBerjalan, labelSebelumnya, berjalan, nomorSurat, tanggalCetak, maxRows, isBalance) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Neraca');

    // ── Header ──
    sheet.mergeCells('A1:I1');
    sheet.getCell('A1').value = 'NERACA';
    sheet.getCell('A1').font = { size: 16, bold: true };
    sheet.getCell('A1').alignment = { horizontal: 'center' };

    sheet.mergeCells('A2:I2');
    sheet.getCell('A2').value = `Per ${labelBerjalan}`;
    sheet.getCell('A2').font = { size: 10 };
    sheet.getCell('A2').alignment = { horizontal: 'center' };

    sheet.mergeCells('A3:I3');
    sheet.getCell('A3').value = `Nomor: ${nomorSurat} | Tanggal Cetak: ${tanggalCetak}`;
    sheet.getCell('A3').font = { size: 8 };
    sheet.getCell('A3').alignment = { horizontal: 'center' };

    // ── Header Tabel ──
    const headerRow = sheet.addRow([
      'No',
      'AKTIVA / URAIAN',
      labelBerjalan,
      labelSebelumnya,
      '',
      'No',
      'PASIVA / URAIAN',
      labelBerjalan,
      labelSebelumnya,
    ]);
    headerRow.font = { bold: true, size: 8 };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 25;
    sheet.getRow(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6c757d' } };
    sheet.getRow(4).font = { color: { argb: 'FFFFFFFF' } };

    // ── Columns ──
    const columns = [
      { key: 'noA', width: 8 },
      { key: 'uraianA', width: 30 },
      { key: 'valA', width: 15 },
      { key: 'valA2', width: 15 },
      { key: 'divider', width: 3 },
      { key: 'noP', width: 8 },
      { key: 'uraianP', width: 30 },
      { key: 'valP', width: 15 },
      { key: 'valP2', width: 15 },
    ];
    sheet.columns = columns;

    let rowIndex = 5;

    for (let i = 0; i < Math.max(1, maxRows); i++) {
      const a = dataAktiva[i] || null;
      const p = dataPasiva[i] || null;
      const row = {};

      if (a) {
        if (a.type === 'group') {
          row.noA = '';
          row.uraianA = a.label.toUpperCase();
          row.valA = '';
          row.valA2 = '';
          sheet.getRow(rowIndex).font = { bold: true };
        } else if (a.type === 'parent') {
          const indent = '  '.repeat(a.depth || 0);
          row.noA = '';
          row.uraianA = `${indent}➜ ${a.nama}`;
          row.valA = '';
          row.valA2 = '';
          sheet.getRow(rowIndex).font = { italic: true };
        } else if (a.type === 'row') {
          const indent = '  '.repeat(a.depth || 0);
          row.noA = a.no || '';
          row.uraianA = `${indent}${a.nama}`;
          row.valA = formatRupiah(a.berjalan);
          row.valA2 = formatRupiah(a.sebelumnya);
          sheet.getRow(rowIndex).font = { size: 8 };
        } else if (a.type === 'subtotal') {
          row.noA = '';
          row.uraianA = a.label;
          row.valA = formatRupiah(a.berjalan);
          row.valA2 = formatRupiah(a.sebelumnya);
          sheet.getRow(rowIndex).font = { bold: true };
        }
      }

      row.divider = '';

      if (p) {
        if (p.type === 'group') {
          row.noP = '';
          row.uraianP = p.label.toUpperCase();
          row.valP = '';
          row.valP2 = '';
          sheet.getRow(rowIndex).font = { bold: true };
        } else if (p.type === 'parent') {
          const indent = '  '.repeat(p.depth || 0);
          row.noP = '';
          row.uraianP = `${indent}➜ ${p.nama}`;
          row.valP = '';
          row.valP2 = '';
          sheet.getRow(rowIndex).font = { italic: true };
        } else if (p.type === 'row') {
          const indent = '  '.repeat(p.depth || 0);
          row.noP = p.no || '';
          row.uraianP = `${indent}${p.nama}`;
          row.valP = formatRupiah(p.berjalan);
          row.valP2 = formatRupiah(p.sebelumnya);
          sheet.getRow(rowIndex).font = { size: 8 };
        } else if (p.type === 'subtotal') {
          row.noP = '';
          row.uraianP = p.label;
          row.valP = formatRupiah(p.berjalan);
          row.valP2 = formatRupiah(p.sebelumnya);
          sheet.getRow(rowIndex).font = { bold: true };
        }
      }

      const rowObj = sheet.getRow(rowIndex);
      rowObj.getCell(1).value = row.noA || '';
      rowObj.getCell(2).value = row.uraianA || '';
      rowObj.getCell(3).value = row.valA || '';
      rowObj.getCell(4).value = row.valA2 || '';
      rowObj.getCell(5).value = '';
      rowObj.getCell(6).value = row.noP || '';
      rowObj.getCell(7).value = row.uraianP || '';
      rowObj.getCell(8).value = row.valP || '';
      rowObj.getCell(9).value = row.valP2 || '';

      ['C', 'D', 'H', 'I'].forEach((col) => {
        rowObj.getCell(`${col}${rowIndex}`).alignment = { horizontal: 'right' };
        rowObj.getCell(`${col}${rowIndex}`).numFmt = '#,##0';
      });
      rowObj.getCell(`E${rowIndex}`).alignment = { horizontal: 'center' };

      rowIndex++;
    }

    // ── Total Row ──
    const totalRow = sheet.addRow([
      '',
      'TOTAL AKTIVA',
      formatRupiah(berjalan.totalAset),
      formatRupiah(berjalan.totalAsetAwal),
      '',
      '',
      'TOTAL PASIVA',
      formatRupiah(berjalan.totalKewajibanModal),
      formatRupiah(berjalan.totalKewajibanModalAwal),
    ]);
    totalRow.font = { bold: true, size: 9 };
    totalRow.getCell('B').alignment = { horizontal: 'center' };
    totalRow.getCell('G').alignment = { horizontal: 'center' };
    ['C', 'D', 'H', 'I'].forEach((col) => {
      totalRow.getCell(col).alignment = { horizontal: 'right' };
    });

    // ── Status ──
    const statusRow = sheet.addRow([
      '',
      `Status: ${isBalance ? 'SEIMBANG' : 'TIDAK SEIMBANG'}`,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ]);
    const statusColor = isBalance ? 'FF00AA00' : 'FFFF0000';
    statusRow.getCell('B').font = { bold: true, color: { argb: statusColor } };

    // ── Set column widths ──
    sheet.getColumn(1).width = 8;
    sheet.getColumn(2).width = 30;
    sheet.getColumn(3).width = 15;
    sheet.getColumn(4).width = 15;
    sheet.getColumn(5).width = 3;
    sheet.getColumn(6).width = 8;
    sheet.getColumn(7).width = 30;
    sheet.getColumn(8).width = 15;
    sheet.getColumn(9).width = 15;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=neraca-${new Date().toISOString().slice(0, 10)}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  }
}

module.exports = new NeracaController();