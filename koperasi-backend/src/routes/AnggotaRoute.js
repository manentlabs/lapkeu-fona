const express = require("express");
const router = express.Router();

const AnggotaController = require("../controllers/AnggotaController");
const { verifyToken, checkRole } = require("../middlewares/AuthMiddleware");
const createUpload = require("../middlewares/UploadMiddleware");

// simpan foto anggota ke public/uploads/anggota
const upload = createUpload("anggota");

router.use(verifyToken, checkRole("admin", "bendahara", "toko"));

router.get("/summary", AnggotaController.summary);
router.get("/export/excel", AnggotaController.exportExcel);
router.get("/export/pdf", AnggotaController.exportPdf);
router.get("/autocomplete", AnggotaController.autocomplete);

router.get("/", AnggotaController.index);
router.get("/:id", AnggotaController.show);

router.post("/", upload.single("foto"), AnggotaController.store);
router.put("/:id", upload.single("foto"), AnggotaController.update);

router.delete("/:id", AnggotaController.destroy);

module.exports = router;