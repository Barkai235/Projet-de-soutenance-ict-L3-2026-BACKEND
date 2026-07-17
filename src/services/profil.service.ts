import ProfilModel, {
  UpdateProfilDTO, UpdatePatientDTO, UpdateCardiologueDTO, UpdateParametresDTO
} from '../models/profil.model';
import { comparePassword, hashPassword } from '../utils/password.utils';

const STRUCTURE_TYPES = new Set([
  'hopital_public',
  'clinique_privee',
  'cabinet_liberal',
  'centre_sante',
]);

function normalizeHeure(v: string | undefined): string | undefined {
  if (v == null || String(v).trim() === '') return undefined;
  const s = String(v).trim();
  if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`;
  return s;
}

function normalizeCardiologuePayload(data: UpdateCardiologueDTO): UpdateCardiologueDTO {
  const o: UpdateCardiologueDTO = { ...data };

  const intField = (
    key: keyof UpdateCardiologueDTO,
    min: number,
    max: number,
    label: string
  ) => {
    const raw = o[key];
    if (
      raw === undefined ||
      raw === null ||
      (typeof raw === 'string' && raw.trim() === '')
    ) {
      delete o[key];
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      delete o[key];
      return;
    }
    if (n < min || n > max) {
      throw new Error(`${label} invalide (${min}–${max})`);
    }
    (o as Record<string, unknown>)[key as string] = n;
  };

  intField('annees_experience', 0, 70, 'Années d\'expérience');
  intField('duree_consultation', 5, 240, 'Durée de consultation (minutes)');
  intField('max_patients_jour', 1, 200, 'Patients max. par jour');
  if (o.tarif_fcfa !== undefined && o.tarif_fcfa !== null) {
    const rawTarif = o.tarif_fcfa as string | number;
    if (typeof rawTarif === 'string' && rawTarif.trim() === '') {
      delete o.tarif_fcfa;
    } else {
      const n = Number(rawTarif);
      if (Number.isNaN(n) || n < 0) {
        throw new Error('Tarif FCFA invalide');
      }
      o.tarif_fcfa = n;
    }
  }

  if (o.structure_type !== undefined && o.structure_type !== null && o.structure_type !== '') {
    if (!STRUCTURE_TYPES.has(String(o.structure_type))) {
      delete o.structure_type;
    }
  } else if (o.structure_type === '') {
    o.structure_type = undefined;
  }

  o.heure_debut = normalizeHeure(o.heure_debut as string | undefined);
  o.heure_fin = normalizeHeure(o.heure_fin as string | undefined);

  Object.keys(o).forEach((k) => {
    const v = (o as Record<string, unknown>)[k];
    if (v === undefined) delete (o as Record<string, unknown>)[k];
    else if (typeof v === 'number' && Number.isNaN(v)) delete (o as Record<string, unknown>)[k];
  });

  return o;
}

const ProfilService = {

  async getProfil(userId: number) {
    const profil = await ProfilModel.getProfilComplet(userId);
    if (!profil) throw new Error('Profil introuvable');
    return profil;
  },

  async updateProfil(
    userId: number,
    data:   UpdateProfilDTO,
    patientData?: UpdatePatientDTO,
    cardiologueData?: UpdateCardiologueDTO
  ) {
    await ProfilModel.updateProfil(userId, data);

    if (patientData && Object.keys(patientData).length > 0) {
      await ProfilModel.updateProfilPatient(userId, patientData);
    }

    if (cardiologueData && Object.keys(cardiologueData).length > 0) {
      if (cardiologueData.quota_patients !== undefined) {
        const q = Number(cardiologueData.quota_patients);
        if (Number.isNaN(q) || q < 1 || q > 500) {
          throw new Error('Quota patients invalide (entre 1 et 500)');
        }
        cardiologueData.quota_patients = q;
      }
      const normalized = normalizeCardiologuePayload(cardiologueData);
      if (Object.keys(normalized).length > 0) {
        await ProfilModel.updateProfilCardiologue(userId, normalized);
      }
    }

    return ProfilModel.getProfilComplet(userId);
  },

  async updatePhoto(userId: number, filename: string) {
    const photoUrl = `/uploads/photos/${filename}`;
    await ProfilModel.updatePhoto(userId, photoUrl);
    return { photo_url: photoUrl };
  },

  async updateParametres(userId: number, data: UpdateParametresDTO) {
    await ProfilModel.updateParametres(userId, data);
    return { message: 'Paramètres mis à jour' };
  },

  async changerMotDePasse(
    userId:          number,
    ancienMdp:       string,
    nouveauMdp:      string
  ) {
    const hash = await ProfilModel.getMotDePasseHash(userId);
    if (!hash) throw new Error('Utilisateur introuvable');

    const valide = await comparePassword(ancienMdp, hash);
    if (!valide) throw new Error('Mot de passe actuel incorrect');

    if (nouveauMdp.length < 8)
      throw new Error('Le nouveau mot de passe doit contenir au moins 8 caractères');

    const newHash = await hashPassword(nouveauMdp);
    await ProfilModel.changerMotDePasse(userId, newHash);

    return { message: 'Mot de passe modifié avec succès' };
  },

  async desactiverComptePatient(userId: number) {
    await ProfilModel.deactivatePatientAccount(userId);
    return { message: 'Compte désactivé. Vous ne pourrez plus vous connecter.' };
  },
};

export default ProfilService;