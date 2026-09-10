/**
 * La couche Socket.IO: la frontiere entre le reseau et les parties.
 *
 * Tout ce qui vient d'un client passe par ici, et rien d'autre du serveur ne
 * connait de socket. Cette classe fait exactement quatre choses, et aucune n'est
 * de la logique de jeu:
 *
 *   1. Elle VALIDE. Chaque message recu traverse un schema de @neon-ninja/shared
 *      avant d'aller plus loin. Une charge utile refusee ne touche jamais une
 *      room, et son auteur recoit un refus explique.
 *   2. Elle LIMITE. Chaque connexion tient un seau a jetons par famille de
 *      message. Un client bavard voit ses messages tomber, sans que la partie des
 *      autres en souffre. C'est la faille S4 de l'audit.
 *   3. Elle ROUTE. Une connexion appartient a une partie et a une seule. Les
 *      emissions sont cantonnees a la salle Socket.IO de cette partie, jamais
 *      diffusees a tout le serveur. Elle decide aussi quelle partie un joueur a
 *      le droit de viser: une partie privee ne se rejoint que par son code.
 *   4. Elle TRADUIT. Un instantane part a chaque battement, et les faits du
 *      moteur deviennent des notifications adressees.
 *
 * CE QU'ELLE NE FAIT PAS, ET NE DOIT JAMAIS FAIRE. Aucun calcul de jeu. Elle ne
 * deplace personne, ne resout aucune capture, ne decide d'aucun score. Elle
 * appelle des methodes de GameRoom, qui appelle le moteur. Si une regle de jeu
 * devait apparaitre ici, c'est qu'elle manque dans packages/sim.
 *
 * AUCUN ETAT GLOBAL, une fois de plus. Tout tient dans l'instance: ses
 * connexions, ses decomptes, son RoomManager. Deux serveurs peuvent tourner dans
 * le meme processus sans se voir, ce dont les tests profitent largement.
 */

import type {
  DemandeChat,
  DemandeCreation,
  DemandeRejoindre,
  ErreurValidation,
  EvenementsClientVersServeur,
  EvenementsServeurVersClient,
  InfosSalon,
  IntentionDeplacement,
  LimiteDebit,
  PartiePublique,
  ReglagesPartiels,
  ResultatValidation,
  SeauAJetons,
  SessionJoueur,
} from '@neon-ninja/shared';
import {
  LIMITES_DEBIT,
  completerReglages,
  consommer,
  seauNeuf,
  validerDemandeCreation,
  validerDemandeRejoindre,
  validerIntentionDeplacement,
  validerMessageChat,
  validerReglages,
} from '@neon-ninja/shared';
import type { CarteCollisions } from '@neon-ninja/sim';
import type { Server, Socket } from 'socket.io';

import { CompteARebours } from './compteARebours.js';
import type { GameRoom } from './GameRoom.js';
import type { Horloge } from './horloge.js';
import { horlogeSysteme } from './horloge.js';
import type { Notification } from './instantane.js';
import {
  classementDe,
  instantaneDe,
  joueurDuSalon,
  notificationsDe,
  partiePubliqueDe,
  salonDe,
} from './instantane.js';
import type { OptionsCreationRoom } from './RoomManager.js';
import { RoomManager } from './RoomManager.js';
import type { SourceDeTerrain } from './terrain.js';
import { SANS_TERRAIN } from './terrain.js';

/** Le serveur Socket.IO, type par les deux contrats d'evenements. */
export type ServeurTypee = Server<EvenementsClientVersServeur, EvenementsServeurVersClient>;

/** Une connexion Socket.IO, typee par les deux contrats d'evenements. */
export type SocketTypee = Socket<EvenementsClientVersServeur, EvenementsServeurVersClient>;

/**
 * Les familles de messages, chacune avec son propre seau a jetons.
 *
 * Un joueur qui inonde le chat ne doit pas voir ses deplacements refuses, et
 * inversement: les seaux sont separes parce que les abus le sont aussi.
 */
type FamilleDebit = keyof typeof LIMITES_DEBIT;

