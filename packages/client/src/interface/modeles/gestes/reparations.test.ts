/**
 * Tests des gestes des reparations d'Among Ninjas (etape 7.27): chacun se finit au clavier et au
 * pointeur, un essai rate ne coute que du temps, et LE PLUS RAPIDE DES JOUEURS NE FINIT JAMAIS
 * SOUS LA DUREE MINIMALE DU SERVEUR, qui le refuserait.
 */

import type { GesteDeReparation } from '@neon-ninja/shared';
import { DUREES_MINIMALES_DES_REPARATIONS_MS } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { CommandeDeReparation, EtatDeReparation } from './reparations.js';
import {
  AIDES_DES_REPARATIONS,
  TITRES_DES_REPARATIONS,
  appliquerReparation,
  avancementDeLaReparation,
  creerReparation,
  graineDeLaReparation,
  reparationFinie,
} from './reparations.js';
import {
  CADRAN,
  TOLERANCE_DE_LA_FREQUENCE,
  creerFrequence,
  tenueDeLaFrequence,
} from './frequence.js';
import type { EtatFrequence } from './frequence.js';
import { LEVIER, creerFusibles, fusibleGrille, placeDuFusible } from './fusibles.js';
import type { EtatFusibles } from './fusibles.js';
import { MANETTE, creerInterrupteur } from './interrupteur.js';
import type { EtatInterrupteur } from './interrupteur.js';
import {
  DISJONCTEURS,
  LANCEUR,
  MONTEE_DU_REGIME_MS,
  TOUX_MS,
  ZONE_VERTE,
  creerLanceur,
  disjoncteurQuiClignote,
  regimeDuLanceur,
} from './lanceur.js';
import type { EtatLanceur } from './lanceur.js';
import { BANDE_DE_LA_VANNE, creerPurge, pressionDeLaPurge } from './purge.js';
import type { EtatPurge } from './purge.js';

/** Le pas d'une image, en millisecondes. */
const IMAGE_MS = 16;

/** Les cinq gestes. */
const GESTES: readonly GesteDeReparation[] = [
  'lanceur',
  'fusibles',
  'frequence',
  'purge',
  'interrupteur',
];

/** Une touche enfoncee, ou relachee. */
function touche(
  nom: 'gauche' | 'droite' | 'haut' | 'bas' | 'espace',
  enfoncee = true,
): CommandeDeReparation {
  return { type: 'touche', touche: nom, enfoncee };
}

/** Une commande du pointeur. */
function pointeur(phase: 'bas' | 'deplace' | 'haut', x: number, y: number): CommandeDeReparation {
  return { type: 'pointeur', phase, x, y };
}

/** Le centre d'un rectangle. */
function centre(rectangle: {
  readonly gauche: number;
  readonly haut: number;
  readonly largeur: number;
  readonly hauteur: number;
}): { readonly x: number; readonly y: number } {
  return {
    x: rectangle.gauche + rectangle.largeur / 2,
    y: rectangle.haut + rectangle.hauteur / 2,
  };
}

/**
 * Joue un geste image par image, chaque image donnant le temps puis les commandes de la
 * strategie, et rend l'instant ou il est fini, ou l'infini.
 */
function instantDeFin(
  depart: EtatDeReparation,
  strategie: (etat: EtatDeReparation, maintenant: number) => readonly CommandeDeReparation[],
): number {
  let etat = depart;

  for (let maintenant = 0; maintenant <= 20_000; maintenant += IMAGE_MS) {
    etat = appliquerReparation(etat, { type: 'temps' }, maintenant);
    for (const commande of strategie(etat, maintenant)) {
      etat = appliquerReparation(etat, commande, maintenant);
    }

    if (reparationFinie(etat, maintenant)) {
      return maintenant;
    }
  }

  return Number.POSITIVE_INFINITY;
}

