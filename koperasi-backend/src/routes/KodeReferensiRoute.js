const express = require("express");
const router = express.Router();
const KodeReferensiController = require("../controllers/KodeReferensiController");
const { verifyToken, checkRole } = require("../middlewares/AuthMiddleware");

router.use(verifyToken, checkRole("admin", "bendahara"));

router.get("/", KodeReferensiController.index);
router.get("/akun-list", KodeReferensiController.listAkun);
router.get("/:id", KodeReferensiController.show);
router.post("/", KodeReferensiController.store);
router.put("/:id", KodeReferensiController.update);
router.delete("/:id", KodeReferensiController.destroy);

module.exports = router;