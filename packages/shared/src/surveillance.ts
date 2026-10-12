/**
 * Le bulletin de la page: ce que chaque joueur dit de la fluidite de sa partie, toutes les
 * dix secondes (etape 5.15).
 *
 * POURQUOI. Une saccade a trois origines possibles: le serveur, le reseau ou la page. Le
 * serveur voit la premiere; les deux autres ne se voient que chez le joueur. Le releve
 * `?diagnostic=1` les montre sur un appareil, quand on le demande; le bulletin les fait
 * remonter de tous les appareils, pendant chaque partie.
 *
 * CE N'EST PAS UNE COMMANDE DE JEU. Le contrat des messages montants (evenements.ts) ne
 * porte que des intentions, jamais un etat; le bulletin est une exception assumee, parce
 * qu'il ne change rien au jeu: le serveur le compte, l'ecrit dans son journal, et n'en
 * tire aucune decision. Il ne le croit pas pour autant: tout ce qui arrive est verifie,
 * borne, et un bulletin mal forme, trop frequent ou trop gros est ignore et compte.
 *
 * UN TABLEAU DE NOMBRES SUR LE FIL. Une centaine d'octets toutes les dix secondes, a
 * comparer aux vingt instantanes par seconde que la page recoit. Des noms de champs en
 * JSON tripleraient la taille, pour un message que personne ne lit a l'oeil: la page
 * construit un objet, le code en tableau (coderLeBulletin), et le serveur le relit
 * (lireLeBulletin). La premiere case dit le format: un format inconnu est refuse.
 *
 * LA DESCRIPTION DE L'APPAREIL PART A PART, une fois par partie (validerLAppareil): elle ne
 * change pas d'un bulletin a l'autre.
 */

import type { ResultatValidation } from './validation.js';

/** Tous les combien la page envoie son bulletin pendant une partie, en millisecondes. */
export const INTERVALLE_DU_BULLETIN_MS = 10_000;

/**
 * L'ecart minimal entre deux bulletins acceptes d'une meme connexion, en millisecondes. Un
 * peu moins que l'intervalle: les minuteries d'un onglet ne sont pas exactes.
 */
export const ECART_MINIMAL_DES_BULLETINS_MS = 8_000;

/** Tous les combien la page mesure l'aller et retour jusqu'au serveur, en millisecondes. */
export const INTERVALLE_DE_LA_SONDE_MS = 5_000;

/** La taille au-dela de laquelle un bulletin est refuse sans etre lu, en caracteres JSON. */
export const TAILLE_MAXIMALE_DU_BULLETIN = 1024;

/** Le seuil d'une image lente, celle que l'oeil appelle une saccade, en millisecondes. */
export const SEUIL_IMAGE_LENTE_MS = 50;

/** Le seuil d'une image tres lente, qui fait un episode, en millisecondes. */
export const SEUIL_IMAGE_TRES_LENTE_MS = 100;

/** L'ecart a partir duquel un instantane recu est en retard: deux battements. */
export const SEUIL_INSTANTANE_EN_RETARD_MS = 100;

/** L'ecart entre deux instantanes recus qui fait un episode, en millisecondes. */
export const SEUIL_INSTANTANE_TRES_EN_RETARD_MS = 250;

/**
 * Les bornes des cases de la duree d'image, en millisecondes. Une case recoit les durees
 * jusqu'a sa borne comprise; une derniere case recoit le reste. 10 et 20: une image a 120 et
 * a 60 Hz, avec ce que le navigateur y ajoute d'irregularite; 36, une image sur deux a 60 Hz.
 */
export const CASES_DUREE_D_IMAGE_MS = [10, 20, 25, 36, 50, 100, 250] as const;

/** Les bornes des cases de l'ecart entre deux instantanes recus, en millisecondes. */
export const CASES_ECART_INSTANTANES_MS = [45, 55, 75, 100, 150, 250, 500] as const;

