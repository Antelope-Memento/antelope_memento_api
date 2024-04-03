import constant from '../../constants/config';
import db from '../../utilities/db';
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
                !skipTrace ? [] : ['trace']
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
export const get_transaction = async (req: Request, res: Response) => {
    if (typeof req.query['trx_id'] !== 'string') {
        res.status(constant.HTTP_400_CODE);
        res.send('trx_id is required');
        return;
    }

    readTransaction(req.query['trx_id']).then((rec) => {
        res.status(constant.HTTP_200_CODE);
        if (rec.known) {
            res.write(
                '{"known": true ' +
                    ', "irreversible": ' +
                    rec.irreversible +
                    ',"data":'
            );
            res.write(rec.trace);
            res.write('}');
            res.end();
        } else {
            res.send(rec);
        }
    });
};

export const get_transaction_status = async (req: Request, res: Response) => {
    if (typeof req.query['trx_id'] !== 'string') {
        res.status(constant.HTTP_400_CODE);
        res.send('trx_id is required');
        return;
    }

    const transaction = await readTransaction(req.query['trx_id']);

    res.status(constant.HTTP_200_CODE);
    res.send(transaction);
};

// graphQL handler
export const graphql_get_transaction = async (trx_id: string) => {
    const rec = await readTransaction(trx_id);
    if (rec.trace != null) {
        rec.data = JSON.parse(rec.trace.toString('utf8'));
        delete rec.trace;
    }
    return rec;
};
