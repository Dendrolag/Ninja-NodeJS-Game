/**
 * Changer les fusibles grilles (etape 7.27), une reparation de la panne de neons. Une boite de
 * six fusibles, dont trois noircis, tires au hasard. On touche chaque fusible grille pour le
 * remplacer, puis l'on abaisse le levier general. Au clavier, les fleches choisissent un
 * fusible, Espace le remplace, et la fleche bas abaisse le levier.
 *
 * LE RYTHME. Chaque fusible se remplace en 0,7 seconde, pendant laquelle le suivant attend, et
 * le levier descend en une seconde: 3,1 secondes au plus vite, au-dessus des 3 secondes du
 * serveur.
 */

import type { AvancementDuGeste } from './commun.js';
import { dansLeRectangle, tireur } from './commun.js';
import type { BaseDeReparation, CommandeDeReparation } from './communDesReparations.js';
import { avecEchoDeReparation } from './communDesReparations.js';

/** Le nombre de fusibles de la boite, sur deux rangees de trois. */
export const NOMBRE_DE_FUSIBLES = 6;

/** Le nombre de fusibles grilles. */
export const NOMBRE_DE_GRILLES = 3;

/** Ce que dure le remplacement d'un fusible: le suivant attend. */
export const REMPLACEMENT_MS = 700;

/** Ce que met le levier general a descendre. */
export const LEVIER_MS = 1000;

/** Un fusible, sa place dans l'espace du geste: deux rangees de trois, a gauche. */
export function placeDuFusible(rang: number): {
  readonly gauche: number;
  readonly haut: number;
  readonly largeur: number;
  readonly hauteur: number;
} {
  return {
    gauche: 40 + (rang % 3) * 80,
    haut: 70 + Math.floor(rang / 3) * 110,
    largeur: 56,
    hauteur: 90,
  };
}

/** Le levier general, a droite. */
export const LEVIER = { gauche: 300, haut: 60, largeur: 80, hauteur: 220 } as const;

/** Ou en est le changement. */
export interface EtatFusibles extends BaseDeReparation {
  readonly nature: 'fusibles';
  /** Les fusibles grilles au depart, par leur rang. */
  readonly grilles: readonly number[];
  /** Ceux deja remplaces. */
  readonly remplaces: readonly number[];
  /** La fin du dernier remplacement: rien ne compte avant. */
  readonly finDuRemplacement: number;
  /** Le fusible que le clavier a choisi. */
  readonly choix: number;
  /** Le levier abaisse a cet instant. */
  readonly levierA?: number;
}

/** Une boite aux fusibles grilles tires de cette graine. */
export function creerFusibles(graine: number): EtatFusibles {
  const rangs = Array.from({ length: NOMBRE_DE_FUSIBLES }, (_vide, rang) => rang);

  return {
    nature: 'fusibles',
    grilles: [...tireur(graine).melanger(rangs).slice(0, NOMBRE_DE_GRILLES)].sort(
      (un, autre) => un - autre,
    ),
    remplaces: [],
    finDuRemplacement: 0,
    choix: 0,
    echos: [],
  };
}

/** Ce fusible est-il grille, et pas encore remplace. */
export function fusibleGrille(etat: EtatFusibles, rang: number): boolean {
  return etat.grilles.includes(rang) && !etat.remplaces.includes(rang);
}

/** Tous les fusibles grilles sont-ils remplaces, le dernier remplacement fini. */
function tousRemplaces(etat: EtatFusibles, maintenant: number): boolean {
  return etat.remplaces.length >= etat.grilles.length && maintenant >= etat.finDuRemplacement;
}

/** On remplace ce fusible, s'il est grille et que le remplacement precedent est fini. */
function remplacer(etat: EtatFusibles, rang: number, maintenant: number): EtatFusibles {
  if (maintenant < etat.finDuRemplacement || etat.levierA !== undefined) {
    return etat;
  }

  if (!fusibleGrille(etat, rang)) {
    return etat;
  }

  return avecEchoDeReparation(
    {
      ...etat,
      remplaces: [...etat.remplaces, rang],
      finDuRemplacement: maintenant + REMPLACEMENT_MS,
    },
    'fusible',
  );
}

/** On abaisse le levier general, une fois les fusibles changes. */
function abaisser(etat: EtatFusibles, maintenant: number): EtatFusibles {
  return etat.levierA !== undefined || !tousRemplaces(etat, maintenant)
    ? etat
    : avecEchoDeReparation({ ...etat, levierA: maintenant }, 'levier');
}

/** Le choix du clavier, deplace d'une case dans ce sens, sans sortir de la boite. */
function choisir(etat: EtatFusibles, sens: 'gauche' | 'droite' | 'haut' | 'bas'): EtatFusibles {
  const colonne = etat.choix % 3;
  const rangee = Math.floor(etat.choix / 3);
  const nouvelleColonne = Math.min(
    Math.max(colonne + (sens === 'droite' ? 1 : sens === 'gauche' ? -1 : 0), 0),
    2,
  );
  const nouvelleRangee = Math.min(
    Math.max(rangee + (sens === 'bas' ? 1 : sens === 'haut' ? -1 : 0), 0),
    1,
  );

  return { ...etat, choix: nouvelleRangee * 3 + nouvelleColonne };
}

/** Le changement apres une commande. */
export function appliquerFusibles(
  etat: EtatFusibles,
  commande: CommandeDeReparation,
  maintenant: number,
): EtatFusibles {
  switch (commande.type) {
    case 'temps':
    case 'molette':
      return etat;

    case 'touche':
      if (!commande.enfoncee) {
        return etat;
      }

      if (commande.touche === 'espace') {
        return tousRemplaces(etat, maintenant)
          ? abaisser(etat, maintenant)
          : remplacer(etat, etat.choix, maintenant);
      }

      // Les fusibles changes, la fleche bas abaisse le levier.
      if (commande.touche === 'bas' && tousRemplaces(etat, maintenant)) {
        return abaisser(etat, maintenant);
      }

      return choisir(etat, commande.touche);

    case 'pointeur': {
      if (commande.phase !== 'bas') {
        return etat;
      }

      if (dansLeRectangle(commande, LEVIER.gauche, LEVIER.haut, LEVIER.largeur, LEVIER.hauteur)) {
        return abaisser(etat, maintenant);
      }

      const rang = Array.from({ length: NOMBRE_DE_FUSIBLES }, (_vide, indice) => indice).find(
        (indice) => {
          const { gauche, haut, largeur, hauteur } = placeDuFusible(indice);
          return dansLeRectangle(commande, gauche, haut, largeur, hauteur);
        },
      );

      return rang === undefined ? etat : remplacer({ ...etat, choix: rang }, rang, maintenant);
    }
  }
}

/** Les fusibles sont-ils changes: tous remplaces, et le levier descendu. */
export function fusiblesChanges(etat: EtatFusibles, maintenant: number): boolean {
  return etat.levierA !== undefined && maintenant >= etat.levierA + LEVIER_MS;
}

/** Les fusibles remplaces, puis le levier. */
export function avancementDesFusibles(etat: EtatFusibles): AvancementDuGeste {
  return {
    faits: etat.remplaces.length + (etat.levierA === undefined ? 0 : 1),
    total: NOMBRE_DE_GRILLES + 1,
  };
}
