/**
 * Modele d'etat d'une partie.
 *
 * L'etat est une donnee, pas un objet vivant: rien ici ne se modifie sur place.
 * Chaque fonction qui « change » l'etat en renvoie un nouveau. C'est ce qui rend
 * le moteur testable comme une fonction mathematique, rejouable, et transposable
 * a plusieurs parties simultanees.
 *
 * Portage de Entity (legacy/server.js:832) et Player (:876). Ce que le portage
 * change, et pourquoi:
 *
 *   - Le constructeur du legacy appelait positionManager.getValidPosition() et
 *     getRandomColor(). Ici la position et la couleur sont soit fournies, soit
 *     tirees du generateur a graine transporte par l'etat. Le moteur n'appelle
 *     aucun service exterieur.
 *   - spawnProtection et lastCapture etaient des dates absolues, obtenues par
 *     Date.now(). Ce sont maintenant des durees restantes, que le moteur fait
 *     decroitre a chaque battement. Le moteur ne lit jamais l'horloge.
 *   - Les champs lastX et lastY de Entity ne sont pas portes: le legacy les
 *     ecrit une fois et ne les lit jamais.
 *   - Le champ botsControlled de Player n'est pas porte non plus: c'est le
 *     defaut X11 de l'audit, un compteur remis a zero a cinq endroits, jamais
 *     incremente, et envoye au client qui recoit donc toujours zero.
 *
 * Les effets de bonus arrivent avec l'etape 1.4. On ne pose pas ici des champs
 * dont personne ne sait encore se servir.
 *
 * Ajouts de l'etape 1.3: les compteurs de capture des joueurs, une population de
 * bots, et le journal des evenements du battement. Les bots existent des cette
 * etape-la parce que la capture et le score n'ont aucun sens sans eux: le score
 * d'un joueur est le nombre de bots qui portent sa couleur.
 *
 * Ajouts de l'etape 1.4: les effets portes par les joueurs, les objets a ramasser
 * poses sur la carte, les zones speciales, et de quoi planifier leurs apparitions
 * sans minuterie. Ce fichier decrit ces donnees; les regles qui les font vivre
 * sont dans effets.ts, objets.ts et zones.ts.
 *
 * Ajouts de l'etape 1.5: ce qu'un bot porte pour errer, et ce qu'un bot noir
 * porte en plus pour chasser. Meme partage des roles: ce fichier decrit les
 * donnees, bots.ts porte le comportement.
 */

import type {
  Alea,
  DimensionsCarte,
  Direction,
  Position,
  ReglagesPartie,
  ReglagesPartiels,
  TypeBonus,
  TypeMalus,
  TypeZone,
  Vecteur,
} from '@neon-ninja/shared';
import {
  APPARITION,
  BOTS,
  CARTES,
  COULEUR_BOT_NEUTRE,
  COULEUR_BOT_NOIR,
  DUREES,
  RAYON_ENTITE,
  completerReglages,
  creerAlea,
  reel,
} from '@neon-ninja/shared';

import type { CarteCollisions } from './collisions.js';
import { carteSansMur, positionTenable } from './collisions.js';
import type { Couleur } from './couleurs.js';
import { couleurUnique } from './couleurs.js';
import type { DureesRestantes } from './effets.js';
import { AUCUN_BONUS, AUCUN_MALUS, estActif } from './effets.js';

/** Identifiant d'une entite. Cote serveur, ce sera l'identifiant de la connexion. */
export type IdentifiantEntite = string;

/** Nature d'une entite. Seuls les joueurs existent a ce stade du portage. */
export type TypeEntite = 'joueur' | 'bot' | 'botNoir';

/** Ce que toute entite du jeu possede: une identite, une place, une couleur, un regard. */
export interface Entite {
  readonly id: IdentifiantEntite;
  readonly type: TypeEntite;
  readonly position: Position;
  readonly couleur: Couleur;
  readonly direction: Direction;
}

/**
 * Ce que tout bot porte pour errer sur la carte.
 *
 * Portage des champs de la classe Bot (legacy/server.js:941). Comme partout
 * ailleurs dans le moteur, les instants absolus du legacy deviennent des durees
 * restantes que le battement fait decroitre: lastDirectionChange, lastStateChange
 * et lastMoveCheck etaient trois lectures de Date.now(), interdites ici.
 *
 * Le cap est un vecteur UNITAIRE, et c'est une correction. Le legacy rangeait
 * dans vx et vy un vecteur dont la longueur variait, puis le multipliait par la
 * vitesse des bots: la vitesse reelle d'un bot dependait donc de la longueur de
 * ce vecteur, entre zero et une fois et demie la vitesse annoncee. Voir le defaut
 * X28 de l'audit. Ici, un cap dit ou l'on va, une constante dit a quelle vitesse.
 */
