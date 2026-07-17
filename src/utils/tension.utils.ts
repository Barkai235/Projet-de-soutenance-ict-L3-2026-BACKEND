/* ─────────────────────────────────────────────────────────
   Classification OMS de la tension artérielle
   Source : WHO / ESC 2023 guidelines
───────────────────────────────────────────────────────── */

export type StatutTension =
  | 'normal'
  | 'pre_hypertension'
  | 'hypertension_1'
  | 'hypertension_2'
  | 'crise';

export interface ClassificationResult {
  statut:      StatutTension;
  label:       string;
  couleur:     string;
  description: string;
  urgence:     boolean;
}

export const classifierTension = (
  systolique:  number,
  diastolique: number
): ClassificationResult => {

  // Crise hypertensive
  if (systolique >= 180 || diastolique >= 120) {
    return {
      statut:      'crise',
      label:       'Crise hypertensive',
      couleur:     '#7c3aed',
      description: 'Tension dangereusement élevée. Consultez immédiatement.',
      urgence:     true,
    };
  }

  // Hypertension stade 2
  if (systolique >= 160 || diastolique >= 100) {
    return {
      statut:      'hypertension_2',
      label:       'Hypertension stade 2',
      couleur:     '#dc2626',
      description: 'Tension très élevée. Consultation médicale urgente.',
      urgence:     true,
    };
  }

  // Hypertension stade 1
  if (systolique >= 140 || diastolique >= 90) {
    return {
      statut:      'hypertension_1',
      label:       'Hypertension stade 1',
      couleur:     '#ea580c',
      description: 'Tension élevée. Consultez votre médecin.',
      urgence:     false,
    };
  }

  // Pré-hypertension
  if (systolique >= 120 || diastolique >= 80) {
    return {
      statut:      'pre_hypertension',
      label:       'Pré-hypertension',
      couleur:     '#ca8a04',
      description: 'Tension légèrement élevée. Surveillez régulièrement.',
      urgence:     false,
    };
  }

  // Normal
  return {
    statut:      'normal',
    label:       'Normal',
    couleur:     '#16a34a',
    description: 'Tension dans les valeurs normales. Continuez le suivi.',
    urgence:     false,
  };
};

export const getLabelStatut = (statut: StatutTension): string => {
  const labels: Record<StatutTension, string> = {
    normal:           'Normal',
    pre_hypertension: 'Pré-hypertension',
    hypertension_1:   'Hypertension stade 1',
    hypertension_2:   'Hypertension stade 2',
    crise:            'Crise hypertensive',
  };
  return labels[statut] ?? statut;
};

export const getCouleurStatut = (statut: StatutTension): string => {
  const couleurs: Record<StatutTension, string> = {
    normal:           '#16a34a',
    pre_hypertension: '#ca8a04',
    hypertension_1:   '#ea580c',
    hypertension_2:   '#dc2626',
    crise:            '#7c3aed',
  };
  return couleurs[statut] ?? '#6b7280';
};