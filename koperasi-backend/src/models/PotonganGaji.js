// models/PotonganGaji.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const PotonganGaji = sequelize.define(
  "PotonganGaji",
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    anggota_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      comment: "Foreign key ke tabel anggota",
    },
    bulan: {
      type: DataTypes.STRING(20),
      allowNull: false,
      comment: "Bulan permohonan (contoh: 'Agustus 2026')",
    },
    tahun: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Tahun permohonan",
    },
    no_urut: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Nomor urut potongan untuk anggota tersebut",
    },

    // ─── Sumber data & keterangan ───────────────────────────
    // Kolom ini WAJIB ada karena dipakai di semua controller
    // (PotonganGajiController.create/update, PinjamanController.verifikasi)
    // dan ditampilkan sebagai kolom "Sumber" di halaman Potongan Gaji.
    // Sebelumnya kolom ini tidak terdaftar di model, sehingga Sequelize
    // selalu men-strip field ini sebelum INSERT -> gagal karena NOT NULL
    // di database, dan error-nya tertelan try/catch di controller.
    sumber: {
      type: DataTypes.ENUM("manual", "pinjaman"),
      allowNull: false,
      defaultValue: "manual",
      comment: "Sumber data potongan: 'manual' (input bendahara) atau 'pinjaman' (otomatis saat pinjaman potong gaji disetujui)",
    },
    keterangan: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "Catatan/keterangan tambahan untuk potongan ini",
    },

    plafon: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "Jumlah pinjaman (plafon)",
    },
    jangka_waktu: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: "Jangka waktu (contoh: '10x')",
    },
    angsuran_ke: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Angsuran ke-",
    },

    // ─── Rincian potongan ────────────────────────────────────
    simpanan_wajib: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
      comment: "Potongan simpanan wajib",
    },
    simpanan_sukarela: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
      comment: "Potongan simpanan sukarela",
    },
    utang_barang_pokok: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
      comment: "Potongan utang barang (pokok)",
    },
    utang_barang_jasa: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
      comment: "Potongan utang barang (jasa)",
    },
    utang_uang_menengah_pokok: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
      comment: "Potongan utang uang menengah (pokok)",
    },
    utang_uang_menengah_jasa: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
      comment: "Potongan utang uang menengah (jasa)",
    },
    utang_uang_pendek_pokok: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
      comment: "Potongan utang uang pendek (pokok)",
    },
    utang_uang_pendek_jasa: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
      comment: "Potongan utang uang pendek (jasa)",
    },
    simpanan_pokok: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
      comment: "Potongan simpanan pokok",
    },

    total: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
      comment: "Total potongan untuk bulan ini",
    },

    is_processed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: "Sudah diproses ke jurnal?",
    },

    // ─── Timestamps ──────────────────────────────────────────
    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "potongan_gaji",
    timestamps: true,
    underscored: true,
    freezeTableName: true,
  }
);

module.exports = PotonganGaji;