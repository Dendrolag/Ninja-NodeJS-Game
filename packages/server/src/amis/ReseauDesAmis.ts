/**
 * Les amis en direct (etape 2.8): la presence de chacun montree a ses seuls amis, les
 * invitations, et le signal qui fait relire une liste d'amis changee.
 *
 * C'EST L'ASSEMBLAGE DE TROIS PIECES, possedees par la couche reseau: le registre de
 * presence (presence.ts), qui sait ou se trouve chaque page de compte. Le registre des
 * invitations (invitations.ts), qui tient les droits d'entree. Et les amis des comptes
 * connectes, lus par l'annuaire et gardes ici tant que le compte a une page ouverte.
 * La couche reseau appelle cette classe a chaque fait qui compte (page ouverte ou
 * fermee, entree, sortie, partie qui change), et lui donne de quoi envoyer un message a
 * une connexion. Cette classe ne connait pas de socket.
 *
 * LA PRESENCE NE VA QU'AUX AMIS. Une amitie etant mutuelle, les amis d'un compte sont
 * aussi ceux qui le voient: quand un compte change de lieu, chacun de ses amis en ligne
 * recoit sa liste de presence recalculee. La liste est entiere, et ne part que si elle
 * differe de la derniere envoyee.
 *
 * UN AMI SE DEDUIT DE LA BASE, JAMAIS DU CLIENT. Les amis d'un compte sont lus a sa
 * premiere page ouverte, puis relus apres chaque geste d'amitie qui le touche, que
 * l'annuaire signale (surAmitiesChangees). Inviter demande d'etre ami: un bloque ne
 * l'est jamais, le blocage defaisant l'amitie, et recoit le meme refus qu'un inconnu.
 *
 * LA LISTE DES AMIS SE RELIT SUR SIGNAL. Apres un geste qui a ecrit, les pages des deux
 * comptes recoivent amitiesChangees, sans contenu: elles relisent leur liste par la
 * route des amis, qui sait ce qu'elle doit montrer ou taire. Le blocage reste
 * silencieux.
 *
 * AUCUN ETAT GLOBAL: une instance par couche reseau.
 */

import type {
  InvitationEnvoyee,
  InvitationRecue,
  InvitationRetiree,
  PresenceDUnAmi,
  ResultatValidation,
} from '@neon-ninja/shared';
import { reperePseudo } from '@neon-ninja/shared';

import type { AmiConnu, AnnuaireDesComptes } from '../comptes/annuaire.js';
import type { Horloge } from '../horloge.js';
import type { Invitation } from './invitations.js';
import { RegistreDesInvitations } from './invitations.js';
import type { PartieObservee } from './presence.js';
import { RegistreDePresence } from './presence.js';

/** Un message des amis en direct, pour une connexion. */
export type MessageDesAmis =
  | { readonly nom: 'presenceDesAmis'; readonly charge: readonly PresenceDUnAmi[] }
  | { readonly nom: 'amitiesChangees' }
  | { readonly nom: 'invitationRecue'; readonly charge: InvitationRecue }
  | { readonly nom: 'invitationRetiree'; readonly charge: InvitationRetiree };

/** Ce qu'il faut pour monter les amis en direct. */
export interface OptionsReseauDesAmis {
  /** L'annuaire des comptes: les amis d'un compte, et les amities qui changent. */
  readonly annuaire: AmisDeLAnnuaire;
  /** L'horloge des droits d'entree. */
  readonly horloge: Horloge;
  /** Retrouve une partie par son identifiant. */
  readonly partie: (idRoom: string) => PartieObservee | undefined;
  /** Envoie un message a une connexion ouverte. */
  readonly envoyer: (idConnexion: string, message: MessageDesAmis) => void;
  /** Ce que vaut un droit d'entree. BORNES_INVITATIONS par defaut. */
  readonly validiteMs?: number;
  /** Le temps minimal entre deux invitations au meme ami. BORNES_INVITATIONS par defaut. */
  readonly intervalleParAmiMs?: number;
  /** Comment tirer l'identifiant d'une invitation. Le generateur cryptographique par defaut. */
  readonly tirerIdentifiant?: () => string;
}

