/**
 * Repousser les Black Ninjas (etape 7.24, rendu 3B de la planche
 * docs/design/etape-7-24/1-planche.png): une rangee de huit Black Ninjas va et vient en haut de
 * la fenetre, et descend d'un cran a chaque bord. Notre ninja, en bas, lance seul ses shurikens,
 * un a chaque CADENCE_MS; il suit le pointeur (souris ou doigt), ou les fleches gauche et droite
 * tenues.
 *
 * LE RYTHME. Le premier shuriken part a PREMIER_TIR_MS, les suivants a CADENCE_MS d'ecart: le
 * huitieme part a 12 secondes, la duree minimale du serveur, et doit encore voler. Chaque rate
 * coute une cadence.
 *
 * LES BLACK NINJAS RIPOSTENT. Toutes les RIPOSTE_MS, le Black Ninja debout le plus proche lance
 * un shuriken vers la place de notre ninja: il faut bouger. Sans riposte, un joueur immobile au
 * milieu gagnait seul, la rangee passant et repassant au-dessus de ses shurikens.
 *
 * TROIS VIES (demande du porteur du projet, essai du 11 octobre 2026). Une riposte qui touche
 * notre ninja lui en coute une, et efface les ripostes en vol: il a le temps de se remettre.
 *
 * UN ECHEC (la rangee touche le sol, ou la troisieme riposte qui touche) laisse l'ecran perdu
 * une seconde, puis une partie neuve, avec ses trois vies. Rien n'est tire au sort: la rangee part toujours de la meme
 * place, et la riposte vise.
 */

import type { AvancementDuGeste, BaseDeGeste, CommandeDeGeste } from './commun.js';
import { LARGEUR_DU_GESTE, avecEcho } from './commun.js';

/** La rangee: huit Black Ninjas, leur ecart et leur rayon, en unites. */
export const ENVAHISSEURS = 8;
export const ECART_DES_ENVAHISSEURS = 38;
export const RAYON_D_UN_ENVAHISSEUR = 13;

/** La rangee part de cette hauteur, va a cette vitesse, et descend de ce cran a chaque bord. */
export const DEPART_DE_LA_RANGEE = 70;
export const VITESSE_DE_LA_RANGEE = 40;
export const CRAN_DE_LA_RANGEE = 10;

/** Les bords de l'aire, et le sol que la rangee ne doit pas toucher. */
export const BORD_GAUCHE = 20;
export const BORD_DROIT = LARGEUR_DU_GESTE - 20;
export const SOL = 238;

/** Notre ninja: sa ligne, son rayon, sa vitesse au clavier et au pointeur, en unites. */
export const LIGNE_DU_NINJA = 262;
export const RAYON_DU_NINJA = 14;
export const VITESSE_AU_CLAVIER = 220;
export const VITESSE_AU_POINTEUR = 420;

/** Les shurikens: le premier, l'ecart entre deux, leur vitesse en unites par seconde. */
export const PREMIER_TIR_MS = 800;
export const CADENCE_MS = 1600;
export const VITESSE_DU_SHURIKEN = 320;

/** Les ripostes: la premiere, l'ecart entre deux, leur vitesse en unites par seconde. */
export const PREMIERE_RIPOSTE_MS = 2000;
export const RIPOSTE_MS = 1800;
export const VITESSE_DE_LA_RIPOSTE = 150;

/** Une riposte touche notre ninja a cette distance de son centre. */
export const PORTEE_DE_LA_RIPOSTE = RAYON_DU_NINJA + 3;

/** Les vies de notre ninja, et ce que dure son clignotement quand une riposte le touche. */
export const VIES = 3;
export const CLIGNOTEMENT_MS = 600;

/** Ce que dure l'ecran perdu. */
export const PERTE_MS = 1000;

/** Le pas de la simulation, au plus: rien ne traverse rien entre deux. */
const PAS_MS = 16;

