const db = require('../../../utilities/db');
const constant = require('../../../constants/config');
const {
    isNumber,
    isNotEmptyArray,
    isNotEmptyArrayOfAccounts,
    isJsonString,
} = require('../../../utilities/helpers');

const MAX_WS_IRREVERSIBLE_TRANSACTIONS_COUNT =
    process.env.MAX_WS_IRREVERSIBLE_TRANSACTIONS_COUNT ?? 1000; // for TRANSACTIONS & RECEIPTS
const MAX_WS_REVERSIBLE_TRANSACTIONS_COUNT =
    process.env.MAX_REVERSIBLE_TRANSACTIONS_COUNT ?? 100; // for EVENT_LOG

const EMIT_INTERVAL_TIME = 5000; // Time in milliseconds to emit transactions_history event
const EVENT_LOGS_SCAN_INTERVAL_TIME = 500; // Time in milliseconds to scan the EVENT_LOG

/**
 * The state of the transactionsHistory service
 * @type {{sockets: {string: {intervalId: number, lastTransactionBlockNum: number}}, eventLogs: Array<{}>, shouldScanEventLogs: boolean}}
 * */
const state = {
    sockets: {},
    eventLogs: [],
    shouldScanEventLogs: false,
};

setInterval(async () => {
    if (!state.shouldScanEventLogs) {
        return;
    }

    const lastIrreversibleBlock = await db.GetIrreversibleBlockNumber();
    const lastEventLog = await db.ExecuteQueryAsync(
        getLastEventLogQuery(lastIrreversibleBlock)
    );

    if (isNotEmptyArray(lastEventLog)) {
        const lastEventLogId = lastEventLog[0]['MAX(id)'];
        const lastEventLogs = await db.ExecuteQueryAsync(
            getLastEventLogsQuery({
                fromId: lastEventLogId,
                toId: lastEventLogId + MAX_WS_REVERSIBLE_TRANSACTIONS_COUNT,
            })
        );

        if (isNotEmptyArray(lastEventLogs)) {
            state.eventLogs = formatTransactions(
                lastEventLogs,
                constant.TRANSACTIONS_HISTORY_TYPES.FORK
            );
            // console.log('state.eventLogs =>', state.eventLogs);
        }
    }
}, EVENT_LOGS_SCAN_INTERVAL_TIME);

/**
 * Manage the scanning of the event logs
 * @param {number} connectionsCount - The number of active socket connections
 * */
function manageEventLogsScanning(connectionsCount) {
    state.shouldScanEventLogs = connectionsCount > 0;
}

// get functions to manage the state for a specific socket connection
function getSocketStateActions() {
    return {
        initializeState: (socketId) => {
            state.sockets[socketId] = {
                intervalId: null,
                lastTransactionBlockNum: 0,
            };
        },
        getState: (socketId) => state.sockets[socketId],
        setState: (socketId, newState) => {
            state.sockets[socketId] = {
                ...state.sockets[socketId],
                ...newState,
            };
        },
        clearState: (socketId) => {
            if (state.sockets[socketId]) {
                clearInterval(state.sockets[socketId].intervalId);
                delete state.sockets[socketId];
            }
        },
    };
}

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
        setTimeout(() => socket.disconnect(), 1000);
        return;
    }
    const { initializeState, setState, getState } = getSocketStateActions();

    if (!getState(socket.id)) {
        initializeState(socket.id);
    }

    const { accounts, start_block, irreversible = true } = args;

    async function emitTransactionsHistory() {
        const lastIrreversibleBlock = await db.GetIrreversibleBlockNumber();
        const transactionsHistory = await db.ExecuteQueryAsync(
            getIrreversibleTransactionsQuery({
                accounts,
                fromBlock: Math.max(
                    start_block ?? lastIrreversibleBlock,
                    getState(socket.id)?.lastTransactionBlockNum
                ),
                toBlock: lastIrreversibleBlock,
            })
        );

        if (isNotEmptyArray(transactionsHistory)) {
            const lastTransactionBlockNum =
                transactionsHistory[transactionsHistory.length - 1].block_num;
            setState(socket.id, { lastTransactionBlockNum });
        }

        socket.emit(
            constant.EVENT.TRANSACTIONS_HISTORY,
            formatTransactions(
                transactionsHistory,
                constant.TRANSACTIONS_HISTORY_TYPES.TRACE
            )
        );
        // console.log(
        //     `state for socket ${socket.id} =>`,
        //     state.sockets[socket.id]
        // );
    }

    setState(socket.id, {
        intervalId: setInterval(emitTransactionsHistory, EMIT_INTERVAL_TIME),
    });
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
 * @param {string} type - The type of the transactions ('trace' or 'fork')
 * @returns {Array}
 * */
function formatTransactions(transactions, type) {
    return transactions.map(({ trace, ...tx }) => ({
        ...tx,
        type,
        data: isJsonString(trace) ? JSON.parse(trace) : trace,
    }));
}

/**
 * Get the query to fetch the irreversible transactions
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
/**
 * Get the query to fetch the last event log
 * @param {number} blockNum
 * @returns {String}
 */
function getLastEventLogQuery(blockNum) {
    return `
        SELECT MAX(id) 
        FROM EVENT_LOG 
        where block_num = "${blockNum}"
    `;
}

/**
 * Get the query to fetch the last event logs
 * @param {Object} args
 * @param {number} args.fromId
 * @param {number} args.toId
 * @returns {String}
 */
function getLastEventLogsQuery({ fromId, toId }) {
    return `
        SELECT id, block_num, data as trace
        FROM EVENT_LOG
        WHERE id > "${fromId}"
        AND id <= "${toId}"
        ORDER BY id DESC
    `;
}

module.exports = {
    onTransactionsHistory,
    clearSocketState: getSocketStateActions().clearState,
    manageEventLogsScanning,
};
