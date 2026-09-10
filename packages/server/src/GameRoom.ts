/**
 * Une partie et son salon: la GameRoom.
 *
 * C'est l'enveloppe du moteur pur. Le moteur de @neon-ninja/sim est une fonction
 * qui prend un etat et rend un etat; il ne se souvient de rien, ne connait ni
 * horloge ni joueur connecte. La room, elle, se souvient: elle detient l'etat
 * courant, sait qui est la, qui commande, ou en est la partie, et fait battre le
 * moteur au rythme d'une horloge.
 *
 * CE QUE CETTE CLASSE REPARE. Le legacy tenait une seule partie, dans des
 * variables de module: `players`, `bots`, `currentGameSettings`, `waitingRoom`,
 * `gameStartTime`. Rien n'etait encapsule, donc rien n'etait duplicable, donc il
 * ne pouvait exister qu'une partie a la fois sur le serveur. Ici tout l'etat
 * d'une partie tient dans une instance. Deux instances ne se connaissent pas,
 * n'ont ni la meme graine ni le meme etat, et ne peuvent pas s'ecraser
 * mutuellement. C'est la regle 5 de CLAUDE.md rendue structurelle.
 *
 * TROIS SEPARATIONS A GARDER EN TETE.
 *
 *   1. La room ne valide pas les entrees. Les schemas de @neon-ninja/shared
 *      s'appliquent a la frontiere reseau (etape 2.2), avant d'arriver ici: ce
 *      que la room recoit est deja type. Le moteur, lui, garde sa propre
 *      derniere barriere, parce qu'il ne connait pas ses appelants.
 *   2. La room ne parle a personne. Elle ne diffuse rien, n'emet aucun message.
 *      Elle constate, elle range, elle avance. Prevenir les clients est le
 *      travail de l'etape 2.2, qui lira l'etat et le journal d'evenements.
 *   3. La room ne lit pas l'heure elle-meme: son horloge lui est fournie. Voir
 *      horloge.ts.
 *
 * DEUX FACONS DE REFUSER, ET ELLES NE SE MELANGENT PAS.
 *
 *   - Ce qu'un JOUEUR peut legitimement demander et qui peut lui etre refuse
 *     rend un verdict a expliquer: accueillir rend un ResultatValidation. Un
 *     pseudo deja pris n'est pas une panne, c'est une reponse.
 *   - Ce qui ne peut venir que d'une FAUTE DU CODE SERVEUR leve une erreur:
 *     lancer une partie deja lancee, faire avancer une partie qui n'a pas
 *     commence. L'etape 2.2 verifie le statut et la qualite d'hote avant
 *     d'appeler ces methodes-la.
 */

import type {
  ReglagesPartie,
  ReglagesPartiels,
  ResultatValidation,
  SessionJoueur,
  StatutPartie,
} from '@neon-ninja/shared';
import { normaliserTexte } from '@neon-ninja/shared';
import type {
  CarteCollisions,
  EntreeJoueur,
  EtatPartie,
  IdentifiantEntite,
  LigneScore,
  OptionsEtatInitial,
} from '@neon-ninja/sim';
import {
  ajouterJoueur,
  calculerScores,
  creerEtatInitial,
  evaluerFinDePartie,
  mettreEnPause,
  peuplerDeBots,
  reprendre,
  retirerJoueur,
  tick,
} from '@neon-ninja/sim';

import type { Horloge } from './horloge.js';
import { horlogeSysteme } from './horloge.js';

/**
 * Cadence de la boucle d'une partie, en millisecondes.
 *
 * C'est celle du legacy, dont la boucle serveur tournait toutes les cinquante
 * millisecondes. Elle n'a plus la meme portee: le moteur avancant
 * proportionnellement au temps ecoule, changer cette valeur change la finesse du
 * jeu, pas sa vitesse. Vingt battements par seconde restent un bon compromis
 * entre precision des collisions et charge du serveur.
 */
export const CADENCE_BATTEMENT_MS = 50;

