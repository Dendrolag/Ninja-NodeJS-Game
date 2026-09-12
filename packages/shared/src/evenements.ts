/**
 * Les contrats d'evenements du reseau: qui a le droit de dire quoi, et avec quoi.
 *
 * Ce fichier est le seul endroit du projet ou l'on decrit ce qui circule entre le
 * serveur et le client. Les deux cotes l'importent, donc les deux cotes parlent
 * exactement la meme langue, et un message mal forme devient une erreur de
 * COMPILATION plutot qu'une panne a l'execution. C'est une prevention de
 * regression permanente: elle ne s'oublie pas, elle ne se contourne pas, et elle
 * ne coute rien a l'execution.
 *
 * CE QUE LE TYPAGE FAIT, ET CE QU'IL NE FAIT PAS. Il engage le code honnete: le
 * client de l'etape 4.1 ne peut pas emettre un evenement qui n'existe pas, ni
 * oublier un champ. Il n'engage evidemment PAS un client modifie, qui n'a jamais
 * compile quoi que ce soit et envoie ce qu'il veut. C'est pourquoi chaque
 * gestionnaire du serveur revalide sa charge utile avec les schemas de
 * validation.ts avant d'en faire quoi que ce soit. Les deux protections sont
 * exigees, et elles ne protegent pas de la meme chose: le type dit l'INTENTION du
 * contrat, le schema verifie le MESSAGE reellement recu.
 *
 * DEUX NATURES DE MESSAGES DESCENDANTS, ET C'EST LA DISTINCTION STRUCTURANTE.
 *
 *   1. Le FLUX D'ETAT: la partie, emise a chaque battement, soit vingt fois par
 *      seconde. Il decrit ce qui EST. Depuis l'etape 2.3, il voyage en trames
 *      binaires (flux.ts): une image complete, puis des deltas. La mesure de
 *      l'etape 5.1 l'avait justifie, a 21,5 Ko de JSON par message pour 150 bots,
 *      soit 3,4 Mbit/s par joueur (docs/mesures/charge-serveur.md). Ce qu'une
 *      trame decrit est un InstantanePartie, et n'est jamais melange au reste.
 *   2. Les NOTIFICATIONS DISCRETES: une capture vient d'avoir lieu, un bonus
 *      s'active, quelqu'un a parle. Elles decrivent ce qui VIENT D'ARRIVER, elles
 *      sont rares, et elles restent des messages d'evenement. Le client
 *      reconstruit l'etat a partir du flux, et pose les notifications par-dessus.
 *
 * CE QUE LE FLUX D'ETAT NE CONTIENT PAS, ET POURQUOI. L'etat du moteur porte le
 * terrain, le generateur a graine, et le detail interne de chaque entite. Rien de
 * tout cela ne part sur le reseau: le terrain est une donnee de configuration que
 * le client connait par la carte choisie, la graine permettrait de predire les
 * apparitions, et le detail interne ne sert qu'au moteur. L'instantane est une
 * PROJECTION, construite par packages/server, pas l'etat lui-meme.
 *
 * UN SEUL INSTANTANE POUR TOUTE LA PARTIE. Il est identique pour tous les membres
 * d'une salle, ce qui permet de le construire une fois et de le diffuser d'un
 * coup, et ce qui permet un seul delta binaire par partie (etape 2.3). Tout ce qui ne
 * concerne qu'un joueur (son bonus qui demarre, le malus qu'il subit) passe donc
 * par une notification qui lui est adressee, exactement comme dans le legacy.
 */

import type {
  Couleur,
  Direction,
  IdentifiantCarte,
  Mode,
  Orientation,
  TypeBonus,
  TypeMalus,
  TypeZone,
  Visibilite,
} from './constantes.js';
import type {
  DemandeChat,
  DemandeCreation,
  DemandeRejoindre,
  IntentionDeplacement,
  MessageChat,
} from './entrees.js';
import type { TrameDEtat } from './flux.js';
import type { IdentifiantPalier } from './progression.js';
import type { ReglagesPartie, ReglagesPartiels } from './reglages.js';
import type { ErreurValidation, ResultatValidation } from './validation.js';

