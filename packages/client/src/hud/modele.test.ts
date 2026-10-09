/**
 * Tests du modele du HUD.
 *
 * Ce qu'ils protegent: que ce qui s'affiche vienne bien de l'etat recu, et de
 * lui seul. Dans le client d'origine, le classement affiche etait une copie
 * entretenue a la main, le temps venait d'un compteur local, et les jauges de
 * bonus d'une troisieme source: les trois pouvaient se contredire.
 */

import type { EntiteVue, LigneClassement, ZoneVue } from '@neon-ninja/shared';
import { REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { EffetActif, EtatClient } from '../etat.js';
import { ETAT_INITIAL } from '../etat.js';
import type { VuePartie } from '../reconstruction.js';
import { APPARENCE_ZONE } from '../rendu/apparence.js';
import { adresseDuPictogrammeDeZone } from '../rendu/zones.js';
import {
  HUD_VIDE,
  PORTEE_DU_RADAR_PX,
  SEUIL_URGENCE_MS,
  construireHud,
  formaterDuree,
} from './modele.js';

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

  it('dit que la page tente de revenir quand le lien est tombe en pleine partie (etape 2.5)', () => {
    expect(construireHud(etatEnJeu(vue()), 0).retourEnCours).toBe(false);
    expect(construireHud(etatEnJeu(vue(), { connexion: 'retour' }), 0).retourEnCours).toBe(true);
  });

  describe('effets en cours', () => {
    const effets: readonly EffetActif[] = [
      { categorie: 'bonus', nature: 'vitesse', surMoi: true, finPrevueA: 10_000, dureeMs: 10_000 },
      { categorie: 'malus', nature: 'flou', surMoi: true, finPrevueA: 4_000, dureeMs: 10_000 },
      {
        categorie: 'bonus',
        nature: 'invincibilite',
        surMoi: true,
        finPrevueA: 1_000,
        dureeMs: 10_000,
      },
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

    describe('la zone ou nous nous tenons (9 octobre 2026)', () => {
      const chaos: ZoneVue = {
        id: 'z1',
        type: 'chaos',
        x: 100,
        y: 100,
        rayon: 220,
        dureeRestanteMs: 6_000,
      };

      it('devient un effet, a sa couleur et avec son pictogramme, classe avec les autres', () => {
        const partie = vue({ entites: [joueur('moi', 150, 100)], zones: [chaos] });
        const hud = construireHud(etatEnJeu(partie, { effets }), 0, new Map([['z1', 12_000]]));
        const zone = hud.effets.find((effet) => effet.categorie === 'zone');

        expect(hud.effets.map((effet) => effet.nature)).toEqual([
          'invincibilite',
          'flou',
          'chaos',
          'vitesse',
        ]);
        expect(zone).toMatchObject({
          nature: 'chaos',
          libelle: 'Zone de chaos',
          couleur: APPARENCE_ZONE.chaos.couleur,
          resteS: 6,
          part: 0.5,
          finProche: false,
          auxAutres: false,
        });
        expect(zone?.icone).toBe(adresseDuPictogrammeDeZone('chaos'));
      });

      it('mesure sa jauge sur la duree maximale reglee, faute de duree vue', () => {
        const partie = vue({ entites: [joueur('moi', 150, 100)], zones: [chaos] });
        const hud = construireHud(etatEnJeu(partie), 0);
        const dureeMaximumMs = REGLAGES_PAR_DEFAUT.zones.dureeMaximumS * 1000;

        expect(hud.effets[0]?.part).toBeCloseTo(Math.min(6_000 / dureeMaximumMs, 1));
      });

      it('disparait quand nous sortons de la zone', () => {
        const partie = vue({ entites: [joueur('moi', 900, 900)], zones: [chaos] });

        expect(construireHud(etatEnJeu(partie), 0).effets).toEqual([]);
      });
    });

    it('dit la part qui reste de chaque effet, pour sa jauge (etape 4.6)', () => {
      const hud = construireHud(etatEnJeu(vue(), { effets }), 2_500);
      const part = (nature: string): number | undefined =>
        hud.effets.find((effet) => effet.nature === nature)?.part;

      expect(part('vitesse')).toBeCloseTo(0.75);
      expect(part('flou')).toBeCloseTo(0.15);
    });

    it('signale les trois dernieres secondes d un effet (etape 4.6)', () => {
      const hud = construireHud(etatEnJeu(vue(), { effets }), 1_000);
      const finProche = (nature: string): boolean | undefined =>
        hud.effets.find((effet) => effet.nature === nature)?.finProche;

      expect(finProche('flou')).toBe(true);
      expect(finProche('vitesse')).toBe(false);
    });

    it('distingue le malus que nous infligeons aux autres (etape 4.6)', () => {
      const envoye: EffetActif = {
        categorie: 'malus',
        nature: 'negatif',
        surMoi: false,
        finPrevueA: 9_000,
        dureeMs: 14_000,
      };
      const hud = construireHud(etatEnJeu(vue(), { effets: [...effets, envoye] }), 0);

      expect(hud.effets.find((effet) => effet.nature === 'negatif')?.auxAutres).toBe(true);
      expect(hud.effets.find((effet) => effet.nature === 'flou')?.auxAutres).toBe(false);
      expect(hud.effets.find((effet) => effet.nature === 'vitesse')?.auxAutres).toBe(false);
    });

    it('donne a chaque effet l icone de son objet (etape 4.6)', () => {
      const hud = construireHud(etatEnJeu(vue(), { effets }), 0);

      expect(hud.effets.find((effet) => effet.nature === 'vitesse')?.icone).toBe(
        '/assets/objets/speed.png',
      );
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

  describe('radar', () => {
    /** Notre Revelation en cours: le radar ne se montre que pendant elle. */
    const sousRevelation: Partial<EtatClient> = {
      effets: [
        {
          categorie: 'bonus',
          nature: 'revelation',
          surMoi: true,
          finPrevueA: 10_000,
          dureeMs: 10_000,
        },
      ],
    };

    it('ne se montre pas hors de notre Revelation: il defairait le camouflage', () => {
      const partie = vue({ entites: [joueur('moi', 10, 10), joueur('autre', 20, 20)] });

      expect(construireHud(etatEnJeu(partie), 0).radar).toBeUndefined();
      expect(construireHud(etatEnJeu(partie, sousRevelation), 10_000).radar).toBeUndefined();
    });

    it('ne montre que les joueurs, pas les bots', () => {
      // Cent points blancs ne disent rien; les joueurs sont ce que l'on cherche.
      const partie = vue({
        entites: [
          joueur('moi', 100, 200),
          joueur('autre', 300, 400),
          { type: 'bot', id: 'bot-1', x: 50, y: 50, couleur: '#FFFFFF', direction: 'nord' },
        ],
      });

      const hud = construireHud(etatEnJeu(partie, sousRevelation), 0);

      expect(hud.radar?.map((point) => point.id)).toEqual(['moi', 'autre']);
    });

    it('marque notre point, pour qu on se retrouve', () => {
      const partie = vue({ entites: [joueur('moi', 10, 10), joueur('autre', 20, 20)] });
      const hud = construireHud(etatEnJeu(partie, sousRevelation), 0);

      expect(hud.radar?.map((point) => point.moi)).toEqual([true, false]);
    });

    it('nous met au centre, et les autres autour, en part de sa portee', () => {
      const partie = vue({
        entites: [
          joueur('moi', 1_000, 1_000),
          joueur('autre', 1_000 + PORTEE_DU_RADAR_PX / 2, 1_000 - PORTEE_DU_RADAR_PX / 4),
        ],
      });
      const hud = construireHud(etatEnJeu(partie, sousRevelation), 0);

      expect(hud.radar).toEqual([
        { id: 'moi', x: 0, y: 0, couleur: '#00FF00', moi: true, auBord: false },
        { id: 'autre', x: 0.5, y: -0.25, couleur: '#00FF00', moi: false, auBord: false },
      ]);
    });

    it('pose sur son bord, dans sa direction, un joueur hors de portee', () => {
      const partie = vue({
        entites: [
          joueur('moi', 0, 0),
          joueur('autre', 3 * PORTEE_DU_RADAR_PX, 4 * PORTEE_DU_RADAR_PX),
        ],
      });
      const autre = construireHud(etatEnJeu(partie, sousRevelation), 0).radar?.[1];

      expect(autre?.auBord).toBe(true);
      expect(autre?.x).toBeCloseTo(0.6);
      expect(autre?.y).toBeCloseTo(0.8);
    });

    it('sans nous sur la carte, part de son milieu et la montre toute', () => {
      // La carte par defaut fait 2000 sur 1500: son coin est a 1250 pixels du milieu.
      const partie = vue({ entites: [joueur('autre', 0, 0)] });
      const hud = construireHud(etatEnJeu(partie, sousRevelation), 0);

      expect(hud.radar).toEqual([
        { id: 'autre', x: -0.8, y: -0.6, couleur: '#00FF00', moi: false, auBord: false },
      ]);
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

describe("le x2 de l'Evade au classement du HUD (etape 7.9)", () => {
  it('marque la ligne de qui le porte, lu sur le joueur, et elle seule', () => {
    const partie = vue({
      entites: [{ ...joueur('autre', 0, 0), doubleur: true } as EntiteVue, joueur('moi', 10, 10)],
      classement: [ligne('autre', 24), ligne('moi', 7)],
    });
    const hud = construireHud(etatEnJeu(partie), 0);

    expect(hud.classement.map((entree) => [entree.id, entree.doubleur])).toEqual([
      ['autre', true],
      ['moi', false],
    ]);
  });
});

describe('la poche au HUD (etape 7.10)', () => {
  it('montre ce que nous avons en poche, avec son libelle, sa couleur et son icone', () => {
    const hud = construireHud(etatEnJeu(vue(), { poche: 'fumee' }), 0);

    expect(hud.poche).toEqual({
      nature: 'fumee',
      libelle: 'Fumée',
      couleur: 0xb8c4d6,
      icone: expect.stringMatching(/objets\/fumee\.svg$/) as unknown as string,
    });
  });

  it('ne montre rien quand la poche est vide, ni hors de partie', () => {
    expect(construireHud(etatEnJeu(vue()), 0).poche).toBeUndefined();
    expect(construireHud({ ...ETAT_INITIAL, poche: 'fumee' }, 0).poche).toBeUndefined();
  });
});