/** Le joueur le plus rapide, au clavier, pour chaque geste. */
function auPlusViteAuClavier(
  etat: EtatDeReparation,
  maintenant: number,
): readonly CommandeDeReparation[] {
  switch (etat.nature) {
    case 'lanceur': {
      const lanceur = etat;
      if (lanceur.demarreA === undefined) {
        // Tirer, et lacher des que l'aiguille entre dans le vert.
        return lanceur.tireDepuis === undefined
          ? [touche('espace')]
          : regimeDuLanceur(lanceur, maintenant) >= ZONE_VERTE.bas
            ? [touche('espace', false)]
            : [];
      }
      return disjoncteurQuiClignote(lanceur, maintenant) === undefined ? [] : [touche('haut')];
    }

    case 'fusibles': {
      const fusibles = etat;
      const grille = [0, 1, 2, 3, 4, 5].find((rang) => fusibleGrille(fusibles, rang));
      if (grille === undefined) {
        return [touche('bas')];
      }
      const { x, y } = centre(placeDuFusible(grille));
      return [pointeur('bas', x, y)];
    }

    case 'frequence': {
      const frequence = etat;
      return [touche(frequence.cible > frequence.valeur ? 'droite' : 'gauche')].concat(
        Math.abs(frequence.cible - frequence.valeur) <= TOLERANCE_DE_LA_FREQUENCE / 2
          ? [touche('droite', false), touche('gauche', false)]
          : [],
      );
    }

    case 'purge': {
      const pression = pressionDeLaPurge(etat, maintenant);
      return pression >= BANDE_DE_LA_VANNE.bas && pression <= BANDE_DE_LA_VANNE.haut
        ? [touche('espace')]
        : [];
    }

    case 'interrupteur':
      return [touche('bas')];
  }
}

describe('les gestes des reparations', () => {
  it('ont chacun un titre et une aide, au pointeur et au clavier', () => {
    for (const geste of GESTES) {
      expect(TITRES_DES_REPARATIONS[geste].length).toBeGreaterThan(0);
      expect(AIDES_DES_REPARATIONS[geste].pointeur.length).toBeGreaterThan(0);
      expect(AIDES_DES_REPARATIONS[geste].clavier).toMatch(/^Clavier/u);
    }
  });

  it('ne finissent jamais sous la duree minimale du serveur, joues au plus vite', () => {
    for (const geste of GESTES) {
      for (const graine of [1, 7, 42, 2026]) {
        const fin = instantDeFin(creerReparation(geste, graine), auPlusViteAuClavier);

        expect(fin, `${geste}, graine ${String(graine)}`).toBeGreaterThanOrEqual(
          DUREES_MINIMALES_DES_REPARATIONS_MS[geste],
        );
        // Mais un joueur rapide finit juste au-dessus, pas des secondes plus tard.
        expect(fin, `${geste}, graine ${String(graine)}`).toBeLessThan(
          DUREES_MINIMALES_DES_REPARATIONS_MS[geste] + 1000,
        );
      }
    }
  });

  it('montrent le meme dessin au meme joueur, au meme poste, et un autre ailleurs', () => {
    expect(graineDeLaReparation('a', 'boitier', 'fusibles')).toBe(
      graineDeLaReparation('a', 'boitier', 'fusibles'),
    );
    expect(graineDeLaReparation('a', 0, 'purge')).not.toBe(graineDeLaReparation('a', 1, 'purge'));
  });

  it('commencent a zero', () => {
    for (const geste of GESTES) {
      expect(avancementDeLaReparation(creerReparation(geste, 3)).faits).toBe(0);
    }
  });
});

describe('relancer le generateur', () => {
  it('tousse si l on lache trop tot ou trop tard, et ne se retire pas pendant la toux', () => {
    let etat: EtatLanceur = creerLanceur(5);
    etat = appliquerReparation(etat, touche('espace'), 0) as EtatLanceur;
    etat = appliquerReparation(etat, touche('espace', false), 300) as EtatLanceur;

    expect(etat.echos).toEqual(['tousse']);
    expect(etat.demarreA).toBeUndefined();
    expect(
      (appliquerReparation(etat, touche('espace'), 400) as EtatLanceur).tireDepuis,
    ).toBeUndefined();

    // Tenu au-dela du plein: le moteur noie.
    let noye = appliquerReparation(etat, touche('espace'), 300 + TOUX_MS) as EtatLanceur;
    noye = appliquerReparation(
      noye,
      { type: 'temps' },
      300 + TOUX_MS + MONTEE_DU_REGIME_MS + 50,
    ) as EtatLanceur;
    expect(noye.echos).toEqual(['tousse', 'tousse']);
  });

  it('demarre au pointeur dans le vert, puis demande les disjoncteurs dans leur ordre', () => {
    const { x, y } = centre(LANCEUR);
    let etat: EtatLanceur = creerLanceur(9);
    etat = appliquerReparation(etat, pointeur('bas', x, y), 0) as EtatLanceur;
    const vert = ((ZONE_VERTE.bas + ZONE_VERTE.haut) / 2) * MONTEE_DU_REGIME_MS;
    etat = appliquerReparation(etat, pointeur('haut', x, y + 100), vert) as EtatLanceur;
    expect(etat.echos).toEqual(['demarre']);

    const apres = vert + 1000;
    const attendu = disjoncteurQuiClignote(etat, apres) as number;
    const faux = (attendu + 1) % 3;
    const rate = appliquerReparation(
      etat,
      pointeur('bas', centre(DISJONCTEURS[faux] as (typeof DISJONCTEURS)[number]).x, 200),
      apres,
    ) as EtatLanceur;
    expect(rate.remontes).toBe(0);
    expect(rate.echos.at(-1)).toBe('ratee');

    const bon = appliquerReparation(
      etat,
      pointeur('bas', centre(DISJONCTEURS[attendu] as (typeof DISJONCTEURS)[number]).x, 200),
      apres,
    ) as EtatLanceur;
    expect(bon.remontes).toBe(1);
    expect(bon.echos.at(-1)).toBe('disjoncteur');
  });

  it('tire l ordre des disjoncteurs de la graine', () => {
    const ordres = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8].map((graine) => creerLanceur(graine).ordre.join('')),
    );
    expect(ordres.size).toBeGreaterThan(1);
  });
});

