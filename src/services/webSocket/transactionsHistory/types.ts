import EventLog from '../../../database/models/event_log.model';

export type SocketId = string;

/**
 * - 'trace' - transactions that cannot be reverted
 * - 'fork' - transactions that can be reverted
 */
export type TransactionType = 'trace' | 'fork';

export interface State {
    connectedSockets: {
        [key: SocketId]: SocketState;
    };
    forks: {
        data: EventLog[];
        lastForkId: number | null;
        intervalId: NodeJS.Timeout | null;
    };
}

export interface SocketState {
    args: Args;
    transactionType: TransactionType;
    lastTransactionBlockNum: number;
}

export interface Args {
    accounts: string[];
    start_block?: number;
    irreversible?: boolean;
}
