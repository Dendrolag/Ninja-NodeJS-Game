/**
 * La sonde de surveillance de la page: ce que le joueur vit, rendu au serveur toutes les dix
 * secondes (étape 5.15).
 *
 * C'EST LE RELEVÉ DE L'ÉTAPE 8.5, CHEZ TOUS LES JOUEURS, SANS SON PANNEAU. Les mêmes points
 * de mesure: l'écart entre deux images, le temps de notre boucle, celui de PixiJS, et ce qui
 * reste (le navigateur, la carte graphique, le ramasse-miettes); l'écart entre deux
 * instantanés reçus, et les images où le lissage attendait le suivant. Mais seulement des
 * cases et des comptes, remis à zéro à chaque bulletin: le serveur additionne, Grafana lit
 * les répartitions.
 *
 * ELLE NE FABRIQUE PAS LES SACCADES QU'ELLE CHERCHE. Des tableaux de taille fixe, préparés à
 * la création: une image ne coûte que quelques comparaisons et additions, et rien n'est
 * alloué avant le bulletin, toutes les dix secondes. Elle ne lit aucune horloge et ne touche
 * pas au document: on lui donne les instants.
 *
 * ELLE NE COMPTE RIEN AVANT LE LEVER DE L'ÉCRAN DE PRÉPARATION. Les premières images d'une
 * partie préparent le décor et la lueur, et rament toujours (recette de l'étape 5.4): le
 * joueur ne les voit pas, et elles feraient un épisode à chaque lancement.
 *
 * UN ONGLET CACHÉ NE SACCADE PAS. Le navigateur y ralentit la boucle sans que le joueur ne
 * voie rien: ses images sont comptées à part, et l'écart qui suit le retour n'est pas
 * compté du tout.
 */

import type {
  BulletinDePage,
  DescriptionDeLAppareil,
  GenreDAppareil,
  MoteurDeRendu,
  Navigateur,
} from '@neon-ninja/shared';
import {
  ALLERS_RETOURS_PAR_BULLETIN,
  CASES_DUREE_D_IMAGE_MS,
  CASES_ECART_INSTANTANES_MS,
  MOTEURS_DE_RENDU,
  SEUIL_IMAGE_LENTE_MS,
  SEUIL_IMAGE_TRES_LENTE_MS,
  SEUIL_INSTANTANE_EN_RETARD_MS,
} from '@neon-ninja/shared';

import type { SondeDImage } from '../rendu/boucle.js';
import type { MesureDImage } from './releve.js';

/** La case d'une valeur parmi ces bornes: la première qui la contient, ou la dernière. */
function caseDe(bornes: readonly number[], valeur: number): number {
  let rang = 0;

  while (rang < bornes.length && valeur > (bornes[rang] ?? 0)) {
    rang += 1;
  }

  return rang;
}

/** La sonde d'une partie. */
export class SondeDeSurveillance implements SondeDImage {
  private readonly casesImages = new Uint32Array(CASES_DUREE_D_IMAGE_MS.length + 1);
  private readonly casesInstantanes = new Uint32Array(CASES_ECART_INSTANTANES_MS.length + 1);
  private readonly allersRetours = new Float64Array(ALLERS_RETOURS_PAR_BULLETIN);
  private nombreDAllersRetours = 0;

  private sommeImages = 0;
  private lentes = 0;
  private tresLentes = 0;
  private cachees = 0;
  private tenues = 0;
  private notreCodeDesLentes = 0;
  private pixiDesLentes = 0;
  private resteDesLentes = 0;
  private pireDuree = 0;
  private pireNotreCode = 0;
  private pirePixi = 0;
  private sommeInstantanes = 0;
  private instantanesEnRetard = 0;
  private ecartMax = 0;
  private entites = 0;
  private erreursDeScript = 0;
  private erreursDePromesse = 0;

  private imagePrecedente: number | undefined;
  private dernierInstantane: number | undefined;
  private pixiEnCours = 0;
  private cachee = false;
  private rideauLeve = false;

  /** L'écran de préparation vient de se lever: le joueur voit la partie, on compte. */
  leverLeRideau(): void {
    this.rideauLeve = true;
    this.imagePrecedente = undefined;
    this.dernierInstantane = undefined;
    this.pixiEnCours = 0;
  }

  /** PixiJS vient de dessiner, en autant de millisecondes. */
  ajouterPixi(dureeMs: number): void {
    this.pixiEnCours += dureeMs;
  }

