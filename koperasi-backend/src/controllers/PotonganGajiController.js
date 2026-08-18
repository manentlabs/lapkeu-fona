const PotonganGaji = require("../models/PotonganGaji");
const Anggota = require("../models/Anggota");
const Transaksi = require("../models/Transaksi");
const Jurnal = require("../models/Jurnal");
const Akun = require("../models/Akun");
const KodeReferensi = require("../models/KodeReferensi");
const sequelize = require("../config/database");
const { QueryTypes } = require("sequelize");
const { Op } = require("sequelize");

// Helper: generate no transaksi
function generateNoTransaksi() {
  const now = new Date();
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `POT-${ymd}-${random}`;
}

// ─── Index ────────────────────────────────────────────────────
exports.index = async (req, res) => {
  try {
    const { bulan, tahun, anggota_id, page = 1, per_page = 10 } = req.query;
    const where = {};
    if (bulan) where.bulan = bulan;
    if (tahun) where.tahun = tahun;
    if (anggota_id) where.anggota_id = anggota_id;

    const { rows, count } = await PotonganGaji.findAndCountAll({
      where,
      include: [{ model: Anggota, as: "anggota", attributes: ["id", "no_anggota", "nama"] }],
      order: [["tahun", "DESC"], ["bulan", "DESC"], ["no_urut", "ASC"]],
      limit: parseInt(per_page),
      offset: (parseInt(page) - 1) * parseInt(per_page),
    });

    // Ringkasan per bulan
    const summary = await PotonganGaji.findAll({
      attributes: ["bulan", "tahun", [sequelize.fn("SUM", sequelize.col("total")), "total"]],
      group: ["bulan", "tahun"],
      order: [["tahun", "DESC"], ["bulan", "DESC"]],
      raw: true,
    });

    return res.json({
      data: rows,
      pagination: { page: parseInt(page), per_page: parseInt(per_page), total: count, total_pages: Math.ceil(count / per_page) },
      summary,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Gagal mengambil data potongan." });
  }
};

exports.store = async (req, res) => {
  try {
    const { bulan, tahun, data } = req.body;
    if (!bulan || !tahun || !data || !Array.isArray(data) || data.length === 0) {
      return res.status(422).json({ message: "Data tidak lengkap." });
    }

    // Cek duplikat HANYA terhadap data manual (import sebelumnya),
    // bukan terhadap entri otomatis dari pinjaman
    const existing = await PotonganGaji.count({
      where: { bulan, tahun, sumber: "manual" },
    });
    if (existing > 0) {
      return res.status(422).json({
        message: `Data import manual untuk ${bulan} ${tahun} sudah ada. Hapus data lama dulu jika ingin import ulang.`,
      });
    }

    const potonganData = [];
    for (const row of data) {
      let anggota = null;
      if (row.no_anggota) {
        anggota = await Anggota.findOne({ where: { no_anggota: row.no_anggota } });
      }
      if (!anggota && row.nama) {
        anggota = await Anggota.findOne({ where: { nama: { [Op.like]: `%${row.nama}%` } } });
      }
      if (!anggota) continue;

      const total = (parseFloat(row.simpanan_wajib) || 0) +
        (parseFloat(row.simpanan_sukarela) || 0) +
        (parseFloat(row.utang_barang_pokok) || 0) +
        (parseFloat(row.utang_barang_jasa) || 0) +
        (parseFloat(row.utang_uang_menengah_pokok) || 0) +
        (parseFloat(row.utang_uang_menengah_jasa) || 0) +
        (parseFloat(row.utang_uang_pendek_pokok) || 0) +
        (parseFloat(row.utang_uang_pendek_jasa) || 0) +
        (parseFloat(row.simpanan_pokok) || 0);

      potonganData.push({
        anggota_id: anggota.id,
        bulan,
        tahun,
        no_urut: row.no_urut || null,
        sumber: "manual",
        plafon: row.plafon || null,
        jangka_waktu: row.jangka_waktu || null,
        angsuran_ke: row.angsuran_ke || null,
        simpanan_wajib: row.simpanan_wajib || 0,
        simpanan_sukarela: row.simpanan_sukarela || 0,
        utang_barang_pokok: row.utang_barang_pokok || 0,
        utang_barang_jasa: row.utang_barang_jasa || 0,
        utang_uang_menengah_pokok: row.utang_uang_menengah_pokok || 0,
        utang_uang_menengah_jasa: row.utang_uang_menengah_jasa || 0,
        utang_uang_pendek_pokok: row.utang_uang_pendek_pokok || 0,
        utang_uang_pendek_jasa: row.utang_uang_pendek_jasa || 0,
        simpanan_pokok: row.simpanan_pokok || 0,
        total,
      });
    }

    if (potonganData.length === 0) {
      return res.status(422).json({ message: "Tidak ada data valid untuk disimpan." });
    }

    await PotonganGaji.bulkCreate(potonganData);
    return res.status(201).json({ message: `Berhasil import ${potonganData.length} data potongan.` });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Gagal menyimpan data potongan." });
  }
};

// ─── Create Manual (utang / lain-lain, bukan dari pinjaman) ───
exports.create = async (req, res) => {
  try {
    const {
      anggota_id, no_anggota, bulan, tahun, keterangan,
      simpanan_wajib, simpanan_sukarela,
      utang_barang_pokok, utang_barang_jasa,
      utang_uang_menengah_pokok, utang_uang_menengah_jasa,
      utang_uang_pendek_pokok, utang_uang_pendek_jasa,
      simpanan_pokok,
    } = req.body;

    if (!bulan || !tahun || (!anggota_id && !no_anggota)) {
      return res.status(422).json({ message: "Anggota, bulan, dan tahun wajib diisi." });
    }

    let anggota = anggota_id
      ? await Anggota.findByPk(anggota_id)
      : await Anggota.findOne({ where: { no_anggota } });

    if (!anggota) {
      return res.status(404).json({ message: "Anggota tidak ditemukan." });
    }

    const total =
      (parseFloat(simpanan_wajib) || 0) +
      (parseFloat(simpanan_sukarela) || 0) +
      (parseFloat(utang_barang_pokok) || 0) +
      (parseFloat(utang_barang_jasa) || 0) +
      (parseFloat(utang_uang_menengah_pokok) || 0) +
      (parseFloat(utang_uang_menengah_jasa) || 0) +
      (parseFloat(utang_uang_pendek_pokok) || 0) +
      (parseFloat(utang_uang_pendek_jasa) || 0) +
      (parseFloat(simpanan_pokok) || 0);

    const maxUrut = await PotonganGaji.max("no_urut", { where: { bulan, tahun } });

    const potongan = await PotonganGaji.create({
      anggota_id: anggota.id,
      bulan,
      tahun,
      no_urut: (maxUrut || 0) + 1,
      sumber: "manual",
      keterangan: keterangan || null,
      simpanan_wajib: simpanan_wajib || 0,
      simpanan_sukarela: simpanan_sukarela || 0,
      utang_barang_pokok: utang_barang_pokok || 0,
      utang_barang_jasa: utang_barang_jasa || 0,
      utang_uang_menengah_pokok: utang_uang_menengah_pokok || 0,
      utang_uang_menengah_jasa: utang_uang_menengah_jasa || 0,
      utang_uang_pendek_pokok: utang_uang_pendek_pokok || 0,
      utang_uang_pendek_jasa: utang_uang_pendek_jasa || 0,
      simpanan_pokok: simpanan_pokok || 0,
      total,
      is_processed: false,
    });

    return res.status(201).json({ message: "Potongan manual berhasil ditambahkan.", data: potongan });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Gagal menambahkan potongan." });
  }
};

// ─── Update (hanya untuk sumber manual & belum diproses) ───
exports.update = async (req, res) => {
  try {
    const potongan = await PotonganGaji.findByPk(req.params.id);
    if (!potongan) return res.status(404).json({ message: "Potongan tidak ditemukan." });

    if (potongan.sumber === "pinjaman") {
      return res.status(403).json({
        message: "Potongan dari pinjaman dibuat otomatis dan tidak bisa diedit. Tambahkan item potongan manual baru jika perlu.",
      });
    }
    if (potongan.is_processed) {
      return res.status(422).json({ message: "Potongan sudah diproses ke jurnal, tidak bisa diedit." });
    }

    const fields = [
      "keterangan", "simpanan_wajib", "simpanan_sukarela",
      "utang_barang_pokok", "utang_barang_jasa",
      "utang_uang_menengah_pokok", "utang_uang_menengah_jasa",
      "utang_uang_pendek_pokok", "utang_uang_pendek_jasa",
      "simpanan_pokok",
    ];
    const updates = {};
    fields.forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f] || 0;
    });
    if (req.body.keterangan !== undefined) updates.keterangan = req.body.keterangan;

    updates.total =
      (parseFloat(updates.simpanan_wajib ?? potongan.simpanan_wajib) || 0) +
      (parseFloat(updates.simpanan_sukarela ?? potongan.simpanan_sukarela) || 0) +
      (parseFloat(updates.utang_barang_pokok ?? potongan.utang_barang_pokok) || 0) +
      (parseFloat(updates.utang_barang_jasa ?? potongan.utang_barang_jasa) || 0) +
      (parseFloat(updates.utang_uang_menengah_pokok ?? potongan.utang_uang_menengah_pokok) || 0) +
      (parseFloat(updates.utang_uang_menengah_jasa ?? potongan.utang_uang_menengah_jasa) || 0) +
      (parseFloat(updates.utang_uang_pendek_pokok ?? potongan.utang_uang_pendek_pokok) || 0) +
      (parseFloat(updates.utang_uang_pendek_jasa ?? potongan.utang_uang_pendek_jasa) || 0) +
      (parseFloat(updates.simpanan_pokok ?? potongan.simpanan_pokok) || 0);

    await potongan.update(updates);
    return res.json({ message: "Potongan berhasil diperbarui.", data: potongan });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Gagal memperbarui potongan." });
  }
};