/** Les bornes des cases de l'aller et retour jusqu'au serveur, en millisecondes. */
export const CASES_ALLER_RETOUR_MS = [25, 50, 75, 100, 150, 250, 500, 1000] as const;

/** Le nombre maximal de mesures d'aller et retour par bulletin: deux attendues. */
export const ALLERS_RETOURS_PAR_BULLETIN = 4;

/** Les familles de navigateurs, une liste fermee: chacune devient une etiquette. */
export const NAVIGATEURS = ['chrome', 'safari', 'firefox', 'edge', 'samsung', 'autre'] as const;

/** Une famille de navigateurs. */
export type Navigateur = (typeof NAVIGATEURS)[number];

/** Les genres d'appareils. */
export const APPAREILS = ['telephone', 'tablette', 'ordinateur'] as const;

/** Un genre d'appareil. */
export type GenreDAppareil = (typeof APPAREILS)[number];

/** Les moteurs de rendu de PixiJS, et l'inconnu. */
export const MOTEURS_DE_RENDU = ['webgl', 'webgpu', 'canvas', 'inconnu'] as const;

/** Un moteur de rendu. */
export type MoteurDeRendu = (typeof MOTEURS_DE_RENDU)[number];

/** Ce que la page dit de l'appareil, une fois par partie. */
export interface DescriptionDeLAppareil {
  readonly appareil: GenreDAppareil;
  readonly navigateur: Navigateur;
  readonly moteur: MoteurDeRendu;
  /** La definition de l'ecran, en pixels CSS, et sa densite. */
  readonly largeur: number;
  readonly hauteur: number;
  readonly densite: number;
  /** Les coeurs et la memoire annonces, quand le navigateur les donne (Go). */
  readonly coeurs?: number;
  readonly memoireGo?: number;
}

/** Ce que la page a vecu pendant les dix dernieres secondes de sa partie. */
export interface BulletinDePage {
  readonly images: {
    /** Le nombre d'images de chaque case de CASES_DUREE_D_IMAGE_MS, plus la derniere. */
    readonly cases: readonly number[];
    /** La somme de leurs durees, en millisecondes. */
    readonly sommeMs: number;
    /** Les images d'au moins 50 et d'au moins 100 ms. */
    readonly lentes: number;
    readonly tresLentes: number;
    /** Les images jouees onglet cache: non comptees ailleurs, elles ne disent rien. */
    readonly cachees: number;
    /** Les images ou le lissage attendait l'instantane suivant. */
    readonly tenues: number;
  };
  /** Ou est passe le temps des images lentes, en millisecondes, somme sur ces images. */
  readonly lentes: {
    readonly notreCodeMs: number;
    readonly pixiMs: number;
    readonly resteMs: number;
  };
  /** La pire image, et son detail, en millisecondes. Zero sans image. */
  readonly pire: {
    readonly dureeMs: number;
    readonly notreCodeMs: number;
    readonly pixiMs: number;
  };
  readonly instantanes: {
    /** Le nombre d'ecarts de chaque case de CASES_ECART_INSTANTANES_MS, plus la derniere. */
    readonly cases: readonly number[];
    readonly sommeMs: number;
    /** Les ecarts d'au moins SEUIL_INSTANTANE_EN_RETARD_MS. */
    readonly enRetard: number;
    /** Le plus grand ecart, en millisecondes. */
    readonly ecartMaxMs: number;
  };
  /** Les allers et retours mesures, en millisecondes: deux attendus, quatre au plus. */
  readonly allersRetoursMs: readonly number[];
  /** Le plus grand nombre de personnages dessines. */
  readonly entites: number;
  /** Le son jouait-il. */
  readonly son: boolean;
  /** Les erreurs de la page, par nature. */
  readonly erreurs: { readonly script: number; readonly promesse: number };
}

/** Le numero du format du bulletin sur le fil, sa premiere case. */
const FORMAT = 1;