// --------------------------------------------------------------------------
// Le flux d'etat: ce que les trames binaires de l'etape 2.3 decrivent
// --------------------------------------------------------------------------

/** Ou en est une partie: on attend dans le salon, on joue, c'est fini. */
export type StatutPartie = 'salon' | 'enCours' | 'terminee';

/** Ce que tout ce qui bouge montre de soi: une place, une couleur, un regard. */
interface EntiteVueCommune {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly couleur: Couleur;
  readonly direction: Direction;
}

/**
 * Un joueur, tel que tout le monde le voit.
 *
 * Les deux indicateurs sont PUBLICS parce qu'ils changent l'apparence de
 * l'entite et le resultat d'un contact: on doit voir qu'un joueur est
 * intouchable avant de lui foncer dessus. Tout le reste de ce que le moteur sait
 * d'un joueur (ses durees de bonus au millieme, ses compteurs de capture) ne
 * regarde personne d'autre et ne part pas.
 */
export interface JoueurVu extends EntiteVueCommune {
  readonly type: 'joueur';
  readonly pseudo: string;
  /** Le joueur est invincible: il detruit les bots noirs et ne se fait pas capturer. */
  readonly invincible: boolean;
  /** Le joueur vient d'apparaitre et beneficie encore de sa protection. */
  readonly protege: boolean;
  /** Ou il vise, et ce qu'il lui reste pour tirer. Absent hors du mode Tactique. */
  readonly tactique?: TactiqueVue;
}

/**
 * Ce que le mode Tactique montre d'un joueur (etape 7.1).
 *
 * PUBLIC, POUR LA RAISON QUI REND PUBLICS LES DEUX INDICATEURS: les charges d'un
 * joueur changent l'issue d'une rencontre, et l'on doit pouvoir voir qu'un adversaire
 * est desarme avant de s'en approcher. Le flux reste ainsi le meme pour toute la
 * salle, une seule trame par battement (etape 2.3).
 */
export interface TactiqueVue {
  /** La direction de son dernier deplacement: celle ou part son cone. */
  readonly orientation: Orientation;
  /** Charges disponibles. */
  readonly charges: number;
  /** Temps avant qu'une charge revienne, en millisecondes. Une attente entiere aux charges pleines. */
  readonly avantProchaineChargeMs: number;
}

/** Un bot ordinaire ou un bot noir, tel que tout le monde le voit. */
export interface BotVu extends EntiteVueCommune {
  readonly type: 'bot' | 'botNoir';
}

/** Tout ce qui se deplace sur la carte. */
export type EntiteVue = JoueurVu | BotVu;

/**
 * Un objet pose sur la carte, en attente d'etre ramasse.
 *
 * La duree de vie restante part, le CLIGNOTEMENT non: le legacy calculait cote
 * serveur une opacite et une echelle a partir de Date.now() et les envoyait
 * vingt fois par seconde (les champs isBlinking et blinkState de son
 * updateEntities). C'est de l'animation, donc du client, et il a tout ce qu'il
 * lui faut pour la calculer lui-meme a partir du temps restant.
 */
export interface ObjetVu {
  readonly id: string;
  readonly categorie: 'bonus' | 'malus';
  readonly nature: TypeBonus | TypeMalus;
  readonly x: number;
  readonly y: number;
  readonly dureeDeVieRestanteMs: number;
}

/** Une zone speciale active: un disque pose sur la carte. */
export interface ZoneVue {
  readonly id: string;
  readonly type: TypeZone;
  readonly x: number;
  readonly y: number;
  readonly rayon: number;
  readonly dureeRestanteMs: number;
}

