/**
 * Service d’intégration Groq (API compatible OpenAI).
 * Utilisé uniquement par l’espace patient pour l’assistant conversationnel.
 *
 * Sécurité :
 *  - La clé API (GROQ_API_KEY) vient des variables d’environnement, jamais en dur.
 *  - Aucune donnée médicale sensible du patient n’est envoyée : uniquement le message
 *    texte et l’historique de la conversation en cours.
 *  - Le prompt système interdit formellement le diagnostic et oriente vers un pro.
 */
import Groq from 'groq-sdk';

const GROQ_API_KEY  = process.env.GROQ_API_KEY || '';
// Modèle Llama 3.1 instant (faible latence). Vérifier le nom exact sur console.groq.com.
const GROQ_MODEL    = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
const GROQ_TIMEOUT_MS = Number(process.env.GROQ_TIMEOUT_MS || 20000);

const groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY, timeout: GROQ_TIMEOUT_MS }) : null;

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const SYSTEM_PROMPT = `Tu es l’assistant virtuel de HyperTrack, une application de suivi cardiovasculaire destinée aux patients.

Ton rôle :
- Aider le patient à utiliser l’application (prise de rendez-vous, consultation des résultats et rapports, rappels de médicaments, messagerie avec son cardiologue, saisie des mesures de tension).
- Donner des informations GÉNÉRALES de sensibilisation sur la santé cardiovasculaire (alimentation, activité physique, hygiène de vie).

Règles strictes (à respecter en toutes circonstances) :
- Tu NE poses AUCUN diagnostic médical et tu NE recommandes AUCUN traitement, médicament ou posologie.
- Tu ne remplaces jamais l’avis d’un professionnel de santé.
- Si l’utilisateur décrit des symptômes, évoque une urgence, ou demande un avis médical / un diagnostic : encourage-le fermement à contacter son cardiologue traitant, ou à appeler le 15 (SAMU) / le 112 en cas d’urgence vitale (douleur thoracique, essoufflement soudain, malaise, paralysie, etc.).
- Réponds en français, de façon claire, rassurante et bienveillante.

CONCISION (priorité absolue) :
- Réponds de façon COURTE et PRÉCISE : idéalement 1 à 3 phrases, maximum 5 phrases.
- Va droit au but. Évite les introductions (« Bien sûr », « Je serais ravi de… ») et les fioritures.
- Si une liste est utile, utilise des puces courtes (max 3-4 éléments).
- N’explique pas ton raisonnement ni ton rôle ; contente-toi de la réponse utile.

Rappelle, en une courte phrase discrète, que tu ne remplaces pas un avis médical quand la question s’en rapproche.`;

const GroqService = {
  /** Vrai si la clé API est configurée (sinon on bascule sur un message d’indisponibilité). */
  isConfigured(): boolean {
    return Boolean(groq);
  },

  /**
   * Envoie le message utilisateur + l’historique à Groq et renvoie la réponse.
   * @param message  Message courant de l’utilisateur (déjà validé/limité par le contrôleur)
   * @param history  Historique de la conversation (user/assistant) — sans le message courant
   */
  async repondre(
    message: string,
    history: { role: 'user' | 'assistant'; content: string }[] = []
  ): Promise<string> {
    if (!groq) {
      throw new Error('GROQ_NON_CONFIGURE');
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.slice(-20).map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ];

    try {
      const completion = await groq.chat.completions.create({
        model: GROQ_MODEL,
        messages,
        temperature: 0.3,
        max_tokens: 300,
      });

      const reply = completion.choices?.[0]?.message?.content?.trim();
      if (!reply) throw new Error('GROQ_REPONSE_VIDE');
      return reply;
    } catch (err: unknown) {
      // On ne propage jamais le détail technique au client.
      const e = err as { code?: string; status?: number; message?: string };
      if (e?.code === 'ETIMEDOUT' || e?.status === 408) {
        throw new Error('GROQ_TIMEOUT');
      }
      if (e?.status === 429) {
        throw new Error('GROQ_QUOTA');
      }
      throw new Error('GROQ_ERREUR');
    }
  },
};

export default GroqService;