/**
 * Plus grand ecart de temps qu'un battement accepte, en millisecondes.
 *
 * Un serveur peut se figer: ramasse-miettes long, machine surchargee, processus
 * suspendu. Sans borne, la boucle rattraperait son retard d'un seul coup et
 * teleporterait tout le monde a l'autre bout de la carte. Avec cette borne, une
 * partie ralentie prend simplement un peu de retard sur l'heure du mur: personne
 * ne traverse un mur, et la duree de jeu reste celle qui a ete jouee.
 *
 * Ce n'est pas une regle de jeu, c'est une protection du serveur. Elle ne
 * s'applique qu'a la boucle: avancer() reste fidele au dt qu'on lui donne.
 */
export const DT_MAXIMUM_MS = 250;

/**
 * Ou en est une room: on attend, on joue, c'est fini.
 *
 * C'est le meme type que celui du contrat reseau, ou il se nomme StatutPartie.
 * Une seule definition, dans @neon-ninja/shared: le statut qu'une room porte est
 * exactement celui qu'un client recoit, et il ne peut pas y avoir de traduction
 * a tenir a jour entre les deux.
 */
export type StatutRoom = StatutPartie;

/** Ce que la room sait d'un joueur en tant que membre du salon. */
export interface JoueurDeRoom {
  readonly id: IdentifiantEntite;
  readonly pseudo: string;
  /** Ce joueur commande-t-il la room: reglages et lancement de la partie. */
  readonly hote: boolean;
}

/** Ce qu'il faut pour ouvrir une room. */
export interface OptionsGameRoom {
  /** Identifiant de la room, attribue par le RoomManager. */
  readonly id: string;
  /** Graine de la partie. Deux rooms de meme graine et memes entrees sont identiques. */
  readonly graine: number;
  /** Reglages choisis par l'hote. Ceux qui manquent prennent la valeur par defaut. */
  readonly reglages?: ReglagesPartiels;
  /**
   * Terrain de la partie, decode hors du moteur depuis l'image de collision de
   * la carte. Sans terrain, la partie se joue sur une carte sans mur.
   */
  readonly terrain?: CarteCollisions;
  /** Horloge de la boucle. Celle du systeme par defaut. */
  readonly horloge?: Horloge;
  /** Cadence de la boucle, en millisecondes. */
  readonly cadenceMs?: number;
  /**
   * Appele apres chaque battement, une fois l'etat avance.
   *
   * C'est le seul lien de la room vers le monde exterieur, et il va dans le bon
   * sens: la room ne connait toujours personne, c'est l'exterieur qui demande a
   * etre prevenu. La couche Socket.IO de l'etape 2.2 s'en sert pour diffuser
   * l'instantane et les evenements du battement. Le journal etat.evenements
   * etant remis a zero au battement suivant, c'est le seul moment ou il peut
   * etre lu sans en perdre.
   */
  readonly surBattement?: (room: GameRoom) => void;
  /** Appele une fois, au battement ou la partie se termine. */
  readonly surFinDePartie?: (room: GameRoom) => void;
}

/** Une partie en cours ou en attente, avec son salon et sa boucle. */
export class GameRoom {
  /** Identifiant de la room. Ne change jamais. */
  readonly id: string;

  /** Graine de la partie, conservee pour pouvoir la rejouer a l'identique. */
  readonly graine: number;

  private readonly horloge: Horloge;
  private readonly cadenceMs: number;
  private readonly surBattement: ((room: GameRoom) => void) | undefined;
  private readonly surFinDePartie: ((room: GameRoom) => void) | undefined;

  /** Terrain de la partie, conserve pour pouvoir refaire l'etat si les reglages changent. */
  private terrain: CarteCollisions | undefined;

  /** L'etat de la partie, tel que le dernier battement l'a laisse. */
  private partie: EtatPartie;

  private statutCourant: StatutRoom = 'salon';

