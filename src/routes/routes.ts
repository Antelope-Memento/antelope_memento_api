import { Router } from 'express';
import healthRoute from '../modules/health/route';
import historyRoute from '../modules/history/route';
import transactionRoute from '../modules/transactionStatus/route';
import graphqlRoute from '../modules/graphql/route';
import netBalanceRoute from '../modules/netBalance/route';

const router = Router();

router.use('/', healthRoute);
router.use('/', historyRoute);
router.use('/', transactionRoute);
router.use('/', graphqlRoute);
router.use('/', netBalanceRoute);

export default router;
