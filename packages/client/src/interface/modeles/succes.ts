/**
 * Les succes, sous forme de donnees (etape 3.7): ce que la fin de partie, le profil et la
 * fiche en montrent.
 *
 * LES NOMS ET LES DESCRIPTIONS VIENNENT DU PAQUET PARTAGE, les memes que le serveur
 * attribue: le serveur n'envoie que des identifiants. Un identifiant que cette page ne
 * connait pas est ignore.
 *
 * UN SUCCES SECRET NE SE DECRIT QU'UNE FOIS OBTENU. Avant, il se lit « ??? », sans
 * description ni progression (etude des succes, principe 7).
 *
 * FONCTIONS PURES. Le client met en forme ce que le serveur a lu.
 */

import type {
  IdentifiantSucces,
  PalierDeSucces,
  ProgressionDUnSucces,
  SuccesConnu,
  SuccesDeFiche,
  SuccesDuProfil,
} from '@neon-ninja/shared';
import { PALIERS_DE_SUCCES, definitionDuSucces, estUnSucces } from '@neon-ninja/shared';

import { formaterJour, formaterNombre } from './progression.js';

/** Le nom de chaque palier de difficulte, tel que le joueur le lit. */
export const NOMS_DES_PALIERS_DE_SUCCES: Readonly<Record<PalierDeSucces, string>> = {
  decouverte: 'Découverte',
  habitue: 'Habitué',
  expert: 'Expert',
  legende: 'Légende',
};

/** Ce qui s'ecrit a la place du nom et de la description d'un secret non obtenu. */
export const SECRET = '???';

/** Un succes du profil, tel qu'on l'affiche. */
export interface SuccesAffiche {
  readonly id: IdentifiantSucces;
  /** « Premier pas », ou « ??? » pour un secret non obtenu. */
  readonly nom: string;
  /** Absente pour un secret non obtenu. */
  readonly description: string | undefined;
  readonly palier: PalierDeSucces;
  readonly obtenu: boolean;
  /** « Obtenu le 20 septembre 2026 », pour un succes obtenu. */
  readonly date: string | undefined;
  /** Pour un cumul pas encore obtenu. */
  readonly progression: ProgressionAffichee | undefined;
  /**
   * « 12 % des joueurs ». Absente pour un succes que personne n'a obtenu: repetee sur
   * chaque carte d'un profil neuf, elle ne dirait rien.
   */
  readonly rarete: string | undefined;
}

/** La progression d'un cumul. */
export interface ProgressionAffichee {
  /** « 412 sur 500 ». */
  readonly texte: string;
  /** De 0 a 100, pour la jauge. */
  readonly pourCent: number;
}

/** Les succes d'un palier de difficulte. */
export interface PalierAffiche {
  readonly palier: PalierDeSucces;
  /** « Découverte ». */
  readonly nom: string;
  /** « 4 sur 6 ». */
  readonly compte: string;
  readonly succes: readonly SuccesAffiche[];
}

/** La section des succes du profil. */
export interface SuccesDuProfilAffiches {
  /** « 12 succès sur 29 ». */
  readonly compte: string;
  /** Les paliers qui ont au moins un succes, du plus facile au plus rare. */
  readonly paliers: readonly PalierAffiche[];
}

/** Un succes obtenu, tel que la fiche et la fin de partie le montrent. */
export interface SuccesObtenuAffiche {
  readonly id: IdentifiantSucces;
  readonly nom: string;
  readonly description: string;
  readonly palier: PalierDeSucces;
  /** « Découverte ». */
  readonly nomDuPalier: string;
}

/** Un succes obtenu, sur la fiche d'un joueur: avec sa rarete. */
export interface SuccesDeFicheAffiche extends SuccesObtenuAffiche {
  /** « 12 % des joueurs ». */
  readonly rarete: string;
}

/**
 * La rarete d'un succes: « 12 % des joueurs ». Un succes detenu, mais par moins d'un
 * joueur sur cent, ne s'ecrit pas « 0 % »: il se lit « moins de 1 % des joueurs ».
 */
export function formaterRarete(pourCent: number): string {
  if (pourCent <= 0) {
    return 'aucun joueur';
  }

  if (pourCent < 1) {
    return 'moins de 1 % des joueurs';
  }

  return `${String(Math.round(pourCent))} % des joueurs`;
}

