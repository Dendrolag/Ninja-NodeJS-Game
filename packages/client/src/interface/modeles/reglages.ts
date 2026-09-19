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
 * accepte. Depuis l'etape 7.6, le nombre de faux ninjas a en plus le plafond de la
 * carte choisie (PLAFONDS_DE_FAUX_NINJAS), et la pluie n'a de sens que sur une carte
 * qui en a une: voir bornesSurLaCarte et champUtileSurLaCarte.
 */

import type {
  ErreurValidation,
  IdentifiantCarte,
  Intervalle,
  Mode,
  ReglagesPartie,
  ReglagesPartiels,
  ResultatValidation,
} from '@neon-ninja/shared';
import {
  BORNES_REGLAGES,
  CARTES,
  PLAFONDS_DE_FAUX_NINJAS,
  TYPES_BONUS,
  TYPES_BONUS_TACTIQUES,
  TYPES_MALUS,
  TYPES_MALUS_TACTIQUES,
  TYPES_ZONE,
  cheminPluie,
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
  /**
   * Les modes qui retirent ce groupe du jeu, quoi que l'hote regle: le formulaire ne le
   * propose pas dans ces modes. Les Black Ninjas n'existent pas en Chasse (etape 7.3,
   * imposerLesReglagesDuMode dans packages/shared).
   */
  readonly absentEn?: readonly Mode[];
  /**
   * Les seuls modes ou ce groupe est en jeu. Absent, il l'est dans tous. Les objets du
   * Tactique n'existent que dans le Tactique (etape 7.7).
   */
  readonly presentEn?: readonly Mode[];
  /** Une phrase sous le titre du groupe, pour ce que les champs ne disent pas seuls. */
  readonly note?: string;
}

/** Ce groupe se regle-t-il dans ce mode ? */
export function groupePropose(groupe: GroupeReglages, mode: Mode): boolean {
  return groupe.absentEn?.includes(mode) !== true && groupe.presentEn?.includes(mode) !== false;
}

/**
 * Les champs isoles qu'un mode retire du jeu, quoi que l'hote regle, par chemin. Le
 * Massacre n'a pas de zone de chaos (etape 7.4, imposerLesReglagesDuMode dans
 * packages/shared): les autres natures de zone restent.
 */
const CHAMPS_ABSENTS: Readonly<Partial<Record<Mode, readonly string[]>>> = {
  massacre: ['zones.types.chaos'],
};

/** Ce champ se regle-t-il dans ce mode ? */
export function champPropose(chemin: string, mode: Mode): boolean {
  return CHAMPS_ABSENTS[mode]?.includes(chemin) !== true;
}

/** Le chemin du nombre de faux ninjas au depart, borne par la carte (etape 7.6). */
const CHEMIN_FAUX_NINJAS = 'nombreBotsInitial';

/** Le chemin de la pluie, qui n'a de sens que sur une carte qui en a une (etape 7.6). */
const CHEMIN_PLUIE = 'pluie';

/** Cette valeur de formulaire designe-t-elle une carte jouable ? */
function estUneCarte(carte: string): carte is IdentifiantCarte {
  return Object.hasOwn(CARTES, carte);
}

/**
 * Les bornes d'un champ entier sur la carte choisie.
 *
 * Seul le nombre de faux ninjas en depend: sa borne haute est le plafond de la carte
 * (decision du porteur du projet du 18 septembre 2026). Les autres champs gardent
 * leurs bornes, et une carte inconnue aussi: c'est la validation qui la refuse.
 */
export function bornesSurLaCarte(
  champ: Extract<ChampReglage, { nature: 'entier' }>,
  carte: string,
): Intervalle {
  if (champ.chemin !== CHEMIN_FAUX_NINJAS || !estUneCarte(carte)) {
    return champ.bornes;
  }

  return { minimum: champ.bornes.minimum, maximum: PLAFONDS_DE_FAUX_NINJAS[carte] };
}

/**
 * Ce champ a-t-il un sens sur la carte choisie ?
 *
 * La pluie ne tombe que sur une carte qui a une planche de pluie, Tokyo: ailleurs,
 * l'interrupteur se cache (decision du porteur du projet du 18 septembre 2026). Sa
 * valeur est gardee, sans effet, pour revenir telle quelle si l'hote revient a Tokyo.
 */
export function champUtileSurLaCarte(chemin: string, carte: string): boolean {
  return chemin !== CHEMIN_PLUIE || cheminPluie(carte, false) !== undefined;
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
 * Les six groupes suivent ReglagesPartie. Les libelles des bonus, des malus et
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
          interrupteur(CHEMIN_PLUIE, 'Pluie'),
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
            chemin: CHEMIN_FAUX_NINJAS,
            libelle: 'PNJ au départ',
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
    absentEn: ['chasse'],
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
    titre: 'Objets du Tactique',
    presentEn: ['tactique'],
    note: 'En Tactique, six bonus se partagent la carte : chacun apparaît deux fois moins souvent que son taux.',
    sections: [
      ...TYPES_BONUS_TACTIQUES.map((nature) => ({
        titre: APPARENCE_OBJET[nature].libelle,
        champs: [
          interrupteur(`objetsTactiques.bonus.${nature}.actif`, 'Actif'),
          secondes(`objetsTactiques.bonus.${nature}.dureeS`, 'Durée', BORNES_REGLAGES.bonus.dureeS),
          pourCent(
            `objetsTactiques.bonus.${nature}.tauxApparitionPourCent`,
            'Taux d’apparition',
            BORNES_REGLAGES.bonus.tauxApparitionPourCent,
          ),
        ],
      })),
      ...TYPES_MALUS_TACTIQUES.map((nature) => ({
        titre: APPARENCE_OBJET[nature].libelle,
        champs: [
          interrupteur(`objetsTactiques.malus.${nature}.actif`, 'Actif'),
          secondes(`objetsTactiques.malus.${nature}.dureeS`, 'Durée', BORNES_REGLAGES.malus.dureeS),
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
