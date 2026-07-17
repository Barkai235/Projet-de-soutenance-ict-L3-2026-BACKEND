import DashboardModel from '../models/dashboard.model';

const RapportService = {

  async genererRapportHTML(patient_id: number): Promise<string> {
    const data = await DashboardModel.getDonneesRapport(patient_id);
    const { patient, mesures, stats, rappels, alertes } = data;

    const dateGeneration = new Date().toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric',
    });

    const lignesMesures = mesures.map(m => {
      const date = new Date(m.date_mesure).toLocaleDateString('fr-FR');
      const statutColors: Record<string, string> = {
        normal:           '#16a34a',
        pre_hypertension: '#ca8a04',
        hypertension_1:   '#ea580c',
        hypertension_2:   '#dc2626',
        crise:            '#7c3aed',
      };
      const color  = statutColors[m.statut] ?? '#374151';
      const labels: Record<string, string> = {
        normal:           'Normal',
        pre_hypertension: 'Pré-HTA',
        hypertension_1:   'HTA 1',
        hypertension_2:   'HTA 2',
        crise:            'Crise',
      };
      return `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;">${date}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;
                     font-weight:600;">${m.systolique}/${m.diastolique}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;">
            ${m.pouls ?? '—'} bpm
          </td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;">
            <span style="color:${color};font-weight:600;font-size:12px;">
              ${labels[m.statut] ?? m.statut}
            </span>
          </td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;
                     color:#6b7280;font-size:12px;">
            ${m.note ?? '—'}
          </td>
        </tr>`;
    }).join('');

    const lignesRappels = rappels.map(r => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;">
          ${r.medicament_nom}
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;">
          ${r.dosage ?? '—'}
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;">
          ${r.heure_rappel?.slice(0, 5)}
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;">
          <span style="color:${r.est_actif ? '#16a34a' : '#dc2626'};font-weight:600;">
            ${r.est_actif ? 'Actif' : 'Inactif'}
          </span>
        </td>
      </tr>`
    ).join('');

    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <title>Rapport médical — ${patient?.prenom} ${patient?.nom}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:Arial,sans-serif; color:#1e293b; background:#f8fafc; }
    .page { max-width:900px; margin:0 auto; background:#fff; }
    .header { background:linear-gradient(135deg,#1d4ed8,#2563eb); color:#fff; padding:40px; }
    .header h1 { font-size:28px; font-weight:700; letter-spacing:-0.5px; }
    .header p  { color:rgba(255,255,255,0.8); margin-top:4px; font-size:14px; }
    .body  { padding:40px; }
    .section { margin-bottom:36px; }
    .section-title {
      font-size:16px; font-weight:700; color:#1e3a8a;
      border-left:4px solid #2563eb; padding-left:12px;
      margin-bottom:16px;
    }
    .info-grid {
      display:grid; grid-template-columns:1fr 1fr;
      gap:12px; margin-bottom:16px;
    }
    .info-item { background:#f8fafc; border-radius:10px; padding:14px; }
    .info-label { font-size:11px; color:#94a3b8; font-weight:600;
                  text-transform:uppercase; letter-spacing:0.5px; }
    .info-value { font-size:15px; font-weight:600; color:#1e293b; margin-top:4px; }
    .stats-grid {
      display:grid; grid-template-columns:repeat(4,1fr); gap:12px;
    }
    .stat-card {
      background:#f0f9ff; border:1px solid #bae6fd;
      border-radius:10px; padding:16px; text-align:center;
    }
    .stat-val  { font-size:28px; font-weight:800; color:#0369a1; }
    .stat-lbl  { font-size:11px; color:#64748b; margin-top:4px; }
    table { width:100%; border-collapse:collapse; }
    thead th {
      background:#f1f5f9; padding:10px 12px; text-align:left;
      font-size:12px; font-weight:700; color:#64748b;
      text-transform:uppercase; letter-spacing:0.5px;
    }
    .alerte-box {
      background:#fef2f2; border:1px solid #fca5a5;
      border-radius:10px; padding:14px; margin-bottom:10px;
    }
    .footer {
      border-top:1px solid #e2e8f0; padding:20px 40px;
      text-align:center; color:#94a3b8; font-size:12px;
    }
  </style>
</head>
<body>
<div class="page">

  <!-- En-tête -->
  <div class="header">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
      <div>
        <div style="background:rgba(255,255,255,0.2);display:inline-block;
                    padding:8px 16px;border-radius:8px;margin-bottom:12px;">
          <span style="font-size:18px;font-weight:800;">H</span>
          <span style="font-size:14px;margin-left:6px;">HyperTrack</span>
        </div>
        <h1>Rapport de suivi médical</h1>
        <p>Hypertension artérielle — 30 derniers jours</p>
      </div>
      <div style="text-align:right;">
        <p style="color:rgba(255,255,255,0.7);font-size:12px;">Généré le</p>
        <p style="font-weight:600;font-size:15px;">${dateGeneration}</p>
        <p style="color:rgba(255,255,255,0.6);font-size:11px;margin-top:4px;">
          Dossier : ${patient?.numero_dossier ?? '—'}
        </p>
      </div>
    </div>
  </div>

  <div class="body">

    <!-- Identité patient -->
    <div class="section">
      <p class="section-title">👤 Informations patient</p>
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Nom complet</div>
          <div class="info-value">${patient?.prenom} ${patient?.nom}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Date de naissance</div>
          <div class="info-value">
            ${patient?.date_naissance
              ? new Date(patient.date_naissance).toLocaleDateString('fr-FR')
              : '—'}
          </div>
        </div>
        <div class="info-item">
          <div class="info-label">Médecin traitant</div>
          <div class="info-value">
            ${patient?.medecin_prenom
              ? `Dr. ${patient.medecin_prenom} ${patient.medecin_nom}`
              : '—'}
          </div>
        </div>
        <div class="info-item">
          <div class="info-label">Niveau de risque</div>
          <div class="info-value" style="text-transform:capitalize;">
            ${patient?.niveau_risque ?? '—'}
          </div>
        </div>
        ${patient?.allergies ? `
        <div class="info-item" style="grid-column:span 2;">
          <div class="info-label">Allergies connues</div>
          <div class="info-value" style="font-size:13px;color:#dc2626;">
            ${patient.allergies}
          </div>
        </div>` : ''}
      </div>
    </div>

    <!-- Statistiques clés -->
    <div class="section">
      <p class="section-title">📊 Statistiques des 30 derniers jours</p>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-val">${stats?.total ?? 0}</div>
          <div class="stat-lbl">Mesures prises</div>
        </div>
        <div class="stat-card">
          <div class="stat-val">${stats?.moy_sys ?? '—'}/${stats?.moy_dia ?? '—'}</div>
          <div class="stat-lbl" style="font-size:10px;">Moyenne (mmHg)</div>
        </div>
        <div class="stat-card">
          <div class="stat-val">${stats?.max_sys ?? '—'}</div>
          <div class="stat-lbl">Max systolique</div>
        </div>
        <div class="stat-card">
          <div class="stat-val">${stats?.min_sys ?? '—'}</div>
          <div class="stat-lbl">Min systolique</div>
        </div>
      </div>

      <!-- Répartition des statuts -->
      <div style="margin-top:16px;background:#f8fafc;border-radius:10px;padding:16px;">
        <p style="font-size:12px;font-weight:700;color:#64748b;
                  text-transform:uppercase;margin-bottom:12px;">
          Répartition des mesures
        </p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${[
            { key: 'nb_normal',   label: 'Normal',       color: '#16a34a' },
            { key: 'nb_pre_hta',  label: 'Pré-HTA',      color: '#ca8a04' },
            { key: 'nb_hta1',     label: 'HTA stade 1',  color: '#ea580c' },
            { key: 'nb_hta2',     label: 'HTA stade 2',  color: '#dc2626' },
            { key: 'nb_crise',    label: 'Crise',         color: '#7c3aed' },
          ].filter(s => stats?.[s.key] > 0).map(s => `
            <span style="background:${s.color}20;color:${s.color};
                         padding:6px 14px;border-radius:20px;
                         font-size:12px;font-weight:600;">
              ${s.label} : ${stats?.[s.key] ?? 0}
            </span>`).join('')}
        </div>
      </div>
    </div>

    <!-- Alertes -->
    ${alertes.length > 0 ? `
    <div class="section">
      <p class="section-title">🚨 Alertes récentes</p>
      ${alertes.map(a => `
        <div class="alerte-box">
          <p style="font-weight:700;color:#991b1b;font-size:13px;">
            ${a.type_alerte === 'crise_hypertensive'
              ? '🚨 Crise hypertensive'
              : '⚠️ Hypertension stade 2'}
            — ${a.systolique}/${a.diastolique} mmHg
          </p>
          <p style="color:#6b7280;font-size:12px;margin-top:4px;">
            ${new Date(a.created_at).toLocaleString('fr-FR')}
          </p>
        </div>`).join('')}
    </div>` : ''}

    <!-- Historique des mesures -->
    ${mesures.length > 0 ? `
    <div class="section">
      <p class="section-title">📈 Historique des mesures</p>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Tension</th>
            <th>Pouls</th>
            <th>Statut</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>${lignesMesures}</tbody>
      </table>
    </div>` : ''}

    <!-- Traitement en cours -->
    ${rappels.length > 0 ? `
    <div class="section">
      <p class="section-title">💊 Traitement en cours</p>
      <table>
        <thead>
          <tr>
            <th>Médicament</th>
            <th>Dosage</th>
            <th>Heure de prise</th>
            <th>Statut</th>
          </tr>
        </thead>
        <tbody>${lignesRappels}</tbody>
      </table>
    </div>` : ''}

  </div>

  <!-- Footer -->
  <div class="footer">
    <p>
      Ce rapport a été généré automatiquement par <strong>HyperTrack</strong>
      le ${dateGeneration}.
    </p>
    <p style="margin-top:4px;">
      Document confidentiel — réservé à l'usage médical.
    </p>
  </div>
</div>
</body>
</html>`;
  },
};

export default RapportService;