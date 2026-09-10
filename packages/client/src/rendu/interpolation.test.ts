/**
 * Tests du lissage.
 *
 * Ce qu'ils protegent, dans l'ordre: qu'on interpole bien entre deux etats
 * recus, qu'on n'extrapole JAMAIS au-dela du dernier, et qu'une reapparition a
 * l'autre bout de la carte ne se traduise pas par un glissement a travers les
 * murs.
 */

import type { EntiteVue } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { VuePartie } from '../reconstruction.js';
import { TamponDeLissage, lisserUneEntite } from './interpolation.js';

/** Un joueur pose a un endroit. */
function joueur(id: string, x: number, y: number): EntiteVue {
  return {
    type: 'joueur',
    id,
    x,
    y,
    couleur: '#FF0000',
    direction: 'est',
    pseudo: id,
    invincible: false,
    protege: false,
  };
}

/** Une vue de partie a un battement donne. */
function vue(tick: number, entites: readonly EntiteVue[]): VuePartie {
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

describe('TamponDeLissage', () => {
  it('ne rend rien tant qu aucun battement n est arrive', () => {
    expect(new TamponDeLissage().vueLissee(0)).toBeUndefined();
  });

  it('affiche le premier battement tel quel, faute de precedent', () => {
    const tampon = new TamponDeLissage();
    tampon.observer(vue(1, [joueur('moi', 100, 200)]), 1_000);

    const rendue = tampon.vueLissee(1_020);

    expect(rendue?.entites[0]?.x).toBe(100);
    expect(rendue?.entites[0]?.y).toBe(200);
  });

  it('place l entite a mi-chemin a la moitie de l intervalle', () => {
    const tampon = new TamponDeLissage();
    tampon.observer(vue(1, [joueur('moi', 0, 0)]), 1_000);
    tampon.observer(vue(2, [joueur('moi', 100, 50)]), 1_050);

    const rendue = tampon.vueLissee(1_075);

    expect(rendue?.entites[0]?.x).toBeCloseTo(50);
    expect(rendue?.entites[0]?.y).toBeCloseTo(25);
  });

  it('part de la position precedente au moment exact de l arrivee', () => {
    const tampon = new TamponDeLissage();
    tampon.observer(vue(1, [joueur('moi', 0, 0)]), 1_000);
    tampon.observer(vue(2, [joueur('moi', 100, 0)]), 1_050);

    expect(tampon.vueLissee(1_050)?.entites[0]?.x).toBeCloseTo(0);
  });

  it('n extrapole jamais au-dela du dernier etat recu', () => {
    // Le point de fond de tout le fichier. Si les messages s'arretent, on se fige
    // sur ce que le serveur a dit, on ne prolonge pas le mouvement.
    const tampon = new TamponDeLissage();
    tampon.observer(vue(1, [joueur('moi', 0, 0)]), 1_000);
    tampon.observer(vue(2, [joueur('moi', 100, 0)]), 1_050);

    expect(tampon.vueLissee(1_100)?.entites[0]?.x).toBe(100);
    expect(tampon.vueLissee(5_000)?.entites[0]?.x).toBe(100);
  });

  it('mesure l intervalle reel plutot que de le supposer', () => {
    // Un serveur qui bat toutes les cent millisecondes doit donner un lissage
    // etale sur cent millisecondes, sans quoi l'affichage rattrape trop vite et
    // se fige la moitie du temps.
    const tampon = new TamponDeLissage();
    tampon.observer(vue(1, [joueur('moi', 0, 0)]), 1_000);
    tampon.observer(vue(2, [joueur('moi', 100, 0)]), 1_100);

    expect(tampon.vueLissee(1_150)?.entites[0]?.x).toBeCloseTo(50);
  });

  it('ignore une vue deja observee', () => {
    const tampon = new TamponDeLissage();
    const premiere = vue(1, [joueur('moi', 0, 0)]);
    const seconde = vue(2, [joueur('moi', 100, 0)]);

    tampon.observer(premiere, 1_000);
    tampon.observer(seconde, 1_050);
    // La meme vue relue a l'image suivante ne doit pas faire glisser le tampon,
    // sans quoi le lissage repartirait de zero soixante fois par seconde.
    tampon.observer(seconde, 1_060);

    expect(tampon.vueLissee(1_075)?.entites[0]?.x).toBeCloseTo(50);
  });

  it('repart de zero quand une nouvelle partie recommence les battements', () => {
    const tampon = new TamponDeLissage();
    tampon.observer(vue(40, [joueur('moi', 900, 900)]), 1_000);
    tampon.observer(vue(41, [joueur('moi', 950, 900)]), 1_050);
    tampon.observer(vue(1, [joueur('moi', 100, 100)]), 2_000);

    // Sans remise a zero, l'affichage lisserait entre la fin de l'ancienne partie
    // et le debut de la nouvelle: un glissement de huit cents pixels.
    expect(tampon.vueLissee(2_020)?.entites[0]?.x).toBe(100);
  });

  it('oublie tout quand la partie disparait de l etat', () => {
    const tampon = new TamponDeLissage();
    tampon.observer(vue(1, [joueur('moi', 0, 0)]), 1_000);
    tampon.observer(undefined, 1_050);

    expect(tampon.vueLissee(1_060)).toBeUndefined();
  });

  it('affiche une entite qui vient d apparaitre a sa place, sans la faire glisser', () => {
    const tampon = new TamponDeLissage();
    tampon.observer(vue(1, [joueur('moi', 0, 0)]), 1_000);
    tampon.observer(vue(2, [joueur('moi', 10, 0), joueur('nouveau', 800, 600)]), 1_050);

    const nouveau = tampon.vueLissee(1_060)?.entites.find(({ entite }) => entite.id === 'nouveau');

    expect(nouveau?.x).toBe(800);
    expect(nouveau?.y).toBe(600);
  });

  it('laisse tomber une entite absente du dernier battement', () => {
    const tampon = new TamponDeLissage();
    tampon.observer(vue(1, [joueur('moi', 0, 0), joueur('parti', 50, 50)]), 1_000);
    tampon.observer(vue(2, [joueur('moi', 10, 0)]), 1_050);

    expect(tampon.vueLissee(1_060)?.entites.map(({ entite }) => entite.id)).toEqual(['moi']);
  });
});

describe('lisserUneEntite', () => {
  const cible = joueur('moi', 100, 0);

  it('interpole un deplacement ordinaire', () => {
    const rendue = lisserUneEntite(cible, { x: 0, y: 0 }, 0.25);

    expect(rendue.x).toBeCloseTo(25);
    expect(rendue.enMouvement).toBe(true);
  });

  it('saute au lieu de glisser quand la distance est celle d une reapparition', () => {
    // Un joueur capture reapparait ailleurs. Le faire glisser en ligne droite le
    // ferait traverser les murs sous les yeux de tout le monde.
    const rendue = lisserUneEntite(joueur('moi', 1_500, 900), { x: 100, y: 100 }, 0.5);

    expect(rendue.x).toBe(1_500);
    expect(rendue.y).toBe(900);
  });

  it('considere immobile une entite qui n a pas bouge', () => {
    const rendue = lisserUneEntite(joueur('moi', 100, 100), { x: 100, y: 100 }, 0.5);

    expect(rendue.enMouvement).toBe(false);
  });
});
