/**
 * Le moteur: une fonction qui fait avancer une partie d'un battement.
 *
 *     const suivant = tick(etat, entrees, dt);
 *
 * Trois regles gouvernent ce fichier, et elles ne se negocient pas:
 *
 *   1. Rien n'est modifie sur place. tick renvoie un nouvel etat.
 *   2. Le temps arrive par dt, en millisecondes. Le moteur ne lit jamais
 *      l'horloge. Il n'y a donc aucune cadence implicite: en terrain degage,
 *      appeler le moteur vingt fois avec dt de 50, ou une fois avec dt de 1000,
 *      produit le meme deplacement. Pres d'un mur, en revanche, un pas de temps
 *      fin approche davantage du mur qu'un pas grossier: un deplacement bloque
 *      n'a pas lieu du tout, et plus le pas est grand, plus tot il est refuse.
 *      C'est la contrepartie normale d'un monde solide.
 *   3. Le hasard passe par le generateur a graine transporte dans l'etat.
 *
 * La consequence la plus visible est que la vitesse ne depend plus du debit de
 * messages du client, ce qui etait la faille S2 de l'audit: dans le legacy, un
 * client qui envoyait ses deplacements deux fois plus vite se deplacait deux
 * fois plus vite. Ici, le deplacement est proportionnel au temps ecoule.
 *
 * Un battement se deroule dans cet ordre:
 *
 *   1. le journal du battement precedent est efface;
 *   2. chaque joueur applique son entree et se deplace contre le terrain, puis
 *      voit ses protections et ses effets se rapprocher de leur fin;
 *   3. les bots errent, les bots noirs chassent, et de nouveaux bots noirs
 *      entrent en jeu quand leur heure est venue;
 *   4. les zones speciales vieillissent, apparaissent, et agissent sur les bots;
 *   5. les bonus et malus poses vieillissent, et de nouveaux apparaissent;
 *   6. le mode de jeu agit sur les entrees: rien en Classique; en Tactique, les
 *      joueurs s'orientent, rechargent et tirent;
 *   7. on releve les contacts entre entites et on en tire les consequences,
 *      captures comprises, selon le mode;
 *   8. les joueurs ramassent les objets sur lesquels ils se trouvent.
 *
 * Une partie SUSPENDUE ne fait rien de tout cela. Le battement a bien lieu, mais
 * le temps de jeu ne s'ecoule pas: voir battementSuspendu, plus bas.
 *
 * Les bots avancent avant les zones parce que c'est l'ordre du legacy: sa boucle
 * appelait updateBots puis sendUpdates, et c'est cette derniere qui appliquait
 * les effets de zone (server.js:2799).
 *
 * L'ordre des deux dernieres etapes est celui du legacy lui aussi: dans
 * detectCollisions, un joueur resolvait ses captures avant de ramasser ce qui
 * trainait a ses pieds. Un bonus d'invincibilite ramasse ne protege donc qu'a
 * partir du battement suivant.
 */

import type { IntentionDeplacement, Vecteur } from '@neon-ninja/shared';
import { VITESSES } from '@neon-ninja/shared';

import { avancerLesBots } from './bots.js';
import type { RegleDeResolution } from './contacts.js';
import { detecterContacts, regleClassique, regleTactique, resoudreContacts } from './contacts.js';
import { resoudreDeplacement } from './deplacement.js';
import { aLaLongueur, directionDuVecteur, norme } from './direction.js';
import { fairePasserLeTemps } from './effets.js';
import type { EtatPartie, IdentifiantEntite, Joueur } from './etat.js';
import { COMPTEUR_CAPTURE_PRET, bonusActif, malusActif } from './etat.js';
import {
  faireApparaitreLesObjets,
  fairePasserLeTempsSurLesObjets,
  ramasserLesObjets,
} from './objets.js';
import { agirEnTactique } from './tactique.js';
import { appliquerLesEffetsDeZone, avancerLesZones } from './zones.js';

/**
 * Ce qu'un joueur demande au moteur pendant un battement.
 *
 * Le contrat du deplacement vit dans packages/shared sous le nom
 * IntentionDeplacement, parce que trois couches doivent en parler: le client qui
 * l'emet, la couche reseau qui le valide, et le moteur qui le consomme. Le nom
 * local est conserve pour que le moteur garde son vocabulaire: une entree, c'est
 * ce qui entre dans un battement.
 *
 * Il ne contient QUE des intentions. Aucun champ d'etat n'y a sa place: ni bonus,
 * ni appareil, ni vitesse. Voir le commentaire de IntentionDeplacement pour ce que
 * le legacy y mettait, et ce que cela permettait.
 *
 * UNE DEMANDE DE TIR S'Y AJOUTE pour le mode Tactique (etape 7.1). Elle est
 * PONCTUELLE, a l'inverse du deplacement: le moteur la joue dans le battement qui
 * la recoit, et c'est a l'appelant de ne pas la lui repasser au battement suivant.
 * Le deplacement, lui, vaut jusqu'a ce qu'un autre le remplace. Dans une partie
 * Classique, la demande est ignoree.
 */