/** Ce que le serveur sait d'une connexion. */
interface Connexion {
  readonly socket: SocketTypee;
  /**
   * L'identite du joueur, etablie a l'entree en partie et jamais relue d'un
   * message. Absente tant que la connexion n'est entree nulle part.
   */
  session: SessionJoueur | undefined;
  /** La partie dans laquelle cette connexion se trouve. */
  idRoom: string | undefined;
  /** Un seau a jetons par famille de message. */
  readonly seaux: Record<FamilleDebit, SeauAJetons>;
  /** Instant du dernier message accepte ou refuse, par famille. */
  readonly derniereFois: Record<FamilleDebit, number>;
}

/** La reponse a une demande d'entree ou de creation. */
type ReponseDEntree = (reponse: ResultatValidation<InfosSalon>) => void;

/** Ce qu'il faut pour monter la couche reseau. */
export interface OptionsServeurSocket {
  /** Le serveur Socket.IO, deja attache a un serveur HTTP par l'appelant. */
  readonly io: ServeurTypee;
  /** Le gestionnaire de parties. Un neuf par defaut. */
  readonly rooms?: RoomManager;
  /** L'horloge du serveur. Celle du systeme par defaut. */
  readonly horloge?: Horloge;
  /**
   * D'ou viennent les murs des cartes.
   *
   * Sans mur par defaut, ce qui est le bon defaut pour un montage a la main:
   * lire le disque est une decision, elle se prend explicitement. Le serveur
   * reel la prend dans principal.ts.
   */
  readonly terrains?: SourceDeTerrain;
}

/** La couche reseau d'un serveur de jeu. */
export class ServeurSocket {
  private readonly io: ServeurTypee;
  private readonly horloge: Horloge;

  /** Le gestionnaire de parties. Public en lecture: les tests et l'exploitation le consultent. */
  readonly rooms: RoomManager;

  private readonly connexions = new Map<string, Connexion>();

  /** Le decompte de demarrage de chaque partie qui en a un en cours. */
  private readonly decomptes = new Map<string, CompteARebours>();

  /** D'ou viennent les murs, partage par toutes les parties de ce serveur. */
  private readonly terrains: SourceDeTerrain;

  constructor(options: OptionsServeurSocket) {
    this.io = options.io;
    this.horloge = options.horloge ?? horlogeSysteme;
    this.rooms = options.rooms ?? new RoomManager({ horloge: this.horloge });
    this.terrains = options.terrains ?? SANS_TERRAIN;

    this.io.on('connection', (socket) => {
      this.accueillirLaConnexion(socket);
    });
  }

  /**
   * Ferme la couche reseau: toutes les parties s'arretent, plus rien ne bat.
   *
   * Le serveur Socket.IO lui-meme n'est pas ferme ici: il appartient a
   * l'appelant, qui l'a monte sur son serveur HTTP et sait quand l'eteindre.
   */
  fermer(): void {
    for (const decompte of this.decomptes.values()) {
      decompte.arreter();
    }

    this.decomptes.clear();
    this.connexions.clear();
    this.rooms.toutFermer();
  }

  // ------------------------------------------------------------------------
  // Cycle de vie d'une connexion
  // ------------------------------------------------------------------------

