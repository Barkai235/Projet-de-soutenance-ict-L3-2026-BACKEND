import { Router }           from 'express';
import DashboardController  from '../controllers/dashboard.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();
router.use(authenticate);

router.get(
  '/patient',
  authorize('patient'),
  DashboardController.patient
);

router.get(
  '/cardiologue',
  authorize('cardiologue'),
  DashboardController.cardiologue
);

router.get(
  '/admin',
  authorize('administrateur'),
  DashboardController.admin
);

export default router;