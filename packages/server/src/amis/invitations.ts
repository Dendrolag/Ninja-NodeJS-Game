/**
 * Le registre des invitations entre amis (etape 2.8): les droits d'entree que le
 * serveur tient, et leurs delais.
 *
 * UNE INVITATION EST UN DROIT D'ENTREE, PAS UN CODE. Elle lie un compte qui invite, un
 * compte invite et une partie, sous un identifiant tire du generateur cryptographique,
 * de la forme d'un jeton de session. L'invite presente cet identifiant pour entrer:
 * rien de la partie ne lui a ete montre, ni son code, ni son identifiant. Le droit ne
 * vaut que pour lui.
 *
 * DEUX MINUTES, ET UNE SEULE PAR AMI. Le droit expire de lui-meme au bout de sa
 * validite, compte sur l'horloge injectee. Une invitation nouvelle du meme inviteur au
 * meme invite remplace la precedente, et on n'invite pas le meme ami plus d'une fois
 * par minute (BORNES_INVITATIONS).
 *
 * CE QUE CE REGISTRE NE SAIT PAS: qui est ami de qui, qui est en ligne, ce que vaut une
 * partie. Il tient les droits, compte leurs delais et previent de leur expiration.
 * Les autres retraits (droit servi, partie finie, inviteur parti, amitie rompue) sont
 * decides par ReseauDesAmis, qui les demande ici.
 *
 * AUCUN ETAT GLOBAL: un registre par couche reseau.
 */

import type { InvitationRecue, ResultatValidation } from '@neon-ninja/shared';
import { BORNES_INVITATIONS } from '@neon-ninja/shared';

import { fabriquerJeton } from '../comptes/jetons.js';
import type { Horloge } from '../horloge.js';

/** Une invitation tenue: qui invite qui, dans quelle partie, et ce que l'invite en lit. */
export interface Invitation {
  readonly id: string;
  /** Le compte qui invite. */
  readonly de: string;
  /** Le compte invite. */
  readonly pour: string;
  readonly idRoom: string;
  /** Ce que les pages de l'invite recoivent, identifiant compris. */
  readonly recue: InvitationRecue;
}

/** Une invitation emise, et celle qu'elle remplace, s'il y en avait une. */
export interface Emission {
  readonly invitation: Invitation;
  readonly remplacee: Invitation | undefined;
}

/** Ce qu'il faut pour tenir un registre. */
export interface OptionsRegistreDesInvitations {
  /** L'horloge sur laquelle se comptent les delais. */
  readonly horloge: Horloge;
  /** Ce que vaut un droit d'entree, en millisecondes. BORNES_INVITATIONS par defaut. */
  readonly validiteMs?: number;
  /** Le temps minimal entre deux invitations au meme ami. BORNES_INVITATIONS par defaut. */
  readonly intervalleParAmiMs?: number;
  /** Comment tirer un identifiant. Le generateur cryptographique par defaut. */
  readonly tirerIdentifiant?: () => string;
  /** Previent d'une invitation qui vient d'expirer, deja retiree du registre. */
  readonly surExpiration: (invitation: Invitation) => void;
}

/** Le motif d'une invitation au meme ami trop tot apres la precedente. */
export const INVITATION_TROP_TOT =
  'Vous avez invité ce compte il y a moins d’une minute. Laissez-lui le temps de répondre.';

/** Une invitation tenue, avec de quoi arreter son delai. */
interface InvitationTenue extends Invitation {
  readonly arreterLeDelai: () => void;
}

/** Le registre des invitations d'une couche reseau. */
export class RegistreDesInvitations {
  private readonly horloge: Horloge;
  private readonly validiteMs: number;
  private readonly intervalleParAmiMs: number;
  private readonly tirerIdentifiant: () => string;
  private readonly surExpiration: (invitation: Invitation) => void;

  /** Les invitations en vigueur, par identifiant. */
  private readonly parId = new Map<string, InvitationTenue>();

  /** L'instant de la derniere invitation de chaque paire, inviteur puis invite. */
  private readonly dernieres = new Map<string, number>();

  constructor(options: OptionsRegistreDesInvitations) {
    this.horloge = options.horloge;
    this.validiteMs = options.validiteMs ?? BORNES_INVITATIONS.validiteMs;
    this.intervalleParAmiMs = options.intervalleParAmiMs ?? BORNES_INVITATIONS.intervalleParAmiMs;
    this.tirerIdentifiant = options.tirerIdentifiant ?? fabriquerJeton;
    this.surExpiration = options.surExpiration;
  }

  /** Le nombre d'invitations en vigueur. */
  get nombre(): number {
    return this.parId.size;
  }

