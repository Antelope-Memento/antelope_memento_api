const db = require('../../utilities/db');
const constant = require('../../constants/config');
const {
    isName,
    isNumber,
    isDate,
    timestampToQuery,
} = require('../../utilities/helpers');

/**
 * @type {Object.<string, Object.<string, number>>} - The interval object for each socket connection
 */
const interval = {
    [constant.EVENT.TRANSACTIONS]: {},
};

const transactionsEmitInterval = 3000; // Time in milliseconds to emit transactions

/**
 * @param {Socket} socket - The socket that emitted the event
 */
function onConnection(socket) {
    socket.on(constant.EVENT.TRANSACTIONS, (args) =>
        onTransactions(socket, args)
    );
    socket.on(constant.EVENT.DISCONNECT, () => {
        clearInterval(interval[constant.EVENT.TRANSACTIONS][socket.id]);
        delete interval[constant.EVENT.TRANSACTIONS][socket.id];
    });
}

/**
 * Event handler for 'transactions' event.
 * @param {Socket} socket - The socket that emitted the event
 * @param {Object} args - The arguments object
 * @param {string} args.account - Notified account name
 * @param {string} args.contract - Notified contract name
 * @param {string} args.action - Notified action name
 * @param {string | number} args.start_from - Start reading on block or on a specific date. 0=disabled means it will read starting from HEAD block.
 */
async function onTransactions(socket, args) {
    const { valid, message } = validateArgs(args);
    if (!valid) {
        socket.emit(
            constant.EVENT.ERROR,
            message ?? constant.EVENT_ERRORS.INVALID_ARGS
        );
        return;
    }

    async function emitTransactions() {
        const lastIrreversibleBlock = await db.GetIrreversibleBlockNumber();
        const transactions = await db.ExecuteQueryAsync(
            getQuery({ ...args, readUntil: lastIrreversibleBlock })
        );

        socket.emit(constant.EVENT.TRANSACTIONS, parseTraces(transactions));
    }

    interval[constant.EVENT.TRANSACTIONS][socket.id] = setInterval(
        emitTransactions,
        transactionsEmitInterval
    );
}

/**
 * Check if the arguments passed to the transactions event are valid
 * @param {Object} args - The arguments object
 * @param {string} args.account - Notified account name
 * @param {string} args.contract - Notified contract name
 * @param {string} args.action - Notified action name
 * @param {string | number} args.start_from - Start reading on block or on a specific date. 0=disabled means it will read starting from HEAD block.
 * @returns {{valid: boolean, message?: string | undefined}}
 * */
function validateArgs(args) {
    const { account, contract, action, start_from } = args;
    switch (true) {
        case typeof args !== 'object':
            return {
                valid: false,
                message: constant.EVENT_ERRORS.INVALID_ARGS,
            };

        case !isName(account):
            return {
                valid: false,
                message: constant.EVENT_ERRORS.INVALID_ACCOUNT,
            };
        case !isName(contract):
            return {
                valid: false,
                message: constant.EVENT_ERRORS.INVALID_CONTRACT,
            };
        case !isName(action):
            return {
                valid: false,
                message: constant.EVENT_ERRORS.INVALID_ACTION,
            };
        case !isNumber(start_from) && !isDate(start_from):
            return {
                valid: false,
                message: constant.EVENT_ERRORS.INVALID_START_FROM,
            };
        default:
            return {
                valid: true,
            };
    }
}
/**
 * Format the transactions
 * @param {Array} transactions - The transactions array
 * @returns {Array}
 * */
function parseTraces(transactions) {
    return transactions.map(({ trace, ...tx }) => ({
        ...tx,
        trace: JSON.parse(trace),
    }));
}

/**
 * Get the query to fetch the transactions
 * @param {Object} args - The arguments object
 * @param {string} args.account - Notified account name
 * @param {string} args.contract - Notified contract name
 * @param {string} args.action - Notified action name
 * @param {string | number} args.start_from - Start reading on block or on a specific date. 0=disabled means it will read starting from HEAD block.
 * @param {number} args.read_until - Read until block number
 * @returns {String}
 */
function getQuery({ account, contract, action, startFrom, readUntil }) {
    return `
        SELECT trace, contract, action, receiver, block_num, block_time
        FROM (
            SELECT DISTINCT seq, contract, action, receiver
            FROM RECEIPTS
            WHERE receiver = "${account}"
            AND contract = "${contract}"
            AND action = "${action}"
            ${`AND ${isDate(startFrom) ? `block_time >= ${timestampToQuery(startFrom, db.is_mysql)}` : `block_num >= "${startFrom}"`}`}
            AND block_num <= "${readUntil}"
            GROUP BY seq
            ORDER BY seq DESC
            LIMIT ${process.env.MAX_RECORD_COUNT ?? 1000}
        ) AS RECEIPTS
        INNER JOIN TRANSACTIONS ON RECEIPTS.seq = TRANSACTIONS.seq
    `;
}

module.exports = { onConnection };
