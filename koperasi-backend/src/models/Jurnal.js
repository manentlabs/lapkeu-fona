const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Jurnal = sequelize.define(
  "Jurnal",
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    transaksi_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    tanggal: { type: DataTypes.DATEONLY, allowNull: false },
    akun_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    debet: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    kredit: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    keterangan: { type: DataTypes.STRING(255), allowNull: true },
  },
  {
    tableName: "jurnal",
    timestamps: true,
    underscored: true,
  }
);

module.exports = Jurnal;