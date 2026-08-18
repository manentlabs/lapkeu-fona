// src/routes/JenisSimpananRoute.js
const express = require("express");
const router = express.Router();
const JenisSimpananController = require("../controllers/JenisSimpananController");
const { verifyToken, checkRole } = require("../middlewares/AuthMiddleware");

// 🔓 Semua user yang login boleh baca (dipakai form transaksi)
router.get("/", verifyToken, JenisSimpananController.index);

// 🔒 Hanya admin yang boleh ubah data master
router.post("/", verifyToken, checkRole("admin"), JenisSimpananController.store);
router.put("/:id", verifyToken, checkRole("admin"), JenisSimpananController.update);
router.delete("/:id", verifyToken, checkRole("admin"), JenisSimpananController.destroy);

module.exports = router;