import { Router } from 'express';
import { body }   from 'express-validator';
import TelemedicineController from '../controllers/telemedicine.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validate }               from '../middlewares/validation.middleware';

const router = Router();
router.use(authenticate);

// Patient: liste les cardiologues disponibles
router.get('/cardiologues', authorize('patient'), TelemedicineController.listerCardiologues);

// Patient: liste ses RDV
router.get('/', authorize('patient'), TelemedicineController.listerRdv);

// Patient : compteur RDV en attente (navigation / badges)
router.get(
  '/en-attente-count',
  authorize('patient'),
  TelemedicineController.countEnAttentePatient
);

// Cardiologue: liste ses RDV
router.get('/cardiologue', authorize('cardiologue'), TelemedicineController.listerRdvCardiologue);

// Patient: créer une demande de RDV
router.post('/',
  authorize('patient'),
  [
    body('cardiologue_id').isInt().withMessage('cardiologue_id requis'),
    body('date_rdv').notEmpty().withMessage('date_rdv requis'),
    body('type').isIn(['video', 'cabinet']).withMessage('type invalide'),
    body('motif').notEmpty().withMessage('motif requis'),
  ],
  validate,
  TelemedicineController.creerRdv
);

// Patient / cardiologue : vider l'historique (RDV terminés, annulés, demandes en attente côté patient)
router.delete(
  '/tout',
  authorize('patient', 'cardiologue'),
  TelemedicineController.supprimerToutHistorique
);

// Patient / cardiologue : retirer un RDV de l'historique
router.delete(
  '/:id',
  authorize('patient', 'cardiologue'),
  TelemedicineController.supprimerHistorique
);

// Cardiologue: confirmer un RDV
router.patch('/:id/confirmer', authorize('cardiologue'), TelemedicineController.confirmerRdv);

// Cardiologue: refuser un RDV
router.patch('/:id/refuser', authorize('cardiologue'), TelemedicineController.refuserRdv);

// Patient ou Cardiologue: annuler un RDV
router.patch('/:id/annuler', authorize('patient', 'cardiologue'), TelemedicineController.annulerRdv);

// Patient ou Cardiologue: rejoindre l'appel vidéo
router.get('/:id/rejoindre', authorize('patient', 'cardiologue'), TelemedicineController.rejoindreRdv);

// Cardiologue: terminer un RDV
router.patch('/:id/terminer', authorize('cardiologue'), TelemedicineController.terminerRdv);

export default router;