/** La longueur fixe du bulletin code, avant les allers et retours. */
const LONGUEUR_FIXE =
  1 +
  (CASES_DUREE_D_IMAGE_MS.length + 1) +
  5 +
  3 +
  3 +
  (CASES_ECART_INSTANTANES_MS.length + 1) +
  3 +
  4;

/** La plus grande valeur admise dans un bulletin: une heure en millisecondes. */
const VALEUR_MAXIMALE = 3_600_000;

/** Arrondit une duree au dixieme de milliseconde, pour le fil. */
function dixieme(valeur: number): number {
  return Math.round(valeur * 10) / 10;
}

/** Code un bulletin en tableau de nombres, pour le fil. */
export function coderLeBulletin(bulletin: BulletinDePage): number[] {
  const { images, lentes, pire, instantanes, erreurs } = bulletin;

  return [
    FORMAT,
    ...images.cases,
    Math.round(images.sommeMs),
    images.lentes,
    images.tresLentes,
    images.cachees,
    images.tenues,
    Math.round(lentes.notreCodeMs),
    Math.round(lentes.pixiMs),
    Math.round(lentes.resteMs),
    dixieme(pire.dureeMs),
    dixieme(pire.notreCodeMs),
    dixieme(pire.pixiMs),
    ...instantanes.cases,
    Math.round(instantanes.sommeMs),
    instantanes.enRetard,
    Math.round(instantanes.ecartMaxMs),
    bulletin.entites,
    bulletin.son ? 1 : 0,
    erreurs.script,
    erreurs.promesse,
    ...bulletin.allersRetoursMs.slice(0, ALLERS_RETOURS_PAR_BULLETIN).map(Math.round),
  ];
}

/** Un refus de bulletin, avec son motif. */
function refus(motif: string): ResultatValidation<never> {
  return { valide: false, erreurs: [{ champ: 'bulletin', motif }] };
}

/**
 * Relit un bulletin arrive du reseau, ou dit pourquoi il est refuse.
 *
 * Tout est verifie: le format, la longueur, chaque nombre (entier quand c'est un compte,
 * fini, positif, borne), et la coherence des comptes entre eux.
 */
export function lireLeBulletin(brut: unknown): ResultatValidation<BulletinDePage> {
  if (!Array.isArray(brut)) {
    return refus('Le bulletin n’est pas un tableau.');
  }

  if (brut[0] !== FORMAT) {
    return refus('Format de bulletin inconnu.');
  }

  if (brut.length < LONGUEUR_FIXE || brut.length > LONGUEUR_FIXE + ALLERS_RETOURS_PAR_BULLETIN) {
    return refus('Longueur de bulletin inattendue.');
  }

  const nombres: number[] = [];

  for (const valeur of brut as unknown[]) {
    if (
      typeof valeur !== 'number' ||
      !Number.isFinite(valeur) ||
      valeur < 0 ||
      valeur > VALEUR_MAXIMALE
    ) {
      return refus('Valeur de bulletin hors bornes.');
    }

    nombres.push(valeur);
  }

  let curseur = 1;
  const lire = (combien: number): number[] => {
    const tranche = nombres.slice(curseur, curseur + combien);
    curseur += combien;
    return tranche;
  };
  const un = (): number => lire(1)[0] ?? 0;

  const casesImages = lire(CASES_DUREE_D_IMAGE_MS.length + 1);
  const [sommeImages, lentes, tresLentes, cachees, tenues] = lire(5) as [
    number,
    number,
    number,
    number,
    number,
  ];
  const [notreCodeLentes, pixiLentes, resteLentes] = lire(3) as [number, number, number];
  const [pireDuree, pireNotreCode, pirePixi] = lire(3) as [number, number, number];
  const casesInstantanes = lire(CASES_ECART_INSTANTANES_MS.length + 1);
  const [sommeInstantanes, enRetard, ecartMax] = lire(3) as [number, number, number];
  const entites = un();
  const son = un();
  const script = un();
  const promesse = un();
  const allersRetours = nombres.slice(curseur);

  const comptes = [
    ...casesImages,
    lentes,
    tresLentes,
    cachees,
    tenues,
    ...casesInstantanes,
    enRetard,
    entites,
    script,
    promesse,
  ];

  if (!comptes.every(Number.isInteger) || (son !== 0 && son !== 1)) {
    return refus('Un compte du bulletin n’est pas entier.');
  }

  const totalImages = casesImages.reduce((total, nombre) => total + nombre, 0);
  const totalInstantanes = casesInstantanes.reduce((total, nombre) => total + nombre, 0);

  if (
    tresLentes > lentes ||
    lentes > totalImages ||
    tenues > totalImages + cachees ||
    enRetard > totalInstantanes
  ) {
    return refus('Les comptes du bulletin ne s’accordent pas.');
  }

  return {
    valide: true,
    valeur: {
      images: { cases: casesImages, sommeMs: sommeImages, lentes, tresLentes, cachees, tenues },
      lentes: { notreCodeMs: notreCodeLentes, pixiMs: pixiLentes, resteMs: resteLentes },
      pire: { dureeMs: pireDuree, notreCodeMs: pireNotreCode, pixiMs: pirePixi },
      instantanes: {
        cases: casesInstantanes,
        sommeMs: sommeInstantanes,
        enRetard,
        ecartMaxMs: ecartMax,
      },
      allersRetoursMs: allersRetours,
      entites,
      son: son === 1,
      erreurs: { script, promesse },
    },
  };
}

