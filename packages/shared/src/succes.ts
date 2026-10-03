/**
 * Les succes (etape 3.7): ce qu'ils sont, et ce qu'un historique de parties en dit.
 *
 * LES DEFINITIONS SONT DES DONNEES. Chaque succes nomme une mesure du parcours d'un
 * compte et le seuil qu'elle doit atteindre: la condition est la meme pour tous, « la
 * mesure atteint le seuil ». Ajouter un succes est un changement de ce fichier, pas de
 * la base. Le serveur s'en sert pour attribuer, le client pour afficher noms,
 * descriptions et progression.
 *
 * UN IDENTIFIANT NE SE REUTILISE JAMAIS. Il est ecrit dans la base a chaque deblocage:
 * le renommer, ou le donner a un autre succes, changerait ce que les comptes ont
 * obtenu. Un succes retire garde son identifiant hors d'usage, et la lecture ignore
 * ce qu'elle ne connait plus.
 *
 * LE PARCOURS EST UN PLI SUR L'HISTORIQUE. Les parties d'un compte, dans l'ordre ou
 * elles se sont terminees, s'ajoutent une a une a des compteurs. C'est la seule facon
 * de calculer les mesures: la fin de partie, le profil et le rattrapage des comptes
 * existants passent tous par parcoursDe. Le pli dit aussi, pour chaque succes, la
 * premiere partie apres laquelle il etait atteint: c'est elle qui le date.
 *
 * FONCTIONS PURES. Rien ici ne lit l'horloge ni la base: le jour de chaque partie, a
 * l'heure de Paris, les amis qui l'ont jouee et les faits releves pendant la partie
 * arrivent avec elle.
 *
 * DEUX SOURCES. Les succes de l'etape 3.7 se deduisent des resultats enregistres, et
 * s'attribuent aussi aux parties d'avant. Ceux de l'etape 3.8, exploits et secrets, se
 * deduisent des faits de partie, que le serveur releve pendant qu'elle se joue: une
 * partie d'avant ce releve n'en a aucun, et ne donne donc aucun de ces succes.
 */

import { JOUEURS_POUR_UNE_VICTOIRE } from './comptes.js';
import type { CarteEnregistree, Mode } from './constantes.js';
import type { IdentifiantPalier } from './progression.js';
import { PALIERS, xpDuNiveau } from './progression.js';

// --------------------------------------------------------------------------
// Les paliers de difficulte
// --------------------------------------------------------------------------

/**
 * Les paliers de difficulte, du plus facile au plus rare (etude des succes, section 3).
 *
 * Nommes par le delai attendu pour un joueur regulier: la premiere heure, la premiere
 * semaine, un mois de jeu, et au-dela. Ils evitent Bronze, Argent et Or, deja pris
 * par les paliers de ligue.
 */
export const PALIERS_DE_SUCCES = ['decouverte', 'habitue', 'expert', 'legende'] as const;

/** Un palier de difficulte. */
export type PalierDeSucces = (typeof PALIERS_DE_SUCCES)[number];

// --------------------------------------------------------------------------
// Les faits de partie
// --------------------------------------------------------------------------

/**
 * Ce que le serveur releve d'un joueur pendant une partie, et que les resultats ne disent
 * pas (etape 3.8): de quoi deduire les exploits et les secrets.
 *
 * UN FAIT EST UN NOMBRE POSITIF: un compte (malus ramasses), un record de la partie
 * (le plus haut multiplicateur) ou un drapeau a 1 (jamais pris). Un fait nul ne
 * s'enregistre pas. Ce qui se dit par une absence, comme « jamais pris », est donc un
 * fait positif, constate a la fin: une partie d'avant le releve, qui n'a aucun fait, ne
 * passe pas pour une partie ou l'on n'a jamais ete pris.
 *
 * UN IDENTIFIANT NE SE REUTILISE JAMAIS, comme celui d'un succes: il est ecrit dans la
 * base, et la lecture ignore ce qu'elle ne connait plus.
 *
 * Retires le 28 septembre 2026, et a ne jamais reprendre: `meilleurTir`, qui comptait les
 * joueurs pris d'un tir avec ses ninjas (remplace par `meilleurFilet`), et `carteVidee`,
 * qui allait a tout present, meme sans avoir tue (remplace par `tableRase`). Les lignes
 * deja ecrites sous ces noms s'ignorent a la lecture.
 */
export const FAITS_DE_PARTIE = [
  /** Les malus ramasses. */
  'malusRamasses',
  /** Le plus de ninjas recuperes d'une seule capture. */
  'meilleureRazzia',
  /** Les joueurs pris moins de 30 secondes apres qu'ils vous ont pris. */
  'revanches',
  /** Le plus haut multiplicateur de combo atteint, en Horde ou en Massacre. */
  'meilleurMultiplicateur',
  /** Les ninjas rallies en Horde. */
  'ninjasRallies',
  /** Le plus de ninjas pris d'un seul tir, joueurs et Evade non compris. */
  'meilleurFilet',
  /** 1: le joueur etait sur la carte quand elle a ete videe, en Massacre, et y avait tue. */
  'tableRase',
  /** Les Evades attrapes. */
  'evadesAttrapes',
  /** Les x2 pris a leur porteur. */
  'doubleursVoles',
  /** Les fois ou un Black Ninja a pris le joueur. */
  'prisParUnBlackNinja',
  /** Les joueurs pris dans la derniere seconde du temps de jeu. */
  'prisesSurLeFil',
  /** Les fois ou le joueur a ete pris moins de 3 secondes apres avoir pris. */
  'arroseurArrose',
  /** 1: en Horde, le joueur n'a jamais ete pris, ni par un joueur ni par un Black Ninja. */
  'intouchable',
  /** 1: le joueur etait la seule proie restante a la fin d'une Chasse. */
  'derniereProie',
  /** 1: le joueur portait le x2 a la fin. */
  'finiAvecLeDoubleur',
  /** Les amis entres dans la partie par une invitation du joueur. */
  'amisRassembles',
  /** Les bonus ramasses, objets de poche compris (etape 3.10, pour les defis). */
  'bonusRamasses',
] as const;

