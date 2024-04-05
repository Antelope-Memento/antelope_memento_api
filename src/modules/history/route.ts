import express from 'express';
import * as controller from './controller';

const router = express.Router();

router.get('/get_account_history', controller.get_account_history);
router.get('/get_pos', controller.get_pos);

export default router;