interface TraitsDeBot extends Entite {
  /** Direction suivie quand le bot avance. Vecteur unitaire. */
  readonly cap: Vecteur;
  /** Le bot avance-t-il, ou observe-t-il une pause ? */
  readonly enMouvement: boolean;
  /** Temps avant de basculer entre marche et pause, en millisecondes. */
  readonly avantChangementDEtatMs: number;
  /** Temps avant un changement de cap spontane, en millisecondes. */
  readonly avantChangementDeCapMs: number;
  /** Temps avant le prochain controle de blocage, en millisecondes. */
  readonly avantControleDeBlocageMs: number;
  /** Ou le bot se trouvait lors du dernier controle de blocage. */
  readonly positionAuDernierControle: Position;
  /** Nombre de controles consecutifs pendant lesquels le bot n'a pas avance. */
  readonly controlesSansAvancer: number;
}

/** Un bot ordinaire: il erre, et sa couleur dit a qui il appartient. */
export interface BotOrdinaire extends TraitsDeBot {
  readonly type: 'bot';
}

/**
 * Un bot noir: il erre comme les autres, mais chasse ce qui passe a sa portee.
 *
 * Portage de la classe BlackBot (legacy/server.js:1130), qui etendait Bot. La
 * relation d'heritage devient ici une variante: un bot noir a tout ce qu'un bot
 * ordinaire a, plus une proie et deux comptes a rebours.
 */
export interface BotNoir extends TraitsDeBot {
  readonly type: 'botNoir';
  /** Identifiant de l'entite poursuivie, si le bot noir en a repere une. */
  readonly cible: IdentifiantEntite | undefined;
  /** Temps avant de reconsiderer sa proie, en millisecondes. */
  readonly avantRechercheDeCibleMs: number;
  /** Temps avant de pouvoir capturer a nouveau, en millisecondes. */
  readonly avantProchaineCaptureMs: number;
}

/**
 * Une entite non joueuse: un bot ordinaire, ou un bot noir.
 *
 * Les deux vivent dans la meme collection, la ou le legacy tenait deux tables
 * separees (bots et blackBots). Un seul releve de contacts les parcourt donc
 * tous, et leur nature se lit dans leur champ type.
 */
export type Bot = BotOrdinaire | BotNoir;

/** Combien de fois un joueur en a capture un autre, et sous quel nom. */
export interface HistoriqueCapture {
  /** Pseudo de l'autre joueur au moment de la capture. */
  readonly pseudo: string;
  /** Nombre de captures cumulees entre ces deux joueurs. */
  readonly nombre: number;
}

/** Un joueur connecte a la partie. */
export interface Joueur extends Entite {
  readonly type: 'joueur';
  readonly pseudo: string;
  /**
   * Temps d'invulnerabilite restant apres une apparition, en millisecondes.
   * Trois secondes au depart (comportement a preserver numero 6).
   */
  readonly protectionSpawnRestanteMs: number;
  /**
   * Temps ecoule depuis la derniere capture reussie, en millisecondes.
   *
   * Le joueur doit attendre une seconde entre deux captures (comportement a
   * preserver numero 6). Ce compteur est ecrit dans le sens du legacy, qui
   * calcule « maintenant moins la derniere capture » et compare en inegalite
   * stricte. Un compte a rebours aurait decale la limite d'un battement: la
   * caracterisation a fige un refus a exactement mille millisecondes et une
   * acceptation juste apres.
   *
   * Le compteur est plafonne: au-dela de la limite, sa valeur exacte n'a plus
   * aucun effet, et un nombre qui grandit sans fin n'a rien a faire dans un
   * etat que l'on serialise vingt fois par seconde.
   */
  readonly tempsDepuisDerniereCaptureMs: number;
  /**
   * Temps restant sur chacun des trois bonus, en millisecondes.
   *
   * Portage de Player.bonusTimers (legacy/server.js:876) et des trois
   * indicateurs qui l'accompagnaient. Un bonus est actif tant qu'il lui reste du
   * temps: il n'y a plus d'indicateur separe a tenir d'accord avec la duree.
   */
  readonly bonusRestantsMs: DureesRestantes<TypeBonus>;
  /**
   * Temps restant sur chacun des trois malus subis, en millisecondes.
   *
   * Le legacy ne rangeait rien de tel cote serveur: il envoyait le malus aux
   * autres joueurs et leur client s'en souvenait. Le moteur, lui, doit le savoir,
   * ne serait-ce que pour inverser les commandes de ceux qui le subissent.
   */
  readonly malusRestantsMs: DureesRestantes<TypeMalus>;
  /** Nombre de joueurs captures depuis le debut de la partie. Un cumul, pas un stock. */
  readonly captures: number;
  /** Qui ce joueur a capture, et combien de fois. Portage de capturedPlayers. */
  readonly joueursCaptures: Readonly<Record<IdentifiantEntite, HistoriqueCapture>>;
  /** Qui a capture ce joueur, et combien de fois. Portage de capturedBy. */
  readonly capturesSubies: Readonly<Record<IdentifiantEntite, HistoriqueCapture>>;
  /**
   * Nombre total de bots gagnes en capturant des joueurs. Portage de
   * totalBotsCaptures. C'est un cumul qui ne redescend jamais, a ne pas confondre
   * avec le score, qui est un stock.
   */
  readonly botsGagnesAuTotal: number;
  /** Nombre de bots noirs detruits. Chacun vaut quinze points au score. */
  readonly botsNoirsDetruits: number;
  /**
   * Nombre de fois ou un bot noir a capture ce joueur. Portage de
   * capturedByBlackBot. C'est un cumul, comme captures.
   */
  readonly capturesParBotNoirSubies: number;
}

