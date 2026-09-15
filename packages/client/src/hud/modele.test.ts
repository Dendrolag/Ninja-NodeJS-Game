/**
 * Tests du modele du HUD.
 *
 * Ce qu'ils protegent: que ce qui s'affiche vienne bien de l'etat recu, et de
 * lui seul. Dans le client d'origine, le classement affiche etait une copie
 * entretenue a la main, le temps venait d'un compteur local, et les jauges de
 * bonus d'une troisieme source: les trois pouvaient se contredire.
 */

import type { EntiteVue, LigneClassement } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { EffetActif, EtatClient } from '../etat.js';
import { ETAT_INITIAL } from '../etat.js';
import type { VuePartie } from '../reconstruction.js';
import { HUD_VIDE, SEUIL_URGENCE_MS, construireHud, formaterDuree } from './modele.js';

/** Une ligne de classement, avec le minimum de champs. */
function ligne(id: string, points: number, couleur = '#FF0000'): LigneClassement {
  return {
    id,
    pseudo: id,
    couleur,
    points,
    botsPortes: points,
    pointsBotsNoirs: 0,
    captures: 0,
    botsNoirsDetruits: 0,
  };
}

/** Un joueur pose a un endroit. */
function joueur(id: string, x: number, y: number): EntiteVue {
  return {
    type: 'joueur',
    id,
    x,
    y,
    couleur: '#00FF00',
    direction: 'sud',
    pseudo: id,
    invincible: false,
    protege: false,
  };
}

/** Une vue de partie. */
function vue(partielle: Partial<VuePartie> = {}): VuePartie {
  return {
    tick: 1,
    tempsRestantMs: 90_000,
    enPause: false,
    entites: [],
    objets: [],
    zones: [],
    classement: [],
    ...partielle,
  };
}

/** Un etat de client en partie. */
function etatEnJeu(partie: VuePartie, reste: Partial<EtatClient> = {}): EtatClient {
  return { ...ETAT_INITIAL, ecran: 'jeu', moi: 'moi', partie, ...reste };
}

describe('formaterDuree', () => {
  it('met en forme des minutes et des secondes', () => {
    expect(formaterDuree(90_000)).toBe('1:30');
    expect(formaterDuree(5_000)).toBe('0:05');
    expect(formaterDuree(600_000)).toBe('10:00');
  });

  it('arrondit vers le haut, pour ne pas afficher zero avant la fin', () => {
    expect(formaterDuree(1)).toBe('0:01');
    expect(formaterDuree(0)).toBe('0:00');
  });

  it('n affiche jamais de duree negative', () => {
    expect(formaterDuree(-500)).toBe('0:00');
  });
});

