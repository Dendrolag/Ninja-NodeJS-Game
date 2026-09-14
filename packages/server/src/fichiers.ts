/**
 * Le service des fichiers: la page du jeu, son code empaquete, et ses ressources.
 * Et la route de sante.
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
 * EN PRODUCTION, LE SERVEUR NE SERT AUCUN FICHIER (etape 5.3). La page et les
 * ressources y sont servies par Vercel, et le serveur de jeu garde son processeur
 * pour les parties. Ce service reste celui du developpement et des scenarios de
 * bout en bout.
 *
 * LA PAGE PORTE UNE POLITIQUE DE SECURITE DU CONTENU, ecrite dans le paquet
 * partage (page.ts) pour que l'hebergement de la page en production pose la meme.
 *
 * LA ROUTE DE SANTE DIT CE QUE LE SERVEUR FAIT TOURNER (etape 5.3). L'hebergeur
 * l'interroge pour savoir si une mise en ligne a demarre; le deploiement, pour
 * verifier que la version en ligne est la bonne; l'exploitation, pour voir combien
 * de parties et de joueurs le serveur porte. Elle rend aussi l'adresse sous
 * laquelle le serveur voit celui qui demande: c'est la seule facon de verifier, une
 * fois en ligne, que MANDATAIRES_DE_CONFIANCE correspond aux mandataires de
 * l'hebergeur. Le demandeur n'y apprend que sa propre adresse.
 */

import { RACINE_API_COMPTES, RACINE_RESSOURCES, politiqueDeContenu } from '@neon-ninja/shared';
import type { Express, RequestHandler } from 'express';
import express from 'express';

/** Les dossiers a servir. */
export interface DossiersServis {
  /** Le client empaquete: index.html, app.js, styles.css, les polices et les icones. */
  readonly client: string;
  /** Les ressources du jeu: cartes, sprites, icones d'objets et sons. */
  readonly ressources: string;
}

/** La politique de securite du contenu de la page, quand ce serveur la sert lui-meme. */
export const POLITIQUE_DE_CONTENU = politiqueDeContenu();

/** Ce que repond le serveur a qui demande s'il tourne. */
export const MESSAGE_DE_SANTE = 'Neon Ninja: le serveur tourne.';

/** Ce que le serveur sait de son activite, lu a chaque question de sante. */
export interface ActiviteDuServeur {
  /** La version du jeu, le commit dont le serveur est construit. Absente en developpement. */
  readonly version: string | undefined;
  /** Les parties ouvertes, salons compris. */
  readonly parties: number;
  /** Les joueurs presents dans ces parties. */
  readonly joueurs: number;
  /** Les connexions ouvertes, entrees dans une partie ou non. */
  readonly connexions: number;
}

/** La reponse de la route de sante, en JSON. */
export interface ReponseDeSante {
  readonly message: string;
  /** La version du jeu, ou null en developpement. */
  readonly version: string | null;
  readonly parties: number;
  readonly joueurs: number;
  readonly connexions: number;
  /** L'adresse sous laquelle le serveur voit le demandeur, mandataires de confiance compris. */
  readonly adresse: string | null;
}

/** L'activite d'une application montee sans couche jeu. */
function sansActivite(): ActiviteDuServeur {
  return { version: undefined, parties: 0, joueurs: 0, connexions: 0 };
}

/**
 * L'application web: la route de sante, et les fichiers si on les demande.
 *
 * SANS DOSSIERS, AUCUN FICHIER N'EST SERVI, et la racine repond comme la route de
 * sante. C'est le cas des serveurs montes par les tests, qui verifient des
 * messages et n'ont pas de page a servir, et celui du serveur de production.
 *
 * @param activite Lue a chaque question de sante: la couche jeu n'existe pas
 *                 encore quand l'application est montee.
 */
export function applicationWeb(
  dossiers?: DossiersServis,
  comptes?: RequestHandler,
  activite: () => ActiviteDuServeur = sansActivite,
): Express {
  const application = express();
  const repondreSante = routeDeSante(activite);

  // Annoncer la bibliotheque et sa version n'aide que celui qui cherche une faille.
  application.disable('x-powered-by');
  application.get('/sante', repondreSante);

  // Les routes des comptes (etape 3.2) passent avant les fichiers: une adresse de
  // l'API ne doit jamais tomber sur un fichier du meme nom.
  if (comptes !== undefined) {
    application.use(RACINE_API_COMPTES, comptes);
  }

  if (dossiers === undefined) {
    application.get('/', repondreSante);

    return application;
  }

  application.use(entetesDeSecurite);
  application.use(RACINE_RESSOURCES, express.static(dossiers.ressources, { index: false }));
  application.use(express.static(dossiers.client, { index: 'index.html' }));

  return application;
}

/** La route qui repond a la question de sante. */
function routeDeSante(activite: () => ActiviteDuServeur): RequestHandler {
  return (requete, reponse) => {
    const { version, parties, joueurs, connexions } = activite();
    const corps: ReponseDeSante = {
      message: MESSAGE_DE_SANTE,
      version: version ?? null,
      parties,
      joueurs,
      connexions,
      adresse: requete.ip ?? null,
    };

    // Une reponse d'hier ne dit rien du serveur d'aujourd'hui.
    reponse.setHeader('Cache-Control', 'no-store');
    reponse.json(corps);
  };
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