/**
 * Valeur du compteur de capture qui signifie « pret ». Un joueur qui vient
 * d'apparaitre peut capturer immediatement, comme dans le legacy, ou
 * lastCapture vaut zero face a une horloge absolue.
 */
export const COMPTEUR_CAPTURE_PRET = DUREES.DELAI_ENTRE_CAPTURES_MS + 1;

/** Un joueur vient d'en capturer un autre. */
export interface CaptureDeJoueur {
  readonly type: 'captureJoueur';
  readonly attaquant: IdentifiantEntite;
  readonly victime: IdentifiantEntite;
  /** Nombre de bots passes de la victime a l'attaquant. */
  readonly botsTransferes: number;
  /** Couleur tiree pour la victime a sa reapparition. */
  readonly nouvelleCouleurVictime: Couleur;
  /** Ou la victime se trouvait au moment du contact. */
  readonly position: Position;
}

/**
 * Un objet pose sur la carte, en attente d'etre ramasse: un bonus ou un malus.
 *
 * Portage des classes Bonus (legacy/server.js:1347) et Malus (:1401), qui
 * etaient identiques a la ligne pres. Elles n'en font plus qu'une, distinguee
 * par sa nature: la difference entre les deux n'est pas dans l'objet pose, elle
 * est dans ce qui arrive quand on le ramasse.
 *
 * Ce que le portage laisse de cote: shouldBlink et getBlinkState, qui calculaient
 * une opacite et une echelle a partir de Date.now(). C'est de l'animation, donc
 * du client. Il retrouvera ce qu'il lui faut dans dureeDeVieRestanteMs et le
 * seuil de clignotement de OBJETS.
 */
interface ObjetPose {
  readonly id: IdentifiantEntite;
  readonly position: Position;
  /** Temps avant que l'objet disparaisse de lui-meme, en millisecondes. */
  readonly dureeDeVieRestanteMs: number;
}

/** Un bonus pose sur la carte. Il profite a celui qui le ramasse. */
export interface BonusPose extends ObjetPose {
  readonly categorie: 'bonus';
  readonly nature: TypeBonus;
}

/** Un malus pose sur la carte. Il frappe les autres joueurs que le ramasseur. */
export interface MalusPose extends ObjetPose {
  readonly categorie: 'malus';
  readonly nature: TypeMalus;
}

/** Un objet a ramasser: un bonus ou un malus. */
export type ObjetRamassable = BonusPose | MalusPose;

/**
 * Une zone speciale: un disque pose sur la carte, qui agit sur ce qui s'y trouve.
 *
 * Portage de SpecialZone (legacy/server.js:487). Le legacy prevoyait deux formes,
 * cercle et rectangle, mais n'en produisait jamais qu'une: generateRandomShape ne
 * fabrique que des cercles. Le rectangle n'est pas porte, c'est du code mort.
 *
 * Les couleurs et le nom d'affichage de la zone ne sont pas portes non plus: ils
 * appartiennent au client, qui les connait par la nature de la zone.
 */
export interface ZoneSpeciale {
  readonly id: IdentifiantEntite;
  readonly type: TypeZone;
  readonly centre: Position;
  readonly rayon: number;
  /** Temps avant que la zone disparaisse, en millisecondes. */
  readonly dureeRestanteMs: number;
}

/** Un joueur vient de ramasser un bonus. */
export interface BonusRamasse {
  readonly type: 'bonusRamasse';
  readonly joueur: IdentifiantEntite;
  readonly nature: TypeBonus;
  /** Duree ajoutee par ce ramassage, en millisecondes. */
  readonly dureeMs: number;
  readonly position: Position;
}

/**
 * Un joueur vient de ramasser un malus, que les autres subissent.
 *
 * Le ramasseur est epargne: c'est le comportement a preserver numero 4 de
 * CLAUDE.md. L'evenement porte les deux informations dont le serveur aura besoin
 * a l'etape 2.2: qui prevenir de sa bonne fortune, et qui prevenir du contraire.
 */
