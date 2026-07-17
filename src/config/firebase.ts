import * as admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

let firebaseApp: admin.app.App | null = null;

/** Clé PEM depuis Render : une seule ligne avec \n à la place des retours à la ligne du JSON. */
function normalizeFirebasePrivateKey(raw: string | undefined): string | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  s = s.replace(/\\n/g, '\n');
  if (!s.includes('PRIVATE KEY')) {
    return null;
  }
  return s;
}

export const initFirebase = (): void => {
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
    const privateKey = normalizeFirebasePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

    if (!projectId) {
      console.warn('⚠️  Firebase non configure (Push desactive)');
      return;
    }
    if (!clientEmail || !privateKey) {
      console.warn(
        '⚠️  Firebase incomplet : definissez FIREBASE_CLIENT_EMAIL et FIREBASE_PRIVATE_KEY sur Render ' +
          '(cle PEM sur une ligne, \\n pour les sauts de ligne). Push desactive.'
      );
      return;
    }

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });

    console.log('✅ Firebase Admin SDK initialise');
  } catch (error) {
    console.warn('⚠️  Firebase erreur :', error);
  }
};

export const getFirebase = (): admin.app.App | null => firebaseApp;

// Helper : récupère le token FCM d'un utilisateur et envoie un push
export const envoyerPushAUtilisateur = async (
  utilisateur_id: number,
  titre:          string,
  corps:          string,
  donnees?:       Record<string, string>
): Promise<void> => {
  try {
    const pool = (await import('./database')).default;
    const [rows] = await pool.execute(
      'SELECT fcm_token FROM utilisateurs WHERE id = ? AND fcm_token IS NOT NULL',
      [utilisateur_id]
    ) as [{ fcm_token: string }[], unknown];
    if (rows.length === 0) return;
    await envoyerPushNotification({ token: rows[0].fcm_token, titre, corps, donnees });
  } catch (err) {
    console.warn(`Push non envoyé (user ${utilisateur_id}) :`, err);
  }
};

// Helper : envoie à plusieurs utilisateurs en parallèle
export const envoyerPushAUtilisateurs = async (
  utilisateur_ids: number[],
  titre:           string,
  corps:           string,
  donnees?:        Record<string, string>
): Promise<void> => {
  await Promise.allSettled(
    utilisateur_ids.map(id => envoyerPushAUtilisateur(id, titre, corps, donnees))
  );
};

export const envoyerPushNotification = async (data: {
  token:    string;
  titre:    string;
  corps:    string;
  donnees?: Record<string, string>;
}): Promise<boolean> => {
  if (!firebaseApp) {
    console.log(`[Push simule] → ${data.titre} : ${data.corps}`);
    return true;
  }

  try {
    await admin.messaging().send({
      token: data.token,
      notification: {
        title: data.titre,
        body:  data.corps,
      },
      data:    data.donnees ?? {},
      android: {
        priority: 'high',
        notification: {
          sound:     'default',
          channelId: 'hypertrack_alerts',
          color:     '#2563eb',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    });
    console.log(`✅ Push envoye a ${data.token.slice(0, 20)}...`);
    return true;
  } catch (error) {
    console.error('❌ Push notification erreur :', error);
    return false;
  }
};

export const envoyerPushAlertesTension = async (
  patient_id:  number,
  systolique:  number,
  diastolique: number,
  typeAlerte:  string
): Promise<void> => {
  try {
    const pool = (await import('./database')).default;

    const [rows] = await pool.execute(
      `SELECT fcm_token FROM utilisateurs
       WHERE id = ? AND fcm_token IS NOT NULL`,
      [patient_id]
    ) as [{ fcm_token: string }[], unknown];

    if (rows.length === 0) {
      console.log('Pas de token FCM pour patient', patient_id);
      return;
    }

    const titre = typeAlerte === 'crise_hypertensive'
      ? '🚨 Crise hypertensive !'
      : '⚠️ Tension tres elevee';

    const corps = `Tension : ${systolique}/${diastolique} mmHg. ${
      typeAlerte === 'crise_hypertensive'
        ? 'Consultez un medecin IMMEDIATEMENT.'
        : 'Contactez votre medecin.'
    }`;

    await envoyerPushNotification({
      token:   rows[0].fcm_token,
      titre,
      corps,
      donnees: {
        type:        typeAlerte,
        systolique:  String(systolique),
        diastolique: String(diastolique),
        screen:      'Mesures',
      },
    });
  } catch (err) {
    console.warn('Push alerte non envoyee :', err);
  }
};