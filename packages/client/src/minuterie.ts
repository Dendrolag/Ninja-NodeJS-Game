/**
 * La minuterie du client: rappeler une fonction apres un delai (etape 5.3).
 *
 * POURQUOI ELLE EXISTE. Jusqu'a l'etape 5.3, le client n'avait rien a planifier:
 * sa boucle de rendu est cadencee par le navigateur (horloge.ts). En production, le
 * serveur de jeu gratuit s'endort faute de trafic, et la page qui l'appelle doit
 * reessayer d'elle-meme quelques secondes plus tard, le temps qu'il se reveille
 * (reveil.ts). C'est le seul rappel differe du client.
 *
 * POURQUOI INJECTEE. Pour la raison de l'horloge: un rappel qui lit la vraie
 * minuterie ne se teste qu'en attendant. Un test donne au client une minuterie
 * manuelle, et verifie en une milliseconde ce qui prendrait une minute et demie.
 */

/** Ce qui annule un rappel planifie. Sans effet sur un rappel deja parti. */
export type Annulation = () => void;

/** Ce que le client attend d'une minuterie: rappeler plus tard, et pouvoir y renoncer. */
export interface Minuterie {
  /**
   * Planifie un rappel.
   *
   * @param delaiMs Le delai, en millisecondes.
   * @param rappel  Ce qui sera appele une fois le delai ecoule.
   * @returns De quoi annuler le rappel avant son depart.
   */
  planifier(delaiMs: number, rappel: () => void): Annulation;
}

/** La minuterie du navigateur: celle de la production. */
export const minuterieNavigateur: Minuterie = {
  planifier: (delaiMs, rappel) => {
    const minuteur = globalThis.setTimeout(rappel, delaiMs);

    return () => {
      globalThis.clearTimeout(minuteur);
    };
  },
};

/** Une minuterie que l'on fait avancer a la main. Pour les tests, et pour eux seuls. */
export interface MinuterieManuelle extends Minuterie {
  /** Fait passer le temps, et appelle dans l'ordre les rappels arrives a echeance. */
  avancerDe(dtMs: number): void;
  /** Le nombre de rappels planifies qui ne sont pas encore partis. */
  readonly enAttente: number;
}

/** Un rappel en attente dans la minuterie manuelle. */
interface RappelPlanifie {
  readonly echeance: number;
  readonly rappel: () => void;
}

/** Cree une minuterie arretee, que le test fait avancer lui-meme. */
export function creerMinuterieManuelle(): MinuterieManuelle {
  let instant = 0;
  let numeroSuivant = 0;
  const attentes = new Map<number, RappelPlanifie>();

  /** Le rappel le plus tot arrive a echeance avant cette limite, a egalite le premier planifie. */
  const prochainAvant = (limite: number): [number, RappelPlanifie] | undefined => {
    let prochain: [number, RappelPlanifie] | undefined;

    for (const entree of attentes) {
      if (
        entree[1].echeance <= limite &&
        (prochain === undefined || entree[1].echeance < prochain[1].echeance)
      ) {
        prochain = entree;
      }
    }

    return prochain;
  };

  return {
    get enAttente() {
      return attentes.size;
    },

    planifier: (delaiMs, rappel) => {
      const numero = numeroSuivant;
      numeroSuivant += 1;
      attentes.set(numero, { echeance: instant + Math.max(0, delaiMs), rappel });

      return () => {
        attentes.delete(numero);
      };
    },

    avancerDe: (dtMs) => {
      if (!Number.isFinite(dtMs) || dtMs < 0) {
        throw new Error(
          `Une minuterie ne peut avancer que d'un temps positif, recu ${String(dtMs)}.`,
        );
      }

      const fin = instant + dtMs;

      // Un rappel peut en planifier un autre: s'il arrive a echeance avant la fin,
      // il part dans le meme avancement, comme il le ferait avec le vrai temps.
      for (
        let prochain = prochainAvant(fin);
        prochain !== undefined;
        prochain = prochainAvant(fin)
      ) {
        attentes.delete(prochain[0]);
        instant = prochain[1].echeance;
        prochain[1].rappel();
      }

      instant = fin;
    },
  };
}