/** Un fait de partie. */
export type FaitDePartie = (typeof FAITS_DE_PARTIE)[number];

/** Les faits d'un joueur dans une partie. Un fait absent vaut zero. */
export type FaitsDePartie = Readonly<Partial<Record<FaitDePartie, number>>>;

/** Les faits, pour reconnaitre un identifiant lu en base. */
const FAITS_CONNUS: ReadonlySet<string> = new Set(FAITS_DE_PARTIE);

/**
 * Cet identifiant est-il celui d'un fait connu. Ce que la base rend peut nommer un fait
 * retire depuis: il s'ignore.
 */
export function estUnFait(id: string): id is FaitDePartie {
  return FAITS_CONNUS.has(id);
}

// --------------------------------------------------------------------------
// Le parcours d'un compte
// --------------------------------------------------------------------------

/** Un ami du compte qui a joue la meme partie, et sa place. */
export interface AmiDansLaPartie {
  /** L'identifiant de son compte. */
  readonly compte: string;
  readonly placement: number;
}

/**
 * Une partie de l'historique d'un compte, telle que le pli la lit: la partie, et le
 * resultat du compte dans celle-ci.
 */
export interface PartieDuParcours {
  readonly mode: Mode;
  readonly carte: CarteEnregistree;
  readonly modeMiroir: boolean;
  /** Tous les joueurs de la partie, invites et abandons compris. */
  readonly nombreJoueurs: number;
  /** La duree reglee de la partie, en secondes (etape 3.10, pour les defis). */
  readonly dureeS: number;
  /** 1 pour le premier. En Equipes, la place de son equipe. */
  readonly placement: number;
  /**
   * Les joueurs pris: captures en Horde, en Tactique et en Equipes, proies infectees en
   * Chasse, joueurs elimines en Massacre. C'est le compteur du moteur, tel quel.
   */
  readonly captures: number;
  readonly botsNoirsDetruits: number;
  readonly xpGagnee: number;
  /**
   * L'XP des defis que cette partie a releves (etape 3.10). Absente: aucun. Elle compte
   * dans l'XP totale, sans quoi un compte afficherait un niveau sans son succes.
   */
  readonly xpDesDefis?: number;
  /** Signee, telle qu'appliquee: jamais plus bas que zero point. */
  readonly variationPointsLigue: number;
  /** Le jour de la fin de la partie, a l'heure de Paris: « 2026-09-26 ». */
  readonly jour: string;
  /** Les amis actuels du compte qui ont joue cette partie. */
  readonly amis: readonly AmiDansLaPartie[];
  /**
   * Ce que le serveur a releve du compte pendant la partie (etape 3.8). Absents: une
   * partie jouee avant le releve, ou quittee avant la fin.
   */
  readonly faits?: FaitsDePartie;
}

/** Ce que les succes mesurent dans un parcours. */
export const MESURES = [
  'partiesJouees',
  'partiesEnMiroir',
  'podiums',
  'victoires',
  'victoiresEnEquipes',
  'meilleureSerie',
  'prises',
  'blackNinjasDetruits',
  'meilleureChasse',
  'cartes',
  'modes',
  'modesGagnes',
  'jours',
  'xpTotale',
  'sommetDesPointsDeLigue',
  'partiesAvecUnAmi',
  'devantUnAmi',
  // Les mesures des faits de partie (etape 3.8).
  'malusRamasses',
  'meilleureRazzia',
  'revanches',
  'meilleurMultiplicateurEnHorde',
  'meilleurMultiplicateur',
  'victoiresIntouchables',
  'meilleurFiletEnTactique',
  'dernieresProies',
  'tablesRases',
  'evadesAttrapes',
  'doubleursVoles',
  'victoiresAvecLeDoubleur',
  'ninjasRallies',
  'malchance',
  'prisesSurLeFil',
  'arroseursArroses',
  'amisRassembles',
] as const;

/** Une mesure du parcours. */
export type Mesure = (typeof MESURES)[number];

/** La valeur de chaque mesure, apres un certain nombre de parties. */
export type Mesures = Readonly<Record<Mesure, number>>;

/**
 * Le nombre de joueurs a partir duquel une partie compte pour le podium.
 *
 * A trois, finir troisieme serait finir dernier. Plafonne a quatre, comme tout succes
 * qui demande des adversaires: la population est petite (etude, section 7).
 */
export const JOUEURS_POUR_UN_PODIUM = 4;

/** Les places du podium. */
const PLACES_DU_PODIUM = 3;

