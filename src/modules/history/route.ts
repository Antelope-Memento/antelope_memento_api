import express from 'express';
import * as controller from './controller';
import { query } from 'express-validator';

const router = express.Router();

router.get(
    '/get_account_history',

    query('account').matches(/^[a-z1-5.]{1,13}$/),
    query('irreversible').optional().isBoolean(),
    query('max_count').optional().isInt(),
    query('pos').optional().isInt(),
    query('action_filter')
        .optional()
        .matches(/^[a-z1-5.]{1,13}:[a-z1-5.]{1,13}$/),

    controller.getAccountHistory
);

router.get(
    '/get_pos',

    query('account').matches(/^[a-z1-5.]{1,13}$/),
    query('timestamp').isISO8601(),

    controller.getPos
);

export default router;
