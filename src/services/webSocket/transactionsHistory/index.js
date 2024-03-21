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

const TRANSACTIONS_LIMIT =
    Number(process.env.MAX_WS_TRANSACTIONS_COUNT) ?? 1000;
const EVENT_LOGS_LIMIT = Number(process.env.MAX_WS_EVENT_LOGS_COUNT) ?? 100;

const EMIT_INTERVAL_TIME = 1000; // Time in milliseconds to emit transactions_history event
const EVENT_LOGS_SCAN_INTERVAL_TIME = 500; // Time in milliseconds to scan the EVENT_LOG table

/**
 * The state of the transactionsHistory service
 * @type {{sockets: {string: {intervalId: number, lastTransactionBlockNum: number, transactionType: 'trace'|'fork'}}, eventLogs: Array<{}>, eventLogsIntervalId: number,lastIrreversibleBlock: number}}
 * */
const state = {
    sockets: {},
    eventLogs: { data: [], lastEventLogId: 0 },
    eventLogsIntervalId: null,
    lastIrreversibleBlock: 0,
};

// setInterval(() => {
//     scanEventLogs();
// }, EVENT_LOGS_SCAN_INTERVAL_TIME);

/**
 * Manage the scanning of the event logs
 * @param {number} connectionsCount - The number of active socket connections
 * */
function manageEventLogsScanning(connectionsCount) {
    if (connectionsCount > 0 && !state.eventLogsIntervalId) {
        state.eventLogsIntervalId = setInterval(() => {
            scanEventLogs();
        }, EVENT_LOGS_SCAN_INTERVAL_TIME);
    }
    if (!connectionsCount) {
        clearInterval(state.eventLogsIntervalId);
        state.eventLogsIntervalId = null;
    }
}

// scan the event logs and save them to the state
async function scanEventLogs() {
    let fromId;

    if (!state.eventLogs.lastEventLogId) {
        const lastIrreversibleBlock = await db.GetIrreversibleBlockNumber();
        const fromEventLog = await db.ExecuteQueryAsync(
            getEventLogQuery(lastIrreversibleBlock)
        );

        fromId = fromEventLog[0][db.is_mysql ? 'MAX(id)' : 'max'];
    } else {
        fromId = state.eventLogs.lastEventLogId;
    }

    const eventLogs = await db.ExecuteQueryAsync(
        getEventLogsQuery({
            fromId,
            toId: Number(fromId) + Number(EVENT_LOGS_LIMIT),
        })
    );

    if (isNotEmptyArray(eventLogs)) {
        state.eventLogs = {
            data: eventLogs,
            lastEventLogId: eventLogs[0]?.id,
        };
    }
}

/**
 * Get the actions to manage the state for a specific socket connection
 * @param {string} socketId - The id of the socket connection
 * */
