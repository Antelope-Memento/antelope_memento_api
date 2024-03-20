const db = require('../../../utilities/db');
const {
    EVENT,
    EVENT_ERRORS,
    TRANSACTIONS_HISTORY_TYPE,
} = require('../../../constants/config');
const {
    isNumber,
    isNotEmptyArray,
    isNotEmptyArrayOfAccounts,
    isJsonString,
} = require('../../../utilities/helpers');

const MAX_WS_TRANSACTIONS_COUNT =
    process.env.MAX_WS_IRREVERSIBLE_TRANSACTIONS_COUNT ?? 1000;
const MAX_WS_EVENT_LOG_COUNT =
    process.env.MAX_REVERSIBLE_TRANSACTIONS_COUNT ?? 100;

const EMIT_INTERVAL_TIME = 2000; // Time in milliseconds to emit transactions_history event
const EVENT_LOGS_SCAN_INTERVAL_TIME = 500; // Time in milliseconds to scan the EVENT_LOG table

/**
 * The state of the transactionsHistory service
 * @type {{sockets: {string: {intervalId: number, lastTransactionBlockNum: number, transactionType: 'trace'|'fork'}}, eventLogs: Array<{}>, shouldScanEventLogs: boolean}}
 * */
const state = {
    sockets: {},
    eventLogs: [],
    shouldScanEventLogs: false,
};

setInterval(() => {
    scanEventLogs();
}, EVENT_LOGS_SCAN_INTERVAL_TIME);

// scan the event logs and save them to the state
async function scanEventLogs() {
    if (!state.shouldScanEventLogs) {
        return;
    }

    const lastIrreversibleBlock = await db.GetIrreversibleBlockNumber();
    const lastEventLog = await db.ExecuteQueryAsync(
        getLastEventLogQuery(lastIrreversibleBlock)
    );

    if (isNotEmptyArray(lastEventLog)) {
        const lastEventLogId = lastEventLog[0]['MAX(id)'];
        state.eventLogs = await db.ExecuteQueryAsync(
            getLastEventLogsQuery({
                fromId: lastEventLogId,
                toId: lastEventLogId + MAX_WS_EVENT_LOG_COUNT,
            })
        );
    }
}

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
        /**
         * Initialize the state for a specific socket connection
         * @param {string} socketId - The id of the socket connection
         * */
        initializeState: (socketId) => {
            state.sockets[socketId] = {
                intervalId: null,
                lastTransactionBlockNum: 0,
                transactionType: TRANSACTIONS_HISTORY_TYPE.TRACE,
            };
        },
        /**
         * Get the state for a specific socket connection
         * @param {string} socketId - The id of the socket connection
         * @returns {{intervalId: number, lastTransactionBlockNum: number, transactionType: 'trace'|'fork'}}
         * */
        getState: (socketId) => state.sockets[socketId],
        /**
         * Set the state for a specific socket connection
         * @param {string} socketId - The id of the socket connection
         * @param {{intervalId?: number, lastTransactionBlockNum?: number, transactionType?: 'trace'|'fork'}} newState
         * */
        setState: (socketId, newState) => {
            state.sockets[socketId] = {
                ...state.sockets[socketId],
                ...newState,
            };
        },
        /**
         * Clear the state for a specific socket connection
         * @param {string} socketId - The id of the socket connection
         * */
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
        socket.emit(EVENT.ERROR, message ?? EVENT_ERRORS.INVALID_ARGS);

        // abort the connection after 1 second if the arguments are invalid
        setTimeout(() => socket.disconnect(), 1000);
        return;
    }
    const { initializeState, setState, getState } = getSocketStateActions();

    // initialize the state for the socket connection (only once per connection)
    if (!getState(socket.id)) {
        initializeState(socket.id);
    }

    // send the transactions history to the client every EMIT_INTERVAL_TIME milliseconds
    setState(socket.id, {
        intervalId: setInterval(() => {
            emitTransactionsHistory(socket, args);
        }, EMIT_INTERVAL_TIME),
    });
}

/**
 * Emit the transactions history
 * @param {Socket} socket
 * @param {Object} args
 * @param {string[]} args.accounts
 * @param {number?} args.start_block
 * @param {boolean?} args.irreversible
 * */
async function emitTransactionsHistory(
    socket,
    { accounts, start_block, irreversible = true }
) {
    const { setState, getState } = getSocketStateActions();

    const lastIrreversibleBlock = await db.GetIrreversibleBlockNumber();
    const transactionsHistory = await db.ExecuteQueryAsync(
        getTransactionsQuery({
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

    const { lastTransactionBlockNum, transactionType } = getState(socket.id);

    if (
        !irreversible &&
        lastTransactionBlockNum === lastIrreversibleBlock &&
        transactionType !== TRANSACTIONS_HISTORY_TYPE.FORK
    ) {
        setState(socket.id, {
            transactionType: TRANSACTIONS_HISTORY_TYPE.FORK,
        });
    }

    if (
        getState(socket.id)?.transactionType === TRANSACTIONS_HISTORY_TYPE.TRACE
    ) {
        socket.emit(
            EVENT.TRANSACTIONS_HISTORY,
            formatTransactions(
                transactionsHistory,
                TRANSACTIONS_HISTORY_TYPE.TRACE
            )
        );
    } else {
        // start receiving data from EVENT_LOG table
        socket.emit(
            EVENT.TRANSACTIONS_HISTORY,
            formatTransactions(state.eventLogs, TRANSACTIONS_HISTORY_TYPE.FORK)
        );
    }
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
                message: EVENT_ERRORS.INVALID_ARGS,
            };
        case !isNotEmptyArrayOfAccounts(accounts):
            return {
                valid: false,
                message: EVENT_ERRORS.INVALID_ACCOUNTS,
            };
        case start_block && !isNumber(start_block):
            return {
                valid: false,
                message: EVENT_ERRORS.INVALID_START_BLOCK,
            };
        case irreversible && typeof irreversible !== 'boolean':
            return {
                valid: false,
                message: EVENT_ERRORS.INVALID_IRREVERSIBLE,
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
    const parsedTraces = transactions.map(({ trace, ...tx }) => ({
        ...tx,
        type,
        data: isJsonString(trace) ? JSON.parse(trace) : trace,
    }));
    return type === TRANSACTIONS_HISTORY_TYPE.FORK
        ? parsedTraces.filter((tx) =>
              tx.data.trace.action_traces.some(({ receiver }) =>
                  accounts.includes(receiver)
              )
          )
        : parsedTraces;
}

/**
 * Get the query to fetch the transactions
 * @param {Object} args
 * @param {string[]} args.accounts
 * @param {number?} args.fromBlock
 * @param {number} args.toBlock
 * @returns {String}
 */
function getTransactionsQuery({ accounts, fromBlock, toBlock }) {
    return `
        SELECT block_num, trace
        FROM (
            SELECT DISTINCT seq
            FROM RECEIPTS
            WHERE receiver IN (${accounts.map((account) => `'${account}'`).join()})
            AND block_num >= "${fromBlock}"
            AND block_num <= "${toBlock}"
            LIMIT ${MAX_WS_TRANSACTIONS_COUNT}
        ) AS R
        INNER JOIN TRANSACTIONS ON R.seq = TRANSACTIONS.seq
    `;
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