describe('construireHud', () => {
  it('rend un HUD vide tant qu aucune partie ne tourne', () => {
    expect(construireHud(ETAT_INITIAL, 0)).toBe(HUD_VIDE);
  });

  it('affiche le temps restant de la partie', () => {
    const hud = construireHud(etatEnJeu(vue({ tempsRestantMs: 65_000 })), 0);

    expect(hud.temps).toBe('1:05');
    expect(hud.tempsRestantMs).toBe(65_000);
  });

  it('passe en alerte dans les dernieres secondes', () => {
    const large = construireHud(etatEnJeu(vue({ tempsRestantMs: SEUIL_URGENCE_MS + 1 })), 0);
    const serre = construireHud(etatEnJeu(vue({ tempsRestantMs: SEUIL_URGENCE_MS })), 0);

    expect(large.urgence).toBe(false);
    expect(serre.urgence).toBe(true);
  });

  it('numerote le classement et marque notre ligne', () => {
    const partie = vue({ classement: [ligne('autre', 12), ligne('moi', 7)] });
    const hud = construireHud(etatEnJeu(partie), 0);

    expect(hud.classement.map((entree) => entree.rang)).toEqual([1, 2]);
    expect(hud.classement.map((entree) => entree.moi)).toEqual([false, true]);
  });

  it('affiche le score recu, sans le recalculer', () => {
    // Le score est un stock detenu par le moteur. Le HUD le montre; il ne
    // l'additionne pas, ne le retient pas et ne le corrige pas.
    const partie = vue({ classement: [ligne('moi', 42)] });

    expect(construireHud(etatEnJeu(partie), 0).classement[0]?.points).toBe(42);
  });

  it('annonce la pause et qui l a demandee', () => {
    const hud = construireHud(etatEnJeu(vue({ enPause: true }), { pausePar: 'Alice' }), 0);

    expect(hud.enPause).toBe(true);
    expect(hud.pausePar).toBe('Alice');
  });

  describe('effets en cours', () => {
    const effets: readonly EffetActif[] = [
      { categorie: 'bonus', nature: 'vitesse', finPrevueA: 10_000 },
      { categorie: 'malus', nature: 'flou', finPrevueA: 4_000 },
      { categorie: 'bonus', nature: 'invincibilite', finPrevueA: 1_000 },
    ];

    it('montre chaque effet avec son libelle et son reste', () => {
      const hud = construireHud(etatEnJeu(vue(), { effets }), 0);

      expect(hud.effets).toHaveLength(3);
      expect(hud.effets.map((effet) => effet.libelle)).toContain('Boost');
      expect(hud.effets.map((effet) => effet.libelle)).toContain('Vision floue');
    });

    it('classe du plus proche de sa fin au plus lointain', () => {
      const hud = construireHud(etatEnJeu(vue(), { effets }), 0);

      expect(hud.effets.map((effet) => effet.nature)).toEqual(['invincibilite', 'flou', 'vitesse']);
    });

    it('arrondit le reste vers le haut, en secondes', () => {
      const hud = construireHud(etatEnJeu(vue(), { effets }), 8_200);
      const vitesse = hud.effets.find((effet) => effet.nature === 'vitesse');

      expect(vitesse?.resteMs).toBe(1_800);
      expect(vitesse?.resteS).toBe(2);
    });

    it('cesse de montrer un effet expire', () => {
      const hud = construireHud(etatEnJeu(vue(), { effets }), 5_000);

      expect(hud.effets.map((effet) => effet.nature)).toEqual(['vitesse']);
    });
  });

  describe('minimap', () => {
    it('ne montre que les joueurs, pas les bots', () => {
      // Cent points blancs ne disent rien; les joueurs sont ce que l'on cherche.
      const partie = vue({
        entites: [
          joueur('moi', 100, 200),
          joueur('autre', 300, 400),
          { type: 'bot', id: 'bot-1', x: 50, y: 50, couleur: '#FFFFFF', direction: 'nord' },
        ],
      });

      const hud = construireHud(etatEnJeu(partie), 0);

      expect(hud.minimap.map((point) => point.id)).toEqual(['moi', 'autre']);
    });

    it('marque notre point, pour qu on se retrouve', () => {
      const partie = vue({ entites: [joueur('moi', 10, 10), joueur('autre', 20, 20)] });
      const hud = construireHud(etatEnJeu(partie), 0);

      expect(hud.minimap.map((point) => point.moi)).toEqual([true, false]);
    });

    it('donne les positions en coordonnees de carte', () => {
      const partie = vue({ entites: [joueur('moi', 1_234, 567)] });
      const hud = construireHud(etatEnJeu(partie), 0);

      expect(hud.minimap[0]).toMatchObject({ x: 1_234, y: 567 });
    });
  });

  describe('charges du mode Tactique', () => {
    /** Un joueur qui porte l'etat du mode Tactique. */
    function tacticien(id: string, charges: number, avantProchaineChargeMs: number): EntiteVue {
      return {
        ...joueur(id, 0, 0),
        tactique: { orientation: 'est', charges, avantProchaineChargeMs },
      } as EntiteVue;
    }

    it('montre nos charges, et ou en est celle qui revient', () => {
      const hud = construireHud(etatEnJeu(vue({ entites: [tacticien('moi', 3, 1_250)] })), 0);

      expect(hud.charges).toEqual({ disponibles: 3, maximum: 5, recharge: 0.75 });
    });

    it('montre une jauge pleine aux charges pleines', () => {
      const hud = construireHud(etatEnJeu(vue({ entites: [tacticien('moi', 5, 5_000)] })), 0);

      expect(hud.charges?.recharge).toBe(1);
    });

    it('ne montre que nos charges, pas celles des autres', () => {
      const hud = construireHud(
        etatEnJeu(vue({ entites: [joueur('moi', 0, 0), tacticien('autre', 2, 100)] })),
        0,
      );

      expect(hud.charges).toBeUndefined();
    });

    it('ne montre aucune charge hors du mode Tactique', () => {
      const hud = construireHud(etatEnJeu(vue({ entites: [joueur('moi', 0, 0)] })), 0);

      expect(hud.charges).toBeUndefined();
    });
  });
});
