const PotonganGaji = require("../models/PotonganGaji");
const Anggota = require("../models/Anggota");
const Transaksi = require("../models/Transaksi");
const Jurnal = require("../models/Jurnal");
const Akun = require("../models/Akun");
const KodeReferensi = require("../models/KodeReferensi");
const Pinjaman = require("../models/Pinjaman");
const sequelize = require("../config/database");
const { QueryTypes } = require("sequelize");
const { Op } = require("sequelize");

// Helper: generate no transaksi.
// Dibuat lebih tahan tabrakan dibanding versi lama (yang hanya mengandalkan
// Math.random 4 digit / hanya 10.000 kombinasi per hari). Sekarang mengecek
// keunikan langsung ke DB dan mencoba ulang beberapa kali kalau bentrok.
async function generateNoTransaksi(t) {
  const now = new Date();
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, "");
  for (let attempt = 0; attempt < 5; attempt++) {
    const random = Math.floor(Math.random() * 1000000).toString().padStart(6, "0");
    const candidate = `POT-${ymd}-${random}`;
    const exists = await Transaksi.findOne({
      where: { no_transaksi: candidate },
      transaction: t,
    });
    if (!exists) return candidate;
  }
  // Fallback terakhir: tambahkan timestamp presisi tinggi supaya praktis mustahil bentrok
  return `POT-${ymd}-${Date.now()}`;
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

// ─── Mapping field potongan -> kode akun kredit ────────────────
// Skema akrual: jasa/bunga sudah diakui sebagai piutang (1104) + pendapatan
// (4110) SAAT PINJAMAN DICAIRKAN (lihat PinjamanController.verifikasi ->
// buildJurnalPencairanPinjaman). Potongan gaji ini hanya MELUNASI piutang
// tersebut, sehingga TIDAK boleh menyentuh 4110 lagi di sini.
const KREDIT_MAP = [
  ["simpanan_wajib", "3120", "Simpanan Wajib"],
  ["simpanan_sukarela", "2101", "Simpanan Sukarela"],
  ["utang_barang_pokok", "1106", "Utang Barang Pokok"],
  ["utang_barang_jasa", "1104", "Utang Barang Jasa"],
  ["utang_uang_menengah_pokok", "1103", "Utang Uang Menengah Pokok"],
  ["utang_uang_menengah_jasa", "1104", "Utang Uang Menengah Jasa"],
  ["utang_uang_pendek_pokok", "1103", "Utang Uang Pendek Pokok"],
  ["utang_uang_pendek_jasa", "1104", "Utang Uang Pendek Jasa"],
  ["simpanan_pokok", "3110", "Simpanan Pokok"],
];