  /**
   * Ordre d'arrivee des joueurs.
   *
   * Cette liste n'est pas une seconde version de la liste des joueurs: l'etat de
   * la partie dit QUI joue, celle-ci dit DANS QUEL ORDRE ils sont arrives. Le
   * moteur range ses joueurs dans une table indexee par identifiant, et l'ordre
   * des cles d'une table JavaScript n'est pas l'ordre d'insertion des lors
   * qu'une cle ressemble a un entier. Or les identifiants viennent des
   * connexions: la room ne les choisit pas. Sans cette liste, la succession de
   * l'hote dependrait de la forme des identifiants, ce qui est exactement le
   * genre de dependance invisible que cette reecriture cherche a supprimer.
   */
  private ordreDArrivee: IdentifiantEntite[] = [];

  private hoteCourant: IdentifiantEntite | undefined;

  /**
   * La derniere intention connue de chaque joueur.
   *
   * UN JOUEUR, UNE INTENTION, UN BATTEMENT. Le legacy deplacait le joueur a
   * chaque message recu: sa vitesse valait son debit (faille S2 de l'audit).
   * Ici un message ne fait que remplacer une case de cette table, et c'est le
   * battement qui deplace. Recevoir dix messages entre deux battements ne change
   * donc rien a la distance parcourue.
   *
   * L'intention n'est pas effacee apres le battement: un joueur qui maintient sa
   * touche n'envoie pas forcement un message par battement, et il doit continuer
   * a avancer. C'est le message annoncant l'arret qui l'arrete.
   */
  private intentions: Record<IdentifiantEntite, EntreeJoueur> = {};

  /** De quoi arreter la boucle, quand elle tourne. */
  private arreterLaBoucle: (() => void) | undefined;

  constructor(options: OptionsGameRoom) {
    this.id = options.id;
    this.graine = options.graine;
    this.horloge = options.horloge ?? horlogeSysteme;
    this.cadenceMs = options.cadenceMs ?? CADENCE_BATTEMENT_MS;
    this.surBattement = options.surBattement;
    this.surFinDePartie = options.surFinDePartie;
    this.terrain = options.terrain;

    this.partie = this.etatNeuf(options.reglages);
  }

  /** Ou en est la room. */
  get statut(): StatutRoom {
    return this.statutCourant;
  }

  /** L'etat de la partie. Une donnee a lire, jamais a modifier. */
  get etat(): EtatPartie {
    return this.partie;
  }

  /** Les reglages de la partie, completes par les valeurs par defaut. */
  get reglages(): ReglagesPartie {
    return this.partie.reglages;
  }

  /** Qui commande la room. Personne quand elle est vide. */
  get hote(): IdentifiantEntite | undefined {
    return this.hoteCourant;
  }

  /** Les membres de la room, dans leur ordre d'arrivee. */
  get joueurs(): readonly JoueurDeRoom[] {
    return this.ordreDArrivee.map((id) => ({
      id,
      pseudo: this.partie.joueurs[id]?.pseudo ?? '',
      hote: id === this.hoteCourant,
    }));
  }

  /** La room n'a plus personne: le RoomManager la detruira. */
  get estVide(): boolean {
    return this.ordreDArrivee.length === 0;
  }

  /** La boucle de battement tourne-t-elle. */
  get enMarche(): boolean {
    return this.arreterLaBoucle !== undefined;
  }

  /**
   * La partie est-elle suspendue.
   *
   * A ne pas confondre avec enMarche, qui dit si la BOUCLE tourne. Une partie
   * suspendue bat toujours: son temps de jeu, lui, ne s'ecoule plus.
   */
  get enPause(): boolean {
    return this.partie.enPause;
  }

