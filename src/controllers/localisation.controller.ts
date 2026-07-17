import { Request, Response } from 'express';
import { sendSuccess, sendError } from '../utils/response.utils';

// Données statiques de centres de santé au Cameroun
// En production, vous pouvez connecter une vraie API (Google Places, OSM)
const CENTRES_SANTE = [
  {
    id: 1,
    nom: 'Hôpital Central de Yaoundé',
    type: 'Hôpital public',
    adresse: 'Rue Henri Dunant, Yaoundé',
    telephone: '+237 222 231 588',
    latitude: 3.8667,
    longitude: 11.5167,
    services: ['Cardiologie', 'Urgences', 'Médecine interne'],
    horaires: 'Ouvert 24h/24',
  },
  {
    id: 2,
    nom: 'Hôpital Général de Yaoundé',
    type: 'Hôpital public',
    adresse: 'Boulevard de l\'URSS, Yaoundé',
    telephone: '+237 222 231 400',
    latitude: 3.8480,
    longitude: 11.5021,
    services: ['Cardiologie', 'Hypertension', 'Urgences'],
    horaires: 'Ouvert 24h/24',
  },
  {
    id: 3,
    nom: 'Clinique des Spécialistes',
    type: 'Clinique privée',
    adresse: 'Quartier Bastos, Yaoundé',
    telephone: '+237 222 201 234',
    latitude: 3.8756,
    longitude: 11.5234,
    services: ['Cardiologie', 'Hypertension', 'Consultation'],
    horaires: 'Lun-Sam: 08h-18h',
  },
  {
    id: 4,
    nom: 'Centre Médical d\'Essos',
    type: 'Centre de santé',
    adresse: 'Quartier Essos, Yaoundé',
    telephone: '+237 222 223 456',
    latitude: 3.8612,
    longitude: 11.5298,
    services: ['Médecine générale', 'Hypertension'],
    horaires: 'Lun-Ven: 07h-17h',
  },
  {
    id: 5,
    nom: 'Hôpital Laquintinie de Douala',
    type: 'Hôpital public',
    adresse: 'Boulevard de la République, Douala',
    telephone: '+237 233 422 780',
    latitude: 4.0511,
    longitude: 9.7679,
    services: ['Cardiologie', 'Urgences', 'Hypertension'],
    horaires: 'Ouvert 24h/24',
  },
  {
    id: 6,
    nom: 'Polyclinique de Douala',
    type: 'Clinique privée',
    adresse: 'Bonanjo, Douala',
    telephone: '+237 233 423 100',
    latitude: 4.0486,
    longitude: 9.6984,
    services: ['Cardiologie', 'Médecine interne'],
    horaires: 'Lun-Sam: 07h-20h',
  },
];

const LocalisationController = {

  getCentres(_req: Request, res: Response): void {
    try {
      sendSuccess(res, 'Centres de santé récupérés', CENTRES_SANTE);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },

  getCentresProches(req: Request, res: Response): void {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      const rayon = parseFloat(req.query.rayon as string) || 20; // km

      if (isNaN(lat) || isNaN(lng)) {
        sendError(res, 'Coordonnées invalides', 400);
        return;
      }

      // Calcul distance Haversine
      const centres = CENTRES_SANTE.map(c => {
        const R = 6371;
        const dLat = (c.latitude  - lat) * Math.PI / 180;
        const dLng = (c.longitude - lng) * Math.PI / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat * Math.PI / 180) *
          Math.cos(c.latitude * Math.PI / 180) *
          Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return { ...c, distance: Math.round(distance * 10) / 10 };
      })
      .filter(c => c.distance <= rayon)
      .sort((a, b) => a.distance - b.distance);

      sendSuccess(res, 'Centres proches récupérés', centres);
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : 'Erreur serveur');
    }
  },
};

export default LocalisationController;