export interface MalusRamasse {
  readonly type: 'malusRamasse';
  readonly joueur: IdentifiantEntite;
  readonly nature: TypeMalus;
  /** Duree imposee aux autres joueurs, en millisecondes. */
  readonly dureeMs: number;
  readonly victimes: readonly IdentifiantEntite[];
  readonly position: Position;
}

/**
 * Un bot noir vient de capturer un joueur.
 *
 * Portage de la notification capturedByBlackBot (legacy/server.js:1318). La
 * victime ne perd pas tout, contrairement a une capture par un autre joueur: elle
 * garde sa couleur et une part seulement de ses bots redevient neutre. Elle
 * reapparait ailleurs, avec une protection neuve.
 */
export interface CaptureParBotNoir {
  readonly type: 'captureParBotNoir';
  readonly botNoir: IdentifiantEntite;
  readonly victime: IdentifiantEntite;
  /** Nombre de bots de la victime redevenus neutres. */
  readonly botsPerdus: number;
  /** Ou la victime se trouvait au moment du contact. */
  readonly position: Position;
}

/** Un joueur invincible vient de detruire un bot noir. */
export interface DestructionDeBotNoir {
  readonly type: 'botNoirDetruit';
  readonly joueur: IdentifiantEntite;
  readonly botNoir: IdentifiantEntite;
  /** Ou le bot noir se trouvait quand il a ete detruit. */
  readonly position: Position;
  /** Points rapportes par cette destruction. */
  readonly points: number;
}

/**
 * Un fait notable survenu pendant un battement.
 *
 * C'est ce que le moteur laisse a la couche qui l'appelle: le serveur en fait des
 * messages, le client en fait des sons et des animations. Le moteur, lui, ne
 * connait ni son ni animation ni notification. Il constate, il n'annonce pas.
 *
 * La liste est remise a zero au debut de chaque battement: elle decrit ce qui
 * vient de se passer, pas l'histoire de la partie. Celle-ci se lit dans les
 * compteurs des joueurs.
 */
export type EvenementPartie =
  CaptureDeJoueur | CaptureParBotNoir | DestructionDeBotNoir | BonusRamasse | MalusRamasse;

/** L'etat complet d'une partie a un instant donne. */
export interface EtatPartie {
  /** Nombre de battements de moteur ecoules depuis le debut de la partie. */
  readonly tick: number;
  /** Temps de jeu ecoule, en millisecondes. */
  readonly tempsEcouleMs: number;
  /** Duree totale prevue pour la partie, en millisecondes. */
  readonly dureeMs: number;
  /** Reglages choisis par l'hote. Le moteur ne connait que ceux-la. */
  readonly reglages: ReglagesPartie;
  /** Dimensions de la carte jouee. */
  readonly carte: DimensionsCarte;
  /**
   * Le terrain: ou l'on peut marcher, ou l'on ne peut pas.
   *
   * C'est une donnee de configuration, constante pendant toute la partie. Elle
   * voyage dans l'etat pour que le moteur garde son contrat a trois arguments,
   * tick(etat, entrees, dt), mais elle n'est jamais recopiee d'un battement au
   * suivant: tous les etats successifs d'une partie partagent la meme carte.
   * Elle n'a pas non plus vocation a etre diffusee aux clients a chaque
   * battement: la couche reseau choisira ce qu'elle envoie (etape 2.2).
   */
  readonly terrain: CarteCollisions;
  /** Les joueurs de la partie, indexes par identifiant. */
  readonly joueurs: Readonly<Record<IdentifiantEntite, Joueur>>;
  /** Les bots et les bots noirs de la partie, indexes par identifiant. */
  readonly bots: Readonly<Record<IdentifiantEntite, Bot>>;
  /** Les bonus et malus poses sur la carte, indexes par identifiant. */
  readonly objets: Readonly<Record<IdentifiantEntite, ObjetRamassable>>;
  /** Les zones speciales actives, indexees par identifiant. */
  readonly zones: Readonly<Record<IdentifiantEntite, ZoneSpeciale>>;
  /** Compte a rebours avant les prochaines apparitions. Voir ProchainesApparitions. */
  readonly prochainesApparitions: ProchainesApparitions;
  /**
   * Numero du prochain objet ou de la prochaine zone cree par le moteur.
   *
   * Le legacy fabriquait ses identifiants avec Date.now() et Math.random(), deux
   * choses interdites ici. Un simple compteur suffit: il ne se repete pas, il ne
   * depend pas de l'horloge, et deux parties de meme graine donnent les memes
   * identifiants.
   */
  readonly compteurIdentifiants: number;
  /**
   * Ce qui vient de se passer pendant le dernier battement. Remis a zero au
   * debut du battement suivant.
   */
  readonly evenements: readonly EvenementPartie[];
  /** Generateur a graine de la partie. Tout tirage le fait avancer. */
  readonly alea: Alea;
}

