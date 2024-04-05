import express from 'express';
import controller from './controller';
import { Request, Response, NextFunction } from 'express';

const router = express.Router();

router.use('/graphql', (req: Request, _res: Response, next: NextFunction) => {
    console.log('graphql req: ', JSON.stringify(req.body));
    next();
});

router.use('/graphql', controller);

export default router;