/**
 * Le nombre de joueurs a partir duquel un exploit qui se mesure aux autres compte:
 * gagner une Horde sans etre pris, finir derniere proie d'une Chasse. Le meme plafond
 * que le podium, pour la meme raison.
 */
export const JOUEURS_POUR_UN_EXPLOIT = 4;

// --------------------------------------------------------------------------
// Les definitions
// --------------------------------------------------------------------------

/** Ce que compte une mesure, pour dire ce qu'il reste a faire: « 3 victoires ». */
export interface UniteDeMesure {
  readonly singulier: string;
  readonly pluriel: string;
}

/** Un succes. */
export interface DefinitionDeSucces {
  /** Stable, en minuscules et tirets. Jamais reutilise. */
  readonly id: string;
  readonly nom: string;
  /** Ce qu'il faut faire, en une phrase. */
  readonly description: string;
  readonly palier: PalierDeSucces;
  /** Un succes secret ne se decrit qu'une fois obtenu. */
  readonly secret: boolean;
  readonly mesure: Mesure;
  /** Le succes est obtenu quand la mesure atteint ce nombre. */
  readonly seuil: number;
  /**
   * Present pour un cumul, qui montre sa progression (« 412 sur 500 ») et peut etre
   * le succes le plus proche. Absent pour un succes qui s'obtient d'un coup (un seuil
   * de un, un record dans une partie, une serie): sa progression ne dirait rien.
   */
  readonly unite?: UniteDeMesure;
}

/** Les unites des cumuls. */
const PARTIES: UniteDeMesure = { singulier: 'partie', pluriel: 'parties' };
const VICTOIRES: UniteDeMesure = { singulier: 'victoire', pluriel: 'victoires' };
const PRISES: UniteDeMesure = { singulier: 'prise', pluriel: 'prises' };
const BLACK_NINJAS: UniteDeMesure = { singulier: 'Black Ninja', pluriel: 'Black Ninjas' };
const CARTES: UniteDeMesure = { singulier: 'carte', pluriel: 'cartes' };
const MODES: UniteDeMesure = { singulier: 'mode', pluriel: 'modes' };
const JOURS: UniteDeMesure = { singulier: 'jour', pluriel: 'jours' };
/**
 * Un succes de niveau se mesure en XP, et non en niveaux: le niveau 1 est celui d'un
 * compte qui n'a rien fait, et le compter pour un cinquieme de « Recrue » ferait de lui
 * le succes le plus proche de tout debutant. En XP, la progression dit ce qu'il reste
 * vraiment a gagner.
 */
const XP: UniteDeMesure = { singulier: 'XP', pluriel: 'XP' };
const POINTS_DE_LIGUE: UniteDeMesure = { singulier: 'point de ligue', pluriel: 'points de ligue' };
const EVADES: UniteDeMesure = { singulier: 'Évadé', pluriel: 'Évadés' };
const NINJAS: UniteDeMesure = { singulier: 'ninja', pluriel: 'ninjas' };

/** Les points de ligue d'un palier de rang. */
function seuilDuPalier(id: IdentifiantPalier): number {
  const palier = PALIERS.find((candidat) => candidat.id === id);

  if (palier === undefined) {
    throw new Error(`Aucun palier de rang ne s'appelle ${id}.`);
  }

  return palier.seuil;
}

/**
 * Les definitions, telles qu'ecrites: c'est d'elles que se tire la liste des
 * identifiants.
 *
 * Les seuils sont ceux de l'etude (section 4), gardes tels quels le 26 septembre 2026:
 * quelques semaines de resultats ne suffisaient pas a les calibrer.
 *
 * Dans chaque palier, les succes des resultats (etape 3.7) viennent d'abord, puis ceux
 * des faits de partie (etape 3.8), puis les secrets.
 */
