import { Router } from 'express';
import * as controller from './controller';

const router = Router();

router.get('/get_transaction', controller.getTransaction);
router.get('/get_transaction_status', controller.getTransactionsStatus);

export default router;
