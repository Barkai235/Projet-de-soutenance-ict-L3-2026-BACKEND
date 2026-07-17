import RappelModel, { CreateRappelDTO } from '../models/rappel.model';

const RappelService = {

  async creer(data: CreateRappelDTO) {
    const id     = await RappelModel.create(data);
    const rappel = await RappelModel.findById(id);
    return rappel;
  },

  async lister(patient_id: number) {
    return RappelModel.findByPatient(patient_id);
  },

  async toggleActif(id: number, patient_id: number) {
    const nouvelEtat = await RappelModel.toggleActif(id, patient_id);
    return {
      est_actif: nouvelEtat,
      message:   nouvelEtat ? 'Rappel activé' : 'Rappel désactivé',
    };
  },

  async supprimer(id: number, patient_id: number) {
    const ok = await RappelModel.delete(id, patient_id);
    if (!ok) throw new Error('Rappel introuvable ou non autorisé');
    return { message: 'Rappel supprimé' };
  },

  async supprimerTous(patient_id: number) {
    const { rappels } = await RappelModel.deleteAllByPatient(patient_id);
    return { message: `${rappels} rappel(s) supprimé(s)`, count: rappels };
  },

  async enregistrerPrise(data: {
    rappel_id:  number;
    patient_id: number;
    statut:     'pris' | 'oublie' | 'reporte';
  }) {
    const id = await RappelModel.enregistrerPrise({
      ...data,
      date_prise: new Date().toISOString().slice(0, 19).replace('T', ' '),
    });
    return { id, message: `Médicament marqué comme "${data.statut}"` };
  },

  async getJournal(patient_id: number, jours = 7) {
    const [prises, stats] = await Promise.all([
      RappelModel.getPrises(patient_id, jours),
      RappelModel.getStatsPrises(patient_id),
    ]);
    return { prises, stats };
  },
};

export default RappelService;