const express = require("express");
const router = express.Router();
const AdminDashboardController = require("../controllers/AdminDashboardController");
const { verifyToken, checkRole } = require("../middlewares/AuthMiddleware");

router.use(verifyToken, checkRole("admin"));

router.get("/", AdminDashboardController.index);

module.exports = router;