const DEFINITIONS = [
  // Decouverte: dans la premiere heure.
  {
    id: 'premier-pas',
    nom: 'Premier pas',
    description: 'Jouer une partie.',
    palier: 'decouverte',
    secret: false,
    mesure: 'partiesJouees',
    seuil: 1,
  },
  {
    id: 'premiere-prise',
    nom: 'Première prise',
    description: 'Prendre un joueur : le capturer, l’infecter ou l’éliminer.',
    palier: 'decouverte',
    secret: false,
    mesure: 'prises',
    seuil: 1,
  },
  {
    id: 'nettoyeur',
    nom: 'Nettoyeur',
    description: 'Détruire un Black Ninja.',
    palier: 'decouverte',
    secret: false,
    mesure: 'blackNinjasDetruits',
    seuil: 1,
  },
  {
    id: 'reflet',
    nom: 'Reflet',
    description: 'Jouer une partie en miroir.',
    palier: 'decouverte',
    secret: false,
    mesure: 'partiesEnMiroir',
    seuil: 1,
  },
  {
    id: 'sur-le-podium',
    nom: 'Sur le podium',
    description:
      'Finir dans les trois premiers d’une partie d’au moins quatre joueurs, ou la gagner en Équipes.',
    palier: 'decouverte',
    secret: false,
    mesure: 'podiums',
    seuil: 1,
  },
  {
    id: 'premiere-couronne',
    nom: 'Première couronne',
    description: 'Gagner une partie à plusieurs.',
    palier: 'decouverte',
    secret: false,
    mesure: 'victoires',
    seuil: 1,
  },
  {
    id: 'cadeau-empoisonne',
    nom: 'Cadeau empoisonné',
    description: 'Ramasser un malus, qui frappe les autres joueurs.',
    palier: 'decouverte',
    secret: false,
    mesure: 'malusRamasses',
    seuil: 1,
  },

  // Habitue: dans la premiere semaine.
  {
    id: 'habitue',
    nom: 'Habitué',
    description: 'Jouer 25 parties.',
    palier: 'habitue',
    secret: false,
    mesure: 'partiesJouees',
    seuil: 25,
    unite: PARTIES,
  },
  {
    id: 'dix-couronnes',
    nom: 'Dix couronnes',
    description: 'Gagner 10 parties à plusieurs.',
    palier: 'habitue',
    secret: false,
    mesure: 'victoires',
    seuil: 10,
    unite: VICTOIRES,
  },
  {
    id: 'pickpocket',
    nom: 'Pickpocket',
    description: 'Prendre 50 joueurs au total.',
    palier: 'habitue',
    secret: false,
    mesure: 'prises',
    seuil: 50,
    unite: PRISES,
  },
  {
    id: 'demineur',
    nom: 'Démineur',
    description: 'Détruire 25 Black Ninjas au total.',
    palier: 'habitue',
    secret: false,
    mesure: 'blackNinjasDetruits',
    seuil: 25,
    unite: BLACK_NINJAS,
  },
  {
    id: 'touriste',
    nom: 'Touriste',
    description: 'Jouer sur trois cartes différentes.',
    palier: 'habitue',
    secret: false,
    mesure: 'cartes',
    seuil: 3,
    unite: CARTES,
  },
  {
    id: 'touche-a-tout',
    nom: 'Touche-à-tout',
    description: 'Jouer dans cinq modes différents.',
    palier: 'habitue',
    secret: false,
    mesure: 'modes',
    seuil: 5,
    unite: MODES,
  },
  {
    id: 'fidele',
    nom: 'Fidèle',
    description: 'Jouer sept jours différents.',
    palier: 'habitue',
    secret: false,
    mesure: 'jours',
    seuil: 7,
    unite: JOURS,
  },
  {
    id: 'recrue',
    nom: 'Recrue',
    description: 'Atteindre le niveau 5.',
    palier: 'habitue',
    secret: false,
    mesure: 'xpTotale',
    seuil: xpDuNiveau(5),
    unite: XP,
  },
  {
    id: 'argent',
    nom: 'Argent',
    description: 'Atteindre le palier Argent.',
    palier: 'habitue',
    secret: false,
    mesure: 'sommetDesPointsDeLigue',
    seuil: seuilDuPalier('argent'),
    unite: POINTS_DE_LIGUE,
  },
  {
    id: 'en-bande',
    nom: 'En bande',
    description: 'Jouer 10 parties avec un même ami.',
    palier: 'habitue',
    secret: false,
    mesure: 'partiesAvecUnAmi',
    seuil: 10,
    unite: PARTIES,
  },
  {
    id: 'razzia',
    nom: 'Razzia',
    description: 'Récupérer au moins 20 ninjas d’une seule capture.',
    palier: 'habitue',
    secret: false,
    mesure: 'meilleureRazzia',
    seuil: 20,
  },
  {
    id: 'revanche',
    nom: 'Revanche',
    description: 'Prendre, moins de 30 secondes après, le joueur qui vient de vous prendre.',
    palier: 'habitue',
    secret: false,
    mesure: 'revanches',
    seuil: 1,
  },
  {
    id: 'en-chaine',
    nom: 'En chaîne',
    description: 'Atteindre le multiplicateur x3 en Horde, à plusieurs.',
    palier: 'habitue',
    secret: false,
    mesure: 'meilleurMultiplicateurEnHorde',
    seuil: 3,
  },
  {
    id: 'rassembleur',
    nom: 'Rassembleur',
    description: 'Faire entrer un ami dans sa partie par une invitation, et la finir.',
    palier: 'habitue',
    secret: false,
    mesure: 'amisRassembles',
    seuil: 1,
  },
  {
    id: 'pas-de-chance',
    nom: 'Pas de chance',
    description: 'Être pris trois fois par un Black Ninja dans une même partie.',
    palier: 'habitue',
    secret: true,
    mesure: 'malchance',
    seuil: 3,
  },
  {
    id: 'arroseur-arrose',
    nom: 'Arroseur arrosé',
    description: 'Être pris par un joueur moins de 3 secondes après en avoir pris un.',
    palier: 'habitue',
    secret: true,
    mesure: 'arroseursArroses',
    seuil: 1,
  },

  // Expert: en un mois de jeu regulier, ou par un exploit.
  {
    id: 'veteran',
    nom: 'Vétéran',
    description: 'Jouer 100 parties.',
    palier: 'expert',
    secret: false,
    mesure: 'partiesJouees',
    seuil: 100,
    unite: PARTIES,
  },
  {
    id: 'cinquante-couronnes',
    nom: 'Cinquante couronnes',
    description: 'Gagner 50 parties à plusieurs.',
    palier: 'expert',
    secret: false,
    mesure: 'victoires',
    seuil: 50,
    unite: VICTOIRES,
  },
  {
    id: 'serie',
    nom: 'Série',
    description: 'Gagner trois parties à plusieurs d’affilée.',
    palier: 'expert',
    secret: false,
    mesure: 'meilleureSerie',
    seuil: 3,
  },
  {
    id: 'solidaires',
    nom: 'Solidaires',
    description: 'Gagner 10 parties en Équipes.',
    palier: 'expert',
    secret: false,
    mesure: 'victoiresEnEquipes',
    seuil: 10,
    unite: VICTOIRES,
  },
  {
    id: 'confirme',
    nom: 'Confirmé',
    description: 'Atteindre le niveau 20.',
    palier: 'expert',
    secret: false,
    mesure: 'xpTotale',
    seuil: xpDuNiveau(20),
    unite: XP,
  },
  {
    id: 'or',
    nom: 'Or',
    description: 'Atteindre le palier Or.',
    palier: 'expert',
    secret: false,
    mesure: 'sommetDesPointsDeLigue',
    seuil: seuilDuPalier('or'),
    unite: POINTS_DE_LIGUE,
  },
  {
    id: 'meute',
    nom: 'Meute',
    description: 'Infecter trois proies dans une même Chasse.',
    palier: 'expert',
    secret: false,
    mesure: 'meilleureChasse',
    seuil: 3,
  },
  {
    id: 'rivalite',
    nom: 'Rivalité',
    description: 'Finir devant un même ami dans 10 parties.',
    palier: 'expert',
    secret: false,
    mesure: 'devantUnAmi',
    seuil: 10,
    unite: PARTIES,
  },
  {
    id: 'combo-parfait',
    nom: 'Combo parfait',
    description: 'Atteindre le multiplicateur x5, en Horde ou en Massacre, à plusieurs.',
    palier: 'expert',
    secret: false,
    mesure: 'meilleurMultiplicateur',
    seuil: 5,
  },
  {
    id: 'intouchable',
    nom: 'Intouchable',
    description:
      'Gagner une Horde d’au moins quatre joueurs sans jamais être pris, ni par un joueur ni par un Black Ninja.',
    palier: 'expert',
    secret: false,
    mesure: 'victoiresIntouchables',
    seuil: 1,
  },
  {
    id: 'coup-de-filet',
    nom: 'Coup de filet',
    description: 'Prendre au moins huit ninjas d’un seul tir, en Tactique, à plusieurs.',
    palier: 'expert',
    secret: false,
    mesure: 'meilleurFiletEnTactique',
    seuil: 8,
  },
  {
    id: 'derniere-proie',
    nom: 'Dernière proie',
    description: 'Finir une Chasse d’au moins quatre joueurs comme la dernière proie.',
    palier: 'expert',
    secret: false,
    mesure: 'dernieresProies',
    seuil: 1,
  },
  {
    id: 'table-rase',
    nom: 'Table rase',
    description: 'Vider la carte en Massacre, à plusieurs, en y tuant au moins un ninja.',
    palier: 'expert',
    secret: false,
    mesure: 'tablesRases',
    seuil: 1,
  },
  {
    id: 'chasseur-d-evade',
    nom: 'Chasseur d’Évadé',
    description: 'Attraper l’Évadé, à plusieurs.',
    palier: 'expert',
    secret: false,
    mesure: 'evadesAttrapes',
    seuil: 1,
  },
  {
    id: 'main-leste',
    nom: 'Main leste',
    description: 'Prendre le x2 à son porteur.',
    palier: 'expert',
    secret: false,
    mesure: 'doubleursVoles',
    seuil: 1,
  },
  {
    id: 'double-ou-rien',
    nom: 'Double ou rien',
    description: 'Gagner une partie à plusieurs en portant le x2.',
    palier: 'expert',
    secret: false,
    mesure: 'victoiresAvecLeDoubleur',
    seuil: 1,
  },
  {
    id: 'sur-le-fil',
    nom: 'Sur le fil',
    description: 'Prendre un joueur dans la dernière seconde d’une partie.',
    palier: 'expert',
    secret: true,
    mesure: 'prisesSurLeFil',
    seuil: 1,
  },

  // Legende: rares, vises par peu de joueurs.
  {
    id: 'pilier',
    nom: 'Pilier',
    description: 'Jouer 500 parties.',
    palier: 'legende',
    secret: false,
    mesure: 'partiesJouees',
    seuil: 500,
    unite: PARTIES,
  },
  {
    id: 'centurion',
    nom: 'Centurion',
    description: 'Gagner 100 parties à plusieurs.',
    palier: 'legende',
    secret: false,
    mesure: 'victoires',
    seuil: 100,
    unite: VICTOIRES,
  },
  {
    id: 'grand-chelem',
    nom: 'Grand chelem',
    description: 'Gagner une partie à plusieurs dans cinq modes différents.',
    palier: 'legende',
    secret: false,
    mesure: 'modesGagnes',
    seuil: 5,
    unite: MODES,
  },
  {
    id: 'diamant',
    nom: 'Diamant',
    description: 'Atteindre le palier Diamant.',
    palier: 'legende',
    secret: false,
    mesure: 'sommetDesPointsDeLigue',
    seuil: seuilDuPalier('diamant'),
    unite: POINTS_DE_LIGUE,
  },
  {
    id: 'legende',
    nom: 'Légende',
    description: 'Atteindre le niveau 50.',
    palier: 'legende',
    secret: false,
    mesure: 'xpTotale',
    seuil: xpDuNiveau(50),
    unite: XP,
  },
  {
    id: 'collectionneur-de-fantomes',
    nom: 'Collectionneur de fantômes',
    description: 'Attraper l’Évadé 10 fois, à plusieurs.',
    palier: 'legende',
    secret: false,
    mesure: 'evadesAttrapes',
    seuil: 10,
    unite: EVADES,
  },
  {
    id: 'seigneur-de-la-horde',
    nom: 'Seigneur de la Horde',
    description: 'Rallier 10\u00a0000 ninjas en Horde, à plusieurs, au total.',
    palier: 'legende',
    secret: false,
    mesure: 'ninjasRallies',
    seuil: 10_000,
    unite: NINJAS,
  },
] as const satisfies readonly DefinitionDeSucces[];