async function buildJurnalForPotongan(potongan, userId, t) {
  // ── Validasi SEMUA akun yang dibutuhkan di awal, sebelum membuat apa pun ──
  // Ini mencegah kasus jurnal timpang (debit Kas dibuat penuh, tapi sebagian
  // kredit hilang diam-diam karena akunnya belum ada di master).
  const akunKas = await Akun.findOne({ where: { kode_akun: "1102" }, transaction: t });
  if (!akunKas) {
    throw new Error("Akun Kas Bank (kode 1102) tidak ditemukan.");
  }

  // Kumpulkan kode akun unik yang benar-benar dibutuhkan (field bernilai > 0)
  const neededCodes = new Map(); // kode_akun -> label (untuk pesan error)
  for (const [field, kodeAkun, label] of KREDIT_MAP) {
    const nilai = parseFloat(potongan[field]) || 0;
    if (nilai > 0 && !neededCodes.has(kodeAkun)) {
      neededCodes.set(kodeAkun, label);
    }
  }

  const akunCache = new Map(); // kode_akun -> instance Akun
  for (const [kodeAkun, label] of neededCodes) {
    const akun = await Akun.findOne({ where: { kode_akun: kodeAkun }, transaction: t });
    if (!akun) {
      throw new Error(
        `Akun untuk "${label}" (kode ${kodeAkun}) tidak ditemukan di master akun. Proses dibatalkan, tidak ada jurnal yang dibuat.`
      );
    }
    akunCache.set(kodeAkun, akun);
  }

  // ── Kalau ini potongan cicilan pinjaman, validasi & siapkan record   ──
  // Pinjaman-nya SEBELUM membuat transaksi/jurnal apapun, supaya kalau
  // pinjaman tidak ditemukan / datanya tidak konsisten, seluruh proses
  // dibatalkan (tidak ada jurnal setengah jadi).
  //
  // Dicocokkan lewat potongan.pinjaman_id (bukan anggota_id + status aktif),
  // karena satu anggota bisa punya lebih dari satu pinjaman aktif sekaligus
  // (pinjaman lama yang sudah separuh lunas + pinjaman baru yang baru
  // disetujui) — kalau dicocokkan lewat anggota_id saja, potongan bisa
  // salah melunasi pinjaman yang lain.
  let pinjamanTerkait = null;
  if (potongan.sumber === "pinjaman") {
    if (!potongan.pinjaman_id) {
      throw new Error(
        `Baris potongan pinjaman ini tidak punya pinjaman_id (kemungkinan dibuat sebelum kolom ini ada). Proses dibatalkan — perbaiki data pinjaman_id-nya dulu sebelum diproses ke jurnal.`
      );
    }
    pinjamanTerkait = await Pinjaman.findByPk(potongan.pinjaman_id, { transaction: t });
    if (!pinjamanTerkait) {
      throw new Error(
        `Pinjaman terkait (id ${potongan.pinjaman_id}) tidak ditemukan. Proses dibatalkan, tidak ada jurnal yang dibuat.`
      );
    }
  }

  // ── Semua akun & pinjaman tervalidasi, baru mulai membuat transaksi & jurnal ──
  let referensi = await KodeReferensi.findOne({ where: { kode: "POT-001" }, transaction: t });
  if (!referensi) {
    referensi = await KodeReferensi.create(
      {
        kode: "POT-001",
        uraian_transaksi: "Potongan Gaji PKM SUDI",
        label: "Potongan Gaji",
        akun_debet: "Kas Bank",
        // Kredit tersebar ke beberapa akun tergantung isi potongan (simpanan
        // & piutang) — lihat detail baris jurnal per transaksi untuk rincian.
        akun_kredit: "Beragam (lihat rincian jurnal)",
      },
      { transaction: t }
    );
  }

  const noTransaksi = await generateNoTransaksi(t);

  const transaksi = await Transaksi.create(
    {
      no_transaksi: noTransaksi,
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
      user_id: userId,
    },
    { transaction: t }
  );

  await Jurnal.create(
    {
      transaksi_id: transaksi.id,
      tanggal: new Date(),
      akun_id: akunKas.id,
      debet: potongan.total,
      kredit: 0,
      keterangan: `Penerimaan potongan ${potongan.anggota.nama}`,
    },
    { transaction: t }
  );

  for (const [field, kodeAkun, label] of KREDIT_MAP) {
    const nilai = parseFloat(potongan[field]) || 0;
    if (nilai > 0) {
      const akun = akunCache.get(kodeAkun); // sudah divalidasi ada, tidak mungkin null di sini
      await Jurnal.create(
        {
          transaksi_id: transaksi.id,
          tanggal: new Date(),
          akun_id: akun.id,
          debet: 0,
          kredit: nilai,
          keterangan: label,
        },
        { transaction: t }
      );
    }
  }

  await potongan.update({ is_processed: true }, { transaction: t });

  // ── Kalau ini cicilan pinjaman: turunkan sisa_angsuran & tandai lunas ──
  // Berjalan sampai jangka_waktu selesai (sisa_angsuran habis), sesuai
  // pinjaman.jangka_waktu saat pengajuan.
  if (pinjamanTerkait) {
    const sisaBaru = (pinjamanTerkait.sisa_angsuran || 0) - 1;
    await pinjamanTerkait.update(
      {
        sisa_angsuran: sisaBaru,
        angsuran_ke: (pinjamanTerkait.angsuran_ke || 0) + 1,
        status: sisaBaru <= 0 ? "lunas" : "aktif",
      },
      { transaction: t }
    );
  }

  return transaksi;
}