  /** L'onglet vient d'être caché, ou montré. */
  visibilite(visible: boolean): void {
    this.cachee = !visible;

    // L'écart qui enjambe le passage ne dit rien du jeu.
    this.imagePrecedente = undefined;
    this.dernierInstantane = undefined;
    this.pixiEnCours = 0;
  }

  /** Une image vient d'être jouée. Voir SondeDImage. */
  image(mesure: MesureDImage): void {
    const precedente = this.imagePrecedente;
    const pixi = this.pixiEnCours;
    this.imagePrecedente = mesure.instant;
    this.pixiEnCours = 0;

    if (!this.rideauLeve) {
      return;
    }

    if (this.cachee) {
      this.cachees += 1;
      return;
    }

    if (precedente === undefined) {
      return;
    }

    const duree = mesure.instant - precedente;

    if (!(duree >= 0) || !Number.isFinite(duree)) {
      return;
    }

    if (mesure.tenue) {
      this.tenues += 1;
    }

    const rang = caseDe(CASES_DUREE_D_IMAGE_MS, duree);
    this.casesImages[rang] = (this.casesImages[rang] ?? 0) + 1;
    this.sommeImages += duree;

    if (duree >= SEUIL_IMAGE_LENTE_MS) {
      this.lentes += 1;
      this.notreCodeDesLentes += mesure.notreCodeMs;
      this.pixiDesLentes += pixi;
      this.resteDesLentes += Math.max(duree - mesure.notreCodeMs - pixi, 0);
    }

    if (duree >= SEUIL_IMAGE_TRES_LENTE_MS) {
      this.tresLentes += 1;
    }

    if (duree > this.pireDuree) {
      this.pireDuree = duree;
      this.pireNotreCode = mesure.notreCodeMs;
      this.pirePixi = pixi;
    }
  }

  /** Un instantané de la partie vient d'arriver, à cet instant. */
  instantane(instant: number): void {
    const precedent = this.dernierInstantane;
    this.dernierInstantane = instant;

    if (precedent === undefined || this.cachee || !this.rideauLeve) {
      return;
    }

    const ecart = instant - precedent;
    const rang = caseDe(CASES_ECART_INSTANTANES_MS, ecart);
    this.casesInstantanes[rang] = (this.casesInstantanes[rang] ?? 0) + 1;
    this.sommeInstantanes += ecart;
    this.ecartMax = Math.max(this.ecartMax, ecart);

    if (ecart >= SEUIL_INSTANTANE_EN_RETARD_MS) {
      this.instantanesEnRetard += 1;
    }
  }

  /** Un aller et retour jusqu'au serveur vient d'être mesuré. Au-delà de quatre, ignoré. */
  allerRetour(dureeMs: number): void {
    if (this.nombreDAllersRetours < this.allersRetours.length) {
      this.allersRetours[this.nombreDAllersRetours] = dureeMs;
      this.nombreDAllersRetours += 1;
    }
  }

  /** Le nombre de personnages dessinés en ce moment: le bulletin garde le plus grand. */
  personnages(nombre: number): void {
    this.entites = Math.max(this.entites, nombre);
  }

  /** Une erreur de la page: un script, ou une promesse rejetée que personne n'attendait. */
  erreur(nature: 'script' | 'promesse'): void {
    if (nature === 'script') {
      this.erreursDeScript += 1;
    } else {
      this.erreursDePromesse += 1;
    }
  }

  /** La page a-t-elle quelque chose à dire depuis le dernier bulletin. */
  get aDuNouveau(): boolean {
    return (
      this.casesImages.some((nombre) => nombre > 0) ||
      this.cachees > 0 ||
      this.nombreDAllersRetours > 0
    );
  }

