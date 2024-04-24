import { EventType, Args } from './types';
import constants from '../../../constants/config';
import {
    isNonEmptyArrayOfAccounts,
    isNumber,
} from '../../../utilities/helpers';
import { TRACE_BLOCKS_LIMIT, TRACE_BLOCKS_THRESHOLD } from '.';

const { EVENT_ERRORS } = constants;

export function shouldSwitchToTraceType({
    start_block,
    startBlock,
    lastIrreversibleBlock,
    irreversible,
    eventType,
}: {
    start_block?: Args['start_block'];
    startBlock: number;
    lastIrreversibleBlock: number;
    irreversible: Args['irreversible'];
    eventType: EventType;
}) {
    return (
        ((start_block && startBlock < Number(lastIrreversibleBlock)) ||
            irreversible) &&
        eventType !== 'trace'
    );
}

export function shouldSwitchToForkType({
    lastTransactionBlockNum,
    lastIrreversibleBlock,
    start_block,
    irreversible,
    eventType,
}: {
    lastTransactionBlockNum: number;
    lastIrreversibleBlock: number;
    start_block?: Args['start_block'];
    irreversible: Args['irreversible'];
    eventType: EventType;
}) {
    return (
        (lastTransactionBlockNum >= lastIrreversibleBlock || !start_block) &&
        !irreversible &&
        eventType !== 'fork'
    );
}

export function validateArgs(args: Args) {
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

export function calculateTraceTxsBlockThreshold(
    count: number,
    startBlock: number
) {
    // The size of the chunk is determined as follows:
    // we get the number of traces within the next 100 blocks(the number is configurable),
    // and if it's more than 100 traces (configurable), the block range is reduced proportionally.
    if (count > TRACE_BLOCKS_LIMIT) {
        const ratio = count / TRACE_BLOCKS_THRESHOLD;
        return Math.floor(startBlock + (1 / ratio) * TRACE_BLOCKS_THRESHOLD);
    }

    return startBlock + TRACE_BLOCKS_THRESHOLD;
}
