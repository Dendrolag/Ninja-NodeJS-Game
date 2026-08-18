/**
 * Tests de la reconstruction de l'etat de partie a partir du flux.
 *
 * Ce sont les tests que la fiche de l'etape 4.1 exige en premier: une suite de
 * messages du serveur doit reconstruire chez le client le meme etat que celui
 * dont le serveur est parti. Aujourd'hui le flux est fait d'instantanes complets
 * en JSON; ces memes tests garderont leur sens le jour ou l'etape 2.3 le
 * remplacera par un delta binaire, parce qu'ils portent sur le RESULTAT de la
 * reconstruction et pas sur la maniere dont elle s'y prend.
 */

import type { InstantanePartie } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { entiteDe, reconstruire } from './reconstruction.js';

/** Un instantane minimal, complete par ce que le test veut examiner. */
function instantane(modifications: Partial<InstantanePartie> = {}): InstantanePartie {
  return {
    tick: 1,
    tempsRestantMs: 180_000,
    enPause: false,
    entites: [],
    objets: [],
    zones: [],
    classement: [],
    ...modifications,
  };
}

describe('reconstruction du flux d etat', () => {
  it('adopte le premier instantane recu', () => {
    const vue = reconstruire(undefined, instantane({ tick: 7, tempsRestantMs: 42_000 }));

    expect(vue.tick).toBe(7);
    expect(vue.tempsRestantMs).toBe(42_000);
  });

  it('reconstruit le meme etat que celui envoye par le serveur', () => {
    const envoye = instantane({
      tick: 3,
      tempsRestantMs: 12_500,
      enPause: true,
      entites: [
        {
          type: 'joueur',
          id: 'j1',
          x: 10,
          y: 20,
          couleur: '#FF0000',
          direction: 'est',
          pseudo: 'Alice',
          invincible: false,
          protege: true,
        },
        { type: 'bot', id: 'b1', x: 30, y: 40, couleur: '#FFFFFF', direction: 'sud' },
      ],
      objets: [
        {
          id: 'o1',
          categorie: 'bonus',
          nature: 'vitesse',
          x: 5,
          y: 5,
          dureeDeVieRestanteMs: 8000,
        },
      ],
      zones: [{ id: 'z1', type: 'chaos', x: 100, y: 100, rayon: 50, dureeRestanteMs: 3000 }],
      classement: [
        {
          id: 'j1',
          pseudo: 'Alice',
          couleur: '#FF0000',
          points: 12,
          botsPortes: 9,
          pointsBotsNoirs: 3,
          captures: 1,
          botsNoirsDetruits: 0,
        },
      ],
    });

    const vue = reconstruire(undefined, envoye);

    // La vue porte exactement ce que le serveur a envoye, champ par champ.
    expect(vue).toEqual({
      tick: envoye.tick,
      tempsRestantMs: envoye.tempsRestantMs,
      enPause: envoye.enPause,
      entites: envoye.entites,
      objets: envoye.objets,
      zones: envoye.zones,
      classement: envoye.classement,
    });
  });

  it('suit une suite d instantanes jusqu au dernier', () => {
    let vue = reconstruire(undefined, instantane({ tick: 1, tempsRestantMs: 180_000 }));
    vue = reconstruire(vue, instantane({ tick: 2, tempsRestantMs: 179_500 }));
    vue = reconstruire(vue, instantane({ tick: 3, tempsRestantMs: 179_000 }));

    expect(vue.tick).toBe(3);
    expect(vue.tempsRestantMs).toBe(179_000);
  });

  it('ignore un instantane perime', () => {
    const vue = reconstruire(undefined, instantane({ tick: 5, tempsRestantMs: 100_000 }));
    const apres = reconstruire(vue, instantane({ tick: 4, tempsRestantMs: 200_000 }));

    expect(apres).toBe(vue);
  });

  it('ignore un instantane deja recu', () => {
    const vue = reconstruire(undefined, instantane({ tick: 5 }));
    const apres = reconstruire(vue, instantane({ tick: 5, tempsRestantMs: 1 }));

    expect(apres).toBe(vue);
    expect(apres.tempsRestantMs).toBe(180_000);
  });

  it('ne modifie jamais la vue precedente', () => {
    const vue = reconstruire(undefined, instantane({ tick: 1, tempsRestantMs: 180_000 }));
    reconstruire(vue, instantane({ tick: 2, tempsRestantMs: 179_000 }));

    expect(vue.tempsRestantMs).toBe(180_000);
  });

  it('suit la pause telle que le flux la rapporte', () => {
    const enCours = reconstruire(undefined, instantane({ tick: 1, enPause: false }));
    const suspendue = reconstruire(enCours, instantane({ tick: 2, enPause: true }));
    const reprise = reconstruire(suspendue, instantane({ tick: 3, enPause: false }));

    expect(enCours.enPause).toBe(false);
    expect(suspendue.enPause).toBe(true);
    expect(reprise.enPause).toBe(false);
  });

  it('retrouve une entite par son identifiant', () => {
    const vue = reconstruire(
      undefined,
      instantane({
        entites: [
          { type: 'bot', id: 'b1', x: 1, y: 2, couleur: '#FFFFFF', direction: 'nord' },
          { type: 'botNoir', id: 'n1', x: 3, y: 4, couleur: '#000000', direction: 'sud' },
        ],
      }),
    );

    expect(entiteDe(vue, 'n1')?.x).toBe(3);
    expect(entiteDe(vue, 'inconnu')).toBeUndefined();
    expect(entiteDe(undefined, 'b1')).toBeUndefined();
  });
});
