/**
 * Le chronometre du battement: le serveur envoie-t-il bien ses instantanes toutes les
 * cinquante millisecondes (etape 8.6).
 *
 * POURQUOI. L'audit des saccades sur telephone (etape 8.5) a montre un dessin fluide et
 * des instantanes qui arrivent irregulierement: un ecart d'au moins 100 ms toutes les
 * deux a trois secondes, et, certains jours, bien pire. La page voit le retard, pas son
 * origine. Il peut naitre sur le chemin jusqu'au telephone, ou dans le serveur lui-meme,
 * heberge sur une offre gratuite dont la puissance n'est pas garantie. Ce chronometre
 * dit ce que fait le serveur: si ses battements partent a l'heure, le retard est sur le
 * chemin.
 *
 * CE QU'IL RETIENT. Pour chaque battement de chaque partie: son instant, l'ecart reel
 * depuis le battement precedent de la meme partie, et le temps qu'il a pris (le moteur,
 * la projection, le codage et l'envoi). Dans un tableau tournant de taille fixe: rien
 * n'est alloue pendant le jeu, et la memoire ne grossit pas avec la duree de vie du
 * serveur.
 *
 * IL NE LIT AUCUNE HORLOGE. On lui donne les instants, lus par la partie sur l'horloge du
 * serveur: il se teste avec une horloge manuelle, comme tout le reste.
 *
 * LE RESUME NE SE CALCULE QU'A LA DEMANDE, quand la route de sante le demande: trier
 * quelques milliers de nombres de temps en temps ne coute rien, et le battement, lui, ne
 * paie que trois ecritures dans un tableau.
 */

import type { Repartition, ResumeDuBattement } from '@neon-ninja/shared';

/** Combien de battements retenus: cinq minutes d'une partie, ou moins de plusieurs. */
const CAPACITE = 6000;

/** La fenetre du resume par defaut, en millisecondes: les cinq dernieres minutes. */
export const FENETRE_DU_RESUME_MS = 5 * 60_000;

/** L'ecart a partir duquel un battement est en retard, en millisecondes: deux battements. */
export const SEUIL_DE_RETARD_MS = 100;

/** Les battements recents du serveur, toutes parties confondues. */
export class ChronometreDuBattement {
  private readonly instants = new Float64Array(CAPACITE);
  private readonly ecarts = new Float64Array(CAPACITE);
  private readonly durees = new Float64Array(CAPACITE);
  /** La prochaine case a ecrire. */
  private suivante = 0;
  /** Le nombre de cases remplies, jusqu'a CAPACITE. */
  private remplies = 0;

  /**
   * Retient un battement.
   *
   * @param instant L'instant ou il a commence, sur l'horloge du serveur.
   * @param ecartMs L'ecart reel depuis le battement precedent de la meme partie.
   * @param dureeMs Le temps qu'il a pris.
   */
  enregistrer(instant: number, ecartMs: number, dureeMs: number): void {
    this.instants[this.suivante] = instant;
    this.ecarts[this.suivante] = ecartMs;
    this.durees[this.suivante] = dureeMs;
    this.suivante = (this.suivante + 1) % CAPACITE;
    this.remplies = Math.min(this.remplies + 1, CAPACITE);
  }

  /**
   * Le resume des battements de la fenetre qui s'acheve maintenant, ou rien si aucune
   * partie n'a battu pendant ce temps.
   */
  resume(
    maintenant: number,
    fenetreMs: number = FENETRE_DU_RESUME_MS,
  ): ResumeDuBattement | undefined {
    const ecarts: number[] = [];
    const durees: number[] = [];

    for (let rang = 0; rang < this.remplies; rang += 1) {
      if (maintenant - (this.instants[rang] ?? 0) <= fenetreMs) {
        ecarts.push(this.ecarts[rang] ?? 0);
        durees.push(this.durees[rang] ?? 0);
      }
    }

    if (ecarts.length === 0) {
      return undefined;
    }

    return {
      fenetreS: fenetreMs / 1000,
      battements: ecarts.length,
      ecart: repartition(ecarts),
      enRetard: ecarts.filter((ecart) => ecart >= SEUIL_DE_RETARD_MS).length,
      duree: repartition(durees),
    };
  }
}

/** La repartition d'une serie non vide. */
function repartition(serie: number[]): Repartition {
  const triee = serie.sort((une, autre) => une - autre);
  const centile = (part: number): number =>
    arrondi(triee[Math.min(Math.ceil(part * triee.length), triee.length) - 1] ?? 0);

  return {
    mediane: centile(0.5),
    p90: centile(0.9),
    p99: centile(0.99),
    max: arrondi(triee[triee.length - 1] ?? 0),
  };
}

/** Arrondit au dixieme. */
function arrondi(valeur: number): number {
  return Math.round(valeur * 10) / 10;
}
