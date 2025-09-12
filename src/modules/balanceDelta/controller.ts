import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import constants from '../../constants/config';
import * as syncService from '../../services/sync';
import sequelize from '../../database';
import { Op, QueryTypes, sql } from '@sequelize/core';
import { BalanceDeltaQuery } from './types';

const { HTTP_200_CODE, HTTP_400_CODE, HTTP_404_CODE } = constants;

const EOS_GENESIS_TIMESTAMP = '2018-06-08T10:08:08.000Z';

export const getBalanceDelta = async (req: Request, res: Response) => {
    if (process.env.PLUGIN_TRANSFERS_ENABLED !== 'true') {
        res.status(HTTP_404_CODE).send({ error: 'Endpoint not available PLUGIN_TRANSFERS must enabled' });
        return;
    }
    const validationRes = validationResult(req);
    if (!validationRes.isEmpty()) {
        res.status(HTTP_400_CODE);
        res.send({ errors: validationRes.array() });
        return;
    }

    try {
        const {fromBlock, fromTimestamp, toBlock, toTimestamp, balance, transfersNumber} = 
            await retrieveBalanceDelta(
                // sage to cast because it's validated
                req.query as unknown as BalanceDeltaQuery
            );

        res.status(HTTP_200_CODE);
        res.send({ fromBlock, fromTimestamp, toBlock, toTimestamp, balance, transfersNumber });
    } catch (error) {
        res.sendStatus(HTTP_400_CODE);
        console.error((error as Error)?.message);
    }
}

async function retrieveBalanceDelta(args: {
    account: string;
    currency: string;
    contract: string;
    from_block?: number;
    to_block?: number;
    from_time?: string;
    to_time?: string;
}): Promise<{ 
    fromBlock: string; 
    fromTimestamp: string; 
    toBlock: string; 
    toTimestamp: string; 
    balance: string; 
    transfersNumber: string 
}> {
    const { account, currency, contract, from_block, to_block, from_time, to_time } = args;

    const lastIrreversibleBlock =
        await syncService.getIrreversibleBlockNumber();
    const lastIrreversibleBlockTime =
        await syncService.getIrreversibleBlockTimestamp();

    const effectiveToBlockNum =
        to_block && to_block <= lastIrreversibleBlock
            ? to_block
            : lastIrreversibleBlock;
    const effectiveFromBlockNum = from_block ?? 1;

    const fromTimeSQL = from_time 
        ? sql`FROM_UNIXTIME(${from_time})` 
        : EOS_GENESIS_TIMESTAMP;
    
    const toTimeSQL = to_time 
        ? sql`FROM_UNIXTIME(${to_time})` 
        : lastIrreversibleBlockTime.toISOString();

    let rangeFilter: Record<string, any>;
    if (args.from_block || args.to_block) {
        rangeFilter = {
            block_num: { 
                [Op.between]: [args.from_block ?? 0, args.to_block ?? lastIrreversibleBlock] 
            },
        };
    } else if (args.from_time || args.to_time) {
        rangeFilter = {
            block_time: { 
                [Op.between]: [fromTimeSQL, toTimeSQL] 
            },
        };
    } else {
        rangeFilter = {};
    }

    const [result] = await sequelize.query<{
        raw_amount: string;
        decimals: number;
        transfers: number;
        from_time: string;
        to_time: string;
        from_block: number;
        to_block: number;
    }>(
        sql`
        SELECT 
            COALESCE(SUM(balance_change), 0) AS raw_amount,
            MAX(decimals) AS decimals,
            SUM(transfers) AS transfers,
            MIN(first_time) AS from_time,
            MAX(last_time) AS to_time,
            MIN(first_block) AS from_block,
            MAX(last_block) AS to_block
        FROM (
            SELECT 
                SUM(amount) AS balance_change,
                MAX(decimals) AS decimals,
                COUNT(*) AS transfers,
                MIN(block_time) AS first_time,
                MAX(block_time) AS last_time,
                MIN(block_num) AS first_block,
                MAX(block_num) AS last_block
            FROM TOKEN_TRANSFERS
            WHERE ${sql.where({
                currency,
                contract,
                tx_to: account,
                ...rangeFilter,
            })}

            UNION ALL

            SELECT 
                -SUM(amount) AS balance_change,
                MAX(decimals) AS decimals,
                COUNT(*) AS transfers,
                MIN(block_time) AS first_time,
                MAX(block_time) AS last_time,
                MIN(block_num) AS first_block,
                MAX(block_num) AS last_block
            FROM TOKEN_TRANSFERS
            WHERE ${sql.where({
                currency,
                contract,
                tx_from: account,
                ...rangeFilter,
            })}
        ) AS movements;
        `,
        { type: QueryTypes.SELECT }
    );

    const rawAmount = BigInt(result?.raw_amount ?? 0);
    const decimals = result?.decimals ?? 0;
    const balance = (Number(rawAmount) / Math.pow(10, decimals)).toString();
    const transfers = result?.transfers ?? 0;

    const finalFromBlock = result?.from_block?.toString() ?? effectiveFromBlockNum.toString();
    const finalToBlock   = result?.to_block?.toString()   ?? effectiveToBlockNum.toString();
    const finalFromTime = result?.from_time 
        ? new Date(result.from_time).toISOString()
        : EOS_GENESIS_TIMESTAMP; 
    const finalToTime = result?.to_time
        ? new Date(result.to_time).toISOString()
        : lastIrreversibleBlockTime.toISOString();

    return {
        fromBlock: finalFromBlock,
        fromTimestamp: finalFromTime,
        toBlock: finalToBlock,
        toTimestamp: finalToTime,
        balance,
        transfersNumber: transfers.toString(),
    };
}