export interface EntreeJoueur extends IntentionDeplacement {
  /** Le joueur tire pendant ce battement. */
  readonly capturer?: true;
}

/**
 * Les entrees de tous les joueurs pour un battement, indexees par identifiant.
 *
 * UN JOUEUR, UNE INTENTION, UN BATTEMENT. Cette table est ce qui rend impossible
 * la faille S2 du legacy: le serveur y range la derniere intention connue de
 * chaque joueur, et le moteur en tire un seul deplacement, borne par dt. Qu'un
 * client ait envoye un message ou mille depuis le battement precedent ne change
 * donc rien a la distance qu'il parcourt. Le legacy, lui, deplacait le joueur a
 * chaque message recu.
 *
 * Une entree portant l'identifiant d'un joueur absent de la partie est ignoree.
 */
export type Entrees = Readonly<Record<IdentifiantEntite, EntreeJoueur>>;

/**
 * Ce qui distingue un mode de jeu, vu du moteur.
 *
 * Le moteur fait avancer le monde de la meme facon dans tous les modes: joueurs,
 * bots, zones, objets. Un mode decide de deux choses seulement.
 */
export interface JeuDeRegles {
  /**
   * Ce que le mode fait des entrees du battement, une fois tout le monde deplace et
   * avant le releve des contacts. Le Classique n'y fait rien; le Tactique y oriente
   * ses joueurs, recharge leurs charges et joue leurs tirs.
   */
  readonly agir: (etat: EtatPartie, entrees: Entrees, dtMs: number) => EtatPartie;
  /** Ce que produisent les contacts releves. */
  readonly resoudreContacts: RegleDeResolution;
}

/**
 * Le jeu de regles de chaque mode.
 *
 * C'EST LE BRANCHEMENT DU MODE SUR LE MOTEUR (cadrage de l'etape 0.3, section 6).
 * Le moteur reste agnostique: il fait avancer le monde, et laisse le mode de la
 * partie decider de ce qui les distingue. Ajouter un mode, c'est ajouter son jeu de
 * regles ici; oublier de le faire est une erreur de compilation, la table etant
 * indexee par tous les modes du contrat.
 *
 * Jusqu'a l'etape 7.1, un mode ne fournissait que sa regle de contacts. Un tir
 * n'est pas un contact: le mode Tactique a demande qu'un mode puisse aussi agir sur
 * les entrees. Le Classique rend l'etat qu'il recoit, tel quel.
 */
export const REGLES_DES_MODES: Readonly<Record<EtatPartie['mode'], JeuDeRegles>> = {
  classique: { agir: sansAction, resoudreContacts: regleClassique },
  tactique: { agir: agirEnTactique, resoudreContacts: regleTactique },
};

/** Verdict sur la fin d'une partie, sans aucune action declenchee. */
export interface EvaluationFinDePartie {
  readonly terminee: boolean;
  /** Temps restant avant la fin, en millisecondes. Jamais negatif. */
  readonly tempsRestantMs: number;
}

/**
 * Fait avancer la partie d'un battement.
 *
 * @param etat Etat courant. Il n'est pas modifie.
 * @param entrees Ce que les joueurs demandent. Un joueur absent de cette table
 *                ne bouge pas.
 * @param dtMs Temps ecoule depuis le battement precedent, en millisecondes.
 * @returns Le nouvel etat. Son journal d'evenements ne contient que ce qui vient
 *          de se produire pendant ce battement. L'etat recu est renvoye tel quel
 *          si la partie est deja terminee, journal compris: le legacy sortait de
 *          meme des que isGameOver etait vrai.
 */
export function tick(etat: EtatPartie, entrees: Entrees, dtMs: number): EtatPartie {
  if (!Number.isFinite(dtMs) || dtMs < 0) {
    throw new Error(`Le temps ecoule doit etre un nombre positif, recu ${dtMs}.`);
  }

  if (evaluerFinDePartie(etat).terminee) {
    return etat;
  }

  if (etat.enPause) {
    return battementSuspendu(etat);
  }

  const joueurs: Record<IdentifiantEntite, Joueur> = {};
  for (const [id, joueur] of Object.entries(etat.joueurs)) {
    joueurs[id] = avancerJoueur(etat, joueur, entrees[id], dtMs);
  }

  // Le journal repart vide: il decrit ce battement-ci, pas l'histoire de la
  // partie. Celle-ci se lit dans les compteurs des joueurs.
  const deplace: EtatPartie = {
    ...etat,
    tick: etat.tick + 1,
    tempsEcouleMs: etat.tempsEcouleMs + dtMs,
    joueurs,
    evenements: [],
  };

  const bots = avancerLesBots(deplace, dtMs);
  const zones = appliquerLesEffetsDeZone(avancerLesZones(bots, dtMs), dtMs);
  const objets = faireApparaitreLesObjets(fairePasserLeTempsSurLesObjets(zones, dtMs), dtMs);
  const regles = REGLES_DES_MODES[objets.mode];
  const actions = regles.agir(objets, entrees, dtMs);
  const contacts = resoudreContacts(actions, detecterContacts(actions), regles.resoudreContacts);

  return ramasserLesObjets(contacts);
}