/** Ce que les amis en direct demandent a l'annuaire des comptes. */
export type AmisDeLAnnuaire = Pick<AnnuaireDesComptes, 'amisDe' | 'surAmitiesChangees'>;

/** Les motifs des invitations refusees. */
export const MOTIFS_D_INVITATION = {
  invite: 'Connectez-vous à votre compte pour inviter vos amis.',
  horsPartie: 'Vous n’êtes dans aucune partie.',
  partieFinie: 'Cette partie est terminée.',
  pasAmi: 'Vous ne pouvez inviter que vos amis.',
  plusValable: 'Cette invitation n’est plus valable.',
} as const;

/** Les amis d'un compte connecte, tels que la couche reseau les garde. */
interface AmisGardes {
  /** Pseudo de chaque ami, par compte, dans l'ordre de la base: par pseudo. */
  readonly amis: ReadonlyMap<string, string>;
}

/** Les amis en direct d'une couche reseau. */
export class ReseauDesAmis {
  private readonly annuaire: AmisDeLAnnuaire;
  private readonly partie: (idRoom: string) => PartieObservee | undefined;
  private readonly envoyer: (idConnexion: string, message: MessageDesAmis) => void;

  private readonly presence = new RegistreDePresence();
  private readonly invitations: RegistreDesInvitations;

  /** Les amis de chaque compte en ligne dont la lecture a abouti. */
  private readonly gardes = new Map<string, AmisGardes>();

  /**
   * La lecture en cours des amis de chaque compte, et son numero. Seule la derniere
   * lecture demandee pour un compte a le droit de remplacer ses amis gardes.
   */
  private readonly lectures = new Map<string, { numero: number; fin: Promise<void> }>();
  private numeroDeLecture = 0;

  /** La derniere liste de presence envoyee a chaque compte, decrite. */
  private readonly envoyees = new Map<string, string>();

  private readonly arreterLEcoute: () => void;

  constructor(options: OptionsReseauDesAmis) {
    this.annuaire = options.annuaire;
    this.partie = options.partie;
    this.envoyer = options.envoyer;
    this.invitations = new RegistreDesInvitations({
      horloge: options.horloge,
      ...(options.validiteMs === undefined ? {} : { validiteMs: options.validiteMs }),
      ...(options.intervalleParAmiMs === undefined
        ? {}
        : { intervalleParAmiMs: options.intervalleParAmiMs }),
      ...(options.tirerIdentifiant === undefined
        ? {}
        : { tirerIdentifiant: options.tirerIdentifiant }),
      surExpiration: (invitation) => {
        this.prevenirDuRetrait([invitation]);
      },
    });

    this.arreterLEcoute = this.annuaire.surAmitiesChangees((auteur, vise) => {
      void this.amitiesChangees(auteur, vise);
    });
  }

  /** Le nombre d'invitations en vigueur, pour les tests. */
  get nombreDInvitations(): number {
    return this.invitations.nombre;
  }

  // ------------------------------------------------------------------------
  // Les faits de la couche reseau
  // ------------------------------------------------------------------------

  /**
   * Une page de ce compte vient d'ouvrir cette connexion.
   *
   * Elle recoit les invitations qui attendent le compte, puis sa liste de presence. Si
   * c'est la premiere page du compte, ses amis sont lus, et ses amis en ligne
   * apprennent qu'il l'est.
   */
  connexionOuverte(idConnexion: string, compteId: string): void {
    const premiere = this.presence.ouvrir(idConnexion, compteId);

    for (const invitation of this.invitations.enAttentePour(compteId)) {
      this.envoyer(idConnexion, { nom: 'invitationRecue', charge: invitation.recue });
    }

    if (premiere || !this.gardes.has(compteId)) {
      void this.lireLesAmis(compteId);
      return;
    }

    this.envoyer(idConnexion, { nom: 'presenceDesAmis', charge: this.presenceVuePar(compteId) });
  }

