const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const PengaturanWebsite = sequelize.define(
  "PengaturanWebsite",
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    nama_koperasi: { type: DataTypes.STRING(255), allowNull: false },
    nama_ketua: { type: DataTypes.STRING(255), allowNull: false },
    alamat_koperasi: { type: DataTypes.TEXT, allowNull: false },
    no_badan_hukum: { type: DataTypes.STRING(50), allowNull: false },
    tgl_badan_hukum: { type: DataTypes.DATEONLY, allowNull: true },
    tgl_awal: { type: DataTypes.DATEONLY, allowNull: true },
    nama_website: { type: DataTypes.STRING(255), allowNull: false },
    background_website: { type: DataTypes.STRING(255), allowNull: true },
    logo_website: { type: DataTypes.STRING(255), allowNull: true },
    logo_koperasi: { type: DataTypes.STRING(255), allowNull: true },
    warna_layout: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "#20c997" },
  },
  {
    tableName: "pengaturan_websites",
    timestamps: true,
    underscored: true,
  }
);

module.exports = PengaturanWebsite;