/**
 * Une ligne du classement, telle qu'elle part sur le reseau.
 *
 * Ce n'est pas le type LigneScore du moteur, et c'est voulu. Le moteur en dit
 * plus (le detail de qui a capture qui, bot par bot), et surtout il n'a pas a
 * dicter la forme d'un message: le jour ou l'un des deux change, l'autre n'a pas
 * a bouger. La conversion se fait dans packages/server, en un seul endroit.
 */
export interface LigneClassement {
  readonly id: string;
  readonly pseudo: string;
  readonly couleur: Couleur;
  /** Le score affiche: les bots portes plus les points de bots noirs. */
  readonly points: number;
  /** Nombre de bots portant actuellement la couleur du joueur. */
  readonly botsPortes: number;
  /** Points acquis en detruisant des bots noirs. Ceux-la ne se perdent jamais. */
  readonly pointsBotsNoirs: number;
  /** Nombre de joueurs captures. Sert a departager deux scores egaux. */
  readonly captures: number;
  /** Nombre de bots noirs detruits. */
  readonly botsNoirsDetruits: number;
}

/**
 * L'etat de la partie a un battement donne, tel qu'il part sur le reseau.
 *
 * C'EST CE QUE DECRIVENT LES TRAMES BINAIRES DE L'ETAPE 2.3 (flux.ts). Elle est
 * volontairement plate et sans surprise: des nombres, des chaines courtes, aucune
 * table imbriquee profonde, et une seule valeur facultative, l'etat tactique d'un
 * joueur (etape 7.1). C'est ce qui a permis d'en deriver directement le format
 * binaire.
 */
export interface InstantanePartie {
  /** Numero du battement. Il croit de un a chaque instantane d'une meme partie. */
  readonly tick: number;
  /** Temps de jeu restant, en millisecondes. Jamais negatif. */
  readonly tempsRestantMs: number;
  /**
   * La partie est suspendue: rien ne bouge et le temps ne descend plus.
   *
   * La pause est un ETAT, elle a donc sa place dans le flux d'etat et pas
   * seulement dans les deux annonces. C'est ce qui permet a un joueur entrant
   * dans une partie deja suspendue de le savoir tout de suite, sans avoir eu a
   * assister a l'annonce.
   */
  readonly enPause: boolean;
  readonly entites: readonly EntiteVue[];
  readonly objets: readonly ObjetVu[];
  readonly zones: readonly ZoneVue[];
  /** Le classement, du meilleur au moins bon. */
  readonly classement: readonly LigneClassement[];
}

// --------------------------------------------------------------------------
// Le salon et la liste des parties
// --------------------------------------------------------------------------

/**
 * Un membre du salon, tel que les autres le voient.
 *
 * LE SALON DISTINGUE LES COMPTES DES INVITES (etape 3.2). Un compte y porte son
 * niveau; un invite n'a pas de champ compte. L'identifiant du compte en base ne
 * part pas: les autres joueurs n'en ont aucun usage.
 */
export interface JoueurDuSalon {
  readonly id: string;
  readonly pseudo: string;
  /** Ce joueur commande: il change les reglages et lance la partie. */
  readonly hote: boolean;
  /** Present pour un joueur connecte a son compte, absent pour un invite. */
  readonly compte?: CompteDuSalon;
}

/** Ce que le salon montre du compte d'un joueur. */
export interface CompteDuSalon {
  /** Le niveau du compte a son entree dans la partie. */
  readonly niveau: number;
}

/**
 * L'etat du salon d'une partie.
 *
 * Il remplace a lui seul les evenements updateWaitingRoom et gameSettingsUpdated
 * du legacy, qui partaient separement et pouvaient donc se contredire. Un seul
 * message decrit tout le salon, et il est reemis a chaque changement.
 *
 * Il ne part qu'aux membres de la partie. C'est ce qui permet d'y mettre le code
 * d'invitation d'une partie privee: ceux qui le recoivent sont ceux qui le
 * partagent.
 */