/**
 * Temps restant avant les prochaines apparitions, en millisecondes.
 *
 * C'EST ICI QUE MEURT LE DEFAUT X1 DE L'AUDIT. Le legacy planifiait ses
 * apparitions par setTimeout, et ces minuteries se replanifiaient elles-memes
 * sans jamais etre annulees: chaque partie ajoutait une chaine parallele, si bien
 * qu'apres cinq parties les bonus apparaissaient cinq fois plus vite. C'est ce
 * qui donnait la sensation d'un jeu qui devient incoherent et redevient normal
 * apres un redemarrage du serveur.
 *
 * Ici la planification est une donnee de l'etat, avancee par dt. Il n'y a rien a
 * annuler: une nouvelle partie part d'un nouvel etat, donc de comptes a rebours
 * neufs. Le defaut ne peut pas revenir.
 */
export interface ProchainesApparitions {
  /** Avant la prochaine tentative d'apparition de bonus. */
  readonly bonusMs: number;
  /** Avant la prochaine tentative d'apparition de malus. */
  readonly malusMs: number;
  /** Avant la prochaine apparition de zone speciale. */
  readonly zoneMs: number;
}

/** Ce qu'il faut pour demarrer une partie. */
export interface OptionsEtatInitial {
  /** Graine de la partie. Deux parties de meme graine et memes entrees sont identiques. */
  readonly graine: number;
  /** Reglages a appliquer. Ceux qui manquent prennent la valeur par defaut. */
  readonly reglages?: ReglagesPartiels;
  /**
   * Terrain de la partie, prepare a l'exterieur du moteur a partir de l'image de
   * collision de la carte choisie. Ses dimensions doivent etre celles de cette
   * carte. Sans terrain, la partie se joue sur une carte sans mur, bornee par
   * ses seuls bords: c'est le repli du legacy quand son image manquait.
   */
  readonly terrain?: CarteCollisions;
}

/** Ce qu'il faut pour faire entrer un joueur dans la partie. */
export interface OptionsAjoutJoueur {
  readonly id: IdentifiantEntite;
  readonly pseudo: string;
  /** Position imposee. Sinon elle est tiree de la graine. */
  readonly position?: Position;
  /** Couleur imposee. Sinon elle est tiree parmi celles encore libres. */
  readonly couleur?: Couleur;
}

/** Cree l'etat de depart d'une partie: pas de joueur, pas de temps ecoule. */
export function creerEtatInitial(options: OptionsEtatInitial): EtatPartie {
  const reglages: ReglagesPartie = completerReglages(options.reglages);
  const carte = CARTES[reglages.carte];
  const terrain = options.terrain ?? carteSansMur(carte);

  // Un terrain aux mauvaises dimensions est une faute d'appelant, et c'est
  // exactement la nature du defaut X5 de l'audit: le legacy jouait sur la grande
  // carte en croyant qu'elle mesurait 2000 sur 1500. On le refuse au lieu de le
  // laisser passer.
  if (terrain.largeur !== carte.largeur || terrain.hauteur !== carte.hauteur) {
    throw new Error(
      `Le terrain fourni mesure ${terrain.largeur}x${terrain.hauteur}, ` +
        `mais la carte ${reglages.carte} mesure ${carte.largeur}x${carte.hauteur}.`,
    );
  }

  return {
    tick: 0,
    tempsEcouleMs: 0,
    dureeMs: reglages.dureePartieS * 1000,
    reglages,
    carte,
    terrain,
    joueurs: {},
    bots: {},
    objets: {},
    zones: {},
    // Bonus et malus tentent leur chance des le premier battement, comme le
    // legacy qui appelait spawnBonus et spawnMalus au lancement de la partie. La
    // premiere zone, elle, attend son intervalle: le legacy n'en planifiait une
    // qu'au premier passage de manageSpecialZones.
    prochainesApparitions: {
      bonusMs: 0,
      malusMs: 0,
      zoneMs: reglages.zones.intervalleApparitionS * 1000,
    },
    compteurIdentifiants: 0,
    evenements: [],
    alea: creerAlea(options.graine),
  };
}

/**
 * Donne un identifiant neuf a un objet ou a une zone que le moteur cree.
 *
 * L'appelant doit reporter le compteur rendu dans l'etat qu'il construit, comme
 * il le fait deja pour le generateur a graine.
 */
export function identifiantSuivant(
  etat: EtatPartie,
  prefixe: string,
): { readonly valeur: IdentifiantEntite; readonly compteur: number } {
  return {
    valeur: `${prefixe}-${etat.compteurIdentifiants}`,
    compteur: etat.compteurIdentifiants + 1,
  };
}

