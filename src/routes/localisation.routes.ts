import { Router }             from 'express';
import LocalisationController from '../controllers/localisation.controller';
import { authenticate }       from '../middlewares/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/',       LocalisationController.getCentres);
router.get('/proches',LocalisationController.getCentresProches);

export default router;