/** Un shuriken en vol. */
export interface Shuriken {
  readonly x: number;
  readonly y: number;
}

/** Une riposte en vol: sa place, et sa vitesse en unites par seconde. */
export interface Riposte {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
}

/** Ou en est la partie. */
export interface EtatEnvahisseurs extends BaseDeGeste {
  readonly nature: 'envahisseurs';
  /** L'instant jusqu'ou la partie a avance; absent tant qu'elle n'a pas commence. */
  readonly instant?: number;
  /** Le centre du premier Black Ninja de la rangee, vivant ou non, et la hauteur de la rangee. */
  readonly rangeeX: number;
  readonly rangeeY: number;
  /** Le sens de la rangee: 1 vers la droite, -1 vers la gauche. */
  readonly sens: 1 | -1;
  /** Les Black Ninjas encore debout, par rang dans la rangee. */
  readonly debout: readonly boolean[];
  /** Notre ninja: sa place, et ou il va. */
  readonly ninjaX: number;
  readonly cibleX?: number;
  /** Les fleches tenues: -1, 0 ou 1. */
  readonly clavier: -1 | 0 | 1;
  readonly prochainTir: number;
  readonly shuriken?: Shuriken;
  readonly prochaineRiposte: number;
  readonly ripostes: readonly Riposte[];
  /** Les vies qui restent, et l'instant ou une riposte a touche pour la derniere fois. */
  readonly vies: number;
  readonly toucheA?: number;
  /** Le dernier Black Ninja abattu, pour son eclat. */
  readonly abattu?: { readonly x: number; readonly y: number; readonly instant: number };
  /** La partie perdue, jusqu'a cet instant. */
  readonly perdueJusqua?: number;
}

/** Une partie neuve, pas encore commencee. */
export function creerEnvahisseurs(): EtatEnvahisseurs {
  return { ...partieNeuve(), echos: [] };
}

function partieNeuve(): Omit<EtatEnvahisseurs, 'echos'> {
  return {
    nature: 'envahisseurs',
    rangeeX: LARGEUR_DU_GESTE / 2 - ((ENVAHISSEURS - 1) * ECART_DES_ENVAHISSEURS) / 2,
    rangeeY: DEPART_DE_LA_RANGEE,
    sens: 1,
    debout: Array.from({ length: ENVAHISSEURS }, () => true),
    ninjaX: LARGEUR_DU_GESTE / 2,
    clavier: 0,
    prochainTir: PREMIER_TIR_MS,
    prochaineRiposte: PREMIERE_RIPOSTE_MS,
    ripostes: [],
    vies: VIES,
  };
}

/** Le centre du Black Ninja de ce rang. */
export function centreDUnEnvahisseur(etat: EtatEnvahisseurs, rang: number): number {
  return etat.rangeeX + rang * ECART_DES_ENVAHISSEURS;
}

