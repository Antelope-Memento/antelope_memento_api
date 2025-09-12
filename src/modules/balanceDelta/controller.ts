import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import constants from '../../constants/config';
import * as syncService from '../../services/sync';
import sequelize from '../../database';
import { Op, QueryTypes, sql } from '@sequelize/core';
import { BalanceDeltaQuery } from './types';

const { HTTP_200_CODE, HTTP_400_CODE, HTTP_404_CODE } = constants;

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
        const {fromBlock, toBlock, balance, transfersNumber} = 
            await retrieveBalanceDelta(
                // sage to cast because it's validated
                req.query as unknown as BalanceDeltaQuery
            );

        res.status(HTTP_200_CODE);
        res.send({ fromBlock, toBlock, balance, transfersNumber });
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
}): Promise<{ fromBlock: string; toBlock: string; balance: string, transfersNumber: string }> {
    const { account, currency, contract, from_block, to_block } = args;

    const lastIrreversibleBlock =
        await syncService.getIrreversibleBlockNumber();

    const effectiveToBlockNum =
        to_block && to_block <= lastIrreversibleBlock
            ? to_block
            : lastIrreversibleBlock;

    const effectiveFromBlockNum = from_block ?? 0;

    const [result] = await sequelize.query<{
        raw_amount: string;
        decimals: number;
        transfers: number;
    }>(
        sql`
        SELECT 
          COALESCE(SUM(balance_change), 0) AS raw_amount,
          MAX(decimals) AS decimals,
          SUM(transfers) AS transfers
        FROM (
          SELECT SUM(amount) AS balance_change, MAX(decimals) AS decimals, COUNT(*) AS transfers
          FROM TOKEN_TRANSFERS
          WHERE ${sql.where({
              currency,
              contract,
              tx_to: account,
              block_num: { [Op.between]: [effectiveFromBlockNum, effectiveToBlockNum] },
          })}
    
          UNION ALL
    
          SELECT -SUM(amount) AS balance_change, MAX(decimals) AS decimals, COUNT(*) AS transfers
          FROM TOKEN_TRANSFERS
          WHERE ${sql.where({
              currency,
              contract,
              tx_from: account,
              block_num: { [Op.between]: [effectiveFromBlockNum, effectiveToBlockNum] },
          })}
        ) AS movements;
      `,
        { type: QueryTypes.SELECT }
    );

    const rawAmount = BigInt(result?.raw_amount ?? 0);
    const decimals = result?.decimals ?? 0;
    const balance = (Number(rawAmount) / Math.pow(10, decimals)).toString();
    const transfers = result?.transfers ?? 0;
    
    return {
      fromBlock: effectiveFromBlockNum.toString(),
      toBlock: effectiveToBlockNum.toString(),
      balance,
      transfersNumber: transfers.toString(),
    };
}
