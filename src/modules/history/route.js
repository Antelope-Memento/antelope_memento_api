const express = require("express");
const constroller = require("./controller");

const router = express.Router();

router.get("/get_account_history", constroller.get_account_history);
router.get("/get_contract_history", constroller.get_contract_history);

module.exports = router;
