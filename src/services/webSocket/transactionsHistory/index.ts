import { Socket } from 'socket.io';
import {
    State,
    SocketId,
    TransactionType,
    Args,
    SocketState,
    EventLogEntity,
    TransactionEntity,
} from './types';

import db from '../../../utilities/db'; // @TODO: add typescript to DB configuration
import { EVENT, EVENT_ERRORS } from '../../../constants/config';
import {
    isNumber,
    isNotEmptyArray,
    isNotEmptyArrayOfAccounts,
} from '../../../utilities/helpers';

// const TRANSACTIONS_LIMIT = Number(process.env.MAX_WS_TRANSACTIONS_COUNT) ?? 100;
const EVENT_LOGS_LIMIT = Number(process.env.MAX_WS_EVENT_LOGS_COUNT) ?? 100;

const TRACE_TRANSACTIONS_LIMIT = 100;
const MAX_TRACE_TRANSACTIONS_BLOCKS_THRESHOLD = 100;

const EMIT_INTERVAL_TIME = 1000; // Time in milliseconds to emit transactions_history event
const EVENT_LOGS_SCAN_INTERVAL_TIME = 500; // Time in milliseconds to scan the EVENT_LOG table

const state: State = {
    sockets: {},
    eventLogs: { data: [], lastEventLogId: 0 },
    eventLogsIntervalId: null,
};

function manageEventLogsScanning(connectionsCount: number) {
    if (connectionsCount > 0 && !state.eventLogsIntervalId) {
        // start scanning the event logs if there are active socket connections
        state.eventLogsIntervalId = setInterval(async () => {
            try {
                await scanEventLogs();
            } catch (error) {
                console.error('error scanning event logs:', error);
            }
        }, EVENT_LOGS_SCAN_INTERVAL_TIME);
    }
    if (!connectionsCount && state.eventLogsIntervalId) {
        // stop scanning the event logs if there are no active socket connections
        clearInterval(state.eventLogsIntervalId);
        state.eventLogsIntervalId = null;
    }
}

// scan the event logs and save them to the state
async function scanEventLogs() {
    let fromId: number;

    if (!state.eventLogs.lastEventLogId) {
        const lastIrreversibleBlock = await db.GetIrreversibleBlockNumber();
        const fromEventLog = await getEventLogByBlockNum(lastIrreversibleBlock);

        fromId = fromEventLog[0][(db as any).is_mysql ? 'MAX(id)' : 'max'];
    } else {
        fromId = state.eventLogs.lastEventLogId;
    }

    const eventLogs = await getEventLogs({
        fromId,
        toId: Number(fromId) + EVENT_LOGS_LIMIT,
    });

    if (isNotEmptyArray(eventLogs)) {
        state.eventLogs = {
            data: eventLogs,
            lastEventLogId: eventLogs[0]?.id,
        };
    }
}

function getSocketStateActions(socketId: SocketId) {
    return {
        initializeSocketState: () => {
            state.sockets[socketId] = {
                intervalId: null,
                lastTransactionBlockNum: 0,
                transactionType: 'fork',
            };
        },
        getSocketState: () => state.sockets[socketId],
        setSocketState: (newState: Partial<SocketState>) => {
            state.sockets[socketId] = {
                ...state.sockets[socketId],
                ...newState,
            };
        },
        clearSocketState: () => {
            const interval = state.sockets[socketId]?.intervalId;
            if (interval) {
                clearInterval(interval);
            }

            const socketState = state.sockets[socketId];
            if (socketState) {
                delete state.sockets[socketId];
            }
        },
    };
}

async function onTransactionsHistory(socket: Socket, args: Args) {
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
        intervalId: setInterval(async () => {
            try {
                await emitTransactionsHistory(socket, args);
            } catch (error) {
                console.error('error emitting transactions history:', error);
            }
        }, EMIT_INTERVAL_TIME),
    });
}

