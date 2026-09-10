/**
 * Le vrai serveur du jeu, monte pour un scenario de bout en bout.
 *
 * C'EST LE MEME MONTAGE QUE CELUI DE principal.ts: les murs des cartes decodes,
 * la page empaquetee et les ressources servies par Express, avec la politique de
 * securite du contenu. Seul le port change: zero, pour que le systeme en choisisse
 * un libre et que deux scenarios paralleles ne se marchent pas dessus.
 *
 * UN SERVEUR PAR SCENARIO. Sans code ni identifiant, « Jouer » est la partie
 * rapide (etape 2.4): la premiere partie publique qui attend dans son salon. Deux
 * scenarios qui partageraient un serveur se retrouveraient donc dans le meme
 * salon, et l'hote de l'un serait l'invite de l'autre.
 *
 * Le serveur est importe depuis sa compilation, que la configuration Playwright
 * produit avant les scenarios (harnais/compiler.ts), comme le client empaquete.
 */

import { DOSSIER_WEB } from '../../../packages/client/scripts/empaqueter.js';
import type { GameRoom } from '../../../packages/server/dist/index.js';
import {
  ChargeurDeTerrain,
  demarrerServeur,
  racineRessources,
} from '../../../packages/server/dist/index.js';

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
   * Les scenarios entrent par la partie rapide, qui reunit tous les joueurs dans
   * la premiere partie publique en attente: un serveur de scenario n'a donc
   * qu'une partie. En trouver zero ou plusieurs est une erreur du scenario,
   * signalee comme telle.
   */
  partie(): GameRoom;
  arreter(): Promise<void>;
}

/** Demarre le serveur de jeu sur un port libre. */
export async function demarrerLeJeu(): Promise<ServeurDeJeu> {
  const serveur = await demarrerServeur(0, {
    terrains: new ChargeurDeTerrain(),
    fichiers: { client: DOSSIER_WEB, ressources: racineRessources() },
  });

  const adresse = serveur.http.address();

  if (typeof adresse !== 'object' || adresse === null) {
    throw new Error("Le serveur de jeu n'a pas d'adresse.");
  }

  return {
    url: `http://127.0.0.1:${String(adresse.port)}`,
    partie: () => {
      const parties = serveur.jeu.rooms.toutesLesRooms;
      const [unique] = parties;

      if (parties.length !== 1 || unique === undefined) {
        throw new Error(
          `Le scenario attend une seule partie sur son serveur, il y en a ${String(parties.length)}.`,
        );
      }

      return unique;
    },
    arreter: async () => serveur.fermer(),
  };
}
