/**
 * Le registre de presence (etape 2.8): quels comptes ont une page ouverte, et dans
 * quelle partie chacune se trouve.
 *
 * LA PRESENCE SE DEDUIT DES PAGES OUVERTES. Une page de compte ouvre une connexion, qui
 * entre dans une partie et en sort: ce registre suit ces trois faits, et rien d'autre.
 * Rien ne s'ecrit en base, et rien ne survit au processus. Un compte sans page ouverte
 * est hors ligne, y compris un joueur dont le lien est tombe en pleine partie et dont
 * la place attend (etape 2.5): il ne peut rien recevoir.
 *
 * CE QUE CE REGISTRE NE SAIT PAS: qui est ami de qui, et a qui montrer quoi. Il dit ou
 * se trouve un compte, sous la forme que ses amis liront (LieuDUnAmi). Qui le lit est
 * l'affaire de ReseauDesAmis.
 *
 * UNE PARTIE PRIVEE SE TAIT. Le lieu d'un compte dans une partie privee ne dit que
 * cela: ni identifiant, ni mode, ni code.
 *
 * AUCUN ETAT GLOBAL: un registre par couche reseau. Aucune horloge non plus: la
 * presence n'expire pas, elle suit les connexions.
 */

import type { LieuDUnAmi, PartieDUnAmi } from '@neon-ninja/shared';

import type { GameRoom } from '../GameRoom.js';

/** Ce que la presence lit d'une partie: une GameRoom, ou son equivalent dans un test. */
export type PartieObservee = Pick<
  GameRoom,
  'id' | 'statut' | 'visibilite' | 'mode' | 'capacite' | 'joueurs'
>;

/** Ce que le registre sait d'une connexion de compte. */
interface ConnexionSuivie {
  readonly compteId: string;
  /** La partie de cette connexion, s'il y en a une. */
  idRoom: string | undefined;
}

/** Le registre de presence d'une couche reseau. */
export class RegistreDePresence {
  private readonly connexions = new Map<string, ConnexionSuivie>();

  /** Les connexions ouvertes de chaque compte en ligne. */
  private readonly parCompte = new Map<string, Set<string>>();

  /**
   * Une page de ce compte vient d'ouvrir cette connexion.
   *
   * @returns Vrai si c'est sa premiere page ouverte: il vient d'apparaitre en ligne.
   */
  ouvrir(idConnexion: string, compteId: string): boolean {
    this.fermer(idConnexion);
    this.connexions.set(idConnexion, { compteId, idRoom: undefined });

    const existantes = this.parCompte.get(compteId);

    if (existantes !== undefined) {
      existantes.add(idConnexion);
      return false;
    }

    this.parCompte.set(compteId, new Set([idConnexion]));
    return true;
  }

  /**
   * Cette connexion vient de se fermer.
   *
   * @returns Le compte qui vient de passer hors ligne, si c'etait sa derniere page.
   */
  fermer(idConnexion: string): string | undefined {
    const suivie = this.connexions.get(idConnexion);

    if (suivie === undefined) {
      return undefined;
    }

    this.connexions.delete(idConnexion);

    const restantes = this.parCompte.get(suivie.compteId);
    restantes?.delete(idConnexion);

    if (restantes !== undefined && restantes.size > 0) {
      return undefined;
    }

    this.parCompte.delete(suivie.compteId);
    return suivie.compteId;
  }

  /**
   * Cette connexion vient d'entrer dans une partie, ou d'y revenir.
   *
   * @returns Le compte de la connexion, ou undefined pour une connexion d'invite.
   */
  entrer(idConnexion: string, idRoom: string): string | undefined {
    const suivie = this.connexions.get(idConnexion);

    if (suivie !== undefined) {
      suivie.idRoom = idRoom;
    }

    return suivie?.compteId;
  }

