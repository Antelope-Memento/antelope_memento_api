import constant from '../../constants/config';
import { Request, Response } from 'express';
import * as syncService from '../../services/sync';
import Transaction from '../../database/models/transaction.model';
import { Trace } from '../../services/transactions';

const trxIdRegex = new RegExp(/[0-9a-f]{64}/);

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
    if (!trxIdRegex.test(trxId)) {
        throw new Error('invalid trx_id');
    }

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
    const trxId = req.query['trx_id'];

    if (typeof trxId !== 'string') {
        res.status(constant.HTTP_400_CODE);
        res.send('trx_id is required');
        return;
    }

    const transaction = await readTransaction(trxId);

    if (transaction.known) {
        const { known, irreversible, data } = transaction;
        res.status(constant.HTTP_200_CODE);
        res.send({ known, irreversible, data });
    } else {
        // send { known: false } if transaction is not found
        res.status(constant.HTTP_404_CODE);
        res.send(transaction);
    }
};

export const getTransactionsStatus = async (
    req: Request,
    res: Response
): Promise<void> => {
    const trxId = req.query['trx_id'];

    if (typeof trxId !== 'string') {
        res.status(constant.HTTP_400_CODE);
        res.send('trx_id is required');
        return;
    }
    const { data, ...rest } = await readTransaction(trxId);

    res.status(constant.HTTP_200_CODE);
    res.send(rest);
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
