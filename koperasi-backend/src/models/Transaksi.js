const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Transaksi = sequelize.define(
  "Transaksi",
  {
    id: { 
      type: DataTypes.BIGINT.UNSIGNED, 
      primaryKey: true, 
      autoIncrement: true 
    },
    no_transaksi: { 
      type: DataTypes.STRING(255), 
      allowNull: false, 
      unique: true 
    },
    kode_referensi_id: { 
      type: DataTypes.BIGINT.UNSIGNED, 
      allowNull: false 
    },
    label: { 
      type: DataTypes.STRING(255), 
      allowNull: false, 
      defaultValue: "0" 
    },
    tanggal: { 
      type: DataTypes.DATEONLY, 
      allowNull: false 
    },
    deskripsi: { 
      type: DataTypes.STRING(255), 
      allowNull: false 
    },
    jumlah: { 
      type: DataTypes.DECIMAL(15, 2), 
      allowNull: false, 
      defaultValue: 0 
    },
    akun_id: { 
      type: DataTypes.BIGINT.UNSIGNED, 
      allowNull: false 
    },
    akun_debet_id: { 
      type: DataTypes.BIGINT.UNSIGNED, 
      allowNull: true 
    },
    akun_kredit_id: { 
      type: DataTypes.BIGINT.UNSIGNED, 
      allowNull: true 
    },
    akun: { 
      type: DataTypes.STRING(255), 
      allowNull: false, 
      defaultValue: "0" 
    },
    anggota_id: { 
      type: DataTypes.BIGINT.UNSIGNED, 
      allowNull: true 
    },
    anggota: { 
      type: DataTypes.STRING(255), 
      allowNull: true 
    },
    unit_usaha: { 
      type: DataTypes.STRING(255), 
      allowNull: true 
    },
    user_id: { 
      type: DataTypes.BIGINT.UNSIGNED, 
      allowNull: false 
    },

    // ============================================================
    // 🔍 KOLOM UNTUK MENYIMPAN JENIS MASTER (SIMPANAN, TABUNGAN, DLL)
    // ============================================================
    jenis_simpanan_id: { 
      type: DataTypes.INTEGER.UNSIGNED, 
      allowNull: true,
      references: {
        model: 'jenis_simpanan',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    jenis_tabungan_id: { 
      type: DataTypes.INTEGER.UNSIGNED, 
      allowNull: true,
      references: {
        model: 'jenis_tabungan',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    jenis_piutang_id: { 
      type: DataTypes.INTEGER.UNSIGNED, 
      allowNull: true,
      references: {
        model: 'jenis_piutang',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    jenis_pendapatan_id: { 
      type: DataTypes.INTEGER.UNSIGNED, 
      allowNull: true,
      references: {
        model: 'jenis_pendapatan',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
  },
  {
    tableName: "transaksi",
    timestamps: true,
    underscored: true,
  }
);

module.exports = Transaksi;