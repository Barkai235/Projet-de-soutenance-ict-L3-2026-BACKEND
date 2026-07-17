import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import DisponibilitesController from '../controllers/disponibilites.controller';

const router = Router();

router.use(authenticate);
router.use(authorize('cardiologue'));

router.get('/',  DisponibilitesController.lister);
router.put('/',  DisponibilitesController.sauvegarder);

export default router;
