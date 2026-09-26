/**
 * Les succes d'un compte, tels que la fin de partie, le profil et la fiche les montrent
 * (etape 3.7), tires de ce que la base a inscrit.
 *
 * FONCTIONS PURES. La base lit et inscrit (base/succes.ts); ce fichier met en forme les
 * contrats du paquet partage. Separer les deux permet de verifier ces regles sans base,
 * et aux comptes en memoire des tests de les appliquer telles quelles.
 */

import type {
  IdentifiantSucces,
  Mesures,
  SuccesDeFiche,
  SuccesDeFin,
  SuccesDuProfil,
} from '@neon-ninja/shared';
import { SUCCES, progressionDuSucces, succesLePlusProche } from '@neon-ninja/shared';

import type { SuccesEnregistre } from '../base/succes.js';

/** Les succes inscrits d'un compte, par identifiant. */
type Inscrits = ReadonlyMap<IdentifiantSucces, SuccesEnregistre>;

/** La rarete de chaque succes, en pour cent. Un succes absent n'est detenu par personne. */
type Raretes = ReadonlyMap<IdentifiantSucces, number>;

/**
 * Ce que la fin d'une partie dit des succes d'un compte.
 *
 * Elle n'annonce que les succes dont elle est la partie d'origine: un succes plus
 * ancien, inscrit a cette occasion, garde sa date et ne s'annonce pas. Un reessai
 * d'enregistrement annonce donc exactement les memes.
 */
export function succesDeFin(partieId: string, mesures: Mesures, inscrits: Inscrits): SuccesDeFin {
  const plusProche = succesLePlusProche(mesures, new Set(inscrits.keys()));

  return {
    debloques: SUCCES.filter((succes) => inscrits.get(succes.id)?.partieId === partieId).map(
      (succes) => succes.id,
    ),
    ...(plusProche === undefined ? {} : { plusProche }),
  };
}

/**
 * Tous les succes, tels que leur proprietaire les lit: obtenus avec leur date, les
 * autres avec leur progression quand c'est un cumul qui n'est pas secret.
 */
export function succesDuProfil(
  mesures: Mesures,
  inscrits: Inscrits,
  raretes: Raretes,
): SuccesDuProfil[] {
  return SUCCES.map((succes): SuccesDuProfil => {
    const inscrit = inscrits.get(succes.id);
    const rarete = raretes.get(succes.id) ?? 0;

    if (inscrit !== undefined) {
      return { id: succes.id, debloqueLe: inscrit.debloqueLe.toISOString(), rarete };
    }

    const progression = progressionDuSucces(succes, mesures);

    return {
      id: succes.id,
      ...(progression === undefined
        ? {}
        : { progression: { actuel: progression.actuel, seuil: progression.seuil } }),
      rarete,
    };
  });
}

/** Les succes obtenus, tels que les autres comptes les lisent sur la fiche: sans date. */
export function succesDeFiche(inscrits: Inscrits, raretes: Raretes): SuccesDeFiche[] {
  return SUCCES.filter((succes) => inscrits.has(succes.id)).map((succes) => ({
    id: succes.id,
    rarete: raretes.get(succes.id) ?? 0,
  }));
}
