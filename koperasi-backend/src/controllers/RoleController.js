const Role = require('../models/Role');

exports.index = async (req, res) => {
  try {
    const roles = await Role.findAll({
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
    });
    return res.json({ data: roles });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Gagal mengambil data role.' });
  }
};