  /**
   * Emet une invitation de ce compte a celui-la, dans cette partie.
   *
   * Refusee si ce meme inviteur a invite ce meme compte il y a moins que l'intervalle,
   * quelle que soit la partie. Acceptee, elle remplace celle qu'il lui avait faite.
   *
   * @param description Ce que l'invite lira de la partie, sans l'identifiant, qui est
   *   tire ici.
   */
  emettre(
    de: string,
    pour: string,
    idRoom: string,
    description: Omit<InvitationRecue, 'id'>,
  ): ResultatValidation<Emission> {
    const maintenant = this.horloge.maintenant();
    this.oublierLesAnciennes(maintenant);

    const cle = paire(de, pour);
    const derniere = this.dernieres.get(cle);

    if (derniere !== undefined && maintenant - derniere < this.intervalleParAmiMs) {
      return { valide: false, erreurs: [{ champ: 'invitation', motif: INVITATION_TROP_TOT }] };
    }

    const remplacee = this.trouver(
      (invitation) => invitation.de === de && invitation.pour === pour,
    );

    if (remplacee !== undefined) {
      this.retirer(remplacee.id);
    }

    const id = this.tirerIdentifiant();
    const invitation: Invitation = { id, de, pour, idRoom, recue: { id, ...description } };
    const arreter = this.horloge.repeter(() => {
      arreter();

      if (this.parId.get(id)?.arreterLeDelai === arreter) {
        this.parId.delete(id);
        this.surExpiration(invitation);
      }
    }, this.validiteMs);

    this.parId.set(id, { ...invitation, arreterLeDelai: arreter });
    this.dernieres.set(cle, maintenant);

    return { valide: true, valeur: { invitation, remplacee } };
  }

  /** L'invitation de cet identifiant, si elle est en vigueur et adressee a ce compte. */
  valable(id: string, pour: string | undefined): Invitation | undefined {
    const invitation = this.parId.get(id);

    return invitation !== undefined && pour !== undefined && invitation.pour === pour
      ? decrire(invitation)
      : undefined;
  }

  /** Retire cette invitation, et la rend si elle etait en vigueur. */
  retirer(id: string): Invitation | undefined {
    const invitation = this.parId.get(id);

    if (invitation === undefined) {
      return undefined;
    }

    invitation.arreterLeDelai();
    this.parId.delete(id);

    return decrire(invitation);
  }

  /** Retire les invitations qui satisfont ce critere, et les rend. */
  retirerSi(critere: (invitation: Invitation) => boolean): readonly Invitation[] {
    const retirees: Invitation[] = [];

    for (const invitation of [...this.parId.values()]) {
      if (critere(invitation)) {
        const retiree = this.retirer(invitation.id);

        if (retiree !== undefined) {
          retirees.push(retiree);
        }
      }
    }

    return retirees;
  }

  /** Les invitations en vigueur adressees a ce compte, de la plus ancienne a la plus recente. */
  enAttentePour(compteId: string): readonly Invitation[] {
    return [...this.parId.values()]
      .filter((invitation) => invitation.pour === compteId)
      .map(decrire);
  }

  /** Y a-t-il une invitation en vigueur entre ces deux comptes, dans un sens ou l'autre. */
  existeEntre(a: string, b: string): boolean {
    return (
      this.trouver(
        (invitation) =>
          (invitation.de === a && invitation.pour === b) ||
          (invitation.de === b && invitation.pour === a),
      ) !== undefined
    );
  }

  /** Arrete tous les delais et oublie tout, sans prevenir personne. */
  fermer(): void {
    for (const invitation of this.parId.values()) {
      invitation.arreterLeDelai();
    }

    this.parId.clear();
    this.dernieres.clear();
  }

  /** La premiere invitation en vigueur qui satisfait ce critere. */
  private trouver(critere: (invitation: Invitation) => boolean): Invitation | undefined {
    for (const invitation of this.parId.values()) {
      if (critere(invitation)) {
        return invitation;
      }
    }

    return undefined;
  }

  /** Oublie les instants d'invitation trop anciens pour limiter quoi que ce soit. */
  private oublierLesAnciennes(maintenant: number): void {
    for (const [cle, instant] of this.dernieres) {
      if (maintenant - instant >= this.intervalleParAmiMs) {
        this.dernieres.delete(cle);
      }
    }
  }
}

/** La cle d'une paire dirigee de comptes. */
function paire(de: string, pour: string): string {
  return `${de}|${pour}`;
}

/** Une invitation tenue, sans ce qui ne sert qu'au registre. */
function decrire(invitation: InvitationTenue): Invitation {
  const { id, de, pour, idRoom, recue } = invitation;

  return { id, de, pour, idRoom, recue };
}
