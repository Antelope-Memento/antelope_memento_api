import constant from '../../constants/config';
import Sync from '../../database/models/sync.model';
import { Request, Response } from 'express';

async function checkHealth() {
    const maxBlockTime = await Sync.max<number, Sync>('block_time');

    const block_time = Date.parse(maxBlockTime.toString());
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
    const retVal = await checkHealth();
    res.status(retVal.status ? constant.HTTP_200_CODE : constant.HTTP_503_CODE);
    res.send(retVal);
};

export const isHealthy = async (_req: Request, res: Response) => {
    const health = await checkHealth();
    res.send(health);
};
