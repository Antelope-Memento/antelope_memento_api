const constant = require("../../constants/config");
const db = require("../../utilities/db");
const txn = require("../transactionStatus/controller");

const uintRegex = new RegExp(/^[0-9]+$/);
const intRegex = new RegExp(/^-?[0-9]+$/);
const nameRegex = new RegExp(/^[a-z1-5.]{1,13}$/);
const actionFilterRegex = new RegExp(/^[a-z1-5.]{1,13}:[a-z1-5.]{1,13}$/);

var controller = function() {};

// send array of traces into the HTTP response
async function sendTraces(res, traces, irreversibleBlock) {
    res.status(constant.HTTP_200_CODE);
    res.write('{\"data\":[');
    traces.forEach((item, i) => {
        if (i > 0) {
            res.write(',');
        }
        res.write('{\"pos\":' + item.pos + ',"trace":');
        res.write(item.trace);
        res.write('}');
    });

    res.write('],\"last_irreversible_block\":' + irreversibleBlock);
    res.write('}');
    res.end();
}


// prepare array of traces for graphql output
function formatHistoryData(traces, irreversibleBlock) {
    let ret = {};
    ret.data = new Array();
    traces.forEach((item) => {
        ret.data.push({pos: item.pos, trace: JSON.parse(item.trace.toString('utf8'))});
    });

    ret.last_irreversible_block = irreversibleBlock;
    return ret;
}


async function GetMaxRecvSequence(account) {
    return new Promise((resolve, reject) => {
        db.ExecuteQuery(
            'select recv_sequence_max from RECV_SEQUENCE_MAX where account_name=\'' + account + '\'',
            (data) => {
                if (data.length > 0) {
                    resolve(parseInt(data[0].recv_sequence_max));
                } else {
                    resolve(0);
                }
            });
    });
}



async function retrieveAccountHistory(args) {
    let account = args['account'];
    if ( account === undefined) {
        return Promise.reject(new Error('missing account argument'));
    }

    if (!nameRegex.test(account)) {
        return Promise.reject(new Error('invalid value in account: ' + args['account']));
    }

    let last_irreversible_block = await db.GetIrreversibleBlockNumber();

    let irrev = false;
    if (args['irreversible'] !== undefined) {
        if (args['irreversible'] == 'true' || args['irreversible'] === true) {
            irrev = true;
        }
    }

    let pos = -1 * process.env.MAX_RECORD_COUNT;

    if (args['pos'] !== undefined) {
        pos = args['pos'];
        if ( !intRegex.test(pos) ) {
            throw Error('invalid value for pos: ' + pos);
        }
        pos = parseInt(pos);
    }

    if ( pos < 0 ) {
        pos = await GetMaxRecvSequence(account) + pos;
    }

    let whereClause = 'receiver=\'' + account + '\' AND recv_sequence >= ' + pos;

    let action_filter = args['action_filter'];
    if ( action_filter !== undefined ) {
        if( !actionFilterRegex.test(action_filter) ) {
            throw Error('invalid value for action_filter: ' + action_filter);
        }

        let filter = action_filter.split(':');
        whereClause += ' AND contract=\'' + filter[0] + '\' AND action=\'' + filter[1] + '\'';
    }

    if (irrev) {
        whereClause += ' AND block_num <= ' + last_irreversible_block;
    }

    let limit = process.env.MAX_RECORD_COUNT;
    let max_count = args['max_count'];
    if ( max_count !== undefined) {
        if (!uintRegex.test(max_count)) {
            throw Error('invalid value for max_count: ' + max_count);
        }

        max_count = parseInt(max_count);
        if (limit > max_count) {
            limit = max_count;
        }
    }

    let query =
        'SELECT pos, trace FROM (SELECT DISTINCT seq, min(recv_sequence) AS pos FROM RECEIPTS ' +
        'WHERE ' + whereClause +
        ' GROUP BY seq ORDER by seq LIMIT ' + limit +
        ') as X INNER JOIN TRANSACTIONS ON X.seq = TRANSACTIONS.seq';

    return [last_irreversible_block, await db.ExecuteQueryAsync(query)];
}







// expressjs handlers

controller.get_account_history = async (req, res) => {
    let result = await retrieveAccountHistory(req.query);
    return sendTraces(res, result[1], result[0]);
}


// graphql handlers

controller.graphql_account_history = async (args) => {
    let result = await retrieveAccountHistory(args);
    return formatHistoryData(result[1], result[0]);
}


module.exports = controller;
