/**
 * Le relevé de performance d'une partie: ce que le téléphone a vraiment vécu (étape 8.5).
 *
 * IL SÉPARE NOTRE CODE, PIXIJS ET LE RESTE. Une durée d'image seule ne désigne aucun
 * coupable. Le relevé range donc, image par image, l'écart entre deux images (ce que
 * l'œil voit), le temps de notre boucle (dont le rendu et le HUD), et celui que PixiJS
 * passe à dessiner. Ce qui manque entre les deux est le reste: la mise en page du
 * navigateur, la carte graphique, le ramasse-miettes, tout ce qu'aucun chronomètre de la
 * page ne voit.
 *
 * IL SUIT AUSSI LE RÉSEAU. Un dessin fluide où les personnages avancent par à-coups n'est
 * pas un problème de rendu: le relevé compte les instantanés reçus, l'écart entre deux, et
 * les images où le lissage, arrivé au bout de son trajet, attendait le suivant.
 *
 * IL NE FABRIQUE PAS LES SACCADES QU'IL CHERCHE. Tout est rangé dans des histogrammes et
 * des tableaux de taille fixe, préparés à la création: une image ne coûte que quelques
 * additions, et rien n'est alloué pendant la partie. Il ne lit aucune horloge et ne touche
 * pas au document: on lui donne les instants, et il rend du texte.
 */

import { Histogramme } from './histogramme.js';

/** Le seuil d'une image lente, celle que l'œil appelle une saccade, en millisecondes. */
export const SEUIL_SACCADE_MS = 50;

/** La durée à partir de laquelle une image figure parmi les pires: une image et demie à 60 Hz. */
const SEUIL_IMAGE_NOTABLE_MS = 25;

/** La durée d'une fenêtre du déroulé, en millisecondes. */
export const DUREE_FENETRE_MS = 5000;

/** Le nombre de fenêtres retenues: vingt minutes. Au-delà, le déroulé s'arrête. */
const FENETRES = 240;

/** Le nombre de pires images retenues. */
const PIRES = 20;

/** L'écart au-delà duquel un instantané est en retard: deux battements. */
const RETARD_INSTANTANE_MS = 100;

/** Ce que la boucle a mesuré d'une image. */
export interface MesureDImage {
  /** L'instant de l'image, donné par le navigateur, en millisecondes. */
  readonly instant: number;
  /** Le début de l'image: la saisie envoyée, les sons, le lissage, la scène et leur transmission à PixiJS. */
  readonly renduMs: number;
  /** La mise à jour du HUD. */
  readonly hudMs: number;
  /** Toute la boucle, rendu et HUD compris. */
  readonly notreCodeMs: number;
  /** Le lissage était-il au bout de son trajet, à attendre l'instantané suivant. */
  readonly tenue: boolean;
}

/** Ce que le panneau montre, quelques fois par seconde. */
export interface Resume {
  /** Images par seconde sur la fenêtre en cours. */
  readonly cadence: number;
  /** Neuvième décile de la durée d'image, depuis le début. */
  readonly p90: number;
  /** Centile 99 de la durée d'image, depuis le début. */
  readonly p99: number;
  /** Images d'au moins cinquante millisecondes, depuis le début. */
  readonly saccades: number;
}

/** Une fenêtre de cinq secondes du déroulé. */
interface Fenetre {
  images: number;
  lentes: number;
  plusLongue: number;
  notreCode: number;
  pixi: number;
  instantanes: number;
  ecartMax: number;
  entites: number;
}

/** Une des pires images. */
interface PireImage {
  instant: number;
  duree: number;
  notreCode: number;
  pixi: number;
  instantanes: number;
}

/** Le relevé d'une partie. */
export class Releve {
  /** L'écart entre deux images. */
  readonly durees = new Histogramme();
  readonly notreCode = new Histogramme();
  readonly rendu = new Histogramme();
  readonly hud = new Histogramme();
  /** Le temps de PixiJS par image. */
  readonly pixi = new Histogramme();
  /** L'écart entre deux instantanés reçus. */
  readonly ecartsInstantanes = new Histogramme();

  private debut: number | undefined;
  /** L'instant où l'écran de préparation s'est levé, s'il l'a fait. */
  private rideau: number | undefined;
  /** Les images lentes vues par le joueur: après le lever de l'écran de préparation. */
  private lentesApresRideau = 0;
  private imagePrecedente: number | undefined;
  private notreCodePrecedent = 0;
  private pixiEnCours = 0;
  private instantanesEnCours = 0;
  private dernierInstantane: number | undefined;
  private dernierBattement: number | undefined;
  private images = 0;
  private tenues = 0;
  private interruptions = 0;
  private instantanes = 0;
  private battementsSautes = 0;
  private derniereImage = 0;

