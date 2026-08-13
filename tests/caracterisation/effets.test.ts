/**
 * Caracterisation du domaine EFFETS: bonus et malus.
 *
 * Perimetre, repris de la fiche docs/plan/etape-0-2.md:
 *   - handleBonusCollection (legacy/server.js:1614): effet applique et duree.
 *   - handleMalusCollection (legacy/server.js:684): effet applique, sa nature,
 *     et surtout sa cible.
 *   - updatePlayerBonuses (legacy/server.js:627): expiration cote serveur.
 *
 * Le point remarquable du domaine est le quatrieme comportement a preserver de
 * CLAUDE.md: un malus ramasse frappe les autres joueurs, pas celui qui l'a
 * ramasse. C'est contre-intuitif et c'est voulu.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import type { Harnais, JoueurLegacy } from './harnais/charger-legacy.js';
import { creerHarnais } from './harnais/charger-legacy.js';
import { evenementsVers } from './harnais/scenario.js';

const ROUGE = '#FF0000';
const BLEU = '#0000FF';
const VERT = '#00FF00';

let harnais: Harnais;
let alice: JoueurLegacy;

beforeEach(() => {
  harnais = creerHarnais({ horlogeInitiale: 1_000_000 });
  alice = harnais.ajouterJoueur('a', 'Alice', { couleur: ROUGE, x: 500, y: 500 });
});

describe('ramassage d un bonus', () => {
  it('active le bonus de vitesse et arme sa duree', () => {
    harnais.handleBonusCollection(alice, harnais.creerBonus('speed'));

    expect(alice.speedBoostActive).toBe(true);
    expect(alice.bonusTimers?.speed).toBe(10);
  });

  it('active l invincibilite, arme sa duree et note son instant de depart', () => {
    const instant = harnais.horloge.maintenant();

    harnais.handleBonusCollection(alice, harnais.creerBonus('invincibility'));

    expect(alice.invincibilityActive).toBe(true);
    expect(alice.bonusTimers?.invincibility).toBe(10);
    expect(alice.bonusStartTime).toBe(instant);
  });

  it('active la revelation et arme sa duree', () => {
    harnais.handleBonusCollection(alice, harnais.creerBonus('reveal'));

    expect(alice.revealActive).toBe(true);
    expect(alice.bonusTimers?.reveal).toBe(10);
  });

  it('cumule les durees quand le meme bonus est ramasse deux fois', () => {
    harnais.handleBonusCollection(alice, harnais.creerBonus('speed'));
    harnais.handleBonusCollection(alice, harnais.creerBonus('speed'));

    expect(alice.bonusTimers?.speed).toBe(20);
  });

  it('previent le seul ramasseur, avec le type et la duree', () => {
    harnais.handleBonusCollection(alice, harnais.creerBonus('invincibility'));

    expect(harnais.emissionsVers('a')).toEqual([
      { cible: 'a', evenement: 'activateBonus', donnees: { type: 'invincibility', duration: 10 } },
    ]);
    expect(harnais.emissionsVers('io')).toEqual([]);
  });

  it('lit les durees dans les reglages de la partie en cours', () => {
    harnais.currentGameSettings['speedBoostDuration'] = 25;

    harnais.handleBonusCollection(alice, harnais.creerBonus('speed'));

    expect(alice.bonusTimers?.speed).toBe(25);
  });

  it('ne fait rien pour un joueur sans socket connectee', () => {
    const fantome = harnais.creerJoueurNu('f', 'Fantome');

    harnais.handleBonusCollection(fantome, harnais.creerBonus('speed'));

    expect(fantome.speedBoostActive).toBe(false);
    expect(harnais.emissions).toHaveLength(0);
  });

  it('produit l instantane de reference d un enchainement de bonus', () => {
    harnais.handleBonusCollection(alice, harnais.creerBonus('speed'));
    harnais.handleBonusCollection(alice, harnais.creerBonus('invincibility'));
    harnais.handleBonusCollection(alice, harnais.creerBonus('reveal'));
    harnais.handleBonusCollection(alice, harnais.creerBonus('speed'));

    expect({
      effets: {
        speedBoostActive: alice.speedBoostActive,
        invincibilityActive: alice.invincibilityActive,
        revealActive: alice.revealActive,
      },
      minuteries: alice.bonusTimers,
      emissions: harnais.emissions,
    }).toMatchSnapshot();
  });
});

describe('expiration des bonus cote serveur', () => {
  it('desactive l invincibilite une fois sa duree ecoulee', () => {
    harnais.handleBonusCollection(alice, harnais.creerBonus('invincibility'));

    harnais.horloge.avancerDe(9_999);
    harnais.updatePlayerBonuses();
    expect(alice.invincibilityActive).toBe(true);

    harnais.horloge.avancerDe(1);
    harnais.updatePlayerBonuses();
    expect(alice.invincibilityActive).toBe(false);
    expect(alice.bonusTimers?.invincibility).toBe(0);
    expect(evenementsVers(harnais, 'a')).toContain('bonusDeactivated');
  });

  it('n expire ni la vitesse ni la revelation cote serveur', () => {
    // Surprenant: seule l'invincibilite est expiree par le serveur, parce
    // qu'elle seule a des consequences sur les regles. La vitesse et la
    // revelation restent armees indefiniment cote serveur; c'est le client qui
    // decide de les arreter. A relier au fait que le serveur croit le client
    // sur parole quand celui-ci annonce un bonus de vitesse (faille S2 de
    // l'audit, traitee a l'etape 1.6).
    harnais.handleBonusCollection(alice, harnais.creerBonus('speed'));
    harnais.handleBonusCollection(alice, harnais.creerBonus('reveal'));

    harnais.horloge.avancerDe(600_000);
    harnais.updatePlayerBonuses();

    expect(alice.speedBoostActive).toBe(true);
    expect(alice.revealActive).toBe(true);
  });
});

describe('duree de vie d un objet pose sur la carte', () => {
  it('expire au bout de huit secondes', () => {
    const bonus = harnais.creerBonus('speed');

    harnais.horloge.avancerDe(7_999);
    expect(bonus.isExpired()).toBe(false);

    harnais.horloge.avancerDe(1);
    expect(bonus.isExpired()).toBe(true);
  });

  it('vaut aussi pour les malus', () => {
    const malus = harnais.creerMalus('blur');

    harnais.horloge.avancerDe(8_000);

    expect(malus.isExpired()).toBe(true);
  });
});

describe('ramassage d un malus', () => {
  beforeEach(() => {
    harnais.ajouterJoueur('b', 'Bob', { couleur: BLEU, x: 800, y: 800 });
    harnais.ajouterJoueur('c', 'Chloe', { couleur: VERT, x: 900, y: 900 });
  });

  it('frappe les autres joueurs, et pas celui qui l a ramasse', () => {
    harnais.handleMalusCollection(alice, harnais.creerMalus('reverse'));

    // Le ramasseur est seulement informe. Les autres subissent l'effet.
    expect(evenementsVers(harnais, 'a')).toEqual(['malusCollected']);
    expect(evenementsVers(harnais, 'b')).toEqual(['applyMalus']);
    expect(evenementsVers(harnais, 'c')).toEqual(['applyMalus']);
  });

  it('annonce le ramassage a toute la partie, avec le nom du ramasseur', () => {
    harnais.handleMalusCollection(alice, harnais.creerMalus('blur'));

    expect(harnais.emissionsVers('io')).toEqual([
      {
        cible: 'io',
        evenement: 'malusEvent',
        donnees: {
          type: 'blur',
          duration: 12,
          collectorId: 'a',
          collectorNickname: 'Alice',
        },
      },
    ]);
  });

  it('indique aux victimes qui leur a inflige le malus', () => {
    harnais.handleMalusCollection(alice, harnais.creerMalus('negative'));

    expect(harnais.emissionsVers('b')[0]?.donnees).toEqual({
      type: 'negative',
      duration: 14,
      collectedBy: 'Alice',
    });
  });

  it('applique a chaque type de malus sa propre duree', () => {
    const durees: Record<string, unknown> = {};
    for (const type of ['reverse', 'blur', 'negative']) {
      const instance = creerHarnais({ horlogeInitiale: 1_000_000 });
      const ramasseur = instance.ajouterJoueur('a', 'Alice');
      instance.handleMalusCollection(ramasseur, instance.creerMalus(type));
      durees[type] = (instance.emissionsVers('a')[0]?.donnees as { duration: number }).duration;
    }

    expect(durees).toEqual({ reverse: 10, blur: 12, negative: 14 });
  });

  it('ne fait rien pour un ramasseur sans socket connectee', () => {
    const fantome = harnais.creerJoueurNu('f', 'Fantome');

    harnais.handleMalusCollection(fantome, harnais.creerMalus('blur'));

    expect(harnais.emissions).toHaveLength(0);
  });

  it('produit l instantane de reference de la diffusion d un malus', () => {
    harnais.handleMalusCollection(alice, harnais.creerMalus('reverse'));

    expect(harnais.emissions).toMatchSnapshot();
  });
});
