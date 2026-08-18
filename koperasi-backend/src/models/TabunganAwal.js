// models/TabunganAwal.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const TabunganAwal = sequelize.define(
  "TabunganAwal",
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
    jenis_tabungan_id: {
      type: DataTypes.INTEGER.UNSIGNED,
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
    tableName: "tabungan_awal",
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    deletedAt: "deleted_at",
  }
);

module.exports = TabunganAwal;