const constant = require("../../constants/config");
const db = require("../../utilities/db");

var controller = function() {};

async function isHealthy() {
    let rows = await db.ExecuteQueryAsync('select MAX(block_time) as blktime from SYNC');

    if (rows.length == 0) {
        return Promise.reject(new Error('the SYNC table is empty'));
    }

    let block_time = new Date(rows[0].blktime);
    var now = new Date();
    var now_utc = new Date(now.getTime() + now.getTimezoneOffset() * 60000);
    let timeDiff = now_utc.getTime() - block_time.getTime();
    let status = (timeDiff <= process.env.HEALTHY_SYNC_TIME_DIFF) ? true : false;

    return {
        status: status,
        diff: timeDiff
    };
}


controller.health = async (req, res) => {
    let retVal = await isHealthy();
    res.status(retVal.status ? constant.HTTP_200_CODE : constant.HTTP_503_CODE)
    res.send(retVal);
}


controller.is_healthy = async (req, res) => {
    res.send(await isHealthy());
}

module.exports = controller;
