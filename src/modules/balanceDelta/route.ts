import express from 'express';
import * as controller from './controller';
import { query } from 'express-validator';

const router = express.Router();

router.get('/get_balance_delta',

    query('account').matches(/^[a-z1-5.]{1,13}$/),
    query('currency').matches(/^[A-Z0-9]{1,7}$/),
    query('contract').matches(/^[a-z1-5.]{1,13}$/),
    query('from_block').optional().isInt({ min: 0 }),
    query('to_block').optional().isInt({ min: 0 }),
    query('from_time').optional().custom((value) => {
        if (/^\d+$/.test(value)) {
            return true;
        }
        return !isNaN(Date.parse(value));
    }).withMessage('from_time must be a unix timestamp or ISO8601 date'),
    query('to_time').optional().custom((value) => {
        if (/^\d+$/.test(value)) {
            return true;
        }
        return !isNaN(Date.parse(value));
    }).withMessage('to_time must be a unix timestamp or ISO8601 date'),

    controller.getBalanceDelta
);

export default router;