  /**
   * Le bulletin des dix dernières secondes, puis tout repart de zéro, sauf l'instant de la
   * dernière image et du dernier instantané: l'écart suivant se mesure depuis eux.
   *
   * @param son Le son jouait-il.
   */
  bulletin(son: boolean): BulletinDePage {
    const bulletin: BulletinDePage = {
      images: {
        cases: [...this.casesImages],
        sommeMs: this.sommeImages,
        lentes: this.lentes,
        tresLentes: this.tresLentes,
        cachees: this.cachees,
        tenues: this.tenues,
      },
      lentes: {
        notreCodeMs: this.notreCodeDesLentes,
        pixiMs: this.pixiDesLentes,
        resteMs: this.resteDesLentes,
      },
      pire: { dureeMs: this.pireDuree, notreCodeMs: this.pireNotreCode, pixiMs: this.pirePixi },
      instantanes: {
        cases: [...this.casesInstantanes],
        sommeMs: this.sommeInstantanes,
        enRetard: this.instantanesEnRetard,
        ecartMaxMs: this.ecartMax,
      },
      allersRetoursMs: [...this.allersRetours.subarray(0, this.nombreDAllersRetours)],
      entites: this.entites,
      son,
      erreurs: { script: this.erreursDeScript, promesse: this.erreursDePromesse },
    };

    this.casesImages.fill(0);
    this.casesInstantanes.fill(0);
    this.nombreDAllersRetours = 0;
    this.sommeImages = 0;
    this.lentes = 0;
    this.tresLentes = 0;
    this.cachees = 0;
    this.tenues = 0;
    this.notreCodeDesLentes = 0;
    this.pixiDesLentes = 0;
    this.resteDesLentes = 0;
    this.pireDuree = 0;
    this.pireNotreCode = 0;
    this.pirePixi = 0;
    this.sommeInstantanes = 0;
    this.instantanesEnRetard = 0;
    this.ecartMax = 0;
    this.entites = 0;
    this.erreursDeScript = 0;
    this.erreursDePromesse = 0;

    return bulletin;
  }
}

/** Plusieurs sondes branchées sur la même boucle: le relevé et la surveillance. */
export function sondesReunies(...sondes: readonly SondeDImage[]): SondeDImage {
  return {
    image(mesure) {
      for (const sonde of sondes) {
        sonde.image(mesure);
      }
    },
  };
}

/**
 * La famille d'un navigateur, d'après ce qu'il dit de lui. L'ordre compte: Edge et le
 * navigateur de Samsung se disent aussi Chrome, et Chrome se dit aussi Safari.
 */
export function familleDuNavigateur(agent: string): Navigateur {
  if (/\bEdg(e|A|iOS)?\//u.test(agent)) {
    return 'edge';
  }

  if (/\bSamsungBrowser\//u.test(agent)) {
    return 'samsung';
  }

  if (/\b(Firefox|FxiOS)\//u.test(agent)) {
    return 'firefox';
  }

  if (/\b(Chrome|CriOS|Chromium)\//u.test(agent)) {
    return 'chrome';
  }

  if (/\bVersion\/[\d.]+.*\bSafari\//u.test(agent)) {
    return 'safari';
  }

  return 'autre';
}

/**
 * Le genre d'un appareil: un écran tactile au doigt dont le petit côté fait moins de 600
 * pixels est un téléphone, plus grand une tablette; un pointeur précis, un ordinateur.
 */
export function genreDAppareil(tactile: boolean, largeur: number, hauteur: number): GenreDAppareil {
  if (!tactile) {
    return 'ordinateur';
  }

  return Math.min(largeur, hauteur) < 600 ? 'telephone' : 'tablette';
}

/** Ce qu'il faut savoir du navigateur pour décrire l'appareil. */
export interface CeQueDitLeNavigateur {
  readonly agent: string;
  readonly tactile: boolean;
  readonly largeur: number;
  readonly hauteur: number;
  readonly densite: number;
  readonly coeurs?: number;
  readonly memoireGo?: number;
  /** Le nom du moteur de rendu de PixiJS: webgl, webgpu ou canvas. */
  readonly rendu: string;
}

/** La description de l'appareil, envoyée une fois par partie. */
export function decrireLAppareil(navigateur: CeQueDitLeNavigateur): DescriptionDeLAppareil {
  const moteur: MoteurDeRendu =
    MOTEURS_DE_RENDU.find((nom) => nom === navigateur.rendu) ?? 'inconnu';

  return {
    appareil: genreDAppareil(navigateur.tactile, navigateur.largeur, navigateur.hauteur),
    navigateur: familleDuNavigateur(navigateur.agent),
    moteur,
    largeur: Math.round(navigateur.largeur),
    hauteur: Math.round(navigateur.hauteur),
    densite: Math.round(navigateur.densite * 100) / 100,
    ...(navigateur.coeurs === undefined ? {} : { coeurs: navigateur.coeurs }),
    ...(navigateur.memoireGo === undefined ? {} : { memoireGo: navigateur.memoireGo }),
  };
}
