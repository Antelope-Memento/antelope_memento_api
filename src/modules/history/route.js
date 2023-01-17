const express     = require("express");
const constroller = require("./controller");

const router = express.Router();

router.get("/account_history", constroller.get_account_history);
router.get("/contract_history", constroller.get_contract_history);

module.exports = router;
