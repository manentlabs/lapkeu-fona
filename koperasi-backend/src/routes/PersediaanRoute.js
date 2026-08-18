const express = require('express');
const router = express.Router();
const persediaanController = require('../controllers/PersediaanController');
const { verifyToken, checkRole } = require("../middlewares/AuthMiddleware");

// ─── Semua endpoint membutuhkan autentikasi ────────────────
router.use(verifyToken);

// ⚠️ Perhatikan: role 'bendahara' sebaiknya tidak mengakses stok,
//    tapi untuk sementara kita izinkan (controller sudah membatasi).
//    Jika ingin lebih ketat, ganti dengan:
//    router.use(checkRole('toko', 'admin'));
router.use(checkRole('toko', 'bendahara', 'admin'));

// ─── CRUD Barang ─────────────────────────────────────────────
router.get('/', persediaanController.index);
router.post('/', persediaanController.store);
router.put('/:id', persediaanController.update);
router.delete('/:id', persediaanController.destroy);

// ─── Autocomplete ────────────────────────────────────────────
router.get('/autocomplete', persediaanController.autocomplete);

// ─── Pembelian ───────────────────────────────────────────────
router.get('/pembelian', persediaanController.getPembelian);        // GET daftar
router.post('/pembelian', persediaanController.pembelian);          // POST tambah
router.put('/pembelian/:id', persediaanController.updatePembelian); // PUT edit
router.delete('/pembelian/:id', persediaanController.deletePembelian); // DELETE hapus

// ─── Penjualan ───────────────────────────────────────────────
router.get('/penjualan', persediaanController.getPenjualan);        // GET daftar
router.post('/penjualan', persediaanController.penjualan);          // POST tambah
router.put('/penjualan/:id', persediaanController.updatePenjualan); // PUT edit
router.delete('/penjualan/:id', persediaanController.deletePenjualan); // DELETE hapus

// ─── Export ──────────────────────────────────────────────────
router.get('/export-excel', persediaanController.exportExcel);
router.get('/export-pdf', persediaanController.exportPdf);

module.exports = router;