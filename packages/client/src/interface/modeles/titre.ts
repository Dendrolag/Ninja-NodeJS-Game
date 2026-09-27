/**
 * Le titre d'un compte, sous forme de donnees (etape 3.9): ce que le salon, la fiche et
 * le profil en montrent, et la liste ou le profil le choisit.
 *
 * UN TITRE EST UN SUCCES OBTENU. Le serveur n'envoie que son identifiant: le nom et le
 * palier viennent du paquet partage, comme pour les succes. Un identifiant que cette
 * page ne connait pas n'affiche rien, comme un titre non choisi.
 *
 * FONCTIONS PURES. Le client met en forme ce que le serveur a lu.
 */

import type { IdentifiantSucces, PalierDeSucces, ProfilDuCompte } from '@neon-ninja/shared';
import { PALIERS_DE_SUCCES, definitionDuSucces, estUnSucces } from '@neon-ninja/shared';

import type { EtatDuChoixDuTitre } from '../../etat.js';
import { NOMS_DES_PALIERS_DE_SUCCES } from './succes.js';

/** Un titre, tel qu'il s'affiche sous un pseudo: son nom, a la couleur de son palier. */
export interface TitreAffiche {
  /** « Centurion ». */
  readonly nom: string;
  readonly palier: PalierDeSucces;
}

/** Un titre que la liste du profil propose. */
export interface TitrePropose {
  readonly id: IdentifiantSucces;
  readonly nom: string;
}

/** Les titres proposes d'un palier de difficulte, groupes dans la liste. */
export interface GroupeDeTitres {
  readonly palier: PalierDeSucces;
  /** « Découverte ». */
  readonly nom: string;
  readonly titres: readonly TitrePropose[];
}

/** La valeur de la liste qui veut dire « aucun titre ». */
export const SANS_TITRE = '';

/** Ce que le profil montre pour choisir son titre. */
export interface ChoixDuTitreAffiche {
  /** Le titre porte, ou SANS_TITRE: l'option selectionnee de la liste. */
  readonly valeur: IdentifiantSucces | typeof SANS_TITRE;
  /**
   * Les succes obtenus, palier par palier, du plus facile au plus rare. Vide sans succes
   * obtenu: la liste laisse alors la place a une phrase.
   */
  readonly groupes: readonly GroupeDeTitres[];
  /** Un choix attend sa reponse: la liste ne repart pas. */
  readonly enCours: boolean;
  /** Pourquoi le dernier choix a ete refuse. */
  readonly erreur: string | undefined;
}

/** Le titre a afficher pour cet identifiant, ou rien. */
export function titreAffiche(id: string | undefined): TitreAffiche | undefined {
  if (id === undefined || !estUnSucces(id)) {
    return undefined;
  }

  const succes = definitionDuSucces(id);

  return { nom: succes.nom, palier: succes.palier };
}

/**
 * La liste du titre au profil: les succes obtenus, et le titre porte selectionne.
 *
 * Le titre porte vient du profil lu, que le serveur met a jour a chaque choix accepte:
 * apres un refus, la liste revient d'elle-meme a ce qui est vraiment porte.
 */
export function choixDuTitreAffiche(
  profil: ProfilDuCompte,
  choix: EtatDuChoixDuTitre,
): ChoixDuTitreAffiche {
  const obtenus = profil.succes.flatMap((lu) =>
    lu.debloqueLe !== undefined && estUnSucces(lu.id) ? [definitionDuSucces(lu.id)] : [],
  );
  const porte = titreAffiche(profil.titre) === undefined ? undefined : profil.titre;

  return {
    valeur: porte ?? SANS_TITRE,
    groupes: PALIERS_DE_SUCCES.flatMap((palier) => {
      const titres = obtenus
        .filter((succes) => succes.palier === palier)
        .map((succes) => ({ id: succes.id, nom: succes.nom }));

      return titres.length === 0
        ? []
        : [{ palier, nom: NOMS_DES_PALIERS_DE_SUCCES[palier], titres }];
    }),
    enCours: choix.statut === 'enCours',
    erreur: choix.statut === 'refuse' ? choix.motif : undefined,
  };
}
