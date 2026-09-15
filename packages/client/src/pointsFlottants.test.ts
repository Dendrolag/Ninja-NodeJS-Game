/**
 * Tests des points flottants.
 *
 * MANQUE RELEVE A LA RECETTE DE L'ETAPE 5.4: les points gagnes ne s'affichaient
 * plus a l'endroit du gain pour filer vers le classement. Le jeu d'origine les
 * montrait dans trois cas (createFloatingPoints, legacy/client.js:1155), repris
 * ici avec ses regles: un faux ninja rallie, un Black Ninja detruit, un joueur
 * capture.
 */

import type { EntiteVue } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { EtatClient } from './etat.js';
import { ETAT_INITIAL } from './etat.js';
import { fait } from './faits.js';
import { pointsDuChangement, texteDesPoints } from './pointsFlottants.js';
import type { VuePartie } from './reconstruction.js';

/** Un joueur pose a un endroit, de cette couleur. */
function joueur(id: string, couleur: string, x = 0, y = 0): EntiteVue {
  return {
    type: 'joueur',
    id,
    x,
    y,
    couleur,
    direction: 'sud',
    pseudo: id,
    invincible: false,
    protege: false,
  };
}

/** Un faux ninja pose a un endroit, de cette couleur. */
function bot(id: string, couleur: string, x = 0, y = 0): EntiteVue {
  return { type: 'bot', id, x, y, couleur, direction: 'nord' };
}

/** Une vue de partie a partir de ses entites. */
function vue(entites: readonly EntiteVue[], tick = 1): VuePartie {
  return {
    tick,
    tempsRestantMs: 60_000,
    enPause: false,
    entites,
    objets: [],
    zones: [],
    classement: [],
  };
}

/** Un etat de client en partie: nous sommes « moi ». */
function etat(modifications: Partial<EtatClient> = {}): EtatClient {
  return { ...ETAT_INITIAL, ecran: 'jeu', moi: 'moi', ...modifications };
}

describe('pointsDuChangement', () => {
  it('montre un point la ou un faux ninja neutre vient de passer a notre couleur', () => {
    const avant = etat({ partie: vue([joueur('moi', '#FF0000'), bot('b1', '#FFFFFF', 40, 60)]) });
    const apres = etat({
      partie: vue([joueur('moi', '#FF0000'), bot('b1', '#FF0000', 42, 61)], 2),
    });

    expect(pointsDuChangement(avant, apres)).toEqual([{ valeur: 1, genre: 'bot', x: 42, y: 61 }]);
  });

  it('ne montre rien pour un faux ninja passe a la couleur d un autre', () => {
    const avant = etat({
      partie: vue([joueur('moi', '#FF0000'), joueur('bob', '#00FF00'), bot('b1', '#FFFFFF')]),
    });
    const apres = etat({
      partie: vue([joueur('moi', '#FF0000'), joueur('bob', '#00FF00'), bot('b1', '#00FF00')], 2),
    });

    expect(pointsDuChangement(avant, apres)).toEqual([]);
  });

  it('ne compte pas un a un les ninjas pris a un joueur: la capture les montre en un seul nombre', () => {
    const avant = etat({
      partie: vue([joueur('moi', '#FF0000'), joueur('bob', '#00FF00'), bot('b1', '#00FF00')]),
    });
    const apres = etat({
      partie: vue([joueur('moi', '#FF0000'), joueur('bob', '#0000FF'), bot('b1', '#FF0000')], 2),
    });

    expect(pointsDuChangement(avant, apres)).toEqual([]);
  });

  it('ne montre rien quand la partie n a pas change', () => {
    const partie = vue([joueur('moi', '#FF0000'), bot('b1', '#FF0000')]);

    expect(pointsDuChangement(etat({ partie }), etat({ partie }))).toEqual([]);
  });

  it('ne montre rien au premier battement d une partie', () => {
    const apres = etat({ partie: vue([joueur('moi', '#FF0000'), bot('b1', '#FF0000')]) });

    expect(pointsDuChangement(etat(), apres)).toEqual([]);
  });

  it('montre les points d un Black Ninja detruit, a l endroit de sa destruction', () => {
    const partie = vue([joueur('moi', '#FF0000')]);
    const detruit = fait('botNoirDetruit', { points: 15, x: 300, y: 200 }, 10);
    const avant = etat({ partie });
    const apres = etat({ partie, journal: [detruit] });

    expect(pointsDuChangement(avant, apres)).toEqual([
      { valeur: 15, genre: 'botNoir', x: 300, y: 200 },
    ]);
  });

  it('montre les ninjas gagnes par une capture, la ou etait le joueur capture', () => {
    const avant = etat({
      partie: vue([joueur('moi', '#FF0000', 10, 10), joueur('bob', '#00FF00', 500, 400)]),
    });
    const capture = fait(
      'captureReussie',
      { victimePseudo: 'bob', botsGagnes: 7, capturesTotal: 1 },
      10,
    );
    const apres = etat({ partie: avant.partie, journal: [capture] });

    expect(pointsDuChangement(avant, apres)).toEqual([
      { valeur: 7, genre: 'joueur', x: 500, y: 400 },
    ]);
  });

  it('ne montre pas deux fois un fait deja connu', () => {
    const partie = vue([joueur('moi', '#FF0000')]);
    const detruit = fait('botNoirDetruit', { points: 15, x: 300, y: 200 }, 10);
    const avant = etat({ partie, journal: [detruit] });

    expect(pointsDuChangement(avant, avant)).toEqual([]);
  });
});

describe('texteDesPoints', () => {
  it('ecrit un gain avec son signe, comme le jeu d origine', () => {
    expect(texteDesPoints(1)).toBe('+1');
    expect(texteDesPoints(15)).toBe('+15');
  });

  it('ecrit zero sans signe', () => {
    expect(texteDesPoints(0)).toBe('0');
  });
});