  /**
   * Cette connexion vient de se fermer. Si c'etait la derniere page de son compte, ses
   * amis apprennent qu'il est hors ligne, et ses amis gardes sont oublies. Ses
   * invitations recues l'attendent: il peut recharger sa page.
   */
  connexionFermee(idConnexion: string): void {
    const horsLigne = this.presence.fermer(idConnexion);

    if (horsLigne === undefined) {
      return;
    }

    this.signalerAuxAmis(horsLigne);
    this.gardes.delete(horsLigne);
    this.lectures.delete(horsLigne);
    this.envoyees.delete(horsLigne);
  }

  /** Cette connexion vient d'entrer dans une partie, ou d'y revenir. */
  entree(idConnexion: string, idRoom: string): void {
    const compteId = this.presence.entrer(idConnexion, idRoom);

    if (compteId !== undefined) {
      this.signalerAuxAmis(compteId);
    }
  }

  /** Cette connexion n'est plus dans une partie, et reste ouverte. */
  sortie(idConnexion: string): void {
    const compteId = this.presence.sortir(idConnexion);

    if (compteId !== undefined) {
      this.signalerAuxAmis(compteId);
    }
  }

  /**
   * Ce compte vient de quitter cette partie pour de bon: ses invitations dans cette
   * partie ne valent plus. Une coupure en pleine partie n'est pas un depart: sa place
   * l'attend.
   */
  joueurSorti(compteId: string, idRoom: string): void {
    this.prevenirDuRetrait(
      this.invitations.retirerSi(
        (invitation) => invitation.de === compteId && invitation.idRoom === idRoom,
      ),
    );
  }

  /**
   * Cette partie vient de changer: joueurs, statut, ou disparition. Ses comptes ont
   * change de lieu pour leurs amis. Finie ou disparue, elle n'accepte plus
   * d'invitation.
   */
  partieChangee(idRoom: string): void {
    const partie = this.partie(idRoom);

    if (partie === undefined || partie.statut === 'terminee') {
      this.prevenirDuRetrait(
        this.invitations.retirerSi((invitation) => invitation.idRoom === idRoom),
      );
    }

    for (const compteId of this.presence.comptesDans(idRoom)) {
      this.signalerAuxAmis(compteId);
    }
  }

  // ------------------------------------------------------------------------
  // Les invitations
  // ------------------------------------------------------------------------

  /**
   * Invite l'ami qui porte ce pseudo dans la partie de cette connexion.
   *
   * Dans l'ordre: un compte, dans une partie qui n'est pas finie. Un ami, lu apres la
   * lecture de ses amis si elle est en cours. En ligne. Pas deja dans la partie. Pas
   * invite trop recemment. Acceptee, chaque page de l'ami recoit l'invitation, et
   * celle qu'elle remplace est retiree.
   *
   * @param pseudoInviteur Le pseudo sous lequel l'inviteur joue, que l'ami lira.
   */
  async inviter(
    idConnexion: string,
    pseudoInviteur: string,
    pseudo: string,
  ): Promise<ResultatValidation<InvitationEnvoyee>> {
    const compteId = this.presence.compteDe(idConnexion);

    if (compteId === undefined) {
      return refus('session', MOTIFS_D_INVITATION.invite);
    }

    await this.lectures.get(compteId)?.fin;

    // La lecture a pu durer: la partie se relit apres elle.
    const idRoom = this.presence.partieDe(idConnexion);
    const partie = idRoom === undefined ? undefined : this.partie(idRoom);

    if (idRoom === undefined || partie === undefined) {
      return refus('partie', MOTIFS_D_INVITATION.horsPartie);
    }

    if (partie.statut === 'terminee') {
      return refus('partie', MOTIFS_D_INVITATION.partieFinie);
    }

    const ami = this.amiNomme(compteId, pseudo);

    if (ami === undefined) {
      return refus('pseudo', MOTIFS_D_INVITATION.pasAmi);
    }

    if (!this.presence.enLigne(ami.compteId)) {
      return refus('pseudo', `${ami.pseudo} n’est pas en ligne.`);
    }

    if (partie.joueurs.some((joueur) => joueur.compte?.id === ami.compteId)) {
      return refus('pseudo', `${ami.pseudo} est déjà dans votre partie.`);
    }

    const emission = this.invitations.emettre(compteId, ami.compteId, idRoom, {
      de: pseudoInviteur,
      mode: partie.mode,
      visibilite: partie.visibilite,
      joueurs: partie.joueurs.length,
      capacite: partie.capacite,
    });

    if (!emission.valide) {
      return emission;
    }

    const { invitation, remplacee } = emission.valeur;

    if (remplacee !== undefined) {
      this.prevenirDuRetrait([remplacee]);
    }

    this.envoyerAuCompte(ami.compteId, { nom: 'invitationRecue', charge: invitation.recue });

    return { valide: true, valeur: { pseudo: ami.pseudo } };
  }

