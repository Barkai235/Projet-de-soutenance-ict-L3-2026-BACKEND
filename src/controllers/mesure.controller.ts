import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import MesureService from '../services/mesure.service';
import AssignationModel from '../models/assignation.model';
import { sendSuccess, sendError } from '../utils/response.utils';

const MesureController = {

  // POST /api/mesures
  async ajouter(req: AuthRequest, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const patient_id = user.role === 'patient'
        ? req.user!.id
        : Number(req.body.patient_id);

      if (!patient_id) {
        sendError(res, 'patient_id requis', 400);
        return;
      }

      if (user.role === 'cardiologue') {
        const estPatientAssigne = await AssignationModel.estPatientDuCardiologue(patient_id, user.id);
        if (!estPatientAssigne) {
          sendError(res, 'Accès refusé : patient non assigné', 403);
          return;
        }
      }

      const result = await MesureService.ajouterMesure({
        ...req.body,
        patient_id,
        prise_par: user.role !== 'patient' ? user.id : undefined,
      });

      sendSuccess(res, 'Mesure enregistrée', result, 201);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur serveur';
      sendError(res, msg);
    }
  },

  // POST /api/mesures/sync — file d’attente mobile hors ligne
  async synchroniser(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (req.user!.role !== 'patient') {
        sendError(res, 'Synchronisation réservée aux patients', 403);
        return;
      }
      const mesures = req.body.mesures as unknown;
      if (!Array.isArray(mesures) || mesures.length === 0) {
        sendError(res, 'Le corps doit contenir un tableau mesures non vide', 400);
        return;
      }

      const rows = mesures.map((m: Record<string, unknown>) => ({
        systolique:  Number(m.systolique),
        diastolique: Number(m.diastolique),
        pouls:       m.pouls !== undefined && m.pouls !== ''
          ? Number(m.pouls)
          : undefined,
        bras:        m.bras != null ? String(m.bras) : undefined,
        position:    m.position != null ? String(m.position) : undefined,
        contexte:    m.contexte != null ? String(m.contexte) : undefined,
        note:        m.note != null ? String(m.note) : undefined,
        date_mesure:
          m.date_mesure != null ? String(m.date_mesure) : undefined,
      }));

      const results = await MesureService.synchroniserMesuresPatient(
        req.user!.id,
        rows
      );

      sendSuccess(
        res,
        `${results.length} mesure(s) synchronisée(s)`,
        {
          count:   results.length,
          mesures: results.map(r => r.mesure),
        },
        201
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur serveur';
      sendError(res, msg);
    }
  },

  // GET /api/mesures
  async lister(req: AuthRequest, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const role = user.role;

      // Cardiologue sans patient_id -> retourne les mesures de ses patients assignés
      if (role === 'cardiologue' && !req.query.patient_id) {
        const mesures = await MesureService.getMesuresMedecin(user.id);
        sendSuccess(res, 'Mesures récupérées', { mesures, total: mesures.length });
        return;
      }

      const patient_id = role === 'patient'
        ? user.id
        : Number(req.query.patient_id);

      if (!patient_id) {
        sendError(res, 'patient_id requis', 400);
        return;
      }

      if (role === 'cardiologue') {
        const estPatientAssigne = await AssignationModel.estPatientDuCardiologue(patient_id, user.id);
        if (!estPatientAssigne) {
          sendError(res, 'Accès refusé : patient non assigné', 403);
          return;
        }
      }

      const filtres = {
        patient_id,
        statut:     req.query.statut     as string | undefined,
        date_debut: req.query.date_debut as string | undefined,
        date_fin:   req.query.date_fin   as string | undefined,
        limit:      req.query.limit  ? Number(req.query.limit)  : 50,
        offset:     req.query.offset ? Number(req.query.offset) : 0,
      };

      const result = await MesureService.getMesures(filtres);
      sendSuccess(res, 'Mesures récupérées', result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur serveur';
      sendError(res, msg);
    }
  },

  // GET /api/mesures/statistiques
  async statistiques(req: AuthRequest, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const role = user.role;

      // Cardiologue sans patient_id -> statistiques vides (pas de patient sélectionné)
      if (role === 'cardiologue' && !req.query.patient_id) {
        sendSuccess(res, 'Statistiques récupérées', {
          moyenne_systolique:  null,
          moyenne_diastolique: null,
          moyenne_pouls:       null,
          max_systolique:      null,
          min_systolique:      null,
          total_mesures:       0,
          repartition_statuts: [],
          derniere_mesure:     null,
        });
        return;
      }

      const patient_id = role === 'patient'
        ? user.id
        : Number(req.query.patient_id);

      if (!patient_id) {
        sendError(res, 'patient_id requis', 400);
        return;
      }

      if (role === 'cardiologue') {
        const estPatientAssigne = await AssignationModel.estPatientDuCardiologue(patient_id, user.id);
        if (!estPatientAssigne) {
          sendError(res, 'Accès refusé : patient non assigné', 403);
          return;
        }
      }

      const result = await MesureService.getStatistiques(patient_id);
      sendSuccess(res, 'Statistiques récupérées', result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur serveur';
      sendError(res, msg);
    }
  },

  // GET /api/mesures/:id
  async detail(req: AuthRequest, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const mesure = await MesureService.getMesureById(Number(req.params.id));

      if (user.role === 'patient' && mesure.patient_id !== user.id) {
        sendError(res, 'Accès refusé', 403);
        return;
      }

      if (user.role === 'cardiologue') {
        const estPatientAssigne = await AssignationModel.estPatientDuCardiologue(mesure.patient_id, user.id);
        if (!estPatientAssigne) {
          sendError(res, 'Accès refusé', 403);
          return;
        }
      }

      sendSuccess(res, 'Mesure récupérée', mesure);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur serveur';
      sendError(res, msg, 404);
    }
  },

  // DELETE /api/mesures/tout — supprimer tout l'historique patient
  async supprimerToutes(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (req.user!.role !== 'patient') {
        sendError(res, 'Réservé au patient', 403);
        return;
      }
      const result = await MesureService.supprimerToutesMesures(req.user!.id);
      sendSuccess(res, result.message, { count: result.count });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur serveur';
      sendError(res, msg);
    }
  },

  // DELETE /api/mesures/:id
  async supprimer(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (req.user!.role === 'administrateur') {
        sendError(res, 'Suppression réservée au patient propriétaire', 403);
        return;
      }
      const result = await MesureService.supprimerMesure(
        Number(req.params.id),
        req.user!.id
      );
      sendSuccess(res, result.message, null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur serveur';
      sendError(res, msg, 404);
    }
  },

  // GET /api/mesures/cardiologue (cardiologue voit ses patients)
  async cardiologueMesures(req: AuthRequest, res: Response): Promise<void> {
    try {
      const mesures = await MesureService.getMesuresMedecin(req.user!.id);
      sendSuccess(res, 'Mesures patients récupérées', mesures);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur serveur';
      sendError(res, msg);
    }
  },

  // PATCH /api/mesures/alertes/:id/resoudre
  async resoudreAlerte(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await MesureService.resoudreAlerte(
        Number(req.params.id),
        req.user!.id,
        req.user!.role
      );
      sendSuccess(res, result.message, null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur serveur';
      sendError(res, msg, msg.includes('introuvable') || msg.includes('accès refusé') ? 404 : 500);
    }
  },
};

export default MesureController;