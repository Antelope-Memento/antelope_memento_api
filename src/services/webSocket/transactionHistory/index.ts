import { Socket } from 'socket.io';
import { State, SocketId, Args, SocketState, TableType } from './types';

import constants from '../../../constants/config';
import { isNonEmptyArray } from '../../../utilities/helpers';

import { assert } from 'ts-essentials';

import * as syncService from '../../sync';
import * as receiptsService from '../../receipts';
import * as eventLogService from '../../eventLog';
import * as transactionService from '../../transactions';
import {
    calculateTraceTxsBlockThreshold,
    switchEventLogTable,
    switchToTransactionTable,
    validateArgs,
} from './utils';
import { io } from '../../../server';

const { EVENT, EVENT_ERRORS } = constants;

export const TRACE_BLOCKS_THRESHOLD =
    Number(process.env.WS_TRACE_TRANSACTIONS_BLOCKS_THRESHOLD) ?? 100;
export const TRACE_BLOCKS_LIMIT =
    Number(process.env.WS_TRACE_TRANSACTIONS_LIMIT) ?? 100;
export const EVENTLOG_BLOCKS_LIMIT =
    Number(process.env.WS_EVENTLOG_TRANSACTIONS_LIMIT) ?? 100;

export const EMIT_TIMEOUT_TIME = 500; // Time in milliseconds to wait before emitting the next event
export const EVENTLOG_WRITING_INTERVAL_TIME = 500; // Time in milliseconds to write the EventLog event
export const ACKNOWLEDGE_TIME = 5000;

const state: State = {
    connectedSockets: {},
    eventLog: { data: [], lastEventId: null, timeoutId: null }, // EventLog.data represents the EventLog event, which this service will write and emit to the clients when requested
};

export function scheduleNextEmit(socket: Socket) {
    setTimeout(() => {
        emitTransactionHistory(socket);
    }, EMIT_TIMEOUT_TIME);
}

function manageEventLogSaveAndEmit(connectionsCount: number) {
    const shouldWrite = connectionsCount > 0 && !state.eventLog.timeoutId;

    // start writing the EventLog event if there are active socket connections
    if (shouldWrite) {
        console.log(
            `Starting to write EventLog event, active connections: ${connectionsCount}`
        );
        state.eventLog.timeoutId = setTimeout(
            saveAndEmitEventLog,
            EVENTLOG_WRITING_INTERVAL_TIME
        );
    }
    if (!connectionsCount && state.eventLog.timeoutId) {
        // stop writing the EventLog event and clear the EventLog state
        // if there are no active socket connections
        clearTimeout(state.eventLog.timeoutId);
        state.eventLog = { data: [], lastEventId: null, timeoutId: null };
        console.log('No connections found. Stop writing EventLog event.');
    }
}

async function saveAndEmitEventLog() {
    if (
        // check for any active socket connections with 'EventLog' transaction type
        !Object.values(state.connectedSockets).find(
            ({ tableType }) => tableType === TableType.eventLog
        )
    ) {
        state.eventLog.timeoutId = setTimeout(
            saveAndEmitEventLog,
            EVENTLOG_WRITING_INTERVAL_TIME
        );
        return;
    }

    try {
        await saveEventLogInState();
        emitEventLogsToClients();
    } catch (error) {
        console.error('error writing EventLog event:', error);
    } finally {
        state.eventLog.timeoutId = setTimeout(
            saveAndEmitEventLog,
            EVENTLOG_WRITING_INTERVAL_TIME
        );
    }
}

// write the EventLog event and save them to the state
async function saveEventLogInState() {
    try {
        const lastIrreversibleBlock =
            await syncService.getIrreversibleBlockNumber();

        const fromIdDB = await eventLogService.getMaxEventLog(
            lastIrreversibleBlock
        );

        const fromId = state.eventLog.lastEventId ?? fromIdDB;

        const EventLogTransactions = await eventLogService.getAll({
            fromId,
            toId: Number(fromId) + EVENTLOG_BLOCKS_LIMIT,
        });

        if (isNonEmptyArray(EventLogTransactions)) {
            console.log(
                `${EventLogTransactions.length} new Event Log events. Writing to state.`
            );
            state.eventLog = {
                ...state.eventLog,
                data: EventLogTransactions,
                lastEventId: EventLogTransactions[0].id,
            };
        }
    } catch (error) {
        console.error('error saving EventLog in state:', error);
    }
}