  /** Enregistre une nouvelle connexion et branche ses gestionnaires. */
  private accueillirLaConnexion(socket: SocketTypee): void {
    const maintenant = this.horloge.maintenant();

    this.connexions.set(socket.id, {
      socket,
      session: undefined,
      idRoom: undefined,
      seaux: {
        deplacement: seauNeuf(LIMITES_DEBIT.deplacement),
        chat: seauNeuf(LIMITES_DEBIT.chat),
        reglages: seauNeuf(LIMITES_DEBIT.reglages),
        autresActions: seauNeuf(LIMITES_DEBIT.autresActions),
      },
      derniereFois: {
        deplacement: maintenant,
        chat: maintenant,
        reglages: maintenant,
        autresActions: maintenant,
      },
    });

    socket.on('rejoindre', (demande, accuse) => {
      this.surRejoindre(socket, demande, accuse);
    });
    socket.on('creerPartie', (demande, accuse) => {
      this.surCreerPartie(socket, demande, accuse);
    });
    socket.on('listerParties', (accuse) => {
      this.surListerParties(socket, accuse);
    });
    socket.on('quitter', () => {
      this.surQuitter(socket);
    });
    socket.on('deplacer', (intention) => {
      this.surDeplacer(socket, intention);
    });
    socket.on('chat', (demande) => {
      this.surChat(socket, demande);
    });
    socket.on('reglages', (reglages) => {
      this.surReglages(socket, reglages);
    });
    socket.on('demarrer', () => {
      this.surDemarrer(socket);
    });
    socket.on('annulerDemarrage', () => {
      this.surAnnulerDemarrage(socket);
    });
    socket.on('mettreEnPause', () => {
      this.surPause(socket, true);
    });
    socket.on('reprendre', () => {
      this.surPause(socket, false);
    });
    socket.on('disconnect', () => {
      this.surQuitter(socket);
      this.connexions.delete(socket.id);
    });
  }

  // ------------------------------------------------------------------------
  // Les gestionnaires, un par evenement montant
  // ------------------------------------------------------------------------

  /**
   * Entree dans une partie existante: par son code, par son identifiant, ou en
   * partie rapide.
   *
   * Une entree refusee ne laisse aucune trace: ni session, ni appartenance a une
   * salle, ni message aux autres. Voir faireEntrer.
   */
  private surRejoindre(
    socket: SocketTypee,
    demande: DemandeRejoindre,
    accuse: ReponseDEntree,
  ): void {
    const repondre = accuseOuRien(accuse);
    const connexion = this.connexionLibre(socket, 'rejoindre', repondre);

    if (connexion === undefined) {
      return;
    }

    // La charge utile est typee par le contrat, mais un client modifie n'a jamais
    // compile ce contrat: on la traite comme inconnue, ce qu'elle est.
    const verdict = validerDemandeRejoindre(demande as unknown);
    if (!verdict.valide) {
      repondre({ valide: false, erreurs: verdict.erreurs });
      return;
    }

    const trouvee = this.trouverLaRoom(verdict.valeur);
    if (!trouvee.valide) {
      repondre({ valide: false, erreurs: trouvee.erreurs });
      return;
    }

    this.faireEntrer(socket, connexion, trouvee.valeur, verdict.valeur.pseudo, repondre);
  }

  /**
   * Creation d'une partie par un joueur, qui en devient l'hote.
   *
   * La partie n'est ouverte qu'une fois la demande entierement validee: une
   * demande refusee ne cree rien. Son terrain est charge d'apres ses reglages de
   * depart, comme lorsque l'hote les change dans le salon.
   */
  private surCreerPartie(
    socket: SocketTypee,
    demande: DemandeCreation,
    accuse: ReponseDEntree,
  ): void {
    const repondre = accuseOuRien(accuse);
    const connexion = this.connexionLibre(socket, 'creerPartie', repondre);

    if (connexion === undefined) {
      return;
    }

    const verdict = validerDemandeCreation(demande as unknown);
    if (!verdict.valide) {
      repondre({ valide: false, erreurs: verdict.erreurs });
      return;
    }

    const { configuration, pseudo } = verdict.valeur;
    const room = this.ouvrirUneRoom({
      mode: configuration.mode,
      visibilite: configuration.visibilite,
      ...(configuration.reglages === undefined ? {} : { reglages: configuration.reglages }),
    });

    // Une partie neuve accueille toujours son createur. Si ce n'etait un jour plus
    // le cas, la partie vide ne doit pas survivre a la creation manquee: elle
    // apparaitrait dans la liste publique sans hote.
    if (!this.faireEntrer(socket, connexion, room, pseudo, repondre)) {
      this.rooms.detruire(room.id);
    }
  }

