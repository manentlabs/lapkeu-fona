const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const Role = require("./Role");
const Anggota = require("./Anggota"); // pastikan path benar

const User = sequelize.define(
  "User",
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    role_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    username: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    name: { type: DataTypes.STRING(255), allowNull: false },
    email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    password: { type: DataTypes.STRING(255), allowNull: false },
    remember_token: { type: DataTypes.STRING(100), allowNull: true },
    last_login: { type: DataTypes.DATE, allowNull: true },
    is_online: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: false },
    // 👇 tambahkan ini
    anggota_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, unique: true },
  },
  {
    tableName: "users",
    timestamps: true,
    underscored: true,
  }
);

module.exports = User;