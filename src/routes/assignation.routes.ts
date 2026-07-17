import { Router } from 'express';
import AssignationController from '../controllers/assignation.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();
router.use(authenticate);

// ── Routes PATIENT ──────────────────────────────────────────
// GET  /api/assignation/cardiologues     — liste (filtres: ?ville=&disponible=1)
router.get('/cardiologues',    authorize('patient'), AssignationController.listerCardiologues);
// GET  /api/assignation/cardiologues/:id — fiche publique pour le patient
router.get('/cardiologues/:id', authorize('patient'), AssignationController.detailCardiologue);

// GET  /api/assignation/mon-cardiologue  — mon cardiologue actuel
router.get('/mon-cardiologue', authorize('patient'), AssignationController.monCardiologue);

// GET  /api/assignation/mes-demandes     — historique de mes demandes
router.get('/mes-demandes',    authorize('patient'), AssignationController.mesDemandes);

// POST /api/assignation/demandes         — envoyer une demande
router.post('/demandes',       authorize('patient'), AssignationController.envoyerDemande);
// PATCH /api/assignation/demandes/:id/annuler — annuler sa demande en attente
router.patch('/demandes/:id/annuler', authorize('patient'), AssignationController.annulerDemande);

// ── Routes CARDIOLOGUE ──────────────────────────────────────
// GET  /api/assignation/ma-capacite-patients     — quota / places restantes
router.get(
  '/ma-capacite-patients',
  authorize('cardiologue'),
  AssignationController.maCapacitePatients
);

// GET  /api/assignation/demandes                  — demandes reçues en attente
router.get('/demandes',                   authorize('cardiologue'), AssignationController.demandesCardiologue);

// PATCH /api/assignation/demandes/:id/accepter
router.patch('/demandes/:id/accepter',    authorize('cardiologue'), AssignationController.accepterDemande);

// PATCH /api/assignation/demandes/:id/refuser
router.patch('/demandes/:id/refuser',     authorize('cardiologue'), AssignationController.refuserDemande);

// PATCH /api/assignation/patients/:id/fin-suivi
router.patch('/patients/:id/fin-suivi',   authorize('cardiologue'), AssignationController.finSuivi);
// PATCH /api/assignation/mon-suivi/fin
router.patch('/mon-suivi/fin',            authorize('patient'),     AssignationController.finMonSuivi);

export default router;
