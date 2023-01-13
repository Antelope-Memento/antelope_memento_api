const express     = require("express");
const router      = express.Router();
const healthRoute = require("../modules/health/route");

router.use("/", healthRoute);

module.exports = router;
