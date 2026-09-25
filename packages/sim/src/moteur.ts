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
 *      entrent en jeu quand leur heure est venue; l'Evade apparait, fuit ou s'en va
 *      (etape 7.9);
 *   4. les zones speciales vieillissent, apparaissent, et agissent sur les bots;
 *   5. les bonus et malus poses vieillissent, et de nouveaux apparaissent;
 *   6. le mode de jeu agit sur les entrees: en Horde, les combos s'epuisent; en Tactique, les
 *      joueurs s'orientent, rechargent et tirent; en Chasse, les proies comptent leur
 *      parcours, une proie remplace les traqueurs partis, et les traqueurs tirent; en
 *      Massacre, les joueurs s'orientent, paient leurs prises par un bot noir et frappent;
 *   7. on releve les contacts entre entites et on en tire les consequences,
 *      captures comprises, selon le mode, puis l'Evade touche est attrape, en Horde et en
 *      Equipes (etape 7.9);
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

import type { PerteFaceAuBotNoir } from './bots.js';
import { avancerLesBots, perteClassique } from './bots.js';
import {
  PERSONNE_HORS_JEU,
  agirEnChasse,
  chasseDecidee,
  horsJeuEnChasse,
  lancerLaChasse,
  malusEnChasse,
} from './chasse.js';
import type { RegleDeResolution } from './contacts.js';
import {
  attraperLEvadeAuContact,
  detecterContacts,
  regleChasse,
  regleEquipes,
  regleHorde,
  regleMassacre,
  regleTactique,
  resoudreContacts,
} from './contacts.js';
import { resoudreDeplacement } from './deplacement.js';
import { aLaLongueur, directionDuVecteur, norme } from './direction.js';
import { fairePasserLeTemps } from './effets.js';
import { avancerLEvade, preparerLEvade } from './evade.js';
import { malusEnEquipe, perteEnEquipe } from './equipes.js';
import { agirEnHorde, lancerLaHorde } from './horde.js';
import type { EtatPartie, IdentifiantEntite, Joueur } from './etat.js';
import { agirEnMassacre, lancerLeMassacre, massacreDecide, perteEnMassacre } from './massacre.js';
import { COMPTEUR_CAPTURE_PRET, bonusActif, malusActif } from './etat.js';
import type { VictimeDuMalus } from './objets.js';
import {
  faireApparaitreLesObjets,
  fairePasserLeTempsSurLesObjets,
  malusClassique,
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
 * bots, zones, objets. Un mode decide de six choses seulement.
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
  /**
   * Les bots que perd un joueur attrape par un bot noir. Une part de tous ses bots en
   * Classique et en Tactique; une part de sa part en Equipes.
   */
  readonly perteFaceAuBotNoir: PerteFaceAuBotNoir;
  /**
   * Qui subit un malus ramasse: tous les autres, l'equipe adverse en Equipes, l'autre camp
   * en Chasse.
   */
  readonly victimeDuMalus: VictimeDuMalus;
  /**
   * Ce que le mode fait de l'etat au lancement de la partie, une fois les bots poses. Rien
   * dans les autres modes, sans aucun tirage; la Chasse y tire ses premiers traqueurs.
   */
  readonly lancer: (etat: EtatPartie) => EtatPartie;
  /**
   * La partie est-elle decidee avant le terme de son temps ? Jamais dans les autres modes;
   * en Chasse, des qu'il ne reste plus aucune proie, ou plus aucun traqueur en jeu.
   */
  readonly estDecidee: (etat: EtatPartie) => boolean;
  /**
   * Les joueurs hors jeu: ils ne bougent plus, ne ramassent rien et ne subissent aucun
   * malus. Personne dans les autres modes; les traqueurs elimines en Chasse.
   */
  readonly horsJeu: (etat: EtatPartie) => ReadonlySet<IdentifiantEntite>;
  /**
   * Ce que le contact fait de l'Evade (etape 7.9): en Horde et en Equipes, le joueur qui le
   * touche l'attrape, comme un PNJ. Rien dans les autres modes: le Tactique l'attrape d'un
   * tir et le Massacre d'un coup de katana, dans agir; la Chasse ne l'a pas.
   */
  readonly attraperLEvade: (
    etat: EtatPartie,
    horsJeu: ReadonlySet<IdentifiantEntite>,
  ) => EtatPartie;
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
 *
 * L'etape 7.2 l'a elargi une seconde fois. Le mode Equipes change ce que perd un
 * joueur attrape par un bot noir et qui subit un malus, deux decisions qui vivaient
 * dans le comportement des bots et dans le ramassage des objets sans consulter le
 * mode. Le Classique et le Tactique y gardent exactement le code d'avant.
 *
 * L'etape 7.3 l'a elargi une troisieme fois. La Chasse tire ses premiers traqueurs au
 * lancement, s'arrete des que la derniere proie tombe ou que ses traqueurs sont epuises, et
 * met hors jeu un traqueur elimine: trois questions que le lancement de la partie, la
 * lecture de sa fin, le deplacement et le ramassage posaient sans consulter le mode. Les
 * trois autres modes n'y font rien.
 *
 * L'etape 7.4 y a branche le Massacre sans l'elargir: il frappe dans agir, pose ses armes au
 * lancement, et se decide quand la carte est videe.
 *
 * L'etape 7.5 a donne au Classique, devenu la Horde, un combo: il pose ses combos au
 * lancement, les laisse s'epuiser dans agir, et rallie dans sa regle de contacts.
 *
 * L'etape 7.9 l'a elargi une quatrieme fois: l'Evade s'attrape au contact en Horde et en
 * Equipes, et le releve des contacts ne voit que des entites. Les trois autres modes n'y
 * font rien.
 */
export const REGLES_DES_MODES: Readonly<Record<EtatPartie['mode'], JeuDeRegles>> = {
  classique: {
    agir: agirEnHorde,
    resoudreContacts: regleHorde,
    perteFaceAuBotNoir: perteClassique,
    victimeDuMalus: malusClassique,
    lancer: lancerLaHorde,
    estDecidee: jamaisAvantLeTerme,
    horsJeu: personneHorsJeu,
    attraperLEvade: attraperLEvadeAuContact,
  },
  tactique: {
    agir: agirEnTactique,
    resoudreContacts: regleTactique,
    perteFaceAuBotNoir: perteClassique,
    victimeDuMalus: malusClassique,
    lancer: sansPreparation,
    estDecidee: jamaisAvantLeTerme,
    horsJeu: personneHorsJeu,
    attraperLEvade: sansEvadeAuContact,
  },
  equipes: {
    agir: sansAction,
    resoudreContacts: regleEquipes,
    perteFaceAuBotNoir: perteEnEquipe,
    victimeDuMalus: malusEnEquipe,
    lancer: sansPreparation,
    estDecidee: jamaisAvantLeTerme,
    horsJeu: personneHorsJeu,
    attraperLEvade: attraperLEvadeAuContact,
  },
  chasse: {
    agir: agirEnChasse,
    resoudreContacts: regleChasse,
    // Sans bots noirs, la question ne se pose pas: celle du Classique, qui ne sert pas.
    perteFaceAuBotNoir: perteClassique,
    victimeDuMalus: malusEnChasse,
    lancer: lancerLaChasse,
    estDecidee: chasseDecidee,
    horsJeu: horsJeuEnChasse,
    attraperLEvade: sansEvadeAuContact,
  },
  massacre: {
    agir: agirEnMassacre,
    resoudreContacts: regleMassacre,
    perteFaceAuBotNoir: perteEnMassacre,
    victimeDuMalus: malusClassique,
    lancer: lancerLeMassacre,
    estDecidee: massacreDecide,
    horsJeu: personneHorsJeu,
    attraperLEvade: sansEvadeAuContact,
  },
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

  const regles = REGLES_DES_MODES[etat.mode];
  const horsJeu = regles.horsJeu(etat);
  const joueurs: Record<IdentifiantEntite, Joueur> = {};
  for (const [id, joueur] of Object.entries(etat.joueurs)) {
    // Un joueur hors jeu (un traqueur elimine, en Chasse) ne bouge plus.
    joueurs[id] = horsJeu.has(id) ? joueur : avancerJoueur(etat, joueur, entrees[id], dtMs);
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

  const bots = avancerLEvade(avancerLesBots(deplace, dtMs, regles.perteFaceAuBotNoir), dtMs);
  const zones = appliquerLesEffetsDeZone(avancerLesZones(bots, dtMs), dtMs);
  const objets = faireApparaitreLesObjets(fairePasserLeTempsSurLesObjets(zones, dtMs), dtMs);
  const actions = regles.agir(objets, entrees, dtMs);
  const contacts = resoudreContacts(actions, detecterContacts(actions), regles.resoudreContacts);
  const evade = regles.attraperLEvade(contacts, regles.horsJeu(contacts));

  return ramasserLesObjets(evade, regles.victimeDuMalus, regles.horsJeu(evade));
}

/** Un mode qui n'agit pas sur les entrees: l'etat est rendu tel quel. */
function sansAction(etat: EtatPartie): EtatPartie {
  return etat;
}

/** Un mode qui ne prepare rien au lancement: l'etat est rendu tel quel. */
function sansPreparation(etat: EtatPartie): EtatPartie {
  return etat;
}

/** Un mode ou le contact n'attrape pas l'Evade: l'etat est rendu tel quel. */
function sansEvadeAuContact(etat: EtatPartie): EtatPartie {
  return etat;
}

/** Un mode que seul le temps decide. */
function jamaisAvantLeTerme(): boolean {
  return false;
}

/** Un mode ou personne n'est jamais hors jeu. */
function personneHorsJeu(): ReadonlySet<IdentifiantEntite> {
  return PERSONNE_HORS_JEU;
}

/**
 * Prepare une partie qui se lance, selon son mode: les combos en Horde; rien en Tactique et
 * en Equipes; les premiers traqueurs en Chasse; les armes et les points en Massacre. Puis,
 * dans les modes qui l'admettent, le moment ou l'Evade apparaitra (etape 7.9).
 *
 * Le serveur l'appelle au lancement, une fois les bots poses (etape 7.3).
 */
export function lancerLaPartie(etat: EtatPartie): EtatPartie {
  return preparerLEvade(REGLES_DES_MODES[etat.mode].lancer(etat));
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
 *
 * Le temps decide de la fin dans tous les modes. Un mode peut aussi etre decide avant
 * le terme: la Chasse, quand il ne reste plus aucune proie ou plus aucun traqueur en jeu
 * (etape 7.3); le Massacre, quand le dernier bot est tombe (etape 7.4). Le temps restant,
 * lui, reste celui du reglage.
 */
export function evaluerFinDePartie(etat: EtatPartie): EvaluationFinDePartie {
  const restant = etat.dureeMs - etat.tempsEcouleMs;

  return {
    terminee: restant <= 0 || REGLES_DES_MODES[etat.mode].estDecidee(etat),
    tempsRestantMs: Math.max(restant, 0),
  };
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
 * La direction suit le deplacement effectivement realise. Un joueur qui essaie
 * d'avancer sans pouvoir bouger, coince contre un mur, devient immobile, comme dans
 * le legacy (server.js:2670). UN JOUEUR ARRETE, LUI, GARDE SA DERNIERE DIRECTION:
 * le client d'origine n'envoyait un deplacement que touche enfoncee, et le serveur
 * ignorait un message sans mouvement, si bien que le personnage restait tourne vers
 * ou il allait. Le portage le remettait immobile a chaque battement sans
 * deplacement, et il se retournait face a l'ecran des qu'on lachait la touche:
 * corrige le 18 septembre 2026, a la demande du porteur du projet, et fige par le
 * test de caracterisation « ignore un message de deplacement qui ne declare pas de
 * mouvement ».
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
    return joueur;
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