/** L'identifiant d'un succes connu. */
export type IdentifiantSucces = (typeof DEFINITIONS)[number]['id'];

/** Un succes connu: sa definition, et un identifiant que le code sait nommer. */
export interface SuccesConnu extends DefinitionDeSucces {
  readonly id: IdentifiantSucces;
}

/** Tous les succes, palier par palier, dans l'ordre ou ils s'affichent. */
export const SUCCES: readonly SuccesConnu[] = DEFINITIONS;

/** Les definitions, par identifiant. */
const PAR_IDENTIFIANT: ReadonlyMap<string, SuccesConnu> = new Map(
  SUCCES.map((succes) => [succes.id, succes]),
);

/**
 * Cet identifiant est-il celui d'un succes connu. Ce que la base rend peut nommer un
 * succes retire depuis: il s'ignore.
 */
export function estUnSucces(id: string): id is IdentifiantSucces {
  return PAR_IDENTIFIANT.has(id);
}

/** La definition d'un succes connu. */
export function definitionDuSucces(id: IdentifiantSucces): SuccesConnu {
  const definition = PAR_IDENTIFIANT.get(id);

  if (definition === undefined) {
    throw new Error(`Aucun succes ne s'appelle ${id}.`);
  }

  return definition;
}

/** Ce succes est-il obtenu avec ces mesures. */
export function estAtteint(succes: DefinitionDeSucces, mesures: Mesures): boolean {
  return mesures[succes.mesure] >= succes.seuil;
}

