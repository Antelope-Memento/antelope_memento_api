import constants from '../../constants/config';
import { DIALECT } from '../../database';
import Sync from '../../database/models/sync.model';
import { Request, Response } from 'express';

const { HTTP_200_CODE, HTTP_400_CODE, HTTP_503_CODE } = constants;

async function checkHealth() {
    // pg 2024-04-02T09:49:50.000Z
    // mysql 2024-04-02T12:50:17.000Z
    const maxBlockTime = await Sync.max<number, Sync>('block_time');

    const block_time = new Date(
        DIALECT === 'postgres' ? maxBlockTime + 'Z' : maxBlockTime
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
    try {
        const health = await checkHealth();
        res.status(health.status ? HTTP_200_CODE : HTTP_503_CODE);
        res.send(health);
    } catch (error) {
        res.sendStatus(HTTP_400_CODE);
        console.error((error as Error)?.message);
    }
};

export const isHealthy = async (_req: Request, res: Response) => {
    try {
        const health = await checkHealth();
        res.send(health);
    } catch (error) {
        res.sendStatus(HTTP_400_CODE);
        console.error((error as Error)?.message);
    }
};
