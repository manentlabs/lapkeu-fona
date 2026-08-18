const express = require("express");
const router = express.Router();
const SaldoAwalController = require("../controllers/SaldoAwalController");
const { verifyToken, checkRole } = require("../middlewares/AuthMiddleware");

router.use(verifyToken, checkRole("admin", "bendahara"));

router.get("/", SaldoAwalController.index);
router.get("/export-pdf", SaldoAwalController.exportPdf); // tambahkan
router.get("/export", SaldoAwalController.export);
router.get("/:id", SaldoAwalController.show);
router.put("/:id", SaldoAwalController.update);
router.delete("/:id", SaldoAwalController.destroy);

module.exports = router;