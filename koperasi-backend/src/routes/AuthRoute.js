const express = require("express");
const router = express.Router();
const AuthController = require("../controllers/AuthController");
const { verifyToken } = require("../middlewares/AuthMiddleware");

router.post("/login", AuthController.login);
router.post("/refresh", AuthController.refresh);
router.get("/me", verifyToken, AuthController.me);
router.post("/logout", verifyToken, AuthController.logout);

module.exports = router;