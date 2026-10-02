import express from 'express';
import {
  login,
  forgotPassword,
  resetPassword,
  getAccount,
  changePassword,
} from '../controllers/authController.js';
import requireAuth from '../middleware/requireAuth.js';

const router = express.Router();

// These three have to stay reachable while signed out — they're how a
// session gets established (or recovered) in the first place.
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);

// Everything below acts on "my own account", never someone else's — gated,
// and the controllers below trust req.username (set by requireAuth) rather
// than any username the caller supplies, so there's no way to read or
// change another account by passing a different value.
router.get('/account', requireAuth, getAccount);
router.patch('/change-password', requireAuth, changePassword);

export default router;