exports.processToJurnal = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const potongan = await PotonganGaji.findByPk(id, {
      include: [{ model: Anggota, as: "anggota" }],
      transaction: t,
    });
    if (!potongan) {
      await t.rollback();
      return res.status(404).json({ message: "Potongan tidak ditemukan." });
    }
    if (potongan.is_processed) {
      await t.rollback();
      return res.status(422).json({ message: "Potongan sudah diproses." });
    }

    // FIX: verifyToken (middlewares/AuthMiddleware.js) hanya meng-set
    // req.userId & req.userRole, TIDAK PERNAH req.user. Kode lama memakai
    // req.user.id di sini, yang selalu undefined -> setiap panggilan
    // endpoint ini pasti crash TypeError sebelum sempat membuat jurnal.
    const transaksi = await buildJurnalForPotongan(potongan, req.userId, t);

    await t.commit();
    return res.json({ message: "Potongan berhasil diproses ke jurnal.", data: transaksi });
  } catch (error) {
    await t.rollback();
    console.error(error);
    return res.status(500).json({ message: error.message || "Gagal memproses potongan." });
  }
};

exports.processAll = async (req, res) => {
  try {
    const { bulan, tahun, instansi } = req.body;
    if (!bulan || !tahun) {
      return res.status(422).json({ message: "Bulan dan tahun wajib diisi." });
    }

    const includeAnggota = { model: Anggota, as: "anggota", attributes: ["id", "nama", "instansi"] };
    if (instansi) {
      includeAnggota.where = { instansi };
    }

    const rows = await PotonganGaji.findAll({
      where: { bulan, tahun, is_processed: false },
      include: [includeAnggota],
    });

    if (rows.length === 0) {
      return res.status(422).json({
        message: `Tidak ada potongan yang belum diproses untuk ${bulan} ${tahun}${instansi ? ` (${instansi})` : ""}.`,
      });
    }

    let success = 0;
    let failed = 0;
    let skippedZero = 0;
    const errors = [];

    for (const potongan of rows) {
      if (parseFloat(potongan.total) <= 0) {
        skippedZero++;
        continue;
      }
      const t = await sequelize.transaction();
      try {
        // FIX: sama seperti processToJurnal — req.user.id selalu undefined
        // karena verifyToken cuma set req.userId. Pakai req.userId.
        await buildJurnalForPotongan(potongan, req.userId, t);
        await t.commit();
        success++;
      } catch (err) {
        await t.rollback();
        failed++;
        errors.push({ anggota_id: potongan.anggota_id, nama: potongan.anggota?.nama, message: err.message });
      }
    }

    return res.json({
      message: `Selesai memproses ${bulan} ${tahun}: ${success} transaksi berhasil dibuat${
        failed ? `, ${failed} gagal` : ""
      }${skippedZero ? `, ${skippedZero} dilewati (total 0)` : ""}.`,
      success,
      failed,
      skippedZero,
      errors,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Gagal memproses semua potongan." });
  }
};

// ─── Generate otomatis baris potongan cicilan pinjaman bulan ini ───
// Dipanggil bendahara tiap awal bulan (atau dijadwalkan lewat cron
// node-cron di server) untuk membuat baris PotonganGaji bagi SEMUA pinjaman
// yang masih berjalan (status "aktif", metode_pembayaran "potong_gaji",
// sisa_angsuran > 0). Baris bulan pertama sudah dibuat oleh
// PinjamanController.verifikasi saat pinjaman disetujui — fungsi ini
// mengisi bulan-bulan berikutnya sampai jangka_waktu selesai.
//
// Idempotent: kalau baris untuk pinjaman_id + bulan/tahun ini sudah ada,
// dilewati (tidak dibuat dobel).
exports.generatePinjamanBulanIni = async (req, res) => {
  try {
    const now = new Date();
    const bulan = now.toLocaleString("id-ID", { month: "long" });
    const tahun = now.getFullYear();

    const pinjamanAktif = await Pinjaman.findAll({
      where: {
        status: "aktif",
        metode_pembayaran: "potong_gaji",
        sisa_angsuran: { [Op.gt]: 0 },
      },
    });

    let created = 0;
    let skipped = 0;
    const errors = [];

    for (const pinjaman of pinjamanAktif) {
      try {
        const existing = await PotonganGaji.findOne({
          where: { pinjaman_id: pinjaman.id, bulan, tahun },
        });
        if (existing) {
          skipped++;
          continue;
        }

        const maxUrut = await PotonganGaji.max("no_urut", { where: { bulan, tahun } });
        const angsuranKe = (pinjaman.angsuran_ke || 0) + 1;

        await PotonganGaji.create({
          anggota_id: pinjaman.anggota_id,
          pinjaman_id: pinjaman.id,
          bulan,
          tahun,
          no_urut: (maxUrut || 0) + 1,
          sumber: "pinjaman",
          keterangan: `Angsuran pinjaman ke-${angsuranKe} dari ${pinjaman.jangka_waktu} bulan`,
          plafon: pinjaman.plafon,
          jangka_waktu: `${pinjaman.jangka_waktu}x`,
          angsuran_ke: angsuranKe,
          simpanan_wajib: pinjaman.simpanan_wajib || 0,
          simpanan_sukarela: pinjaman.simpanan_sukarela || 0,
          utang_barang_pokok: pinjaman.utang_brg_pokok || 0,
          utang_barang_jasa: pinjaman.utang_brg_jasa || 0,
          utang_uang_menengah_pokok: pinjaman.utang_uang_menengah_pokok || 0,
          utang_uang_menengah_jasa: pinjaman.utang_uang_menengah_jasa || 0,
          utang_uang_pendek_pokok: pinjaman.utang_uang_pendek_pokok || 0,
          utang_uang_pendek_jasa: pinjaman.utang_uang_pendek_jasa || 0,
          simpanan_pokok: pinjaman.simpanan_pokok || 0,
          total:
            (parseFloat(pinjaman.simpanan_wajib) || 0) +
            (parseFloat(pinjaman.simpanan_sukarela) || 0) +
            (parseFloat(pinjaman.utang_brg_pokok) || 0) +
            (parseFloat(pinjaman.utang_brg_jasa) || 0) +
            (parseFloat(pinjaman.utang_uang_menengah_pokok) || 0) +
            (parseFloat(pinjaman.utang_uang_menengah_jasa) || 0) +
            (parseFloat(pinjaman.utang_uang_pendek_pokok) || 0) +
            (parseFloat(pinjaman.utang_uang_pendek_jasa) || 0) +
            (parseFloat(pinjaman.simpanan_pokok) || 0),
          is_processed: false,
        });
        created++;
      } catch (err) {
        errors.push({ pinjaman_id: pinjaman.id, anggota_id: pinjaman.anggota_id, message: err.message });
      }
    }

    return res.json({
      message: `Generate potongan pinjaman ${bulan} ${tahun}: ${created} baris baru dibuat${
        skipped ? `, ${skipped} dilewati (sudah ada)` : ""
      }${errors.length ? `, ${errors.length} gagal` : ""}.`,
      created,
      skipped,
      errors,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Gagal generate potongan pinjaman bulan ini." });
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

const FIELDS_POTONGAN = [
  "simpanan_wajib",
  "simpanan_sukarela",
  "simpanan_pokok",
  "utang_barang_pokok",
  "utang_barang_jasa",
  "utang_uang_menengah_pokok",
  "utang_uang_menengah_jasa",
  "utang_uang_pendek_pokok",
  "utang_uang_pendek_jasa",
];

// ─── Daftar instansi aktif (untuk dropdown) ─────────────────
exports.listInstansi = async (req, res) => {
  try {
    const rows = await Anggota.findAll({
      attributes: [[sequelize.fn("DISTINCT", sequelize.col("instansi")), "instansi"]],
      where: { instansi: { [Op.ne]: null, [Op.ne]: "" }, status: "aktif" },
      order: [["instansi", "ASC"]],
      raw: true,
    });
    return res.json({ data: rows.map((r) => r.instansi).filter(Boolean) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Gagal mengambil daftar instansi." });
  }
};

exports.getAnggotaByInstansi = async (req, res) => {
  try {
    const { instansi, bulan, tahun } = req.query;
    if (!instansi || !bulan || !tahun) {
      return res.status(422).json({ message: "Instansi, bulan, dan tahun wajib diisi." });
    }

    const anggotaList = await Anggota.findAll({
      where: { instansi, status: "aktif" },
      attributes: ["id", "no_anggota", "nama", "instansi"],
      order: [["nama", "ASC"]],
    });

    if (anggotaList.length === 0) {
      return res.json({ data: [] });
    }

    const anggotaIds = anggotaList.map((a) => a.id);
    const existingRows = await PotonganGaji.findAll({
      where: { anggota_id: anggotaIds, bulan, tahun },
    });
    const existingMap = {};
    existingRows.forEach((p) => {
      existingMap[p.anggota_id] = p;
    });

    const data = anggotaList.map((a) => {
      const p = existingMap[a.id];
      const row = {
        anggota_id: a.id,
        no_anggota: a.no_anggota,
        nama: a.nama,
        potongan_id: p ? p.id : null,
        sumber: p ? p.sumber : null,
        is_processed: p ? !!p.is_processed : false,
        keterangan: p ? p.keterangan || "" : "",
      };
      FIELDS_POTONGAN.forEach((f) => {
        row[f] = p ? parseFloat(p[f]) || 0 : 0;
      });
      return row;
    });

    return res.json({ data });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Gagal mengambil data anggota per instansi." });
  }
};

exports.batchStore = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { instansi, bulan, tahun, data } = req.body;
    if (!instansi || !bulan || !tahun || !Array.isArray(data) || data.length === 0) {
      await t.rollback();
      return res.status(422).json({ message: "Instansi, bulan, tahun, dan data wajib diisi." });
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of data) {
      if (!row.anggota_id) {
        skipped++;
        continue;
      }

      const total = FIELDS_POTONGAN.reduce((sum, f) => sum + (parseFloat(row[f]) || 0), 0);
      if (total <= 0) {
        skipped++;
        continue;
      }

      const anggota = await Anggota.findByPk(row.anggota_id, { transaction: t });
      if (!anggota || anggota.instansi !== instansi) {
        skipped++;
        continue;
      }

      const existing = await PotonganGaji.findOne({
        where: { anggota_id: row.anggota_id, bulan, tahun },
        transaction: t,
      });

      if (existing) {
        // Jangan timpa entri otomatis dari pinjaman atau yang sudah diproses ke jurnal
        if (existing.sumber === "pinjaman" || existing.is_processed) {
          skipped++;
          continue;
        }
        const updates = { keterangan: row.keterangan || existing.keterangan, total };
        FIELDS_POTONGAN.forEach((f) => {
          updates[f] = parseFloat(row[f]) || 0;
        });
        await existing.update(updates, { transaction: t });
        updated++;
      } else {
        const maxUrut = await PotonganGaji.max("no_urut", {
          where: { bulan, tahun },
          transaction: t,
        });
        const payload = {
          anggota_id: row.anggota_id,
          bulan,
          tahun,
          no_urut: (maxUrut || 0) + 1,
          sumber: "manual",
          keterangan: row.keterangan || null,
          total,
          is_processed: false,
        };
        FIELDS_POTONGAN.forEach((f) => {
          payload[f] = parseFloat(row[f]) || 0;
        });
        await PotonganGaji.create(payload, { transaction: t });
        created++;
      }
    }

    await t.commit();
    return res.status(201).json({
      message: `Berhasil disimpan untuk instansi ${instansi}: ${created} baru, ${updated} diperbarui${
        skipped ? `, ${skipped} dilewati (kosong / sudah diproses / dari pinjaman)` : ""
      }.`,
      created,
      updated,
      skipped,
    });
  } catch (error) {
    await t.rollback();
    console.error(error);
    return res.status(500).json({ message: "Gagal menyimpan potongan per instansi." });
  }
};

// ─── Export Excel ─────────────────────────────────────────────
exports.exportExcel = async (req, res) => {
  try {
    const { bulan, tahun, instansi } = req.query;
    const where = {};
    if (bulan) where.bulan = bulan;
    if (tahun) where.tahun = tahun;

    const includeAnggota = {
      model: Anggota,
      as: "anggota",
      attributes: ["id", "no_anggota", "nama", "instansi"],
    };
    if (instansi) {
      includeAnggota.where = { instansi };
    }

    const data = await PotonganGaji.findAll({
      where,
      include: [includeAnggota],
      order: [["tahun", "DESC"], ["bulan", "DESC"], ["no_urut", "ASC"]],
    });

    if (data.length === 0) {
      return res.status(422).json({ message: "Tidak ada data potongan untuk diekspor." });
    }

    const ExcelJS = require("exceljs");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Potongan Gaji");

    const fieldConfig = [
      { key: "simpanan_wajib", label: "Simpanan Wajib" },
      { key: "simpanan_sukarela", label: "Simpanan Sukarela" },
      { key: "utang_barang_pokok", label: "Utang Barang Pokok" },
      { key: "utang_barang_jasa", label: "Utang Barang Jasa" },
      { key: "utang_uang_menengah_pokok", label: "Utang Uang Menengah Pokok" },
      { key: "utang_uang_menengah_jasa", label: "Utang Uang Menengah Jasa" },
      { key: "utang_uang_pendek_pokok", label: "Utang Uang Pendek Pokok" },
      { key: "utang_uang_pendek_jasa", label: "Utang Uang Pendek Jasa" },
      { key: "simpanan_pokok", label: "Simpanan Pokok" },
    ];

    const columns = [
      { header: "No", key: "no", width: 8 },
      { header: "No Anggota", key: "no_anggota", width: 15 },
      { header: "Nama", key: "nama", width: 30 },
      { header: "Instansi", key: "instansi", width: 25 },
      { header: "Bulan", key: "bulan", width: 15 },
      { header: "Tahun", key: "tahun", width: 10 },
      { header: "Sumber", key: "sumber", width: 15 },
      { header: "Keterangan", key: "keterangan", width: 30 },
      ...fieldConfig.map((f) => ({ header: f.label, key: f.key, width: 20 })),
      { header: "Total", key: "total", width: 18 },
      { header: "Status", key: "status", width: 15 },
    ];

    sheet.columns = columns;
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { horizontal: "center" };

    data.forEach((item, idx) => {
      const rowData = {
        no: idx + 1,
        no_anggota: item.anggota?.no_anggota || "-",
        nama: item.anggota?.nama || "-",
        instansi: item.anggota?.instansi || "-",
        bulan: item.bulan,
        tahun: item.tahun,
        sumber: item.sumber === "pinjaman" ? "Otomatis" : "Manual",
        keterangan: item.keterangan || "",
        total: parseFloat(item.total) || 0,
        status: item.is_processed ? "Diproses" : "Belum",
      };
      fieldConfig.forEach(({ key }) => {
        rowData[key] = parseFloat(item[key]) || 0;
      });
      sheet.addRow(rowData);
    });

    const numberKeys = ["total", ...fieldConfig.map((f) => f.key)];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      numberKeys.forEach((key) => {
        const cell = row.getCell(key);
        if (cell) {
          cell.alignment = { horizontal: "right" };
          cell.numFmt = "#,##0";
        }
      });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=potongan-gaji-${Date.now()}.xlsx`
    );
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("❌ Export Excel error:", error);
    res.status(500).json({ message: "Gagal mengekspor Excel." });
  }
};