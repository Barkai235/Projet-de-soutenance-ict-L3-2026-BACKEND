/**
 * Script de migration sécurisé — compatible MySQL 5.7+ / 8.0+ / 9.x
 * Usage : node database/run_migrations.js
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

async function dropIndexSafe(conn, table, indexName) {
  try {
    await conn.query(`ALTER TABLE ${table} DROP INDEX ${indexName}`);
    console.log(`  - Index supprimé : ${table}.${indexName}`);
  } catch (e) {
    if (
      e.code === 'ER_CANT_DROP_FIELD_OR_KEY' ||
      e.code === 'ER_DROP_INDEX_FK' ||
      String(e.message).includes("check that column/key exists")
    ) {
      console.log(`  = ${table}.${indexName} (déjà absent ou nom différent)`);
    } else {
      throw e;
    }
  }
}

async function addColSafe(conn, table, col, definition) {
  try {
    await conn.query(`ALTER TABLE ${table} ADD COLUMN ${col} ${definition}`);
    console.log(`  + ${table}.${col}`);
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log(`  = ${table}.${col} (existe déjà)`);
    } else {
      throw e;
    }
  }
}

async function runSqlFile(conn, file) {
  const fs = require('fs');
  const sql = fs.readFileSync(file, 'utf8');
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--'));
  for (const stmt of statements) {
    try {
      await conn.query(stmt);
    } catch (e) {
      if (e.code !== 'ER_TABLE_EXISTS_ERROR' && e.code !== 'ER_DUP_KEYNAME') {
        console.warn(`  Avertissement (${stmt.substring(0, 60)}…) : ${e.message}`);
      }
    }
  }
}

async function main() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     Number(process.env.DB_PORT) || 3306,
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'hypertrack',
  });

  console.log('\n=== Migration 1 : assignation ===');
  await runSqlFile(conn, 'database/migration_assignation.sql');

  console.log('\n=== Correctif : index demandes_assignation (doublon acceptee) ===');
  await dropIndexSafe(conn, 'demandes_assignation', 'uq_demande_active');
  try {
    await conn.query(
      'ALTER TABLE demandes_assignation ADD INDEX idx_demande_patient_medecin (patient_id, medecin_id)'
    );
    console.log('  + idx_demande_patient_medecin');
  } catch (e) {
    if (e.code === 'ER_DUP_KEYNAME') {
      console.log('  = idx_demande_patient_medecin (existe déjà)');
    } else {
      throw e;
    }
  }

  console.log('\n=== Migration 2 : inscription complète ===');
  await addColSafe(conn, 'utilisateurs', 'nationalite',       'VARCHAR(100)');
  await addColSafe(conn, 'utilisateurs', 'ville',             'VARCHAR(100)');
  await addColSafe(conn, 'utilisateurs', 'quartier',          'VARCHAR(100)');
  await addColSafe(conn, 'utilisateurs', 'situation_maritale',"ENUM('celibataire','marie','divorce','veuf')");

  await addColSafe(conn, 'profils_patients', 'antecedents_familiaux', 'TEXT');
  await addColSafe(conn, 'profils_patients', 'traitements_cours',     'TEXT');
  await addColSafe(conn, 'profils_patients', 'activite_physique',     "ENUM('sedentaire','leger','modere','tres_actif')");
  await addColSafe(conn, 'profils_patients', 'tabac',                 "ENUM('non_fumeur','ancien_fumeur','fumeur')");
  await addColSafe(conn, 'profils_patients', 'alcool',                "ENUM('jamais','occasionnel','regulier')");
  await addColSafe(conn, 'profils_patients', 'contact_urgence_nom',   'VARCHAR(200)');
  await addColSafe(conn, 'profils_patients', 'contact_urgence_lien',  'VARCHAR(50)');
  await addColSafe(conn, 'profils_patients', 'contact_urgence_tel',   'VARCHAR(20)');

  await addColSafe(conn, 'profils_cardiologues', 'ordre_medical',      'VARCHAR(50)');
  await addColSafe(conn, 'profils_cardiologues', 'titre',              'VARCHAR(100)');
  await addColSafe(conn, 'profils_cardiologues', 'annees_experience',  'INT');
  await addColSafe(conn, 'profils_cardiologues', 'structure_nom',      'VARCHAR(200)');
  await addColSafe(conn, 'profils_cardiologues', 'structure_type',     "ENUM('hopital_public','clinique_privee','cabinet_liberal','centre_sante')");
  await addColSafe(conn, 'profils_cardiologues', 'departement',        'VARCHAR(100)');
  await addColSafe(conn, 'profils_cardiologues', 'langues',            'VARCHAR(200)');
  await addColSafe(conn, 'profils_cardiologues', 'tarif_fcfa',         'INT');
  await addColSafe(conn, 'profils_cardiologues', 'accepte_video',      'BOOLEAN DEFAULT TRUE');
  await addColSafe(conn, 'profils_cardiologues', 'jours_consultation', 'VARCHAR(100)');
  await addColSafe(conn, 'profils_cardiologues', 'heure_debut',        'TIME');
  await addColSafe(conn, 'profils_cardiologues', 'heure_fin',          'TIME');
  await addColSafe(conn, 'profils_cardiologues', 'duree_consultation', 'INT DEFAULT 30');
  await addColSafe(conn, 'profils_cardiologues', 'max_patients_jour',  'INT DEFAULT 10');
  await addColSafe(conn, 'profils_cardiologues', 'statut_validation',  "ENUM('en_attente','validee','rejetee') DEFAULT 'en_attente'");
  await addColSafe(conn, 'profils_cardiologues', 'accepte_nouvelles_demandes', 'BOOLEAN NOT NULL DEFAULT TRUE');

  console.log('\n=== Migration : tele_expertises (table si absente) ===');
  await runSqlFile(conn, 'database/migration_tele_expertises.sql');

  console.log('\n=== Migration : aidants + profils_medecins (tables si absentes) ===');
  await runSqlFile(conn, 'database/migration_aidants_profils_medecins.sql');

  console.log('\n=== Migration : disponibilites_medecin ===');
  await runSqlFile(conn, 'database/migration_disponibilites_medecin.sql');

  console.log('\n=== Migration : sync demandes acceptee / fin de suivi ===');
  await runSqlFile(conn, 'database/migration_sync_demande_fin_suivi.sql');

  await conn.end();
  console.log('\n✅ Toutes les migrations sont appliquées.\n');
}

main().catch(e => {
  console.error('Erreur migration :', e.message);
  process.exit(1);
});
