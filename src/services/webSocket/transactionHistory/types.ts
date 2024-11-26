import EventLog from '../../../database/models/eventLog.model';

export type SocketId = string;

/**
 * - 'trace' - transactions that cannot be reverted
 * - 'fork' - transactions that can be reverted
 */
export enum TableType {
    transaction = 'transaction',
    eventLog = 'eventLog',
}
export type EventType = 'trace' | 'fork';

export interface State {
    connectedSockets: {
        [key: SocketId]: SocketState;
    };
    eventLog: {
        data: EventLog[];
        lastEventId: number | null;
        intervalId: NodeJS.Timeout | null;
    };
}

export interface SocketState {
    args: Args;
    tableType: TableType;
    lastTransactionBlockNum: number;
    lastCheckedBlock: number;
    intervalId: NodeJS.Timeout | null;
    lastEventLogId: number;
}

export interface Args {
    accounts: string[];
    start_block?: number;
    irreversible?: boolean;
}