/**
 * Tire une position d'apparition sur la carte.
 *
 * Portage de PositionManager.getValidPosition (legacy/server.js:228) et de son
 * chemin de secours _findBackupPosition (:305). On tire jusqu'a cent positions
 * au hasard, a cent pixels des bords, et on garde la premiere qui convient. Si
 * aucune ne convient, une recherche en spirale depuis le centre prend le relais.
 *
 * DEUX DEFAUTS DE L'AUDIT SONT CORRIGES ICI.
 *
 * X3, le chemin de secours plantait. Le legacy y lisait une variable startTime
 * jamais declaree, pour afficher une duree: le repli levait donc une erreur au
 * lieu de replier quoi que ce soit, et il devient d'autant plus probable que la
 * carte est encombree. Il n'y a plus rien a afficher ici, le moteur n'ecrit
 * nulle part, et la spirale fonctionne.
 *
 * X4, la distance de securite ne s'appliquait jamais. Le legacy tenait un
 * registre des positions des entites pour empecher deux apparitions collees,
 * mais il ne l'alimentait nulle part: le registre restait vide, et les cent
 * pixels de SAFE_SPAWN_DISTANCE etaient lettre morte. Decision de l'etape 1.2:
 * on fait vivre le mecanisme plutot que de le retirer, parce qu'apparaitre colle
 * a un adversaire ou a un bot noir est une mauvaise experience de jeu, et que
 * c'etait manifestement l'intention. Il n'y a plus de registre a tenir a jour:
 * les positions occupees sont lues dans l'etat, donc elles ne peuvent plus etre
 * oubliees.
 *
 * La distance de securite reste un souhait, pas une obligation: si la carte est
 * trop encombree pour la respecter, on prefere une position dans un espace libre
 * a un echec. C'est le role du second passage de la spirale.
 *
 * @param alea Generateur a graine. Le tirage le fait avancer.
 * @param terrain Le terrain, qui porte aussi les dimensions de la carte.
 * @param occupees Positions deja prises, a eviter d'une distance de securite.
 * @param rayon Encombrement de l'entite qui apparait.
 */
export function positionDApparition(
  alea: Alea,
  terrain: CarteCollisions,
  occupees: readonly Position[] = [],
  rayon: number = RAYON_ENTITE,
): {
  readonly valeur: Position;
  readonly alea: Alea;
} {
  let generateur = alea;

  for (let tentative = 0; tentative < APPARITION.TENTATIVES_MAXIMUM; tentative += 1) {
    const tirageX = reel(
      generateur,
      APPARITION.MARGE_BORD,
      terrain.largeur - APPARITION.MARGE_BORD,
    );
    const tirageY = reel(
      tirageX.alea,
      APPARITION.MARGE_BORD,
      terrain.hauteur - APPARITION.MARGE_BORD,
    );
    generateur = tirageY.alea;

    const candidate = { x: tirageX.valeur, y: tirageY.valeur };
    if (positionTenable(terrain, candidate, rayon) && aLEcartDe(candidate, occupees)) {
      return { valeur: candidate, alea: generateur };
    }
  }

  return { valeur: positionDeSecours(terrain, occupees, rayon), alea: generateur };
}

/** Une position respecte-t-elle la distance de securite avec toutes les autres ? */
function aLEcartDe(position: Position, occupees: readonly Position[]): boolean {
  return occupees.every(
    (autre) =>
      Math.hypot(position.x - autre.x, position.y - autre.y) >= APPARITION.DISTANCE_DE_SECURITE,
  );
}

/**
 * Cherche une place en spirale depuis le centre de la carte, quand le tirage au
 * sort n'a rien donne.
 *
 * Portage de _findBackupPosition (legacy/server.js:305), avec deux differences.
 * Le centre est celui de la carte reellement jouee, et non le 2000 sur 1500 que
 * le legacy renvoyait toujours (defaut X5). Et la recherche se fait en deux
 * passages: le premier respecte la distance de securite, le second se contente
 * d'un espace libre. Faute de quoi, le centre de la carte, comme le legacy.
 */
function positionDeSecours(
  terrain: CarteCollisions,
  occupees: readonly Position[],
  rayon: number,
): Position {
  const centre = { x: terrain.largeur / 2, y: terrain.hauteur / 2 };

  for (const exigeLEcart of [true, false]) {
    for (let anneau = 1; anneau < 20; anneau += 1) {
      for (let secteur = 0; secteur < 16; secteur += 1) {
        const cap = (secteur * Math.PI) / 8;
        const candidate = {
          x: centre.x + Math.cos(cap) * anneau * APPARITION.PAS_SPIRALE,
          y: centre.y + Math.sin(cap) * anneau * APPARITION.PAS_SPIRALE,
        };

        if (
          positionTenable(terrain, candidate, rayon) &&
          (!exigeLEcart || aLEcartDe(candidate, occupees))
        ) {
          return candidate;
        }
      }
    }
  }

  return centre;
}

