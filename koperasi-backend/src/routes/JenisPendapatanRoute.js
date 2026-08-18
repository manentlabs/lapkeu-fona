// src/routes/JenisPendapatanRoute.js
const express = require("express");
const router = express.Router();
const JenisPendapatanController = require("../controllers/JenisPendapatanController");
const { verifyToken, checkRole } = require("../middlewares/AuthMiddleware");

// 🔓 Semua user yang login boleh baca (dipakai form transaksi)
router.get("/", verifyToken, JenisPendapatanController.index);

// 🔒 Hanya admin yang boleh ubah data master
router.post("/", verifyToken, checkRole("admin"), JenisPendapatanController.store);
router.put("/:id", verifyToken, checkRole("admin"), JenisPendapatanController.update);
router.delete("/:id", verifyToken, checkRole("admin"), JenisPendapatanController.destroy);

module.exports = router;