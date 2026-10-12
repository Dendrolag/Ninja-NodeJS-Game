/**
 * Le journal de la surveillance: une ligne JSON par fait notable, sur la sortie standard
 * (etape 5.15).
 *
 * LES METRIQUES DISENT QU'IL Y A UN PROBLEME, LE JOURNAL DIT LEQUEL. Une metrique n'a que
 * des etiquettes bornees: elle dit que des images lentes arrivent sur les telephones en
 * Horde, pas lesquelles. Le detail d'un episode, la partie, le joueur et tout son contexte,
 * va ici, en une ligne JSON que l'agent de la machine suit et envoie a Grafana Cloud.
 *
 * LE SERVEUR N'ENVOIE RIEN LUI-MEME. Il ecrit sur sa sortie standard, que Docker garde; si
 * l'agent ou Grafana tombent, le jeu ne le sait pas.
 *
 * LE DEBIT EST PLAFONNE (PlafondDesEpisodes): un serveur qui peine ne doit pas, en plus,
 * se mettre a ecrire des milliers de lignes par minute.
 */

/** Ou s'ecrivent les lignes du journal. */
export interface Journal {
  ecrire(ligne: Readonly<Record<string, unknown>>): void;
}

/** Le journal du serveur reel: une ligne JSON par ecriture, sur la sortie standard. */
export const journalSurLaSortie: Journal = {
  ecrire(ligne) {
    process.stdout.write(`${JSON.stringify(ligne)}\n`);
  },
};

/** Un journal qui garde ses lignes en memoire, pour les tests. */
export interface JournalEnMemoire extends Journal {
  readonly lignes: Readonly<Record<string, unknown>>[];
}

/** Cree un journal qui garde ses lignes en memoire. */
export function creerJournalEnMemoire(): JournalEnMemoire {
  const lignes: Readonly<Record<string, unknown>>[] = [];

  return {
    lignes,
    ecrire(ligne) {
      lignes.push(ligne);
    },
  };
}

/** La fenetre du plafond, en millisecondes: une minute. */
const FENETRE_MS = 60_000;

/**
 * Le plafond des episodes: au plus un par cle et par minute, et un total par minute.
 *
 * Une cle est une partie, pour les episodes du serveur, ou une connexion, pour ceux de la
 * page. Le total se tient dans un tableau tournant des instants acceptes: un episode passe
 * si le plus ancien des derniers acceptes a plus d'une minute. Ce qui est refuse n'est que
 * compte, par l'appelant.
 */
export class PlafondDesEpisodes {
  private readonly derniers = new Map<string, number>();
  private readonly acceptes: Float64Array;
  private suivant = 0;

  /**
   * @param totalParMinute Combien d'episodes au plus par minute, toutes cles confondues.
   */
  constructor(totalParMinute = 60) {
    this.acceptes = new Float64Array(totalParMinute).fill(Number.NEGATIVE_INFINITY);
  }

  /**
   * Cet episode peut-il s'ecrire maintenant. Si oui, il est retenu.
   *
   * @param cle La partie ou la connexion de l'episode.
   * @param maintenant L'instant, en millisecondes.
   */
  accepter(cle: string, maintenant: number): boolean {
    const dernier = this.derniers.get(cle);

    if (dernier !== undefined && maintenant - dernier < FENETRE_MS) {
      return false;
    }

    if (maintenant - (this.acceptes[this.suivant] ?? 0) < FENETRE_MS) {
      return false;
    }

    this.acceptes[this.suivant] = maintenant;
    this.suivant = (this.suivant + 1) % this.acceptes.length;
    this.derniers.set(cle, maintenant);
    this.oublierLesAnciens(maintenant);

    return true;
  }

  /** Oublie les cles dont le dernier episode a plus d'une minute: elles ne bornent plus rien. */
  private oublierLesAnciens(maintenant: number): void {
    if (this.derniers.size <= this.acceptes.length * 2) {
      return;
    }

    for (const [cle, instant] of this.derniers) {
      if (maintenant - instant >= FENETRE_MS) {
        this.derniers.delete(cle);
      }
    }
  }
}
