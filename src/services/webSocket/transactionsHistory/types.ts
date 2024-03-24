export type SocketId = string;

export type TransactionType = 'trace' | 'fork';

export interface State {
    sockets: {
        [key: SocketId]: SocketState;
    };
    eventLogs: {
        data: EventLogEntity[];
        lastEventLogId: number;
    };
    eventLogsIntervalId: NodeJS.Timeout | null;
}

export interface SocketState {
    intervalId: NodeJS.Timeout | null;
    lastTransactionBlockNum: number;
    transactionType: TransactionType | null;
}

export interface Args {
    accounts: string[];
    start_block?: number;
    irreversible?: boolean;
}

export interface EventLogEntity {
    id: number;
    block_num: number;
    trace: Buffer;
}

export interface TransactionEntity {
    block_num: number;
    trace: Buffer;
}
