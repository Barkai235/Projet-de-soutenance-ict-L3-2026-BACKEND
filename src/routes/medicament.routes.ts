import { Router } from 'express';
import { body }   from 'express-validator';
import MedicamentController from '../controllers/medicament.controller';
import { validate }         from '../middlewares/validation.middleware';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/',    MedicamentController.lister);
router.get('/:id', MedicamentController.detail);

router.post(
  '/',
  authorize('administrateur', 'cardiologue'),
  [body('nom').notEmpty().withMessage('Le nom est requis')],
  validate,
  MedicamentController.creer
);

export default router;