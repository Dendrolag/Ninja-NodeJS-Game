/**
 * Le point de depart du jeu dans le navigateur: le seul fichier que la page charge.
 *
 * IL NE CONTIENT AUCUNE LOGIQUE. Il fabrique les pieces de production (le
 * transport Socket.IO, l'horloge du navigateur, le lecteur de sons, l'ecran de
 * jeu PixiJS) et les donne a l'application. Tout le reste se teste sans
 * navigateur, avec des pieces d'essai a la place de celles-ci.
 *
 * L'EMPAQUETEUR PART D'ICI (packages/client/scripts/empaqueter.ts). Il suit les
 * imports et produit un seul fichier pour la page. Ce fichier n'est pas exporte
 * par le paquet: l'importer executerait l'application.
 *
 * LA POLITIQUE DE SECURITE DU CONTENU interdit a la page d'evaluer du code fabrique
 * a la volee. PixiJS le fait par defaut pour accelerer ses shaders; son module
 * unsafe-eval le remplace par une version qui s'en passe. Le serveur pose cette
 * politique dans packages/server/src/fichiers.ts: c'est une defense de plus
 * contre une injection de code, la faille S1 du jeu d'origine.
 */

import 'pixi.js/unsafe-eval';

import { creerClient } from './client.js';
import { horlogeNavigateur } from './horloge.js';
import { monterApplication } from './interface/application.js';
import { monterJeu } from './interface/ecrans/jeu.js';
import { creerReseauSocketIo } from './reseauSocketIo.js';
import { creerLecteurDeSons } from './sons/lecteur.js';

/**
 * Le stockage du navigateur, s'il est permis d'y toucher.
 *
 * Un navigateur regle pour refuser les donnees de site leve une erreur a la
 * simple lecture de localStorage: le jeu doit demarrer quand meme.
 */
function stockageDuNavigateur(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

const hote = document.getElementById('application');

if (hote === null) {
  throw new Error("La page ne contient pas l'element #application ou monter le jeu.");
}

const stockage = stockageDuNavigateur();

monterApplication({
  hote,
  client: creerClient({ reseau: creerReseauSocketIo(), horloge: horlogeNavigateur }),
  sons: creerLecteurDeSons(),
  horloge: horlogeNavigateur,
  monterLeJeu: monterJeu,
  ...(stockage === undefined ? {} : { stockage }),
});