  /**
   * Liste des parties publiques ouvertes: dans leur salon, et pas pleines.
   *
   * Pas besoin d'etre dans une partie pour la demander: c'est justement avant
   * d'entrer qu'on la consulte. Elle compte dans la limite de debit comme les
   * autres actions. Une demande de trop recoit une liste vide et un refus
   * explique, pour que le client ne reste pas a attendre une reponse.
   */
  private surListerParties(
    socket: SocketTypee,
    accuse: (parties: readonly PartiePublique[]) => void,
  ): void {
    const repondre = typeof accuse === 'function' ? accuse : () => undefined;
    const connexion = this.connexions.get(socket.id);

    if (connexion === undefined) {
      return;
    }

    if (!this.autorise(connexion, 'autresActions')) {
      socket.emit('refus', {
        action: 'listerParties',
        erreurs: [{ champ: 'debit', motif: 'Trop de demandes. Ralentissez.' }],
      });
      repondre([]);
      return;
    }

    repondre(this.rooms.partiesPubliquesOuvertes().map(partiePubliqueDe));
  }

  /** Sortie de partie, volontaire ou par deconnexion. */
  private surQuitter(socket: SocketTypee): void {
    const connexion = this.connexions.get(socket.id);

    if (connexion?.idRoom === undefined || connexion.session === undefined) {
      return;
    }

    const room = this.rooms.room(connexion.idRoom);
    const partant = joueurDuSalon({
      id: connexion.session.id,
      pseudo: connexion.session.pseudo,
      hote: room?.hote === connexion.session.id,
    });
    const idRoom = connexion.idRoom;

    connexion.session = undefined;
    connexion.idRoom = undefined;
    void socket.leave(idRoom);

    this.rooms.quitter(idRoom, partant.id);

    const restante = this.rooms.room(idRoom);
    if (restante === undefined) {
      // Le RoomManager vient de detruire une partie vide: son decompte n'a plus
      // d'objet, et le laisser tourner ferait partir une partie sans personne.
      this.decomptes.get(idRoom)?.arreter();
      this.decomptes.delete(idRoom);
      return;
    }

    this.io.to(idRoom).emit('joueurParti', partant);
    this.diffuserLeSalon(restante);
  }

  /**
   * Intention de deplacement.
   *
   * C'est le seul evenement a fort debit, et le seul dont un refus ne dit rien a
   * personne: un deplacement qui depasse la limite est ignore en silence. Prevenir
   * couterait un message par message refuse, ce qui reviendrait a amplifier
   * exactement ce que la limite cherche a contenir.
   */
  private surDeplacer(socket: SocketTypee, intention: IntentionDeplacement): void {
    const connexion = this.connexions.get(socket.id);

    if (connexion?.session === undefined || connexion.idRoom === undefined) {
      return;
    }

    if (!this.autorise(connexion, 'deplacement')) {
      return;
    }

    const room = this.rooms.room(connexion.idRoom);
    if (room?.statut !== 'enCours') {
      return;
    }

    const verdict = validerIntentionDeplacement(intention as unknown);
    if (!verdict.valide) {
      return;
    }

    room.enregistrerIntention(connexion.session.id, verdict.valeur);
  }

  /** Message de chat, signe par la session et diffuse a la seule partie. */
  private surChat(socket: SocketTypee, demande: DemandeChat): void {
    const connexion = this.connexions.get(socket.id);

    if (connexion?.session === undefined || connexion.idRoom === undefined) {
      return;
    }

    if (!this.autorise(connexion, 'chat')) {
      socket.emit('refus', {
        action: 'chat',
        erreurs: [{ champ: 'chat', motif: 'Trop de messages. Ralentissez.' }],
      });
      return;
    }

    const verdict = validerMessageChat(connexion.session, demande as unknown);
    if (!verdict.valide) {
      socket.emit('refus', { action: 'chat', erreurs: verdict.erreurs });
      return;
    }

    this.io.to(connexion.idRoom).emit('chat', verdict.valeur);
  }

