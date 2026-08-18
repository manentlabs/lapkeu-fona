const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Anggota = sequelize.define(
  "Anggota",
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    no_anggota: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    nama: { type: DataTypes.STRING(255), allowNull: false },
    jenis_kelamin: { type: DataTypes.ENUM("L", "P"), allowNull: false, defaultValue: "L" },
    foto: { type: DataTypes.STRING(255), allowNull: true },
    alamat: { type: DataTypes.TEXT, allowNull: true },
    desa: { type: DataTypes.STRING(255), allowNull: true },
    kecamatan: { type: DataTypes.STRING(255), allowNull: true },
    no_hp: { type: DataTypes.STRING(255), allowNull: true },
    tanggal_gabung: { type: DataTypes.DATEONLY, allowNull: false },
    tanggal_keluar: { type: DataTypes.DATEONLY, allowNull: true },
    status: { type: DataTypes.ENUM("aktif", "nonaktif"), allowNull: false, defaultValue: "aktif" },
  },
  {
    tableName: "anggota",
    timestamps: true,
    underscored: true,
  }
);

module.exports = Anggota;