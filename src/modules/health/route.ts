import express from 'express';
import * as controller from './controller';

const router = express.Router();

router.get('/health', controller.health);
router.get('/is_healthy', controller.isHealthy);

export default router;