/** Un pas de simulation de dt millisecondes, qui finit a cet instant. */
function unPas(etat: EtatEnvahisseurs, dt: number, instant: number): EtatEnvahisseurs {
  const secondes = dt / 1000;

  // La rangee va, et descend d'un cran quand ses Black Ninjas debout touchent un bord.
  const rangs = etat.debout.flatMap((debout, rang) => (debout ? [rang] : []));
  let rangeeX = etat.rangeeX + etat.sens * VITESSE_DE_LA_RANGEE * secondes;
  let rangeeY = etat.rangeeY;
  let sens = etat.sens;
  const gauche = rangeeX + (rangs[0] ?? 0) * ECART_DES_ENVAHISSEURS - RAYON_D_UN_ENVAHISSEUR;
  const droite = rangeeX + (rangs.at(-1) ?? 0) * ECART_DES_ENVAHISSEURS + RAYON_D_UN_ENVAHISSEUR;

  if ((sens === 1 && droite >= BORD_DROIT) || (sens === -1 && gauche <= BORD_GAUCHE)) {
    rangeeX -= sens === 1 ? droite - BORD_DROIT : gauche - BORD_GAUCHE;
    sens = sens === 1 ? -1 : 1;
    rangeeY += CRAN_DE_LA_RANGEE;
  }

  // Notre ninja va vers le pointeur, ou au clavier.
  const vitesse = etat.clavier !== 0 ? VITESSE_AU_CLAVIER : VITESSE_AU_POINTEUR;
  const voulu =
    etat.clavier !== 0
      ? etat.ninjaX + etat.clavier * vitesse * secondes
      : (etat.cibleX ?? etat.ninjaX);
  const pas = Math.max(Math.min(voulu - etat.ninjaX, vitesse * secondes), -vitesse * secondes);
  const ninjaX = Math.min(
    Math.max(etat.ninjaX + pas, BORD_GAUCHE + RAYON_DU_NINJA),
    BORD_DROIT - RAYON_DU_NINJA,
  );

  let courant: EtatEnvahisseurs = { ...etat, rangeeX, rangeeY, sens, ninjaX };

  // Le shuriken monte, et abat le premier Black Ninja debout qu'il touche.
  if (courant.shuriken !== undefined) {
    const shuriken = {
      x: courant.shuriken.x,
      y: courant.shuriken.y - VITESSE_DU_SHURIKEN * secondes,
    };
    const touche = rangs.find(
      (rang) =>
        Math.hypot(centreDUnEnvahisseur(courant, rang) - shuriken.x, rangeeY - shuriken.y) <=
        RAYON_D_UN_ENVAHISSEUR + 4,
    );

    if (touche !== undefined) {
      const { shuriken: _tombe, ...sansShuriken } = courant;
      courant = avecEcho(
        {
          ...sansShuriken,
          debout: courant.debout.map((debout, rang) => debout && rang !== touche),
          abattu: { x: centreDUnEnvahisseur(courant, touche), y: rangeeY, instant },
        },
        'abattu',
      );
    } else if (shuriken.y < 0) {
      const { shuriken: _perdu, ...sansShuriken } = courant;
      courant = sansShuriken;
    } else {
      courant = { ...courant, shuriken };
    }
  }

  // Le ninja lance le suivant a sa cadence, s'il reste quelqu'un a abattre.
  if (instant >= courant.prochainTir && courant.debout.some(Boolean)) {
    courant = avecEcho(
      {
        ...courant,
        shuriken: { x: courant.ninjaX, y: LIGNE_DU_NINJA - RAYON_DU_NINJA },
        prochainTir: courant.prochainTir + CADENCE_MS,
      },
      'lancer',
    );
  }

  courant = riposter(courant, secondes, instant);
  const ninja = courant.ninjaX;
  const touche = courant.ripostes.some(
    (riposte) => Math.hypot(riposte.x - ninja, riposte.y - LIGNE_DU_NINJA) <= PORTEE_DE_LA_RIPOSTE,
  );

  if (touche && courant.vies > 1) {
    return avecEcho(
      {
        ...courant,
        vies: courant.vies - 1,
        toucheA: instant,
        ripostes: [],
        prochaineRiposte: Math.max(courant.prochaineRiposte, instant + RIPOSTE_MS),
      },
      'touche',
    );
  }

  if (touche || (courant.debout.some(Boolean) && rangeeY + RAYON_D_UN_ENVAHISSEUR >= SOL)) {
    const { shuriken: _arrete, ...sansShuriken } = courant;
    return avecEcho({ ...sansShuriken, ripostes: [], perdueJusqua: instant + PERTE_MS }, 'perdue');
  }

  return courant;
}

