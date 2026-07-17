import MessageModel      from '../models/message.model';
import NotificationModel from '../models/notification.model';
import UserModel         from '../models/user.model';
import type { User }     from '../models/user.model';
import AssignationModel  from '../models/assignation.model';
import { envoyerPushAUtilisateur } from '../config/firebase';

/** Patient ↔ cardiologue assigné uniquement ; pas d’accès aux fils des autres. */
async function assertMessageriePermise(
  expediteurId: number,
  expediteurRole: string,
  destinataire: User
): Promise<void> {
  if (expediteurRole !== 'patient' && expediteurRole !== 'cardiologue') {
    throw new Error('La messagerie n\'est pas disponible pour votre rôle.');
  }
  if (expediteurRole === 'patient') {
    if (destinataire.role_nom !== 'cardiologue') {
      throw new Error('Vous ne pouvez échanger des messages qu\'avec votre cardiologue.');
    }
    const ok = await AssignationModel.estPatientDuCardiologue(expediteurId, destinataire.id);
    if (!ok) {
      throw new Error('Vous ne pouvez contacter que le cardiologue qui vous suit.');
    }
  } else {
    if (destinataire.role_nom !== 'patient') {
      throw new Error('Vous ne pouvez échanger des messages qu\'avec vos patients.');
    }
    const ok = await AssignationModel.estPatientDuCardiologue(destinataire.id, expediteurId);
    if (!ok) {
      throw new Error('Ce patient n\'est pas assigné à votre dossier.');
    }
  }
}

async function assertConversationPermise(
  userId: number,
  userRole: string,
  interlocuteurId: number
): Promise<void> {
  const other = await UserModel.findById(interlocuteurId);
  if (!other) throw new Error('Interlocuteur introuvable');
  await assertMessageriePermise(userId, userRole, other);
}

async function idsExpediteursAutorises(
  userId: number,
  userRole: string
): Promise<number[]> {
  if (userRole === 'patient') {
    const mid = await AssignationModel.getMedecinIdPatient(userId);
    return mid != null ? [mid] : [];
  }
  if (userRole === 'cardiologue') {
    return AssignationModel.listerPatientIdsDuCardiologue(userId);
  }
  return [];
}

const MessageService = {

  async envoyer(data: {
    expediteur_id:   number;
    expediteur_role: string;
    destinataire_id: number;
    contenu:         string;
    piece_jointe?:   string;
  }) {
    const destinataire = await UserModel.findById(data.destinataire_id);
    if (!destinataire) throw new Error('Destinataire introuvable');

    if (data.expediteur_id === data.destinataire_id) {
      throw new Error('Vous ne pouvez pas vous envoyer un message');
    }

    await assertMessageriePermise(
      data.expediteur_id,
      data.expediteur_role,
      destinataire
    );

    const id = await MessageModel.envoyer({
      expediteur_id:   data.expediteur_id,
      destinataire_id: data.destinataire_id,
      contenu:         data.contenu,
      piece_jointe:    data.piece_jointe,
    });
    const message = await MessageModel.findById(id);

    NotificationModel.creer({
      utilisateur_id: data.destinataire_id,
      titre:   `💬 Nouveau message de ${message?.expediteur_prenom} ${message?.expediteur_nom}`,
      contenu:  data.contenu.length > 80
        ? data.contenu.slice(0, 80) + '...'
        : data.contenu,
      type: 'message',
      lien: `/messages?avec=${data.expediteur_id}`,
    }).catch(err => console.warn('Notif message non créée :', err.message));

    envoyerPushAUtilisateur(
      data.destinataire_id,
      `💬 ${message?.expediteur_prenom} ${message?.expediteur_nom}`,
      data.contenu.length > 80 ? data.contenu.slice(0, 80) + '...' : data.contenu,
      { type: 'message', screen: 'Messages' }
    ).catch(() => {});

    return message;
  },

  async getConversation(userId: number, userRole: string, interlocuteurId: number) {
    await assertConversationPermise(userId, userRole, interlocuteurId);

    await MessageModel.marquerLus(interlocuteurId, userId);
    return MessageModel.getConversation(userId, interlocuteurId);
  },

  async getConversations(userId: number, userRole: string) {
    const conversations = await MessageModel.getConversations(userId);
    const autorises: typeof conversations = [];

    for (const c of conversations) {
      const other = await UserModel.findById(c.interlocuteur_id);
      if (!other) continue;
      try {
        await assertMessageriePermise(userId, userRole, other);
        autorises.push(c);
      } catch {
        /* anciennes données hors lien d’assignation : masquées */
      }
    }

    const expediteursOk = await idsExpediteursAutorises(userId, userRole);
    const nonLus = await MessageModel.countNonLusDepuisExpediteurs(userId, expediteursOk);

    return { conversations: autorises, total_non_lus: nonLus };
  },

  async countNonLus(userId: number, userRole: string) {
    const expediteursOk = await idsExpediteursAutorises(userId, userRole);
    return MessageModel.countNonLusDepuisExpediteurs(userId, expediteursOk);
  },

  async rechercherParEmail(email: string, demandeurId: number, demandeurRole: string) {
    const user = await UserModel.findByEmail(email);
    if (!user) throw new Error('Aucun utilisateur trouvé avec cet email');
    if (user.id === demandeurId) throw new Error('Vous ne pouvez pas vous envoyer un message');
    await assertMessageriePermise(demandeurId, demandeurRole, user);
    return {
      id:     user.id,
      nom:    user.nom,
      prenom: user.prenom,
      role:   user.role_nom,
      email:  user.email,
    };
  },

  async supprimerMessage(id: number, userId: number) {
    const ok = await MessageModel.supprimerMessage(id, userId);
    if (!ok) throw new Error('Message introuvable ou accès refusé');
    return { message: 'Message supprimé' };
  },

  async supprimerFil(userId: number, userRole: string, interlocuteurId: number) {
    await assertConversationPermise(userId, userRole, interlocuteurId);
    const n = await MessageModel.supprimerFil(userId, interlocuteurId);
    return { message: `${n} message(s) supprimé(s)`, count: n };
  },

  async supprimerTout(userId: number, userRole: string) {
    const ids = await idsExpediteursAutorises(userId, userRole);
    if (ids.length === 0) {
      return { message: '0 message(s) supprimé(s)', count: 0 };
    }
    let total = 0;
    for (const autre of ids) {
      total += await MessageModel.supprimerFil(userId, autre);
    }
    return { message: `${total} message(s) supprimé(s)`, count: total };
  },
};

export default MessageService;
