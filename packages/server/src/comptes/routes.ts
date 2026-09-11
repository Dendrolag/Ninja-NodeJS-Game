/**
 * Les routes HTTP des comptes: inscription, connexion, deconnexion, progression et
 * profil.
 *
 * CE FICHIER TRADUIT, IL NE DECIDE RIEN. Il lit la requete (corps JSON, jeton en
 * en-tete, adresse), appelle le service, et traduit sa reponse en code HTTP. Toute
 * decision (validation, limite de tentatives, verification du mot de passe) est
 * dans le service, qui se teste sans HTTP.
 *
 * SANS SERVICE, LES COMPTES SONT INDISPONIBLES, PAS ABSENTS. Un serveur lance sans
 * base (developpement local, scenarios de bout en bout) joue en invites seulement.
 * Ses routes de comptes repondent 503 avec une explication, plutot qu'un 404 qui
 * laisserait croire a une adresse erronee.
 *
 * LE CONTROLE D'ACCES DU NAVIGATEUR. Le client est prevu sur un autre domaine que
 * le serveur: le navigateur n'y laisse lire les reponses que si le serveur autorise
 * explicitement l'origine de la page. La liste est celle de Socket.IO
 * (ORIGINES_AUTORISEES). Aucun cookie ne circule: la session est un jeton que le
 * client joint lui-meme, donc aucune autorisation d'envoyer des cookies n'est
 * donnee.
 */

import type { ReponseRefusee } from '@neon-ninja/shared';
import { PREFIXE_JETON_HTTP, validerJeton } from '@neon-ninja/shared';
import type { ErrorRequestHandler, Request, RequestHandler, Response } from 'express';
import express from 'express';

import type { MotifDeRefus, ReponseDeCompte, ServiceDeComptes } from './annuaire.js';

/** Taille maximale d'un corps de requete. Une demande de compte tient en quelques centaines d'octets. */
const TAILLE_MAXIMUM_CORPS = '4kb';

/** Le code HTTP de chaque motif de refus. */
const CODES_DES_REFUS: Record<MotifDeRefus, number> = {
  demandeInvalide: 400,
  pseudoPris: 409,
  identifiantsIncorrects: 401,
  sessionAbsente: 401,
  tropDeTentatives: 429,
};

/**
 * Les routes des comptes, a monter sous RACINE_API_COMPTES.
 *
 * @param service Le service des comptes. Absent: les comptes sont indisponibles.
 * @param originesAutorisees Les origines dont une page peut appeler ces routes.
 */
export function routesDesComptes(
  service: ServiceDeComptes | undefined,
  originesAutorisees: readonly string[],
): express.Router {
  const routes = express.Router();

  routes.use(entetesDesComptes(originesAutorisees));

  if (service === undefined) {
    routes.use(comptesIndisponibles);

    return routes;
  }

  routes.use(express.json({ limit: TAILLE_MAXIMUM_CORPS }));

  routes.post('/inscription', async (requete, reponse) => {
    repondre(reponse, await service.inscrire(requete.body, adresseDe(requete)), 201);
  });

  routes.post('/connexion', async (requete, reponse) => {
    repondre(reponse, await service.connecter(requete.body, adresseDe(requete)), 200);
  });

  routes.post('/deconnexion', async (requete, reponse) => {
    const jeton = jetonDe(requete);
    if (jeton === undefined) {
      refuserSansSession(reponse);
      return;
    }

    await service.deconnecter(jeton);
    reponse.status(204).end();
  });

  routes.get('/moi', async (requete, reponse) => {
    const jeton = jetonDe(requete);
    if (jeton === undefined) {
      refuserSansSession(reponse);
      return;
    }

    repondre(reponse, await service.maProgression(jeton), 200);
  });

  routes.get('/profil', async (requete, reponse) => {
    const jeton = jetonDe(requete);
    if (jeton === undefined) {
      refuserSansSession(reponse);
      return;
    }

    repondre(reponse, await service.profil(jeton), 200);
  });

  routes.use((_requete, reponse) => {
    envoyerRefus(reponse, 404, 'route', "Cette adresse n'existe pas.");
  });
  routes.use(erreurDesRoutes);

  return routes;
}

/**
 * Les en-tetes communs a toutes les reponses des comptes, et la reponse aux
 * demandes preliminaires du navigateur.
 */