// ─── Proses ke Jurnal (buat transaksi potongan) ─────────────
exports.processToJurnal = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params; // id potongan
    const potongan = await PotonganGaji.findByPk(id, {
      include: [{ model: Anggota, as: "anggota" }],
    });
    if (!potongan) return res.status(404).json({ message: "Potongan tidak ditemukan." });
    if (potongan.is_processed) {
      return res.status(422).json({ message: "Potongan sudah diproses." });
    }

    // Ambil akun-akun yang diperlukan
    // Akun Kas/Bank (untuk penerimaan) – asumsi akun kode 1102 (Kas Bank)
    const akunKas = await Akun.findOne({ where: { kode_akun: "1102" } });
    if (!akunKas) return res.status(422).json({ message: "Akun Kas Bank tidak ditemukan." });

    // Ambil kode referensi untuk transaksi potongan gaji
    let referensi = await KodeReferensi.findOne({ where: { kode: "POT-001" } });
    if (!referensi) {
      // Buat default jika belum ada
      referensi = await KodeReferensi.create({
        kode: "POT-001",
        uraian_transaksi: "Potongan Gaji PKM SUDI",
        label: "Potongan Gaji",
        akun_debet: "Kas Bank",
        akun_kredit: "Piutang Anggota",
      });
    }

    // Buat transaksi header
    const transaksi = await Transaksi.create({
      no_transaksi: generateNoTransaksi(),
      kode_referensi_id: referensi.id,
      label: referensi.label,
      tanggal: new Date(),
      deskripsi: `Potongan gaji ${potongan.anggota.nama} - ${potongan.bulan} ${potongan.tahun}`,
      jumlah: potongan.total,
      akun_id: akunKas.id,
      akun_debet_id: akunKas.id,
      akun_kredit_id: null,
      akun: akunKas.nama_akun,
      anggota_id: potongan.anggota_id,
      anggota: potongan.anggota.nama,
      unit_usaha: "Simpan Pinjam",
      user_id: req.user.id,
    }, { transaction: t });

    // Buat jurnal entries (multi-row)
    // 1. Debet Kas Bank
    await Jurnal.create({
      transaksi_id: transaksi.id,
      tanggal: new Date(),
      akun_id: akunKas.id,
      debet: potongan.total,
      kredit: 0,
      keterangan: `Penerimaan potongan ${potongan.anggota.nama}`,
    }, { transaction: t });

    // 2. Kredit ke masing-masing akun piutang (berdasarkan jenis)
    // Mapping akun kredit
    const kreditEntries = [];

    // Simpanan Wajib → akun simpanan wajib (asumsi kode 2201)
    if (potongan.simpanan_wajib > 0) {
      const akun = await Akun.findOne({ where: { kode_akun: "2201" } });
      if (akun) kreditEntries.push({ akun_id: akun.id, kredit: potongan.simpanan_wajib, ket: "Simpanan Wajib" });
    }

    // Simpanan Sukarela → akun simpanan sukarela (kode 2202)
    if (potongan.simpanan_sukarela > 0) {
      const akun = await Akun.findOne({ where: { kode_akun: "2202" } });
      if (akun) kreditEntries.push({ akun_id: akun.id, kredit: potongan.simpanan_sukarela, ket: "Simpanan Sukarela" });
    }

    // Utang Barang Pokok → akun piutang barang (kode 1106)
    if (potongan.utang_barang_pokok > 0) {
      const akun = await Akun.findOne({ where: { kode_akun: "1106" } });
      if (akun) kreditEntries.push({ akun_id: akun.id, kredit: potongan.utang_barang_pokok, ket: "Utang Barang Pokok" });
    }
    if (potongan.utang_barang_jasa > 0) {
      const akun = await Akun.findOne({ where: { kode_akun: "1107" } });
      if (akun) kreditEntries.push({ akun_id: akun.id, kredit: potongan.utang_barang_jasa, ket: "Utang Barang Jasa" });
    }

    // Utang Uang Menengah Pokok & Jasa
    if (potongan.utang_uang_menengah_pokok > 0) {
      const akun = await Akun.findOne({ where: { kode_akun: "1103" } });
      if (akun) kreditEntries.push({ akun_id: akun.id, kredit: potongan.utang_uang_menengah_pokok, ket: "Utang Uang Menengah Pokok" });
    }
    if (potongan.utang_uang_menengah_jasa > 0) {
      const akun = await Akun.findOne({ where: { kode_akun: "1104" } });
      if (akun) kreditEntries.push({ akun_id: akun.id, kredit: potongan.utang_uang_menengah_jasa, ket: "Utang Uang Menengah Jasa" });
    }

    // Utang Uang Pendek Pokok & Jasa
    if (potongan.utang_uang_pendek_pokok > 0) {
      const akun = await Akun.findOne({ where: { kode_akun: "1105" } });
      if (akun) kreditEntries.push({ akun_id: akun.id, kredit: potongan.utang_uang_pendek_pokok, ket: "Utang Uang Pendek Pokok" });
    }
    if (potongan.utang_uang_pendek_jasa > 0) {
      const akun = await Akun.findOne({ where: { kode_akun: "1108" } });
      if (akun) kreditEntries.push({ akun_id: akun.id, kredit: potongan.utang_uang_pendek_jasa, ket: "Utang Uang Pendek Jasa" });
    }

    // Simpanan Pokok
    if (potongan.simpanan_pokok > 0) {
      const akun = await Akun.findOne({ where: { kode_akun: "2200" } });
      if (akun) kreditEntries.push({ akun_id: akun.id, kredit: potongan.simpanan_pokok, ket: "Simpanan Pokok" });
    }

    // Simpan kredit entries ke jurnal
    for (const entry of kreditEntries) {
      await Jurnal.create({
        transaksi_id: transaksi.id,
        tanggal: new Date(),
        akun_id: entry.akun_id,
        debet: 0,
        kredit: entry.kredit,
        keterangan: entry.ket,
      }, { transaction: t });
    }

    // Tandai potongan sudah diproses
    await potongan.update({ is_processed: true }, { transaction: t });

    await t.commit();
    return res.json({ message: "Potongan berhasil diproses ke jurnal.", data: transaksi });
  } catch (error) {
    await t.rollback();
    console.error(error);
    return res.status(500).json({ message: "Gagal memproses potongan." });
  }
};

// ─── Destroy ──────────────────────────────────────────────────
exports.destroy = async (req, res) => {
  try {
    const potongan = await PotonganGaji.findByPk(req.params.id);
    if (!potongan) return res.status(404).json({ message: "Potongan tidak ditemukan." });
    if (potongan.is_processed) {
      return res.status(422).json({ message: "Potongan sudah diproses, tidak bisa dihapus." });
    }
    await potongan.destroy();
    return res.json({ message: "Potongan berhasil dihapus." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Gagal menghapus potongan." });
  }
};