  private readonly fenetres: Fenetre[] = Array.from({ length: FENETRES }, fenetreVide);
  private readonly pires: PireImage[] = Array.from({ length: PIRES }, () => ({
    instant: 0,
    duree: 0,
    notreCode: 0,
    pixi: 0,
    instantanes: 0,
  }));

  /** Oublie tout: une partie commence. */
  vider(): void {
    for (const histogramme of [
      this.durees,
      this.notreCode,
      this.rendu,
      this.hud,
      this.pixi,
      this.ecartsInstantanes,
    ]) {
      histogramme.vider();
    }

    for (const fenetre of this.fenetres) {
      Object.assign(fenetre, fenetreVide());
    }

    for (const pire of this.pires) {
      pire.duree = 0;
    }

    this.debut = undefined;
    this.rideau = undefined;
    this.lentesApresRideau = 0;
    this.imagePrecedente = undefined;
    this.notreCodePrecedent = 0;
    this.pixiEnCours = 0;
    this.instantanesEnCours = 0;
    this.dernierInstantane = undefined;
    this.dernierBattement = undefined;
    this.images = 0;
    this.tenues = 0;
    this.interruptions = 0;
    this.instantanes = 0;
    this.battementsSautes = 0;
    this.derniereImage = 0;
  }

  /** PixiJS vient de dessiner, en autant de millisecondes. */
  ajouterPixi(dureeMs: number): void {
    this.pixiEnCours += dureeMs;
  }

  /**
   * Un instantané de la partie vient d'arriver.
   *
   * @param instant   Son arrivée, en millisecondes, sur l'horloge des images.
   * @param battement Son numéro de battement: un saut dit des instantanés perdus ou fondus.
   */
  instantane(instant: number, battement: number): void {
    this.instantanes += 1;
    this.instantanesEnCours += 1;

    if (this.dernierInstantane !== undefined) {
      const ecart = instant - this.dernierInstantane;
      this.ecartsInstantanes.ajouter(ecart);

      const fenetre = this.fenetreDe(instant);

      if (fenetre !== undefined) {
        fenetre.instantanes += 1;
        fenetre.ecartMax = Math.max(fenetre.ecartMax, ecart);
      }
    }

    if (this.dernierBattement !== undefined && battement > this.dernierBattement + 1) {
      this.battementsSautes += battement - this.dernierBattement - 1;
    }

    this.dernierInstantane = instant;
    this.dernierBattement = battement;
  }

  /**
   * La page a été cachée: l'écart qui suit ne dit rien du jeu, il n'est pas compté.
   */
  interrompre(): void {
    this.interruptions += 1;
    this.imagePrecedente = undefined;
    this.dernierInstantane = undefined;
    this.pixiEnCours = 0;
  }

  /**
   * L'écran de préparation vient de se lever: le joueur voit la partie. Une image lente
   * d'avant ne se voyait pas; celles d'après se comptent à part.
   */
  leverLeRideau(instant: number): void {
    this.rideau ??= instant;
  }

  /** Le nombre de personnages dessinés, relevé de temps en temps. */
  echantillonner(instant: number, entites: number): void {
    const fenetre = this.fenetreDe(instant);

    if (fenetre !== undefined) {
      fenetre.entites = Math.max(fenetre.entites, entites);
    }
  }

  /** Une image vient d'être jouée. */
  image(mesure: MesureDImage): void {
    this.debut ??= mesure.instant;
    this.images += 1;
    this.derniereImage = mesure.instant;
    this.notreCode.ajouter(mesure.notreCodeMs);
    this.rendu.ajouter(mesure.renduMs);
    this.hud.ajouter(mesure.hudMs);

    if (mesure.tenue) {
      this.tenues += 1;
    }

    const fenetre = this.fenetreDe(mesure.instant);

    if (fenetre !== undefined) {
      fenetre.images += 1;
      fenetre.notreCode += mesure.notreCodeMs;
    }

    if (this.imagePrecedente !== undefined) {
      const duree = mesure.instant - this.imagePrecedente;
      this.durees.ajouter(duree);
      this.pixi.ajouter(this.pixiEnCours);

      if (fenetre !== undefined) {
        fenetre.pixi += this.pixiEnCours;
        fenetre.plusLongue = Math.max(fenetre.plusLongue, duree);
        fenetre.lentes += duree >= SEUIL_SACCADE_MS ? 1 : 0;
      }

      if (this.rideau !== undefined && this.imagePrecedente >= this.rideau) {
        this.lentesApresRideau += duree >= SEUIL_SACCADE_MS ? 1 : 0;
      }

      this.retenirSiPire(mesure.instant - (this.debut ?? 0), duree);
    }

    this.imagePrecedente = mesure.instant;
    this.notreCodePrecedent = mesure.notreCodeMs;
    this.pixiEnCours = 0;
    this.instantanesEnCours = 0;
  }

