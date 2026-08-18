const express = require("express");
const router = express.Router();
const WilayahController = require("../controllers/WilayahController");
const { verifyToken } = require("../middlewares/AuthMiddleware");

router.use(verifyToken);

router.get("/kecamatan", WilayahController.searchKecamatan);
router.get("/desa", WilayahController.searchDesa);

module.exports = router;