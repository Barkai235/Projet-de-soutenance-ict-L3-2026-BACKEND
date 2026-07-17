import pool from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import type { PoolConnection } from 'mysql2/promise';

export interface Disponibilite {
  jour_semaine: number; // 1=Lun … 7=Dim
  heure_debut:  string; // 'HH:MM'
  heure_fin:    string;
  est_actif:    boolean;
}

const JOUR_LIBELLES = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

function minutesDepuisMinuit(t: string): number {
  const [h, min, s] = t.split(':').map(Number);
  return h * 60 + min + (s || 0) / 60;
}

/** Met à jour le résumé visible côté patient (liste cardiologues / profil). */
async function syncProfilConsultationResume(
  conn: PoolConnection,
  medecin_id: number,
  slots: Disponibilite[]
): Promise<void> {
  const actifs = slots.filter(s => s.est_actif);
  if (actifs.length === 0) {
    await conn.execute(
      `UPDATE profils_cardiologues
       SET jours_consultation = NULL,
           heure_debut = NULL,
           heure_fin = NULL
       WHERE utilisateur_id = ?`,
      [medecin_id]
    );
    return;
  }
  const joursIdx = [...new Set(actifs.map(s => s.jour_semaine))].sort((a, b) => a - b);
  const joursStr = joursIdx.map(j => JOUR_LIBELLES[j] ?? `Jour ${j}`).join(', ');
  let minDebut = actifs[0].heure_debut;
  let maxFin = actifs[0].heure_fin;
  for (const s of actifs) {
    if (minutesDepuisMinuit(s.heure_debut) < minutesDepuisMinuit(minDebut)) minDebut = s.heure_debut;
    if (minutesDepuisMinuit(s.heure_fin) > minutesDepuisMinuit(maxFin)) maxFin = s.heure_fin;
  }
  await conn.execute(
    `UPDATE profils_cardiologues
     SET jours_consultation = ?,
         heure_debut = ?,
         heure_fin = ?
     WHERE utilisateur_id = ?`,
    [joursStr, minDebut, maxFin, medecin_id]
  );
}

const DisponibilitesModel = {

  async listerPourMedecin(medecin_id: number): Promise<RowDataPacket[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, jour_semaine, heure_debut, heure_fin, est_actif
       FROM disponibilites_medecin
       WHERE medecin_id = ?
       ORDER BY jour_semaine ASC, heure_debut ASC`,
      [medecin_id]
    );
    return rows;
  },

  async remplacer(medecin_id: number, slots: Disponibilite[]): Promise<void> {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute(
        `DELETE FROM disponibilites_medecin WHERE medecin_id = ?`,
        [medecin_id]
      );
      for (const s of slots) {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO disponibilites_medecin
             (medecin_id, jour_semaine, heure_debut, heure_fin, est_actif)
           VALUES (?, ?, ?, ?, ?)`,
          [medecin_id, s.jour_semaine, s.heure_debut, s.heure_fin, s.est_actif ? 1 : 0]
        );
      }
      await conn.commit();
      await syncProfilConsultationResume(conn, medecin_id, slots);
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  },
};

export default DisponibilitesModel;