/**
 * Fait entrer un joueur dans la partie.
 *
 * Le joueur apparait avec sa protection de trois secondes, une couleur libre et
 * une position tiree de la graine, a l'ecart des murs et des autres joueurs,
 * sauf si l'appelant impose l'une ou l'autre.
 *
 * Une position imposee n'est pas verifiee: elle vient d'un appelant qui sait ce
 * qu'il fait, un test ou une reprise de partie. Une entite posee dans un mur y
 * reste bloquee, aucun deplacement ne pouvant plus la liberer.
 */
export function ajouterJoueur(etat: EtatPartie, options: OptionsAjoutJoueur): EtatPartie {
  let alea = etat.alea;

  let couleur = options.couleur;
  if (couleur === undefined) {
    const tirage = couleurUnique(alea, couleursUtilisees(etat));
    couleur = tirage.valeur;
    alea = tirage.alea;
  }

  let position = options.position;
  if (position === undefined) {
    const tirage = positionDApparition(alea, etat.terrain, positionsOccupees(etat));
    position = tirage.valeur;
    alea = tirage.alea;
  }

  const joueur: Joueur = {
    id: options.id,
    type: 'joueur',
    pseudo: options.pseudo,
    position,
    couleur,
    direction: 'immobile',
    protectionSpawnRestanteMs: DUREES.PROTECTION_SPAWN_MS,
    tempsDepuisDerniereCaptureMs: COMPTEUR_CAPTURE_PRET,
    bonusRestantsMs: AUCUN_BONUS,
    malusRestantsMs: AUCUN_MALUS,
    captures: 0,
    joueursCaptures: {},
    capturesSubies: {},
    botsGagnesAuTotal: 0,
    botsNoirsDetruits: 0,
    capturesParBotNoirSubies: 0,
  };

  return { ...etat, joueurs: { ...etat.joueurs, [options.id]: joueur }, alea };
}

/** Fait sortir un joueur de la partie. Sans effet s'il n'y etait pas. */
export function retirerJoueur(etat: EtatPartie, id: IdentifiantEntite): EtatPartie {
  if (etat.joueurs[id] === undefined) {
    return etat;
  }

  const joueurs = { ...etat.joueurs };
  delete joueurs[id];

  return { ...etat, joueurs };
}

/** Ce qu'il faut pour poser un bot sur la carte. */
export interface OptionsAjoutBot {
  readonly id: IdentifiantEntite;
  /** Bot ordinaire par defaut. */
  readonly type?: 'bot' | 'botNoir';
  /** Position imposee. Sinon elle est tiree de la graine. */
  readonly position?: Position;
  /** Couleur imposee. Sinon le blanc des bots neutres, ou le noir des bots noirs. */
  readonly couleur?: Couleur;
}

/**
 * Pose un bot sur la carte, pret a errer.
 *
 * Portage des constructeurs de Bot (legacy/server.js:942) et de BlackBot (:1131).
 * Le bot nait en mouvement, avec un cap tire au sort et deux comptes a rebours
 * eux aussi tires au sort, exactement comme dans le legacy.
 *
 * Une difference: le cap est tire comme un ANGLE, ce qui donne toujours un
 * vecteur unitaire. Le legacy tirait separement deux composantes entre moins un
 * et un, dont la longueur variait: un bot fraichement pose avancait donc a une
 * vitesse aleatoire, parfois nulle. Voir le defaut X28 de l'audit.
 *
 * Comme pour un joueur, une position imposee n'est pas verifiee, et une position
 * tiree au sort evite les murs et les entites deja en place.
 */
