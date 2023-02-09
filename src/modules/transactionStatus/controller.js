const constant = require("../../constants/config");
const db = require("../../utilities/db");

const trxidRegex = new RegExp(/[0-9a-f]{64}/);


var controller = function() {};

async function readTransaction(trx_id, skip_trace) {
    return new Promise((resolve, reject) => {
        if (!trxidRegex.test(trx_id)) {
            reject("invalid trx_id");           
        }

        let query = "select block_num, block_time" + (skip_trace? "":", trace") + " from TRANSACTIONS where trx_id='" + trx_id + "'";

        db.ExecuteQuery(query, (data) => {
            if (data.status == 'error') {
                console.log(data.msg);
                reject(data.msg);
            } else {
                if (data.data.length > 0) {
                    let rec = data.data[0];
                    db.GetIrreversibleBlockNumber().then(irreversible_block => {
                        rec.irreversible = rec.block_num <= irreversible_block ? true : false;
                        rec.known = true;
                        resolve(rec);
                    });
                }
                else {
                    resolve({ known: false });
                }
            }
        });
    });
}

// expressjs handlers
controller.get_transaction = async (req, res) => {
    readTransaction(req.query["trx_id"]).then(rec => {
        res.status(constant.HTTP_200_CODE);
        if( rec.known ) {
            res.write('{\"known\": true ' +
                      ', \"irreversible\": ' + rec.irreversible +
                      ',\"data\":');
            res.write(rec.trace);
            res.write('}');
            res.end();
        } else {
            res.send( rec );
        }
    });
}

controller.get_transaction_status = async (req, res) => {
    readTransaction(req.query["trx_id"], true).then(rec => {
        res.status(constant.HTTP_200_CODE);
        res.send( rec );
    });
}


// graphQL handler
controller.graphql_get_transaction = async (trx_id) => {
    const rec = await readTransaction(trx_id);
    if( rec.trace != null ) {
        rec.data = JSON.parse(rec.trace.toString('utf8'));
        delete rec.trace;
    }
    return rec;
}


module.exports = controller;
