import express from 'express';

import { streamWorksheetFile } from '../controllers/recommendationController.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = express.Router();

// The controller validates the stable ID before contacting private Azure storage.
router.get('/:worksheetId/file', asyncHandler(streamWorksheetFile));

export default router;
