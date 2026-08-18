const express = require("express");
const router = express.Router();
const AkunController = require("../controllers/AkunController");
const { verifyToken, checkRole } = require("../middlewares/AuthMiddleware");

// Semua route membutuhkan auth dan role admin atau bendahara
router.use(verifyToken, checkRole("admin", "bendahara"));

router.get("/", AkunController.index);
router.get("/list", AkunController.list); // untuk dropdown parent
router.get("/:id", AkunController.show);
router.post("/", AkunController.store);
router.put("/:id", AkunController.update);
router.delete("/:id", AkunController.destroy);

module.exports = router;