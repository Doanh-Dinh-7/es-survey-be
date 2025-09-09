import { Router } from 'express';
import { auth0Middleware, userMapperMiddleware } from '../middlewares/auth0.middleware';

const router = Router();

router.get('/me', auth0Middleware, userMapperMiddleware, async (req, res, next) => {
  try {
    res.json({ user: req.user });
  } catch (error) {
    next(error);
  }
});
export default router; 