import pool from '../config/database';
import type { RowDataPacket } from 'mysql2';

let cacheAccepteNouvellesDemandes: boolean | null = null;

/** À appeler après une migration qui ajoute la colonne (évite un cache obsolète). */
export function invalidateProfilsCardiologuesColumnCache(): void {
  cacheAccepteNouvellesDemandes = null;
}

/**
 * Indique si `profils_cardiologues.accepte_nouvelles_demandes` existe.
 * Permet de faire tourner l’API sur d’anciennes bases sans migration manuelle.
 */
export async function profilsCardiologuesHasAccepteNouvellesDemandes(): Promise<boolean> {
  if (cacheAccepteNouvellesDemandes !== null) return cacheAccepteNouvellesDemandes;
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT 1 AS ok
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'profils_cardiologues'
         AND COLUMN_NAME = 'accepte_nouvelles_demandes'
       LIMIT 1`
    );
    cacheAccepteNouvellesDemandes = rows.length > 0;
  } catch {
    cacheAccepteNouvellesDemandes = false;
  }
  return cacheAccepteNouvellesDemandes;
}
