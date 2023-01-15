const express     = require("express");
const constroller = require("./controller");

const router = express.Router();

router.get("/transaction", constroller.get_transaction);
router.get("/transaction_status", constroller.get_transaction_status);

module.exports = router;
