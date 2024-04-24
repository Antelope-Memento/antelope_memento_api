import { Socket } from 'socket.io';
import { State, SocketId, Args, SocketState } from './types';

import constants from '../../../constants/config';
import { isNonEmptyArray } from '../../../utilities/helpers';

import { assert } from 'ts-essentials';

import * as syncService from '../../sync';
import * as receiptsService from '../../receipts';
import * as eventLogService from '../../eventLog';
import * as transactionService from '../../transactions';
import {
    calculateTraceTxsBlockThreshold,
    shouldSwitchToForkType,
    shouldSwitchToTraceType,
    validateArgs,
} from './utils';

const { EVENT, EVENT_ERRORS } = constants;

export const TRACE_BLOCKS_THRESHOLD =
    Number(process.env.WS_TRACE_TRANSACTIONS_BLOCKS_THRESHOLD) ?? 100;
export const TRACE_BLOCKS_LIMIT =
    Number(process.env.WS_TRACE_TRANSACTIONS_LIMIT) ?? 100;
export const FORK_BLOCKS_LIMIT =
    Number(process.env.WS_FORK_TRANSACTIONS_LIMIT) ?? 100;

export const EMIT_TIMEOUT_TIME = 500; // Time in milliseconds to wait before emitting the next event
export const FORK_EVENT_WRITING_INTERVAL_TIME = 500; // Time in milliseconds to write the fork event

const state: State = {
    connectedSockets: {},
    forks: { data: [], lastForkId: null, intervalId: null }, // forks.data represents the fork event, which this service will write and emit to the clients when requested
};

export function scheduleNextEmit(socket: Socket) {
    setTimeout(() => {
        emitTransactionHistory(socket);
    }, EMIT_TIMEOUT_TIME);
}

function manageForkEventSaveInState(connectionsCount: number) {
    const shouldWrite = connectionsCount > 0 && !state.forks.intervalId;

    // start writing the fork event if there are active socket connections
    if (shouldWrite) {
        console.log(
            `Starting to write fork event, active connections: ${connectionsCount}`
        );
        state.forks.intervalId = setInterval(async () => {
            if (
                // check for any active socket connections with 'fork' transaction type
                !Object.values(state.connectedSockets).find(
                    ({ eventType }) => eventType === 'fork'
                )
            ) {
                return;
            }

            try {
                await saveForkEventInState();
            } catch (error) {
                console.error('error writing fork event:', error);
            }
        }, FORK_EVENT_WRITING_INTERVAL_TIME);
    }
    if (!connectionsCount && state.forks.intervalId) {
        // stop writing the fork event and clear the fork state
        // if there are no active socket connections
        clearInterval(state.forks.intervalId);
        state.forks = { data: [], lastForkId: null, intervalId: null };
    }
}

// write the fork event and save them to the state
async function saveForkEventInState() {
    let fromId: number;

    if (!state.forks.lastForkId) {
        const lastIrreversibleBlock =
            await syncService.getIrreversibleBlockNumber();

        fromId = await eventLogService.getMaxEventLog(lastIrreversibleBlock);
    } else {
        fromId = state.forks.lastForkId;
    }

    const forks = await eventLogService.getAll({
        fromId,
        toId: Number(fromId) + FORK_BLOCKS_LIMIT,
    });

    if (isNonEmptyArray(forks)) {
        state.forks = {
            ...state.forks,
            data: forks,
            lastForkId: forks[0].id,
        };
    }
}

function getSocketStateActions(socketId: SocketId) {
    return {
        initializeSocketState: (args: Args): void => {
            state.connectedSockets[socketId] = {
                args,
                lastTransactionBlockNum: 0,
                eventType: args.irreversible ? 'trace' : 'fork',
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
        lastTransactionBlockNum,
        eventType,
        args: { accounts, start_block, irreversible },
    } = state;

    const startBlock = Math.max(
        start_block ?? headBlock,
        lastTransactionBlockNum
    );

    const shouldSwitchToTrace = shouldSwitchToTraceType({
        start_block,
        startBlock,
        lastIrreversibleBlock,
        irreversible,
        eventType,
    });

    const shouldSwitchToFork = shouldSwitchToForkType({
        lastTransactionBlockNum,
        lastIrreversibleBlock,
        start_block,
        irreversible,
        eventType,
    });

    if (shouldSwitchToTrace) {
        console.log(`Switching to trace type for socket: ${socket.id}`);
        setSocketState({
            eventType: 'trace',
        });
        scheduleNextEmit(socket);
        return;
    }

    if (shouldSwitchToFork) {
        console.log(`Switching to fork type for socket: ${socket.id}`);
        setSocketState({
            eventType: 'fork',
        });
        scheduleNextEmit(socket);
        return;
    }

    emitEventBasedOnType({
        socket,
        accounts,
        startBlock,
        lastIrreversibleBlock,
        irreversible,
        headBlock,
    });
}

async function emitEventBasedOnType({
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
    const { getSocketState } = getSocketStateActions(socket.id);

    const state = getSocketState();
    assert(
        state,
        `emitTransactionBasedOnType: socket state not found for socket: ${socket.id}`
    );

    switch (state.eventType) {
        case 'trace': {
            let shouldExecute = true;
            while (shouldExecute) {
                const count = await receiptsService.getCount({
                    accounts,
                    fromBlock: startBlock,
                    toBlock: startBlock + TRACE_BLOCKS_THRESHOLD,
                });

                const threshold = calculateTraceTxsBlockThreshold(
                    count,
                    startBlock
                );

                const toBlock = irreversible
                    ? Math.min(threshold, lastIrreversibleBlock)
                    : threshold;

                shouldExecute =
                    startBlock < toBlock &&
                    lastIrreversibleBlock !== toBlock &&
                    toBlock <= headBlock;

                if (shouldExecute && count !== 0) {
                    await emitTraceEvent(socket, {
                        accounts,
                        fromBlock: startBlock,
                        toBlock,
                    });
                }
                startBlock = toBlock;
            }
            scheduleNextEmit(socket);
            break;
        }
        case 'fork': {
            emitForkEvent(socket, { accounts });
            break;
        }
    }
}

async function emitTraceEvent(
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
        });
    }

    const transactions = transactionService.webSocketFormat(transactionHistory);

    if (isNonEmptyArray(transactions)) {
        socket.emit(EVENT.TRANSACTION_HISTORY, transactions, () => {});
    }
}

async function emitForkEvent(
    socket: Socket,
    { accounts }: { accounts: Args['accounts'] }
) {
    const events = eventLogService.webSocketFormat(state.forks.data, accounts);

    if (isNonEmptyArray(events)) {
        socket.emit(EVENT.TRANSACTION_HISTORY, events, () => {
            scheduleNextEmit(socket);
        });
    } else {
        scheduleNextEmit(socket);
    }
}

export {
    onTransactionHistory,
    getSocketStateActions,
    manageForkEventSaveInState,
};
