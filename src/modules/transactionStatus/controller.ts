import constant from '../../constants/config';
import { Request, Response } from 'express';
import * as syncService from '../../services/sync';
import Transaction from '../../database/models/transaction.model';

const trxIdRegex = new RegExp(/[0-9a-f]{64}/);

async function readTransaction(trxId: string, skipTrace: boolean = false) {
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
        return {
            ...transaction,
            irreversible: transaction.block_num <= irreversibleBlock,
            known: true,
        };
    } else {
        return {
            known: false,
        };
    }
}

// expressjs handlers
export const getTransaction = async (req: Request, res: Response) => {
    const trxId = req.query['trx_id'];

    if (typeof trxId !== 'string') {
        res.status(constant.HTTP_400_CODE);
        res.send('trx_id is required');
        return;
    }

    const transaction = await readTransaction(trxId);

    if (transaction.known) {
        const { trace, ...rest } = transaction;
        res.status(constant.HTTP_200_CODE);
        res.send({
            ...rest,
            data: JSON.parse(trace.toString('utf8')),
        });
    } else {
        // send { known: false } if transaction is not found
        res.send(transaction);
    }
};

export const getTransactionsStatus = async (req: Request, res: Response) => {
    const trxId = req.query['trx_id'];

    if (typeof trxId !== 'string') {
        res.status(constant.HTTP_400_CODE);
        res.send('trx_id is required');
        return;
    }

    res.status(constant.HTTP_200_CODE);
    res.send(await readTransaction(trxId));
};

// graphQL handler
export const graphQlGetTransaction = async (trx_id: string) => {
    const transaction = await readTransaction(trx_id);

    if (transaction.trace != null) {
        transaction.data = JSON.parse(transaction.trace.toString('utf8'));
        delete transaction.trace;
    }
    return transaction;
};
