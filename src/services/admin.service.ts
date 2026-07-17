import AdminModel        from '../models/admin.model';
import UserModel         from '../models/user.model';
import NotificationModel from '../models/notification.model';
import { hashPassword }  from '../utils/password.utils';
import { sendCardiologueValidationEmail } from '../utils/email.utils';
import { v4 as uuidv4 } from 'uuid';

const AdminService = {

  async getUtilisateurs(params: {
    role?:   string;
    search?: string;
    actif?:  string;
    limit?:  number;
    offset?: number;
  }) {
    const actif = params.actif === 'true'
      ? true : params.actif === 'false'
      ? false : undefined;

    const [users, total] = await Promise.all([
      AdminModel.getAllUsers(
        params.role, params.search, actif,
        params.limit ?? 50, params.offset ?? 0
      ),
      AdminModel.countUsers(params.role, params.search, actif),
    ]);
    return { users, total };
  },

  async toggleActif(userId: number) {
    const nouvelEtat = await AdminModel.toggleActif(userId);
    return {
      est_actif: nouvelEtat,
      message:   nouvelEtat ? 'Compte activé' : 'Compte désactivé',
    };
  },

  async deleteUser(userId: number, adminId: number) {
    if (userId === adminId)
      throw new Error('Impossible de supprimer son propre compte');
    await AdminModel.deleteUser(userId);
    return { message: 'Compte supprimé' };
  },

  async creerUtilisateur(data: {
    nom: string; prenom: string; email: string;
    mot_de_passe: string; telephone?: string;
    date_naissance?: string; sexe?: string; role: string;
  }) {
    const existing = await UserModel.findByEmail(data.email);
    if (existing) throw new Error('Cet email est déjà utilisé');

    const roleId = await UserModel.getRoleId(data.role);
    if (!roleId) throw new Error('Rôle invalide');

    const hash   = await hashPassword(data.mot_de_passe);
    const uuid   = uuidv4();

    const userId = await UserModel.create({
      uuid,
      nom:            data.nom,
      prenom:         data.prenom,
      email:          data.email,
      mot_de_passe:   hash,
      telephone:      data.telephone,
      date_naissance: data.date_naissance,
      sexe:           data.sexe,
      role_id:        roleId,
    });

    if (data.role === 'patient') {
      const numeroDossier = `PAT-${Date.now()}-${userId}`;
      await UserModel.createPatientProfile(userId, numeroDossier);
    }
    await UserModel.createDefaultParams(userId);

    return UserModel.findById(userId);
  },

  async assignerMedecin(patientId: number, medecinId: number) {
    await AdminModel.assignerMedecin(patientId, medecinId);

    // Notifier le médecin
    const patient = await UserModel.findById(patientId);
    if (patient) {
      NotificationModel.creer({
        utilisateur_id: medecinId,
        titre:   '👤 Nouveau patient assigné',
        contenu: `${patient.prenom} ${patient.nom} vous a été assigné comme médecin traitant.`,
        type:    'info',
        lien:    '/mesures',
      }).catch(() => {});
    }

    return { message: 'Médecin assigné avec succès' };
  },

  async getCardiologuesLegacyAlias() {
    return AdminModel.getCardiologuesLegacyAlias();
  },

  async getCardiologues() {
    return AdminModel.getCardiologues();
  },

  async getCardiologuesEnAttente() {
    return AdminModel.getCardiologuesEnAttente();
  },

  async traiterValidationCardiologue(
    cardiologueId: number,
    decision: 'accepte' | 'refuse',
    motifRefus?: string
  ) {
    const ok = await AdminModel.traiterValidationCardiologue(cardiologueId, decision);
    if (!ok) throw new Error('Cardiologue introuvable ou déjà traité');

    const user = await UserModel.findByIdIncludingInactive(cardiologueId);
    if (user) {
      sendCardiologueValidationEmail(
        user.email,
        user.prenom,
        decision,
        motifRefus
      ).catch(() => {});
    }

    return {
      message: decision === 'accepte'
        ? 'Inscription cardiologue validée'
        : 'Inscription cardiologue refusée',
    };
  },

  async assignerCardiologue(patientId: number, cardiologueId: number) {
    await AdminModel.assignerCardiologue(patientId, cardiologueId);
    // notification au cardiologue
    const patient = await UserModel.findById(patientId);
    if (patient) {
      NotificationModel.creer({
        utilisateur_id: cardiologueId,
        titre:   '👤 Nouveau patient assigné',
        contenu: `${patient.prenom} ${patient.nom} vous a été assigné comme cardiologue.`,
        type:    'info',
        lien:    '/mesures',
      }).catch(() => {});
    }
    return { message: 'Cardiologue assigné avec succès' };
  },

  async getAlertes(resolu?: string) {
    const r = resolu === 'true'
      ? true : resolu === 'false'
      ? false : undefined;
    return AdminModel.getAllAlertes(r);
  },

  async resoudreAlerte(id: number) {
    // Récupérer l'alerte avant de la résoudre pour notifier le patient
    const alertes = await AdminModel.getAllAlertes(false);
    const alerte  = alertes.find(a => a.id === id);

    await AdminModel.resoudreAlerte(id);

    if (alerte) {
      NotificationModel.creer({
        utilisateur_id: alerte.patient_id,
        titre:   '✅ Alerte résolue',
        contenu: 'Votre alerte hypertensive a été prise en charge et résolue par l\'équipe médicale.',
        type:    'info',
        lien:    '/dashboard',
      }).catch(() => {});
    }

    return { message: 'Alerte résolue' };
  },

  async getMedicaments() {
    return AdminModel.getAllMedicaments();
  },

  async creerMedicament(data: {
    nom: string; dci?: string; classe?: string;
    forme?: string; dosage?: string; description?: string;
  }) {
    if (!data.nom) throw new Error('Le nom est requis');
    const id = await AdminModel.createMedicament(data);
    return { id, message: 'Médicament créé' };
  },

  async deleteMedicament(id: number) {
    await AdminModel.deleteMedicament(id);
    return { message: 'Médicament supprimé' };
  },

  async getStatsAvancees() {
    const [stats, evolution] = await Promise.all([
      AdminModel.getStatsAvancees(),
      AdminModel.getEvolutionInscriptions(),
    ]);
    return { stats, evolution };
  },
};

export default AdminService;