  /** Ce que le panneau montre. */
  resume(): Resume {
    const debut = this.debut ?? 0;
    const rang = Math.floor((this.derniereImage - debut) / DUREE_FENETRE_MS);
    const fenetre = this.fenetres[Math.min(rang, FENETRES - 1)];
    const ecoule = this.derniereImage - debut - rang * DUREE_FENETRE_MS;

    return {
      cadence:
        fenetre === undefined || ecoule <= 0 ? 0 : Math.round((fenetre.images * 1000) / ecoule),
      p90: this.durees.centile(0.9),
      p99: this.durees.centile(0.99),
      saccades: this.durees.auDela(SEUIL_SACCADE_MS),
    };
  }

  /**
   * Tout le relevé, en texte, prêt à être collé dans le dépôt.
   *
   * @param entete Ce que la page sait de l'appareil, du rendu et de la partie, en paires
   *               libellé et valeur, écrites en tête.
   */
  texte(entete: readonly (readonly [string, string])[]): string {
    const lignes: string[] = ['Relevé de performance Neon Ninja (étape 8.5)', ''];

    for (const [libelle, valeur] of entete) {
      lignes.push(`${libelle}: ${valeur}`);
    }

    const debut = this.debut ?? 0;
    const dureeS = (this.derniereImage - debut) / 1000;
    const mediane = this.durees.centile(0.5);

    lignes.push(
      '',
      '== Images',
      `Durée mesurée: ${nombre(dureeS, 1)} s, ${String(this.images)} images, ${nombre(dureeS > 0 ? this.images / dureeS : 0, 1)} par seconde`,
      `Cadence du navigateur estimée: ${mediane > 0 ? nombre(1000 / mediane, 0) : '?'} Hz (écart médian ${nombre(mediane, 1)} ms)`,
      `Écart entre deux images: ${repartition(this.durees)}`,
      `Images d'au moins 25 ms: ${String(this.durees.auDela(25))}, 50 ms: ${String(this.durees.auDela(SEUIL_SACCADE_MS))}, 100 ms: ${String(this.durees.auDela(100))}, 250 ms: ${String(this.durees.auDela(250))}`,
      `Interruptions (page cachée): ${String(this.interruptions)}`,
      this.rideau === undefined
        ? 'Écran de préparation: pas encore levé'
        : `Écran de préparation levé à ${nombre((this.rideau - debut) / 1000, 2)} s; images d'au moins 50 ms ensuite: ${String(this.lentesApresRideau)}`,
      '',
      '== Où va le temps, par image',
      `Notre code: ${repartition(this.notreCode)}`,
      `  dont saisie, sons, lissage, scène et transmission à PixiJS: ${repartition(this.rendu)}`,
      `  dont HUD: ${repartition(this.hud)}`,
      `PixiJS: ${repartition(this.pixi)}`,
      `Hors de nos chronomètres, en moyenne: ${nombre(Math.max(this.durees.moyenne - this.notreCode.moyenne - this.pixi.moyenne, 0), 2)} ms (l'attente de l'écran, puis le navigateur, la carte graphique, le ramasse-miettes)`,
      '',
      '== Réseau',
      `Instantanés reçus: ${String(this.instantanes)}, ${nombre(dureeS > 0 ? this.instantanes / dureeS : 0, 1)} par seconde, battements sautés: ${String(this.battementsSautes)}`,
      `Écart entre deux instantanés: ${repartition(this.ecartsInstantanes)}`,
      `Instantanés d'au moins ${String(RETARD_INSTANTANE_MS)} ms: ${String(this.ecartsInstantanes.auDela(RETARD_INSTANTANE_MS))}`,
      `Images tenues, le lissage attendant le réseau: ${String(this.tenues)} (${nombre(this.images > 0 ? (100 * this.tenues) / this.images : 0, 1)} %)`,
      '',
      '== Déroulé, par fenêtre de 5 s',
      'début s | images/s | plus longue ms | ≥ 50 ms | notre code ms | PixiJS ms | instantanés/s | écart max ms | personnages',
    );

    const fenetresJouees = Math.min(
      Math.floor((this.derniereImage - debut) / DUREE_FENETRE_MS) + 1,
      FENETRES,
    );

    for (let rang = 0; rang < fenetresJouees && this.images > 0; rang += 1) {
      const fenetre = this.fenetres[rang] as Fenetre;
      // La dernière fenêtre n'est pas finie: ses cadences se rapportent à sa durée jouée.
      const secondes =
        Math.min(this.derniereImage - debut - rang * DUREE_FENETRE_MS, DUREE_FENETRE_MS) / 1000 ||
        DUREE_FENETRE_MS / 1000;
      lignes.push(
        [
          String((rang * DUREE_FENETRE_MS) / 1000),
          nombre(fenetre.images / secondes, 1),
          nombre(fenetre.plusLongue, 1),
          String(fenetre.lentes),
          nombre(fenetre.images > 0 ? fenetre.notreCode / fenetre.images : 0, 2),
          nombre(fenetre.images > 0 ? fenetre.pixi / fenetre.images : 0, 2),
          nombre(fenetre.instantanes / secondes, 1),
          nombre(fenetre.ecartMax, 0),
          String(fenetre.entites),
        ].join(' | '),
      );
    }

    lignes.push(
      '',
      `== Les ${String(PIRES)} pires images, d'au moins ${String(SEUIL_IMAGE_NOTABLE_MS)} ms`,
      'à s | écart ms | notre code ms, image précédente | PixiJS ms | instantanés reçus pendant',
    );

    const pires = this.pires
      .filter((pire) => pire.duree >= SEUIL_IMAGE_NOTABLE_MS)
      .sort((une, autre) => autre.duree - une.duree);

    for (const pire of pires) {
      lignes.push(
        [
          nombre(pire.instant / 1000, 2),
          nombre(pire.duree, 1),
          nombre(pire.notreCode, 2),
          nombre(pire.pixi, 2),
          String(pire.instantanes),
        ].join(' | '),
      );
    }

    return `${lignes.join('\n')}\n`;
  }

