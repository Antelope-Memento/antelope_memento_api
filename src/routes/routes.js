const express = require("express");
const router = express.Router();
const healthRoute = require("../modules/health/route");
const historyRoute = require("../modules/history/route");
const transactionRoute = require("../modules/transactionStatus/route");

router.use("/", healthRoute);
router.use("/", historyRoute);
router.use("/", transactionRoute);

module.exports = router;
