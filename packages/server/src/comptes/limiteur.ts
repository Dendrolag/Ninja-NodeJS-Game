/**
 * La limitation des tentatives d'inscription et de connexion.
 *
 * LE MEME SEAU A JETONS QUE POUR LES MESSAGES DU JEU (debit.ts, dans le paquet
 * partage), tenu ici par cle: un pseudo, ou une adresse. Chaque tentative consomme
 * un jeton; une tentative devant un seau vide est refusee sans que le mot de passe
 * soit meme examine, et la reponse dit dans combien de temps reessayer.
 *
 * L'ETAT VIT DANS L'INSTANCE, PAS DANS LE MODULE (regle 5 de CLAUDE.md), et en
 * memoire. C'est suffisant pour un serveur unique, ce qu'est la v1. Plusieurs
 * serveurs derriere un repartiteur tiendraient chacun leurs propres seaux, ce qui
 * multiplierait la limite par leur nombre: il faudrait alors la ranger dans un
 * stockage partage.
 *
 * LA MEMOIRE NE GROSSIT PAS SANS FIN. Une cle dont le seau est redevenu plein ne
 * se distingue plus d'une cle jamais vue: elle est oubliee au nettoyage suivant.
 * Sans cela, un attaquant qui essaierait un pseudo different a chaque tentative
 * remplirait la memoire du serveur.
 */

import type { LimiteDebit, SeauAJetons } from '@neon-ninja/shared';
import { consommer, seauNeuf } from '@neon-ninja/shared';

import type { Horloge } from '../horloge.js';

/** Le verdict d'une tentative. */
export type VerdictTentative =
  | { readonly accepte: true }
  | {
      readonly accepte: false;
      /** Delai avant qu'une tentative soit de nouveau acceptee, en millisecondes. */
      readonly reessayerDansMs: number;
    };

/** Le seau d'une cle, et l'instant ou il a ete consulte pour la derniere fois. */
interface Suivi {
  seau: SeauAJetons;
  derniereFois: number;
}

/** Intervalle minimal entre deux nettoyages, en millisecondes. */
const INTERVALLE_NETTOYAGE_MS = 60_000;

/** Un seau a jetons par cle, pour une sorte de tentative. */
export class LimiteurDeTentatives {
  private readonly suivis = new Map<string, Suivi>();
  private dernierNettoyage: number;

  constructor(
    private readonly limite: LimiteDebit,
    private readonly horloge: Horloge,
  ) {
    this.dernierNettoyage = horloge.maintenant();
  }

  /** Le nombre de cles suivies. Pour les tests. */
  get nombreDeCles(): number {
    return this.suivis.size;
  }

  /**
   * Presente une tentative pour cette cle.
   *
   * Une tentative refusee ne consomme rien: attendre suffit a retrouver le droit
   * d'essayer, insister ne l'eloigne pas.
   */
  tenter(cle: string): VerdictTentative {
    const maintenant = this.horloge.maintenant();
    this.nettoyer(maintenant);

    const suivi = this.suivis.get(cle) ?? { seau: seauNeuf(this.limite), derniereFois: maintenant };
    const ecoule = Math.max(maintenant - suivi.derniereFois, 0);
    const verdict = consommer(suivi.seau, this.limite, ecoule);

    this.suivis.set(cle, { seau: verdict.seau, derniereFois: maintenant });

    if (verdict.accepte) {
      return { accepte: true };
    }

    const jetonsManquants = 1 - verdict.seau.jetons;

    return {
      accepte: false,
      reessayerDansMs: Math.ceil((jetonsManquants / this.limite.parSeconde) * 1000),
    };
  }

  /** Oublie les cles dont le seau s'est entierement rempli depuis leur derniere tentative. */
  private nettoyer(maintenant: number): void {
    if (maintenant - this.dernierNettoyage < INTERVALLE_NETTOYAGE_MS) {
      return;
    }

    this.dernierNettoyage = maintenant;

    for (const [cle, suivi] of this.suivis) {
      const manque = this.limite.rafale - suivi.seau.jetons;
      const tempsDeRemplissageMs = (manque / this.limite.parSeconde) * 1000;

      if (maintenant - suivi.derniereFois >= tempsDeRemplissageMs) {
        this.suivis.delete(cle);
      }
    }
  }
}
