const express = require("express");
const router = express.Router();
const PersentaseShuController = require("../controllers/PersentaseShuController");
const { verifyToken, checkRole } = require("../middlewares/AuthMiddleware");

router.use(verifyToken, checkRole("admin", "bendahara"));

router.get("/", PersentaseShuController.index);
router.get("/:id", PersentaseShuController.show);
router.post("/", PersentaseShuController.store);
router.put("/:id", PersentaseShuController.update);
router.delete("/:id", PersentaseShuController.destroy);

module.exports = router;