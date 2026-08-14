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
 *   1. Le FLUX D'ETAT: un instantane complet de la partie, emis a chaque
 *      battement, soit vingt fois par seconde. Il decrit ce qui EST. C'est lui,
 *      et lui seul, que l'etape 2.3 remplacera par un delta binaire si la mesure
 *      de l'etape 5.1 le justifie. Il est donc isole dans un seul type,
 *      InstantanePartie, et n'est jamais melange au reste.
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
 * coup, et ce qui rendra le delta binaire de l'etape 2.3 possible. Tout ce qui ne
 * concerne qu'un joueur (son bonus qui demarre, le malus qu'il subit) passe donc
 * par une notification qui lui est adressee, exactement comme dans le legacy.
 */

import type { Couleur, Direction, TypeBonus, TypeMalus, TypeZone } from './constantes.js';
import type {
  DemandeChat,
  DemandeRejoindre,
  IntentionDeplacement,
  MessageChat,
} from './entrees.js';
import type { ReglagesPartie, ReglagesPartiels } from './reglages.js';
import type { ErreurValidation, ResultatValidation } from './validation.js';

// --------------------------------------------------------------------------
// Le flux d'etat: ce que l'etape 2.3 convertira en binaire
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
 * C'EST LA CHARGE UTILE QUE L'ETAPE 2.3 CONVERTIRA EN DELTA BINAIRE. Elle est
 * volontairement plate et sans surprise: des nombres, des chaines courtes, aucune
 * table imbriquee profonde, aucune valeur absente. Un format binaire se derive
 * directement d'une forme pareille.
 */
export interface InstantanePartie {
  /** Numero du battement. Il croit de un a chaque instantane d'une meme partie. */
  readonly tick: number;
  /** Temps de jeu restant, en millisecondes. Jamais negatif. */
  readonly tempsRestantMs: number;
  readonly entites: readonly EntiteVue[];
  readonly objets: readonly ObjetVu[];
  readonly zones: readonly ZoneVue[];
  /** Le classement, du meilleur au moins bon. */
  readonly classement: readonly LigneClassement[];
}

// --------------------------------------------------------------------------
// Le salon
// --------------------------------------------------------------------------

/** Un membre du salon, tel que les autres le voient. */
export interface JoueurDuSalon {
  readonly id: string;
  readonly pseudo: string;
  /** Ce joueur commande: il change les reglages et lance la partie. */
  readonly hote: boolean;
}

/**
 * L'etat du salon d'une partie.
 *
 * Il remplace a lui seul les evenements updateWaitingRoom et gameSettingsUpdated
 * du legacy, qui partaient separement et pouvaient donc se contredire. Un seul
 * message decrit tout le salon, et il est reemis a chaque changement.
 */
export interface InfosSalon {
  readonly idRoom: string;
  readonly statut: StatutPartie;
  /** Les membres, dans leur ordre d'arrivee. */
  readonly joueurs: readonly JoueurDuSalon[];
  /** Les reglages complets de la partie, valeurs par defaut comprises. */
  readonly reglages: ReglagesPartie;
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

/** La partie est finie. Le classement est definitif. */
export interface FinDePartie {
  readonly classement: readonly LigneClassement[];
}

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
 * Seule la demande d'entree porte un accuse de reception, parce que c'est la
 * seule dont le joueur ne peut pas deviner le resultat en regardant l'ecran: il
 * doit savoir s'il est entre, et sinon pourquoi. Tous les autres refus arrivent
 * par l'evenement refus.
 */
export interface EvenementsClientVersServeur {
  /**
   * Entrer dans une partie. Remplace joinWaitingRoom, rejoinWaitingRoom et
   * joinRunningGame du legacy, qui faisaient tous les trois la meme chose.
   */
  rejoindre: (
    demande: DemandeRejoindre,
    accuse: (reponse: ResultatValidation<InfosSalon>) => void,
  ) => void;

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
   * C'est le seul evenement a fort debit, et le seul que l'etape 2.3 touchera.
   */
  etat: (instantane: InstantanePartie) => void;

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

  /** La partie commence. Remplace gameStarting. */
  partieLancee: () => void;

  /** La partie est finie. Remplace gameOver. */
  partieTerminee: (fin: FinDePartie) => void;

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
 *   - togglePause, pauseGame, resumeGame. La pause est un etat de la PARTIE, donc
 *     du moteur, et le moteur ne la connait pas: elle n'a ete portee par aucune
 *     etape de la phase 1. La brancher ici reviendrait a mettre de la logique de
 *     jeu dans la couche reseau, ce que la fiche de l'etape 2.2 interdit
 *     explicitement. C'est un manque reel du portage, consigne comme tel.
 *   - playerSound, updateAudioSettings, audioSettingsUpdated. Le son est un
 *     reglage local du client: le faire transiter par le serveur n'apportait rien.
 *   - playerStatusUpdate, gameInProgress. Remplaces par le champ statut de
 *     InfosSalon.
 *   - startCapture et endCapture. Ils n'existent pas dans la base de reference
 *     (master v0.8.6): ils appartiennent a la capture par cone du mode tactique de
 *     la v0.9.0, ecartee du perimetre v1. Voir la section 5 de ROADMAP.md.
 */
