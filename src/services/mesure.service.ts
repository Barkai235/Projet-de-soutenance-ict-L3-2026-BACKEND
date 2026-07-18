import MesureModel, { CreateMesureDTO, FiltresMesure } from '../models/mesure.model';
import { classifierTension } from '../utils/tension.utils';
import { envoyerPushAlertesTension, envoyerPushAUtilisateur } from '../config/firebase';
import pool from '../config/database';
import { RowDataPacket } from 'mysql2';
import { envoyerSMSAuPatient } from './sms.service';

const MesureService = {

  /** Normalise une date (ISO 8601, Date, ou déjà au format MySQL) vers 'YYYY-MM-DD HH:MM:SS'. */
  normalizeDate(value?: string): string | undefined {
    if (!value) return undefined;
    // Déjà au format MySQL
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return value;
    const d = new Date(value);
    if (isNaN(d.getTime())) return undefined;
    return d.toISOString().slice(0, 19).replace('T', ' ');
  },

  async ajouterMesure(data: {
    patient_id:  number;
    prise_par?:  number;
    systolique:  number;
    diastolique: number;
    pouls?:      number;
    bras?:       string;
    position?:   string;
    contexte?:   string;
    note?:       string;
    date_mesure?: string;
    source?:     string;
  }) {
    // 1. Classifier automatiquement
    const classification = classifierTension(data.systolique, data.diastolique);

    // 2. Construire le DTO
    const dto: CreateMesureDTO = {
      patient_id:  data.patient_id,
      prise_par:   data.prise_par,
      systolique:  data.systolique,
      diastolique: data.diastolique,
      pouls:       data.pouls,
      bras:        data.bras,
      position:    data.position,
      contexte:    data.contexte,
      statut:      classification.statut,
      note:        data.note,
      date_mesure: MesureService.normalizeDate(data.date_mesure) ?? new Date().toISOString().slice(0, 19).replace('T', ' '),
      source:      data.source ?? 'manuel',
    };

    // 3. Sauvegarder
    const mesureId = await MesureModel.create(dto);

    // 4. Créer alerte si tension critique (non bloquant)
    MesureModel.creerAlerte(mesureId, data.patient_id, classification.statut)
      .catch(err => console.warn('Alerte non créée :', err.message));

    // 4b. Envoyer push notification si tension critique
    if (classification.statut === 'crise' || classification.statut === 'hypertension_2') {
      const typeAlerte = classification.statut === 'crise' ? 'crise_hypertensive' : 'tension_tres_elevee';
      const titre = typeAlerte === 'crise_hypertensive' ? '🚨 Crise hypertensive !' : '⚠️ Tension très élevée';
      const corps = `Tension : ${data.systolique}/${data.diastolique} mmHg.`;

      // Push au patient
      envoyerPushAlertesTension(data.patient_id, data.systolique, data.diastolique, typeAlerte)
        .catch(() => {});
      envoyerSMSAuPatient(
        data.patient_id,
        `HyperTrack: tension critique ${data.systolique}/${data.diastolique}. Consultez un medecin immediatement.`
      ).catch(() => {});

      // Push au médecin traitant + aidants avec recoit_alertes
      (async () => {
        try {
          const [rows] = await pool.execute<RowDataPacket[]>(
            `SELECT pp.medecin_id,
                    GROUP_CONCAT(la.aidant_id) AS aidant_ids
             FROM profils_patients pp
             LEFT JOIN aidants la ON la.patient_id = pp.utilisateur_id
               AND la.recoit_alertes = 1
             WHERE pp.utilisateur_id = ?
             GROUP BY pp.medecin_id`,
            [data.patient_id]
          );
          if (rows.length > 0) {
            const { medecin_id, aidant_ids } = rows[0];
            if (medecin_id) {
              await envoyerPushAUtilisateur(medecin_id, titre,
                `Patient : ${corps} Vérifiez son état.`,
                { type: typeAlerte, screen: 'Dashboard' });
            }
            if (aidant_ids) {
              const ids: number[] = String(aidant_ids).split(',').map(Number);
              for (const id of ids) {
                await envoyerPushAUtilisateur(id, titre, corps,
                  { type: typeAlerte, screen: 'Dashboard' });
              }
            }
          }
        } catch { /* non bloquant */ }
      })();
    }

    // 5. Récupérer la mesure complète
    const mesure = await MesureModel.findById(mesureId);

    return { mesure, classification };
  },

  /** Insertion successive des mesures captées hors ligne (même logique qu’une saisie en ligne). */
  async synchroniserMesuresPatient(
    patient_id: number,
    mesures: Array<{
      systolique:  number;
      diastolique: number;
      pouls?:      number;
      bras?:       string;
      position?:   string;
      contexte?:   string;
      note?:       string;
      date_mesure?: string;
    }>
  ) {
    const out: Awaited<ReturnType<(typeof MesureService)['ajouterMesure']>>[] =
      [];
    for (const m of mesures) {
      // Idempotence : on ignore une mesure identique déjà enregistrée
      // (même patient, tension et date à la seconde près). Évite les doublons
      // quand le mobile renvoie plusieurs fois le même batch hors-ligne.
      const dejaLa = await MesureModel.existsIdentique(
        patient_id,
        m.systolique,
        m.diastolique,
        m.date_mesure
      );
      if (dejaLa) continue;

      out.push(
        await MesureService.ajouterMesure({
          patient_id,
          systolique:  m.systolique,
          diastolique: m.diastolique,
          pouls:       m.pouls,
          bras:        m.bras,
          position:    m.position,
          contexte:    m.contexte,
          note:        m.note,
          date_mesure: m.date_mesure,
          source:      'manuel',
        })
      );
    }
    return out;
  },

  async getMesures(filtres: FiltresMesure) {
    const [mesures, total] = await Promise.all([
      MesureModel.findByPatient(filtres),
      MesureModel.countByPatient(filtres.patient_id!),
    ]);
    return { mesures, total };
  },

  async getMesureById(id: number) {
    const mesure = await MesureModel.findById(id);
    if (!mesure) throw new Error('Mesure introuvable');
    return mesure;
  },

  async supprimerMesure(id: number, patient_id: number) {
    const ok = await MesureModel.delete(id, patient_id);
    if (!ok) throw new Error('Mesure introuvable ou non autorisé');
    return { message: 'Mesure supprimée avec succès' };
  },

  async supprimerToutesMesures(patient_id: number) {
    const n = await MesureModel.deleteAllByPatient(patient_id);
    return { message: `${n} mesure(s) supprimée(s)`, count: n };
  },

  async getStatistiques(patient_id: number) {
    const [derniere, moyennes30j, moyennes7j, statsStatuts] = await Promise.all([
      MesureModel.getDerniereMesure(patient_id),
      MesureModel.getMoyennes(patient_id, 30),
      MesureModel.getMoyennes(patient_id, 7),
      MesureModel.getStatistiquesStatuts(patient_id),
    ]);

    const classifDerniere = derniere
      ? classifierTension(derniere.systolique, derniere.diastolique)
      : null;

    return {
      derniere_mesure:    derniere,
      classification:     classifDerniere,
      moyennes_30_jours:  moyennes30j,
      moyennes_7_jours:   moyennes7j,
      repartition_statuts: statsStatuts,
    };
  },

  async getMesuresMedecin(medecin_id: number) {
    return MesureModel.findByMedecin(medecin_id);
  },

  async resoudreAlerte(alerte_id: number, user_id: number, role: string) {
    const ok = await MesureModel.resoudreAlerte(alerte_id, user_id, role);
    if (!ok) throw new Error('Alerte introuvable ou accès refusé');
    return { message: 'Alerte résolue' };
  },
};

export default MesureService;