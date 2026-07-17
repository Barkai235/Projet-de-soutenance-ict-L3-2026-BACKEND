/**
 * Libellés formulaire → ENUM MySQL profils_cardiologues.structure_type
 */
export function normalizeStructureType(raw: string | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const t = raw.trim();
  const map: Record<string, string> = {
    'Hôpital public':     'hopital_public',
    'Clinique privée':    'clinique_privee',
    'Cabinet libéral':    'cabinet_liberal',
    'Centre de santé':    'centre_sante',
    hopital_public:       'hopital_public',
    clinique_privee:      'clinique_privee',
    cabinet_liberal:      'cabinet_liberal',
    centre_sante:         'centre_sante',
  };
  if (map[t]) return map[t];
  const allowed = ['hopital_public', 'clinique_privee', 'cabinet_liberal', 'centre_sante'];
  return allowed.includes(t) ? t : null;
}
