/**
 * Les places des joueurs dans leurs parties: qui joue par quelle connexion, et
 * comment revenir apres une coupure (etape 2.5).
 *
 * POURQUOI CE REGISTRE EXISTE. Jusqu'a l'etape 2.5, un joueur ETAIT sa connexion:
 * son identifiant dans la partie etait celui de la socket, et la socket fermee, il
 * sortait de la partie. Un rechargement de page coutait donc la partie. Ici la
 * place d'un joueur survit a sa connexion: le joueur garde l'identifiant de la
 * connexion par laquelle il est entre, et ce registre dit quelle connexion joue
 * cette place maintenant, s'il y en a une.
 *
 * UN JETON DE RETOUR PAR PLACE, SECRET ET RENOUVELE. Il est tire du generateur
 * cryptographique a l'entree en partie, et remis a la seule connexion qui entre.
 * Revenir, c'est le presenter. Il change a chaque retour: un jeton deja servi, lu
 * dans un historique ou une capture d'ecran, ne rouvre plus rien.
 *
 * UNE PLACE NE SE REPREND QUE PAR LA MEME IDENTITE. Le jeton fait preuve, mais pas
 * a lui seul: une place de compte ne se reprend que depuis une connexion de ce
 * compte, et une place d'invite que depuis une connexion d'invite. Un jeton vole ne
 * sert donc pas a jouer sous le compte d'un autre, ni un compte a reprendre la
 * partie d'un invite. Le refus ne dit pas lequel de ces cas s'applique.
 *
 * CE QUE CE REGISTRE NE SAIT PAS: ni ce qu'est une partie en cours, ni ce qu'il
 * faut faire d'un joueur dont le delai est ecoule. La couche reseau decide quand
 * suspendre une place plutot que la liberer, et ce que devient le joueur a
 * l'expiration. Le registre garde les places, compte les delais sur l'horloge
 * injectee, et previent.
 *
 * AUCUN ETAT GLOBAL: un registre par couche reseau.
 */

import type { ResultatValidation, SessionJoueur } from '@neon-ninja/shared';
import { DELAI_DE_RETOUR_MS } from '@neon-ninja/shared';

import { fabriquerJeton } from './comptes/jetons.js';
import type { Horloge } from './horloge.js';

/** La place d'un joueur, telle que le registre la decrit. */
export interface Place {
  /** La partie de cette place. */
  readonly idRoom: string;
  /** L'identite du joueur, etablie a son entree, et son identifiant dans la partie. */
  readonly session: SessionJoueur;
  /** La connexion qui joue cette place. Absente pendant une coupure. */
  readonly connexion: string | undefined;
  /** Le jeton qui permet de reprendre cette place. */
  readonly jetonDeRetour: string;
}

/** Une place reprise, et la connexion qui la tenait encore, s'il y en avait une. */
export interface Reprise {
  readonly place: Place;
  /**
   * La connexion a qui la place vient d'etre reprise.
   *
   * Presente quand le serveur n'avait pas encore constate la fin de l'ancienne
   * connexion: apres un rechargement, ou une coupure silencieuse. Elle n'est plus
   * dans la partie, et la couche reseau doit l'en detacher.
   */
  readonly connexionRemplacee: string | undefined;
}

/** Ce qu'il faut pour tenir un registre. */
export interface OptionsRegistreDesPlaces {
  /** L'horloge sur laquelle se comptent les delais de retour. */
  readonly horloge: Horloge;
  /** Combien de temps garder une place suspendue. DELAI_DE_RETOUR_MS par defaut. */
  readonly delaiDeRetourMs?: number;
  /** Comment tirer un jeton de retour. Le generateur cryptographique par defaut. */
  readonly tirerJeton?: () => string;
}

/** Le motif unique de tout retour refuse: il ne dit pas pourquoi. */
export const RETOUR_REFUSE = "Votre place dans cette partie n'a pas été gardée.";

/** Une place, telle que le registre la tient. */
interface PlaceTenue {
  readonly idRoom: string;
  readonly session: SessionJoueur;
  connexion: string | undefined;
  jetonDeRetour: string;
  /** De quoi arreter le delai de retour, pendant une coupure. */
  arreterLeDelai: (() => void) | undefined;
}

/** Le registre des places d'une couche reseau. */
export class RegistreDesPlaces {
  private readonly horloge: Horloge;
  private readonly delaiDeRetourMs: number;
  private readonly tirerJeton: () => string;

  /** Les places, par identifiant de joueur. */
  private readonly places = new Map<string, PlaceTenue>();

  /** L'identifiant du joueur de chaque jeton en vigueur. */
  private readonly parJeton = new Map<string, string>();

  /** L'identifiant du joueur que joue chaque connexion. */
  private readonly parConnexion = new Map<string, string>();

  constructor(options: OptionsRegistreDesPlaces) {
    this.horloge = options.horloge;
    this.delaiDeRetourMs = options.delaiDeRetourMs ?? DELAI_DE_RETOUR_MS;
    this.tirerJeton = options.tirerJeton ?? fabriquerJeton;
  }

  /** Le nombre de places tenues, suspendues comprises. */
  get nombreDePlaces(): number {
    return this.places.size;
  }

