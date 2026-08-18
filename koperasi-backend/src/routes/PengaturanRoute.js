// src/routes/PengaturanRoute.js
const express = require("express");
const router = express.Router();
const PengaturanController = require("../controllers/PengaturanController");
const { verifyToken, checkRole } = require("../middlewares/AuthMiddleware");
const createUpload = require("../middlewares/UploadMiddleware");

const upload = createUpload("pengaturan");
const uploadFields = upload.fields([
  { name: "logo_website", maxCount: 1 },
  { name: "logo_koperasi", maxCount: 1 },
  { name: "background_website", maxCount: 1 },
]);

// 🔓 PUBLIC - tanpa auth (untuk halaman login, dashboard, dan tampilan publik)
router.get("/", PengaturanController.index);

// 🔒 PROTECTED - hanya admin yang bisa create/update
router.post("/", verifyToken, checkRole("admin"), uploadFields, PengaturanController.store);
router.put("/", verifyToken, checkRole("admin"), uploadFields, PengaturanController.update);

module.exports = router;