export function ajouterBot(etat: EtatPartie, options: OptionsAjoutBot): EtatPartie {
  const type = options.type ?? 'bot';
  let alea = etat.alea;

  let position = options.position;
  if (position === undefined) {
    const tirage = positionDApparition(alea, etat.terrain, positionsOccupees(etat));
    position = tirage.valeur;
    alea = tirage.alea;
  }

  const capTire = reel(alea, 0, 2 * Math.PI);
  const dureeDeCap = reel(
    capTire.alea,
    BOTS.INTERVALLE_DE_CAP_MINIMUM_MS,
    BOTS.INTERVALLE_DE_CAP_MAXIMUM_MS,
  );
  const dureeDEtat = reel(dureeDeCap.alea, BOTS.DUREE_ETAT_MINIMUM_MS, BOTS.DUREE_ETAT_MAXIMUM_MS);

  const traits = {
    id: options.id,
    position,
    couleur: options.couleur ?? (type === 'botNoir' ? COULEUR_BOT_NOIR : COULEUR_BOT_NEUTRE),
    direction: 'immobile' as const,
    cap: { x: Math.cos(capTire.valeur), y: Math.sin(capTire.valeur) },
    enMouvement: true,
    avantChangementDEtatMs: dureeDEtat.valeur,
    avantChangementDeCapMs: dureeDeCap.valeur,
    avantControleDeBlocageMs:
      type === 'botNoir' ? BOTS.CONTROLE_DE_BLOCAGE_BOT_NOIR_MS : BOTS.CONTROLE_DE_BLOCAGE_MS,
    positionAuDernierControle: position,
    controlesSansAvancer: 0,
  };

  // Un bot noir cherche une proie des son premier battement et peut capturer
  // aussitot: dans le legacy, lastTargetSearch et lastCaptureTime valent zero.
  const bot: Bot =
    type === 'botNoir'
      ? {
          ...traits,
          type,
          cible: undefined,
          avantRechercheDeCibleMs: 0,
          avantProchaineCaptureMs: 0,
        }
      : { ...traits, type };

  return { ...etat, bots: { ...etat.bots, [options.id]: bot }, alea: dureeDEtat.alea };
}

/** Retire un bot de la carte. Sans effet s'il n'y etait pas. */
export function retirerBot(etat: EtatPartie, id: IdentifiantEntite): EtatPartie {
  if (etat.bots[id] === undefined) {
    return etat;
  }

  const bots = { ...etat.bots };
  delete bots[id];

  return { ...etat, bots };
}

/**
 * Retrouve une entite par son identifiant, qu'elle soit joueur ou bot.
 *
 * Renvoie undefined si l'entite n'existe pas ou plus: un bot noir detruit en
 * debut de battement peut encore figurer dans un contact releve avant sa
 * destruction.
 */
export function entiteDe(etat: EtatPartie, id: IdentifiantEntite): Joueur | Bot | undefined {
  return etat.joueurs[id] ?? etat.bots[id];
}

/** Toutes les entites de la partie, joueurs d'abord, dans leur ordre d'arrivee. */
export function toutesLesEntites(etat: EtatPartie): readonly (Joueur | Bot)[] {
  return [...Object.values(etat.joueurs), ...Object.values(etat.bots)];
}

/** Les couleurs deja portees par un joueur de la partie. */
export function couleursUtilisees(etat: EtatPartie): readonly Couleur[] {
  return Object.values(etat.joueurs).map((joueur) => joueur.couleur);
}

/**
 * Les places deja prises sur la carte, dont une nouvelle entite doit s'ecarter.
 *
 * Remplace le registre entitiesPositions du legacy, qui devait etre tenu a jour
 * a la main et ne l'etait jamais (defaut X4). Une position lue dans l'etat ne
 * peut pas etre oubliee.
 */
export function positionsOccupees(etat: EtatPartie): readonly Position[] {
  return toutesLesEntites(etat).map((entite) => entite.position);
}

/** Un joueur porte-t-il ce bonus en ce moment ? */
export function bonusActif(joueur: Joueur, nature: TypeBonus): boolean {
  return estActif(joueur.bonusRestantsMs, nature);
}

/** Un joueur subit-il ce malus en ce moment ? */
export function malusActif(joueur: Joueur, nature: TypeMalus): boolean {
  return estActif(joueur.malusRestantsMs, nature);
}

/**
 * Un joueur porte-t-il le bonus d'invincibilite ?
 *
 * A distinguer de estInvulnerable ci-dessous: l'invincibilite protege ET permet
 * de detruire les bots noirs, la protection d'apparition ne fait que proteger.
 */
export function estInvincible(joueur: Joueur): boolean {
  return bonusActif(joueur, 'invincibilite');
}

/**
 * Un joueur est-il a l'abri d'une capture ?
 *
 * Portage de Player.isInvulnerable (legacy/server.js:915): la protection donnee a
 * l'apparition, ou le bonus d'invincibilite. Le legacy testait souvent les deux
 * separement, alors que le second contient deja le premier; ici il n'y a qu'une
 * seule facon de poser la question.
 */
export function estInvulnerable(joueur: Joueur): boolean {
  return estInvincible(joueur) || joueur.protectionSpawnRestanteMs > 0;
}

/**
 * Un joueur a-t-il le droit de capturer maintenant ?
 *
 * Portage de Player.canCapture (legacy/server.js:936), a l'identique: le delai
 * doit etre depasse, pas seulement atteint.
 */
export function peutCapturer(joueur: Joueur): boolean {
  return joueur.tempsDepuisDerniereCaptureMs > DUREES.DELAI_ENTRE_CAPTURES_MS;
}
