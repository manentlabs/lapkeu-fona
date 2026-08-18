const express = require("express");
const router = express.Router();
const PotonganGajiController = require("../controllers/PotonganGajiController");
const { verifyToken, checkRole } = require("../middlewares/AuthMiddleware");

router.use(verifyToken, checkRole("admin", "bendahara"));

router.get("/", PotonganGajiController.index);
router.post("/", PotonganGajiController.store);              // import excel
router.post("/manual", PotonganGajiController.create);       // tambah manual
router.put("/:id", PotonganGajiController.update);           // edit manual
router.post("/:id/process", PotonganGajiController.processToJurnal);
router.delete("/:id", PotonganGajiController.destroy);

module.exports = router;