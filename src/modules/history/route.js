const express = require('express');
const constroller = require('./controller');

const router = express.Router();

router.get('/get_account_history', constroller.get_account_history);
router.get('/get_pos', constroller.get_pos);

module.exports = router;
