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
    // Mengaitkan baris potongan cicilan pinjaman ke Pinjaman yang spesifik.
    // WAJIB dipakai (bukan opsional) untuk sumber "pinjaman", karena satu
    // anggota bisa punya lebih dari satu pinjaman aktif sekaligus (pinjaman
    // lama yang sudah separuh lunas + pinjaman baru yang baru disetujui) --
    // anggota_id saja tidak cukup untuk menentukan pinjaman mana yang
    // sedang dilunasi oleh potongan ini.
    // Nullable karena baris "manual" (bukan dari pinjaman) tidak punya
    // pinjaman terkait sama sekali.
    pinjaman_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      comment: "Foreign key ke tabel pinjaman (hanya diisi untuk sumber = 'pinjaman')",
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

    // ─── Sumber pembayaran per-field (gaji / tukin) ─────────
    // Kolom fisik di DB. JANGAN dibaca/ditulis langsung dari controller
    // atau frontend -- pakai field virtual `metode_potongan` di bawah,
    // supaya nama yang dipakai konsisten dengan payload React
    // (PotonganGajiPage.jsx mengirim/membaca `metode_potongan`).
    sumber_field: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
      comment:
        'Peta per-field: {"simpanan_wajib":"gaji","utang_barang_pokok":"tukin", ...}. ' +
        'Field yang tidak ada di JSON dianggap default "gaji". ' +
        'Diakses dari luar model lewat field virtual `metode_potongan`.',
      get() {
        // Jaga-jaga kalau baris lama/insert manual di luar model
        // menyimpan NULL -- konsumen selalu dapat object, bukan null.
        return this.getDataValue("sumber_field") || {};
      },
    },

    // Field virtual: alias baca/tulis untuk `sumber_field`, dengan nama
    // yang sama seperti yang dipakai frontend & req.body (`metode_potongan`).
    // Tujuannya supaya controller bisa langsung pakai
    // `potongan.metode_potongan = req.body.metode_potongan` atau
    // `PotonganGaji.create({ ..., metode_potongan: req.body.metode_potongan })`
    // tanpa perlu mapping nama manual berulang di tiap endpoint, dan supaya
    // `res.json(potongan)` otomatis menyertakan `metode_potongan` di response
    // tanpa transform tambahan.
    metode_potongan: {
      type: DataTypes.VIRTUAL,
      get() {
        return this.getDataValue("sumber_field") || {};
      },
      set(value) {
        this.setDataValue("sumber_field", value && typeof value === "object" ? value : {});
      },
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