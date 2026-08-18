const express = require('express');
const router = express.Router();
const AnggotaController = require('../controllers/AnggotaController');
const AnggotaDashboardController = require('../controllers/AnggotaDashboardController');
const AnggotaKeuanganController = require('../controllers/AnggotaKeuanganController');
const { verifyToken, checkRole } = require('../middlewares/AuthMiddleware');

router.use(verifyToken);
router.use(checkRole('anggota'));

router.get('/dashboard', AnggotaDashboardController.index);
router.get('/simpanan', AnggotaKeuanganController.getSimpanan);
router.get('/tabungan', AnggotaKeuanganController.getTabungan);
router.get('/piutang', AnggotaKeuanganController.getPiutang);
router.get('/cetak-kartu', AnggotaController.cetakKartu);

module.exports = router;