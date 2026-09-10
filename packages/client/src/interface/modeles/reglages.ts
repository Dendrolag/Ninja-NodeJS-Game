/**
 * Le formulaire des reglages du salon, decrit sous forme de donnees.
 *
 * C'EST LE SEUL ENDROIT QUI DIT QUELS CHAMPS EXISTENT. L'ecran de reglages
 * (interface/composants/reglages.ts) se dessine en parcourant cette description,
 * et un test verifie que chaque reglage de la partie y a exactement un champ. Le
 * jeu d'origine ecrivait ses quarante champs a la main dans index.html, et en lisait
 * les valeurs une par une dans client.js: un reglage ajoute d'un cote et oublie de
 * l'autre ne se voyait qu'en jouant.
 *
 * LA VALIDATION EST CELLE DU SERVEUR, AU CARACTERE PRES. Le formulaire ne
 * reimplemente aucune borne: il convertit la saisie en reglages et appelle
 * validerReglages, la fonction meme que la couche reseau applique a la reception.
 * Une configuration refusee ici est donc exactement une configuration que le
 * serveur refuserait, avec le meme motif sur le meme champ. Le client reflete la
 * regle; le serveur reste l'autorite, et verifie a nouveau.
 *
 * LES BORNES AFFICHEES viennent de BORNES_REGLAGES pour la meme raison: les
 * attributs min et max d'un champ ne peuvent pas diverger de ce que le serveur
 * accepte.
 */

import type {
  ErreurValidation,
  Intervalle,
  ReglagesPartie,
  ReglagesPartiels,
  ResultatValidation,
} from '@neon-ninja/shared';
import {
  BORNES_REGLAGES,
  TYPES_BONUS,
  TYPES_MALUS,
  TYPES_ZONE,
  validerReglages,
} from '@neon-ninja/shared';

import { APPARENCE_OBJET, APPARENCE_ZONE } from '../../rendu/apparence.js';

/** Un champ du formulaire. Son chemin est celui du reglage dans ReglagesPartie. */
export type ChampReglage =
  /** Le choix de la carte, parmi celles du contrat. */
  | { readonly nature: 'carte'; readonly chemin: 'carte'; readonly libelle: string }
  /** Un reglage vrai ou faux. */
  | { readonly nature: 'interrupteur'; readonly chemin: string; readonly libelle: string }
  /** Un nombre entier borne. */
  | {
      readonly nature: 'entier';
      readonly chemin: string;
      readonly libelle: string;
      readonly bornes: Intervalle;
      /** L'unite affichee apres la valeur. */
      readonly unite: string;
      /** Present, le champ est un curseur de ce pas; absent, une saisie. */
      readonly pas?: number;
    };

/** Un groupe de champs sous un intertitre facultatif. */
export interface SectionReglages {
  readonly titre: string | undefined;
  readonly champs: readonly ChampReglage[];
}

/** Un groupe de reglages, qui suit la structure de ReglagesPartie. */
export interface GroupeReglages {
  readonly titre: string;
  readonly sections: readonly SectionReglages[];
}

/** Un entier en secondes. */
const secondes = (chemin: string, libelle: string, bornes: Intervalle): ChampReglage => ({
  nature: 'entier',
  chemin,
  libelle,
  bornes,
  unite: 's',
});

/** Un entier en pourcentage. */
const pourCent = (chemin: string, libelle: string, bornes: Intervalle): ChampReglage => ({
  nature: 'entier',
  chemin,
  libelle,
  bornes,
  unite: '%',
});

/** Un interrupteur. */
const interrupteur = (chemin: string, libelle: string): ChampReglage => ({
  nature: 'interrupteur',
  chemin,
  libelle,
});

/**
 * Tous les reglages de la partie, dans l'ordre ou l'hote les lit.
 *
 * Les cinq groupes suivent ReglagesPartie. Les libelles des bonus, des malus et
 * des zones sont ceux du HUD et du terrain, pour que le joueur retrouve en jeu
 * les noms qu'il a regles dans le salon.
 */
