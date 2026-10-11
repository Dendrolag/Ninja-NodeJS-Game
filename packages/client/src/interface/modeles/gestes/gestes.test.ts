/**
 * Tests des sept gestes des taches courtes d'Among Ninjas (etape 7.21): chacun se finit au
 * pointeur et au clavier, un geste rate ne coute que du temps, et LE PLUS RAPIDE DES JOUEURS NE
 * FINIT JAMAIS SOUS LA DUREE MINIMALE DU SERVEUR, qui le refuserait.
 */

import type { NatureCourte } from '@neon-ninja/shared';
import {
  DUREES_MINIMALES_DES_TACHES_MS,
  NATURES_COURTES,
  NATURES_DE_TACHE,
} from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { CommandeDeGeste, EtatDeGeste } from './index.js';
import {
  AIDES_DES_TACHES,
  TITRES_DES_TACHES,
  appliquerGeste,
  avancementDuGeste,
  creerGeste,
  gesteFini,
  graineDuGeste,
} from './index.js';
import { boutDeLaBorne, boutDeLaPrise, creerCouleurs, hauteurDuRang } from './couleurs.js';
import type { EtatCouleurs } from './couleurs.js';
import {
  BANDE_DE_LA_FUMEE,
  REMPLISSAGE_MS,
  VIDAGE_MS,
  creerFumee,
  niveauDeLaFumee,
} from './fumee.js';
import type { EtatFumee } from './fumee.js';
import { PIERRE, creerKatana } from './katana.js';
import { ALVEOLES, TAS, creerMines } from './mines.js';
import type { EtatMines } from './mines.js';
import { FENETRE_DE_CHARGEMENT, creerMunitions } from './munitions.js';
import { creerLunettes } from './lunettes.js';
import type { EtatFrotte } from './frotter.js';

/** Le pas d'une image, en millisecondes. */
const IMAGE_MS = 16;

/** Une commande du pointeur. */
function pointeur(phase: 'bas' | 'deplace' | 'haut', x: number, y: number): CommandeDeGeste {
  return { type: 'pointeur', phase, x, y };
}

/** Une touche enfoncee, ou relachee. */
function touche(
  nom: 'gauche' | 'droite' | 'haut' | 'bas' | 'espace',
  enfoncee = true,
): CommandeDeGeste {
  return { type: 'touche', touche: nom, enfoncee };
}

/** Applique des commandes a la suite, au meme instant. */
function jouer(
  etat: EtatDeGeste,
  commandes: readonly CommandeDeGeste[],
  maintenant: number,
): EtatDeGeste {
  return commandes.reduce(
    (courant, commande) => appliquerGeste(courant, commande, maintenant),
    etat,
  );
}

/**
 * Joue un geste image par image, chaque image donnant le temps puis les commandes de la
 * strategie, et rend l'instant ou il est fini.
 */
function instantDeFin(
  depart: EtatDeGeste,
  strategie: (etat: EtatDeGeste, maintenant: number) => readonly CommandeDeGeste[],
): number {
  let etat = depart;

  for (let maintenant = 0; maintenant <= 20_000; maintenant += IMAGE_MS) {
    etat = jouer(
      appliquerGeste(etat, { type: 'temps' }, maintenant),
      strategie(etat, maintenant),
      maintenant,
    );

    if (gesteFini(etat, maintenant)) {
      return maintenant;
    }
  }

  throw new Error(`Le geste ${depart.nature} ne s'est pas fini.`);
}

/** Frotter au plus vite au pointeur: de grands allers-retours dans la zone sale suivante. */
function frotterAuPointeur(etat: EtatDeGeste, maintenant: number): readonly CommandeDeGeste[] {
  const frotte = etat as EtatFrotte & EtatDeGeste;
  const rang = frotte.sale.findIndex((reste) => reste > 0);
  const zone = frotte.zones[rang];

  if (zone === undefined) {
    return [];
  }

  const cote = Math.floor(maintenant / IMAGE_MS) % 2 === 0 ? -1 : 1;
  const x = zone.x + cote * zone.rayon * 0.8;

  return frotte.pointeur === undefined
    ? [pointeur('bas', x, zone.y)]
    : [pointeur('deplace', x, zone.y)];
}

