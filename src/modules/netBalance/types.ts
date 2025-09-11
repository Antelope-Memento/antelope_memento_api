export interface NetBalanceQuery {
    account: string;
    currency: string;
    contract: string;
    last_block_num?: number;
}
