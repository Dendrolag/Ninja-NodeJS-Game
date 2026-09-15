/**
 * Verification du harnais lui-meme.
 *
 * Les quatre suites de caracterisation ne valent que si le harnais charge
 * vraiment le legacy, sans entree-sortie et sans fuite d'etat d'une instance a
 * l'autre. Ce fichier verifie ces proprietes. Il ne caracterise aucun
 * comportement de jeu: c'est le role des suites capture, collisions, score et
 * effets.
 */

import { describe, expect, it } from 'vitest';

import { creerHarnais } from './harnais/charger-legacy.js';

describe('harnais de caracterisation', () => {
  it('charge le legacy sans ouvrir de serveur ni lire de carte', () => {
    const harnais = creerHarnais();

    expect(typeof harnais.handlePlayerCapture).toBe('function');
    expect(typeof harnais.detectCollisions).toBe('function');
    expect(typeof harnais.calculatePlayerScores).toBe('function');
    // Aucune image n'a ete fournie: la carte de collisions reste vide, donc le
    // terrain est entierement libre. C'est l'etat par defaut des scenarios.
    expect(harnais.collisionMap.collisionData).toBeNull();
  });

  it('branche les gestionnaires Socket.IO du legacy sur une socket factice', () => {
    const harnais = creerHarnais();
    const socket = harnais.connecterSocket('socket-1');

    expect(socket.ecoute('move')).toBe(true);
    expect(socket.ecoute('joinWaitingRoom')).toBe(true);
  });

  it('isole completement deux instances', () => {
    const premier = creerHarnais();
    const second = creerHarnais();

    premier.ajouterJoueur('j1', 'Alice');
    premier.ajouterBot('b1', '#FF0000');

    expect(Object.keys(premier.players)).toEqual(['j1']);
    expect(Object.keys(second.players)).toEqual([]);
    expect(Object.keys(second.bots)).toEqual([]);
  });

  it('donne la main sur le temps, que le legacy croit lire a l horloge', () => {
    const harnais = creerHarnais({ horlogeInitiale: 500_000 });
    const joueur = harnais.ajouterJoueur('j1', 'Alice');

    // Player fixe sa protection de spawn a Date.now() + 3000.
    expect(joueur.spawnProtection).toBe(503_000);
    expect(joueur.isInvulnerable()).toBe(true);

    harnais.horloge.avancerDe(3_000);
    expect(joueur.isInvulnerable()).toBe(false);
  });

  it('rend le hasard reproductible a graine egale', () => {
    const premier = creerHarnais({ graine: 42 });
    const second = creerHarnais({ graine: 42 });
    const autre = creerHarnais({ graine: 43 });

    const positionPremier = premier.ajouterJoueur('j1', 'Alice');
    const positionSecond = second.ajouterJoueur('j1', 'Alice');
    const positionAutre = autre.ajouterJoueur('j1', 'Alice');

    expect(positionPremier.x).toBe(positionSecond.x);
    expect(positionPremier.y).toBe(positionSecond.y);
    expect(positionPremier.color).toBe(positionSecond.color);
    expect(positionAutre.x).not.toBe(positionPremier.x);
  });

  it('capture les emissions au lieu de les envoyer sur le reseau', () => {
    const harnais = creerHarnais();
    const joueur = harnais.ajouterJoueur('j1', 'Alice');
    const bonus = harnais.ajouterBonus('speed', joueur.x, joueur.y);

    harnais.handleBonusCollection(joueur, bonus);

    expect(harnais.emissionsVers('j1').map((emission) => emission.evenement)).toContain(
      'activateBonus',
    );
  });

  it('enregistre les minuteries programmees sans jamais les executer', () => {
    const harnais = creerHarnais();

    // Le legacy programme sa boucle de jeu et ses premiers spawns au chargement.
    expect(harnais.minuteries.length).toBeGreaterThan(0);
    expect(harnais.minuteries.some((minuterie) => minuterie.sorte === 'setInterval')).toBe(true);
  });
});
