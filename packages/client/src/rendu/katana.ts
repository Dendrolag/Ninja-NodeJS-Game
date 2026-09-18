/**
 * Ce que le mode Massacre ajoute a une image (etape 7.4): la trainee des coups de katana,
 * l'eclat des morts, les cadavres, le sang et la secousse de la camera.
 *
 * FONCTION PURE, COMME LA SCENE DONT ELLE EST UNE PARTIE. Tout se lit dans le journal des
 * faits: un coup de katana dit d'ou il est parti, dans quelle direction, et ce qu'il a tue;
 * un joueur tue dit ou il est tombe. L'age d'un fait decide de ce qui se voit encore.
 *
 * LE SANG SE DIT DE DEUX FACONS, SELON LE REGLAGE DU JOUEUR. Au niveau normal, chaque
 * eclaboussure est une TACHE A IMPRIMER: le rendu la pose une fois pour toutes sur le calque
 * du sol, ou elle reste jusqu'a la fin de la partie, et ne coute plus rien ensuite. Au
 * niveau discret, c'est une petite tache dessinee a chaque image, qui s'efface d'elle-meme.
 * Desactive, seul l'eclat reste.
 */

import type { Couleur, Orientation } from '@neon-ninja/shared';
import { COMBO, MASSACRE, RACINE_RESSOURCES, cheminNinja } from '@neon-ninja/shared';

import type { EtatClient } from '../etat.js';
import type { FaitDeJeu } from '../faits.js';
import type { NiveauDeSang } from '../interface/preferences.js';
import { APPARENCE_KATANA, TAILLE_SPRITE } from './apparence.js';
import type { FormeDeSang } from './sang.js';
import { eclaboussure } from './sang.js';
import type { ConeScene, DisqueScene, SpriteScene } from './scene.js';
import { couleurEnNombre } from './scene.js';

/** Une tache de sang a imprimer une fois sur le calque du sol. */
export interface TacheScene {
  /** Identifiant stable: le rendu n'imprime jamais deux fois la meme tache. */
  readonly id: string;
  /** Ou le sang a coule, et quand: les traces de pas s'en servent. */
  readonly x: number;
  readonly y: number;
  readonly instant: number;
  readonly formes: readonly FormeDeSang[];
}

/** Ce que le Massacre ajoute a une image. */
export interface ImageDuMassacre {
  readonly cones: readonly ConeScene[];
  readonly disques: readonly DisqueScene[];
  readonly cadavres: readonly SpriteScene[];
  readonly sang: readonly TacheScene[];
  /** Le decalage de la camera, en pixels de carte. Nul hors d'une secousse. */
  readonly secousse: { readonly x: number; readonly y: number };
}

/** Une image sans rien du Massacre. */
export const RIEN_DU_MASSACRE: ImageDuMassacre = {
  cones: [],
  disques: [],
  cadavres: [],
  sang: [],
  secousse: { x: 0, y: 0 },
};

/** La direction de chaque orientation, en radians. L'axe des y descend. */
export const ANGLES_DES_ORIENTATIONS: Readonly<Record<Orientation, number>> = {
  est: 0,
  sud_est: Math.PI / 4,
  sud: Math.PI / 2,
  sud_ouest: (3 * Math.PI) / 4,
  ouest: Math.PI,
  nord_ouest: (-3 * Math.PI) / 4,
  nord: -Math.PI / 2,
  nord_est: -Math.PI / 4,
};

/** Pendant combien de temps une tache de sang est proposee a l'impression. */
const DELAI_D_IMPRESSION_MS = 1000;

/** La demi-ouverture de l'arc du katana, en radians: 80 degres. */
export const DEMI_ARC_DU_KATANA = (MASSACRE.ANGLE_DU_KATANA_DEGRES / 2) * (Math.PI / 180);

/**
 * Ce que le Massacre ajoute a l'image de cet instant.
 *
 * @param etat       L'etat du client, dont le journal des faits.
 * @param maintenant Instant local.
 * @param niveau     Le sang que le joueur veut voir.
 */
