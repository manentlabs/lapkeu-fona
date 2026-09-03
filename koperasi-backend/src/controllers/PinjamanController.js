// controllers/PinjamanController.js
const { Pinjaman, Anggota, User, sequelize } = require("../models");
const PotonganGaji = require("../models/PotonganGaji");
const Transaksi = require("../models/Transaksi");
const Jurnal = require("../models/Jurnal");
const Akun = require("../models/Akun");
const KodeReferensi = require("../models/KodeReferensi");

// ─────────────────────────────────────────────────────────────
// Helper: generate no transaksi untuk jurnal pencairan pinjaman.
// Dibuat dengan pola sama seperti generateNoTransaksi di
// PotonganGajiController (cek keunikan ke DB + retry), bukan versi lama
// yang hanya mengandalkan Math.random 4 digit.
// ─────────────────────────────────────────────────────────────
async function generateNoTransaksiPencairan(t) {
  const now = new Date();
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, "");
  for (let attempt = 0; attempt < 5; attempt++) {
    const random = Math.floor(Math.random() * 1000000).toString().padStart(6, "0");
    const candidate = `PNC-${ymd}-${random}`;
    const exists = await Transaksi.findOne({ where: { no_transaksi: candidate }, transaction: t });
    if (!exists) return candidate;
  }
  return `PNC-${ymd}-${Date.now()}`;
}

// ─────────────────────────────────────────────────────────────
// Mapping field POKOK pinjaman -> kode akun piutang.
// Ini adalah uang yang SUNGGUHAN dicairkan/dikeluarkan ke anggota,
// jadi lawannya adalah Kas Bank (1102).
const POKOK_MAP = [
  ["utang_brg_pokok", "1106", "Piutang Barang Pokok"],
  ["utang_uang_menengah_pokok", "1103", "Piutang Uang Menengah Pokok"],
  ["utang_uang_pendek_pokok", "1103", "Piutang Uang Pendek Pokok"],
];

// ─────────────────────────────────────────────────────────────
// Mapping field JASA/BUNGA pinjaman -> kode akun piutang jasa (1104).
//
// SEMUA field jasa dipetakan ke akun piutang yang sama (1104), sesuai
// KREDIT_MAP di PotonganGajiController. Lawannya BUKAN Kas — jasa/bunga
// adalah pendapatan koperasi yang diakui di muka (skema akrual), bukan
// uang yang dikeluarkan ke anggota. Sesuai komentar di
// PotonganGajiController.js: "jasa/bunga sudah diakui sebagai piutang
// (1104) + pendapatan (4110) SAAT PINJAMAN DICAIRKAN."
const JASA_MAP = [
  ["utang_brg_jasa", "1104", "Piutang Barang Jasa"],
  ["utang_uang_menengah_jasa", "1104", "Piutang Uang Menengah Jasa"],
  ["utang_uang_pendek_jasa", "1104", "Piutang Uang Pendek Jasa"],
];

