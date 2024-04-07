import { Router } from 'express';
import * as controller from './controller';
import { query } from 'express-validator';

const router = Router();

router.get(
    '/get_transaction',
    query('trx_id').matches(/[0-9a-f]{64}/),
    controller.getTransaction
);
router.get(
    '/get_transaction_status',
    query('trx_id').matches(/[0-9a-f]{64}/),
    controller.getTransactionsStatus
);

export default router;