  /**
   * Donne sa place a un joueur qui vient d'entrer par cette connexion.
   *
   * L'identifiant du joueur est celui de sa session. Une place deja tenue sous cet
   * identifiant est d'abord liberee: il ne peut y en avoir qu'une.
   */
  attribuer(idRoom: string, session: SessionJoueur, idConnexion: string): Place {
    this.liberer(session.id);

    const place: PlaceTenue = {
      idRoom,
      session,
      connexion: idConnexion,
      jetonDeRetour: this.jetonNeuf(),
      arreterLeDelai: undefined,
    };

    this.places.set(session.id, place);
    this.parJeton.set(place.jetonDeRetour, session.id);
    this.parConnexion.set(idConnexion, session.id);

    return decrire(place);
  }

  /** La place que joue cette connexion, s'il y en a une. */
  placeDeLaConnexion(idConnexion: string): Place | undefined {
    const idJoueur = this.parConnexion.get(idConnexion);
    const place = idJoueur === undefined ? undefined : this.places.get(idJoueur);

    return place === undefined ? undefined : decrire(place);
  }

  /** La connexion qui joue la place de ce joueur. Aucune pendant une coupure. */
  connexionDuJoueur(idJoueur: string): string | undefined {
    return this.places.get(idJoueur)?.connexion;
  }

  /**
   * Suspend la place de ce joueur: sa connexion est partie, la place attend son retour.
   *
   * Au bout du delai de retour, la place est liberee, puis surExpiration est appele
   * avec ce qu'elle etait: c'est a l'appelant de faire sortir le joueur. Sans effet
   * sur une place deja suspendue, ou sur un joueur sans place.
   */
  suspendre(idJoueur: string, surExpiration: (place: Place) => void): void {
    const place = this.places.get(idJoueur);

    if (place?.connexion === undefined) {
      return;
    }

    this.parConnexion.delete(place.connexion);
    place.connexion = undefined;

    const arreter = this.horloge.repeter(() => {
      arreter();

      if (this.places.get(idJoueur) !== place) {
        return;
      }

      const description = decrire(place);
      this.liberer(idJoueur);
      surExpiration(description);
    }, this.delaiDeRetourMs);

    place.arreterLeDelai = arreter;
  }

  /**
   * La place que ce jeton de retour ouvre a cette identite, sans rien y changer.
   *
   * La place doit exister, et son identite doit etre celle de la connexion qui la
   * demande: le meme compte, ou un invite pour un invite. Le refus est le meme dans
   * tous les cas.
   *
   * @param compteId Le compte de la connexion qui revient. Absent: un invite.
   */
  verifier(jeton: string, compteId: string | undefined): ResultatValidation<Place> {
    const idJoueur = this.parJeton.get(jeton);
    const place = idJoueur === undefined ? undefined : this.places.get(idJoueur);

    if (place === undefined || place.session.compte?.id !== compteId) {
      return { valide: false, erreurs: [{ champ: 'retour', motif: RETOUR_REFUSE }] };
    }

    return { valide: true, valeur: decrire(place) };
  }

  /**
   * Fait jouer la place de ce joueur par cette connexion.
   *
   * A appeler une fois le retour verifie et admis. La place recoit un jeton neuf,
   * son delai s'arrete, et la connexion qui la tenait encore, s'il y en avait une,
   * n'y est plus attachee.
   *
   * @throws Si ce joueur n'a pas de place: l'appelant vient de la verifier.
   */
  reprendre(idJoueur: string, idConnexion: string): Reprise {
    const place = this.places.get(idJoueur);

    if (place === undefined) {
      throw new Error(`Aucune place a reprendre pour le joueur ${idJoueur}.`);
    }

    const connexionRemplacee = place.connexion;

    if (connexionRemplacee !== undefined) {
      this.parConnexion.delete(connexionRemplacee);
    }

    place.arreterLeDelai?.();
    place.arreterLeDelai = undefined;

    this.parJeton.delete(place.jetonDeRetour);
    place.jetonDeRetour = this.jetonNeuf();
    this.parJeton.set(place.jetonDeRetour, idJoueur);

    place.connexion = idConnexion;
    this.parConnexion.set(idConnexion, idJoueur);

    return { place: decrire(place), connexionRemplacee };
  }

  /** Oublie la place de ce joueur, et son delai s'il en avait un. Sans effet s'il n'en a pas. */
  liberer(idJoueur: string): void {
    const place = this.places.get(idJoueur);

    if (place === undefined) {
      return;
    }

    place.arreterLeDelai?.();
    this.places.delete(idJoueur);
    this.parJeton.delete(place.jetonDeRetour);

    if (place.connexion !== undefined) {
      this.parConnexion.delete(place.connexion);
    }
  }

  /** Oublie toutes les places et arrete tous les delais: plus rien n'expirera. */
  fermer(): void {
    for (const idJoueur of [...this.places.keys()]) {
      this.liberer(idJoueur);
    }
  }

  /**
   * Un jeton qu'aucune place ne porte.
   *
   * Deux cent cinquante-six bits de hasard ne se rencontrent pas deux fois; la
   * verification ne coute rien, et protege d'un tirage defaillant.
   */
  private jetonNeuf(): string {
    for (;;) {
      const jeton = this.tirerJeton();

      if (!this.parJeton.has(jeton)) {
        return jeton;
      }
    }
  }
}

/** Ce qu'une place tenue montre d'elle-meme: une copie, que l'appelant ne peut pas modifier. */
function decrire(place: PlaceTenue): Place {
  return {
    idRoom: place.idRoom,
    session: place.session,
    connexion: place.connexion,
    jetonDeRetour: place.jetonDeRetour,
  };
}
