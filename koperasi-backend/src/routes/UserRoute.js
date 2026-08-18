const express = require("express");
const router = express.Router();
const { verifyToken, checkRole } = require("../middlewares/AuthMiddleware");
const UserController = require("../controllers/UserController");

// Semua route membutuhkan auth dan role admin
router.use(verifyToken, checkRole("admin"));

// ========== ROUTE KHUSUS (diletakkan sebelum /:id) ==========
router.get("/summary", UserController.summary);
router.get("/autocomplete", UserController.autocomplete);
router.get("/check", UserController.checkDuplicate);

// ========== CRUD ==========
router.get("/", UserController.index);
router.get("/:id", UserController.show);
router.post("/", UserController.store);
router.put("/:id", UserController.update);
router.delete("/:id", UserController.destroy);

module.exports = router;