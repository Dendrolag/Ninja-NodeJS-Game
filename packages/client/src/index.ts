/**
 * Point d'entree du client.
 *
 * Separation stricte entre l'etat et le rendu: un magasin d'etat unique d'un
 * cote, PixiJS pour le rendu in-game et le DOM pour les menus de l'autre.
 * Aucune variable globale mutable, c'etait le defaut central du client d'origine.
 *
 * La boucle de rendu est independante du reseau: le legacy n'affichait qu'a la
 * cadence des messages recus, ce qui plafonnait le jeu a 20 images par seconde.
 *
 * CE QUE L'ETAPE 4.1 A POSE, et comment les morceaux s'emboitent:
 *
 *   reseau (transport)  ->  client (cablage)  ->  magasin (etat)  ->  affichage
 *
 *   - reseau, l'interface du transport, et son implementation Socket.IO. Le
 *     reste du client ne sait pas comment les messages voyagent. C'est ce qui
 *     permettra a l'etape 2.3 de passer au delta binaire sans toucher au reste.
 *   - reconstruction, le seul endroit qui sache comment le flux d'etat est fait.
 *     Il rend une VuePartie, que le rendu de l'etape 4.2 lira.
 *   - actions et reduction, la seule maniere de faire changer l'etat: on decrit
 *     ce qui est arrive, une fonction pure calcule l'etat suivant.
 *   - magasin, le detenteur unique de cet etat, avec ses abonnes.
 *   - ecrans, la seule reponse a la question de savoir quel ecran afficher.
 *   - client, le cablage entre les trois, et les commandes du joueur.
 *   - selecteurs, les questions que l'affichage pose a l'etat.
 *
 * CE QUI N'EST PAS ENCORE LA: le rendu PixiJS (etape 4.2), les ecrans construits
 * pour de vrai et la saisie clavier (etape 4.3).
 */

export type { Action } from './actions.js';

export type { Client, OptionsClient } from './client.js';
export { creerClient } from './client.js';

export type { Ecran } from './ecrans.js';
export { ecranSuivant } from './ecrans.js';

export type { EffetActif, EtatClient, EtatConnexion, MessageAffiche } from './etat.js';
export { ETAT_INITIAL, MAX_JOURNAL, MAX_MESSAGES, refusDe } from './etat.js';

export type { ChargesDeFait, FaitDeJeu, NatureDeFait } from './faits.js';
export { fait } from './faits.js';

export type { HorlogeClient, HorlogeClientManuelle } from './horloge.js';
export { creerHorlogeClientManuelle, horlogeNavigateur } from './horloge.js';

export type { Magasin, Observateur } from './magasin.js';
export { creerMagasin } from './magasin.js';

export type { VuePartie } from './reconstruction.js';
export { entiteDe, reconstruire } from './reconstruction.js';

export { reduire } from './reduction.js';

export type {
  ArgumentsDescendants,
  ArgumentsMontants,
  MessageEmis,
  NomDescendant,
  NomMontant,
  Reseau,
  ReseauFactice,
} from './reseau.js';
export { creerReseauFactice } from './reseau.js';

export type { OptionsReseauSocketIo } from './reseauSocketIo.js';
export { creerReseauSocketIo } from './reseauSocketIo.js';

export {
  effetsEnCours,
  jeSuisHote,
  maLigneDeClassement,
  moiDansLaPartie,
  moiDansLeSalon,
  partieEnMouvement,
  resteDeLEffet,
} from './selecteurs.js';