  /** Changement des reglages par l'hote, dans le salon uniquement. */
  private surReglages(socket: SocketTypee, reglages: ReglagesPartiels): void {
    const room = this.roomDeLHote(socket, 'reglages');
    if (room === undefined) {
      return;
    }

    if (room.statut !== 'salon') {
      socket.emit('refus', {
        action: 'reglages',
        erreurs: [{ champ: 'reglages', motif: 'La partie a déjà commencé.' }],
      });
      return;
    }

    const verdict = validerReglages(reglages as unknown);
    if (!verdict.valide) {
      socket.emit('refus', { action: 'reglages', erreurs: verdict.erreurs });
      return;
    }

    // Les reglages peuvent changer de carte, donc de murs. Le terrain se
    // recharge avec eux: sans cela, la partie garderait les murs de la carte
    // precedente sous le decor de la nouvelle.
    room.changerReglages(verdict.valeur, this.terrainDe(verdict.valeur));
    this.diffuserLeSalon(room);
  }

  /** Demarrage de la partie par l'hote: c'est le decompte qui part, pas la partie. */
  private surDemarrer(socket: SocketTypee): void {
    const room = this.roomDeLHote(socket, 'demarrer');
    if (room === undefined) {
      return;
    }

    if (room.statut !== 'salon') {
      socket.emit('refus', {
        action: 'demarrer',
        erreurs: [{ champ: 'partie', motif: 'La partie a déjà commencé.' }],
      });
      return;
    }

    if (this.decomptes.get(room.id)?.enCours === true) {
      return;
    }

    const decompte = new CompteARebours({
      horloge: this.horloge,
      surAnnonce: (secondesRestantes, annulable) => {
        this.io.to(room.id).emit('compteARebours', { secondesRestantes, annulable });
      },
      surDepart: () => {
        this.lancerLaPartie(room);
      },
    });

    this.decomptes.set(room.id, decompte);
    decompte.demarrer();
  }

  /** Annulation du decompte par l'hote, tant que la regle l'autorise. */
  private surAnnulerDemarrage(socket: SocketTypee): void {
    const room = this.roomDeLHote(socket, 'annulerDemarrage');
    if (room === undefined) {
      return;
    }

    const decompte = this.decomptes.get(room.id);
    if (decompte?.annuler() !== true) {
      socket.emit('refus', {
        action: 'annulerDemarrage',
        erreurs: [{ champ: 'partie', motif: 'Il est trop tard pour annuler.' }],
      });
      return;
    }

    this.decomptes.delete(room.id);
    this.io.to(room.id).emit('demarrageAnnule');
  }

  /**
   * Suspension et reprise de la partie par l'hote.
   *
   * UN SEUL GESTIONNAIRE POUR LES DEUX DEMANDES, parce qu'elles ne different que
   * par l'etat vise. Le legacy avait au contraire une bascule unique, et devait
   * donc retenir qui l'avait actionnee pour savoir qui pouvait la defaire.
   *
   * LA DEMANDE EST IDEMPOTENTE. Suspendre une partie deja suspendue ne fait rien
   * et ne diffuse rien: sans cette porte, un client qui reemet sa demande ferait
   * clignoter le bandeau de tous les autres.
   *
   * Aucune logique de jeu ici: la couche verifie qui demande et dans quel etat se
   * trouve la partie, puis appelle la room. Ce que la pause fait au jeu est ecrit
   * dans le moteur, et nulle part ailleurs.
   */
  private surPause(socket: SocketTypee, suspendre: boolean): void {
    const action = suspendre ? 'mettreEnPause' : 'reprendre';
    const room = this.roomDeLHote(socket, action);

    if (room === undefined) {
      return;
    }

    if (room.statut !== 'enCours') {
      socket.emit('refus', {
        action,
        erreurs: [{ champ: 'partie', motif: "La partie n'est pas en cours." }],
      });
      return;
    }

    if (room.enPause === suspendre) {
      return;
    }

    if (suspendre) {
      room.mettreEnPause();
      const parPseudo = this.connexions.get(socket.id)?.session?.pseudo ?? '';
      this.io.to(room.id).emit('partieEnPause', { parPseudo });
      return;
    }

    room.reprendre();
    this.io.to(room.id).emit('partieReprise');
  }

