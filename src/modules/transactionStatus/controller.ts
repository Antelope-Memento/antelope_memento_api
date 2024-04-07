import constants from '../../constants/config';
import { Request, Response } from 'express';
import * as syncService from '../../services/sync';
import Transaction from '../../database/models/transaction.model';
import { Trace } from '../../services/transactions';
import { validationResult } from 'express-validator';

const { HTTP_200_CODE, HTTP_400_CODE, HTTP_404_CODE } = constants;

type ReadTransactionOutput = {
    block_time?: Date;
    block_num?: number;
    data?: Trace;
    irreversible?: boolean;
    known: boolean;
};

async function readTransaction(
    trxId: string,
    skipTrace: boolean = false
): Promise<ReadTransactionOutput> {
    const [irreversibleBlock, transaction] = await Promise.all([
        syncService.getIrreversibleBlockNumber(),
        Transaction.findOne({
            attributes: ['block_num', 'block_time'].concat(
                skipTrace ? [] : ['trace']
            ),
            where: {
                trx_id: trxId,
            },
            raw: true,
        }),
    ]);

    if (transaction) {
        const { trace, ...rest } = transaction;
        return {
            ...rest,
            known: true,
            irreversible: transaction.block_num <= irreversibleBlock,
            data: JSON.parse(transaction.trace.toString('utf8')),
        };
    } else {
        return {
            known: false,
        };
    }
}

// expressjs handlers
export const getTransaction = async (
    req: Request,
    res: Response
): Promise<void> => {
    const validationRes = validationResult(req);
    if (!validationRes.isEmpty()) {
        res.status(HTTP_400_CODE);
        res.send({ errors: validationRes.array() });
        return;
    }

    try {
        const transaction = await readTransaction(
            // safe to cast because it's validated
            req.query.trx_id as string
        );

        if (transaction.known) {
            const { known, irreversible, data } = transaction;
            res.status(HTTP_200_CODE);
            res.send({ known, irreversible, data });
        } else {
            res.status(HTTP_404_CODE);
            res.send(transaction); // { known: false }
        }
    } catch (error) {
        res.sendStatus(HTTP_400_CODE);
        console.error((error as Error)?.message);
    }
};

export const getTransactionsStatus = async (
    req: Request,
    res: Response
): Promise<void> => {
    const validationRes = validationResult(req);
    if (!validationRes.isEmpty()) {
        res.status(HTTP_400_CODE);
        res.send({ errors: validationRes.array() });
        return;
    }
    try {
        const { data, ...rest } = await readTransaction(
            // safe to cast because it's validated
            req.query.trx_id as string
        );

        res.status(HTTP_200_CODE);
        res.send(rest);
    } catch (error) {
        res.sendStatus(HTTP_400_CODE);
        console.error((error as Error)?.message);
    }
};

type GraphQlGetTransactionOutput = Pick<
    ReadTransactionOutput,
    'irreversible' | 'known' | 'data'
>;

// graphQL handler
export const graphQlGetTransaction = async (
    trx_id: string
): Promise<GraphQlGetTransactionOutput> => {
    return readTransaction(trx_id);
};
