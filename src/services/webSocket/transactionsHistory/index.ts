import { Socket } from 'socket.io';
import { State, SocketId, TransactionType, Args } from './types';

import db from '../../../utilities/db'; // @TODO: add typescript to DB configuration
import { EVENT, EVENT_ERRORS } from '../../../constants/config';
import {
    isNumber,
    isNotEmptyArray,
    isNotEmptyArrayOfAccounts,
    isJsonString,
} from '../../../utilities/helpers';

const TRANSACTIONS_LIMIT = Number(process.env.MAX_WS_TRANSACTIONS_COUNT) ?? 100;
const EVENT_LOGS_LIMIT = Number(process.env.MAX_WS_EVENT_LOGS_COUNT) ?? 100;

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
        const fromEventLog = await db.ExecuteQueryAsync(
            getEventLogQuery(lastIrreversibleBlock)
        );

        fromId = fromEventLog[0][(db as any).is_mysql ? 'MAX(id)' : 'max'];
    } else {
        fromId = state.eventLogs.lastEventLogId;
    }

    const eventLogs = await db.ExecuteQueryAsync(
        getEventLogsQuery({
            fromId,
            toId: Number(fromId) + EVENT_LOGS_LIMIT,
        })
    );

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
                transactionType: null,
            };
        },
        getSocketState: () => state.sockets[socketId],
        setSocketState: (newState: {
            intervalId?: NodeJS.Timeout;
            lastTransactionBlockNum?: number;
            transactionType?: TransactionType | null;
        }) => {
            state.sockets[socketId] = {
                ...state.sockets[socketId],
                ...newState,
            };
        },
        clearSocketState: () => {
            if (state.sockets[socketId].intervalId) {
                clearInterval(
                    state.sockets[socketId].intervalId as NodeJS.Timeout
                );
            }
            if (state.sockets[socketId]) {
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
    } else if (shouldSwitchToFork) {
        setSocketState({
            transactionType: 'fork',
        });
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
    transactionType: string | null;
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
    transactionType: TransactionType | null;
}) {
    return (
        (lastTransactionBlockNum >= lastIrreversibleBlock || !start_block) &&
        !irreversible &&
        transactionType !== 'fork'
    );
}

function emitTransactionsBasedOnType({
    transactionType,
    socket,
    accounts,
    startBlock,
    lastIrreversibleBlock,
    irreversible,
}: {
    transactionType: TransactionType | null;
    socket: Socket;
    accounts: Args['accounts'];
    startBlock: number;
    lastIrreversibleBlock: number;
    irreversible: Args['irreversible'];
}) {
    if (transactionType === 'trace') {
        const shouldExecute = lastIrreversibleBlock !== startBlock;

        if (shouldExecute) {
            const toBlock = irreversible
                ? Math.min(
                      startBlock + TRANSACTIONS_LIMIT,
                      lastIrreversibleBlock
                  )
                : startBlock + TRANSACTIONS_LIMIT;
            emitTraceTransactions(socket, {
                accounts,
                fromBlock: startBlock,
                toBlock,
            });
        }
    } else if (transactionType === 'fork') {
        emitForkTransactions(socket, { accounts });
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

    const transactionsHistory = await db.ExecuteQueryAsync(
        getTransactionsQuery({
            accounts,
            fromBlock,
            toBlock,
        })
    );

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
        default:
            return {
                valid: true,
            };
    }
}

function formatTransactions(
    transactions: any[],
    type: TransactionType,
    accounts: string[]
) {
    const parsedTraces = transactions.map(({ trace, ...tx }) => ({
        ...tx,
        type,
        data: isJsonString(trace) ? JSON.parse(trace) : trace,
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

function getTransactionsQuery({
    accounts,
    fromBlock,
    toBlock,
}: {
    accounts: Args['accounts'];
    fromBlock: number;
    toBlock: number;
}) {
    return `
        SELECT ${(db as any).is_mysql ? '' : 'R.'}block_num, trace
        FROM (
            SELECT DISTINCT seq${(db as any).is_mysql ? '' : ', block_num'}
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
function getEventLogQuery(blockNum: number) {
    return `
        SELECT MAX(id) 
        FROM EVENT_LOG 
        where block_num = '${blockNum}'
    `;
}

function getEventLogsQuery({ fromId, toId }: { fromId: number; toId: number }) {
    return `
        SELECT id, block_num, data as trace
        FROM EVENT_LOG
        WHERE id > '${fromId}'
        AND id <= '${toId}'
        ORDER BY id DESC
    `;
}

export {
    onTransactionsHistory,
    getSocketStateActions,
    manageEventLogsScanning,
};
