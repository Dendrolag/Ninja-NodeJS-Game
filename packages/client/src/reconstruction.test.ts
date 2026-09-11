/**
 * Tests de la reconstruction de l'etat de partie a partir du flux.
 *
 * Ce sont les tests que la fiche de l'etape 4.1 exige en premier: une suite de
 * messages du serveur doit reconstruire chez le client le meme etat que celui
 * dont le serveur est parti. Depuis l'etape 2.3, ces messages sont des trames
 * binaires, codees ici par les fonctions memes du serveur (encoderImage et
 * encoderDelta de @neon-ninja/shared). Les tests d'origine gardent leur sens,
 * parce qu'ils portent sur le RESULTAT de la reconstruction; ceux qui s'ajoutent
 * portent sur ce que le delta change: une trame qui ne s'applique pas est ignoree.
 */

import type { InstantanePartie } from '@neon-ninja/shared';
import { encoderDelta, encoderImage } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { VuePartie } from './reconstruction.js';
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

/** L'image d'un instantane, telle que le serveur l'envoie. */
function image(modifications: Partial<InstantanePartie> = {}): Uint8Array {
  return encoderImage(instantane(modifications)).octets;
}

/** Reconstruit une trame qui doit s'appliquer, et echoue sinon. */
function appliquer(vue: VuePartie | undefined, trame: Uint8Array): VuePartie {
  const resultat = reconstruire(vue, trame);

  if (resultat === undefined) {
    throw new Error("La trame aurait du s'appliquer.");
  }

  return resultat;
}

describe('reconstruction du flux d etat', () => {
  it('adopte la premiere image recue', () => {
    const vue = appliquer(undefined, image({ tick: 7, tempsRestantMs: 42_000 }));

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

    const vue = appliquer(undefined, encoderImage(envoye).octets);

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

  it('suit une image puis des deltas jusqu au dernier battement', () => {
    const premier = encoderImage(instantane({ tick: 1, tempsRestantMs: 180_000 }));
    const deuxieme = encoderDelta(
      premier.reference,
      instantane({
        tick: 2,
        tempsRestantMs: 179_950,
        entites: [{ type: 'bot', id: 'b1', x: 1, y: 2, couleur: '#FFFFFF', direction: 'nord' }],
      }),
    );
    const troisieme = encoderDelta(
      deuxieme.reference,
      instantane({
        tick: 3,
        tempsRestantMs: 179_900,
        entites: [{ type: 'bot', id: 'b1', x: 5, y: 2, couleur: '#FF0000', direction: 'est' }],
      }),
    );

    let vue = appliquer(undefined, premier.octets);
    vue = appliquer(vue, deuxieme.octets);
    vue = appliquer(vue, troisieme.octets);

    expect(vue).toEqual(troisieme.reference);
  });

  it('ignore une trame perimee', () => {
    const vue = appliquer(undefined, image({ tick: 5, tempsRestantMs: 100_000 }));
    const apres = reconstruire(vue, image({ tick: 4, tempsRestantMs: 200_000 }));

    expect(apres).toBe(vue);
  });

  it('ignore une trame deja recue', () => {
    const vue = appliquer(undefined, image({ tick: 5 }));
    const apres = reconstruire(vue, image({ tick: 5, tempsRestantMs: 1 }));

    expect(apres).toBe(vue);
    expect(apres?.tempsRestantMs).toBe(180_000);
  });

  it('ignore un delta qui ne s applique pas a la partie detenue, puis se recale sur l image', () => {
    // Le joueur qui entre dans une partie en cours: le delta de la salle arrive
    // avant son image.
    const avant = encoderImage(instantane({ tick: 40 }));
    const delta = encoderDelta(avant.reference, instantane({ tick: 41, tempsRestantMs: 1000 }));

    expect(reconstruire(undefined, delta.octets)).toBeUndefined();

    const autre = appliquer(undefined, image({ tick: 12 }));
    expect(reconstruire(autre, delta.octets)).toBe(autre);

    const recale = appliquer(undefined, image({ tick: 41, tempsRestantMs: 1000 }));
    expect(recale.tempsRestantMs).toBe(1000);
  });

  it('garde ce qu il affiche quand une trame est illisible, sans tomber', () => {
    const vue = appliquer(undefined, image({ tick: 5 }));

    expect(reconstruire(vue, Uint8Array.of(255, 1, 2))).toBe(vue);
    expect(reconstruire(undefined, new Uint8Array())).toBeUndefined();
  });

  it('lit une trame arrivee en ArrayBuffer, comme dans un navigateur', () => {
    const octets = image({ tick: 8 });
    const tampon = new ArrayBuffer(octets.byteLength);
    new Uint8Array(tampon).set(octets);

    expect(reconstruire(undefined, tampon)?.tick).toBe(8);
  });

  it('ne modifie jamais la vue precedente', () => {
    const vue = appliquer(undefined, image({ tick: 1, tempsRestantMs: 180_000 }));
    reconstruire(vue, image({ tick: 2, tempsRestantMs: 179_000 }));

    expect(vue.tempsRestantMs).toBe(180_000);
  });

  it('suit la pause telle que le flux la rapporte', () => {
    const enCours = appliquer(undefined, image({ tick: 1, enPause: false }));
    const suspendue = appliquer(enCours, image({ tick: 2, enPause: true }));
    const reprise = appliquer(suspendue, image({ tick: 3, enPause: false }));

    expect(enCours.enPause).toBe(false);
    expect(suspendue.enPause).toBe(true);
    expect(reprise.enPause).toBe(false);
  });

  it('retrouve une entite par son identifiant', () => {
    const vue = appliquer(
      undefined,
      image({
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
