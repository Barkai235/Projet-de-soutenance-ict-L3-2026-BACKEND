import { Router } from 'express';
import { body }   from 'express-validator';
import ProfilController from '../controllers/profil.controller';
import { validate }     from '../middlewares/validation.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import { uploadPhoto }  from '../config/multer';

const router = Router();
router.use(authenticate);

// GET  /api/profil — voir son profil
router.get('/', ProfilController.getProfil);

// PUT  /api/profil — modifier son profil
router.put('/', ProfilController.updateProfil);

// POST /api/profil/photo — uploader photo
router.post(
  '/photo',
  uploadPhoto.single('photo'),
  ProfilController.uploadPhoto
);

// PUT  /api/profil/parametres — modifier paramètres
router.put('/parametres', ProfilController.updateParametres);

// POST /api/profil/fcm-token — enregistrer token push Firebase
router.post('/fcm-token', ProfilController.saveFcmToken);

// GET /api/profil/cardiologues — liste tous les cardiologues actifs
router.get('/cardiologues', ProfilController.listerCardiologues);

// POST /api/profil/desactiver-compte — patient : désactive définitivement la connexion
router.post('/desactiver-compte', ProfilController.desactiverCompte);

// PUT  /api/profil/mot-de-passe — changer mot de passe
router.put(
  '/mot-de-passe',
  [
    body('ancien_mot_de_passe').notEmpty().withMessage('Ancien mot de passe requis'),
    body('nouveau_mot_de_passe')
      .isLength({ min: 8 })
      .withMessage('Minimum 8 caractères'),
  ],
  validate,
  ProfilController.changerMotDePasse
);

export default router;