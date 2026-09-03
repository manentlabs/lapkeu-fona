const express = require("express");
const router = express.Router();
const PotonganGajiController = require("../controllers/PotonganGajiController");
const { verifyToken, checkRole } = require("../middlewares/AuthMiddleware");

router.use(verifyToken, checkRole("admin", "bendahara"));

// ─── Route statis (harus sebelum route dinamis /:id) ────────
router.get("/", PotonganGajiController.index);
router.post("/", PotonganGajiController.store);
router.post("/manual", PotonganGajiController.create);
router.get("/instansi", PotonganGajiController.listInstansi);
router.get("/anggota-by-instansi", PotonganGajiController.getAnggotaByInstansi);
router.post("/batch", PotonganGajiController.batchStore);
router.post("/process-all", PotonganGajiController.processAll); // <── TAMBAHKAN INI
router.get("/export-excel", PotonganGajiController.exportExcel);
router.get("/export-pdf", PotonganGajiController.exportPdf);

// ─── Route dinamis (dengan parameter :id) ────────────────────
router.put("/:id", PotonganGajiController.update);
router.post("/:id/process", PotonganGajiController.processToJurnal);
router.delete("/:id", PotonganGajiController.destroy);

module.exports = router;