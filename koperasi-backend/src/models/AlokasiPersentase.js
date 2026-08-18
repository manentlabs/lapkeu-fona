// src/models/AlokasiPersentase.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AlokasiPersentase = sequelize.define(
  'AlokasiPersentase',
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    keterangan: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    persentase: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
    },
  },
  {
    tableName: 'alokasi_persentase',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

module.exports = AlokasiPersentase;