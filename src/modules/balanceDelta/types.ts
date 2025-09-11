export interface BalanceDeltaQuery {
    account: string;
    currency: string;
    contract: string;
    from_block?: number;
    to_block?: number;
}
