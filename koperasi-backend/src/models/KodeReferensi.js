const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const Akun = require("./Akun");

const KodeReferensi = sequelize.define(
  "KodeReferensi",
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    kode: { type: DataTypes.STRING(10), allowNull: false, unique: true },
    uraian_transaksi: { type: DataTypes.STRING(255), allowNull: false },
    label: { type: DataTypes.STRING(300), allowNull: false },
    akun_debet: { type: DataTypes.STRING(100), allowNull: true },
    akun_debet_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
    akun_kredit: { type: DataTypes.STRING(100), allowNull: true },
    akun_kredit_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  },
  {
    tableName: "kode_referensi",
    timestamps: true,
    underscored: true,
  }
);

module.exports = KodeReferensi;