export interface InfosSalon {
  readonly idRoom: string;
  readonly statut: StatutPartie;
  /** Le mode de la partie, choisi a la creation. */
  readonly mode: Mode;
  /** Publique ou privee, choisi a la creation. */
  readonly visibilite: Visibilite;
  /** Le code d'invitation, pour une partie privee seulement. */
  readonly code?: string;
  /** Combien de joueurs la partie accepte au plus. Une propriete du mode. */
  readonly capacite: number;
  /** Les membres, dans leur ordre d'arrivee. */
  readonly joueurs: readonly JoueurDuSalon[];
  /** Les reglages complets de la partie, valeurs par defaut comprises. */
  readonly reglages: ReglagesPartie;
}

/**
 * Une partie publique ouverte, telle que la liste des parties la montre.
 *
 * Seulement de quoi choisir: ni code, ni detail des joueurs. Ni latence non
 * plus, ni statut « en jeu »: toutes les parties tournent sur le meme serveur,
 * et seules les parties qui attendent dans leur salon sont listees (cadrage de
 * l'etape 0.3, tension 6).
 */
export interface PartiePublique {
  readonly idRoom: string;
  /** Pseudo de l'hote. */
  readonly hote: string;
  readonly mode: Mode;
  readonly carte: IdentifiantCarte;
  readonly modeMiroir: boolean;
  /** Nombre de joueurs presents. */
  readonly joueurs: number;
  /** Nombre de joueurs accueillis au plus. */
  readonly capacite: number;
}

// --------------------------------------------------------------------------
// Les notifications discretes
// --------------------------------------------------------------------------

/** Un joueur vient de se faire capturer. Adresse a la victime. */
export interface CaptureSubie {
  /** Pseudo de celui qui l'a capture. */
  readonly parPseudo: string;
  /** Couleur tiree pour la victime a sa reapparition. */
  readonly nouvelleCouleur: Couleur;
  /** Nombre de bots qui viennent de changer de camp. */
  readonly botsPerdus: number;
}

/** Un joueur vient d'en capturer un autre. Adresse a l'attaquant. */
export interface CaptureReussie {
  readonly victimePseudo: string;
  readonly botsGagnes: number;
  /** Nombre total de joueurs captures depuis le debut de la partie. */
  readonly capturesTotal: number;
}

/** Un bot noir vient de capturer un joueur. Adresse a la victime. */
export interface CaptureParBotNoirSubie {
  /** Nombre de bots de la victime redevenus neutres. */
  readonly botsPerdus: number;
}

/** Un joueur invincible vient de detruire un bot noir. Adresse a ce joueur. */
export interface BotNoirDetruit {
  readonly points: number;
  readonly x: number;
  readonly y: number;
}

/** Un joueur vient de ramasser un bonus. Adresse a lui seul. */
export interface BonusActive {
  readonly nature: TypeBonus;
  /** Duree ajoutee par ce ramassage, en millisecondes. Les durees se cumulent. */
  readonly dureeMs: number;
}

/** Un joueur vient de ramasser un malus. Adresse a lui seul: il en est epargne. */
export interface MalusRamasseParMoi {
  readonly nature: TypeMalus;
  readonly dureeMs: number;
}

/**
 * Un malus frappe ce joueur parce qu'un AUTRE l'a ramasse.
 *
 * C'est le comportement a preserver numero 4 de CLAUDE.md: un malus frappe les
 * autres, jamais celui qui le ramasse. Les deux notifications sont donc
 * distinctes, et le serveur ne les envoie jamais a la meme personne.
 */
export interface MalusSubi {
  readonly nature: TypeMalus;
  readonly dureeMs: number;
  /** Pseudo de celui qui l'a ramasse. */
  readonly parPseudo: string;
}