// --------------------------------------------------------------------------
// Le pli
// --------------------------------------------------------------------------

/** Ce que le parcours d'un compte dit de ses succes. */
export interface ParcoursDeSucces {
  /** Les mesures apres toutes les parties. */
  readonly mesures: Mesures;
  /**
   * Pour chaque succes atteint, l'index, dans les parties recues, de celle apres
   * laquelle il l'etait pour la premiere fois. Un succes absent n'est pas atteint.
   */
  readonly premieres: ReadonlyMap<IdentifiantSucces, number>;
}

/** Ce que deux amis ont fait ensemble, du point de vue du compte. */
interface AvecUnAmi {
  ensemble: number;
  devant: number;
}

/**
 * Les compteurs du pli. Mutables, mais crees et abandonnes par un seul appel de
 * parcoursDe: rien n'en sort, et deux appels ne partagent rien.
 */
interface Compteurs {
  partiesJouees: number;
  partiesEnMiroir: number;
  podiums: number;
  victoires: number;
  victoiresEnEquipes: number;
  serieEnCours: number;
  meilleureSerie: number;
  prises: number;
  blackNinjasDetruits: number;
  meilleureChasse: number;
  xpTotale: number;
  pointsDeLigue: number;
  sommetDesPointsDeLigue: number;
  readonly cartes: Set<CarteEnregistree>;
  readonly modes: Set<Mode>;
  readonly modesGagnes: Set<Mode>;
  readonly jours: Set<string>;
  readonly amis: Map<string, AvecUnAmi>;
  /** Les mesures des faits de partie (etape 3.8), tenues a part: voir ajouterLesFaits. */
  readonly exploits: Record<MesureDExploit, number>;
}

/**
 * Les mesures qui se tirent des faits de partie. Un nom qui ne serait pas une mesure
 * tomberait de ce type, et mesuresDe ne compilerait plus.
 */
type MesureDExploit = Extract<
  Mesure,
  | 'malusRamasses'
  | 'meilleureRazzia'
  | 'revanches'
  | 'meilleurMultiplicateurEnHorde'
  | 'meilleurMultiplicateur'
  | 'victoiresIntouchables'
  | 'meilleurFiletEnTactique'
  | 'dernieresProies'
  | 'tablesRases'
  | 'evadesAttrapes'
  | 'doubleursVoles'
  | 'victoiresAvecLeDoubleur'
  | 'ninjasRallies'
  | 'malchance'
  | 'prisesSurLeFil'
  | 'arroseursArroses'
  | 'amisRassembles'
>;

/**
 * Le parcours d'un compte: ses mesures, et la premiere partie de chaque succes atteint.
 *
 * @param parties Son historique, dans l'ordre ou les parties se sont terminees.
 */
export function parcoursDe(parties: readonly PartieDuParcours[]): ParcoursDeSucces {
  const compteurs = compteursVides();
  const premieres = new Map<IdentifiantSucces, number>();
  let mesures = mesuresDe(compteurs);

  parties.forEach((partie, index) => {
    ajouterLaPartie(compteurs, partie);
    mesures = mesuresDe(compteurs);

    for (const succes of SUCCES) {
      if (!premieres.has(succes.id) && estAtteint(succes, mesures)) {
        premieres.set(succes.id, index);
      }
    }
  });

  return { mesures, premieres };
}

