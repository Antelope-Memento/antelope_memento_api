import { QueryTypes, sql } from '@sequelize/core';
import sequelize from '../../database';
import Transaction from '../../database/models/transaction.model';

export type Trace = any; // @todo: define trace type

export function webSocketFormat(transactions: Transaction[]) {
    return transactions.map(({ trace, ...tx }) => ({
        ...tx,
        type: 'trace' as const,
        data: JSON.parse(trace.toString('utf8')),
    }));
}

export async function getWebSocketTraceTransactions({
    accounts,
    fromBlock,
    toBlock,
}: {
    accounts: string[];
    fromBlock: number;
    toBlock: number;
}): Promise<Transaction[]> {
    return sequelize.query(
        sql`SELECT R.block_num, trace
        FROM (
            SELECT DISTINCT seq, block_num
            FROM RECEIPTS
            WHERE receiver IN (:accounts)
            AND block_num >= :fromBlock
            AND block_num < :toBlock
            ORDER BY block_num ASC
        ) AS R
        INNER JOIN TRANSACTIONS ON R.seq = TRANSACTIONS.seq`,
        {
            replacements: {
                accounts: accounts.map((account) => sql`${account}`),
                fromBlock,
                toBlock,
            },
            type: QueryTypes.SELECT,
        }
    );
}