export const GROUPES_REGLAGES: readonly GroupeReglages[] = [
  {
    titre: 'Partie',
    sections: [
      {
        titre: undefined,
        champs: [
          { nature: 'carte', chemin: 'carte', libelle: 'Carte' },
          interrupteur('modeMiroir', 'Mode miroir'),
          {
            nature: 'entier',
            chemin: 'dureePartieS',
            libelle: 'Durée de la partie',
            bornes: BORNES_REGLAGES.dureePartieS,
            unite: 's',
            pas: 30,
          },
          {
            nature: 'entier',
            chemin: 'nombreBotsInitial',
            libelle: 'Faux ninjas au départ',
            bornes: BORNES_REGLAGES.nombreBotsInitial,
            unite: '',
            pas: 5,
          },
        ],
      },
    ],
  },
  {
    titre: 'Black Ninjas',
    sections: [
      {
        titre: undefined,
        champs: [
          interrupteur('botsNoirs.actifs', 'Black Ninjas actifs'),
          {
            nature: 'entier',
            chemin: 'botsNoirs.nombre',
            libelle: 'Nombre',
            bornes: BORNES_REGLAGES.botsNoirs.nombre,
            unite: '',
          },
          pourCent(
            'botsNoirs.momentApparitionPourCent',
            'Apparition, en part de la partie écoulée',
            BORNES_REGLAGES.botsNoirs.momentApparitionPourCent,
          ),
          {
            nature: 'entier',
            chemin: 'botsNoirs.rayonDetectionPx',
            libelle: 'Rayon de détection',
            bornes: BORNES_REGLAGES.botsNoirs.rayonDetectionPx,
            unite: 'px',
          },
          pourCent(
            'botsNoirs.partDeBotsPerduePourCent',
            'Ninjas perdus quand on se fait prendre',
            BORNES_REGLAGES.botsNoirs.partDeBotsPerduePourCent,
          ),
        ],
      },
    ],
  },
  {
    titre: 'Bonus',
    sections: [
      {
        titre: undefined,
        champs: [
          secondes(
            'bonus.intervalleApparitionS',
            'Intervalle d’apparition',
            BORNES_REGLAGES.bonus.intervalleApparitionS,
          ),
        ],
      },
      ...TYPES_BONUS.map((nature) => ({
        titre: APPARENCE_OBJET[nature].libelle,
        champs: [
          interrupteur(`bonus.types.${nature}.actif`, 'Actif'),
          secondes(`bonus.types.${nature}.dureeS`, 'Durée', BORNES_REGLAGES.bonus.dureeS),
          pourCent(
            `bonus.types.${nature}.tauxApparitionPourCent`,
            'Taux d’apparition',
            BORNES_REGLAGES.bonus.tauxApparitionPourCent,
          ),
        ],
      })),
    ],
  },
  {
    titre: 'Malus',
    sections: [
      {
        titre: undefined,
        champs: [
          interrupteur('malus.actifs', 'Malus actifs'),
          secondes(
            'malus.intervalleApparitionS',
            'Intervalle d’apparition',
            BORNES_REGLAGES.malus.intervalleApparitionS,
          ),
          pourCent(
            'malus.tauxApparitionPourCent',
            'Taux d’apparition',
            BORNES_REGLAGES.malus.tauxApparitionPourCent,
          ),
        ],
      },
      ...TYPES_MALUS.map((nature) => ({
        titre: APPARENCE_OBJET[nature].libelle,
        champs: [
          interrupteur(`malus.types.${nature}.actif`, 'Actif'),
          secondes(`malus.types.${nature}.dureeS`, 'Durée', BORNES_REGLAGES.malus.dureeS),
        ],
      })),
    ],
  },
  {
    titre: 'Zones spéciales',
    sections: [
      {
        titre: undefined,
        champs: [
          interrupteur('zones.actives', 'Zones actives'),
          secondes('zones.dureeMinimumS', 'Durée minimale', BORNES_REGLAGES.zones.dureeS),
          secondes('zones.dureeMaximumS', 'Durée maximale', BORNES_REGLAGES.zones.dureeS),
          secondes(
            'zones.intervalleApparitionS',
            'Intervalle d’apparition',
            BORNES_REGLAGES.zones.intervalleApparitionS,
          ),
        ],
      },
      {
        titre: 'Natures de zone',
        champs: TYPES_ZONE.map((nature) =>
          interrupteur(`zones.types.${nature}`, APPARENCE_ZONE[nature].libelle),
        ),
      },
    ],
  },
];

