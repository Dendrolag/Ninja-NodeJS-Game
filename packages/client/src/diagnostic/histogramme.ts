/**
 * Un histogramme de durées: ce qui décrit une saccade, là où une moyenne la cache (étape 8.5).
 *
 * « 55 images par seconde en moyenne » ne dit rien d'une image de 200 millisecondes
 * perdue parmi cent autres. Ce qu'il faut, c'est la répartition: le neuvième décile, le
 * centile 99, et le compte des durées au-delà d'un seuil.
 *
 * TAILLE FIXE, AUCUNE ALLOCATION. Chaque durée tombe dans une case d'un dixième de
 * milliseconde, jusqu'à deux secondes; au-delà, dans la dernière. Garder chaque durée
 * pour la trier ensuite ferait grossir la mémoire au fil de la partie, et le relevé
 * fabriquerait alors les saccades du ramasse-miettes qu'il est censé chercher. Un
 * centile se lit donc à un dixième de milliseconde près, par excès.
 */

/** Le nombre de cases par milliseconde: une case vaut un dixième de milliseconde. */
const CASES_PAR_MS = 10;

/** Le nombre de cases: deux secondes, la dernière reçoit tout ce qui dépasse. */
const CASES = 20_000;

/** Une répartition de durées, remplie au fil de l'eau. */
export class Histogramme {
  private readonly cases = new Uint32Array(CASES);
  private compte = 0;
  private somme = 0;
  private plusLongue = 0;

  /** Range une durée, en millisecondes. Une durée négative ou illisible est ignorée. */
  ajouter(dureeMs: number): void {
    if (!Number.isFinite(dureeMs) || dureeMs < 0) {
      return;
    }

    const rang = Math.min(Math.floor(dureeMs * CASES_PAR_MS), CASES - 1);
    this.cases[rang] = (this.cases[rang] ?? 0) + 1;
    this.compte += 1;
    this.somme += dureeMs;
    this.plusLongue = Math.max(this.plusLongue, dureeMs);
  }

  /** Oublie tout. */
  vider(): void {
    this.cases.fill(0);
    this.compte = 0;
    this.somme = 0;
    this.plusLongue = 0;
  }

  /** Le nombre de durées rangées. */
  get total(): number {
    return this.compte;
  }

  /** La moyenne, ou zéro sans aucune durée. */
  get moyenne(): number {
    return this.compte === 0 ? 0 : this.somme / this.compte;
  }

  /** La plus longue durée rangée, exacte. */
  get maximum(): number {
    return this.plusLongue;
  }

  /**
   * La durée sous laquelle tombe cette part des durées, arrondie au dixième par excès.
   *
   * @param part Entre zéro et un: 0,9 pour le neuvième décile, 0,99 pour le centile 99.
   * @returns Zéro sans aucune durée; jamais plus que la plus longue.
   */
  centile(part: number): number {
    if (this.compte === 0) {
      return 0;
    }

    const rangVise = Math.max(Math.ceil(part * this.compte), 1);
    let cumul = 0;

    for (let rang = 0; rang < CASES; rang += 1) {
      cumul += this.cases[rang] ?? 0;

      if (cumul >= rangVise) {
        return Math.min(arrondi((rang + 1) / CASES_PAR_MS), this.plusLongue);
      }
    }

    return this.plusLongue;
  }

  /**
   * Le nombre de durées d'au moins ce seuil, en millisecondes, à un dixième près: le
   * seuil est arrondi au dixième inférieur.
   */
  auDela(seuilMs: number): number {
    let compte = 0;

    for (let rang = Math.max(Math.floor(seuilMs * CASES_PAR_MS), 0); rang < CASES; rang += 1) {
      compte += this.cases[rang] ?? 0;
    }

    return compte;
  }
}

/** Arrondit au dixième, pour que 16,7 ne s'écrive pas 16,700000000000003. */
function arrondi(valeur: number): number {
  return Math.round(valeur * 10) / 10;
}