/** Les compteurs d'un compte qui n'a encore rien joue. */
function compteursVides(): Compteurs {
  return {
    partiesJouees: 0,
    partiesEnMiroir: 0,
    podiums: 0,
    victoires: 0,
    victoiresEnEquipes: 0,
    serieEnCours: 0,
    meilleureSerie: 0,
    prises: 0,
    blackNinjasDetruits: 0,
    meilleureChasse: 0,
    xpTotale: 0,
    pointsDeLigue: 0,
    sommetDesPointsDeLigue: 0,
    cartes: new Set(),
    modes: new Set(),
    modesGagnes: new Set(),
    jours: new Set(),
    amis: new Map(),
    exploits: {
      malusRamasses: 0,
      meilleureRazzia: 0,
      revanches: 0,
      meilleurMultiplicateurEnHorde: 0,
      meilleurMultiplicateur: 0,
      victoiresIntouchables: 0,
      meilleurFiletEnTactique: 0,
      dernieresProies: 0,
      tablesRases: 0,
      evadesAttrapes: 0,
      doubleursVoles: 0,
      victoiresAvecLeDoubleur: 0,
      ninjasRallies: 0,
      malchance: 0,
      prisesSurLeFil: 0,
      arroseursArroses: 0,
      amisRassembles: 0,
    },
  };
}

/** Ajoute une partie aux compteurs. */
function ajouterLaPartie(compteurs: Compteurs, partie: PartieDuParcours): void {
  const aPlusieurs = partie.nombreJoueurs >= JOUEURS_POUR_UNE_VICTOIRE;
  const victoire = aPlusieurs && partie.placement === 1;

  compteurs.partiesJouees += 1;
  compteurs.partiesEnMiroir += partie.modeMiroir ? 1 : 0;
  compteurs.podiums += surLePodium(partie) ? 1 : 0;
  compteurs.prises += partie.captures;
  compteurs.blackNinjasDetruits += partie.botsNoirsDetruits;
  compteurs.xpTotale += partie.xpGagnee + (partie.xpDesDefis ?? 0);
  compteurs.cartes.add(partie.carte);
  compteurs.modes.add(partie.mode);
  compteurs.jours.add(partie.jour);

  if (partie.mode === 'chasse') {
    compteurs.meilleureChasse = Math.max(compteurs.meilleureChasse, partie.captures);
  }

  // Les points de ligue se rejouent depuis zero, variation par variation: chacune est
  // celle que la base a appliquee, deja reduite pour ne pas descendre sous zero.
  compteurs.pointsDeLigue = Math.max(compteurs.pointsDeLigue + partie.variationPointsLigue, 0);
  compteurs.sommetDesPointsDeLigue = Math.max(
    compteurs.sommetDesPointsDeLigue,
    compteurs.pointsDeLigue,
  );

  // Une partie jouee seul n'est ni une victoire ni une defaite: elle n'interrompt pas
  // une serie.
  if (aPlusieurs) {
    compteurs.serieEnCours = victoire ? compteurs.serieEnCours + 1 : 0;
    compteurs.meilleureSerie = Math.max(compteurs.meilleureSerie, compteurs.serieEnCours);
  }

  if (victoire) {
    compteurs.victoires += 1;
    compteurs.victoiresEnEquipes += partie.mode === 'equipes' ? 1 : 0;
    compteurs.modesGagnes.add(partie.mode);
  }

  for (const ami of partie.amis) {
    const avecLui = compteurs.amis.get(ami.compte) ?? { ensemble: 0, devant: 0 };

    avecLui.ensemble += 1;
    // Une egalite, coequipiers d'Equipes ou deux abandons, ne fait devancer personne.
    avecLui.devant += partie.placement < ami.placement ? 1 : 0;
    compteurs.amis.set(ami.compte, avecLui);
  }

  // Les exploits ne comptent qu'a plusieurs (decision du porteur du projet, 28 septembre
  // 2026): seul, une Horde se rallie sans concurrence, et une partie privee deviendrait
  // une ferme a exploits. Les faits d'une partie seule restent enregistres.
  if (aPlusieurs && partie.faits !== undefined) {
    ajouterLesFaits(compteurs.exploits, partie, partie.faits, victoire);
  }
}

/**
 * Ajoute les faits releves d'une partie aux mesures des exploits (etape 3.8).
 *
 * Le releve ne connait que la partie en train de se jouer: ce qui depend du mode, du
 * nombre de joueurs ou du placement se croise ici, avec le resultat. La regle d'une
 * victoire reste donc celle du socle.
 */