function getSocketStateActions(socketId: SocketId) {
    return {
        initializeSocketState: (args: Args): void => {
            state.connectedSockets[socketId] = {
                args,
                lastEventLogId: 0,
                lastTransactionBlockNum: 0,
                lastCheckedBlock: 0,
                tableType: args.irreversible
                    ? TableType.transaction
                    : TableType.eventLog,
            };
            console.log('Socket state initialized for socket:', socketId);
        },
        getSocketState: () => state.connectedSockets[socketId],
        setSocketState: (updatedState: Partial<SocketState>): void => {
            const prevState = state.connectedSockets[socketId];
            assert(
                prevState,
                `setSocketState: socket state not found for socket ${socketId}`
            );
            state.connectedSockets[socketId] = {
                ...prevState,
                ...updatedState,
            };
        },
        clearSocketState: (): void => {
            if (state.connectedSockets[socketId]) {
                delete state.connectedSockets[socketId];
            }
            console.log('Cleared socket state for socket:', socketId);
        },
    };
}

function onTransactionHistory(socket: Socket, args: Args) {
    const { valid, message } = validateArgs(args);

    if (!valid) {
        const errorMessage = message ?? EVENT_ERRORS.INVALID_ARGS;
        socket.emit(EVENT.ERROR, errorMessage);

        // abort the connection after 1 second if the arguments are invalid
        setTimeout(() => socket.disconnect(), 1000);
        console.error(
            `Disconnecting the socket ${socket.id} due to invalid arguments: ${errorMessage}`
        );
        return;
    }
    const { initializeSocketState, getSocketState } = getSocketStateActions(
        socket.id
    );

    // initialize the state for the socket connection (only once per connection)
    if (!getSocketState()) {
        initializeSocketState(args);
    }

    emitTransactionHistory(socket);
}

async function emitTransactionHistory(socket: Socket) {
    const { setSocketState, getSocketState } = getSocketStateActions(socket.id);

    const headBlock = await syncService.getHeadBlockNumber();

    const lastIrreversibleBlock =
        await syncService.getIrreversibleBlockNumber();

    const state = getSocketState();

    if (!state) {
        return; // do the silent return here because the socket may have been disconnected
    }

    const {
        lastCheckedBlock,
        tableType,
        args: { accounts, start_block, irreversible },
    } = state;

    const startBlock = Math.max(start_block ?? headBlock, lastCheckedBlock);

    const shouldUseTransactionTable = switchToTransactionTable({
        start_block,
        startBlock,
        lastIrreversibleBlock,
        irreversible,
        tableType,
    });

    // if table type is event log and it shouldn't be changed to transaction table, then
    // return, since event logs are emitted in manageEventLogSaveAndEmit
    if (tableType === TableType.eventLog && !shouldUseTransactionTable) return;

    const shouldUseEventLogTable = switchEventLogTable({
        lastCheckedBlock,
        lastIrreversibleBlock,
        start_block,
        irreversible,
        tableType,
    });

    if (shouldUseTransactionTable) {
        console.log(
            `Switched to Transaction Table for socket: ${socket.id} by accounts:(${accounts}).`
        );
        setSocketState({
            tableType: TableType.transaction,
        });
    }

    if (shouldUseEventLogTable) {
        console.log(
            `Switched to EventLog Table for socket: ${socket.id} by accounts:(${accounts}).`
        );
        setSocketState({
            tableType: TableType.eventLog,
        });
        return;
    }

    handleTransactionEventEmit({
        socket,
        accounts,
        startBlock,
        lastIrreversibleBlock,
        irreversible,
        headBlock,
    });
}

