const constant = require("../../constants/config");
const db = require("../../utilities/db");

const trxidRegex = new RegExp(/[0-9a-f]{64}/);


var controller = function() {};

async function readTransaction(trx_id, skip_trace) {
    if (!trxidRegex.test(trx_id)) {
        return Promise.reject(new Error("invalid trx_id"));
    }

    let results = await Promise.all(
        [db.GetIrreversibleBlockNumber(),
            db.ExecuteQueryAsync("select block_num, block_time" +
                (skip_trace ? "" : ", trace") +
                " from TRANSACTIONS where trx_id='" + trx_id + "'")
        ]);

    if (results[1].length > 0) {
        let rec = results[1][0];
        rec.irreversible = (rec.block_num <= results[0]) ? true : false;
        rec.known = true;
        return rec;
    } else {
        return {
            known: false
        };
    }
}


// expressjs handlers
controller.get_transaction = async (req, res) => {
    readTransaction(req.query["trx_id"]).then(rec => {
        res.status(constant.HTTP_200_CODE);
        if (rec.known) {
            res.write('{\"known\": true ' +
                ', \"irreversible\": ' + rec.irreversible +
                ',\"data\":');
            res.write(rec.trace);
            res.write('}');
            res.end();
        } else {
            res.send(rec);
        }
    });
}

controller.get_transaction_status = async (req, res) => {
    readTransaction(req.query["trx_id"], true).then(rec => {
        res.status(constant.HTTP_200_CODE);
        res.send(rec);
    });
}


// graphQL handler
controller.graphql_get_transaction = async (trx_id) => {
    const rec = await readTransaction(trx_id);
    if (rec.trace != null) {
        rec.data = JSON.parse(rec.trace.toString('utf8'));
        delete rec.trace;
    }
    return rec;
}


module.exports = controller;
