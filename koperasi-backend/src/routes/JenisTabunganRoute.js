// src/routes/JenisTabunganRoute.js
const express = require("express");
const router = express.Router();
const JenisTabunganController = require("../controllers/JenisTabunganController");
const { verifyToken, checkRole } = require("../middlewares/AuthMiddleware");

// 🔓 Semua user yang login boleh baca (dipakai form transaksi, dropdown, dll)
router.get("/", verifyToken, JenisTabunganController.index);

// 🔒 Hanya admin yang boleh ubah data master
router.post("/", verifyToken, checkRole("admin"), JenisTabunganController.store);
router.put("/:id", verifyToken, checkRole("admin"), JenisTabunganController.update);
router.delete("/:id", verifyToken, checkRole("admin"), JenisTabunganController.destroy);

module.exports = router;