/** Un mode qui n'agit pas sur les entrees: l'etat est rendu tel quel. */
function sansAction(etat: EtatPartie): EtatPartie {
  return etat;
}

/**
 * Le battement d'une partie suspendue: il a lieu, et il ne fait rien.
 *
 * PENDANT LA PAUSE, LE TEMPS DE JEU NE S'ECOULE PAS. Le dt recu n'est pas
 * consomme: personne ne se deplace, aucune duree de bonus ne se rapproche de sa
 * fin, aucun objet ne vieillit, aucun compte a rebours d'apparition ne descend,
 * et tempsEcouleMs ne bouge pas. Cette derniere consequence est la plus visible:
 * evaluerFinDePartie ne peut donc pas conclure, et une partie suspendue ne se
 * termine jamais d'elle-meme.
 *
 * DEUX CHOSES CHANGENT QUAND MEME, et chacune pour une raison precise.
 *
 *   1. LE COMPTEUR DE BATTEMENTS AVANCE, parce qu'un battement a reellement eu
 *      lieu. C'est ce qui tient la promesse faite par le contrat reseau, ou le
 *      numero de battement d'un instantane croit de un a chaque envoi.
 *   2. LE JOURNAL REPART VIDE, et ce n'est pas un detail. Le journal d'un
 *      battement est lu par la couche reseau juste apres, puis efface au
 *      battement suivant. Rendre l'etat strictement inchange rejouerait donc le
 *      journal du dernier battement actif a chaque battement de la pause, soit
 *      vingt fois par seconde: un joueur capture juste avant la pause recevrait
 *      la meme notification en boucle jusqu'a la reprise. Rien dans les types ne
 *      le signalerait, et seul un test l'empeche de revenir.
 */
function battementSuspendu(etat: EtatPartie): EtatPartie {
  return { ...etat, tick: etat.tick + 1, evenements: [] };
}

/**
 * Dit si la partie est finie, et depuis combien de temps il lui restait.
 *
 * Portage de calculateTimeLeft (legacy/server.js:1537). C'est une lecture, pas
 * une action: le moteur ne termine rien de lui-meme. Declarer la fin, prevenir
 * les joueurs et arreter la boucle appartiennent au serveur (etape 2.1).
 */
export function evaluerFinDePartie(etat: EtatPartie): EvaluationFinDePartie {
  const restant = etat.dureeMs - etat.tempsEcouleMs;

  return { terminee: restant <= 0, tempsRestantMs: Math.max(restant, 0) };
}

/**
 * Applique a un joueur son entree et l'ecoulement du temps.
 *
 * Le deplacement se calcule avec les effets tels qu'ils sont au debut du
 * battement, et c'est seulement ensuite que le temps les rapproche de leur fin:
 * un bonus de vitesse dont il reste dix millisecondes vaut encore pour ce
 * battement-ci. C'est deja le traitement reserve a la protection d'apparition.
 */
function avancerJoueur(
  etat: EtatPartie,
  joueur: Joueur,
  entree: EntreeJoueur | undefined,
  dtMs: number,
): Joueur {
  const deplace = deplacerJoueur(etat, joueur, entree, dtMs);

  return {
    ...deplace,
    protectionSpawnRestanteMs: Math.max(joueur.protectionSpawnRestanteMs - dtMs, 0),
    tempsDepuisDerniereCaptureMs: Math.min(
      joueur.tempsDepuisDerniereCaptureMs + dtMs,
      COMPTEUR_CAPTURE_PRET,
    ),
    bonusRestantsMs: fairePasserLeTemps(joueur.bonusRestantsMs, dtMs),
    malusRestantsMs: fairePasserLeTemps(joueur.malusRestantsMs, dtMs),
  };
}