describe('changer les fusibles', () => {
  it('grille trois fusibles sur six, et ne remplace que ceux-la', () => {
    const etat = creerFusibles(12);
    expect(etat.grilles).toHaveLength(3);

    const bon = [0, 1, 2, 3, 4, 5].find((rang) => !etat.grilles.includes(rang)) as number;
    const { x, y } = centre(placeDuFusible(bon));
    expect((appliquerReparation(etat, pointeur('bas', x, y), 0) as EtatFusibles).remplaces).toEqual(
      [],
    );
  });

  it('se fait au clavier: les fleches choisissent, Espace remplace, puis le levier', () => {
    let etat: EtatFusibles = creerFusibles(3);
    let maintenant = 0;

    for (const grille of etat.grilles) {
      // Remonter en haut a gauche, puis aller au fusible.
      for (const sens of ['haut', 'gauche', 'gauche'] as const) {
        etat = appliquerReparation(etat, touche(sens), maintenant) as EtatFusibles;
      }
      for (let pas = 0; pas < grille % 3; pas += 1) {
        etat = appliquerReparation(etat, touche('droite'), maintenant) as EtatFusibles;
      }
      if (grille >= 3) {
        etat = appliquerReparation(etat, touche('bas'), maintenant) as EtatFusibles;
      }
      etat = appliquerReparation(etat, touche('espace'), maintenant) as EtatFusibles;
      maintenant += 1000;
    }

    expect(etat.remplaces).toHaveLength(3);
    etat = appliquerReparation(etat, touche('bas'), maintenant) as EtatFusibles;
    expect(etat.levierA).toBe(maintenant);
    expect(reparationFinie(etat, maintenant + 999)).toBe(false);
    expect(reparationFinie(etat, maintenant + 1000)).toBe(true);
  });

  it('n abaisse pas le levier avant les fusibles', () => {
    const { x, y } = centre(LEVIER);
    expect(
      (appliquerReparation(creerFusibles(4), pointeur('bas', x, y), 0) as EtatFusibles).levierA,
    ).toBeUndefined();
  });
});