/**
 * Un joueur vient de tirer, dans le mode Tactique (etape 7.1). Adresse a chaque joueur
 * de la partie: tout le monde voit partir un tir, qu'il capture ou non.
 *
 * Ses effets arrivent par ailleurs: les bots repeints et les charges par le flux
 * d'etat, la capture d'un joueur par captureSubie et captureReussie.
 */
export interface TirDeCaptureVu {
  /** Identifiant du joueur qui a tire. */
  readonly tireur: string;
  /** D'ou le tir est parti. */
  readonly x: number;
  readonly y: number;
  /** Dans quelle direction. */
  readonly orientation: Orientation;
  /** Nombre d'entites capturees, joueurs et bots confondus. Zero pour un tir sans effet. */
  readonly captures: number;
}

/**
 * La partie vient d'etre suspendue.
 *
 * Elle dit QUI l'a suspendue, pour que le bandeau puisse le nommer. Ce n'est pas
 * une information dont le client a besoin pour agir: seul l'hote peut reprendre,
 * et il le sait deja.
 */
export interface PartieEnPause {
  /** Pseudo de celui qui a demande la pause. */
  readonly parPseudo: string;
}

/**
 * La partie est finie. Le classement est definitif.
 *
 * C'est tout ce qu'un invite apprend de la fin: son classement. Un compte recoit en
 * plus, par progressionDeFin, ce que la partie lui a rapporte (etape 3.3).
 */
export interface FinDePartie {
  readonly classement: readonly LigneClassement[];
}

/**
 * La progression d'un compte a un instant: avant ou apres une partie.
 *
 * Le niveau et le palier se deduisent de l'XP et des points de ligue, par les
 * fonctions de progression.ts. Ils partent quand meme: l'ecran de fin n'a pas a
 * refaire le calcul, et il ne peut pas y avoir deux verites, puisque le serveur
 * appelle les memes fonctions que le client appellerait.
 */
export interface EtatDeProgression {
  readonly xpTotale: number;
  readonly niveau: number;
  readonly pieces: number;
  readonly pointsLigue: number;
  readonly palier: IdentifiantPalier;
}

/**
 * Ce qu'une partie a rapporte a un compte, une fois enregistre.
 *
 * TOUT CE QUI EST ICI A ETE REELLEMENT APPLIQUE, pas seulement calcule. Les gains
 * sont la difference entre la progression d'apres et celle d'avant, telles que la
 * base les a rendues dans la transaction qui les a ecrites. Une perte de points de
 * ligue reduite pour ne pas descendre sous zero apparait donc reduite.
 */
export interface ProgressionEnregistree {
  readonly enregistree: true;
  /** 1 pour le premier. */
  readonly placement: number;
  /** Tous les joueurs de la partie, invites et abandons compris. */
  readonly nombreJoueurs: number;
  readonly xpGagnee: number;
  readonly piecesGagnees: number;
  /** Signee. */
  readonly variationPointsLigue: number;
  readonly avant: EtatDeProgression;
  readonly apres: EtatDeProgression;
}

/**
 * La partie n'a pas pu etre enregistree pour ce compte.
 *
 * Elle se dit, plutot que de laisser l'ecran de fin attendre des gains qui ne
 * viendront pas: un joueur qui a un compte doit savoir que cette partie ne compte
 * pas.
 */
export interface ProgressionNonEnregistree {
  readonly enregistree: false;
  readonly motif: string;
}

/** Le recapitulatif de progression d'un compte a la fin d'une partie. */
export type ProgressionDeFin = ProgressionEnregistree | ProgressionNonEnregistree;

/** Ou en est le compte a rebours de demarrage. */
export interface EtatCompteARebours {
  /** Secondes restantes avant le lancement. Zero signifie « on part ». */
  readonly secondesRestantes: number;
  /** L'hote peut-il encore annuler. Faux des qu'il reste deux secondes. */
  readonly annulable: boolean;
}

