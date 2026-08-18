// models/RencanaAnggaran.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RencanaAnggaran = sequelize.define('RencanaAnggaran', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  akun_id: { type: DataTypes.INTEGER, allowNull: false },
  tahun: { type: DataTypes.INTEGER, allowNull: false },
  jumlah: { type: DataTypes.DECIMAL(15,2), allowNull: false, defaultValue: 0 },
}, {
  tableName: 'rencana_anggaran',
  timestamps: true,
  paranoid: true,
  underscored: true,   // ← add this
  indexes: [
    { unique: true, fields: ['akun_id', 'tahun'] }
  ]
});

module.exports = RencanaAnggaran;