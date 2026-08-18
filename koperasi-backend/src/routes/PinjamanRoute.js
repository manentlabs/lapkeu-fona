// routes/pinjaman.js
const router = require("express").Router();
const PinjamanController = require("../controllers/PinjamanController");
const { verifyToken, checkRole } = require("../middlewares/AuthMiddleware");


// ─── Middleware Global ──────────────────────────────────────
router.use((req, res, next) => {
  console.log(`🔍 [${req.method}] ${req.originalUrl} - IP: ${req.ip}`);
  next();
});

// Semua route di sini memerlukan token
router.use(verifyToken);

// ════════════════════════════════════════════════════════════
//  ROUTE UNTUK ANGGOTA (hanya anggota yang bisa akses)
// ════════════════════════════════════════════════════════════
router.post("/", checkRole("anggota", "bendahara", "admin"), PinjamanController.store);
router.get("/saya", checkRole("anggota"), PinjamanController.indexByUser);

// ════════════════════════════════════════════════════════════
//  ROUTE UNTUK BENDAHARA / ADMIN (verifikasi & export)
// ════════════════════════════════════════════════════════════
// Gunakan middleware checkRole untuk semua route di bawah ini
router.use(checkRole("bendahara", "admin"));

// ─── Endpoint Test ──────────────────────────────────────────
router.get("/test", (req, res) => {
  res.json({
    success: true,
    message: "Route pinjaman berfungsi",
    user: req.user,
  });
});

// ─── Endpoint Verifikasi ────────────────────────────────────
router.get("/verifikasi", PinjamanController.indexVerifikasi);
router.put("/verifikasi/:id", PinjamanController.verifikasi);

// ─── Error Handler ──────────────────────────────────────────
router.use((err, req, res, next) => {
  console.error("❌ Route error:", err);
  res.status(500).json({
    success: false,
    message: "Terjadi kesalahan pada route pinjaman",
    error: err.message,
  });
});

module.exports = router;