async function handleTransactionEventEmit({
    socket,
    accounts,
    startBlock,
    lastIrreversibleBlock,
    irreversible,
    headBlock,
}: {
    socket: Socket;
    accounts: Args['accounts'];
    startBlock: number;
    lastIrreversibleBlock: number;
    irreversible: Args['irreversible'];
    headBlock: number;
}) {
    const { getSocketState, setSocketState } = getSocketStateActions(socket.id);

    const state = getSocketState();
    assert(
        state,
        `emitTransactionBasedOnType: socket state not found for socket: ${socket.id}`
    );

    let shouldExecute = true;

    while (shouldExecute) {
        const count = await receiptsService.getCount({
            accounts,
            fromBlock: startBlock,
            toBlock: startBlock + TRACE_BLOCKS_THRESHOLD,
        });

        const threshold = calculateTraceTxsBlockThreshold(count, startBlock);

        let toBlock = irreversible
            ? Math.min(threshold, lastIrreversibleBlock)
            : threshold;

        shouldExecute =
            startBlock <= toBlock &&
            lastIrreversibleBlock !== toBlock &&
            toBlock <= headBlock;

        if (count !== 0) {
            await emitTransactionEvent(socket, {
                accounts,
                fromBlock: startBlock,
                toBlock,
            });
        } else if (toBlock <= lastIrreversibleBlock) {
            const nextBlock = await receiptsService.getNextBlockWithTransaction(
                {
                    accounts,
                    fromBlock: startBlock,
                }
            );

            toBlock = nextBlock ?? lastIrreversibleBlock;
        }

        startBlock = toBlock;
        setSocketState({
            lastCheckedBlock: toBlock,
        });
    }
    scheduleNextEmit(socket);
}

async function emitTransactionEvent(
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

    const transactionHistory =
        await transactionService.getWebSocketTraceTransactions({
            accounts,
            fromBlock,
            toBlock,
        });

    if (isNonEmptyArray(transactionHistory)) {
        const lastTransactionBlockNum = transactionHistory[0].block_num;
        setSocketState({
            lastTransactionBlockNum: Number(lastTransactionBlockNum),
            lastCheckedBlock: toBlock,
        });
    }

    const transactions = transactionService.webSocketFormat(transactionHistory);

    if (isNonEmptyArray(transactions)) {
        socket.emit(EVENT.TRANSACTION_HISTORY, transactions, () => {});
    }
}

async function emitEventLogEvent(socketId: SocketId) {
    const { setSocketState, clearSocketState, getSocketState } =
        getSocketStateActions(socketId);
    const socketState = getSocketState();
    if (!socketState) return;

    const events = eventLogService.webSocketFormat(
        state.eventLog.data,
        socketState.args.accounts,
        socketState.lastEventLogId,
        socketState.lastCheckedBlock
    );

    const lastEventLog = state.eventLog.data[0];
    if (lastEventLog) {
        setSocketState({
            lastCheckedBlock: lastEventLog.block_num,
            lastEventLogId: lastEventLog.id,
        });
    }

    if (!isNonEmptyArray(events)) return;
    console.log(`Socket ${socketId} receives ${events.length} new Event Logs.`);

    // if client does not acknowledge emited event in ACKNOWLEDGE_TIME, disconnect it
    const disconnectionTimeout = setTimeout(() => {
        io.in(socketId).disconnectSockets(true);
        clearSocketState();
    }, ACKNOWLEDGE_TIME);

    io.to(socketId).emit(EVENT.TRANSACTION_HISTORY, events, () => {
        clearTimeout(disconnectionTimeout);
    });
}

function emitEventLogsToClients() {
    const eventLogClients = Object.keys(state.connectedSockets);

    for (const socketId of eventLogClients) {
        if (state.connectedSockets[socketId]?.tableType !== TableType.eventLog)
            continue;
        emitEventLogEvent(socketId);
    }
}

export {
    onTransactionHistory,
    getSocketStateActions,
    manageEventLogSaveAndEmit,
};
