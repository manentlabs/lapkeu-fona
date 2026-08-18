// routes/TabunganAwalRoute.js

const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const TabunganAwalController = require('../controllers/TabunganAwalController');

// GET all with pagination & filters
router.get('/', TabunganAwalController.index);

// GET detail by ID
router.get('/:id', TabunganAwalController.show);

// GET all by anggota ID (untuk modal detail anggota)
router.get('/anggota/:id', TabunganAwalController.byAnggota);

// POST create new
router.post('/', TabunganAwalController.store);

// POST import from Excel/CSV
router.post('/import', upload.single('file'), TabunganAwalController.import);

// PUT update (hanya tanggal & jumlah)
router.put('/:id', TabunganAwalController.update);

// DELETE soft delete
router.delete('/:id', TabunganAwalController.destroy);

module.exports = router;