// ─────────────────────────────────────────────────────────────
// Buat jurnal pencairan pinjaman.
//
//   Dr Piutang Pokok (per kategori)    Cr Kas Bank (1102)         = total pokok
//   Dr Piutang Jasa/Bunga (1104)       Cr Pendapatan Jasa/Bunga (4110) = total jasa
//
// Dipanggil SEKALI saat pinjaman disetujui (bukan tiap bulan — beda dengan
// buildJurnalForPotongan di PotonganGajiController yang jalan tiap cicilan).
// Kalau total pokok+jasa yang perlu diakui <= 0 (misal pinjaman hanya berisi
// simpanan tanpa komponen utang), tidak ada jurnal yang dibuat.
async function buildJurnalPencairanPinjaman(pinjaman, anggotaNama, userId, t) {
  // Hitung total per sisi & kumpulkan akun yang benar-benar dibutuhkan (field > 0)
  let totalPokok = 0;
  let totalJasa = 0;
  const neededCodes = new Map(); // kode_akun -> label

  for (const [field, kodeAkun, label] of POKOK_MAP) {
    const nilai = parseFloat(pinjaman[field]) || 0;
    if (nilai > 0) {
      totalPokok += nilai;
      if (!neededCodes.has(kodeAkun)) neededCodes.set(kodeAkun, label);
    }
  }
  for (const [field, kodeAkun, label] of JASA_MAP) {
    const nilai = parseFloat(pinjaman[field]) || 0;
    if (nilai > 0) {
      totalJasa += nilai;
      if (!neededCodes.has(kodeAkun)) neededCodes.set(kodeAkun, label);
    }
  }

  const totalKeseluruhan = totalPokok + totalJasa;
  if (totalKeseluruhan <= 0) {
    // Tidak ada komponen piutang (utang_*) pada pinjaman ini — tidak perlu
    // jurnal pencairan. (Field simpanan_* akan tetap tercatat lewat siklus
    // potongan gaji bulanan seperti biasa.)
    return null;
  }

  // ── Validasi SEMUA akun dulu sebelum membuat apa pun, biar tidak ada
  // jurnal setengah jadi kalau ada kode akun yang belum ada di master ──
  const akunKas = await Akun.findOne({ where: { kode_akun: "1102" }, transaction: t });
  if (totalPokok > 0 && !akunKas) {
    throw new Error("Akun Kas Bank (kode 1102) tidak ditemukan. Jurnal pencairan dibatalkan.");
  }

  let akunPendapatanJasa = null;
  if (totalJasa > 0) {
    akunPendapatanJasa = await Akun.findOne({ where: { kode_akun: "4110" }, transaction: t });
    if (!akunPendapatanJasa) {
      throw new Error(
        "Akun Pendapatan Jasa/Bunga (kode 4110) tidak ditemukan. Jurnal pencairan dibatalkan."
      );
    }
  }

  const akunCache = new Map();
  for (const [kodeAkun, label] of neededCodes) {
    const akun = await Akun.findOne({ where: { kode_akun: kodeAkun }, transaction: t });
    if (!akun) {
      throw new Error(
        `Akun untuk "${label}" (kode ${kodeAkun}) tidak ditemukan di master akun. Jurnal pencairan pinjaman dibatalkan, pinjaman tetap tidak disetujui.`
      );
    }
    akunCache.set(kodeAkun, akun);
  }

  let referensi = await KodeReferensi.findOne({ where: { kode: "PINJ-001" }, transaction: t });
  if (!referensi) {
    referensi = await KodeReferensi.create(
      {
        kode: "PINJ-001",
        uraian_transaksi: "Pencairan Pinjaman",
        label: "Pencairan Pinjaman",
        akun_debet: "Beragam (lihat rincian jurnal)",
        akun_kredit: "Beragam (Kas Bank / Pendapatan Jasa)",
      },
      { transaction: t }
    );
  }

  const noTransaksi = await generateNoTransaksiPencairan(t);

  const transaksi = await Transaksi.create(
    {
      no_transaksi: noTransaksi,
      kode_referensi_id: referensi.id,
      label: referensi.label,
      tanggal: new Date(),
      deskripsi: `Pencairan pinjaman ${anggotaNama} - plafon ${pinjaman.plafon}`,
      jumlah: totalKeseluruhan,
      akun_id: totalPokok > 0 ? akunKas.id : akunPendapatanJasa.id,
      akun_debet_id: null,
      akun_kredit_id: totalPokok > 0 ? akunKas.id : akunPendapatanJasa.id,
      akun: totalPokok > 0 ? akunKas.nama_akun : akunPendapatanJasa.nama_akun,
      anggota_id: pinjaman.anggota_id,
      anggota: anggotaNama,
      unit_usaha: "Simpan Pinjam",
      user_id: userId,
    },
    { transaction: t }
  );

  // Kredit Kas Bank sebesar total pokok yang benar-benar dicairkan
  if (totalPokok > 0) {
    await Jurnal.create(
      {
        transaksi_id: transaksi.id,
        tanggal: new Date(),
        akun_id: akunKas.id,
        debet: 0,
        kredit: totalPokok,
        keterangan: `Pencairan pokok pinjaman ${anggotaNama}`,
      },
      { transaction: t }
    );
  }

  // Kredit Pendapatan Jasa/Bunga sebesar total jasa (diakui di muka, akrual)
  if (totalJasa > 0) {
    await Jurnal.create(
      {
        transaksi_id: transaksi.id,
        tanggal: new Date(),
        akun_id: akunPendapatanJasa.id,
        debet: 0,
        kredit: totalJasa,
        keterangan: `Pengakuan pendapatan jasa/bunga pinjaman ${anggotaNama}`,
      },
      { transaction: t }
    );
  }

  // Debit tiap akun piutang sesuai kategori (pokok maupun jasa)
  for (const [field, kodeAkun, label] of [...POKOK_MAP, ...JASA_MAP]) {
    const nilai = parseFloat(pinjaman[field]) || 0;
    if (nilai > 0) {
      const akun = akunCache.get(kodeAkun);
      await Jurnal.create(
        {
          transaksi_id: transaksi.id,
          tanggal: new Date(),
          akun_id: akun.id,
          debet: nilai,
          kredit: 0,
          keterangan: label,
        },
        { transaction: t }
      );
    }
  }

  return transaksi;
}

