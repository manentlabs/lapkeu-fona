// models/SimpananAwal.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const SimpananAwal = sequelize.define(
  "SimpananAwal",
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    anggota_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
    },
    jenis_simpanan_id: {
      type: DataTypes.INTEGER.UNSIGNED, // ← sama dengan tipe di jenis_simpanan
      allowNull: false,
    },
    tanggal: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    jumlah: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "simpanan_awal",
    timestamps: true,
    underscored: true,
    paranoid: true, // mengaktifkan soft delete (menggunakan deleted_at)
    createdAt: "created_at",
    updatedAt: "updated_at",
    deletedAt: "deleted_at",
  }
);

module.exports = SimpananAwal;