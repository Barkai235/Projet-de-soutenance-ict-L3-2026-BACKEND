import transporter from '../config/mailer';
import dotenv from 'dotenv';

dotenv.config();

const FROM    = process.env.MAIL_FROM    || 'HyperTrack <noreply@hypertrack.com>';
const APP_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(
  /\/$/,
  ''
);
/** Lien profond app mobile : hypertrack://reset-password?token=… (Android / iOS) */
const MOBILE_RESET_BASE =
  process.env.MOBILE_RESET_DEEP_LINK || 'hypertrack://reset-password';

/* ─────────────────────────────────────────
   Template HTML générique
───────────────────────────────────────── */
const baseTemplate = (title: string, body: string): string => `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f0f4ff;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:16px;overflow:hidden;
                      box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1d4ed8,#2563eb);
                        padding:32px 40px;text-align:center;">
              <div style="display:inline-block;width:56px;height:56px;
                          background:rgba(255,255,255,0.2);border-radius:14px;
                          line-height:56px;font-size:28px;font-weight:bold;
                          color:#fff;margin-bottom:12px;">H</div>
              <h1 style="margin:0;color:#ffffff;font-size:22px;
                          font-weight:700;letter-spacing:-0.5px;">HyperTrack</h1>
              <p style="margin:4px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">
                Plateforme de suivi médical
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:24px 40px;
                        border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.6;">
                Cet email a été envoyé automatiquement par HyperTrack.<br/>
                Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.
              </p>
              <p style="margin:12px 0 0;color:#cbd5e1;font-size:11px;">
                © ${new Date().getFullYear()} HyperTrack — Tous droits réservés
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

/* ─────────────────────────────────────────
   1. Email de réinitialisation de mot de passe
───────────────────────────────────────── */
export const sendResetPasswordEmail = async (
  to: string,
  prenom: string,
  token: string
): Promise<void> => {
  const enc = encodeURIComponent(token);
  const resetLink = `${APP_URL}/reset-password?token=${enc}`;
  const mobileResetLink = `${MOBILE_RESET_BASE}?token=${enc}`;

  const body = `
    <h2 style="margin:0 0 8px;color:#1e3a8a;font-size:20px;font-weight:700;">
      Réinitialisation de mot de passe
    </h2>
    <p style="margin:0 0 24px;color:#64748b;font-size:14px;line-height:1.6;">
      Bonjour <strong>${prenom}</strong>,
    </p>
    <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6;">
      Nous avons reçu une demande de réinitialisation du mot de passe
      associé à votre compte HyperTrack. Choisissez <strong>l’application mobile</strong>
      (recommandé sur téléphone) ou le <strong>site web</strong> :
    </p>

    <!-- 1) App (deep link) — même libellé qu’avant pour le lien principal sur mobile -->
    <div style="text-align:center;margin:28px 0 0;">
      <a href="${mobileResetLink}"
         style="display:inline-block;background:#2563eb;color:#ffffff;
                text-decoration:none;padding:14px 36px;border-radius:10px;
                font-size:15px;font-weight:600;letter-spacing:0.3px;">
        Réinitialiser mon mot de passe
      </a>
    </div>
    <p style="margin:0 0 20px;color:#94a3b8;font-size:11px;text-align:center;line-height:1.5;">
      Ouvre l’application HyperTrack si elle est installée. Sinon, utilisez le bouton « Site web » ci-dessous.
    </p>

    <!-- 2) Site web (navigateur) -->
    <div style="text-align:center;margin:8px 0 0;">
      <a href="${resetLink}"
         style="display:inline-block;background:#f1f5f9;color:#1e40af;border:1px solid #cbd5e1;
                text-decoration:none;padding:12px 28px;border-radius:10px;
                font-size:14px;font-weight:600;">
        Réinitialiser sur le site web
      </a>
    </div>

    <!-- Lien texte de secours (copier-coller) -->
    <p style="margin:28px 0 8px;color:#94a3b8;font-size:12px;text-align:center;">
      Si les boutons ne réagissent pas, copiez l’un de ces liens dans le navigateur ou dans l’app (écran « Nouveau mot de passe ») :
    </p>
    <p style="margin:0 0 8px;text-align:center;">
      <span style="color:#64748b;font-size:11px;">Application :</span><br/>
      <a href="${mobileResetLink}"
         style="color:#2563eb;font-size:11px;word-break:break-all;">
        ${mobileResetLink}
      </a>
    </p>
    <p style="margin:0 0 24px;text-align:center;">
      <span style="color:#64748b;font-size:11px;">Site web :</span><br/>
      <a href="${resetLink}"
         style="color:#2563eb;font-size:11px;word-break:break-all;">
        ${resetLink}
      </a>
    </p>

    <p style="margin:0 0 8px;color:#94a3b8;font-size:12px;text-align:center;">
      Vous pouvez aussi ouvrir l’app → <strong>Connexion</strong> → <strong>Mot de passe oublié</strong>, puis coller le lien dans l’écran « Nouveau mot de passe ».
    </p>

    <!-- Avertissement expiration -->
    <div style="background:#fef9ec;border:1px solid #fcd34d;border-radius:10px;
                padding:14px 18px;margin-top:8px;">
      <p style="margin:0;color:#92400e;font-size:13px;line-height:1.5;">
        ⏱ <strong>Ce lien est valide pendant 1 heure.</strong>
        Après expiration, vous devrez effectuer une nouvelle demande.
      </p>
    </div>
  `;

  await transporter.sendMail({
    from:    FROM,
    to,
    subject: '🔐 Réinitialisation de votre mot de passe — HyperTrack',
    html:    baseTemplate('Réinitialisation de mot de passe', body),
  });
};

/* ─────────────────────────────────────────
   2. Email de bienvenue (inscription)
───────────────────────────────────────── */
export const sendWelcomeEmail = async (
  to: string,
  prenom: string,
  role: string
): Promise<void> => {
  const roleLabels: Record<string, string> = {
    patient:     'Patient',
    medecin:     'Médecin traitant',
    cardiologue: 'Cardiologue',
    infirmier:   'Infirmier(e)',
    pharmacien:  'Pharmacien(ne)',
    aidant:      'Proche / Aidant familial',
  };

  const body = `
    <h2 style="margin:0 0 8px;color:#1e3a8a;font-size:20px;font-weight:700;">
      Bienvenue sur HyperTrack ! 🎉
    </h2>
    <p style="margin:0 0 24px;color:#64748b;font-size:14px;line-height:1.6;">
      Bonjour <strong>${prenom}</strong>,
    </p>
    <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6;">
      Votre compte <strong>${roleLabels[role] || role}</strong> a été créé avec succès
      sur la plateforme HyperTrack. Vous pouvez désormais vous connecter
      et commencer à utiliser toutes les fonctionnalités disponibles.
    </p>

    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;
                padding:18px;margin:24px 0;">
      <p style="margin:0 0 8px;color:#0369a1;font-size:13px;font-weight:700;">
        Ce que vous pouvez faire :
      </p>
      <ul style="margin:0;padding-left:20px;color:#0c4a6e;font-size:13px;line-height:1.8;">
        <li>Suivre votre tension artérielle</li>
        <li>Gérer vos médicaments et rappels</li>
        <li>Communiquer avec votre médecin</li>
        <li>Consulter vos rapports de santé</li>
      </ul>
    </div>

    <div style="text-align:center;margin:32px 0;">
      <a href="${APP_URL}/login"
         style="display:inline-block;background:#2563eb;color:#ffffff;
                text-decoration:none;padding:14px 36px;border-radius:10px;
                font-size:15px;font-weight:600;">
        Accéder à mon espace
      </a>
    </div>
  `;

  await transporter.sendMail({
    from:    FROM,
    to,
    subject: '🏥 Bienvenue sur HyperTrack — Votre compte est actif',
    html:    baseTemplate('Bienvenue sur HyperTrack', body),
  });
};

export const sendAdminCardiologuePendingEmail = async (
  to: string,
  cardiologueNomComplet: string,
  cardiologueEmail: string
): Promise<void> => {
  const body = `
    <h2 style="margin:0 0 8px;color:#1e3a8a;font-size:20px;font-weight:700;">
      Nouvelle inscription cardiologue en attente
    </h2>
    <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6;">
      Un nouveau cardiologue attend votre validation.
    </p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;">
      <p style="margin:0;color:#334155;font-size:13px;"><strong>Nom :</strong> ${cardiologueNomComplet}</p>
      <p style="margin:6px 0 0;color:#334155;font-size:13px;"><strong>Email :</strong> ${cardiologueEmail}</p>
    </div>
  `;

  await transporter.sendMail({
    from: FROM,
    to,
    subject: '🩺 Validation cardiologue requise — HyperTrack',
    html: baseTemplate('Validation cardiologue requise', body),
  });
};

export const sendCardiologueValidationEmail = async (
  to: string,
  prenom: string,
  decision: 'accepte' | 'refuse',
  motifRefus?: string
): Promise<void> => {
  const estAccepte = decision === 'accepte';
  const body = estAccepte
    ? `
      <h2 style="margin:0 0 8px;color:#166534;font-size:20px;font-weight:700;">
        Votre compte cardiologue est validé ✅
      </h2>
      <p style="margin:0;color:#475569;font-size:14px;line-height:1.6;">
        Bonjour <strong>${prenom}</strong>, votre inscription a été approuvée.
        Vous pouvez maintenant vous connecter à HyperTrack.
      </p>
      <div style="text-align:center;margin:28px 0 0;">
        <a href="${APP_URL}/login" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:600;">
          Se connecter
        </a>
      </div>
    `
    : `
      <h2 style="margin:0 0 8px;color:#991b1b;font-size:20px;font-weight:700;">
        Votre demande cardiologue a été refusée
      </h2>
      <p style="margin:0 0 12px;color:#475569;font-size:14px;line-height:1.6;">
        Bonjour <strong>${prenom}</strong>, votre dossier n'a pas pu être validé.
      </p>
      ${motifRefus ? `<p style="margin:0;color:#7f1d1d;font-size:13px;"><strong>Motif :</strong> ${motifRefus}</p>` : ''}
    `;

  await transporter.sendMail({
    from: FROM,
    to,
    subject: estAccepte
      ? '✅ Compte cardiologue validé — HyperTrack'
      : '❌ Demande cardiologue refusée — HyperTrack',
    html: baseTemplate('Statut de votre inscription', body),
  });
};

/* ── Assignation patient ↔ cardiologue ──────────────────── */
export const sendAssignationDemandePatientEmail = async (
  to: string,
  prenom: string,
  cardiologueNom: string
): Promise<void> => {
  const body = `
    <h2 style="margin:0 0 8px;color:#1e3a8a;font-size:20px;font-weight:700;">
      Demande de suivi enregistrée
    </h2>
    <p style="margin:0;color:#475569;font-size:14px;line-height:1.6;">
      Bonjour <strong>${prenom}</strong>, votre demande auprès du <strong>Dr ${cardiologueNom}</strong>
      a bien été transmise. Vous recevrez une notification dès qu’elle sera traitée.
    </p>
    <p style="margin:16px 0 0;color:#64748b;font-size:13px;">
      Statut : <strong>en attente</strong>
    </p>
  `;
  await transporter.sendMail({
    from: FROM,
    to,
    subject: '📋 Demande de suivi envoyée — HyperTrack',
    html:    baseTemplate('Demande en attente', body),
  });
};

export const sendAssignationAccepteePatientEmail = async (
  to: string,
  prenom: string,
  cardiologueNom: string
): Promise<void> => {
  const body = `
    <h2 style="margin:0 0 8px;color:#166534;font-size:20px;font-weight:700;">
      Votre demande a été acceptée
    </h2>
    <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6;">
      Bonjour <strong>${prenom}</strong>, le <strong>Dr ${cardiologueNom}</strong> accepte de vous suivre.
      La messagerie et la prise de rendez-vous sont activées dans votre espace.
    </p>
    <div style="text-align:center;margin:24px 0 0;">
      <a href="${APP_URL}/dashboard" style="display:inline-block;background:#2563eb;color:#fff;
         text-decoration:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:600;">
        Accéder à mon espace
      </a>
    </div>
  `;
  await transporter.sendMail({
    from: FROM,
    to,
    subject: '✅ Suivi accepté — HyperTrack',
    html:    baseTemplate('Demande acceptée', body),
  });
};

export const sendAssignationRefuseePatientEmail = async (
  to: string,
  prenom: string,
  motifRefus: string,
  messageRefus?: string
): Promise<void> => {
  const body = `
    <h2 style="margin:0 0 8px;color:#991b1b;font-size:20px;font-weight:700;">
      Demande de suivi refusée
    </h2>
    <p style="margin:0 0 12px;color:#475569;font-size:14px;line-height:1.6;">
      Bonjour <strong>${prenom}</strong>, votre demande n’a pas pu être acceptée pour le moment.
    </p>
    <p style="margin:0;color:#7f1d1d;font-size:13px;"><strong>Motif :</strong> ${motifRefus}</p>
    ${messageRefus ? `<p style="margin:8px 0 0;color:#475569;font-size:13px;">${messageRefus}</p>` : ''}
    <p style="margin:16px 0 0;color:#64748b;font-size:13px;">
      Vous pouvez adresser une nouvelle demande à un autre cardiologue sans attendre.
    </p>
    <div style="text-align:center;margin:24px 0 0;">
      <a href="${APP_URL}/trouver-cardiologue" style="display:inline-block;background:#7c3aed;color:#fff;
         text-decoration:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:600;">
        Trouver un cardiologue
      </a>
    </div>
  `;
  await transporter.sendMail({
    from: FROM,
    to,
    subject: 'Demande refusée — HyperTrack',
    html:    baseTemplate('Demande refusée', body),
  });
};

export const sendAssignationFinSuiviCardioVersPatientEmail = async (
  to: string,
  prenom: string,
  motif?: string
): Promise<void> => {
  const body = `
    <h2 style="margin:0 0 8px;color:#1e3a8a;font-size:20px;font-weight:700;">
      Fin de suivi
    </h2>
    <p style="margin:0 0 12px;color:#475569;font-size:14px;line-height:1.6;">
      Bonjour <strong>${prenom}</strong>, votre cardiologue a mis fin au suivi sur HyperTrack.
    </p>
    ${motif ? `<p style="margin:0;color:#334155;font-size:13px;"><strong>Motif :</strong> ${motif}</p>` : ''}
    <p style="margin:16px 0 0;color:#64748b;font-size:13px;">
      Vous pouvez rechercher un nouveau cardiologue lorsque vous le souhaitez.
    </p>
  `;
  await transporter.sendMail({
    from: FROM,
    to,
    subject: 'Fin de suivi cardiologue — HyperTrack',
    html:    baseTemplate('Fin de suivi', body),
  });
};