function ajouterLesFaits(
  exploits: Record<MesureDExploit, number>,
  partie: PartieDuParcours,
  faits: FaitsDePartie,
  victoire: boolean,
): void {
  const fait = (nom: FaitDePartie): number => faits[nom] ?? 0;
  const contreDesAdversaires = partie.nombreJoueurs >= JOUEURS_POUR_UN_EXPLOIT;

  exploits.malusRamasses += fait('malusRamasses');
  exploits.meilleureRazzia = Math.max(exploits.meilleureRazzia, fait('meilleureRazzia'));
  exploits.revanches += fait('revanches');
  // Seules la Horde et le Massacre ont un combo: le fait n'existe pas ailleurs.
  exploits.meilleurMultiplicateur = Math.max(
    exploits.meilleurMultiplicateur,
    fait('meilleurMultiplicateur'),
  );
  exploits.tablesRases += fait('tableRase');
  exploits.evadesAttrapes += fait('evadesAttrapes');
  exploits.doubleursVoles += fait('doubleursVoles');
  exploits.ninjasRallies += fait('ninjasRallies');
  exploits.malchance = Math.max(exploits.malchance, fait('prisParUnBlackNinja'));
  exploits.prisesSurLeFil += fait('prisesSurLeFil');
  exploits.arroseursArroses += fait('arroseurArrose');
  exploits.amisRassembles += fait('amisRassembles');

  if (partie.mode === 'classique') {
    exploits.meilleurMultiplicateurEnHorde = Math.max(
      exploits.meilleurMultiplicateurEnHorde,
      fait('meilleurMultiplicateur'),
    );
    exploits.victoiresIntouchables +=
      victoire && contreDesAdversaires && fait('intouchable') > 0 ? 1 : 0;
  }

  if (partie.mode === 'tactique') {
    exploits.meilleurFiletEnTactique = Math.max(
      exploits.meilleurFiletEnTactique,
      fait('meilleurFilet'),
    );
  }

  if (partie.mode === 'chasse') {
    exploits.dernieresProies += contreDesAdversaires && fait('derniereProie') > 0 ? 1 : 0;
  }

  exploits.victoiresAvecLeDoubleur += victoire && fait('finiAvecLeDoubleur') > 0 ? 1 : 0;
}

/**
 * Cette partie met-elle le compte sur le podium.
 *
 * En Equipes, la place est celle de l'equipe: dans un deux contre deux, les perdants
 * sont troisiemes. Seule l'equipe gagnante y monte.
 */
function surLePodium(partie: PartieDuParcours): boolean {
  if (partie.nombreJoueurs < JOUEURS_POUR_UN_PODIUM) {
    return false;
  }

  return partie.mode === 'equipes' ? partie.placement === 1 : partie.placement <= PLACES_DU_PODIUM;
}

/** Les mesures que ces compteurs donnent. */
function mesuresDe(compteurs: Compteurs): Mesures {
  let partiesAvecUnAmi = 0;
  let devantUnAmi = 0;

  for (const avecLui of compteurs.amis.values()) {
    partiesAvecUnAmi = Math.max(partiesAvecUnAmi, avecLui.ensemble);
    devantUnAmi = Math.max(devantUnAmi, avecLui.devant);
  }

  return {
    partiesJouees: compteurs.partiesJouees,
    partiesEnMiroir: compteurs.partiesEnMiroir,
    podiums: compteurs.podiums,
    victoires: compteurs.victoires,
    victoiresEnEquipes: compteurs.victoiresEnEquipes,
    meilleureSerie: compteurs.meilleureSerie,
    prises: compteurs.prises,
    blackNinjasDetruits: compteurs.blackNinjasDetruits,
    meilleureChasse: compteurs.meilleureChasse,
    cartes: compteurs.cartes.size,
    modes: compteurs.modes.size,
    modesGagnes: compteurs.modesGagnes.size,
    jours: compteurs.jours.size,
    xpTotale: compteurs.xpTotale,
    sommetDesPointsDeLigue: compteurs.sommetDesPointsDeLigue,
    partiesAvecUnAmi,
    devantUnAmi,
    ...compteurs.exploits,
  };
}

// --------------------------------------------------------------------------
// Ce qui se montre
// --------------------------------------------------------------------------

/** Ou en est un cumul: sa mesure, et le seuil a atteindre. */
export interface ProgressionDUnSucces {
  readonly id: IdentifiantSucces;
  readonly actuel: number;
  readonly seuil: number;
}

/**
 * La progression de ce succes, s'il en montre une: un cumul non obtenu, qui n'est pas
 * secret. La mesure est plafonnee au seuil.
 */
export function progressionDuSucces(
  succes: SuccesConnu,
  mesures: Mesures,
): ProgressionDUnSucces | undefined {
  if (succes.unite === undefined || succes.secret) {
    return undefined;
  }

  return {
    id: succes.id,
    actuel: Math.min(mesures[succes.mesure], succes.seuil),
    seuil: succes.seuil,
  };
}

/**
 * Le cumul le plus proche de son seuil, parmi ceux que le compte n'a pas obtenus: la
 * plus grande part faite, puis l'ordre des definitions. Absent si aucun cumul n'est
 * commence (etude des succes, principe 5).
 *
 * @param obtenus Les succes deja enregistres pour ce compte: un succes obtenu ne se
 *                propose plus, meme si sa mesure est retombee (un ami retire).
 */
export function succesLePlusProche(
  mesures: Mesures,
  obtenus: ReadonlySet<string>,
): ProgressionDUnSucces | undefined {
  let plusProche: ProgressionDUnSucces | undefined;

  for (const succes of SUCCES) {
    const progression = progressionDuSucces(succes, mesures);

    if (
      progression === undefined ||
      obtenus.has(succes.id) ||
      progression.actuel <= 0 ||
      progression.actuel >= progression.seuil
    ) {
      continue;
    }

    if (plusProche === undefined || part(progression) > part(plusProche)) {
      plusProche = progression;
    }
  }

  return plusProche;
}

/** La part faite d'un cumul, de 0 a 1. */
function part(progression: ProgressionDUnSucces): number {
  return progression.actuel / progression.seuil;
}
