/**
 * Les traces de pas du mode Massacre (etape 7.4): un joueur qui marche dans le sang frais
 * l'emporte sous ses pieds, et laisse une dizaine d'empreintes de plus en plus pales.
 *
 * C'EST UN SUIVI, DONC UN ETAT, MAIS PAS UN OBJET VIVANT. La boucle de rendu garde l'etat
 * d'une image a l'autre et le passe a avancerLesPas, qui rend le suivant et les empreintes a
 * imprimer. Rien n'est modifie sur place, rien ne lit l'horloge: la fonction se teste comme
 * les autres, en lui donnant des positions et des instants.
 *
 * CE QUI SE VOIT CHEZ CHACUN. Les traces se decident dans la page, d'apres les positions
 * affichees. Deux joueurs qui regardent la meme partie voient les memes pas aux memes
 * endroits a quelques pixels pres: c'est du decor, le jeu n'en depend pas.
 */

/** Une tache de sang posee sur le sol, qui charge les pieds de qui marche dedans. */
export interface SangAuSol {
  readonly x: number;
  readonly y: number;
  /** Instant local ou elle est apparue. */
  readonly instant: number;
}

/** Un joueur affiche, tel que le suivi a besoin de le voir. */
export interface Marcheur {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

/** Ce que le suivi retient d'un joueur. */
interface PiedsDUnJoueur {
  /** Les pas qu'il lui reste a imprimer. Zero: ses pieds sont secs. */
  readonly pasRestants: number;
  /** Ou il a imprime son dernier pas, ou ou il se trouvait quand ses pieds ont seche. */
  readonly dernierX: number;
  readonly dernierY: number;
  /** Le pied du prochain pas: gauche, puis droit. */
  readonly gauche: boolean;
}

/** L'etat du suivi: les pieds de chaque joueur. */
export type SuiviDesPas = ReadonlyMap<string, PiedsDUnJoueur>;

/** Un suivi qui n'a encore rien vu. */
export const AUCUN_PAS: SuiviDesPas = new Map();

/** Une empreinte a imprimer au sol. */
export interface Pas {
  /** Identifiant unique, pour que le rendu ne l'imprime qu'une fois. */
  readonly id: string;
  readonly x: number;
  readonly y: number;
  /** La direction de la marche, en radians. */
  readonly angle: number;
  /** De zero a un: le premier pas est le plus rouge. */
  readonly opacite: number;
}

/** Les nombres des traces de pas. Du reglage d'apparence, pas du jeu. */
export const TRACES = {
  /** Combien de pas un passage dans le sang laisse. */
  pasParPassage: 10,
  /** A quelle distance d'une tache on marche dedans, en pixels de carte. */
  rayonDeLaTachePx: 22,
  /** Pendant combien de temps une tache reste assez fraiche pour coller aux pieds. */
  fraicheurMs: 30_000,
  /** La longueur d'un pas, en pixels de carte. */
  longueurDuPasPx: 18,
  /** L'ecart entre le pied gauche et le pied droit, de chaque cote de la marche. */
  ecartDesPiedsPx: 4,
  /** L'opacite du premier pas, puis celle du dernier. */
  opaciteDuPremier: 0.8,
  opaciteDuDernier: 0.15,
} as const;

/**
 * Fait avancer le suivi d'une image.
 *
 * Un joueur qui passe sur une tache fraiche recharge ses pieds. Un joueur aux pieds
 * charges imprime un pas chaque fois qu'il a parcouru la longueur d'un pas, du pied gauche
 * puis du droit, et ses pieds se vident. Un joueur qui n'est plus affiche sort du suivi.
 *
 * @param suivi      L'etat laisse par l'image precedente.
 * @param marcheurs  Les joueurs affiches, a leur position lissee.
 * @param sang       Les taches posees au sol.
 * @param maintenant Instant local.
 */
export function avancerLesPas(
  suivi: SuiviDesPas,
  marcheurs: readonly Marcheur[],
  sang: readonly SangAuSol[],
  maintenant: number,
): { readonly suivi: SuiviDesPas; readonly pas: readonly Pas[] } {
  const suivant = new Map<string, PiedsDUnJoueur>();
  const pas: Pas[] = [];
  const frais = sang.filter((tache) => maintenant - tache.instant <= TRACES.fraicheurMs);

  for (const marcheur of marcheurs) {
    const avant = suivi.get(marcheur.id);
    const dansLeSang = frais.some(
      (tache) => Math.hypot(tache.x - marcheur.x, tache.y - marcheur.y) <= TRACES.rayonDeLaTachePx,
    );
    let pieds: PiedsDUnJoueur =
      avant === undefined
        ? { pasRestants: 0, dernierX: marcheur.x, dernierY: marcheur.y, gauche: true }
        : avant;

    if (dansLeSang) {
      pieds = { ...pieds, pasRestants: TRACES.pasParPassage };
    }

    const dx = marcheur.x - pieds.dernierX;
    const dy = marcheur.y - pieds.dernierY;
    const parcouru = Math.hypot(dx, dy);

    if (pieds.pasRestants === 0) {
      // Pieds secs: on suit seulement ou il est, pour mesurer son prochain pas.
      pieds = { ...pieds, dernierX: marcheur.x, dernierY: marcheur.y };
    } else if (parcouru >= TRACES.longueurDuPasPx) {
      const angle = Math.atan2(dy, dx);
      const cote = pieds.gauche ? -1 : 1;
      const faits = TRACES.pasParPassage - pieds.pasRestants;
      const opacite =
        TRACES.opaciteDuPremier -
        ((TRACES.opaciteDuPremier - TRACES.opaciteDuDernier) * faits) /
          Math.max(TRACES.pasParPassage - 1, 1);

      pas.push({
        id: `pas:${marcheur.id}:${String(Math.round(maintenant))}`,
        x: marcheur.x + Math.cos(angle + Math.PI / 2) * TRACES.ecartDesPiedsPx * cote,
        y: marcheur.y + Math.sin(angle + Math.PI / 2) * TRACES.ecartDesPiedsPx * cote,
        angle,
        opacite,
      });
      pieds = {
        pasRestants: pieds.pasRestants - 1,
        dernierX: marcheur.x,
        dernierY: marcheur.y,
        gauche: !pieds.gauche,
      };
    }

    suivant.set(marcheur.id, pieds);
  }

  return { suivi: suivant, pas };
}
