/**
 * Le profil d'un compte, sous forme de donnees.
 *
 * LA VERSION REDUITE DU CADRAGE (section 3, profil): identite, niveau et XP, palier
 * et points de ligue, pieces, statistiques (parties jouees, victoires, meilleur
 * score) et dernieres parties. Ni pass de saison, ni skins, ni succes, ni clan, ni
 * gemmes, ni rang mondial: reportes apres la v1, et absents plutot que grises
 * (decision du 29 juin 2026).
 *
 * FONCTION PURE. Tout vient du profil lu par la route de l'etape (statistiques
 * comprises, deduites des resultats par le serveur): le client met en forme, il ne
 * compte rien.
 */

import type { PartieDuProfil, ProfilDuCompte } from '@neon-ninja/shared';
import { palierDePoints } from '@neon-ninja/shared';

import type { EtatClient } from '../../etat.js';
import { NOMS_DES_MODES, nomDeCarte } from './cartes.js';
import type { BarreDeNiveau } from './progression.js';
import {
  NOMS_DES_PALIERS,
  barreDeNiveau,
  formaterNombre,
  formaterVariation,
} from './progression.js';
import { initiales } from './salon.js';

/** Une statistique, telle qu'on l'affiche. */
export interface StatistiqueAffichee {
  readonly libelle: string;
  readonly valeur: string;
}

/** Le sens d'une variation de points de ligue, qui decide de sa couleur. */
export type SensDUneVariation = 'hausse' | 'baisse' | 'stable';

/** Une partie de l'historique, telle qu'on l'affiche. */
export interface LigneDHistorique {
  readonly date: string;
  /** « Classique · Spirit & Time · Miroir ». */
  readonly partie: string;
  /** « 1re sur 3 ». */
  readonly place: string;
  readonly points: string;
  /** « +30 ». */
  readonly xp: string;
  readonly pieces: string;
  /** « +20 », « −10 » ou « 0 ». */
  readonly ligue: string;
  readonly sensDeLaLigue: SensDUneVariation;
}

/** Ce que l'ecran du profil affiche. */
export type ModeleProfil =
  /** Le profil se lit. */
  | { readonly nature: 'chargement' }
  /** Le profil n'a pas pu etre lu. */
  | { readonly nature: 'echec'; readonly motif: string }
  | {
      readonly nature: 'charge';
      readonly pseudo: string;
      readonly initiales: string;
      readonly palier: string;
      /** « Inscrit le 11 septembre 2026 ». */
      readonly inscription: string;
      readonly barre: BarreDeNiveau;
      readonly statistiques: readonly StatistiqueAffichee[];
      /** Les dernieres parties, de la plus recente a la plus ancienne. */
      readonly parties: readonly LigneDHistorique[];
    };

/** La date d'inscription: « 11 septembre 2026 ». */
const FORMAT_DE_JOUR = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' });

/** La fin d'une partie: le jour et l'heure. */
const FORMAT_DE_PARTIE = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** Une date d'inscription, ecrite a la francaise, dans le fuseau du joueur. */
export function formaterJour(iso: string): string {
  return FORMAT_DE_JOUR.format(new Date(iso));
}

/** La fin d'une partie, ecrite a la francaise, dans le fuseau du joueur. */
export function formaterFinDePartie(iso: string): string {
  return FORMAT_DE_PARTIE.format(new Date(iso));
}

/** Calcule l'ecran du profil. */
export function modeleProfil(etat: EtatClient): ModeleProfil {
  const profil = etat.profil;

  switch (profil.statut) {
    // Un profil inconnu est un profil dont la lecture va partir: l'arrivee sur
    // l'ecran la declenche.
    case 'inconnu':
    case 'chargement':
      return { nature: 'chargement' };

    case 'echec':
      return { nature: 'echec', motif: profil.motif };

    case 'charge':
      return profilCharge(profil.profil);
  }
}

/** Le profil lu, mis en forme. */
function profilCharge(profil: ProfilDuCompte): ModeleProfil {
  const { statistiques } = profil;

  return {
    nature: 'charge',
    pseudo: profil.pseudo,
    initiales: initiales(profil.pseudo),
    palier: NOMS_DES_PALIERS[palierDePoints(profil.pointsLigue)],
    inscription: `Inscrit le ${formaterJour(profil.inscritLe)}`,
    barre: barreDeNiveau(profil.xpTotale),
    statistiques: [
      { libelle: 'Parties jouées', valeur: formaterNombre(statistiques.partiesJouees) },
      { libelle: 'Victoires', valeur: formaterNombre(statistiques.victoires) },
      {
        libelle: 'Meilleur score',
        // Un tiret plutot qu'un zero: aucune partie n'a encore ete jouee.
        valeur:
          statistiques.meilleurScore === undefined
            ? '—'
            : formaterNombre(statistiques.meilleurScore),
      },
      { libelle: 'Pièces', valeur: formaterNombre(profil.pieces) },
      { libelle: 'Points de ligue', valeur: formaterNombre(profil.pointsLigue) },
    ],
    parties: profil.dernieresParties.map(ligneDHistorique),
  };
}

/** Une partie de l'historique, mise en forme. */
function ligneDHistorique(partie: PartieDuProfil): LigneDHistorique {
  return {
    date: formaterFinDePartie(partie.termineeLe),
    partie: `${NOMS_DES_MODES[partie.mode]} · ${nomDeCarte(partie.carte, partie.modeMiroir)}`,
    place: `${String(partie.placement)}${partie.placement === 1 ? 're' : 'e'} sur ${String(partie.nombreJoueurs)}`,
    points: formaterNombre(partie.points),
    xp: `+${formaterNombre(partie.xpGagnee)}`,
    pieces: `+${formaterNombre(partie.piecesGagnees)}`,
    ligue: formaterVariation(partie.variationPointsLigue),
    sensDeLaLigue: sensDe(partie.variationPointsLigue),
  };
}

/** Le sens d'une variation. */
function sensDe(variation: number): SensDUneVariation {
  if (variation > 0) {
    return 'hausse';
  }

  return variation < 0 ? 'baisse' : 'stable';
}
