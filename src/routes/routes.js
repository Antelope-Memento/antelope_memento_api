const express = require("express");
const router = express.Router();
const healthRoute = require("../modules/health/route");
const historyRoute = require("../modules/history/route");
const transactionRoute = require("../modules/transactionStatus/route");
const graphqlRoute = require("../modules/graphql/route");

router.use("/", healthRoute);
router.use("/", historyRoute);
router.use("/", transactionRoute);
router.use("/", graphqlRoute);

module.exports = router;
