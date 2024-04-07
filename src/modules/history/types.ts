export interface AccountHistoryQuery {
    account: string;
    irreversible?: boolean;
    pos?: number;
    action_filter?: string;
    max_count?: number;
}

export interface GetPosQuery {
    account: string;
    timestamp: string;
}
