/**
 * Le vrai serveur du jeu, monte pour un scenario de bout en bout.
 *
 * C'EST LE MEME MONTAGE QUE CELUI DE principal.ts: les murs des cartes decodes,
 * la page empaquetee et les ressources servies par Express, avec la politique de
 * securite du contenu. Seul le port change: zero, pour que le systeme en choisisse
 * un libre et que deux scenarios paralleles ne se marchent pas dessus.
 *
 * UN SERVEUR PAR SCENARIO. « Partie rapide » mene a la premiere partie publique
 * qui attend dans son salon (etape 2.4). Deux scenarios qui partageraient un serveur
 * se retrouveraient donc dans le meme salon, et l'hote de l'un serait l'invite de
 * l'autre.
 *
 * SANS BASE, ET SANS COMPTES PAR DEFAUT, comme le serveur reel sans DATABASE_URL: on
 * joue en invites. Un scenario qui a besoin de comptes en fournit, tenus en memoire
 * (tests/outils/comptes-en-memoire.ts); rien n'est ajoute au jeu pour lui.
 *
 * IL S'ETEINT ET SE RALLUME SUR LE MEME PORT (etape 2.6), comme un serveur qui
 * redemarre pour une mise en ligne: les pages ouvertes perdent leur lien, ne
 * joignent plus rien, puis retrouvent le serveur a la meme adresse. Les parties,
 * elles, ne survivent pas a l'extinction, comme en production.
 *
 * Le serveur est importe depuis sa compilation, que la configuration Playwright
 * produit avant les scenarios (harnais/compiler.ts), comme le client empaquete.
 */

import { DOSSIER_WEB } from '../../../packages/client/scripts/empaqueter.js';
import type {
  GameRoom,
  OptionsServeur,
  ServeurMonte,
  ServiceDeComptes,
} from '../../../packages/server/dist/index.js';
import {
  ChargeurDeTerrain,
  demarrerServeur,
  racineRessources,
} from '../../../packages/server/dist/index.js';

/** Ce qu'un scenario peut ajouter au serveur. */
export interface OptionsDuJeu {
  /** Des comptes, pour les scenarios qui en ont besoin. */
  readonly comptes?: ServiceDeComptes;
}

/** Un serveur de jeu en marche. */
export interface ServeurDeJeu {
  /** L'adresse de la page, par exemple http://127.0.0.1:51234. */
  readonly url: string;
  /**
   * La partie ouverte sur ce serveur, lue dans le serveur lui-meme.
   *
   * C'EST L'ARBITRE DES SCENARIOS, ET IL NE SERT QU'A LIRE. Le serveur tourne dans
   * le processus du scenario: celui-ci peut donc consulter l'etat qui fait foi,
   * pour savoir ou se trouvent les joueurs et pour comparer ce que chaque page
   * affiche a ce que le moteur a decide. Un scenario n'y ecrit jamais: tout ce qui
   * change la partie passe par les pages, comme pour un vrai joueur.
   *
   * Les scenarios reunissent leurs joueurs dans une seule partie: par la partie
   * rapide, par la liste ou par un code. En trouver zero ou plusieurs est une
   * erreur du scenario, signalee comme telle.
   */
  partie(): GameRoom;
  /** Eteint le serveur: les pages perdent leur lien, et ne le retrouvent pas. */
  eteindre(): Promise<void>;
  /** Rallume le serveur eteint, sur le meme port. */
  rallumer(): Promise<void>;
  arreter(): Promise<void>;
}

/** Demarre le serveur de jeu sur un port libre. */
export async function demarrerLeJeu(options: OptionsDuJeu = {}): Promise<ServeurDeJeu> {
  const montage: OptionsServeur = {
    terrains: new ChargeurDeTerrain(),
    fichiers: { client: DOSSIER_WEB, ressources: racineRessources() },
    ...(options.comptes === undefined ? {} : { comptes: options.comptes }),
  };

  let serveur: ServeurMonte | undefined = await demarrerServeur(0, montage);

  const adresse = serveur.http.address();

  if (typeof adresse !== 'object' || adresse === null) {
    throw new Error("Le serveur de jeu n'a pas d'adresse.");
  }

  const port = adresse.port;

  /** Le serveur allume, en echouant clairement s'il est eteint. */
  const allume = (): ServeurMonte => {
    if (serveur === undefined) {
      throw new Error('Le serveur de jeu est eteint.');
    }

    return serveur;
  };

  const eteindre = async (): Promise<void> => {
    const enMarche = serveur;
    serveur = undefined;
    await enMarche?.fermer();
  };

  return {
    url: `http://127.0.0.1:${String(port)}`,
    partie: () => {
      const parties = allume().jeu.rooms.toutesLesRooms;
      const [unique] = parties;

      if (parties.length !== 1 || unique === undefined) {
        throw new Error(
          `Le scenario attend une seule partie sur son serveur, il y en a ${String(parties.length)}.`,
        );
      }

      return unique;
    },
    eteindre,
    rallumer: async () => {
      if (serveur === undefined) {
        serveur = await demarrerServeur(port, montage);
      }
    },
    arreter: eteindre,
  };
}
