// routes/PiutangAwalRoute.js

const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const PiutangAwalController = require('../controllers/PiutangAwalController');

// GET all with pagination & filters
router.get('/', PiutangAwalController.index);

// GET detail by ID
router.get('/:id', PiutangAwalController.show);

// GET all by anggota ID (untuk modal detail anggota)
router.get('/anggota/:id', PiutangAwalController.byAnggota);

// POST create new
router.post('/', PiutangAwalController.store);

// POST import from Excel/CSV
router.post('/import', upload.single('file'), PiutangAwalController.import);

// PUT update (hanya tanggal & jumlah)
router.put('/:id', PiutangAwalController.update);

// DELETE soft delete
router.delete('/:id', PiutangAwalController.destroy);

module.exports = router;