export function imageDuMassacre(
  etat: EtatClient,
  maintenant: number,
  niveau: NiveauDeSang,
): ImageDuMassacre {
  if (etat.salon?.mode !== 'massacre') {
    return RIEN_DU_MASSACRE;
  }

  const cones: ConeScene[] = [];
  const disques: DisqueScene[] = [];
  const cadavres: SpriteScene[] = [];
  const sang: TacheScene[] = [];
  let secousse = { x: 0, y: 0 };

  etat.journal.forEach((fait, rang) => {
    const age = maintenant - fait.instant;

    if (age < 0) {
      return;
    }

    if (fait.nature === 'joueurTranche') {
      const { x, y, orientation, victime } = fait.charge;
      const id = `tranche:${victime}:${String(Math.round(x))}:${String(Math.round(y))}`;
      saigner(
        id,
        x,
        y,
        ANGLES_DES_ORIENTATIONS[orientation],
        fait.instant,
        age,
        niveau,
        sang,
        disques,
      );
      eclater(id, x, y, age, disques);
      return;
    }

    if (fait.nature !== 'coupDeKatana') {
      return;
    }

    const coup = fait.charge;
    const angle = ANGLES_DES_ORIENTATIONS[coup.orientation];
    cones.push(...trainee(`coup:${coup.frappeur}:${String(rang)}`, coup, angle, age));

    for (const mort of coup.morts) {
      const direction = Math.atan2(mort.y - coup.y, mort.x - coup.x);
      saigner(mort.id, mort.x, mort.y, direction, fait.instant, age, niveau, sang, disques);
      eclater(mort.id, mort.x, mort.y, age, disques);

      if (niveau !== 'desactive') {
        const cadavre = cadavreDe(mort.id, mort.x, mort.y, direction, age, mort.couleur);
        if (cadavre !== undefined) {
          cadavres.push(cadavre);
        }
      }
    }

    if (coup.frappeur === etat.moi && coup.morts.length > 0) {
      secousse = secousseDe(age, coup.multiplicateur, secousse);
    }
  });

  return { cones, disques, cadavres, sang, secousse };
}

/**
 * La trainee d'un coup: une lame claire qui balaie l'arc d'un bord a l'autre, et l'arc entier
 * qui s'efface derriere elle. Plus rouge a mesure que le multiplicateur monte.
 */
function trainee(
  id: string,
  coup: { readonly x: number; readonly y: number; readonly multiplicateur: number },
  angle: number,
  age: number,
): readonly ConeScene[] {
  const { trainee: reglage } = APPARENCE_KATANA;
  const avancee = age / reglage.dureeMs;

  if (avancee >= 1) {
    return [];
  }

  const opacite = 1 - avancee;
  const couleur =
    coup.multiplicateur >= COMBO.MULTIPLICATEUR_MAXIMUM
      ? reglage.couleurDuCombo
      : coup.multiplicateur > 1
        ? 0xff9a9a
        : reglage.couleur;

  return [
    {
      id: `${id}:arc`,
      x: coup.x,
      y: coup.y,
      angle,
      demiOuverture: DEMI_ARC_DU_KATANA,
      rayon: MASSACRE.PORTEE_DU_KATANA_PX,
      remplissage: { couleur, alpha: opacite * reglage.alphaDeLArc },
      contour: undefined,
    },
    {
      id: `${id}:lame`,
      x: coup.x,
      y: coup.y,
      angle: angle - DEMI_ARC_DU_KATANA + 2 * DEMI_ARC_DU_KATANA * Math.min(avancee * 1.4, 1),
      demiOuverture: reglage.demiLargeur,
      rayon: MASSACRE.PORTEE_DU_KATANA_PX * 1.05,
      remplissage: { couleur, alpha: opacite * 0.8 },
      contour: { couleur: 0xffffff, alpha: opacite * 0.9, epaisseur: 2 },
    },
  ];
}

/** L'eclat d'une mort: un disque clair qui grandit en s'effacant. */
function eclater(id: string, x: number, y: number, age: number, disques: DisqueScene[]): void {
  const { eclat } = APPARENCE_KATANA;
  const avancee = age / eclat.dureeMs;

  if (avancee >= 1) {
    return;
  }

  disques.push({
    id: `${id}:eclat`,
    x,
    y,
    rayon: eclat.rayonDeDepart + (eclat.rayonDArrivee - eclat.rayonDeDepart) * avancee,
    remplissage: { couleur: eclat.couleur, alpha: (1 - avancee) * 0.55 },
    contour: { couleur: 0xff3040, alpha: (1 - avancee) * 0.8, epaisseur: 2 },
  });
}

/**
 * Le sang d'une mort, selon le reglage du joueur: une tache a imprimer, une petite tache qui
 * s'efface, ou rien.
 */
