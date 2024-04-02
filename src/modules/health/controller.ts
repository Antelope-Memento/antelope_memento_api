import constant from '../../constants/config';
import sequelize from '../../database';
import Sync from '../../database/models/sync.model';
import { Request, Response } from 'express';

async function checkHealth() {
    // pg 2024-04-02T09:49:50.000Z
    // mysql 2024-04-02T12:50:17.000Z
    const maxBlockTime = await Sync.max<number, Sync>('block_time');

    const block_time = new Date(
        sequelize.dialect.name === 'postgres'
            ? maxBlockTime + 'Z'
            : maxBlockTime
    ).getTime();
    const now = new Date().getTime();
    const timeDiff = now - block_time;
    const status =
        timeDiff <= Number(process.env.HEALTHY_SYNC_TIME_DIFF) ? true : false;

    return {
        status: status,
        diff: timeDiff,
    };
}

export const health = async (_req: Request, res: Response) => {
    const health = await checkHealth();
    res.status(health.status ? constant.HTTP_200_CODE : constant.HTTP_503_CODE);
    res.send(health);
};

export const isHealthy = async (_req: Request, res: Response) => {
    const health = await checkHealth();
    res.send(health);
};
