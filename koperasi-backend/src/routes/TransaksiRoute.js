const express = require("express");
const router = express.Router();
const TransaksiController = require("../controllers/TransaksiController");
const { verifyToken, checkRole } = require("../middlewares/AuthMiddleware");

// ─── ROUTE UNTUK ANGGOTA ─────────────────────────────────
// Route ini tidak memakai checkRole("admin", "bendahara")
// tapi memakai checkRole("anggota") secara eksplisit
router.get("/riwayat-anggota", verifyToken, checkRole("anggota"), TransaksiController.riwayatAnggota);

// ─── ROUTE UNTUK BENDAHARA / ADMIN ──────────────────────
// Semua route di bawah ini hanya untuk admin & bendahara
router.use(verifyToken);
router.use(checkRole("admin", "bendahara"));

router.get("/", TransaksiController.index);
router.get("/form-data", TransaksiController.formData);
router.get("/export-excel", TransaksiController.exportExcel);
router.get("/export-pdf", TransaksiController.exportPdf);
router.post("/", TransaksiController.store);

// Route dinamis di akhir
router.get("/:id", TransaksiController.show);
router.put("/:id", TransaksiController.update);
router.delete("/:id", TransaksiController.destroy);

module.exports = router;