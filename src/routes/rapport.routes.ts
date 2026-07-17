import { Router }          from 'express';
import RapportController   from '../controllers/rapport.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();
router.use(authenticate);

// Patient exporte son propre rapport
router.get(
  '/export',
  authorize('patient', 'cardiologue', 'administrateur'),
  RapportController.exporterHTML
);

// Médecin exporte le rapport d'un patient
router.get(
  '/export/:patientId',
  authorize('cardiologue', 'administrateur'),
  RapportController.exporterHTML
);

// Prévisualisation
router.get(
  '/preview',
  authorize('patient', 'cardiologue', 'administrateur'),
  RapportController.previsualiser
);

router.get(
  '/preview/:patientId',
  authorize('cardiologue', 'administrateur'),
  RapportController.previsualiser
);

export default router;