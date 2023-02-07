const express = require("express");
const constroller = require("./controller");

const router = express.Router();

router.get("/health", constroller.health);
router.get("/is_healthy", constroller.is_healthy);

module.exports = router;
