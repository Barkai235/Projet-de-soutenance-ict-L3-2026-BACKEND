import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import PatientsController from '../controllers/patients.controller';

const router = Router();

router.use(authenticate);
router.use(authorize('cardiologue'));

router.get('/',        PatientsController.listerMesPatients);
router.get('/:id/dossier', PatientsController.getDossierPatient);
router.put('/:id/dossier-clinique', PatientsController.mettreAJourDossierClinique);

export default router;
