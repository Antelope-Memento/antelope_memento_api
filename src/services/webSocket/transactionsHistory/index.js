const db = require('../../../utilities/db');
const constant = require('../../../constants/config');
const {
    isNumber,
    isNotEmptyArrayOfAccounts,
} = require('../../../utilities/helpers');

const MAX_WS_IRREVERSIBLE_TRANSACTIONS_COUNT =
    process.env.MAX_WS_IRREVERSIBLE_TRANSACTIONS_COUNT ?? 1000;
const MAX_WS_REVERSIBLE_TRANSACTIONS_COUNT =
    process.env.MAX_REVERSIBLE_TRANSACTIONS_COUNT ?? 100;

/**
 * @type {Object.<string, NodeJS.Timeout>} - The interval object to store the intervals for each socket
 */
const interval = {};

const intervalTime = 500; // Time in milliseconds to emit transactions_history event

/**
 * Event handler for 'transactions_history' event.
 * @param {Socket} socket
 * @param {Object} args
 * @param {string[]} args.accounts
 * @param {number?} args.start_block
 * @param {boolean?} args.irreversible
 */
async function onTransactionsHistory(socket, args) {
    const { valid, message } = validateArgs(args);
    if (!valid) {
        socket.emit(
            constant.EVENT.ERROR,
            message ?? constant.EVENT_ERRORS.INVALID_ARGS
        );
        return;
    }

    const { accounts, start_block, irreversible } = args;

    async function emitTransactionsHistory() {
        const lastIrreversibleBlock = await db.GetIrreversibleBlockNumber();
        const transactionsHistory = await db.ExecuteQueryAsync(
            getIrreversibleTransactionsQuery({
                accounts,
                start_block,
                readUntil: lastIrreversibleBlock,
            })
        );
        socket.emit(
            constant.EVENT.TRANSACTIONS_HISTORY,
            parseTraces(transactionsHistory)
        );
    }

    interval[socket.id] = setInterval(emitTransactionsHistory, intervalTime);
}

/**
 * Check if the arguments passed to the transactions_history event are valid
 * @param {Object} args
 * @param {string[]} args.accounts
 * @param {number?} args.start_block
 * @param {boolean?} args.irreversible
 * @returns {{valid: boolean, message: string} | {valid: boolean}}
 * */
function validateArgs(args) {
    const { accounts, start_block, irreversible } = args;

    switch (true) {
        case typeof args !== 'object':
            return {
                valid: false,
                message: constant.EVENT_ERRORS.INVALID_ARGS,
            };
        case !isNotEmptyArrayOfAccounts(accounts):
            return {
                valid: false,
                message: constant.EVENT_ERRORS.INVALID_ACCOUNTS,
            };
        case start_block && !isNumber(start_block):
            return {
                valid: false,
                message: constant.EVENT_ERRORS.INVALID_START_BLOCK,
            };
        case irreversible && typeof irreversible !== 'boolean':
            return {
                valid: false,
                message: constant.EVENT_ERRORS.INVALID_IRREVERSIBLE,
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
 * @param {Object} args
 * @param {string[]} args.accounts
 * @param {number?} args.start_block
 * @param {number} args.readUntil
 * @returns {String}
 */
function getIrreversibleTransactionsQuery({
    accounts,
    start_block,
    readUntil,
}) {
    // return `
    //     SELECT trace, contract, action, receiver, block_num, block_time
    //     FROM (
    //         SELECT DISTINCT seq, contract, action, receiver
    //         FROM RECEIPTS
    //         WHERE receiver IN (${accounts.map((account) => `'${account}'`).join()})
    //         AND block_num >= "${start_block}"
    //         AND block_num <= "${readUntil}"
    //         LIMIT ${MAX_WS_IRREVERSIBLE_TRANSACTIONS_COUNT}
    //     ) AS RECEIPTS
    //     INNER JOIN TRANSACTIONS ON RECEIPTS.seq = TRANSACTIONS.seq
    // `;
    const receivers = accounts.map((account) => `'${account}'`).join();
    return `
        select block_num, trace
        from TRANSACTIONS
        join (
            select distinct seq
            from RECEIPTS
            where receiver in (${receivers})
            and block_num >= "${start_block}"
            and block_num < "${readUntil}"
        ) R
        on TRANSACTIONS.seq=R.seq
        order by TRANSACTIONS.seq
        limit ${MAX_WS_IRREVERSIBLE_TRANSACTIONS_COUNT}
    `;
}

module.exports = {
    onTransactionsHistory,
    interval,
};