async function emitTransactionsHistory(
    socket: Socket,
    { accounts, start_block, irreversible = false }: Args
) {
    const { setSocketState, getSocketState } = getSocketStateActions(socket.id);
    const { lastTransactionBlockNum, transactionType } = getSocketState();

    const headBlock = await db.GetLastSyncedBlockNumber();
    const lastIrreversibleBlock = await db.GetIrreversibleBlockNumber();

    const startBlock = Math.max(
        start_block ?? headBlock,
        lastTransactionBlockNum
    );

    const shouldSwitchToTrace = shouldSwitchToTraceType({
        start_block,
        startBlock,
        lastIrreversibleBlock,
        irreversible,
        transactionType,
    });

    const shouldSwitchToFork = shouldSwitchToForkType({
        lastTransactionBlockNum,
        lastIrreversibleBlock,
        start_block,
        irreversible,
        transactionType,
    });

    // If a client is too slow in consuming the stream,
    // the server should switch from head block back to scanning EVENT_LOG specifically for this client.
    // If the scanning delays behind the last irreversible block,
    // the server should switch to scanning RECEIPTS and TRANSACTIONS.
    // @TODO: Implement the logic above

    if (shouldSwitchToTrace) {
        setSocketState({
            transactionType: 'trace',
        });
        return;
    }

    if (shouldSwitchToFork) {
        setSocketState({
            transactionType: 'fork',
        });
        return;
    }

    emitTransactionsBasedOnType({
        transactionType,
        socket,
        accounts,
        startBlock,
        lastIrreversibleBlock,
        irreversible,
    });
}

function shouldSwitchToTraceType({
    start_block,
    startBlock,
    lastIrreversibleBlock,
    irreversible,
    transactionType,
}: {
    start_block?: Args['start_block'];
    startBlock: number;
    lastIrreversibleBlock: number;
    irreversible: Args['irreversible'];
    transactionType: TransactionType;
}) {
    return (
        ((start_block && startBlock < Number(lastIrreversibleBlock)) ||
            irreversible) &&
        transactionType !== 'trace'
    );
}

function shouldSwitchToForkType({
    lastTransactionBlockNum,
    lastIrreversibleBlock,
    start_block,
    irreversible,
    transactionType,
}: {
    lastTransactionBlockNum: number;
    lastIrreversibleBlock: number;
    start_block?: Args['start_block'];
    irreversible: Args['irreversible'];
    transactionType: TransactionType;
}) {
    return (
        (lastTransactionBlockNum >= lastIrreversibleBlock || !start_block) &&
        !irreversible &&
        transactionType !== 'fork'
    );
}

async function emitTransactionsBasedOnType({
    transactionType,
    socket,
    accounts,
    startBlock,
    lastIrreversibleBlock,
    irreversible,
}: {
    transactionType: TransactionType;
    socket: Socket;
    accounts: Args['accounts'];
    startBlock: number;
    lastIrreversibleBlock: number;
    irreversible: Args['irreversible'];
}) {
    switch (transactionType) {
        case 'trace': {
            const count = await getTraceTransactionsCount({
                accounts,
                fromBlock: startBlock,
                toBlock: startBlock + MAX_TRACE_TRANSACTIONS_BLOCKS_THRESHOLD,
            });

            const threshold = calculateTraceTxsBlockThreshold(
                count,
                startBlock
            );

            const toBlock = irreversible
                ? Math.min(threshold, lastIrreversibleBlock)
                : threshold;

            const shouldExecute =
                startBlock < toBlock && lastIrreversibleBlock !== startBlock;

            if (shouldExecute) {
                emitTraceTransactions(socket, {
                    accounts,
                    fromBlock: startBlock,
                    toBlock,
                });
            }
            break;
        }
        case 'fork': {
            emitForkTransactions(socket, { accounts });
            break;
        }
    }
}

async function emitTraceTransactions(
    socket: Socket,
    {
        accounts,
        fromBlock,
        toBlock,
    }: {
        accounts: Args['accounts'];
        fromBlock: number;
        toBlock: number;
    }
) {
    const { setSocketState } = getSocketStateActions(socket.id);
    // console.log('trace transactions executed with filters:', {
    //     accounts,
    //     fromBlock,
    //     toBlock,
    // });

    const transactionsHistory = await getTraceTransactions({
        accounts,
        fromBlock,
        toBlock,
    });

    if (isNotEmptyArray(transactionsHistory)) {
        const lastTransactionBlockNum = transactionsHistory[0].block_num;
        setSocketState({
            lastTransactionBlockNum: Number(lastTransactionBlockNum),
        });
    }

    socket.emit(
        EVENT.TRANSACTIONS_HISTORY,
        formatTransactions(transactionsHistory, 'trace', accounts)
    );
}

