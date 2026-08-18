// src/models/PersentaseSHU.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PersentaseSHU = sequelize.define(
  'PersentaseSHU',
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    keterangan: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    persentase: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    },
  },
  {
    tableName: 'persentase_shu',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

module.exports = PersentaseSHU;