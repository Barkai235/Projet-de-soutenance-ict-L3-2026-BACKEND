/**
 * Assistant conversationnel léger (règles + mots-clés), sans modèle externe.
 * Les réponses restent génériques et rappellent de consulter un professionnel.
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

const AssistantService = {
  repondre(message: string): string {
    const t = normalize(message);
    if (!t) {
      return 'Écrivez votre question : je peux vous orienter sur les mesures, les rappels de médicaments ou les rendez-vous dans l’application.';
    }

    if (/urgence|112|15|18|douleur thorac|infarct|saign|perte de connaissance/.test(t)) {
      return 'En cas de symptômes graves ou d’urgence vitale, contactez immédiatement le 15 (SAMU) ou le 112, ou rendez-vous aux urgences. Cet assistant ne remplace pas un avis médical.';
    }

    if (/tension|mesure|mmhg|systol|diastol|hypertension/.test(t)) {
      return 'Pour le suivi tensionnel : enregistrez vos mesures dans « Mesures », au repos, de préférence à heure fixe. En cas de valeurs très élevées ou de malaise, consultez sans attendre votre cardiologue ou les urgences. Les objectifs (TA cible) sont indiqués par votre médecin dans votre profil lorsqu’ils sont renseignés.';
    }

    if (/medicament|prise|comprime|observance|rappel/.test(t)) {
      return 'Les rappels de prises se configurent dans « Rappels ». Respectez la posologie prescrite ; en cas d’effet indésirable ou de doute, parlez-en à votre médecin ou pharmacien.';
    }

    if (/rdv|rendez-vous|teleconsult|video|consultation/.test(t)) {
      return 'Les rendez-vous et téléconsultations se gèrent dans « RDV ». Vous pouvez aussi échanger par messages avec votre cardiologue assigné.';
    }

    if (/rapport|export|pdf|imprimer/.test(t)) {
      return 'Vous pouvez prévisualiser ou télécharger votre rapport depuis la page « Rapports » (boutons prévisualiser / exporter).';
    }

    if (/bonjour|salut|hello|coucou/.test(t)) {
      return 'Bonjour. Je peux vous aider à vous repérer dans l’application (mesures, rappels, rendez-vous, rapports). Posez une question précise.';
    }

    return 'Je n’ai pas assez d’informations pour répondre précisément. Pour un avis médical personnalisé, contactez votre cardiologue via « Messages » ou lors d’une consultation. Sinon, précisez : mesures, médicaments, rendez-vous ou rapports.';
  },
};

export default AssistantService;