function entetesDesComptes(originesAutorisees: readonly string[]): RequestHandler {
  return (requete, reponse, suite) => {
    // Une reponse qui porte un jeton ou une progression ne se garde dans aucun cache.
    reponse.setHeader('Cache-Control', 'no-store');
    reponse.setHeader('X-Content-Type-Options', 'nosniff');
    // La reponse depend de l'origine: un cache intermediaire doit le savoir.
    reponse.setHeader('Vary', 'Origin');

    const origine = requete.headers.origin;

    if (origine !== undefined && originesAutorisees.includes(origine)) {
      reponse.setHeader('Access-Control-Allow-Origin', origine);
      reponse.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      reponse.setHeader('Access-Control-Allow-Methods', 'GET, POST');
      reponse.setHeader('Access-Control-Max-Age', '600');
    }

    // La demande preliminaire du navigateur n'attend que les en-tetes ci-dessus.
    if (requete.method === 'OPTIONS') {
      reponse.status(204).end();
      return;
    }

    suite();
  };
}

/** La reponse de toutes les routes quand le serveur n'a pas de base. */
const comptesIndisponibles: RequestHandler = (_requete, reponse) => {
  envoyerRefus(reponse, 503, 'comptes', 'Les comptes sont indisponibles sur ce serveur.');
};

/**
 * La reponse aux erreurs: celles du lecteur de JSON, et les pannes.
 *
 * Un corps illisible ou trop gros est une faute du demandeur, que le lecteur de
 * JSON signale avec son code (400, 413): on la lui dit. Tout le reste est une
 * panne du serveur, journalisee, et le demandeur n'en apprend rien d'autre qu'une
 * erreur interne: le detail d'une exception n'a pas a sortir.
 */
const erreurDesRoutes: ErrorRequestHandler = (erreur: unknown, _requete, reponse, _suite) => {
  const statut = statutDeErreur(erreur);

  if (statut !== undefined && statut >= 400 && statut < 500) {
    envoyerRefus(reponse, statut, 'requete', 'Cette requête est illisible ou trop volumineuse.');
    return;
  }

  console.error('Erreur dans une route des comptes:', erreur);
  envoyerRefus(reponse, 500, 'serveur', 'Erreur interne du serveur. Réessayez plus tard.');
};

/** Le code HTTP porte par une erreur du lecteur de JSON, s'il y en a un. */
function statutDeErreur(erreur: unknown): number | undefined {
  if (typeof erreur !== 'object' || erreur === null || !('status' in erreur)) {
    return undefined;
  }

  return typeof erreur.status === 'number' ? erreur.status : undefined;
}

/** Traduit une reponse du service en reponse HTTP. */
function repondre<T>(reponse: Response, resultat: ReponseDeCompte<T>, statutSucces: number): void {
  if (resultat.acceptee) {
    reponse.status(statutSucces).json(resultat.valeur);
    return;
  }

  if (resultat.reessayerDansMs !== undefined) {
    reponse.setHeader(
      'Retry-After',
      String(Math.max(1, Math.ceil(resultat.reessayerDansMs / 1000))),
    );
  }

  if (resultat.motif === 'sessionAbsente') {
    reponse.setHeader('WWW-Authenticate', 'Bearer');
  }

  const corps: ReponseRefusee = { erreurs: resultat.erreurs };
  reponse.status(CODES_DES_REFUS[resultat.motif]).json(corps);
}

/** Refuse une demande reservee aux comptes, faute de jeton lisible. */
function refuserSansSession(reponse: Response): void {
  reponse.setHeader('WWW-Authenticate', 'Bearer');
  envoyerRefus(reponse, 401, 'session', 'Session absente ou expirée. Connectez-vous.');
}

/** Envoie un refus a un seul motif. */
function envoyerRefus(reponse: Response, statut: number, champ: string, motif: string): void {
  const corps: ReponseRefusee = { erreurs: [{ champ, motif }] };
  reponse.status(statut).json(corps);
}

/**
 * Le jeton de la requete, lu dans « Authorization: Bearer <jeton> ».
 *
 * Un en-tete absent, d'une autre forme, ou un jeton mal forme donnent undefined:
 * aucun n'a pu etre emis par le serveur.
 */
function jetonDe(requete: Request): string | undefined {
  const entete = requete.headers.authorization;

  if (entete === undefined || !entete.startsWith(PREFIXE_JETON_HTTP)) {
    return undefined;
  }

  const verdict = validerJeton(entete.slice(PREFIXE_JETON_HTTP.length));

  return verdict.valide ? verdict.valeur : undefined;
}

/**
 * L'adresse du demandeur, pour les limites de tentatives.
 *
 * Derriere un mandataire (l'hebergeur place souvent le sien devant le serveur),
 * l'adresse vue est celle du mandataire: tous les joueurs partageraient alors une
 * seule limite. Express lit la vraie adresse dans l'en-tete X-Forwarded-For, mais
 * seulement si on lui dit combien de mandataires croire (MANDATAIRES_DE_CONFIANCE,
 * voir serveur.ts). Sans ce reglage, l'en-tete est ignore: un client ne peut pas
 * s'inventer une adresse pour echapper a sa limite.
 */
function adresseDe(requete: Request): string {
  return requete.ip ?? requete.socket.remoteAddress ?? 'inconnue';
}
