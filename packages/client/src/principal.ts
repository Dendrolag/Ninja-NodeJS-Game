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
 * L'ADRESSE DU SERVEUR ET LA VERSION SONT ECRITES PAR L'EMPAQUETEUR (etape 5.3). Il
 * remplace les deux constantes declarees ci-dessous par leur valeur; vides, la page
 * parle au serveur qui l'a servie, sans version, comme en developpement. Voir
 * configuration.ts.
 *
 * LA POLITIQUE DE SECURITE DU CONTENU interdit a la page d'evaluer du code fabrique
 * a la volee. PixiJS le fait par defaut pour accelerer ses shaders; son module
 * unsafe-eval le remplace par une version qui s'en passe. La politique est ecrite
 * dans le paquet partage (page.ts): c'est une defense de plus contre une injection
 * de code, la faille S1 du jeu d'origine.
 */

import 'pixi.js/unsafe-eval';

import { creerClient } from './client.js';
import { creerApiComptesHttp } from './comptes/api.js';
import { CLE_RETOUR, creerCoffreDeJeton } from './comptes/coffre.js';
import { configurationDeLaPage } from './configuration.js';
import { horlogeNavigateur } from './horloge.js';
import { monterApplication } from './interface/application.js';
import { monterJeu } from './interface/ecrans/jeu.js';
import { prechargerLaPartie } from './rendu/pixi.js';
import { creerReseauSocketIo } from './reseauSocketIo.js';
import type { LecteurDeSons } from './sons/lecteur.js';
import { creerLecteurDeSons } from './sons/lecteur.js';
import { garderEveilleDansLeNavigateur } from './eveil.js';

/** L'origine du serveur de jeu, ecrite par l'empaqueteur. Vide: celle de la page. */
declare const __SERVEUR_DE_JEU__: string;

/** Le commit dont la page est construite, ecrit par l'empaqueteur. Vide en developpement. */
declare const __VERSION_DU_JEU__: string;

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

/**
 * Le stockage de session du navigateur, s'il est permis d'y toucher (etape 2.5).
 *
 * Il garde le jeton de retour en partie: il survit au rechargement de l'onglet, pas
 * a sa fermeture. Refuse, le jeton vit en memoire, et un rechargement perd la place.
 */
function stockageDeSession(): Storage | undefined {
  try {
    return globalThis.sessionStorage;
  } catch {
    return undefined;
  }
}

/**
 * Previent quand la page a une raison de croire le reseau revenu (etape 2.6): elle
 * repasse au premier plan, ou le navigateur annonce le reseau retrouve. Un lien perdu
 * se rouvre alors sans attendre son prochain essai. Rend de quoi arreter d'ecouter.
 */
function surReseauRetrouve(gestionnaire: () => void): () => void {
  const surVisibilite = (): void => {
    if (document.visibilityState === 'visible') {
      gestionnaire();
    }
  };

  document.addEventListener('visibilitychange', surVisibilite);
  globalThis.addEventListener('online', gestionnaire);

  return () => {
    document.removeEventListener('visibilitychange', surVisibilite);
    globalThis.removeEventListener('online', gestionnaire);
  };
}

const hote = document.getElementById('application');

if (hote === null) {
  throw new Error("La page ne contient pas l'element #application ou monter le jeu.");
}

const stockage = stockageDuNavigateur();
const configuration = configurationDeLaPage(__SERVEUR_DE_JEU__, __VERSION_DU_JEU__);

const client = creerClient({
  reseau: creerReseauSocketIo(configuration),
  horloge: horlogeNavigateur,
  comptes: creerApiComptesHttp(configuration.url === undefined ? {} : { url: configuration.url }),
  coffre: creerCoffreDeJeton(stockage),
  coffreDeRetour: creerCoffreDeJeton(stockageDeSession(), CLE_RETOUR),
  surReseauRetrouve,
});

const sons = creerLecteurDeSons();
debloquerLeSon(sons);

monterApplication({
  hote,
  client,
  sons,
  horloge: horlogeNavigateur,
  monterLeJeu: monterJeu,
  // Un prechargement qui echoue n'a rien de grave: l'ecran de jeu recharge lui-meme
  // ce qui lui manque, et dit s'il n'y parvient pas.
  prechargerLeJeu: (reglages) => {
    prechargerLaPartie(reglages.carte, reglages.modeMiroir, reglages.pluie).catch(() => undefined);
  },
  ...(stockage === undefined ? {} : { stockage }),
});

// Le lien s'ouvre une fois l'application montee: elle montre deja qu'il s'etablit.
client.ouvrir();

// Le serveur de jeu reste eveille tant que la page est ouverte et visible (etape 5.5).
garderEveilleDansLeNavigateur(configuration.url);

/**
 * Debloque le son au premier geste du joueur, et a chaque geste suivant.
 *
 * Le son passe par Web Audio (etape 5.5), dont le contexte nait suspendu: le
 * navigateur ne le laisse repartir que pendant un geste. On ecoute donc les gestes
 * pour toute la vie de la page; hors du premier, l'appel est sans effet.
 *
 * Sous iOS, Web Audio se tait quand le telephone est en mode silencieux, a la
 * difference d'un element audio. Une session audio de type « lecture » le fait
 * sonner comme avant, la ou le navigateur la connait (Safari 16.4 et ses cousins).
 */
function debloquerLeSon(lecteur: LecteurDeSons): void {
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;

  if (session !== undefined) {
    session.type = 'playback';
  }

  const deverrouiller = (): void => {
    lecteur.deverrouiller();
  };

  for (const geste of ['pointerdown', 'touchend', 'keydown'] as const) {
    document.addEventListener(geste, deverrouiller, { capture: true, passive: true });
  }
}