/** Les strategies les plus rapides, au pointeur et au clavier, nature par nature. */
const AU_PLUS_VITE: Readonly<
  Record<
    NatureCourte,
    readonly ((etat: EtatDeGeste, maintenant: number) => readonly CommandeDeGeste[])[]
  >
> = {
  katana: [
    () => [touche('droite')],
    () => [pointeur('bas', 100, 190), pointeur('deplace', 300, 190)],
  ],
  lunettes: [() => [touche('espace')], frotterAuPointeur],
  sang: [() => [touche('espace')], frotterAuPointeur],
  couleurs: [
    (etat) => {
      const couleurs = etat as EtatCouleurs;
      const fil = couleurs.relies.indexOf(false);
      const nom = couleurs.noms.indexOf(couleurs.couleurs[fil]?.nom ?? '');
      const depart = boutDeLaPrise(fil);
      const arrivee = boutDeLaBorne(nom);

      return [
        pointeur('bas', depart.x - 20, depart.y),
        pointeur('haut', arrivee.x + 20, arrivee.y),
      ];
    },
  ],
  mines: [
    (etat) => {
      const alveole = ALVEOLES[(etat as EtatMines).rangees.indexOf(false)] ?? ALVEOLES[0];

      return [pointeur('bas', TAS.x, TAS.y), pointeur('haut', alveole?.x ?? 0, alveole?.y ?? 0)];
    },
    () => [touche('espace')],
  ],
  munitions: [
    () => [touche('espace')],
    () => [
      pointeur('bas', 250, 240),
      pointeur('haut', FENETRE_DE_CHARGEMENT.x, FENETRE_DE_CHARGEMENT.y),
    ],
  ],
  fumee: [
    (etat, maintenant) => {
      const fumee = etat as EtatFumee;
      if (fumee.tenuDepuis === undefined) {
        return [touche('espace')];
      }
      return niveauDeLaFumee(fumee, maintenant) >= BANDE_DE_LA_FUMEE.bas
        ? [touche('espace', false)]
        : [];
    },
  ],
};

describe('le rythme des gestes', () => {
  for (const nature of NATURES_COURTES) {
    it(`ne laisse pas finir « ${TITRES_DES_TACHES[nature]} » sous sa duree minimale`, () => {
      for (const strategie of AU_PLUS_VITE[nature]) {
        const fin = instantDeFin(creerGeste(nature, 7), strategie);

        expect(fin).toBeGreaterThanOrEqual(DUREES_MINIMALES_DES_TACHES_MS[nature]);
        // Et un joueur rapide ne se morfond pas: moins de quatre secondes.
        expect(fin).toBeLessThan(4000);
      }
    });
  }

  it('nomme chaque tache et dit son geste, au pointeur et au clavier', () => {
    for (const nature of NATURES_DE_TACHE) {
      expect(TITRES_DES_TACHES[nature].length).toBeGreaterThan(0);
      expect(AIDES_DES_TACHES[nature].pointeur.length).toBeGreaterThan(0);
      expect(AIDES_DES_TACHES[nature].clavier).toMatch(/^Clavier/u);
    }
  });
});

describe('aiguiser un katana', () => {
  it('compte une passe de la garde a la pointe, pas a l envers', () => {
    const droite = jouer(
      creerKatana(),
      [pointeur('bas', 100, 190), pointeur('deplace', 290, 190)],
      0,
    );
    expect(avancementDuGeste(droite)).toEqual({ faits: 1, total: 5 });
    expect(droite.echos).toEqual(['passe']);

    const envers = jouer(
      creerKatana(),
      [pointeur('bas', 320, 190), pointeur('deplace', 120, 190)],
      0,
    );
    expect(avancementDuGeste(envers).faits).toBe(0);
  });

  it('perd la lame qui sort de la pierre, et ne compte pas une passe pendant la precedente', () => {
    const sortie = jouer(
      creerKatana(),
      [pointeur('bas', 100, 190), pointeur('deplace', 200, 20), pointeur('deplace', 300, 190)],
      0,
    );
    expect(avancementDuGeste(sortie).faits).toBe(0);

    const une = jouer(creerKatana(), [touche('droite')], 0);
    expect(avancementDuGeste(jouer(une, [touche('droite')], 100)).faits).toBe(1);
    expect(avancementDuGeste(jouer(une, [touche('droite')], 700)).faits).toBe(2);
    expect(PIERRE.largeur).toBeGreaterThan(0);
  });
});