/**
 * Une demande refusee, renvoyee au seul joueur qui l'a faite.
 *
 * Le legacy avait un evenement error qui transportait une chaine libre. Ici le
 * refus dit AUSSI a quoi il repond, sans quoi un client qui envoie plusieurs
 * demandes de suite ne sait pas laquelle a echoue.
 */
export interface Refus {
  /** Nom de l'evenement refuse, par exemple 'reglages'. */
  readonly action: keyof EvenementsClientVersServeur;
  readonly erreurs: readonly ErreurValidation[];
}

// --------------------------------------------------------------------------
// Les deux contrats
// --------------------------------------------------------------------------

/**
 * Ce qu'un client a le droit d'envoyer au serveur.
 *
 * LA REGLE QUI GOUVERNE CETTE LISTE, heritee de l'etape 1.6: un message de joueur
 * ne contient que son INTENTION, jamais son ETAT. On n'y trouvera donc jamais
 * « mon bonus vient d'expirer », « je suis sur mobile » ou « je m'appelle
 * Alice »: le premier est su par le moteur, le deuxieme ne donne plus aucun
 * avantage, et le troisieme est fixe par la session a l'entree en partie.
 *
 * Trois demandes portent un accuse de reception, parce que ce sont les seules
 * dont le joueur ne peut pas deviner le resultat en regardant l'ecran: entrer
 * dans une partie, en creer une, et lister les parties publiques. Tous les autres
 * refus arrivent par l'evenement refus.
 */
export interface EvenementsClientVersServeur {
  /**
   * Entrer dans une partie existante: par son code, par son identifiant dans la
   * liste publique, ou sans rien pour la partie rapide. Remplace joinWaitingRoom,
   * rejoinWaitingRoom et joinRunningGame du legacy, qui faisaient tous les trois
   * la meme chose.
   */
  rejoindre: (
    demande: DemandeRejoindre,
    accuse: (reponse: ResultatValidation<InfosSalon>) => void,
  ) => void;

  /**
   * Creer une partie et en devenir l'hote. Le legacy n'avait qu'un salon, qu'on
   * ne creait pas: il existait.
   */
  creerPartie: (
    demande: DemandeCreation,
    accuse: (reponse: ResultatValidation<InfosSalon>) => void,
  ) => void;

  /**
   * Lister les parties publiques qui attendent dans leur salon et ne sont pas
   * pleines. Sans equivalent dans le legacy.
   */
  listerParties: (accuse: (parties: readonly PartiePublique[]) => void) => void;

  /** Sortir de la partie sans se deconnecter. Remplace leaveWaitingRoom. */
  quitter: () => void;

  /**
   * Dire ou l'on veut aller. Remplace move.
   *
   * A fort debit: c'est le seul evenement montant emis en continu. Le serveur
   * n'en garde que le dernier avant chaque battement, si bien qu'en envoyer dix
   * fois plus n'avance pas dix fois plus vite (faille S2 du legacy).
   */
  deplacer: (intention: IntentionDeplacement) => void;

  /**
   * Tirer, dans le mode Tactique (etape 7.1). Remplace startCapture et endCapture de la
   * version 0.9.0 du jeu d'origine.
   *
   * Le message ne porte rien: qui tire, la session le dit; d'ou et vers ou, le moteur
   * le sait. Le tir part au battement suivant, et plusieurs demandes du meme battement
   * n'en font qu'une. Sans effet hors d'une partie Tactique en cours.
   */
  capturer: () => void;

  /** Parler dans le chat. Remplace chatMessage. */
  chat: (demande: DemandeChat) => void;

  /**
   * Changer les reglages de la partie. Reserve a l'hote, et au salon seulement.
   * Remplace updateGameSettings et updateMapSettings, qui se marchaient dessus.
   */
  reglages: (reglages: ReglagesPartiels) => void;

