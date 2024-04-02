import { Op } from '@sequelize/core';
import Receipt from '../../database/models/receipt.model';

export async function getCount({
    accounts,
    fromBlock,
    toBlock,
}: {
    accounts: string[];
    fromBlock: number;
    toBlock: number;
}) {
    return Receipt.count({
        where: {
            receiver: {
                [Op.in]: accounts,
            },
            block_num: {
                [Op.gte]: fromBlock,
                [Op.lt]: toBlock,
            },
        },
        distinct: true,
        col: 'seq',
    });
}
