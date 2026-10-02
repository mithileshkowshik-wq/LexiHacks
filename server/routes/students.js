import express from 'express';
import {
  getStudent,
  getStudents,
  createStudent,
  getTrends,
} from '../controllers/studentController.js';
import { getStudentSamples } from '../controllers/sampleController.js';
import {
  generateStudentRecommendations,
  getLatestStudentRecommendations,
} from '../controllers/recommendationController.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = express.Router();

// get all student and create one student on '/api/student/'
router.route('/').get(getStudents).post(createStudent);

// get a student by student ID
router.route('/:studentId').get(getStudent);

router.route('/:studentId/recommendations').post(asyncHandler(generateStudentRecommendations));
router
  .route('/:studentId/recommendations/latest')
  .get(asyncHandler(getLatestStudentRecommendations));

// GET /api/students/:studentId/samples — the writing-samples list on the
// student profile, newest first. Supports ?status=UPLOADED etc. so the UI
// can filter later. Responses use the path-free summary shape from
// samples.js — raw image paths never leave the server.

router.route('/:studentId/samples').get(getStudentSamples);
router.route('/:studentId/trends').get(getTrends);

export default router;
