import { Socket } from 'socket.io';
import { State, SocketId, TransactionType, Args, SocketState } from './types';

import { EVENT, EVENT_ERRORS } from '../../../constants/config';
import {
    isNumber,
    isNonEmptyArray,
    isNonEmptyArrayOfAccounts,
} from '../../../utilities/helpers';
import { assert } from 'ts-essentials';
import * as syncService from '../../sync';
import * as receiptsService from '../../receipts';
import * as eventLogService from '../../eventLog';
import * as transactionsService from '../../transactions';

const TRACE_TRANSACTIONS_BLOCKS_THRESHOLD =
    Number(process.env.WS_TRACE_TRANSACTIONS_BLOCKS_THRESHOLD) ?? 100;
const TRACE_TRANSACTIONS_LIMIT =
    Number(process.env.WS_TRACE_TRANSACTIONS_LIMIT) ?? 100;
const FORK_TRANSACTIONS_LIMIT =
    Number(process.env.WS_FORK_TRANSACTIONS_LIMIT) ?? 100;

const EMIT_TIMEOUT_TIME = 500; // Time in milliseconds to wait before emitting the next transactions
const FORK_TRANSACTIONS_WRITING_INTERVAL_TIME = 500; // Time in milliseconds to write the fork transactions

const state: State = {
    connectedSockets: {},
    forks: { data: [], lastForkId: null, intervalId: null }, // forks.data represents the fork transactions, which this service will write and emit to the clients when requested
};

function manageForkTransactionsWriting(connectionsCount: number) {
    const shouldWrite = connectionsCount > 0 && !state.forks.intervalId;

    // start writing the fork transactions if there are active socket connections
    if (shouldWrite) {
        state.forks.intervalId = setInterval(async () => {
            if (
                // check for any active socket connections with 'fork' transaction type
                !Object.values(state.connectedSockets).find(
                    ({ transactionType }) => transactionType === 'fork'
                )
            ) {
                return;
            }

            try {
                await writeForkTransactions();
            } catch (error) {
                console.error('error writing fork transactions:', error);
            }
        }, FORK_TRANSACTIONS_WRITING_INTERVAL_TIME);
    }
    if (!connectionsCount && state.forks.intervalId) {
        // stop writing the fork transactions and clear the fork state
        // if there are no active socket connections
        clearInterval(state.forks.intervalId);
        state.forks = { data: [], lastForkId: null, intervalId: null };
    }
}

// write the fork transactions and save them to the state
async function writeForkTransactions() {
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
        toId: Number(fromId) + FORK_TRANSACTIONS_LIMIT,
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
                transactionType: args.irreversible ? 'trace' : 'fork',
            };
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
        },
    };
}

function onTransactionsHistory(socket: Socket, args: Args) {
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
        initializeSocketState(args);
    }

    emitTransactionsHistory(socket);
}

async function emitTransactionsHistory(socket: Socket) {
    const { setSocketState, getSocketState } = getSocketStateActions(socket.id);

    const headBlock = await syncService.getHeadBlockNumber();

    const lastIrreversibleBlock =
        await syncService.getIrreversibleBlockNumber();

    const state = getSocketState();
    assert(
        state,
        `emitTransactionsHistory: socket state not found for socket: ${socket.id}`
    );
    const {
        lastTransactionBlockNum,
        transactionType,
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
        transactionType,
    });

    const shouldSwitchToFork = shouldSwitchToForkType({
        lastTransactionBlockNum,
        lastIrreversibleBlock,
        start_block,
        irreversible,
        transactionType,
    });

    if (shouldSwitchToTrace) {
        setSocketState({
            transactionType: 'trace',
        });
        scheduleNextEmit(socket);
        return;
    }

    if (shouldSwitchToFork) {
        setSocketState({
            transactionType: 'fork',
        });
        scheduleNextEmit(socket);
        return;
    }

    emitTransactionsBasedOnType({
        socket,
        accounts,
        startBlock,
        lastIrreversibleBlock,
        irreversible,
    });
}

function scheduleNextEmit(socket: Socket) {
    setTimeout(() => {
        emitTransactionsHistory(socket);
    }, EMIT_TIMEOUT_TIME);
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
    socket,
    accounts,
    startBlock,
    lastIrreversibleBlock,
    irreversible,
}: {
    socket: Socket;
    accounts: Args['accounts'];
    startBlock: number;
    lastIrreversibleBlock: number;
    irreversible: Args['irreversible'];
}) {
    const { getSocketState } = getSocketStateActions(socket.id);

    const state = getSocketState();
    assert(
        state,
        `emitTransactionsBasedOnType: socket state not found for socket: ${socket.id}`
    );

    switch (state.transactionType) {
        case 'trace': {
            const count = await receiptsService.getCount({
                accounts,
                fromBlock: startBlock,
                toBlock: startBlock + TRACE_TRANSACTIONS_BLOCKS_THRESHOLD,
            });

            const threshold = calculateTraceTxsBlockThreshold(
                count,
                startBlock
            );

            const toBlock = irreversible
                ? Math.min(threshold, lastIrreversibleBlock)
                : threshold;

            const shouldExecute =
                startBlock < toBlock && lastIrreversibleBlock !== toBlock;

            if (shouldExecute) {
                emitTraceTransactions(socket, {
                    accounts,
                    fromBlock: startBlock,
                    toBlock,
                });
            } else {
                scheduleNextEmit(socket);
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

    const transactionsHistory =
        await transactionsService.getTraceTransactionsV2({
            accounts,
            fromBlock,
            toBlock,
        });

    if (isNonEmptyArray(transactionsHistory)) {
        const lastTransactionBlockNum = transactionsHistory[0].block_num;
        setSocketState({
            lastTransactionBlockNum: Number(lastTransactionBlockNum),
        });
    }

    const transactions = transactionsService.format(transactionsHistory);

    if (isNonEmptyArray(transactions)) {
        socket.emit(EVENT.TRANSACTIONS_HISTORY, transactions, () => {
            scheduleNextEmit(socket);
        });
    } else {
        scheduleNextEmit(socket);
    }
}

async function emitForkTransactions(
    socket: Socket,
    { accounts }: { accounts: Args['accounts'] }
) {
    const transactions = eventLogService.format(state.forks.data, accounts);

    if (isNonEmptyArray(transactions)) {
        socket.emit(EVENT.TRANSACTIONS_HISTORY, transactions, () => {
            scheduleNextEmit(socket);
        });
    } else {
        scheduleNextEmit(socket);
    }
}

function validateArgs(args: Args) {
    const { accounts, start_block, irreversible } = args;

    switch (true) {
        case typeof args !== 'object':
            return {
                valid: false,
                message: EVENT_ERRORS.INVALID_ARGS,
            };
        case !accounts || !isNonEmptyArrayOfAccounts(accounts):
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

function calculateTraceTxsBlockThreshold(count: number, startBlock: number) {
    // The size of the chunk is determined as follows:
    // we get the number of traces within the next 100 blocks(the number is configurable),
    // and if it's more than 100 traces (configurable), the block range is reduced proportionally.
    if (count > TRACE_TRANSACTIONS_LIMIT) {
        const ratio = count / TRACE_TRANSACTIONS_BLOCKS_THRESHOLD;
        return Math.floor(
            startBlock + (1 / ratio) * TRACE_TRANSACTIONS_BLOCKS_THRESHOLD
        );
    }

    return startBlock + TRACE_TRANSACTIONS_BLOCKS_THRESHOLD;
}

export {
    onTransactionsHistory,
    getSocketStateActions,
    manageForkTransactionsWriting,
};
