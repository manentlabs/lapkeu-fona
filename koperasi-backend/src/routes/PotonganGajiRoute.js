const express = require("express");
const router = express.Router();
const PotonganGajiController = require("../controllers/PotonganGajiController");
const { verifyToken, checkRole } = require("../middlewares/AuthMiddleware");

router.use(verifyToken, checkRole("admin", "bendahara"));

router.get("/", PotonganGajiController.index);
router.post("/", PotonganGajiController.store);          
router.post("/manual", PotonganGajiController.create);   
router.get("/potongan-gaji/instansi", PotonganGajiController.listInstansi);
router.get("/potongan-gaji/anggota-by-instansi", PotonganGajiController.getAnggotaByInstansi);
router.post("/potongan-gaji/batch", PotonganGajiController.batchStore);
router.put("/:id", PotonganGajiController.update);
router.post("/:id/process", PotonganGajiController.processToJurnal);
router.delete("/:id", PotonganGajiController.destroy);

module.exports = router;