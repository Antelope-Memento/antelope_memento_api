import { Router } from 'express';
import healthRoute from '../modules/health/route';
import historyRoute from '../modules/history/route';
import transactionRoute from '../modules/transactionStatus/route';
import graphqlRoute from '../modules/graphql/route';

const router = Router();

router.use('/', healthRoute);
router.use('/', historyRoute);
router.use('/', transactionRoute);
router.use('/', graphqlRoute);

export default router;
