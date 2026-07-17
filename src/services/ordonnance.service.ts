import OrdonnanceModel, { CreateOrdonnanceDTO } from '../models/ordonnance.model';
import NotificationModel from '../models/notification.model';
import { envoyerPushAUtilisateur } from '../config/firebase';

const OrdonnanceService = {

  async creer(data: CreateOrdonnanceDTO) {
    if (!data.lignes || data.lignes.length === 0)
      throw new Error('Une ordonnance doit contenir au moins un médicament');

    const id = await OrdonnanceModel.create(data);
    const ordonnance = await OrdonnanceModel.findById(id);
    const lignes     = await OrdonnanceModel.getLignes(id);

    // Notifier le patient
    NotificationModel.creer({
      utilisateur_id: data.patient_id,
      titre:   '📋 Nouvelle ordonnance disponible',
      contenu: 'Votre médecin vient de créer une nouvelle ordonnance. Consultez-la dans la section Ordonnances.',
      type:    'info',
      lien:    `/ordonnances`,
    }).catch(() => {});

    // Push au patient
    envoyerPushAUtilisateur(
      data.patient_id,
      '📋 Nouvelle ordonnance',
      'Votre médecin vient de créer une nouvelle ordonnance.',
      { type: 'ordonnance', screen: 'Ordonnances' }
    ).catch(() => {});

    return { ...ordonnance, lignes };
  },

  async detail(id: number) {
    const ordonnance = await OrdonnanceModel.findById(id);
    if (!ordonnance) throw new Error('Ordonnance introuvable');
    const lignes = await OrdonnanceModel.getLignes(id);
    return { ...ordonnance, lignes };
  },

  async listPatient(patient_id: number) {
    const ordonnances = await OrdonnanceModel.findByPatient(patient_id);
    return ordonnances;
  },

  async listCardiologue(medecin_id: number) {
    return OrdonnanceModel.findByMedecin(medecin_id);
  },

  async listInfirmier() {
    return OrdonnanceModel.findActives();
  },

  async annuler(id: number) {
    const ordo = await OrdonnanceModel.findById(id);
    if (!ordo) throw new Error('Ordonnance introuvable');
    await OrdonnanceModel.updateStatut(id, 'annulee');
    return { message: 'Ordonnance annulée' };
  },

  async supprimerPourPatient(id: number, patient_id: number) {
    const ok = await OrdonnanceModel.deleteForPatient(id, patient_id);
    if (!ok) throw new Error('Ordonnance introuvable ou accès refusé');
    return { message: 'Ordonnance supprimée de votre espace' };
  },

  async supprimerToutesPourPatient(patient_id: number) {
    const n = await OrdonnanceModel.deleteAllForPatient(patient_id);
    return { message: `${n} ordonnance(s) supprimée(s)`, count: n };
  },
};

export default OrdonnanceService;