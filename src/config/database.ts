import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config({ override: true });

const pool = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT) || 3306,
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD && process.env.DB_PASSWORD.trim().length > 0
    ? process.env.DB_PASSWORD
    : 'mht1',
  database: process.env.DB_NAME     || 'hypertension_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+00:00',
});

export const testConnection = async (): Promise<boolean> => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Connexion MySQL réussie');
    connection.release();
    return true;
  } catch (error) {
    const strictDatabase = process.env.DB_REQUIRED
      ? process.env.DB_REQUIRED.toLowerCase() === 'true'
      : process.env.NODE_ENV === 'production';

    if (strictDatabase) {
      console.error('❌ Erreur de connexion MySQL :', error);
      process.exit(1);
    }
    console.warn('⚠️  MySQL indisponible: démarrage sans base (mettre DB_REQUIRED=true pour forcer l’arrêt).');
    return false;
  }
};

/**
 * Colonnes attendues par le code mais parfois absentes sur d’anciennes bases.
 * ALTER idempotent : ignoré si la colonne existe déjà (ER_DUP_FIELDNAME / 1060).
 */
export const ensureSchemaPatches = async (): Promise<void> => {
  const statements: { sql: string; ok: string }[] = [
    {
      sql: 'ALTER TABLE profils_cardiologues ADD COLUMN accepte_nouvelles_demandes BOOLEAN NOT NULL DEFAULT TRUE',
      ok:  'profils_cardiologues.accepte_nouvelles_demandes',
    },
    {
      sql: 'ALTER TABLE profils_patients ADD COLUMN organes_cibles_atteints TEXT NULL',
      ok:  'profils_patients.organes_cibles_atteints',
    },
    {
      sql: 'ALTER TABLE profils_patients ADD COLUMN type_hypertension VARCHAR(191) NULL',
      ok:  'profils_patients.type_hypertension',
    },
    {
      sql: 'ALTER TABLE profils_patients ADD COLUMN complications_cliniques TEXT NULL',
      ok:  'profils_patients.complications_cliniques',
    },
    {
      sql: 'ALTER TABLE profils_patients ADD COLUMN ta_cible_texte VARCHAR(128) NULL',
      ok:  'profils_patients.ta_cible_texte',
    },
    {
      sql: 'ALTER TABLE profils_patients ADD COLUMN enrichi_clinique_le DATETIME NULL',
      ok:  'profils_patients.enrichi_clinique_le',
    },
  ];
  for (const { sql, ok } of statements) {
    try {
      await pool.query(sql);
      console.log(`✅ Schéma : colonne ajoutée — ${ok}`);
    } catch (e: unknown) {
      const err = e as { errno?: number; code?: string };
      if (err.errno === 1060 || err.code === 'ER_DUP_FIELDNAME') {
        continue;
      }
      console.error('❌ Migration schéma automatique :', e);
      throw e;
    }
  }
};

export default pool;