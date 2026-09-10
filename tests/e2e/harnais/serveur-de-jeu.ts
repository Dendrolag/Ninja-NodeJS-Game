/**
 * Le vrai serveur du jeu, monte pour un scenario de bout en bout.
 *
 * C'EST LE MEME MONTAGE QUE CELUI DE principal.ts: les murs des cartes decodes,
 * la page empaquetee et les ressources servies par Express, avec la politique de
 * securite du contenu. Seul le port change: zero, pour que le systeme en choisisse
 * un libre et que deux scenarios paralleles ne se marchent pas dessus.
 *
 * UN SERVEUR PAR SCENARIO. Sans identifiant de partie, un joueur entre dans le
 * premier salon en attente (regle provisoire jusqu'a l'etape 2.4): deux scenarios
 * qui partageraient un serveur se retrouveraient dans le meme salon, et l'hote de
 * l'un serait l'invite de l'autre.
 *
 * Le serveur est importe depuis sa compilation, que la configuration Playwright
 * produit avant les scenarios (harnais/compiler.ts), comme le client empaquete.
 */

import { DOSSIER_WEB } from '../../../packages/client/scripts/empaqueter.js';
import {
  ChargeurDeTerrain,
  demarrerServeur,
  racineRessources,
} from '../../../packages/server/dist/index.js';

/** Un serveur de jeu en marche. */
export interface ServeurDeJeu {
  /** L'adresse de la page, par exemple http://127.0.0.1:51234. */
  readonly url: string;
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
    arreter: async () => serveur.fermer(),
  };
}
