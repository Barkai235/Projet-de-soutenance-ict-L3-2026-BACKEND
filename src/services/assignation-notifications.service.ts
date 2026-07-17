import NotificationModel from '../models/notification.model';
import UserModel         from '../models/user.model';
import AssignationModel  from '../models/assignation.model';
import { envoyerPushAUtilisateur } from '../config/firebase';
import {
  sendAssignationDemandePatientEmail,
  sendAssignationAccepteePatientEmail,
  sendAssignationRefuseePatientEmail,
  sendAssignationFinSuiviCardioVersPatientEmail,
} from '../utils/email.utils';

export async function notifierPatientDemandeEnregistree(
  patientId: number,
  cardioPrenom: string,
  cardioNom: string
): Promise<void> {
  const user = await UserModel.findByIdIncludingInactive(patientId);
  if (!user) return;

  await NotificationModel.creer({
    utilisateur_id: patientId,
    titre:   'Demande envoyée',
    contenu: `Votre demande de suivi auprès du Dr ${cardioPrenom} ${cardioNom} est en attente de réponse.`,
    type:    'info',
    lien:    '/mes-demandes',
  }).catch(() => {});

  await envoyerPushAUtilisateur(
    patientId,
    'Demande enregistrée',
    `En attente de réponse du Dr ${cardioPrenom} ${cardioNom}.`,
    { type: 'assignation', screen: 'MesDemandes' }
  ).catch(() => {});

  sendAssignationDemandePatientEmail(
    user.email,
    user.prenom,
    `${cardioPrenom} ${cardioNom}`
  ).catch(() => {});
}

export async function notifierApresAcceptation(
  patientId: number,
  cardioId: number
): Promise<void> {
  const patient = await UserModel.findByIdIncludingInactive(patientId);
  const cardio  = await UserModel.findByIdIncludingInactive(cardioId);
  if (!patient || !cardio) return;

  await NotificationModel.creer({
    utilisateur_id: patientId,
    titre:   '✅ Demande acceptée',
    contenu: `Le Dr ${cardio.prenom} ${cardio.nom} accepte de vous suivre. Messagerie et prise de rendez-vous sont disponibles.`,
    type:    'info',
    lien:    '/dashboard',
  }).catch(() => {});

  await envoyerPushAUtilisateur(
    patientId,
    'Suivi accepté',
    `Le Dr ${cardio.prenom} ${cardio.nom} vous prend en charge.`,
    { type: 'assignation', screen: 'Dashboard' }
  ).catch(() => {});

  sendAssignationAccepteePatientEmail(
    patient.email,
    patient.prenom,
    `${cardio.prenom} ${cardio.nom}`
  ).catch(() => {});

  await NotificationModel.creer({
    utilisateur_id: cardioId,
    titre:   'Patient ajouté à votre liste',
    contenu: `${patient.prenom} ${patient.nom} fait désormais partie de vos patients suivis.`,
    type:    'info',
    lien:    '/patients',
  }).catch(() => {});

  await envoyerPushAUtilisateur(
    cardioId,
    'Nouveau patient',
    `${patient.prenom} ${patient.nom} a été assigné à votre liste.`,
    { type: 'assignation', screen: 'Patients' }
  ).catch(() => {});

  const { nb, quota } = await AssignationModel.getNbPatientsEtQuota(cardioId);
  if (nb >= quota) {
    await NotificationModel.creer({
      utilisateur_id: cardioId,
      titre:   'Quota patients atteint',
      contenu: `Votre liste est complète (${nb}/${quota}). Votre profil apparaît comme non disponible pour de nouvelles demandes.`,
      type:    'info',
      lien:    '/profil',
    }).catch(() => {});
    await envoyerPushAUtilisateur(
      cardioId,
      'Quota complet',
      `Vous avez atteint votre quota de patients (${quota}).`,
      { type: 'assignation', screen: 'Profil' }
    ).catch(() => {});
  }
}

export async function notifierApresRefus(
  patientId: number,
  motifRefus: string,
  messageRefus?: string | null
): Promise<void> {
  const patient = await UserModel.findByIdIncludingInactive(patientId);
  if (!patient) return;

  await NotificationModel.creer({
    utilisateur_id: patientId,
    titre:   'Demande refusée',
    contenu: messageRefus
      ? `${messageRefus} Vous pouvez adresser une demande à un autre cardiologue.`
      : `Motif : ${motifRefus}. Vous pouvez adresser une demande à un autre cardiologue.`,
    type:    'info',
    lien:    '/trouver-cardiologue',
  }).catch(() => {});

  await envoyerPushAUtilisateur(
    patientId,
    'Demande refusée',
    'Consultez le détail et recherchez un autre cardiologue.',
    { type: 'assignation', screen: 'TrouverCardiologue' }
  ).catch(() => {});

  sendAssignationRefuseePatientEmail(
    patient.email,
    patient.prenom,
    motifRefus,
    messageRefus ?? undefined
  ).catch(() => {});
}