  // ------------------------------------------------------------------------
  // Diffusion
  // ------------------------------------------------------------------------

  /** Fait partir la partie pour de bon, une fois le decompte arrive au bout. */
  private lancerLaPartie(room: GameRoom): void {
    this.decomptes.delete(room.id);

    if (room.statut !== 'salon') {
      return;
    }

    room.lancer();
    this.io.to(room.id).emit('partieLancee');
  }

  /**
   * Diffuse l'etat d'une partie apres un battement.
   *
   * L'instantane part a la salle entiere, en un seul message identique pour tous.
   * Les notifications, elles, sont adressees: chacune ne va qu'a celui qu'elle
   * concerne. Un joueur qui a quitte la partie entre-temps n'a plus de connexion,
   * et son message est simplement omis.
   */
  private diffuserLeBattement(room: GameRoom): void {
    this.io.to(room.id).emit('etat', instantaneDe(room.etat));

    for (const notification of notificationsDe(room.etat)) {
      const destinataire = this.connexions.get(notification.pour);

      if (destinataire?.idRoom === room.id) {
        envoyer(destinataire.socket, notification);
      }
    }
  }

  /** Annonce la fin d'une partie et son classement definitif. */
  private diffuserLaFin(room: GameRoom): void {
    this.io.to(room.id).emit('partieTerminee', { classement: classementDe(room.etat) });
  }

  /** Reemet l'etat du salon a tous ses membres. */
  private diffuserLeSalon(room: GameRoom): void {
    this.io.to(room.id).emit('salon', salonDe(room));
  }

  // ------------------------------------------------------------------------
  // Briques communes
  // ------------------------------------------------------------------------

  /**
   * La connexion d'un joueur qui demande a entrer ou a creer, si elle en a le droit.
   *
   * Deux conditions communes aux deux demandes: le debit, et le fait de n'etre
   * encore dans aucune partie. Un refus est rendu a l'appelant, et rien n'est
   * rendu.
   */
  private connexionLibre(
    socket: SocketTypee,
    action: 'rejoindre' | 'creerPartie',
    repondre: ReponseDEntree,
  ): Connexion | undefined {
    const connexion = this.connexions.get(socket.id);

    if (connexion === undefined) {
      return undefined;
    }

    if (!this.autorise(connexion, 'autresActions')) {
      repondre(refus(action, 'Trop de demandes. Ralentissez.'));
      return undefined;
    }

    if (connexion.idRoom !== undefined) {
      repondre(refus('session', 'Cette connexion est déjà dans une partie.'));
      return undefined;
    }

    return connexion;
  }

  /**
   * Fait entrer une connexion dans une partie, trouvee ou tout juste creee.
   *
   * L'ORDRE DES OPERATIONS EST LE POINT IMPORTANT. On demande a la room
   * d'accueillir, et c'est SEULEMENT SI elle accepte que l'on retient la session
   * et que l'on rejoint la salle Socket.IO. Une entree refusee ne laisse donc
   * aucune trace: ni session, ni appartenance a une salle, ni message aux autres.
   *
   * @returns Vrai si la room a accueilli le joueur.
   */
  private faireEntrer(
    socket: SocketTypee,
    connexion: Connexion,
    room: GameRoom,
    pseudo: string,
    repondre: ReponseDEntree,
  ): boolean {
    const session: SessionJoueur = { id: socket.id, pseudo };
    const entree = room.accueillir(session);

    if (!entree.valide) {
      repondre({ valide: false, erreurs: entree.erreurs });
      return false;
    }

    connexion.session = session;
    connexion.idRoom = room.id;
    void socket.join(room.id);

    repondre({ valide: true, valeur: salonDe(room) });

    socket.to(room.id).emit('joueurArrive', joueurDuSalon(entree.valeur));
    this.diffuserLeSalon(room);

    // Rejoindre une partie deja commencee est autorise, comme dans le legacy. Le
    // nouveau venu doit alors basculer tout de suite vers l'ecran de jeu.
    if (room.statut === 'enCours') {
      socket.emit('partieLancee');
    }

    return true;
  }

