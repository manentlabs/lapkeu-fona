const { Transaksi, sequelize } = require('../models');
const { Op } = require('sequelize');

class UnitUsahaController {
  /**
   * GET /api/bendahara/units
   * Mengembalikan daftar unit usaha distinct
   */
  async index(req, res) {
    try {
      const units = await Transaksi.findAll({
        attributes: [
          [sequelize.fn('DISTINCT', sequelize.col('unit_usaha')), 'unit_usaha']
        ],
        where: {
          unit_usaha: { [Op.ne]: null }
        },
        order: [[sequelize.literal('unit_usaha'), 'ASC']],
        raw: true,
      });

      const unitList = units.map(u => u.unit_usaha).filter(Boolean);

      res.json({
        units: unitList,
      });
    } catch (error) {
      console.error('Error mengambil unit usaha:', error);
      res.status(500).json({
        message: 'Gagal mengambil daftar unit usaha',
        error: error.message,
      });
    }
  }
}

module.exports = new UnitUsahaController();