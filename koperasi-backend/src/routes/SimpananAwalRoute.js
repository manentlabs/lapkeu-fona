const express = require("express");
const router = express.Router();
const multer = require("multer");
const SimpananAwalController = require("../controllers/SimpananAwalController");
const { verifyToken, checkRole } = require("../middlewares/AuthMiddleware");

// ─── Setup multer (memory storage agar file tersedia di req.file.buffer) ──
const upload = multer({ storage: multer.memoryStorage() });

// ─── Semua route membutuhkan auth dan role admin/bendahara ──
router.use(verifyToken, checkRole("admin", "bendahara"));

// ─── Route utama ──────────────────────────────────────────────
router.get("/", SimpananAwalController.index);

// ─── Route khusus (harus didefinisikan SEBELUM /:id) ─────────
router.get("/anggota/:id", SimpananAwalController.byAnggota);
router.post("/import", upload.single("file"), SimpananAwalController.import);

// ─── Route CRUD ──────────────────────────────────────────────
router.post("/", SimpananAwalController.store);
router.get("/:id", SimpananAwalController.show);
router.put("/:id", SimpananAwalController.update);
router.delete("/:id", SimpananAwalController.destroy);

module.exports = router;