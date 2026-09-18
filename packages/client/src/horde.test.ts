/**
 * Tests de la Horde dans la page (etape 7.5): le compteur de combo lu dans nos ralliements,
 * les points qui s'envolent a leur niveau de combo, l'annonce d'un palier et le son d'un
 * ralliement.
 *
 * La Horde garde l'identifiant `classique`: c'est le Classique d'origine, avec un combo.
 */

import type { RalliementVu } from '@neon-ninja/shared';
import { COMBO } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { annonceDuFait } from './annonces.js';
import type { FaitDeJeu } from './faits.js';
import { fait } from './faits.js';
import { construireHud } from './hud/modele.js';
import { etatDeMassacre } from './massacre.essais.js';
import { pointsDuChangement } from './pointsFlottants.js';
import { sonDuFait } from './sons/declencheurs.js';

/** Un ralliement arrive a cet instant. */
function ralliement(instant: number, charge: Partial<RalliementVu> = {}): FaitDeJeu {
  return fait(
    'ralliement',
    {
      ninjas: [{ x: 10, y: 20, multiplicateur: 1 }],
      combo: 1,
      multiplicateur: 1,
      ...charge,
    },
    instant,
  );
}

/** Une partie Horde en cours, ou nous sommes Alice. */
function horde(journal: readonly FaitDeJeu[] = []): ReturnType<typeof etatDeMassacre> {
  return etatDeMassacre({ mode: 'classique', journal });
}

describe('le HUD d une partie Horde', () => {
  it('montre le compteur de combo, sans ninjas restants', () => {
    expect(construireHud(horde(), 0).combo).toEqual({
      multiplicateur: 1,
      compte: '',
      fenetre: 0,
      restants: '',
    });
  });

  it('lit le combo dans notre dernier ralliement, et sa fenetre qui s epuise', () => {
    const journal = [ralliement(1000, { combo: 12, multiplicateur: 3 })];

    expect(construireHud(horde(journal), 1500).combo).toMatchObject({
      multiplicateur: 3,
      compte: '12 ninjas',
      fenetre: 0.75,
    });
    expect(construireHud(horde([ralliement(1000)]), 1000).combo?.compte).toBe('1 ninja');
  });

  it('laisse tomber le combo apres sa fenetre, a la capture ou face a un Black Ninja', () => {
    const journal = [ralliement(1000, { combo: 7, multiplicateur: 2 })];
    const capture = fait(
      'captureSubie',
      { parPseudo: 'Bob', nouvelleCouleur: '#00FF00', botsPerdus: 7 },
      1100,
    );
    const noir = fait('captureParBotNoir', { botsPerdus: 3 }, 1100);

    expect(construireHud(horde(journal), 1000 + COMBO.FENETRE_MS).combo?.multiplicateur).toBe(1);
    expect(construireHud(horde([...journal, capture]), 1200).combo?.multiplicateur).toBe(1);
    expect(construireHud(horde([...journal, noir]), 1200).combo?.multiplicateur).toBe(1);
  });

  it('ne montre pas de combo en Tactique ni en Equipes', () => {
    expect(construireHud(etatDeMassacre({ mode: 'tactique' }), 0).combo).toBeUndefined();
    expect(construireHud(etatDeMassacre({ mode: 'equipes' }), 0).combo).toBeUndefined();
  });
});

describe('les points, l annonce et le son d un ralliement', () => {
  it('fait s envoler chaque ninja rallie, a la valeur et au niveau de son multiplicateur', () => {
    const apres = horde([
      ralliement(0, {
        ninjas: [
          { x: 1, y: 2, multiplicateur: 1 },
          { x: 3, y: 4, multiplicateur: 2 },
        ],
      }),
    ]);

    expect(pointsDuChangement(horde(), apres)).toEqual([
      { valeur: 1, genre: 'bot', niveau: 1, x: 1, y: 2 },
      { valeur: 2, genre: 'bot', niveau: 2, x: 3, y: 4 },
    ]);
  });

  it('ne compte pas les couleurs en Horde: seuls les ralliements annonces font des points', () => {
    const avant = horde();
    const partie = avant.partie;
    if (partie === undefined) {
      throw new Error('La partie devrait etre affichee.');
    }
    const repeinte = {
      ...avant,
      partie: {
        ...partie,
        tick: partie.tick + 1,
        entites: partie.entites.map((entite) =>
          entite.type === 'bot' ? { ...entite, couleur: '#FF0000' } : entite,
        ),
      },
    };

    expect(pointsDuChangement(avant, repeinte)).toEqual([]);
  });

  it('annonce un nouveau palier de combo, et rien d autre', () => {
    const palier = ralliement(0, {
      ninjas: [
        { x: 0, y: 0, multiplicateur: 1 },
        { x: 0, y: 0, multiplicateur: 2 },
      ],
      combo: 5,
      multiplicateur: 2,
    });

    expect(annonceDuFait(palier, 'classique', 'alice')).toEqual({
      texte: 'Combo x2 !',
      ton: 'succes',
    });
    expect(annonceDuFait(ralliement(0, { combo: 6, multiplicateur: 2 }))).toBeUndefined();
  });

  it('fait entendre le son d un faux ninja rallie', () => {
    expect(sonDuFait(ralliement(0))).toBe('botCapture');
  });
});