async function notifierQuotaPlaceLiberee(cardiologueId: number): Promise<void> {
  await NotificationModel.creer({
    utilisateur_id: cardiologueId,
    titre:   'Places disponibles',
    contenu: 'Une place s’est libérée dans votre quota : vous pouvez à nouveau recevoir des demandes.',
    type:    'info',
    lien:    '/demandes',
  }).catch(() => {});
  await envoyerPushAUtilisateur(
    cardiologueId,
    'Quota : place libérée',
    'Votre profil peut à nouveau apparaître comme disponible.',
    { type: 'assignation', screen: 'Demandes' }
  ).catch(() => {});
}

/** Appeler après `finSuivi` en base (patient retiré du cardiologue). */
export async function notifierFinSuiviParCardiologue(
  cardiologueId: number,
  patientId: number,
  motif?: string
): Promise<void> {
  const patient = await UserModel.findByIdIncludingInactive(patientId);
  if (!patient) return;

  const apres = await AssignationModel.getNbPatientsEtQuota(cardiologueId);
  const etaitComplet = (apres.nb + 1) >= apres.quota;

  await NotificationModel.creer({
    utilisateur_id: patientId,
    titre:   'Fin de suivi',
    contenu: motif
      ? `Votre cardiologue a mis fin au suivi. Motif : ${motif}`
      : 'Votre cardiologue a mis fin au suivi. Vous pouvez chercher un nouveau cardiologue.',
    type:    'info',
    lien:    '/trouver-cardiologue',
  }).catch(() => {});

  await envoyerPushAUtilisateur(
    patientId,
    'Fin de suivi',
    motif ?? 'Votre cardiologue a mis fin au suivi.',
    { type: 'assignation', screen: 'TrouverCardiologue' }
  ).catch(() => {});

  sendAssignationFinSuiviCardioVersPatientEmail(
    patient.email,
    patient.prenom,
    motif
  ).catch(() => {});

  if (etaitComplet && apres.nb < apres.quota) {
    await notifierQuotaPlaceLiberee(cardiologueId);
  }
}

/** Appeler après `finSuiviParPatient` en base. */
export async function notifierFinSuiviParPatient(
  cardioId: number,
  patientId: number
): Promise<void> {
  const cardio  = await UserModel.findByIdIncludingInactive(cardioId);
  const patient = await UserModel.findByIdIncludingInactive(patientId);
  if (!cardio || !patient) return;

  const apres = await AssignationModel.getNbPatientsEtQuota(cardioId);
  const etaitComplet = (apres.nb + 1) >= apres.quota;

  await NotificationModel.creer({
    utilisateur_id: patientId,
    titre:   'Suivi terminé',
    contenu: 'Vous avez mis fin au suivi. Vous pouvez chercher un nouveau cardiologue.',
    type:    'info',
    lien:    '/trouver-cardiologue',
  }).catch(() => {});

  await envoyerPushAUtilisateur(
    patientId,
    'Suivi terminé',
    'Recherchez un cardiologue lorsque vous le souhaitez.',
    { type: 'assignation', screen: 'TrouverCardiologue' }
  ).catch(() => {});

  await NotificationModel.creer({
    utilisateur_id: cardioId,
    titre:   'Patient a quitté le suivi',
    contenu: `${patient.prenom} ${patient.nom} a mis fin au suivi avec vous.`,
    type:    'info',
    lien:    '/patients',
  }).catch(() => {});

  await envoyerPushAUtilisateur(
    cardioId,
    'Fin de suivi',
    `${patient.prenom} ${patient.nom} a terminé le suivi.`,
    { type: 'assignation', screen: 'Patients' }
  ).catch(() => {});

  if (etaitComplet && apres.nb < apres.quota) {
    await notifierQuotaPlaceLiberee(cardioId);
  }
}

export async function notifierCardiologueNouvelleDemande(
  cardiologueId: number,
  urgenceLabel: string,
  motifApercu: string
): Promise<void> {
  await NotificationModel.creer({
    utilisateur_id: cardiologueId,
    titre:  `Nouvelle demande d'assignation (${urgenceLabel})`,
    contenu: `Un patient souhaite être suivi par vous. Motif : ${motifApercu.slice(0, 100)}`,
    type:   'info',
    lien:   '/demandes',
  }).catch(() => {});

  await envoyerPushAUtilisateur(
    cardiologueId,
    'Nouvelle demande de suivi',
    motifApercu.length > 80 ? `${motifApercu.slice(0, 80)}…` : motifApercu,
    { type: 'assignation', screen: 'Demandes' }
  ).catch(() => {});
}
