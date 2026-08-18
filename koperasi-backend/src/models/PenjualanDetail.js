// models/PenjualanDetail.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PenjualanDetail = sequelize.define('PenjualanDetail', {
  id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
  transaksi_id: { type: DataTypes.BIGINT, allowNull: false },
  barang_id: { type: DataTypes.BIGINT, allowNull: false },
  jumlah: { type: DataTypes.INTEGER, allowNull: false },
  harga_jual: { type: DataTypes.DECIMAL(15,2), allowNull: false },
  hpp_per_pcs: { type: DataTypes.DECIMAL(15,2), allowNull: false },
  subtotal: { type: DataTypes.VIRTUAL, get() { return this.jumlah * this.harga_jual; } },
  total_hpp: { type: DataTypes.VIRTUAL, get() { return this.jumlah * this.hpp_per_pcs; } }
}, {
  tableName: 'penjualan_detail',
  timestamps: true,
  paranoid: false,
  underscored: true
});

module.exports = PenjualanDetail;