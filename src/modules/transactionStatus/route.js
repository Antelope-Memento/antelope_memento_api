const express = require("express");
const constroller = require("./controller");

const router = express.Router();

router.get("/get_transaction", constroller.get_transaction);
router.get("/get_transaction_status", constroller.get_transaction_status);

module.exports = router;
