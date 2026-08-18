// controllers/PinjamanController.js
const { Pinjaman, Anggota, User, sequelize } = require("../models");
const PotonganGaji = require("../models/PotonganGaji");
const ExcelJS = require("exceljs");

console.log("📦 Controller Pinjaman dimuat");

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
      const pinjaman = await Pinjaman.findByPk(id, { transaction: t });

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
          await PotonganGaji.create(
            {
              anggota_id: pinjaman.anggota_id,
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
              total: pinjaman.plafon,
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