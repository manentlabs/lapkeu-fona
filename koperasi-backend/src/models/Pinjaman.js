// models/Pinjaman.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Pinjaman = sequelize.define(
  "Pinjaman",
  {
    // ─── Primary Key ────────────────────────────────────────
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },

    // ─── Relasi ─────────────────────────────────────────────
    anggota_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      comment: "Foreign key ke tabel anggota",
    },

    // ─── Data Pinjaman ──────────────────────────────────────
    plafon: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      comment: "Jumlah pinjaman (plafon)",
    },

    jangka_waktu: {
      type: DataTypes.STRING(10),
      allowNull: false,
      comment: "Lama pinjaman dalam bulan (contoh: '12', '24')",
    },

    angsuran_ke: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Angsuran ke- (diisi saat proses angsuran)",
    },

    sisa_angsuran: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Sisa angsuran (bulan), diisi saat pinjaman disetujui",
    },

    // ─── Komponen Pinjaman (detail) ────────────────────────
    simpanan_wajib: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
      comment: "Simpanan wajib anggota",
    },
    simpanan_sukarela: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
      comment: "Simpanan sukarela anggota",
    },
    utang_brg_pokok: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
      comment: "Utang barang (pokok)",
    },
    utang_brg_jasa: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
      comment: "Utang barang (jasa)",
    },
    waserba: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
      comment: "Waserba (koperasi serba usaha)",
    },
    utang_uang_menengah_pokok: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
      comment: "Utang uang menengah (pokok)",
    },
    utang_uang_menengah_jasa: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
      comment: "Utang uang menengah (jasa)",
    },
    utang_uang_pendek_pokok: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
      comment: "Utang uang pendek (pokok)",
    },
    utang_uang_pendek_jasa: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
      comment: "Utang uang pendek (jasa)",
    },
    simpanan_pokok: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
      comment: "Simpanan pokok anggota",
    },

    // ─── Status Pinjaman ────────────────────────────────────
    status: {
      type: DataTypes.ENUM("aktif", "lunas"),
      defaultValue: "aktif",
      comment: "Status pembayaran pinjaman (aktif/lunas)",
    },

    // ─── Field Verifikasi (ditambahkan untuk fitur verifikasi) ──
    verifikasi_status: {
      type: DataTypes.ENUM("pending", "disetujui", "ditolak"),
      defaultValue: "pending",
      comment: "Status verifikasi pinjaman (pending/disetujui/ditolak)",
    },

    metode_pembayaran: {
      type: DataTypes.ENUM("cash", "potong_gaji"),
      defaultValue: "cash",
      comment: "Metode pembayaran (cash/potong gaji)",
    },

    catatan_verifikasi: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Catatan dari proses verifikasi",
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
    suku_bunga: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Suku bunga dalam persen'
    },
  },
  {
    tableName: "pinjaman",
    timestamps: true,
    underscored: true, // Snake case untuk kolom (created_at, updated_at)
    paranoid: false,   // Tidak menggunakan soft delete
    freezeTableName: true,
  }
);

module.exports = Pinjaman;