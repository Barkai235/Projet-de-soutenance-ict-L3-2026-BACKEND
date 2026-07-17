import pool from '../config/database';
import { RowDataPacket } from 'mysql2';
import { envoyerPushAUtilisateur } from '../config/firebase';
import TelemedicineModel from '../models/telemedicine.model';
import { envoyerSMSAuPatient } from './sms.service';

interface RappelDu extends RowDataPacket {
  patient_id:     number;
  medicament_nom: string;
  dosage:         string;
  heure_rappel:   string;
}

export const demarrerScheduler = (): void => {

  setInterval(async () => {
    try {
      // ── Rappels médicaments ─────────────────────────────────
      const now  = new Date();
      const hhmm = now.toTimeString().slice(0, 5);
      const jour = String(now.getDay());

      const [rappels] = await pool.execute<RappelDu[]>(
        `SELECT r.patient_id, m.nom AS medicament_nom, m.dosage, r.heure_rappel
         FROM rappels_medicaments r
         JOIN medicaments m ON m.id = r.medicament_id
         WHERE r.est_actif = 1
           AND r.heure_rappel = ?
           AND (r.jours_semaine IS NULL OR r.jours_semaine = ''
                OR FIND_IN_SET(?, r.jours_semaine) > 0)`,
        [hhmm, jour]
      );

      for (const r of rappels) {
        envoyerPushAUtilisateur(
          r.patient_id,
          '⏰ Rappel médicament',
          `Prenez votre ${r.medicament_nom}${r.dosage ? ` ${r.dosage}` : ''} maintenant.`,
          { type: 'rappel', screen: 'Rappels' }
        ).catch(() => {});
        envoyerSMSAuPatient(
          r.patient_id,
          `Rappel HyperTrack: prenez votre ${r.medicament_nom}${r.dosage ? ` ${r.dosage}` : ''}.`
        ).catch(() => {});
      }

      // ── RDV imminents (dans 30 min) ─────────────────────────
      const rdvs = await TelemedicineModel.listerImminents();
      for (const rdv of rdvs) {
        const msgPatient = `Votre consultation avec Dr. ${rdv.medecin_prenom} ${rdv.medecin_nom} commence bientôt.`;
        const msgSms = `Rappel HyperTrack: votre RDV avec Dr. ${rdv.medecin_prenom} ${rdv.medecin_nom} est dans 30 minutes.`;
        const msgCardio = `${rdv.patient_prenom} ${rdv.patient_nom} — RDV imminent.`;

        envoyerPushAUtilisateur(
          rdv.patient_id,
          '⏰ RDV dans 30 minutes !',
          msgPatient,
          { type: 'rdv_imminent', rdv_id: String(rdv.id), screen: 'Telemedecin' }
        ).catch(() => {});
        envoyerSMSAuPatient(rdv.patient_id, msgSms).catch(() => {});

        envoyerPushAUtilisateur(
          rdv.medecin_id,
          '⏰ Consultation dans 30 minutes',
          msgCardio,
          { type: 'rdv_imminent', rdv_id: String(rdv.id), screen: 'RendezVous' }
        ).catch(() => {});
      }

    } catch { /* non bloquant */ }
  }, 60_000);

  console.log('✅ Scheduler démarré (rappels médicaments + RDV imminents)');
};