  /**
   * Fait entrer un joueur dans la room.
   *
   * L'identite vient de la session, etablie a la connexion, et de nulle part
   * ailleurs: la room ne lit aucun nom fourni dans un message. Le premier arrive
   * devient l'hote, comme dans le legacy (server.js:2042).
   *
   * Rejoindre une partie deja commencee est autorise: le legacy le permettait
   * lui aussi, et le joueur apparait alors sur la carte avec sa protection de
   * trois secondes.
   *
   * DEUX PSEUDOS IDENTIQUES SONT REFUSES. Le legacy ne verifiait rien, et deux
   * joueurs pouvaient porter le meme nom: le classement, le chat et les
   * notifications de capture devenaient alors indechiffrables, et se faire
   * passer pour quelqu'un d'autre ne demandait aucun effort. La comparaison se
   * fait sur le texte normalise et sans distinction de casse, sans quoi
   * « Alice » et « alice » passeraient pour deux personnes.
   */
  accueillir(session: SessionJoueur): ResultatValidation<JoueurDeRoom> {
    if (this.statutCourant === 'terminee') {
      return refus('partie', 'Cette partie est terminee.');
    }

    if (this.partie.joueurs[session.id] !== undefined) {
      return refus('session', 'Cette connexion est déjà dans la partie.');
    }

    if (this.pseudoDejaPris(session.pseudo)) {
      return refus('pseudo', 'Ce pseudo est déjà pris dans cette partie.');
    }

    this.partie = ajouterJoueur(this.partie, { id: session.id, pseudo: session.pseudo });
    this.ordreDArrivee.push(session.id);
    this.hoteCourant ??= session.id;

    return {
      valide: true,
      valeur: { id: session.id, pseudo: session.pseudo, hote: this.estHote(session.id) },
    };
  }

  /**
   * Fait sortir un joueur de la room.
   *
   * Si c'etait l'hote, le plus ancien des joueurs restants prend sa place. C'est
   * la regle du legacy (server.js:2251 et 2756), reecrite en un seul endroit: le
   * legacy la recopiait a quatre reprises, avec des conditions legerement
   * differentes a chaque fois.
   *
   * @returns Vrai si le joueur etait la.
   */
  faireSortir(id: IdentifiantEntite): boolean {
    if (this.partie.joueurs[id] === undefined) {
      return false;
    }

    this.partie = retirerJoueur(this.partie, id);
    this.ordreDArrivee = this.ordreDArrivee.filter((present) => present !== id);
    delete this.intentions[id];

    if (this.hoteCourant === id) {
      this.hoteCourant = this.ordreDArrivee[0];
    }

    return true;
  }

  /**
   * Change les reglages de la partie, tant qu'elle n'a pas commence.
   *
   * L'ETAT EST REFAIT A NEUF, PAS RETOUCHE. Changer la carte change ses
   * dimensions, donc les positions tenables, donc la place de chacun: retoucher
   * un champ dans l'etat existant laisserait des joueurs dans un mur. On repart
   * donc de la meme graine, avec les nouveaux reglages, puis on refait entrer les
   * joueurs dans leur ordre d'arrivee. Le resultat est exactement celui qu'aurait
   * donne une room creee d'emblee avec ces reglages-la, ce qui est la seule
   * definition solide de « les reglages ont change ».
   *
   * Le legacy, lui, ecrivait dans currentGameSettings a la volee, y compris
   * pendant une partie: la carte pouvait changer sous les pieds des joueurs. Le
   * refus ci-dessous ferme cette porte.
   *
   * @param reglages Reglages complets, deja valides par la couche reseau.
   * @param terrain Terrain de la nouvelle carte. Absent: carte sans mur.
   * @throws Si la partie a deja commence. L'appelant verifie le statut avant.
   */
  changerReglages(reglages: ReglagesPartiels, terrain?: CarteCollisions): void {
    if (this.statutCourant !== 'salon') {
      throw new Error(
        `Les reglages de la room ${this.id} ne changent plus: statut ${this.statutCourant}.`,
      );
    }

    const membres = this.ordreDArrivee.map((id) => ({
      id,
      pseudo: this.partie.joueurs[id]?.pseudo ?? '',
    }));

    this.terrain = terrain;
    this.partie = this.etatNeuf(reglages);

    for (const membre of membres) {
      this.partie = ajouterJoueur(this.partie, membre);
    }
  }