function saigner(
  id: string,
  x: number,
  y: number,
  angle: number,
  instant: number,
  age: number,
  niveau: NiveauDeSang,
  sang: TacheScene[],
  disques: DisqueScene[],
): void {
  if (niveau === 'normal') {
    // Une tache s'imprime a la premiere image qui la voit: la proposer pendant une seconde
    // suffit, et evite de redessiner a chaque image le sang de tout le journal.
    if (age < DELAI_D_IMPRESSION_MS) {
      sang.push({ id, x, y, instant, formes: eclaboussure(id, x, y, angle) });
    }
    return;
  }

  const { sangDiscret } = APPARENCE_KATANA;

  if (niveau === 'desactive' || age >= sangDiscret.dureeMs) {
    return;
  }

  const restant = 1 - age / sangDiscret.dureeMs;

  eclaboussure(id, x, y, angle, sangDiscret.echelle).forEach((forme, rang) => {
    disques.push({
      id: `${id}:sang:${String(rang)}`,
      x: forme.x,
      y: forme.y,
      rayon: Math.max(forme.rayonX, forme.rayonY),
      remplissage: { couleur: forme.couleur, alpha: forme.alpha * restant },
      contour: undefined,
    });
  });
}

/** Le cadavre d'un ninja: couche dans le sens du coup, assombri, et qui s'efface. */
function cadavreDe(
  id: string,
  x: number,
  y: number,
  direction: number,
  age: number,
  couleur: Couleur,
): SpriteScene | undefined {
  const { cadavre } = APPARENCE_KATANA;

  if (age >= cadavre.dureeMs) {
    return undefined;
  }

  const restant = cadavre.dureeMs - age;

  return {
    id: `${id}:cadavre`,
    texture: `${RACINE_RESSOURCES}/${cheminNinja('immobile')}`,
    x,
    y,
    taille: TAILLE_SPRITE,
    teinte: assombrir(couleurEnNombre(couleur), cadavre.assombrissement),
    alpha: cadavre.alpha * Math.min(restant / cadavre.effacementMs, 1),
    rotation: direction + Math.PI / 2,
  };
}

/**
 * La secousse de la camera quand notre coup tranche: breve, et un peu plus forte a chaque
 * cran du multiplicateur. Une seule, la plus forte, si deux coups se chevauchent.
 */
function secousseDe(
  age: number,
  multiplicateur: number,
  actuelle: { readonly x: number; readonly y: number },
): { readonly x: number; readonly y: number } {
  const { secousse } = APPARENCE_KATANA;

  if (age >= secousse.dureeMs) {
    return actuelle;
  }

  const amplitude =
    secousse.amplitudePx *
    (1 + secousse.parCran * (multiplicateur - 1)) *
    (1 - age / secousse.dureeMs);
  const nouvelle = { x: Math.sin(age * 0.9) * amplitude, y: Math.cos(age * 1.3) * amplitude };

  return Math.hypot(nouvelle.x, nouvelle.y) > Math.hypot(actuelle.x, actuelle.y)
    ? nouvelle
    : actuelle;
}

/** Un micro-arret en cours: l'instant ou le mouvement affiche s'est fige, et sa fin. */
export interface MicroArret {
  readonly depuis: number;
  readonly jusqua: number;
}

/**
 * Le micro-arret de l'impact: quand notre coup de katana tranche, le mouvement affiche se
 * fige quelques dizaines de millisecondes. Un nouveau coup qui tranche en relance un;
 * fini, il disparait.
 *
 * @param enCours   Le micro-arret de l'image precedente, s'il y en avait un.
 * @param faits     Les faits arrives depuis l'image precedente.
 * @param moi       Notre identifiant.
 * @param maintenant Instant local.
 */
export function suivreLeMicroArret(
  enCours: MicroArret | undefined,
  faits: readonly FaitDeJeu[],
  moi: string | undefined,
  maintenant: number,
): MicroArret | undefined {
  const tranche = faits.some(
    (fait) =>
      fait.nature === 'coupDeKatana' &&
      fait.charge.frappeur === moi &&
      fait.charge.morts.length > 0,
  );

  if (tranche) {
    return { depuis: maintenant, jusqua: maintenant + APPARENCE_KATANA.microArretMs };
  }

  return enCours !== undefined && maintenant < enCours.jusqua ? enCours : undefined;
}

/** L'instant que le lissage doit montrer: fige pendant un micro-arret, sinon maintenant. */
export function instantAffiche(microArret: MicroArret | undefined, maintenant: number): number {
  return microArret !== undefined && maintenant < microArret.jusqua
    ? microArret.depuis
    : maintenant;
}

/** Une couleur assombrie: chaque composante multipliee par ce facteur, de zero a un. */
function assombrir(couleur: number, facteur: number): number {
  const composante = (decalage: number): number =>
    Math.round(((couleur >> decalage) & 0xff) * facteur) << decalage;

  return composante(16) | composante(8) | composante(0);
}