  /** Lancer le compte a rebours de demarrage. Reserve a l'hote. Remplace startGameFromRoom. */
  demarrer: () => void;

  /** Annuler le compte a rebours tant qu'il est annulable. Reserve a l'hote. */
  annulerDemarrage: () => void;

  /**
   * Suspendre la partie. Reserve a l'hote. Remplace la moitie de togglePause.
   *
   * DEUX EVENEMENTS EXPLICITES PLUTOT QU'UNE BASCULE, contrairement au legacy.
   * Une bascule n'est pas idempotente: un message reemis, ou deux clics trop
   * rapproches, laissent la partie dans l'etat inverse de celui que le joueur
   * voit sur son ecran. Demander ce que l'on veut plutot que le contraire de ce
   * qui est evite entierement la question, et c'est deja la forme retenue pour
   * demarrer et annulerDemarrage.
   */
  mettreEnPause: () => void;

  /** Reprendre la partie. Reserve a l'hote. Remplace l'autre moitie de togglePause. */
  reprendre: () => void;
}

/**
 * Ce que le serveur a le droit d'envoyer a un client.
 *
 * Toutes ces emissions sont CANTONNEES A UNE PARTIE: le serveur diffuse a la
 * salle Socket.IO de la room, jamais a tout le monde. Le legacy faisait
 * l'inverse, io.emit partout, ce qui n'etait pas grave tant qu'il ne pouvait
 * exister qu'une partie, et qui le deviendrait immediatement maintenant qu'il
 * peut en exister plusieurs.
 */
export interface EvenementsServeurVersClient {
  /**
   * Le flux d'etat, emis a chaque battement. Remplace updateEntities.
   *
   * C'est le seul evenement a fort debit. Depuis l'etape 2.3, il porte une trame
   * binaire, image complete ou delta, a relire par appliquerTrame (flux.ts).
   */
  etat: (trame: TrameDEtat) => void;

  /** L'etat du salon a change. Remplace updateWaitingRoom et gameSettingsUpdated. */
  salon: (infos: InfosSalon) => void;

  /** Quelqu'un vient d'entrer. Remplace playerJoined. */
  joueurArrive: (joueur: JoueurDuSalon) => void;

  /** Quelqu'un vient de partir. Remplace playerLeft. */
  joueurParti: (joueur: JoueurDuSalon) => void;

  /** Quelqu'un a parle. Remplace newChatMessage. */
  chat: (message: MessageChat) => void;

  /** Le compte a rebours avance. Remplace gameStartCountdown. */
  compteARebours: (etat: EtatCompteARebours) => void;

  /** Le compte a rebours a ete annule. Remplace gameStartCancelled. */
  demarrageAnnule: () => void;

  /**
   * La partie vient d'etre suspendue. Remplace pauseGame.
   *
   * L'indicateur enPause de l'instantane dit la meme chose, et les deux ne font
   * pas double emploi: celui-ci est l'ANNONCE, qui declenche le bandeau et le
   * son au moment ou cela arrive; l'autre est l'ETAT, qui renseigne aussi celui
   * qui entre dans une partie deja suspendue.
   */
  partieEnPause: (pause: PartieEnPause) => void;

  /** La partie repart. Remplace resumeGame. */
  partieReprise: () => void;

  /** La partie commence. Remplace gameStarting. */
  partieLancee: () => void;

  /** La partie est finie. Remplace gameOver. */
  partieTerminee: (fin: FinDePartie) => void;

  /**
   * Ce que la partie a rapporte a ce compte. Adresse a chaque compte present a la
   * fin, jamais a un invite. Sans equivalent dans le legacy.
   *
   * Il SUIT partieTerminee, sans l'accompagner: l'enregistrement interroge la base,
   * et le classement de tous ne doit pas attendre la base. Un compte qui a quitte la
   * partie avant la fin ne le recoit pas: son abandon est enregistre, mais il n'a
   * plus d'ecran de fin a remplir.
   */
  progressionDeFin: (progression: ProgressionDeFin) => void;

