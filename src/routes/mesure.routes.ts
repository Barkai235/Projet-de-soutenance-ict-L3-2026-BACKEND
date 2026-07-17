import { Router } from 'express';
import { body, query } from 'express-validator';
import MesureController from '../controllers/mesure.controller';
import { validate }     from '../middlewares/validation.middleware';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

// Toutes les routes nécessitent d'être connecté
router.use(authenticate);

// POST /api/mesures — ajouter une mesure
router.post(
  '/',
  authorize('patient', 'cardiologue'),
  [
    body('systolique')
      .isInt({ min: 50, max: 300 })
      .withMessage('Systolique invalide (50-300)'),
    body('diastolique')
      .isInt({ min: 30, max: 200 })
      .withMessage('Diastolique invalide (30-200)'),
    body('pouls')
      .optional()
      .isInt({ min: 30, max: 250 })
      .withMessage('Pouls invalide (30-250)'),
  ],
  validate,
  MesureController.ajouter
);

// POST /api/mesures/sync — plusieurs mesures (saisie hors ligne)
router.post(
  '/sync',
  authorize('patient'),
  [
    body('mesures')
      .isArray({ min: 1, max: 100 })
      .withMessage('mesures : tableau de 1 à 100 éléments'),
    body('mesures.*.systolique')
      .isInt({ min: 50, max: 300 })
      .withMessage('Systolique invalide (50-300)'),
    body('mesures.*.diastolique')
      .isInt({ min: 30, max: 200 })
      .withMessage('Diastolique invalide (30-200)'),
    body('mesures.*.pouls')
      .optional()
      .isInt({ min: 30, max: 250 })
      .withMessage('Pouls invalide (30-250)'),
  ],
  validate,
  MesureController.synchroniser
);

// GET /api/mesures — lister les mesures
router.get(
  '/',
  authorize('patient', 'cardiologue', 'administrateur'),
  MesureController.lister
);

// GET /api/mesures/statistiques — statistiques
router.get(
  '/statistiques',
  authorize('patient', 'cardiologue'),
  MesureController.statistiques
);

// GET /api/mesures/cardiologue — mesures des patients assignés
router.get(
  '/cardiologue',
  authorize('cardiologue'),
  MesureController.cardiologueMesures
);

// DELETE /api/mesures/tout — tout l'historique (patient)
router.delete(
  '/tout',
  authorize('patient'),
  MesureController.supprimerToutes
);

// GET /api/mesures/:id — détail d'une mesure
router.get(
  '/:id',
  authorize('patient', 'cardiologue'),
  MesureController.detail
);

// PATCH /api/mesures/alertes/:id/resoudre
router.patch(
  '/alertes/:id/resoudre',
  authorize('cardiologue', 'administrateur'),
  MesureController.resoudreAlerte
);

// DELETE /api/mesures/:id — supprimer
router.delete(
  '/:id',
  authorize('patient'),
  MesureController.supprimer
);

export default router;