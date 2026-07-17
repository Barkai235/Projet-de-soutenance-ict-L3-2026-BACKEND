import DashboardModel from '../models/dashboard.model';

const DashboardService = {

  async getDashboardPatient(patient_id: number) {
    const [stats, moyennes30j, moyennes7j, rappelsDuJour, alertes] =
      await Promise.all([
        DashboardModel.getStatsPatient(patient_id),
        DashboardModel.getMoyennesPatient(patient_id, 30),
        DashboardModel.getMoyennesPatient(patient_id, 7),
        DashboardModel.getRappelsDuJour(patient_id),
        DashboardModel.getAlertesPatientsActives(patient_id),
      ]);

    return { stats, moyennes30j, moyennes7j, rappelsDuJour, alertes };
  },

  async getDashboardCardiologue(medecin_id: number) {
    const [stats, patientsEnAlerte, mesPatientsListe] = await Promise.all([
      DashboardModel.getStatsMedecin(medecin_id),
      DashboardModel.getPatientsEnAlerte(medecin_id),
      DashboardModel.getMesPatients(medecin_id),
    ]);
    return { stats, patientsEnAlerte, mesPatientsListe };
  },

  async getDashboardAdmin() {
    const [stats, activiteGlobale, repartitionRoles] = await Promise.all([
      DashboardModel.getStatsAdmin(),
      DashboardModel.getActiviteGlobale(),
      DashboardModel.getRepartitionRoles(),
    ]);
    return { stats, activiteGlobale, repartitionRoles };
  },
};

export default DashboardService;