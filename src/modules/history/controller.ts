import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import constants from '../../constants/config';

import { Op, QueryTypes, sql } from '@sequelize/core';
import sequelize from '../../database';

import { AccountHistoryQuery, GetPosQuery } from './types';

import * as syncService from '../../services/sync';
import * as maxRecvSequenceService from '../../services/resSequenceMax';
import { timestampToQuery } from '../../utilities/helpers';
import { Trace } from '../../services/transactions';

const { HTTP_200_CODE, HTTP_400_CODE } = constants;

function formatHistoryData(
    data: { pos: number; trace: Buffer }[],
    last_irreversible_block: number
): { data: { pos: number; trace: Trace }[]; last_irreversible_block: number } {
    const result = {
        data: new Array(),
        last_irreversible_block,
    };

    data.forEach(({ pos, trace }) => {
        result.data.push({ pos, trace: JSON.parse(trace.toString('utf8')) });
    });

    return result;
}

async function retrieveAccountHistory(args: {
    account: string;
    irreversible?: boolean;
    pos?: number;
    action_filter?: string;
    max_count?: number;
}): Promise<[number, { pos: number; trace: Buffer }[]]> {
    const { account, irreversible, pos, action_filter, max_count } = args;
    const lastIrreversibleBlock =
        await syncService.getIrreversibleBlockNumber();

    let position = pos ?? -1 * Number(process.env.MAX_RECORD_COUNT);

    if (position < 0) {
        const maxRecvSequence =
            await maxRecvSequenceService.getMaxRecvSequence(account);
        position = Number(maxRecvSequence) + position + 1;
    }

    const limit = Math.min(
        Number(process.env.MAX_RECORD_COUNT),
        max_count ?? Infinity
    );

    const upper_position = Number(position) + Number(limit);
    console.log({ account });
    const queryResult = await sequelize.query<{
        pos: number;
        trace: Buffer;
    }>(
        sql`
        SELECT pos, trace
        FROM (
            SELECT seq, max(recv_sequence) AS pos
            FROM (
              SELECT seq, recv_sequence FROM
              RECEIPTS
              WHERE ${sql.where({
                  receiver: account,
                  recv_sequence: { [Op.between]: [position, upper_position] },
                  ...(action_filter && {
                      contract: action_filter.split(':')[0],
                      action: action_filter.split(':')[1],
                  }),
                  ...(irreversible && {
                      block_num: { [Op.lte]: lastIrreversibleBlock },
                  }),
              })}
              ORDER by receiver, recv_sequence, seq) Y
            GROUP BY seq
            ORDER by seq
        ) as X
        INNER JOIN TRANSACTIONS ON X.seq = TRANSACTIONS.seq
    `,
        {
            type: QueryTypes.SELECT,
        }
    );

    return [lastIrreversibleBlock, queryResult];
}

async function retrievePos({
    account,
    timestamp,
}: {
    account: string;
    timestamp: string;
}) {
    const query = await sequelize.query<{ pos: number }>(
        // didn't call sql interpolation function because of the timestamp
        `
    SELECT MIN(recv_sequence) AS pos
    FROM RECEIPTS
    WHERE receiver = :account
    AND block_time = (
        SELECT min(block_time)
        FROM RECEIPTS
        WHERE receiver = :account
        AND block_time >= ${timestampToQuery(timestamp)}
    )`,
        {
            replacements: { account },
            type: QueryTypes.SELECT,
        }
    );

    const position = Number(query[0]?.pos);

    return position > 0 ? position : Number(NaN);
}

// expressjs handlers
export const getAccountHistory = async (req: Request, res: Response) => {
    const validationRes = validationResult(req);
    if (!validationRes.isEmpty()) {
        res.status(HTTP_400_CODE);
        res.send({ errors: validationRes.array() });
        return;
    }

    try {
        const [irreversibleBlock, accountHistory] =
            await retrieveAccountHistory(
                // safe to cast because it's validated
                req.query as unknown as AccountHistoryQuery
            );

        res.status(HTTP_200_CODE);
        res.send(formatHistoryData(accountHistory, irreversibleBlock));
    } catch (error) {
        res.sendStatus(HTTP_400_CODE);
        console.error((error as Error)?.message);
    }
};

export const getPos = async (req: Request, res: Response) => {
    const validationRes = validationResult(req);
    if (!validationRes.isEmpty()) {
        res.status(HTTP_400_CODE);
        res.send({ errors: validationRes.array() });
        return;
    }

    try {
        res.status(HTTP_200_CODE);
        res.send(
            await retrievePos(
                // safe to cast because it's validated
                req.query as unknown as GetPosQuery
            )
        );
    } catch (error) {
        res.sendStatus(HTTP_400_CODE);
        console.error((error as Error)?.message);
    }
};

// graphql handlers
export const graphQlAccountHistory = async (args: AccountHistoryQuery) => {
    const [irreversibleBlock, accountHistory] =
        await retrieveAccountHistory(args);
    return formatHistoryData(accountHistory, irreversibleBlock);
};

export const graphQlGetPos = async (args: GetPosQuery) => {
    return await retrievePos(args);
};