/**
 * Deplace un joueur selon son entree, contre le terrain.
 *
 * Le vecteur recu est ramene a la distance parcourue pendant dt, puis confie a
 * la resolution du deplacement, qui longe les murs et tente de les contourner.
 *
 * Le bornage explicite a la carte du legacy (server.js:2665) n'est plus utile:
 * hors de la carte, tout est mur, donc aucun deplacement ne peut en sortir. La
 * consequence visible est que le joueur s'arrete a son rayon du bord, et non le
 * centre colle au bord. C'est deja ce que le legacy faisait reellement, son
 * bornage n'ayant jamais rien eu a corriger.
 *
 * La direction suit le deplacement effectivement realise: un joueur bloque
 * regarde devant lui, comme dans le legacy.
 *
 * LA DISTANCE NE DEPEND QUE DE dt. Elle vaut la vitesse du joueur multipliee par
 * le temps ecoule, et rien d'autre. Ni la longueur du vecteur recu, ni le nombre
 * de messages envoyes n'y peuvent quoi que ce soit: c'est la correction de fond
 * de la faille S2, deja acquise depuis l'etape 1.1.
 */
function deplacerJoueur(
  etat: EtatPartie,
  joueur: Joueur,
  entree: EntreeJoueur | undefined,
  dtMs: number,
): Joueur {
  if (entree === undefined || !entree.enMouvement || !intentionExploitable(entree.deplacement)) {
    return { ...joueur, direction: 'immobile' };
  }

  const distance = (VITESSES.JOUEUR_PX_PAR_SECONDE * multiplicateurDeVitesse(joueur) * dtMs) / 1000;
  const pas = aLaLongueur(voulu(joueur, entree.deplacement), distance);
  const position = resoudreDeplacement(etat.terrain, joueur.position, pas);

  const effectif = { x: position.x - joueur.position.x, y: position.y - joueur.position.y };

  return { ...joueur, position, direction: directionDuVecteur(effectif) };
}

/**
 * Le vecteur recu dit-il quelque chose d'exploitable ?
 *
 * Une derniere barriere, apres celle de la couche reseau. La couche reseau refuse
 * deja le message (validerIntentionDeplacement de packages/shared), et le moteur
 * verifie quand meme, pour deux raisons.
 *
 * La premiere est le cout d'une erreur. Une coordonnee valant NaN ne leve aucune
 * exception: elle se propage silencieusement a la position du joueur, puis a
 * toutes les distances qui la font intervenir, donc aux contacts, donc aux
 * captures. Une seule entree mal formee suffirait a rendre une partie entiere
 * incoherente sans qu'aucun message d'erreur ne soit jamais emis.
 *
 * La seconde est que le moteur ne connait pas ses appelants. Un test, un rejeu de
 * partie, un futur mode spectateur, un serveur de developpement: rien ne garantit
 * que tous passent par la validation reseau. Un moteur qui se defend lui-meme
 * n'oblige personne a s'en souvenir.
 *
 * Un vecteur nul est refuse lui aussi, mais pour une raison ordinaire: il ne
 * designe aucune direction. Le joueur s'arrete, comme s'il relachait ses touches.
 */
function intentionExploitable(deplacement: Vecteur): boolean {
  const longueur = norme(deplacement);

  return Number.isFinite(longueur) && longueur > 0;
}

/**
 * De combien la vitesse d'un joueur est multipliee par ses effets.
 *
 * Portage du calcul du gestionnaire move (legacy/server.js:2616), moins ce qui en
 * faisait une faille: le legacy croyait sur parole le client qui annoncait son
 * bonus de vitesse, et lui accordait en plus un facteur deux s'il se declarait
 * sur mobile (faille S2). Ici le bonus est celui que le moteur a lui-meme
 * accorde, et il n'existe aucun facteur mobile: la vitesse ne depend plus de
 * l'appareil ni de ce que le client raconte.
 *
 * Le plafond du legacy est conserve bien qu'il ne serve pas encore: aucun cumul
 * ne peut aujourd'hui depasser 1,7.
 */
function multiplicateurDeVitesse(joueur: Joueur): number {
  const multiplicateur = bonusActif(joueur, 'vitesse') ? VITESSES.MULTIPLICATEUR_BONUS : 1;

  return Math.min(multiplicateur, VITESSES.MULTIPLICATEUR_MAXIMUM);
}

/**
 * Le deplacement reellement voulu, une fois les commandes inversees prises en
 * compte.
 *
 * Dans le legacy, c'est le client qui inversait ses propres commandes avant
 * d'envoyer son deplacement. Un client modifie n'avait donc qu'a ne pas le faire
 * pour ignorer le malus. Le moteur s'en charge maintenant: le client envoie la
 * direction demandee par le joueur, telle quelle, et le moteur applique l'effet.
 *
 * A retenir pour l'etape 4.1: le client ne doit surtout pas inverser de son cote,
 * sous peine d'annuler le malus en le doublant.
 */
function voulu(joueur: Joueur, deplacement: Vecteur): Vecteur {
  return malusActif(joueur, 'controlesInverses')
    ? { x: -deplacement.x, y: -deplacement.y }
    : deplacement;
}
