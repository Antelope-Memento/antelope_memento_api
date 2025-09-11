import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import constants from '../../constants/config';
import * as syncService from '../../services/sync';
import sequelize from '../../database';
import { Op, QueryTypes, sql } from '@sequelize/core';
import { NetBalanceQuery } from './types';

const { HTTP_200_CODE, HTTP_400_CODE } = constants;

export const getNetBalance = async (req: Request, res: Response) => {
    const validationRes = validationResult(req);
    if (!validationRes.isEmpty()) {
        res.status(400);
        res.send({ errors: validationRes.array() });
        return;
    }

    try {
        const {lastBlock, balance} = 
            await retrieveNetBalance(
                // sage to cast because it's validated
                req.query as unknown as NetBalanceQuery
            );

        res.status(HTTP_200_CODE);
        res.send({ lastBlock, balance });
    } catch (error) {
        res.sendStatus(HTTP_400_CODE);
        console.error((error as Error)?.message);
    }
}

async function retrieveNetBalance(args: {
    account: string;
    currency: string;
    contract: string;
    last_block_num?: number;
}): Promise<{ lastBlock: number; balance: number }> {
    const { account, currency, contract, last_block_num } = args;

    const lastIrreversibleBlock =
        await syncService.getIrreversibleBlockNumber();

    const effectiveBlockNum =
      last_block_num && last_block_num <= lastIrreversibleBlock
        ? last_block_num
        : lastIrreversibleBlock;

    const [result] = await sequelize.query<{ balance: number }>(
        sql`
        SELECT COALESCE(SUM(balance_change), 0) AS balance
        FROM (
          SELECT SUM(amount / POW(10, decimals)) AS balance_change
          FROM TOKEN_TRANSFERS
          WHERE ${sql.where({
              currency,
              contract,
              tx_to: account,
              block_num: { [Op.lte]: effectiveBlockNum },
          })}

          UNION ALL

          SELECT -SUM(amount / POW(10, decimals)) AS balance_change
          FROM TOKEN_TRANSFERS
          WHERE ${sql.where({
              currency,
              contract,
              tx_from: account,
              block_num: { [Op.lte]: effectiveBlockNum },
          })}
        ) AS movements;
      `,
        { type: QueryTypes.SELECT }
    );

    return {
      lastBlock: effectiveBlockNum,
      balance: result ? result.balance : 0
    };
}
