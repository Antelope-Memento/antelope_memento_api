const db = require('../../../utilities/db');
const constant = require('../../../constants/config');
const {
    isNumber,
    isNotEmptyArray,
    isNotEmptyArrayOfAccounts,
} = require('../../../utilities/helpers');

const MAX_WS_IRREVERSIBLE_TRANSACTIONS_COUNT =
    process.env.MAX_WS_IRREVERSIBLE_TRANSACTIONS_COUNT ?? 1000;
const MAX_WS_REVERSIBLE_TRANSACTIONS_COUNT =
    process.env.MAX_REVERSIBLE_TRANSACTIONS_COUNT ?? 100;

/**
 * @type {Object.<string, { intervalId: NodeJS.Timeout, lastTransactionBlockNum: number }>} - To store the intervals and last transactions for each socket
 */
const state = {};

const intervalTime = 5000; // Time in milliseconds to emit transactions_history event

/**
 * Event handler for 'transactions_history' event.
 * @param {Socket} socket
 * @param {Object} args
 * @param {string[]} args.accounts
 * @param {number?} args.start_block
 * @param {boolean?} args.irreversible
 */
async function onTransactionsHistory(socket, args) {
    if (!state[socket.id]) {
        state[socket.id] = {
            intervalId: null,
            lastTransactionBlockNum: 0,
        };
    }

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
        const transactionsHistory = await db.ExecuteQueryAsync(
            getIrreversibleTransactionsQuery({
                accounts,
                fromBlock: Math.max(
                    start_block ?? (await db.GetIrreversibleBlockNumber()),
                    state[socket.id].lastTransactionBlockNum
                ),
                toBlock: lastIrreversibleBlock,
            })
        );

        if (isNotEmptyArray(transactionsHistory)) {
            state[socket.id].lastTransactionBlockNum =
                transactionsHistory[transactionsHistory.length - 1].block_num;
        }

        socket.emit(
            constant.EVENT.TRANSACTIONS_HISTORY,
            parseTraces(transactionsHistory)
        );
    }

    state[socket.id].intervalId = setInterval(
        emitTransactionsHistory,
        intervalTime
    );
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
        type: 'trace',
        trace: JSON.parse(trace),
    }));
}

/**
 * Get the query to fetch the transactions
 * @param {Object} args
 * @param {string[]} args.accounts
 * @param {number?} args.fromBlock
 * @param {number} args.toBlock
 * @returns {String}
 */
function getIrreversibleTransactionsQuery({ accounts, fromBlock, toBlock }) {
    const query = `
        SELECT block_num, trace
        FROM (
            SELECT DISTINCT seq
            FROM RECEIPTS
            WHERE receiver IN (${accounts.map((account) => `'${account}'`).join()})
            AND block_num >= "${fromBlock}"
            AND block_num <= "${toBlock}"
            LIMIT ${MAX_WS_IRREVERSIBLE_TRANSACTIONS_COUNT}
        ) AS R
        INNER JOIN TRANSACTIONS ON R.seq = TRANSACTIONS.seq
    `;

    return query;
}

module.exports = {
    onTransactionsHistory,
    state,
};