  /**
   * Lance la partie: les bots entrent en jeu, et la boucle se met a battre.
   *
   * Le peuplement en bots n'appartient pas a la creation de l'etat (decision du
   * 14 aout 2026): un salon en attente n'a pas besoin de bots. C'est ici que le
   * serveur choisit le moment. Les bots sont poses APRES les joueurs, donc a
   * l'ecart de leurs positions.
   *
   * Le compte a rebours de cinq secondes du salon n'est pas gere ici: il se
   * decide et s'annule par messages, donc a l'etape 2.2. Cette methode lance la
   * partie pour de bon.
   *
   * @throws Si la partie a deja commence. L'appelant verifie le statut avant.
   */
  lancer(): void {
    if (this.statutCourant !== 'salon') {
      throw new Error(
        `La room ${this.id} n'est plus dans son salon: statut ${this.statutCourant}.`,
      );
    }

    this.partie = peuplerDeBots(this.partie);
    this.statutCourant = 'enCours';
    this.demarrerLaBoucle();
  }

  /**
   * Suspend la partie: le temps de jeu s'arrete, la boucle continue de battre.
   *
   * LA BOUCLE N'EST PAS ARRETEE, ET C'EST DELIBERE. L'arreter rendrait la room
   * sourde a ce qui arrive pendant la pause, et il faudrait penser a la relancer,
   * ce qui est exactement la forme du defaut X1 de l'audit. Le battement a donc
   * bien lieu; c'est le moteur qui decide que rien ne s'y passe.
   *
   * QUI A LE DROIT DE DEMANDER LA PAUSE N'EST PAS TRANCHE ICI mais a la frontiere
   * reseau, qui verifie la qualite d'hote avant d'appeler, comme pour les
   * reglages et le lancement. Le legacy ouvrait la pause a tout le monde et
   * reservait la reprise a celui qui l'avait demandee: chaque joueur disposait
   * ainsi d'un moyen d'interrompre la partie des autres aussi longtemps qu'il le
   * voulait. Decision du 18 aout 2026: la pause est reservee a l'hote.
   *
   * Suspendre une partie deja suspendue ne fait rien.
   *
   * @throws Si la partie n'est pas en cours. L'appelant verifie le statut avant.
   */
  mettreEnPause(): void {
    this.exigerUnePartieEnCours('suspendue');
    this.partie = mettreEnPause(this.partie);
  }

  /**
   * Rend son temps a une partie suspendue.
   *
   * Reprendre une partie qui ne l'etait pas ne fait rien. Le jeu repart ou il
   * s'etait arrete: aucune duree n'a couru pendant la suspension, donc il n'y a
   * rien a rattraper.
   *
   * @throws Si la partie n'est pas en cours. L'appelant verifie le statut avant.
   */
  reprendre(): void {
    this.exigerUnePartieEnCours('reprise');
    this.partie = reprendre(this.partie);
  }

  /**
   * Range la derniere intention connue d'un joueur.
   *
   * Une intention portant l'identifiant d'un joueur absent est ignoree: le
   * moteur l'ignorerait de toute facon, autant ne pas la garder.
   */
  enregistrerIntention(id: IdentifiantEntite, intention: EntreeJoueur): void {
    if (this.partie.joueurs[id] === undefined) {
      return;
    }

    this.intentions[id] = intention;
  }

  /**
   * Fait avancer la partie d'un battement.
   *
   * C'est le seul point du serveur qui appelle le moteur. Le dt est fidele: la
   * borne de securite appartient a la boucle, pas a cette methode, pour qu'un
   * rejeu ou un test puisse avancer du temps qu'il veut.
   *
   * Quand le temps de jeu est ecoule, la room passe en « terminee », sa boucle
   * s'arrete d'elle-meme, et le rappel de fin de partie est appele une fois.
   *
   * @throws Si la partie n'est pas en cours.
   */
  avancer(dtMs: number): void {
    if (this.statutCourant !== 'enCours') {
      throw new Error(
        `La room ${this.id} n'a pas de partie en cours: statut ${this.statutCourant}.`,
      );
    }

    this.partie = tick(this.partie, this.intentions, dtMs);

    // Prevenir AVANT de constater la fin: le dernier battement d'une partie est
    // un battement comme les autres, et ce qui s'y est passe doit partir comme le
    // reste. Sans cela, une capture faite dans la derniere demi-seconde ne serait
    // jamais annoncee.
    this.surBattement?.(this);

    if (evaluerFinDePartie(this.partie).terminee) {
      this.statutCourant = 'terminee';
      this.arreter();
      this.surFinDePartie?.(this);
    }
  }