/** Une valeur d'une liste fermee, ou rien. */
function parmi<T extends string>(liste: readonly T[], valeur: unknown): T | undefined {
  return liste.find((element) => element === valeur);
}

/** Un nombre fini dans ces bornes, ou rien. */
function borne(valeur: unknown, minimum: number, maximum: number): number | undefined {
  return typeof valeur === 'number' &&
    Number.isFinite(valeur) &&
    valeur >= minimum &&
    valeur <= maximum
    ? valeur
    : undefined;
}

/**
 * Relit la description d'un appareil arrivee du reseau, ou dit pourquoi elle est refusee.
 * Les coeurs et la memoire sont facultatifs: tous les navigateurs ne les donnent pas.
 */
export function validerLAppareil(brut: unknown): ResultatValidation<DescriptionDeLAppareil> {
  if (typeof brut !== 'object' || brut === null || Array.isArray(brut)) {
    return refus('La description de l’appareil n’est pas un objet.');
  }

  const source = brut as Record<string, unknown>;
  const appareil = parmi(APPAREILS, source['appareil']);
  const navigateur = parmi(NAVIGATEURS, source['navigateur']);
  const moteur = parmi(MOTEURS_DE_RENDU, source['moteur']);
  const largeur = borne(source['largeur'], 0, 20_000);
  const hauteur = borne(source['hauteur'], 0, 20_000);
  const densite = borne(source['densite'], 0, 10);
  const coeurs = source['coeurs'] === undefined ? undefined : borne(source['coeurs'], 1, 512);
  const memoireGo =
    source['memoireGo'] === undefined ? undefined : borne(source['memoireGo'], 0, 1024);

  if (
    appareil === undefined ||
    navigateur === undefined ||
    moteur === undefined ||
    largeur === undefined ||
    hauteur === undefined ||
    densite === undefined ||
    (source['coeurs'] !== undefined && coeurs === undefined) ||
    (source['memoireGo'] !== undefined && memoireGo === undefined)
  ) {
    return refus('La description de l’appareil est mal formée.');
  }

  return {
    valide: true,
    valeur: {
      appareil,
      navigateur,
      moteur,
      largeur: Math.round(largeur),
      hauteur: Math.round(hauteur),
      densite: Math.round(densite * 100) / 100,
      ...(coeurs === undefined ? {} : { coeurs: Math.round(coeurs) }),
      ...(memoireGo === undefined ? {} : { memoireGo }),
    },
  };
}
