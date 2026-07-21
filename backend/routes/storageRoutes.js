import express from 'express';
import { getStorageUsage } from '../controllers/storageController.js';

const router = express.Router();

router.get('/usage', getStorageUsage);

export default router;