  /**
   * Arrete la boucle de battement, sans rien changer d'autre.
   *
   * Appelee par la fin de partie et par la destruction de la room. L'appeler sur
   * une room deja arretee ne fait rien: c'est ce qui garantit qu'aucune boucle
   * ne survit a sa room, le defaut X1 de l'audit.
   */
  arreter(): void {
    this.arreterLaBoucle?.();
    this.arreterLaBoucle = undefined;
  }

  /** Le classement de la partie, du meilleur au moins bon. */
  classement(): readonly LigneScore[] {
    return calculerScores(this.partie);
  }

  /**
   * Fabrique un etat de depart avec les reglages donnes et le terrain courant.
   *
   * Les champs facultatifs sont omis plutot que poses a undefined: le projet
   * compile avec exactOptionalPropertyTypes, qui distingue les deux.
   */
  private etatNeuf(reglages: ReglagesPartiels | undefined): EtatPartie {
    const depart: OptionsEtatInitial = {
      graine: this.graine,
      ...(reglages === undefined ? {} : { reglages }),
      ...(this.terrain === undefined ? {} : { terrain: this.terrain }),
    };

    return creerEtatInitial(depart);
  }

  /**
   * Refuse d'agir sur une partie qui n'est pas en cours.
   *
   * C'est une faute d'appelant, pas un refus adresse a un joueur: la couche
   * reseau verifie le statut avant d'appeler, et lui rend un refus explique. La
   * regle est celle du 14 aout 2026, deja appliquee a lancer et changerReglages.
   */
  private exigerUnePartieEnCours(manoeuvre: string): void {
    if (this.statutCourant !== 'enCours') {
      throw new Error(
        `La partie de la room ${this.id} ne peut pas etre ${manoeuvre}: statut ${this.statutCourant}.`,
      );
    }
  }

  /** Ce joueur est-il l'hote. */
  private estHote(id: IdentifiantEntite): boolean {
    return this.hoteCourant === id;
  }

  /** Ce pseudo est-il deja porte par quelqu'un dans la room. */
  private pseudoDejaPris(pseudo: string): boolean {
    const repere = reperePseudo(pseudo);

    return Object.values(this.partie.joueurs).some(
      (joueur) => reperePseudo(joueur.pseudo) === repere,
    );
  }

  /**
   * Met la boucle en marche.
   *
   * Le dt est mesure entre deux lectures de l'horloge, et non suppose egal a la
   * cadence: une minuterie n'est jamais exacte, et le moteur merite le temps
   * reellement ecoule. Il est borne des deux cotes, contre un serveur qui se
   * fige (voir DT_MAXIMUM_MS) et, par prudence, contre une horloge qui reculerait.
   */
  private demarrerLaBoucle(): void {
    if (this.enMarche) {
      return;
    }

    let precedent = this.horloge.maintenant();

    this.arreterLaBoucle = this.horloge.repeter(() => {
      const maintenant = this.horloge.maintenant();
      const ecoule = Math.min(Math.max(maintenant - precedent, 0), DT_MAXIMUM_MS);
      precedent = maintenant;

      this.avancer(ecoule);
    }, this.cadenceMs);
  }
}

/** Deux ecritures d'un meme pseudo se ramenent a la meme empreinte. */
function reperePseudo(pseudo: string): string {
  return normaliserTexte(pseudo).toLowerCase();
}

/** Un refus, redige pour etre montre au joueur. */
function refus<T>(champ: string, motif: string): ResultatValidation<T> {
  return { valide: false, erreurs: [{ champ, motif }] };
}
