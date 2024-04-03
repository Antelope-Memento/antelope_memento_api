import { Router } from 'express';
import * as controller from './controller';

const router = Router();

router.get('/get_transaction', controller.get_transaction);
router.get('/get_transaction_status', controller.get_transaction_status);

export default router;
