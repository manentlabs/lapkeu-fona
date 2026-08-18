const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Role = sequelize.define(
  "Role",
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(255), allowNull: false, unique: true }, // admin | bendahara | ketua | pengawas | anggota
  },
  {
    tableName: "roles",
    timestamps: true,
    underscored: true,
  }
);

module.exports = Role;