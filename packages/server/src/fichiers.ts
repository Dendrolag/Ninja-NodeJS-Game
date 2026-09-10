/**
 * Le service des fichiers: la page du jeu, son code empaquete, et ses ressources.
 *
 * EXPRESS ARRIVE ICI, ET POUR CE TRAVAIL-LA. Le handoff 2.2 avait refuse de
 * l'ajouter tant qu'il n'y avait rien a servir (decision du 14 aout 2026). Il y a
 * maintenant une page, et servir des fichiers correctement demande plus qu'il n'y
 * parait: les requetes partielles, sans lesquelles un navigateur ne sait pas
 * reprendre un son au debut, les dates de modification pour le cache, le refus
 * des chemins qui remontent hors du dossier. express.static fait tout cela et
 * est entretenu; le reecrire serait recreer une surface d'attaque.
 *
 * LES DEUX DOSSIERS SONT NOMMES, RIEN D'AUTRE N'EST SERVI. Le client empaquete a
 * la racine, les ressources sous /assets, a l'adresse que le client demande
 * (RACINE_RESSOURCES, dans le paquet partage). Un serveur qui servirait le depot
 * entier servirait aussi ce qui traine a cote.
 *
 * LA PAGE PORTE UNE POLITIQUE DE SECURITE DU CONTENU. Elle interdit a la page de
 * charger ou d'executer quoi que ce soit qui ne vienne pas du serveur lui-meme.
 * C'est une defense de plus contre la faille S1 du jeu d'origine: meme si un texte
 * de joueur parvenait un jour a s'inserer comme du balisage, le navigateur
 * refuserait d'executer le script qu'il contiendrait.
 */

import { RACINE_RESSOURCES } from '@neon-ninja/shared';
import type { Express, Request, RequestHandler, Response } from 'express';
import express from 'express';

/** Les dossiers a servir. */
export interface DossiersServis {
  /** Le client empaquete: index.html, app.js, styles.css, les polices et les icones. */
  readonly client: string;
  /** Les ressources du jeu: cartes, sprites, icones d'objets et sons. */
  readonly ressources: string;
}

/**
 * La politique de securite du contenu de la page.
 *
 * Chaque ligne a sa raison:
 *   - tout vient du serveur lui-meme, scripts, styles, polices, sons et connexion;
 *   - les images acceptent aussi data: et blob:, parce que PixiJS decode les
 *     textures dans un travailleur qui lui rend des objets blob;
 *   - les travailleurs acceptent blob: pour la meme raison;
 *   - rien ne peut encadrer la page, ni changer l'adresse de base de ses liens, ni
 *     envoyer un formulaire ailleurs.
 *
 * Elle interdit aussi l'evaluation de code fabrique a la volee; le client charge
 * pour cela le module unsafe-eval de PixiJS, qui s'en passe.
 */
export const POLITIQUE_DE_CONTENU = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "media-src 'self'",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

/** Ce que repond le serveur a qui demande s'il tourne. */
export const MESSAGE_DE_SANTE = 'Neon Ninja: le serveur tourne.';

/**
 * L'application web: la route de sante, et les fichiers si on les demande.
 *
 * SANS DOSSIERS, AUCUN FICHIER N'EST SERVI, et la racine repond comme la route de
 * sante. C'est le cas des serveurs montes par les tests, qui verifient des
 * messages et n'ont pas de page a servir, et c'etait le comportement du serveur
 * avant cette etape.
 */
export function applicationWeb(dossiers?: DossiersServis): Express {
  const application = express();

  // Annoncer la bibliotheque et sa version n'aide que celui qui cherche une faille.
  application.disable('x-powered-by');
  application.get('/sante', repondreSante);

  if (dossiers === undefined) {
    application.get('/', repondreSante);

    return application;
  }

  application.use(entetesDeSecurite);
  application.use(RACINE_RESSOURCES, express.static(dossiers.ressources, { index: false }));
  application.use(express.static(dossiers.client, { index: 'index.html' }));

  return application;
}

/** Repond a la question de sante. */
function repondreSante(_requete: Request, reponse: Response): void {
  reponse.type('text/plain; charset=utf-8').send(MESSAGE_DE_SANTE);
}

/** Pose les en-tetes de securite sur toutes les reponses de fichiers. */
const entetesDeSecurite: RequestHandler = (_requete, reponse, suite) => {
  reponse.setHeader('Content-Security-Policy', POLITIQUE_DE_CONTENU);
  // Un fichier est ce que son type annonce: pas d'interpretation d'un texte
  // comme un script.
  reponse.setHeader('X-Content-Type-Options', 'nosniff');
  reponse.setHeader('Referrer-Policy', 'no-referrer');
  suite();
};
