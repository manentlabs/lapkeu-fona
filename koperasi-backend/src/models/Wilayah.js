const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Wilayah = sequelize.define(
  "Wilayah",
  {
    id: { type: DataTypes.SMALLINT, primaryKey: true },
    kecamatan: { type: DataTypes.STRING(20), allowNull: false },
    desa: { type: DataTypes.STRING(20), allowNull: false },
  },
  {
    tableName: "wilayah",
    timestamps: false,
  }
);

module.exports = Wilayah;