/**
 * La fiche d'un joueur, sous forme de donnees (etape 3.5).
 *
 * CE QUE TOUT COMPTE CONNECTE PEUT LIRE D'UN AUTRE: son pseudo, depuis quand il a un
 * compte, son niveau, son palier et ses statistiques, les memes que celles de son
 * profil (statistiques.ts). Ni ses pieces, ni ses dernieres parties: le serveur ne les
 * envoie pas.
 *
 * UNE SUITE DE SECTIONS, POUR LA SUITE. L'identite, les statistiques, puis le tableau
 * par mode; la section des succes (etapes 3.7 et 3.8) viendra s'y ajouter, et celle
 * des parties jouees ensemble pour un ami (etape 3.6).
 *
 * FONCTION PURE. Le client met en forme ce que le serveur a lu.
 */

import type { FicheJoueur } from '@neon-ninja/shared';

import type { EtatClient } from '../../etat.js';
import { formaterInscription } from './profil.js';
import { NOMS_DES_PALIERS } from './progression.js';
import { initiales } from './salon.js';
import type { LigneDUnMode, StatistiqueAffichee } from './statistiques.js';
import { lignesParMode, tuilesDesStatistiques } from './statistiques.js';

/** Ce que la fenetre de la fiche affiche. */
export type ModeleFiche =
  /** Aucune fiche n'est ouverte: la fenetre est fermee. */
  | { readonly nature: 'fermee' }
  /** La fiche de ce joueur se lit. */
  | { readonly nature: 'chargement'; readonly pseudo: string }
  /** La fiche de ce joueur n'a pas pu etre lue. */
  | { readonly nature: 'echec'; readonly pseudo: string; readonly motif: string }
  | {
      readonly nature: 'chargee';
      /** Le pseudo, dans l'ecriture du compte. */
      readonly pseudo: string;
      readonly initiales: string;
      /** « Niveau 12 ». */
      readonly niveau: string;
      /** « Argent ». */
      readonly palier: string;
      /** « Membre depuis le 11 septembre 2026 ». */
      readonly inscription: string;
      readonly statistiques: readonly StatistiqueAffichee[];
      /** Les modes joues, dans l'ordre des modes du jeu. Vide sans partie. */
      readonly parMode: readonly LigneDUnMode[];
    };

/** Calcule la fenetre de la fiche. */
export function modeleFiche(etat: EtatClient): ModeleFiche {
  const fiche = etat.fiche;

  switch (fiche.statut) {
    case 'fermee':
      return { nature: 'fermee' };

    case 'chargement':
      return { nature: 'chargement', pseudo: fiche.pseudo };

    case 'echec':
      return { nature: 'echec', pseudo: fiche.pseudo, motif: fiche.motif };

    case 'chargee':
      return ficheChargee(fiche.fiche);
  }
}

/** La fiche lue, mise en forme. */
function ficheChargee(fiche: FicheJoueur): ModeleFiche {
  return {
    nature: 'chargee',
    pseudo: fiche.pseudo,
    initiales: initiales(fiche.pseudo),
    niveau: `Niveau ${String(fiche.niveau)}`,
    palier: NOMS_DES_PALIERS[fiche.palier],
    inscription: formaterInscription(fiche.inscritLe),
    statistiques: tuilesDesStatistiques(fiche.statistiques),
    parMode: lignesParMode(fiche.statistiques),
  };
}