  /**
   * Retrouve la partie que ce socket commande, ou refuse avec une explication.
   *
   * Trois conditions, et un seul endroit qui les verifie: le debit, la presence
   * dans une partie, et la qualite d'hote. Recopier ces conditions dans chaque
   * gestionnaire etait la maladie du legacy, qui verifiait isOwner a cinq endroits
   * avec cinq formulations differentes.
   */
  private roomDeLHote(
    socket: SocketTypee,
    action: keyof EvenementsClientVersServeur,
  ): GameRoom | undefined {
    const connexion = this.connexions.get(socket.id);

    if (connexion?.session === undefined || connexion.idRoom === undefined) {
      return undefined;
    }

    const famille: FamilleDebit = action === 'reglages' ? 'reglages' : 'autresActions';
    if (!this.autorise(connexion, famille)) {
      socket.emit('refus', {
        action,
        erreurs: [{ champ: 'debit', motif: 'Trop de demandes. Ralentissez.' }],
      });
      return undefined;
    }

    const room = this.rooms.room(connexion.idRoom);
    if (room === undefined) {
      return undefined;
    }

    if (room.hote !== connexion.session.id) {
      socket.emit('refus', {
        action,
        erreurs: [{ champ: 'hote', motif: "Seul l'hôte de la partie peut faire cela." }],
      });
      return undefined;
    }

    return room;
  }

  /**
   * Ce message passe-t-il la limite de debit de sa famille.
   *
   * Le temps ecoule est mesure depuis le message precedent DE LA MEME FAMILLE,
   * parce que c'est ce que le seau a jetons attend. La lecture de l'horloge se
   * fait ici et nulle part ailleurs dans les gestionnaires.
   */
  private autorise(connexion: Connexion, famille: FamilleDebit): boolean {
    const maintenant = this.horloge.maintenant();
    const ecoule = Math.max(maintenant - connexion.derniereFois[famille], 0);
    const limite: LimiteDebit = LIMITES_DEBIT[famille];
    const verdict = consommer(connexion.seaux[famille], limite, ecoule);

    connexion.seaux[famille] = verdict.seau;
    connexion.derniereFois[famille] = maintenant;

    return verdict.accepte;
  }

  /**
   * Trouve la partie qu'une demande d'entree vise, ou dit pourquoi il n'y en a pas.
   *
   * TROIS CAS, ET UNE REGLE DE SECURITE.
   *
   *   - Par CODE: la partie privee qui le porte.
   *   - Par IDENTIFIANT: une partie publique seulement. Les identifiants se
   *     devinent (room-1, room-2): accepter d'y entrer ferait d'un code
   *     d'invitation une simple formalite. Une partie privee visee par son
   *     identifiant recoit donc le meme refus qu'une partie qui n'existe pas,
   *     pour ne pas meme confirmer qu'elle existe.
   *   - SANS RIEN, c'est la partie rapide du cadrage de l'etape 0.3: la premiere
   *     partie publique encore dans son salon et non pleine, ou une nouvelle
   *     partie publique aux reglages par defaut. Elle remplace la regle
   *     provisoire du jalon 1, qui prenait n'importe quel salon en attente.
   */
  private trouverLaRoom(demande: DemandeRejoindre): ResultatValidation<GameRoom> {
    if (demande.code !== undefined) {
      const room = this.rooms.parCode(demande.code);

      return room === undefined
        ? refus('code', 'Aucune partie ne correspond à ce code.')
        : { valide: true, valeur: room };
    }

    if (demande.idRoom !== undefined) {
      const room = this.rooms.room(demande.idRoom);

      return room?.visibilite === 'publique'
        ? { valide: true, valeur: room }
        : refus('idRoom', "Cette partie n'existe plus.");
    }

    return {
      valide: true,
      valeur: this.rooms.partiesPubliquesOuvertes()[0] ?? this.ouvrirUneRoom(),
    };
  }