async function emitForkTransactions(
    socket: Socket,
    { accounts }: { accounts: Args['accounts'] }
) {
    // console.log('fork transactions executed with filters:', {
    //     accounts,
    // });

    socket.emit(
        EVENT.TRANSACTIONS_HISTORY,
        formatTransactions(state.eventLogs.data, 'fork', accounts)
    );
}

function validateArgs(args: Args) {
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
        case irreversible && !start_block:
            return {
                valid: false,
                message: EVENT_ERRORS.START_BLOCK_BEHIND_LAST_IRREVERSIBLE,
            };
        default:
            return {
                valid: true,
            };
    }
}

function formatTransactions(
    transactions: (EventLogEntity | TransactionEntity)[],
    type: TransactionType,
    accounts: string[]
) {
    const parsedTraces = transactions.map(({ trace, ...tx }) => ({
        ...tx,
        type,
        data: JSON.parse(trace.toString('utf8')),
    }));

    const isFork = type === 'fork';

    return isFork
        ? parsedTraces.filter((tx) =>
              (tx.data.trace.action_traces as { receiver: string }[]).some(
                  ({ receiver }) => accounts.includes(receiver)
              )
          )
        : parsedTraces;
}

async function getTraceTransactions({
    accounts,
    fromBlock,
    toBlock,
}: {
    accounts: Args['accounts'];
    fromBlock: number;
    toBlock: number;
}) {
    return db.ExecuteQueryAsync(`
        SELECT ${(db as any).is_mysql ? '' : 'R.'}block_num, trace
        FROM (
            SELECT DISTINCT seq${(db as any).is_mysql ? '' : ', block_num'}
            FROM RECEIPTS
            WHERE receiver IN (${accounts.map((account) => `'${account}'`).join()})
            AND block_num >= '${fromBlock}'
            AND block_num <= '${toBlock}'
            ORDER BY block_num DESC
        ) AS R
        INNER JOIN TRANSACTIONS ON R.seq = TRANSACTIONS.seq
    `);
}
async function getEventLogByBlockNum(blockNum: number) {
    return db.ExecuteQueryAsync(`
        SELECT MAX(id) 
        FROM EVENT_LOG 
        where block_num = '${blockNum}'
    `);
}

async function getEventLogs({
    fromId,
    toId,
}: {
    fromId: number;
    toId: number;
}) {
    return db.ExecuteQueryAsync(
        `
        SELECT id, block_num, data as trace
        FROM EVENT_LOG
        WHERE id > '${fromId}'
        AND id <= '${toId}'
        ORDER BY id DESC
    `
    );
}

async function getTraceTransactionsCount({
    accounts,
    fromBlock,
    toBlock,
}: {
    accounts: Args['accounts'];
    fromBlock: number;
    toBlock: number;
}) {
    const count = await db.ExecuteQueryAsync(
        `
        SELECT COUNT(DISTINCT seq)
        FROM RECEIPTS
        WHERE receiver IN (${accounts.map((account) => `'${account}'`).join()})
        AND block_num >= '${fromBlock}'
        AND block_num < '${toBlock}'
    `
    );
    return (db as any).is_mysql
        ? count[0]['COUNT(DISTINCT seq)']
        : count[0].count;
}

function calculateTraceTxsBlockThreshold(count: number, startBlock: number) {
    if (count > TRACE_TRANSACTIONS_LIMIT) {
        const ratio = count / MAX_TRACE_TRANSACTIONS_BLOCKS_THRESHOLD;
        return Math.floor(
            startBlock + (1 / ratio) * MAX_TRACE_TRANSACTIONS_BLOCKS_THRESHOLD
        );
    }

    return startBlock + MAX_TRACE_TRANSACTIONS_BLOCKS_THRESHOLD;
}

export {
    onTransactionsHistory,
    getSocketStateActions,
    manageEventLogsScanning,
};