  /**
   * La partie qu'ouvre cette invitation a ce compte, ou le refus unique d'une invitation
   * inconnue, expiree ou adressee a un autre. Le droit n'est pas consomme ici: il ne
   * l'est qu'a l'entree reussie (invitationServie).
   */
  droitDEntree(id: string, compteId: string | undefined): ResultatValidation<string> {
    const invitation = this.invitations.valable(id, compteId);

    return invitation === undefined
      ? refus('invitation', MOTIFS_D_INVITATION.plusValable)
      : { valide: true, valeur: invitation.idRoom };
  }

  /** Cette invitation vient de faire entrer son invite: elle ne vaut plus. */
  invitationServie(id: string): void {
    const invitation = this.invitations.retirer(id);

    if (invitation !== undefined) {
      this.prevenirDuRetrait([invitation]);
    }
  }

  /** Arrete l'ecoute des amities et tous les delais. N'envoie plus rien. */
  fermer(): void {
    this.arreterLEcoute();
    this.invitations.fermer();
    this.presence.vider();
    this.gardes.clear();
    this.lectures.clear();
    this.envoyees.clear();
  }

  // ------------------------------------------------------------------------
  // Briques
  // ------------------------------------------------------------------------

  /**
   * Un geste a change quelque chose entre ces deux comptes. Leurs pages relisent leur
   * liste, leurs amis gardes se relisent, et les invitations entre eux tombent s'ils
   * ne sont plus amis.
   */
  private async amitiesChangees(auteur: string, vise: string): Promise<void> {
    const lectures: Promise<void>[] = [];

    for (const compteId of new Set([auteur, vise])) {
      if (this.presence.enLigne(compteId)) {
        this.envoyerAuCompte(compteId, { nom: 'amitiesChangees' });
        lectures.push(this.lireLesAmis(compteId));
      }
    }

    await Promise.all(lectures);

    if (!this.invitations.existeEntre(auteur, vise)) {
      return;
    }

    try {
      const amis = this.gardes.get(auteur)?.amis ?? idsDe(await this.annuaire.amisDe(auteur));

      if (!amis.has(vise)) {
        this.prevenirDuRetrait(
          this.invitations.retirerSi(
            (invitation) =>
              (invitation.de === auteur && invitation.pour === vise) ||
              (invitation.de === vise && invitation.pour === auteur),
          ),
        );
      }
    } catch (erreur) {
      console.error('Les amis d’un compte n’ont pas pu etre relus:', erreur);
    }
  }

