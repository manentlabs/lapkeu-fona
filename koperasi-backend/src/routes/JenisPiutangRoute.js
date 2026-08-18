// src/routes/JenisPiutangRoute.js
const express = require("express");
const router = express.Router();
const JenisPiutangController = require("../controllers/JenisPiutangController");
const { verifyToken, checkRole } = require("../middlewares/AuthMiddleware");

// 🔓 Semua user yang login boleh baca (dipakai form transaksi)
router.get("/", verifyToken, JenisPiutangController.index);

// 🔒 Hanya admin yang boleh ubah data master
router.post("/", verifyToken, checkRole("admin"), JenisPiutangController.store);
router.put("/:id", verifyToken, checkRole("admin"), JenisPiutangController.update);
router.delete("/:id", verifyToken, checkRole("admin"), JenisPiutangController.destroy);

module.exports = router;