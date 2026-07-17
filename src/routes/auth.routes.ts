import { Router } from 'express';
import { body } from 'express-validator';
import AuthController from '../controllers/auth.controller';
import { validate } from '../middlewares/validation.middleware';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// POST /api/auth/register
router.post(
  '/register',
  [
    body('nom').notEmpty().withMessage('Le nom est requis'),
    body('prenom').notEmpty().withMessage('Le prénom est requis'),
    body('email').isEmail().withMessage('Email invalide'),
    body('mot_de_passe')
      .isLength({ min: 8 })
      .withMessage('Mot de passe : 8 caractères minimum')
      .matches(/[A-Z]/)
      .withMessage('Mot de passe : au moins une majuscule requise')
      .matches(/[0-9]/)
      .withMessage('Mot de passe : au moins un chiffre requis'),
    body('role')
      .isIn(['patient', 'cardiologue'])
      .withMessage('Rôle invalide'),
    body('telephone')
      .if(body('role').equals('patient'))
      .notEmpty()
      .withMessage('Le numéro de téléphone est requis'),
    // Cardiologue — champs professionnels obligatoires
    body('specialite')
      .if(body('role').equals('cardiologue'))
      .notEmpty()
      .withMessage('La spécialité est requise'),
    body('titre')
      .if(body('role').equals('cardiologue'))
      .notEmpty()
      .withMessage('Le titre est requis'),
    body('annees_experience')
      .if(body('role').equals('cardiologue'))
      .isInt({ min: 0 })
      .withMessage('Les années d\'expérience doivent être un nombre entier'),
    body('structure_nom')
      .if(body('role').equals('cardiologue'))
      .notEmpty()
      .withMessage('Le nom de la structure d\'exercice est requis'),
    body('structure_type')
      .if(body('role').equals('cardiologue'))
      .notEmpty()
      .withMessage('Le type de structure est requis'),
    body('departement')
      .if(body('role').equals('cardiologue'))
      .notEmpty()
      .withMessage('Le département ou service est requis'),
    body('langues')
      .if(body('role').equals('cardiologue'))
      .notEmpty()
      .withMessage('Les langues parlées sont requises'),
    body('jours_consultation')
      .if(body('role').equals('cardiologue'))
      .notEmpty()
      .withMessage('Les jours de consultation sont requis'),
    body('heure_debut')
      .if(body('role').equals('cardiologue'))
      .notEmpty()
      .withMessage('L\'heure de début est requise'),
    body('heure_fin')
      .if(body('role').equals('cardiologue'))
      .notEmpty()
      .withMessage('L\'heure de fin est requise'),
    body('duree_consultation')
      .if(body('role').equals('cardiologue'))
      .isInt({ min: 1 })
      .withMessage('La durée par consultation est requise'),
    body('max_patients_jour')
      .if(body('role').equals('cardiologue'))
      .isInt({ min: 1 })
      .withMessage('Le nombre maximum de patients par jour est requis'),
    body('quota_patients')
      .if(body('role').equals('cardiologue'))
      .isInt({ min: 1 })
      .withMessage('Le quota de patients en suivi est requis'),
  ],
  validate,
  AuthController.register
);

// POST /api/auth/login
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Email invalide'),
    body('mot_de_passe').notEmpty().withMessage('Mot de passe requis'),
  ],
  validate,
  AuthController.login
);

// POST /api/auth/forgot-password
router.post(
  '/forgot-password',
  [body('email').isEmail().withMessage('Email invalide')],
  validate,
  AuthController.forgotPassword
);

// POST /api/auth/reset-password
router.post(
  '/reset-password',
  [
    body('token').notEmpty().withMessage('Token requis'),
    body('mot_de_passe')
      .isLength({ min: 8 })
      .withMessage('Mot de passe : 8 caractères minimum'),
  ],
  validate,
  AuthController.resetPassword
);

// GET /api/auth/me  (protégé)
router.get('/me', authenticate, AuthController.getMe);

export default router;
