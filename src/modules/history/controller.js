const constant = require("../../constants/config");
const db = require("../../utilities/db");
const txn = require("../transactionStatus/controller");

const integerRegex = new RegExp(/^[0-9]+$/);
const nameRegex = new RegExp(/^[a-z1-5.]{1,13}$/);
const isoTimeRegx = /^(\d{4})(?:-?W(\d+)(?:-?(\d+)D?)?|(?:-(\d+))?-(\d+))(?:[T ](\d+):(\d+)(?::(\d+)(?:\.(\d+))?)?)?(?:Z(-?\d*))?$/;

var controller = function() {};

// send array of traces into the HTTP response 
async function sendTraces(res, traces, irreversibleBlock) {
    res.status(constant.HTTP_200_CODE);
    res.write('{\"data\":[');
    traces.forEach((item, i) => {
        if (i > 0) {
            res.write(',');
        }
        res.write(item.trace);
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
        ret.data.push(JSON.parse(item.trace.toString('utf8')));
    });

    ret.last_irreversible_block = irreversibleBlock;
    return ret;
}


async function getLastIrreversibleBlock(args) {
    if (args['last_irreversible_block'] !== undefined) {
        return args['last_irreversible_block'];
    } else {
        return db.GetIrreversibleBlockNumber();
    }
}


async function whereClause(args) {
    let irrev = false;
    if (args['irreversible'] !== undefined) {
        if (args['irreversible'] == 'true' || args['irreversible'] === true) {
            irrev = true;
        }
    }

    for (const param of ['block_num_min', 'block_num_max']) {
        if (args[param] !== undefined) {
            if (!integerRegex.test(args[param])) {
                return Promise.reject(new Error('invalid value in ' + param + ': ' + args[param]));
            }
        }
    }

    for (const param of ['block_time_min', 'block_time_min']) {
        if (args[param] !== undefined) {
            if (!isoTimeRegx.test(args[param])) {
                return Promise.reject(new Error('invalid value in ' + param + ': ' + args[param]));
            }
        }
    }

    if (irrev) {
        let irrev_block = await db.GetIrreversibleBlockNumber();
        args['last_irreversible_block'] = irrev_block;
        if (args['block_num_max'] === undefined || args['block_num_max'] > irrev_block) {
            args['block_num_max'] = irrev_block;
        }
    }

    let clause = '';
    if (args['block_num_min'] !== undefined) {
        clause += ' AND block_num >= ' + args['block_num_min'];
    }

    if (args['block_num_max'] !== undefined) {
        clause += ' AND block_num <= ' + args['block_num_max'];
    }

    if (args['block_time_min'] !== undefined) {
        clause += ' AND block_time >= \'' + args['block_time_min'] + '\'';
    }

    if (args['block_time_max'] !== undefined) {
        clause += ' AND block_time >= \'' + args['block_time_max'] + '\'';
    }

    return clause;
}


function limitClause(args) {
    let limit = process.env.MAX_RECORD_COUNT;
    if (args['count'] !== undefined) {
        if (!integerRegex.test(args['count'])) {
            throw Error('invalid value for count: ' + args['count']);
        }

        let count = parseInt(args['count']);
        if (limit > count) {
            limit = count;
        }
    }
    return ' LIMIT ' + limit;
}


async function retrieveAccountHistory(args) {
    if (args['account'] === undefined) {
        return Promise.reject(new Error('missing account argument'));
    }

    if (!nameRegex.test(args['account'])) {
        return Promise.reject(new Error('invalid value in account: ' + args['account']));
    }

    let query =
        'SELECT trace FROM (SELECT DISTINCT seq FROM RECEIPTS ' +
        'WHERE account_name=\'' + args['account'] + '\'' +
        await whereClause(args) +
        ' ORDER by seq' + limitClause(args) +
        ') as X INNER JOIN TRANSACTIONS ON X.seq = TRANSACTIONS.seq';

    return db.ExecuteQueryAsync(query);
}


async function retrieveContractHistory(args) {
    if (args['contract'] === undefined) {
        return Promise.reject(new Error('missing contract argument'));
    }

    if (!nameRegex.test(args['contract'])) {
        return Promise.reject(new Error('invalid value in contract: ' + args['contract']));
    }

    let query =
        'SELECT trace FROM (SELECT DISTINCT seq FROM ACTIONS ' +
        'WHERE contract=\'' + args['contract'] + '\'' +
        await whereClause(args);

    if (args['actions'] !== undefined) {
        query += 'AND action IN (';
        let actionsList = args['actions'].split(',');
        actionsList.forEach((item, i) => {
            if (!nameRegex.test(item)) {
                return Promise.reject(new Error('invalid value in actions: ' + args['actions']));
            }

            if (i > 0) {
                query += ',';
            }

            query += '\'' + item + '\'';
        });

        query += ')';
    }

    query += ' ORDER by seq' + limitClause(args) + ') as X INNER JOIN TRANSACTIONS ON X.seq = TRANSACTIONS.seq';

    return db.ExecuteQueryAsync(query);
}





// expressjs handlers

controller.get_account_history = async (req, res) => {
    let traces = await retrieveAccountHistory(req.query);
    return sendTraces(res, traces, await getLastIrreversibleBlock(req.query));
}

controller.get_contract_history = async (req, res) => {
    let traces = await retrieveContractHistory(req.query);
    return sendTraces(res, traces, await getLastIrreversibleBlock(req.query));
}


// graphql handlers

controller.graphql_account_history = async (args) => {
    let traces = await retrieveAccountHistory(args);
    return formatHistoryData(traces, await getLastIrreversibleBlock(args));
}

controller.graphql_contract_history = async (args) => {
    let traces = await retrieveContractHistory(args);
    return formatHistoryData(traces, await getLastIrreversibleBlock(args));
}


module.exports = controller;