class PinjamanController {
  // ─────────────────────────────────────────────────────────────
  // 1. INDEX VERIFIKASI (dengan filter status)
  // ─────────────────────────────────────────────────────────────
  async indexVerifikasi(req, res) {
    try {
      const { status } = req.query; // 'pending', 'disetujui', 'ditolak', atau 'semua'
      const where = {};
      if (status && status !== 'semua') {
        where.verifikasi_status = status;
      }

      const pinjaman = await Pinjaman.findAll({
        where,
        include: [{ model: Anggota, as: 'anggota' }],
        order: [['created_at', 'ASC']],
      });

      return res.status(200).json({
        success: true,
        data: pinjaman,
      });
    } catch (error) {
      console.error("❌ Error indexVerifikasi:", error);
      return res.status(500).json({
        success: false,
        message: "Gagal mengambil data verifikasi pinjaman",
        error: error.message,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 2. VERIFIKASI (SETUJUI / TOLAK)
  // ─────────────────────────────────────────────────────────────
  async verifikasi(req, res) {
    const { id } = req.params;
    const { metode_pembayaran, disetujui, catatan } = req.body;

    const t = await sequelize.transaction();

    try {
      const pinjaman = await Pinjaman.findByPk(id, {
        include: [{ model: Anggota, as: 'anggota' }],
        transaction: t,
      });

      if (!pinjaman) {
        await t.rollback();
        return res.status(404).json({
          success: false,
          message: "Pinjaman tidak ditemukan",
        });
      }

      if (pinjaman.verifikasi_status !== "pending") {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: "Pinjaman sudah diproses",
        });
      }

      // Update status
      pinjaman.verifikasi_status = disetujui ? "disetujui" : "ditolak";
      pinjaman.metode_pembayaran = metode_pembayaran || "cash";
      if (catatan) pinjaman.catatan_verifikasi = catatan;

      if (disetujui) {
        pinjaman.status = "aktif";
        pinjaman.sisa_angsuran = parseInt(pinjaman.jangka_waktu) || 0;
      }

      await pinjaman.save({ transaction: t });

      // ── Jika disetujui: jurnal pencairan (Dr Piutang / Cr Kas) ──
      // Ini WAJIB ada supaya piutang yang dikredit tiap bulan lewat
      // PotonganGajiController.buildJurnalForPotongan punya pasangan debit
      // di titik pencairan. Sebelumnya tidak ada jurnal sama sekali di
      // sini, sehingga laporan keuangan timpang (kredit tanpa debit).
      if (disetujui) {
        const anggotaNama = pinjaman.anggota ? pinjaman.anggota.nama : "-";
        await buildJurnalPencairanPinjaman(pinjaman, anggotaNama, req.userId, t);
      }

      // ── Jika disetujui & metode potong gaji, buat PotonganGaji ──
      if (disetujui && metode_pembayaran === "potong_gaji") {
        const now = new Date();
        const bulan = now.toLocaleString("id-ID", { month: "long" }); // hanya nama bulan, konsisten dengan entri manual
        const tahun = now.getFullYear();

        // Cek duplikat khusus entri yang berasal dari pinjaman ini,
        // jangan sampai kebentur entri manual di bulan yang sama.
        const existing = await PotonganGaji.findOne({
          where: {
            anggota_id: pinjaman.anggota_id,
            bulan,
            tahun,
            sumber: "pinjaman",
          },
          transaction: t,
        });

        if (!existing) {
          // ── FIX: total harus = jumlah field rincian, BUKAN pinjaman.plafon ──
          // Sebelumnya `total: pinjaman.plafon` menyebabkan jurnal otomatis
          // (buildJurnalForPotongan) tidak balance: debit Kas memakai total
          // ini, sedangkan kredit-kreditnya dihitung dari field rincian asli.
          const total =
            (parseFloat(pinjaman.simpanan_wajib) || 0) +
            (parseFloat(pinjaman.simpanan_sukarela) || 0) +
            (parseFloat(pinjaman.utang_brg_pokok) || 0) +
            (parseFloat(pinjaman.utang_brg_jasa) || 0) +
            (parseFloat(pinjaman.utang_uang_menengah_pokok) || 0) +
            (parseFloat(pinjaman.utang_uang_menengah_jasa) || 0) +
            (parseFloat(pinjaman.utang_uang_pendek_pokok) || 0) +
            (parseFloat(pinjaman.utang_uang_pendek_jasa) || 0) +
            (parseFloat(pinjaman.simpanan_pokok) || 0);

          await PotonganGaji.create(
            {
              anggota_id: pinjaman.anggota_id,
              // Wajib diisi: anggota bisa punya >1 pinjaman aktif sekaligus
              // (pinjaman lama yang sudah separuh lunas + pinjaman baru),
              // jadi anggota_id saja tidak cukup untuk menentukan pinjaman
              // mana yang dipotong.
              pinjaman_id: pinjaman.id,
              bulan,
              tahun,
              no_urut: 1,
              sumber: "pinjaman",
              keterangan: `Angsuran pinjaman ke-1 dari ${pinjaman.jangka_waktu} bulan`,
              plafon: pinjaman.plafon,
              jangka_waktu: `${pinjaman.jangka_waktu}x`,
              angsuran_ke: 1,
              simpanan_wajib: pinjaman.simpanan_wajib || 0,
              simpanan_sukarela: pinjaman.simpanan_sukarela || 0,
              utang_barang_pokok: pinjaman.utang_brg_pokok || 0,
              utang_barang_jasa: pinjaman.utang_brg_jasa || 0,
              utang_uang_menengah_pokok: pinjaman.utang_uang_menengah_pokok || 0,
              utang_uang_menengah_jasa: pinjaman.utang_uang_menengah_jasa || 0,
              utang_uang_pendek_pokok: pinjaman.utang_uang_pendek_pokok || 0,
              utang_uang_pendek_jasa: pinjaman.utang_uang_pendek_jasa || 0,
              simpanan_pokok: pinjaman.simpanan_pokok || 0,
              total,
              is_processed: false,
            },
            { transaction: t }
          );
        }
      }

      await t.commit();

      return res.status(200).json({
        success: true,
        message: `Pinjaman ${disetujui ? "disetujui" : "ditolak"} berhasil`,
        data: pinjaman,
      });
    } catch (error) {
      await t.rollback();
      console.error("❌ Error verifikasi:", error);
      return res.status(500).json({
        success: false,
        message: "Gagal memverifikasi pinjaman",
        error: error.message,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 4. ANGGOTA MENGAJUKAN PINJAMAN BARU
  // ─────────────────────────────────────────────────────────────
  async store(req, res) {
    try {
      const userId = req.userId;
      const user = await User.findByPk(userId, {
        include: [{ model: Anggota, as: 'anggota' }]
      });

      if (!user || !user.anggota) {
        return res.status(404).json({
          success: false,
          message: 'Anggota tidak ditemukan'
        });
      }

      const anggotaId = user.anggota.id;

      const {
        plafon,
        jangka_waktu,
        suku_bunga,
        simpanan_wajib,
        simpanan_sukarela,
        utang_brg_pokok,
        utang_brg_jasa,
        waserba,
        utang_uang_menengah_pokok,
        utang_uang_menengah_jasa,
        utang_uang_pendek_pokok,
        utang_uang_pendek_jasa,
        simpanan_pokok,
        metode_pembayaran = 'cash'
      } = req.body;

      // Validasi
      if (!plafon || !jangka_waktu) {
        return res.status(400).json({
          success: false,
          message: 'Plafon dan jangka waktu wajib diisi'
        });
      }

      if (parseFloat(plafon) <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Plafon harus lebih dari 0'
        });
      }

      const sisa_angsuran = parseInt(jangka_waktu);

      const pinjaman = await Pinjaman.create({
        anggota_id: anggotaId,
        plafon,
        jangka_waktu,
        suku_bunga: suku_bunga || 0,
        angsuran_ke: 0,
        sisa_angsuran,
        simpanan_wajib: simpanan_wajib || 0,
        simpanan_sukarela: simpanan_sukarela || 0,
        utang_brg_pokok: utang_brg_pokok || 0,
        utang_brg_jasa: utang_brg_jasa || 0,
        waserba: waserba || 0,
        utang_uang_menengah_pokok: utang_uang_menengah_pokok || 0,
        utang_uang_menengah_jasa: utang_uang_menengah_jasa || 0,
        utang_uang_pendek_pokok: utang_uang_pendek_pokok || 0,
        utang_uang_pendek_jasa: utang_uang_pendek_jasa || 0,
        simpanan_pokok: simpanan_pokok || 0,
        status: 'aktif',
        verifikasi_status: 'pending',
        status_verifikasi: 'pending',
        metode_pembayaran,
        catatan_verifikasi: null,
      });

      return res.status(201).json({
        success: true,
        message: 'Pengajuan pinjaman berhasil, menunggu verifikasi',
        data: pinjaman
      });

    } catch (error) {
      console.error('❌ Error store pinjaman:', error);
      return res.status(500).json({
        success: false,
        message: 'Gagal mengajukan pinjaman',
        error: error.message
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 5. LIHAT RIWAYAT PINJAMAN ANGGOTA
  // ─────────────────────────────────────────────────────────────
  async indexByUser(req, res) {
    try {
      const userId = req.userId;
      const user = await User.findByPk(userId, {
        include: [{ model: Anggota, as: 'anggota' }]
      });

      if (!user || !user.anggota) {
        return res.status(404).json({
          success: false,
          message: 'Anggota tidak ditemukan'
        });
      }

      const anggotaId = user.anggota.id;

      const pinjaman = await Pinjaman.findAll({
        where: { anggota_id: anggotaId },
        order: [['created_at', 'DESC']]
      });

      return res.status(200).json({
        success: true,
        data: pinjaman
      });

    } catch (error) {
      console.error('❌ Error indexByUser:', error);
      return res.status(500).json({
        success: false,
        message: 'Gagal mengambil riwayat pinjaman',
        error: error.message
      });
    }
  }
}

module.exports = new PinjamanController();