describe('frotter les lunettes et le sang', () => {
  it('efface un verre en frottant dedans, pas en restant immobile, ni a cote', () => {
    const pose = jouer(creerLunettes(3), [pointeur('bas', 120, 150)], 0);
    const immobile = jouer(pose, [pointeur('deplace', 120, 150)], 5000);
    expect((immobile as EtatFrotte & EtatDeGeste).sale[0]).toBe(1);

    const aCote = jouer(pose, [pointeur('deplace', 200, 290)], 100);
    expect((aCote as EtatFrotte & EtatDeGeste).sale).toEqual([1, 1]);

    const frotte = jouer(pose, [pointeur('deplace', 170, 150)], 400);
    expect((frotte as EtatFrotte & EtatDeGeste).sale[0]).toBeLessThan(1);
  });

  it('frotte au clavier la zone choisie, et passe seule a la suivante une fois propre', () => {
    const tenue = jouer(creerGeste('lunettes', 3), [touche('espace')], 0);
    const premier = jouer(tenue, [{ type: 'temps' }], 1600);
    const etat = premier as EtatFrotte & EtatDeGeste;

    expect(etat.sale[0]).toBe(0);
    expect(etat.choisie).toBe(1);
    expect(avancementDuGeste(premier)).toEqual({ faits: 1, total: 2 });

    const relachee = jouer(premier, [touche('espace', false)], 1600);
    const plusTard = jouer(relachee, [{ type: 'temps' }], 3000);
    expect((plusTard as EtatFrotte & EtatDeGeste).sale[1]).toBe(1);
  });

  it('pose trois taches de sang ecartees, les memes a graine egale', () => {
    expect(creerGeste('sang', 11)).toEqual(creerGeste('sang', 11));

    for (let graine = 0; graine < 200; graine += 1) {
      const sang = creerGeste('sang', graine) as EtatFrotte & EtatDeGeste;

      expect(sang.zones).toHaveLength(3);
      ecartees(sang);
    }
  });
});

/** Les zones d'un frottement, ecartees de 115 unites au moins. */
function ecartees(sang: EtatFrotte): void {
  for (const zone of sang.zones) {
    for (const autre of sang.zones) {
      if (autre !== zone) {
        expect(Math.hypot(zone.x - autre.x, zone.y - autre.y)).toBeGreaterThanOrEqual(115);
      }
    }
  }
}

describe('relier des couleurs', () => {
  it('tire quatre couleurs nommees, et l ordre de leurs noms, de la graine', () => {
    const etat = creerCouleurs(5);

    expect(etat.couleurs).toHaveLength(4);
    expect([...etat.noms].sort()).toEqual(etat.couleurs.map((couleur) => couleur.nom).sort());
    expect(creerCouleurs(5)).toEqual(etat);
  });

  it('branche un fil sur son nom, et ramene celui pose sur un autre', () => {
    const etat = creerCouleurs(5);
    const nom = etat.noms.indexOf(etat.couleurs[0]?.nom ?? '');
    const faux = (nom + 1) % 4;
    const depart = boutDeLaPrise(0);

    const rate = jouer(
      etat,
      [pointeur('bas', depart.x - 10, depart.y), pointeur('haut', 300, hauteurDuRang(faux))],
      0,
    );
    expect(avancementDuGeste(rate).faits).toBe(0);
    expect(rate.echos).toEqual(['ratee']);

    const juste = jouer(
      etat,
      [pointeur('bas', depart.x - 10, depart.y), pointeur('haut', 300, hauteurDuRang(nom))],
      0,
    );
    expect(avancementDuGeste(juste).faits).toBe(1);
    expect(juste.echos).toEqual(['fil']);
  });

  it('se cable au clavier: le fil, droite, le nom, Espace', () => {
    let etat: EtatDeGeste = creerCouleurs(5);
    let maintenant = 0;

    for (let fil = 0; fil < 4; fil += 1) {
      const couleurs = etat as EtatCouleurs;
      const choisi = couleurs.curseur.gauche;
      const nom = couleurs.noms.indexOf(couleurs.couleurs[choisi]?.nom ?? '');
      const descentes = (nom - couleurs.curseur.droite + 4) % 4;

      etat = jouer(
        etat,
        [
          touche('droite'),
          ...Array.from({ length: descentes }, () => touche('bas')),
          touche('espace'),
        ],
        maintenant,
      );
      maintenant += 1000;
    }

    expect(gesteFini(etat, maintenant)).toBe(true);
  });
});