function getSocketStateActions(socketId) {
    return {
        /**
         * Initialize the state for a specific socket connection
         * */
        initializeSocketState: () => {
            state.sockets[socketId] = {
                intervalId: null,
                lastTransactionBlockNum: 0,
                transactionType: TRANSACTIONS_HISTORY_TYPE.TRACE,
            };
        },
        /**
         * Get the state for a specific socket connection
         * @returns {{intervalId: number, lastTransactionBlockNum: number, transactionType: 'trace'|'fork'}}
         * */
        getSocketState: () => state.sockets[socketId],
        /**
         * Set the state for a specific socket connection
         * @param {{intervalId?: number, lastTransactionBlockNum?: number, transactionType?: 'trace'|'fork'}} newState
         * */
        setSocketState: (newState) => {
            state.sockets[socketId] = {
                ...state.sockets[socketId],
                ...newState,
            };
        },
        /**
         * Clear the state for a specific socket connection
         * */
        clearSocketState: () => {
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
    const { initializeSocketState, setSocketState, getSocketState } =
        getSocketStateActions(socket.id);

    // initialize the state for the socket connection (only once per connection)
    if (!getSocketState()) {
        initializeSocketState();
    }

    // send the transactions history to the client every EMIT_INTERVAL_TIME milliseconds
    setSocketState({
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
async function emitTransactionsHistory(socket, args) {
    const { getSocketState } = getSocketStateActions(socket.id);
    const isTrace =
        getSocketState()?.transactionType === TRANSACTIONS_HISTORY_TYPE.TRACE;

    if (isTrace) {
        emitTrace(socket, args);
    } else {
        emitFork(socket, args);
    }
}

async function emitTrace(
    socket,
    { accounts, start_block, irreversible = true }
) {
    const { setSocketState, getSocketState } = getSocketStateActions(socket.id);

    const lastIrreversibleBlock = await db.GetIrreversibleBlockNumber();
    const prevLastIrreversibleBlock = state.lastIrreversibleBlock;

    const shouldSkipEmit = lastIrreversibleBlock === prevLastIrreversibleBlock;

    if (shouldSkipEmit) {
        return;
    }

    state.lastIrreversibleBlock = lastIrreversibleBlock;

    const transactionsHistory = await db.ExecuteQueryAsync(
        getTransactionsQuery({
            accounts,
            fromBlock: Math.max(
                start_block ?? lastIrreversibleBlock,
                getSocketState()?.lastTransactionBlockNum
            ),
            toBlock: lastIrreversibleBlock,
        })
    );

    if (isNotEmptyArray(transactionsHistory)) {
        const lastTransactionBlockNum = transactionsHistory[0].block_num;
        setSocketState({ lastTransactionBlockNum });
    }

    const { lastTransactionBlockNum, transactionType } = getSocketState(
        socket.id
    );

    const shouldSwitchToFork =
        !irreversible &&
        Number(lastTransactionBlockNum) === Number(lastIrreversibleBlock) &&
        transactionType !== TRANSACTIONS_HISTORY_TYPE.FORK;

    if (shouldSwitchToFork) {
        setSocketState({
            transactionType: TRANSACTIONS_HISTORY_TYPE.FORK,
        });
    }
    // if a client is too slow in consuming the stream,
    // the server should switch from head block back to scanning EVENT_LOG specifically for this client.
    // @TODO: Implement the logic above
    socket.emit(
        EVENT.TRANSACTIONS_HISTORY,
        formatTransactions(transactionsHistory, TRANSACTIONS_HISTORY_TYPE.TRACE)
    );
}

async function emitFork(socket, { accounts }) {
    // If the scanning delays behind the last irreversible block,
    // the server should switch to scanning RECEIPTS and TRANSACTIONS.
    // @TODO: Implement the logic above

    socket.emit(
        EVENT.TRANSACTIONS_HISTORY,
        formatTransactions(
            state.eventLogs.data,
            TRANSACTIONS_HISTORY_TYPE.FORK,
            accounts
        )
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
 * @param {string[]?} accounts - The accounts to filter the transactions
 * @returns {Array}
 * */
function formatTransactions(transactions, type, accounts) {
    const parsedTraces = transactions.map(({ trace, ...tx }) => ({
        ...tx,
        type,
        data: isJsonString(trace) ? JSON.parse(trace) : trace,
    }));

    const isFork = type === TRANSACTIONS_HISTORY_TYPE.FORK;

    return isFork
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
        SELECT ${db.is_mysql ? '' : 'R.'}block_num, trace
        FROM (
            SELECT DISTINCT seq${db.is_mysql ? '' : ', block_num'}
            FROM RECEIPTS
            WHERE receiver IN (${accounts.map((account) => `'${account}'`).join()})
            AND block_num >= '${fromBlock}'
            AND block_num <= '${toBlock}'
            ORDER BY block_num DESC
            LIMIT ${TRANSACTIONS_LIMIT}
        ) AS R
        INNER JOIN TRANSACTIONS ON R.seq = TRANSACTIONS.seq
    `;
}
/**
 * Get the query to fetch the event log
 * @param {number} blockNum
 * @returns {String}
 */
function getEventLogQuery(blockNum) {
    return `
        SELECT MAX(id) 
        FROM EVENT_LOG 
        where block_num = '${blockNum}'
    `;
}

/**
 * Get the query to fetch the event logs
 * @param {Object} args
 * @param {number} args.fromId
 * @param {number} args.toId
 * @returns {String}
 */
function getEventLogsQuery({ fromId, toId }) {
    return `
        SELECT id, block_num, data as trace
        FROM EVENT_LOG
        WHERE id > '${fromId}'
        AND id <= '${toId}'
        ORDER BY id DESC
    `;
}

module.exports = {
    onTransactionsHistory,
    getSocketStateActions,
    manageEventLogsScanning,
};
