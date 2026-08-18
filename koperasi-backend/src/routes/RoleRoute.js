const express = require('express');
const router = express.Router();
const RoleController = require('../controllers/RoleController');
const { verifyToken, checkRole } = require('../middlewares/AuthMiddleware');

// Semua route role membutuhkan autentikasi dan role admin
router.use(verifyToken, checkRole('admin'));

// GET /api/roles - daftar semua role
router.get('/', RoleController.index);

module.exports = router;