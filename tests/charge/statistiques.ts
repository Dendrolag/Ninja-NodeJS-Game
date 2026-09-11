/**
 * Resumer une serie de mesures: combien, en moyenne, et surtout dans les pires cas.
 *
 * UNE MOYENNE NE SUFFIT PAS A DIRE SI UN SERVEUR TIENT. Un battement qui coute
 * une milliseconde en moyenne mais cent millisecondes une fois sur cent fait
 * sauter un battement toutes les cinq secondes: le joueur le voit, la moyenne ne
 * le dit pas. D'ou les centiles: le 95e et le 99e disent ce que vivent les
 * battements les plus lents, le maximum dit ce qui peut arriver.
 *
 * TOUT CE FICHIER EST PUR. Il ne mesure rien lui-meme: il resume ce qu'on lui
 * donne. C'est ce qui permet de le tester sur des series ecrites a la main.
 */

/** Le resume d'une serie de valeurs. */
export interface Resume {
  readonly nombre: number;
  readonly moyenne: number;
  /** La mediane: la moitie des valeurs sont en dessous. */
  readonly p50: number;
  readonly p95: number;
  readonly p99: number;
  readonly minimum: number;
  readonly maximum: number;
}

/** Le resume d'une serie vide: tout a zero, et un nombre nul qui le signale. */
export const RESUME_VIDE: Resume = {
  nombre: 0,
  moyenne: 0,
  p50: 0,
  p95: 0,
  p99: 0,
  minimum: 0,
  maximum: 0,
};

/**
 * Le centile d'une serie deja triee, par la methode du rang le plus proche.
 *
 * C'est la definition la plus simple a expliquer: le 99e centile de cent valeurs
 * est la 99e plus petite. Aucune interpolation, donc toujours une valeur
 * reellement mesuree.
 *
 * @param triees Valeurs triees par ordre croissant, au moins une.
 * @param centile Entre 0 et 100.
 */
export function centile(triees: readonly number[], centile: number): number {
  if (triees.length === 0) {
    throw new Error("Le centile d'une serie vide n'existe pas.");
  }

  if (!Number.isFinite(centile) || centile < 0 || centile > 100) {
    throw new Error(`Un centile est compris entre 0 et 100, recu ${String(centile)}.`);
  }

  const rang = Math.max(Math.ceil((centile / 100) * triees.length), 1);

  return triees[rang - 1] as number;
}

/** Resume une serie de valeurs, dans n'importe quel ordre. */
export function resumer(valeurs: readonly number[]): Resume {
  if (valeurs.length === 0) {
    return RESUME_VIDE;
  }

  const triees = [...valeurs].sort((a, b) => a - b);
  const somme = triees.reduce((total, valeur) => total + valeur, 0);

  return {
    nombre: triees.length,
    moyenne: somme / triees.length,
    p50: centile(triees, 50),
    p95: centile(triees, 95),
    p99: centile(triees, 99),
    minimum: triees[0] as number,
    maximum: triees[triees.length - 1] as number,
  };
}

/** Arrondit pour l'affichage et le rapport: deux decimales suffisent a ces mesures. */
export function arrondi(valeur: number, decimales = 2): number {
  const facteur = 10 ** decimales;

  return Math.round(valeur * facteur) / facteur;
}

/** Un resume dont chaque valeur est arrondie, pour un rapport lisible. */
export function resumeArrondi(resume: Resume, decimales = 2): Resume {
  return {
    nombre: resume.nombre,
    moyenne: arrondi(resume.moyenne, decimales),
    p50: arrondi(resume.p50, decimales),
    p95: arrondi(resume.p95, decimales),
    p99: arrondi(resume.p99, decimales),
    minimum: arrondi(resume.minimum, decimales),
    maximum: arrondi(resume.maximum, decimales),
  };
}
