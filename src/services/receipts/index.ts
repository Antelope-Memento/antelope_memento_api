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

export async function getNextBlockWithTransaction({
    accounts,
    fromBlock,
}: {
    accounts: string[];
    fromBlock: number;
}) {
    const firstBlock = await Receipt.findOne({
        where: {
            block_num: {
                [Op.gt]: fromBlock,
            },
            receiver: {
                [Op.in]: accounts,
            },
        },
        order: [['block_num', 'ASC']],
        limit: 1,
    });

    if (firstBlock) {
        return Number(firstBlock?.dataValues?.block_num);
    } else {
        return fromBlock;
    }
}