  /**
   * Ouvre une partie geree par ce serveur.
   *
   * C'EST LE SEUL BON MOYEN DE CREER UNE PARTIE ICI. Une room creee directement
   * sur le RoomManager n'aurait pas de rappel de battement, donc elle tournerait
   * sans que personne n'en recoive jamais l'etat: un jeu qui a l'air fige. Les
   * deux rappels sont poses ici, une fois pour toutes, et l'appelant ne peut pas
   * les oublier puisqu'il n'a pas a les fournir.
   */
  ouvrirUneRoom(
    options: Omit<OptionsCreationRoom, 'surBattement' | 'surFinDePartie'> = {},
  ): GameRoom {
    const terrain = options.terrain ?? this.terrainDe(options.reglages);

    return this.rooms.creer({
      ...options,
      ...(terrain === undefined ? {} : { terrain }),
      surBattement: (room) => {
        this.diffuserLeBattement(room);
      },
      surFinDePartie: (room) => {
        this.diffuserLaFin(room);
      },
    });
  }

  /**
   * Le terrain correspondant a des reglages, ou rien s'il ne se charge pas.
   *
   * UN TERRAIN QUI MANQUE NE FAIT PAS TOMBER LE SERVEUR, mais il se voit. Une
   * image de collision absente ou illisible est une anomalie d'installation, pas
   * une situation de jeu: la partie continue sur une carte sans mur, comme elle
   * le faisait avant cette etape, et l'incident est journalise. Le jeu d'origine
   * remplacait lui aussi la carte manquante par une carte vide, mais en silence,
   * si bien que personne ne savait pourquoi les murs avaient disparu.
   *
   * C'est aussi ce qui permet aux tests d'integration de tourner sans jamais
   * toucher au disque: leur chargeur pointe vers un dossier qui n'existe pas, et
   * ils jouent sur une carte sans mur, ce qui est exactement ce qu'ils veulent.
   */
  private terrainDe(reglages: ReglagesPartiels | undefined): CarteCollisions | undefined {
    const complets = completerReglages(reglages);

    try {
      return this.terrains.charger({
        carte: complets.carte,
        modeMiroir: complets.modeMiroir,
      });
    } catch (erreur) {
      console.warn(
        `Terrain de la carte ${complets.carte} illisible, la partie se jouera sans mur.`,
        erreur,
      );

      return undefined;
    }
  }
}

/**
 * Envoie une notification a son destinataire.
 *
 * Le choix se fait par un aiguillage explicite, et non par une emission
 * generique: c'est ce qui permet au compilateur de verifier que chaque nom
 * d'evenement recoit bien la charge utile que le contrat lui associe. Ajouter une
 * notification sans la brancher ici devient une erreur de compilation.
 */
function envoyer(socket: SocketTypee, notification: Notification): void {
  switch (notification.nom) {
    case 'captureSubie':
      socket.emit('captureSubie', notification.charge);
      return;

    case 'captureReussie':
      socket.emit('captureReussie', notification.charge);
      return;

    case 'captureParBotNoir':
      socket.emit('captureParBotNoir', notification.charge);
      return;

    case 'botNoirDetruit':
      socket.emit('botNoirDetruit', notification.charge);
      return;

    case 'bonusActive':
      socket.emit('bonusActive', notification.charge);
      return;

    case 'malusRamasse':
      socket.emit('malusRamasse', notification.charge);
      return;

    case 'malusSubi':
      socket.emit('malusSubi', notification.charge);
      return;
  }
}

/**
 * L'accuse de reception fourni par le client, ou une fonction qui ne fait rien.
 *
 * Un client modifie peut omettre l'accuse: le serveur ne doit pas tomber en
 * appelant ce qui n'est pas une fonction.
 */
function accuseOuRien(accuse: unknown): ReponseDEntree {
  return typeof accuse === 'function' ? (accuse as ReponseDEntree) : () => undefined;
}

/** Un refus a un seul motif, mis a la forme d'un resultat de validation. */
function refus<T>(champ: string, motif: string): ResultatValidation<T> {
  const erreurs: readonly ErreurValidation[] = [{ champ, motif }];

  return { valide: false, erreurs };
}
