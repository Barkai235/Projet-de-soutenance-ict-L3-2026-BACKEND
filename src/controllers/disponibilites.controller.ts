import { Response }    from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import DisponibilitesModel, { type Disponibilite } from '../models/disponibilites.model';
import { sendSuccess, sendError } from '../utils/response.utils';

/** HH:MM → HH:MM:SS pour MySQL TIME */
function toMysqlTime(s: unknown): string {
  const raw = String(s ?? '').trim();
  const m = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) throw new Error(`Heure invalide : ${raw}`);
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const min = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  const sec = m[3] !== undefined ? Math.min(59, Math.max(0, parseInt(m[3], 10))) : 0;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function minutesDepuisMinuit(t: string): number {
  const [h, min, s] = t.split(':').map(Number);
  return h * 60 + min + (s || 0) / 60;
}

function normaliserSlots(brut: unknown[]): Disponibilite[] {
  return brut.map((item, i) => {
    const o = item as Record<string, unknown>;
    const jour = Number(o.jour_semaine);
    if (!Number.isInteger(jour) || jour < 1 || jour > 7) {
      throw new Error(`Créneau ${i + 1} : jour_semaine doit être entre 1 et 7`);
    }
    const hb = toMysqlTime(o.heure_debut);
    const hf = toMysqlTime(o.heure_fin);
    if (minutesDepuisMinuit(hf) <= minutesDepuisMinuit(hb)) {
      throw new Error(`Créneau ${i + 1} : l'heure de fin doit être après l'heure de début`);
    }
    const est_actif = o.est_actif === true || o.est_actif === 1 || o.est_actif === '1';
    return {
      jour_semaine: jour,
      heure_debut: hb,
      heure_fin: hf,
      est_actif,
    };
  });
}

const DisponibilitesController = {

  async lister(req: AuthRequest, res: Response): Promise<void> {
    try {
      const slots = await DisponibilitesModel.listerPourMedecin(req.user!.id);
      sendSuccess(res, 'Disponibilités récupérées', slots);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  async sauvegarder(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { slots } = req.body;
      if (!Array.isArray(slots)) {
        sendError(res, 'Format invalide : slots doit être un tableau', 400);
        return;
      }
      const normalises = normaliserSlots(slots);
      await DisponibilitesModel.remplacer(req.user!.id, normalises);
      sendSuccess(res, 'Disponibilités sauvegardées', null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur serveur';
      const code = msg.includes('invalide') || msg.includes('doit') ? 400 : 500;
      sendError(res, msg, code);
    }
  },
};

export default DisponibilitesController;