  /** La fenêtre du déroulé où tombe cet instant, ou rien avant la première image ou après la dernière fenêtre. */
  private fenetreDe(instant: number): Fenetre | undefined {
    if (this.debut === undefined) {
      return undefined;
    }

    const rang = Math.floor((instant - this.debut) / DUREE_FENETRE_MS);

    return rang >= 0 && rang < FENETRES ? this.fenetres[rang] : undefined;
  }

  /** Retient cette image parmi les pires, si elle en est. Sans allocation: on écrase la moins pire. */
  private retenirSiPire(instant: number, duree: number): void {
    let moinsPire = this.pires[0] as PireImage;

    for (const pire of this.pires) {
      if (pire.duree < moinsPire.duree) {
        moinsPire = pire;
      }
    }

    if (duree <= moinsPire.duree) {
      return;
    }

    moinsPire.instant = instant;
    moinsPire.duree = duree;
    moinsPire.notreCode = this.notreCodePrecedent;
    moinsPire.pixi = this.pixiEnCours;
    moinsPire.instantanes = this.instantanesEnCours;
  }
}

/** Une fenêtre qui n'a encore rien vu. */
function fenetreVide(): Fenetre {
  return {
    images: 0,
    lentes: 0,
    plusLongue: 0,
    notreCode: 0,
    pixi: 0,
    instantanes: 0,
    ecartMax: 0,
    entites: 0,
  };
}

/** Une répartition en une ligne: moyenne, médiane, neuvième décile, centile 99, maximum. */
function repartition(histogramme: Histogramme): string {
  return [
    `moyenne ${nombre(histogramme.moyenne, 2)}`,
    `médiane ${nombre(histogramme.centile(0.5), 1)}`,
    `p90 ${nombre(histogramme.centile(0.9), 1)}`,
    `p99 ${nombre(histogramme.centile(0.99), 1)}`,
    `max ${nombre(histogramme.maximum, 1)} ms`,
  ].join(', ');
}

/** Un nombre à la française, avec autant de décimales. */
export function nombre(valeur: number, decimales: number): string {
  return valeur.toFixed(decimales).replace('.', ',');
}