describe('ranger des mines', () => {
  it('range une mine prise au tas dans une alveole vide, et la ramene ailleurs', () => {
    const alveole = ALVEOLES[0] ?? { x: 0, y: 0 };
    const rangee = jouer(
      creerMines(),
      [pointeur('bas', TAS.x, TAS.y), pointeur('haut', alveole.x, alveole.y)],
      0,
    );
    expect(avancementDuGeste(rangee).faits).toBe(1);

    const tombee = jouer(
      creerMines(),
      [pointeur('bas', TAS.x, TAS.y), pointeur('haut', 150, 280)],
      0,
    );
    expect(avancementDuGeste(tombee).faits).toBe(0);

    const deuxFois = jouer(
      rangee,
      [pointeur('bas', TAS.x, TAS.y), pointeur('haut', alveole.x, alveole.y)],
      2000,
    );
    expect(avancementDuGeste(deuxFois).faits).toBe(1);
  });

  it('choisit l alveole aux fleches, et passe seule a la suivante vide', () => {
    const etat = jouer(
      creerMines(),
      [touche('droite'), touche('bas'), touche('espace')],
      0,
    ) as EtatMines;

    expect(etat.rangees).toEqual([false, false, false, true]);
    expect(etat.curseur).toBe(0);
  });
});

describe('recharger des munitions', () => {
  it('insere une cartouche glissee dans la fenetre, pas ailleurs', () => {
    const entree = jouer(
      creerMunitions(),
      [pointeur('bas', 250, 240), pointeur('haut', 150, 132)],
      0,
    );
    expect(avancementDuGeste(entree)).toEqual({ faits: 1, total: 5 });

    const tombee = jouer(
      creerMunitions(),
      [pointeur('bas', 250, 240), pointeur('haut', 350, 40)],
      0,
    );
    expect(avancementDuGeste(tombee).faits).toBe(0);
  });
});

describe('remplir de fumee', () => {
  it('remplit un bonus relache dans la bande, et vide celui relache trop tot ou trop tard', () => {
    const tenu = appliquerGeste(creerFumee(), touche('espace'), 0);
    const plein = appliquerGeste(tenu, touche('espace', false), REMPLISSAGE_MS * 0.75);
    expect(avancementDuGeste(plein).faits).toBe(1);

    const tot = appliquerGeste(tenu, touche('espace', false), REMPLISSAGE_MS * 0.4) as EtatFumee;
    expect(tot.remplis).toBe(0);
    expect(tot.echos).toEqual(['ratee']);
    expect(appliquerGeste(tot, touche('espace'), 100)).toEqual(tot);
    expect(
      (appliquerGeste(tot, touche('espace'), REMPLISSAGE_MS * 0.4 + VIDAGE_MS) as EtatFumee)
        .tenuDepuis,
    ).toBeDefined();

    const deborde = appliquerGeste(tenu, { type: 'temps' }, REMPLISSAGE_MS + 20) as EtatFumee;
    expect(deborde.tenuDepuis).toBeUndefined();
    expect(deborde.echos).toEqual(['ratee']);
  });
});

describe('la graine d un geste', () => {
  it('est la meme pour le meme joueur, la meme station et la meme tache, et change sinon', () => {
    const graine = graineDuGeste('s-A', 'Pierre du jardin zen', 'katana');

    expect(graineDuGeste('s-A', 'Pierre du jardin zen', 'katana')).toBe(graine);
    expect(graineDuGeste('s-B', 'Pierre du jardin zen', 'katana')).not.toBe(graine);
    expect(graineDuGeste('s-A', 'Cuisine du restaurant', 'katana')).not.toBe(graine);
  });
});