  /** Ce joueur vient de se faire capturer. Remplace playerCaptured. */
  captureSubie: (capture: CaptureSubie) => void;

  /** Ce joueur vient d'en capturer un autre. Remplace playerCapturedEnemy. */
  captureReussie: (capture: CaptureReussie) => void;

  /** Un bot noir vient de capturer ce joueur. Remplace capturedByBlackBot. */
  captureParBotNoir: (capture: CaptureParBotNoirSubie) => void;

  /** Ce joueur vient de detruire un bot noir. */
  botNoirDetruit: (destruction: BotNoirDetruit) => void;

  /** Ce joueur vient de ramasser un bonus. Remplace activateBonus. */
  bonusActive: (bonus: BonusActive) => void;

  /** Ce joueur vient de ramasser un malus. Remplace malusCollected. */
  malusRamasse: (malus: MalusRamasseParMoi) => void;

  /** Ce joueur subit le malus ramasse par un autre. Remplace applyMalus. */
  malusSubi: (malus: MalusSubi) => void;

  /**
   * Un joueur de la partie vient de tirer, dans le mode Tactique (etape 7.1). Remplace
   * captureAttemptUsed et captureAnimation de la version 0.9.0, qui ne prevenaient que
   * le tireur, ou tout le serveur.
   */
  tirDeCapture: (tir: TirDeCaptureVu) => void;

  /** Une demande de ce joueur a ete refusee. Remplace error. */
  refus: (refus: Refus) => void;
}

/**
 * CE QUE LE LEGACY EMETTAIT ET QUI N'EST PAS PORTE, avec la raison de chaque
 * absence. Cette liste fait partie du contrat: elle evite qu'une etape ulterieure
 * les reintroduise par habitude.
 *
 *   - bonusExpired (montant) et bonusDeactivated (descendant). Le legacy tenait la
 *     duree des bonus a deux endroits, chez lui et chez le client, et devait donc
 *     les resynchroniser. Ici le moteur seul detient les durees et les fait
 *     decroitre; le client apprend la duree au ramassage et l'affiche. Un client
 *     qui annonce « mon bonus a expire » annoncerait son ETAT, ce que la regle de
 *     l'etape 1.6 interdit.
 *   - clearMalusEffects. Le legacy le diffusait a la fin d'une partie pour effacer
 *     les effets visuels restes affiches. partieTerminee suffit: le client efface
 *     ce qu'il affiche quand la partie s'arrete.
 *   - requestGameSettings. Le serveur envoie le salon a l'entree et a chaque
 *     changement; le client n'a rien a reclamer.
 *   - resetAndReturnToWaitingRoom et resetAndStartGame. Le retour au salon apres
 *     une partie n'existe pas encore: une room terminee se detruit quand elle se
 *     vide. Voir le handoff de l'etape 2.1.
 *   - playerSound, updateAudioSettings, audioSettingsUpdated. Le son est un
 *     reglage local du client: le faire transiter par le serveur n'apportait rien.
 *   - playerStatusUpdate, gameInProgress. Remplaces par le champ statut de
 *     InfosSalon.
 *   - startCapture et endCapture, de la v0.9.0 (ils n'existent pas dans la base de
 *     reference). Le mode Tactique de l'etape 7.1 les remplace par une seule demande,
 *     capturer: la v0.9.0 jouait deja le tir entier a startCapture, et endCapture ne
 *     faisait qu'eteindre un indicateur. De meme, captureAttemptRecharged et
 *     showCaptureIndicator ne sont pas portes: les charges voyagent dans le flux
 *     d'etat.
 *   - Un etat « pret » des joueurs du salon, que la maquette propose. Ni le legacy
 *     ni le cadrage de l'etape 0.3 ne le retiennent: l'hote lance, et le compte a
 *     rebours annulable sert de preavis.
 */