/** Les ripostes volent; a sa cadence, le Black Ninja le plus proche en lance une, visee. */
function riposter(etat: EtatEnvahisseurs, secondes: number, instant: number): EtatEnvahisseurs {
  const ripostes = etat.ripostes
    .map((riposte) => ({
      ...riposte,
      x: riposte.x + riposte.vx * secondes,
      y: riposte.y + riposte.vy * secondes,
    }))
    .filter((riposte) => riposte.y < LIGNE_DU_NINJA + RAYON_DU_NINJA * 2);
  const rangs = etat.debout.flatMap((debout, rang) => (debout ? [rang] : []));

  if (instant < etat.prochaineRiposte || rangs.length === 0) {
    return { ...etat, ripostes };
  }

  const ecart = (rang: number): number => Math.abs(centreDUnEnvahisseur(etat, rang) - etat.ninjaX);
  const lanceur = rangs.reduce((meilleur, rang) =>
    ecart(rang) < ecart(meilleur) ? rang : meilleur,
  );
  const x = centreDUnEnvahisseur(etat, lanceur);
  const y = etat.rangeeY + RAYON_D_UN_ENVAHISSEUR;
  const dx = etat.ninjaX - x;
  const dy = LIGNE_DU_NINJA - y;
  const longueur = Math.max(Math.hypot(dx, dy), 1);

  return {
    ...etat,
    ripostes: [
      ...ripostes,
      {
        x,
        y,
        vx: (dx / longueur) * VITESSE_DE_LA_RIPOSTE,
        vy: (dy / longueur) * VITESSE_DE_LA_RIPOSTE,
      },
    ],
    prochaineRiposte: etat.prochaineRiposte + RIPOSTE_MS,
  };
}

/** Le temps passe jusqu'a maintenant, par petits pas. */
function avancer(etat: EtatEnvahisseurs, maintenant: number): EtatEnvahisseurs {
  if (etat.instant === undefined) {
    return {
      ...etat,
      instant: maintenant,
      prochainTir: maintenant + PREMIER_TIR_MS,
      prochaineRiposte: maintenant + PREMIERE_RIPOSTE_MS,
    };
  }

  let courant = etat;
  let instant = etat.instant;

  while (instant < maintenant) {
    if (courant.perdueJusqua !== undefined) {
      if (maintenant < courant.perdueJusqua) {
        return { ...courant, instant: maintenant };
      }
      const debut = courant.perdueJusqua;
      courant = {
        ...partieNeuve(),
        echos: courant.echos,
        ninjaX: courant.ninjaX,
        clavier: courant.clavier,
        prochainTir: debut + PREMIER_TIR_MS,
        prochaineRiposte: debut + PREMIERE_RIPOSTE_MS,
      };
      instant = debut;
      continue;
    }

    if (!courant.debout.some(Boolean)) {
      break;
    }

    const dt = Math.min(PAS_MS, maintenant - instant);
    instant += dt;
    courant = unPas(courant, dt, instant);
  }

  return { ...courant, instant: maintenant };
}

/** La partie apres une commande. */
export function appliquerEnvahisseurs(
  etat: EtatEnvahisseurs,
  commande: CommandeDeGeste,
  maintenant: number,
): EtatEnvahisseurs {
  const avance = avancer(etat, maintenant);

  switch (commande.type) {
    case 'temps':
      return avance;

    case 'touche': {
      if (commande.touche !== 'gauche' && commande.touche !== 'droite') {
        return avance;
      }
      const sens = commande.touche === 'gauche' ? -1 : 1;
      if (commande.enfoncee) {
        const { cibleX: _oubliee, ...sansCible } = avance;
        return { ...sansCible, clavier: sens };
      }
      return avance.clavier === sens ? { ...avance, clavier: 0 } : avance;
    }

    case 'pointeur':
      return { ...avance, cibleX: commande.x, clavier: 0 };
  }
}

/** Les huit Black Ninjas sont-ils abattus. */
export function envahisseursFinis(etat: EtatEnvahisseurs): boolean {
  return !etat.debout.some(Boolean);
}

/** Les Black Ninjas abattus. */
export function avancementDesEnvahisseurs(etat: EtatEnvahisseurs): AvancementDuGeste {
  return { faits: etat.debout.filter((debout) => !debout).length, total: ENVAHISSEURS };
}
