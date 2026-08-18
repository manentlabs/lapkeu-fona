// src/models/DanaShu.js

module.exports = (sequelize, DataTypes) => {
  const DanaShu = sequelize.define(
    "DanaShu",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },

      persentase_shu_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      tanggal: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },

      keterangan: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },

      debet: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0,
      },

      kredit: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0,
      },

      saldo: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0,
      },

      catatan: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
    },
    {
      tableName: "dana_shu",
      timestamps: true,
    }
  );

  return DanaShu;
};