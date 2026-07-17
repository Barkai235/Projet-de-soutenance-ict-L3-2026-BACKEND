import { Router } from 'express';
import AdminController from '../controllers/admin.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();
router.use(authenticate);
router.use(authorize('administrateur'));

// Monitoring — lecture seule
router.get('/utilisateurs',  AdminController.getUtilisateurs);
router.get('/alertes',       AdminController.getAlertes);
router.get('/medicaments',   AdminController.getMedicaments);
router.get('/stats',         AdminController.getStatsAvancees);
router.get('/cardiologues',  AdminController.getCardiologues);
router.get('/cardiologues/en-attente', AdminController.getCardiologuesEnAttente);
router.post('/utilisateurs', AdminController.creerUtilisateur);
router.patch('/utilisateurs/:id/toggle-actif', AdminController.toggleActif);
router.delete('/utilisateurs/:id', AdminController.deleteUser);
router.patch('/patients/:id/assigner-cardiologue', AdminController.assignerCardiologue);
router.patch('/cardiologues/:id/validation', AdminController.traiterValidationCardiologue);

export default router;