describe('accorder la frequence', () => {
  it('part loin de la cible, et ne s accorde qu une seconde tenue dans la tolerance', () => {
    for (const graine of [1, 2, 3, 4, 5, 6]) {
      const etat = creerFrequence(graine);
      expect(Math.abs(etat.cible - etat.valeur)).toBeGreaterThanOrEqual(0.45);
    }

    const pres: EtatFrequence = { ...creerFrequence(1), valeur: 0.5, consigne: 0.5, cible: 0.5 };
    let etat = appliquerReparation(pres, { type: 'temps' }, 0) as EtatFrequence;
    etat = appliquerReparation(etat, { type: 'temps' }, 900) as EtatFrequence;
    expect(tenueDeLaFrequence(etat, 900)).toBeCloseTo(0.9);
    expect(reparationFinie(etat, 900)).toBe(false);
    etat = appliquerReparation(etat, { type: 'temps' }, 1000) as EtatFrequence;
    expect(reparationFinie(etat, 1000)).toBe(true);
    expect(etat.echos).toEqual(['accord']);
  });

  it('suit la molette et le doigt en rond, a sa vitesse', () => {
    const depart: EtatFrequence = { ...creerFrequence(1), valeur: 0.2, consigne: 0.2, cible: 0.9 };
    let etat = appliquerReparation(depart, { type: 'molette', crans: 5 }, 0) as EtatFrequence;
    expect(etat.consigne).toBeCloseTo(0.4);
    etat = appliquerReparation(etat, { type: 'temps' }, 500) as EtatFrequence;
    expect(etat.valeur).toBeCloseTo(0.31);

    // Un quart de tour du doigt, dans le sens des aiguilles d'une montre.
    let doigt = appliquerReparation(
      depart,
      pointeur('bas', CADRAN.x + 40, CADRAN.y),
      0,
    ) as EtatFrequence;
    doigt = appliquerReparation(
      doigt,
      pointeur('deplace', CADRAN.x, CADRAN.y + 40),
      0,
    ) as EtatFrequence;
    expect(doigt.consigne).toBeCloseTo(0.2 + 0.15);
  });

  it('arrete le cadran quand on lache la fleche', () => {
    const depart: EtatFrequence = { ...creerFrequence(1), valeur: 0.2, consigne: 0.2, cible: 0.9 };
    let etat = appliquerReparation(depart, touche('droite'), 0) as EtatFrequence;
    etat = appliquerReparation(etat, touche('droite', false), 1000) as EtatFrequence;
    const arrete = etat.valeur;
    etat = appliquerReparation(etat, { type: 'temps' }, 3000) as EtatFrequence;
    expect(etat.valeur).toBeCloseTo(arrete);
    expect(arrete).toBeCloseTo(0.42);
  });
});

describe('purger la console', () => {
  it('ne compte un coup de vanne que dans la bande', () => {
    let etat: EtatPurge = appliquerReparation(creerPurge(), { type: 'temps' }, 0) as EtatPurge;
    etat = appliquerReparation(etat, touche('espace'), 100) as EtatPurge;
    expect(etat.coups).toBe(0);
    expect(etat.echos).toEqual(['ratee']);

    const dansLaBande = ((BANDE_DE_LA_VANNE.bas - 0.55) / 0.4) * 1000 + 50;
    etat = appliquerReparation(etat, pointeur('bas', 200, 150), dansLaBande) as EtatPurge;
    expect(etat.coups).toBe(1);
    expect(pressionDeLaPurge(etat, dansLaBande)).toBeLessThan(BANDE_DE_LA_VANNE.bas);
  });

  it('fait sauter la soupape au plein, et garde les coups donnes', () => {
    let etat: EtatPurge = { ...creerPurge(), coups: 1, baseA: 0 };
    etat = appliquerReparation(etat, { type: 'temps' }, 2000) as EtatPurge;
    expect(etat.echos).toEqual(['ratee']);
    expect(pressionDeLaPurge(etat, 2000)).toBeCloseTo(0.55);
    expect(etat.coups).toBe(1);
  });
});

describe('couper l interrupteur', () => {
  it('descend au doigt, a sa vitesse, et claque au bout', () => {
    let etat: EtatInterrupteur = creerInterrupteur();
    etat = appliquerReparation(
      etat,
      pointeur('bas', MANETTE.gauche + 60, 80),
      0,
    ) as EtatInterrupteur;
    etat = appliquerReparation(
      etat,
      pointeur('deplace', MANETTE.gauche + 60, 300),
      0,
    ) as EtatInterrupteur;
    etat = appliquerReparation(etat, { type: 'temps' }, 300) as EtatInterrupteur;
    expect(etat.position).toBeCloseTo(300 / 650);
    expect(reparationFinie(etat, 300)).toBe(false);

    etat = appliquerReparation(etat, { type: 'temps' }, 700) as EtatInterrupteur;
    expect(reparationFinie(etat, 700)).toBe(true);
    expect(etat.echos).toEqual(['declic']);
  });

  it('remonte si on le lache avant le declic', () => {
    let etat: EtatInterrupteur = creerInterrupteur();
    etat = appliquerReparation(etat, touche('bas'), 0) as EtatInterrupteur;
    etat = appliquerReparation(etat, touche('bas', false), 400) as EtatInterrupteur;
    etat = appliquerReparation(etat, { type: 'temps' }, 1000) as EtatInterrupteur;
    expect(etat.position).toBe(0);
    expect(reparationFinie(etat, 1000)).toBe(false);
  });
});
