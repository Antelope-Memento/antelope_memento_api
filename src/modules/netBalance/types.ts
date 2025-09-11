export interface NetBalanceQuery {
    account: string;
    currency: string;
    contract: string;
    from_block?: number;
    to_block?: number;
}