/** Tous les champs, a plat, dans l'ordre d'affichage. */
export function tousLesChamps(): readonly ChampReglage[] {
  return GROUPES_REGLAGES.flatMap((groupe) => groupe.sections.flatMap((section) => section.champs));
}

/** La valeur d'un champ: le texte saisi pour un nombre ou une carte, un booleen sinon. */
export type ValeurDeChamp = string | boolean;

/** Les valeurs du formulaire, indexees par chemin de reglage. */
export type ValeursFormulaire = Readonly<Record<string, ValeurDeChamp>>;

/** Les valeurs du formulaire qui correspondent a des reglages. */
export function valeursDepuisReglages(reglages: ReglagesPartie): ValeursFormulaire {
  const valeurs: Record<string, ValeurDeChamp> = {};

  for (const champ of tousLesChamps()) {
    const valeur = lireChemin(reglages, champ.chemin);
    valeurs[champ.chemin] = champ.nature === 'interrupteur' ? valeur === true : String(valeur);
  }

  return valeurs;
}

/**
 * Les reglages que decrivent les valeurs du formulaire.
 *
 * AUCUNE CORRECTION N'EST FAITE ICI. Un champ vide devient un nombre invalide, un
 * nombre a virgule reste a virgule: c'est la validation qui les refuse, avec son
 * motif. Ramener une saisie hors bornes a la borne la plus proche serait
 * precisement le rognage silencieux que la decision du 14 aout 2026 interdit.
 */
export function reglagesDepuisValeurs(valeurs: ValeursFormulaire): ReglagesPartiels {
  const reglages: Record<string, unknown> = {};

  for (const champ of tousLesChamps()) {
    const valeur = valeurs[champ.chemin];

    if (valeur === undefined) {
      continue;
    }

    ecrireChemin(reglages, champ.chemin, convertir(champ, valeur));
  }

  // La conversion est sure: chaque chemin ecrit est un chemin de ReglagesPartie,
  // ce que le test de couverture des champs verifie.
  return reglages as ReglagesPartiels;
}

/** Verifie les valeurs du formulaire avec la regle du serveur. */
export function verifierLesValeurs(valeurs: ValeursFormulaire): ResultatValidation<ReglagesPartie> {
  return validerReglages(reglagesDepuisValeurs(valeurs));
}

/**
 * Les erreurs rangees par champ, pour les afficher a cote de chacun.
 *
 * Un champ peut porter plusieurs motifs: ils sont joints en une phrase.
 */
export function erreursParChamp(erreurs: readonly ErreurValidation[]): ReadonlyMap<string, string> {
  const parChamp = new Map<string, string>();

  for (const erreur of erreurs) {
    const deja = parChamp.get(erreur.champ);
    parChamp.set(erreur.champ, deja === undefined ? erreur.motif : `${deja} ${erreur.motif}`);
  }

  return parChamp;
}

/** Convertit la valeur d'un champ en valeur de reglage, sans rien corriger. */
function convertir(champ: ChampReglage, valeur: ValeurDeChamp): unknown {
  switch (champ.nature) {
    case 'interrupteur':
      return valeur === true;

    case 'carte':
      return String(valeur);

    case 'entier': {
      const texte = String(valeur).trim();

      return texte === '' ? Number.NaN : Number(texte);
    }
  }
}

/** Lit la valeur au bout d'un chemin pointe, par exemple « bonus.types.vitesse.dureeS ». */
export function lireChemin(source: unknown, chemin: string): unknown {
  let courant: unknown = source;

  for (const cle of chemin.split('.')) {
    if (typeof courant !== 'object' || courant === null) {
      return undefined;
    }

    courant = (courant as Record<string, unknown>)[cle];
  }

  return courant;
}

/** Ecrit une valeur au bout d'un chemin pointe, en creant les groupes au passage. */
function ecrireChemin(cible: Record<string, unknown>, chemin: string, valeur: unknown): void {
  const cles = chemin.split('.');
  const derniere = cles.pop() as string;
  let courant = cible;

  for (const cle of cles) {
    const suivant = courant[cle];

    if (typeof suivant === 'object' && suivant !== null) {
      courant = suivant as Record<string, unknown>;
    } else {
      const cree: Record<string, unknown> = {};
      courant[cle] = cree;
      courant = cree;
    }
  }

  courant[derniere] = valeur;
}
