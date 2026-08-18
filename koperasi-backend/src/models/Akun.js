const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Akun = sequelize.define(
  "Akun",
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    kode_akun: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    nama_akun: { type: DataTypes.STRING(255), allowNull: false },
    tipe_akun: { type: DataTypes.ENUM("aset", "kewajiban", "modal", "pendapatan", "beban"), allowNull: false },
    parent_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
    is_active: { type: DataTypes.TINYINT, defaultValue: 1 },
    saldo_awal: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0.00 },
    pajak: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
  },
  {
    tableName: "akun",
    timestamps: true,
    underscored: true,
  }
);

module.exports = Akun;