import dotenv  from 'dotenv';
import bcrypt  from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import pool    from '../config/database';

dotenv.config();

const createAdmin = async () => {
  try {
    console.log('🔄 Connexion à la base de données...');

    // 1. Vérifier si un admin existe déjà
    const [existing] = await pool.execute(
      `SELECT id FROM utilisateurs
       WHERE email = 'admin@hypertrack.com'`
    ) as [{ id: number }[], unknown];

    if (existing.length > 0) {
      console.log('⚠️  Un admin existe déjà avec cet email.');
      console.log('🔄 Mise à jour du mot de passe...');

      // Mettre à jour le mot de passe existant
      const hash = await bcrypt.hash('Admin@1234', 12);
      await pool.execute(
        `UPDATE utilisateurs
         SET mot_de_passe = ?, est_actif = TRUE
         WHERE email = 'admin@hypertrack.com'`,
        [hash]
      );

      console.log('✅ Mot de passe mis à jour avec succès !');
    } else {
      console.log('🔄 Création du compte administrateur...');

      // 2. Récupérer l'ID du rôle administrateur
      const [roles] = await pool.execute(
        `SELECT id FROM roles WHERE nom = 'administrateur'`
      ) as [{ id: number }[], unknown];

      if (roles.length === 0) {
        throw new Error('Rôle administrateur introuvable. Vérifiez que le schema.sql a bien été exécuté.');
      }

      const roleId = roles[0].id;

      // 3. Hasher le mot de passe
      const hash = await bcrypt.hash('Admin@1234', 12);
      const uuid = uuidv4();

      // 4. Insérer l'administrateur
      const [result] = await pool.execute(
        `INSERT INTO utilisateurs
           (uuid, nom, prenom, email, mot_de_passe,
            role_id, est_actif, email_verifie)
         VALUES (?, ?, ?, ?, ?, ?, TRUE, TRUE)`,
        [
          uuid,
          'Administrateur',
          'Système',
          'admin@hypertrack.com',
          hash,
          roleId,
        ]
      ) as [{ insertId: number }, unknown];

      const userId = (result as { insertId: number }).insertId;

      // 5. Créer les paramètres par défaut
      await pool.execute(
        `INSERT INTO parametres_utilisateurs (utilisateur_id)
         VALUES (?)`,
        [userId]
      );

      console.log(`✅ Administrateur créé avec l'ID : ${userId}`);
    }

    console.log('\n🎉 Compte administrateur prêt !');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Email    : admin@hypertrack.com');
    console.log('🔐 Mot de passe : Admin@1234');
    console.log('🔑 Rôle     : administrateur');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n⚠️  Changez ce mot de passe après la première connexion !');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur :', error);
    process.exit(1);
  }
};

createAdmin();