  /**
   * Lit les amis de ce compte et les garde, s'il est toujours en ligne et si aucune
   * lecture plus recente n'a ete demandee. Puis il recoit sa liste de presence, et ses
   * amis apprennent ou il est. Une base qui ne repond pas laisse les amis d'avant, ou
   * aucun: la presence est un confort, pas une condition pour jouer.
   */
  private lireLesAmis(compteId: string): Promise<void> {
    this.numeroDeLecture += 1;
    const numero = this.numeroDeLecture;

    const fin = (async () => {
      let amis: ReadonlyMap<string, string> | undefined;

      try {
        amis = pseudosDe(await this.annuaire.amisDe(compteId));
      } catch (erreur) {
        console.error('Les amis d’un compte n’ont pas pu etre lus:', erreur);
      }

      if (this.lectures.get(compteId)?.numero !== numero || !this.presence.enLigne(compteId)) {
        return;
      }

      this.lectures.delete(compteId);
      this.gardes.set(compteId, { amis: amis ?? this.gardes.get(compteId)?.amis ?? new Map() });
      this.pousserLaPresence(compteId);
      this.signalerAuxAmis(compteId);
    })();

    this.lectures.set(compteId, { numero, fin });

    return fin;
  }

  /** Ce compte a change de lieu: chacun de ses amis en ligne recoit sa liste a jour. */
  private signalerAuxAmis(compteId: string): void {
    for (const ami of this.gardes.get(compteId)?.amis.keys() ?? []) {
      if (this.gardes.has(ami)) {
        this.pousserLaPresence(ami);
      }
    }
  }

  /** Envoie a ce compte sa liste de presence, si elle differe de la derniere envoyee. */
  private pousserLaPresence(compteId: string): void {
    const presences = this.presenceVuePar(compteId);
    const description = JSON.stringify(presences);

    if (this.envoyees.get(compteId) === description) {
      return;
    }

    this.envoyees.set(compteId, description);
    this.envoyerAuCompte(compteId, { nom: 'presenceDesAmis', charge: presences });
  }

  /** Les amis en ligne de ce compte, et ou ils sont, dans l'ordre de ses amis. */
  private presenceVuePar(compteId: string): readonly PresenceDUnAmi[] {
    const presences: PresenceDUnAmi[] = [];

    for (const [ami, pseudo] of this.gardes.get(compteId)?.amis ?? []) {
      const lieu = this.presence.lieuDe(ami, this.partie);

      if (lieu !== undefined) {
        presences.push({ pseudo, lieu });
      }
    }

    return presences;
  }

  /** L'ami de ce compte qui porte ce pseudo, quelle que soit son ecriture. */
  private amiNomme(compteId: string, pseudo: string): AmiConnu | undefined {
    const repere = reperePseudo(pseudo);

    for (const [ami, sonPseudo] of this.gardes.get(compteId)?.amis ?? []) {
      if (reperePseudo(sonPseudo) === repere) {
        return { compteId: ami, pseudo: sonPseudo };
      }
    }

    return undefined;
  }

  /** Dit aux pages de chaque invite que son invitation ne vaut plus. */
  private prevenirDuRetrait(invitations: readonly Invitation[]): void {
    for (const invitation of invitations) {
      this.envoyerAuCompte(invitation.pour, {
        nom: 'invitationRetiree',
        charge: { id: invitation.id },
      });
    }
  }

  /** Envoie ce message a chaque page ouverte de ce compte. */
  private envoyerAuCompte(compteId: string, message: MessageDesAmis): void {
    for (const idConnexion of this.presence.connexionsDe(compteId)) {
      this.envoyer(idConnexion, message);
    }
  }
}

/** Les amis lus, en pseudo par compte, dans leur ordre. */
function pseudosDe(amis: readonly AmiConnu[]): ReadonlyMap<string, string> {
  return new Map(amis.map((ami) => [ami.compteId, ami.pseudo]));
}

/** Les comptes des amis lus. */
function idsDe(amis: readonly AmiConnu[]): ReadonlySet<string> {
  return new Set(amis.map((ami) => ami.compteId));
}

/** Un refus a un seul motif. */
function refus<T>(champ: string, motif: string): ResultatValidation<T> {
  return { valide: false, erreurs: [{ champ, motif }] };
}
