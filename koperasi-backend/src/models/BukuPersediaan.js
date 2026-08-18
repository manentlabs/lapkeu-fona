const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BukuPersediaan = sequelize.define('BukuPersediaan', {
  id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
  nama_barang: { type: DataTypes.STRING, allowNull: false },
  kode_barang: { type: DataTypes.STRING, allowNull: false, unique: true },
  satuan: { type: DataTypes.STRING, defaultValue: 'Pcs' },
  stok_awal: { type: DataTypes.INTEGER, defaultValue: 0 },
  harga_awal: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0.00 },
  transaksi_pembelian_id: { type: DataTypes.BIGINT, allowNull: true },
  pembelian_pcs: { type: DataTypes.INTEGER, defaultValue: 0 },
  harga_pembelian: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0.00 },
  penjualan_pcs: { type: DataTypes.INTEGER, defaultValue: 0 },
  harga_penjualan: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0.00 },
  transaksi_penjualan_id: { type: DataTypes.BIGINT, allowNull: true },
  hpp_per_pcs: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0.00 },
  keuntungan: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0.00 },
  kerugian: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0.00 },
  tanggal: { type: DataTypes.DATEONLY, allowNull: true },
  periode: { type: DataTypes.STRING(20), allowNull: true },
  keterangan: { type: DataTypes.TEXT, allowNull: true },
}, 

{
  tableName: 'buku_persediaan',
  timestamps: true,
  underscored: true, 
  paranoid: true,
});

module.exports = BukuPersediaan;