import express from 'express';
import * as controller from './controller';
import { query } from 'express-validator';

const router = express.Router();

router.get('/get_net_balance',

    query('account').matches(/^[a-z1-5.]{1,13}$/),
    query('currency').matches(/^[A-Z0-9]{1,7}$/),
    query('contract').matches(/^[a-z1-5.]{1,13}$/),
    query('last_block_num').optional().isInt({ min: 0 }),

    controller.getNetBalance
);

export default router;