  /**
   * Cette connexion n'est plus dans une partie, et reste ouverte.
   *
   * @returns Le compte de la connexion, ou undefined pour une connexion d'invite.
   */
  sortir(idConnexion: string): string | undefined {
    const suivie = this.connexions.get(idConnexion);

    if (suivie !== undefined) {
      suivie.idRoom = undefined;
    }

    return suivie?.compteId;
  }

  /** Ce compte a-t-il au moins une page ouverte. */
  enLigne(compteId: string): boolean {
    return this.parCompte.has(compteId);
  }

  /** Les connexions ouvertes de ce compte. */
  connexionsDe(compteId: string): readonly string[] {
    return [...(this.parCompte.get(compteId) ?? [])];
  }

  /** Le compte de cette connexion, si elle est celle d'un compte. */
  compteDe(idConnexion: string): string | undefined {
    return this.connexions.get(idConnexion)?.compteId;
  }

  /** La partie de cette connexion, s'il y en a une. */
  partieDe(idConnexion: string): string | undefined {
    return this.connexions.get(idConnexion)?.idRoom;
  }

  /** Les comptes qui ont au moins une page dans cette partie. */
  comptesDans(idRoom: string): readonly string[] {
    const comptes = new Set<string>();

    for (const suivie of this.connexions.values()) {
      if (suivie.idRoom === idRoom) {
        comptes.add(suivie.compteId);
      }
    }

    return [...comptes];
  }

  /**
   * Ou se trouve ce compte, tel que ses amis le liront, ou undefined s'il est hors ligne.
   *
   * UN COMPTE A PLUSIEURS PAGES PREND L'ETAT LE PLUS ENGAGE: en partie, puis dans un
   * salon, puis en ligne. A engagement egal, la premiere page ouverte l'emporte.
   *
   * @param partie Retrouve une partie par son identifiant. Une partie disparue compte
   *   comme aucune partie.
   */
  lieuDe(
    compteId: string,
    partie: (idRoom: string) => PartieObservee | undefined,
  ): LieuDUnAmi | undefined {
    const connexions = this.parCompte.get(compteId);

    if (connexions === undefined) {
      return undefined;
    }

    let lieu: LieuDUnAmi = { etat: 'enLigne' };

    for (const idConnexion of connexions) {
      const idRoom = this.connexions.get(idConnexion)?.idRoom;
      const trouvee = idRoom === undefined ? undefined : partie(idRoom);
      const candidat: LieuDUnAmi = trouvee === undefined ? { etat: 'enLigne' } : lieuDans(trouvee);

      if (ENGAGEMENT[candidat.etat] > ENGAGEMENT[lieu.etat]) {
        lieu = candidat;
      }
    }

    return lieu;
  }

  /** Oublie toutes les connexions. */
  vider(): void {
    this.connexions.clear();
    this.parCompte.clear();
  }
}

/** L'ordre d'engagement des etats: le plus engage l'emporte. */
const ENGAGEMENT: Readonly<Record<LieuDUnAmi['etat'], number>> = {
  enLigne: 0,
  salon: 1,
  enPartie: 2,
};

/**
 * Le lieu d'un compte dans cette partie. Une partie terminee compte comme en ligne:
 * son ecran de fin n'empeche pas de repondre.
 */
export function lieuDans(partie: PartieObservee): LieuDUnAmi {
  switch (partie.statut) {
    case 'salon':
      return { etat: 'salon', partie: partieDUnAmi(partie) };
    case 'enCours':
      return { etat: 'enPartie', partie: partieDUnAmi(partie) };
    case 'terminee':
      return { etat: 'enLigne' };
  }
}

/** Ce que les amis voient d'une partie: tout d'une publique, rien d'une privee. */
export function partieDUnAmi(partie: PartieObservee): PartieDUnAmi {
  return partie.visibilite === 'privee'
    ? { visibilite: 'privee' }
    : {
        visibilite: 'publique',
        idRoom: partie.id,
        mode: partie.mode,
        joueurs: partie.joueurs.length,
        capacite: partie.capacite,
      };
}