/** Le cumul le plus proche, en une phrase: « Plus que 3 victoires pour Dix couronnes ». */
export function phraseDuPlusProche(progression: ProgressionDUnSucces): string | undefined {
  if (!estUnSucces(progression.id)) {
    return undefined;
  }

  const succes = definitionDuSucces(progression.id);
  const reste = progression.seuil - progression.actuel;
  const unite = succes.unite;

  if (unite === undefined || reste <= 0) {
    return undefined;
  }

  return `Plus que ${formaterNombre(reste)} ${reste > 1 ? unite.pluriel : unite.singulier} pour ${succes.nom}`;
}

/** Ce qui donne la definition d'un succes connu. */
type Definir = (id: IdentifiantSucces) => SuccesConnu;

/**
 * La section des succes du profil, palier par palier.
 *
 * @param definir Les definitions a lire: celles du paquet partage. Un test y substitue
 *                un secret, tant qu'aucun n'existe (ils viennent a l'etape 3.8).
 */
export function succesDuProfilAffiches(
  succes: readonly SuccesDuProfil[],
  definir: Definir = definitionDuSucces,
): SuccesDuProfilAffiches {
  const affiches = succes.flatMap((lu) =>
    estUnSucces(lu.id) ? [succesAffiche(lu, definir(lu.id))] : [],
  );
  const obtenus = affiches.filter((affiche) => affiche.obtenu).length;

  return {
    compte: `${formaterNombre(obtenus)} succès sur ${formaterNombre(affiches.length)}`,
    paliers: PALIERS_DE_SUCCES.flatMap((palier) => {
      const duPalier = affiches.filter((affiche) => affiche.palier === palier);

      return duPalier.length === 0
        ? []
        : [
            {
              palier,
              nom: NOMS_DES_PALIERS_DE_SUCCES[palier],
              compte: `${formaterNombre(duPalier.filter((affiche) => affiche.obtenu).length)} sur ${formaterNombre(duPalier.length)}`,
              succes: duPalier,
            },
          ];
    }),
  };
}

/** Un succes du profil, mis en forme. */
function succesAffiche(lu: SuccesDuProfil, succes: SuccesConnu): SuccesAffiche {
  const obtenu = lu.debloqueLe !== undefined;
  const cache = succes.secret && !obtenu;

  return {
    id: succes.id,
    nom: cache ? SECRET : succes.nom,
    description: cache ? undefined : succes.description,
    palier: succes.palier,
    obtenu,
    date: lu.debloqueLe === undefined ? undefined : `Obtenu le ${formaterJour(lu.debloqueLe)}`,
    progression:
      cache || obtenu || lu.progression === undefined
        ? undefined
        : {
            texte: `${formaterNombre(lu.progression.actuel)} sur ${formaterNombre(lu.progression.seuil)}`,
            pourCent: Math.min(
              Math.floor((lu.progression.actuel * 100) / lu.progression.seuil),
              100,
            ),
          },
    rarete: lu.rarete > 0 ? formaterRarete(lu.rarete) : undefined,
  };
}

/** Un succes obtenu, mis en forme. */
function succesObtenu(succes: SuccesConnu): SuccesObtenuAffiche {
  return {
    id: succes.id,
    nom: succes.nom,
    description: succes.description,
    palier: succes.palier,
    nomDuPalier: NOMS_DES_PALIERS_DE_SUCCES[succes.palier],
  };
}

/** Les succes obtenus de la fiche, avec leur rarete. */
export function succesDeFicheAffiches(
  succes: readonly SuccesDeFiche[],
): readonly SuccesDeFicheAffiche[] {
  return succes.flatMap((lu) =>
    estUnSucces(lu.id)
      ? [{ ...succesObtenu(definitionDuSucces(lu.id)), rarete: formaterRarete(lu.rarete) }]
      : [],
  );
}

/** Les succes qu'une partie vient de donner. */
export function succesDebloquesAffiches(ids: readonly string[]): readonly SuccesObtenuAffiche[] {
  return ids.flatMap((id) => (estUnSucces(id) ? [succesObtenu(definitionDuSucces(id))] : []));
}
