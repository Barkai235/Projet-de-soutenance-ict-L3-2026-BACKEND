import { Response }    from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import PatientsModel   from '../models/patients.model';
import { sendSuccess, sendError } from '../utils/response.utils';

const PatientsController = {

  async listerTousPatients(req: AuthRequest, res: Response): Promise<void> {
    try {
      const patients = await PatientsModel.listerTousPatients(req.user!.id);
      sendSuccess(res, 'Tous les patients récupérés', patients);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  async listerMesPatients(req: AuthRequest, res: Response): Promise<void> {
    try {
      const patients = await PatientsModel.listerPourMedecin(req.user!.id);
      sendSuccess(res, 'Patients récupérés', patients);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  async getDossierPatient(req: AuthRequest, res: Response): Promise<void> {
    try {
      const patientId = Number(req.params.id);
      const dossier   = await PatientsModel.getDossierPatient(patientId, req.user!.id);

      if (!dossier.profil) {
        sendError(res, 'Patient introuvable', 404);
        return;
      }

      sendSuccess(res, 'Dossier patient récupéré', dossier);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  async mettreAJourDossierClinique(req: AuthRequest, res: Response): Promise<void> {
    try {
      const patientId = Number(req.params.id);
      const {
        organes_cibles_atteints,
        type_hypertension,
        complications_cliniques,
        ta_cible_texte,
      } = req.body ?? {};

      const ok = await PatientsModel.updateDossierClinique(patientId, req.user!.id, {
        organes_cibles_atteints: organes_cibles_atteints ?? null,
        type_hypertension:       type_hypertension ?? null,
        complications_cliniques: complications_cliniques ?? null,
        ta_cible_texte:          ta_cible_texte ?? null,
      });

      if (!ok) {
        sendError(res, 'Patient non assigné ou introuvable', 404);
        return;
      }

      const dossier = await PatientsModel.getDossierPatient(patientId, req.user!.id);
      sendSuccess(res, 'Dossier clinique mis à jour', dossier.profil);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },
};

export default PatientsController;
