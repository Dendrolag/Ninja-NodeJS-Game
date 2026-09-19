// @vitest-environment jsdom
/**
 * Tests des textes de presentation du jeu (etape 4.5).
 *
 * Les textes arretes avec le porteur du projet le 19 septembre 2026 sont en place,
 * le meme texte presente chaque mode sur l'accueil, a la creation et dans l'aide, et
 * plus aucun ecran ne parle de troupeaux ni de faux ninjas. L'aide cite Espace et le
 * bouton Katana pour les trois modes qui s'en servent: elle ne le disait que pour la
 * Tactique.
 */

import { MODES } from '@neon-ninja/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Client } from '../client.js';
import { creerClient } from '../client.js';
import { creerHorlogeClientManuelle } from '../horloge.js';
import type { ReseauFactice } from '../reseau.js';
import { creerReseauFactice } from '../reseau.js';
import type { Application } from './application.js';
import { monterApplication } from './application.js';
import { monterAide } from './composants/aide.js';
import { jeuDEssai, obligatoire } from './essais.js';
import { NOMS_DES_MODES, TEXTES_DES_MODES } from './modeles/cartes.js';

let hote: HTMLElement;
let reseau: ReseauFactice;
let client: Client;
let application: Application;

beforeEach(() => {
  document.body.replaceChildren();
  hote = document.createElement('div');
  document.body.append(hote);

  reseau = creerReseauFactice();
  client = creerClient({ reseau, horloge: creerHorlogeClientManuelle() });
  application = monterApplication({
    hote,
    client,
    horloge: creerHorlogeClientManuelle(),
    monterLeJeu: jeuDEssai().monteur,
    recharger: () => undefined,
  });
  reseau.simulerConnexion();
});

afterEach(() => {
  application.demonter();
  client.fermer();
});

/** Le texte visible d'un element, espaces ramenes a un seul. */
function texte(element: Element): string {
  return (element.textContent ?? '').replace(/\s+/gu, ' ').trim();
}

describe('l accueil', () => {
  it('se presente par le titre et l accroche arretes avec le porteur du projet', () => {
    expect(texte(obligatoire(hote, '.accueil-titre'))).toBe(
      'Le ninja, c’est vous.Enfin, un des trois cents.',
    );
    expect(texte(obligatoire(hote, '.accueil-accroche'))).toBe(
      'Plusieurs modes, beaucoup de ninjas.',
    );
  });

  it('montre une carte par mode, avec son nom et son texte', () => {
    const cartes = [...hote.querySelectorAll('.accueil-modes .carte-mode')];

    expect(cartes.map((carte) => texte(obligatoire(carte, 'h2')))).toEqual(
      MODES.map((mode) => NOMS_DES_MODES[mode]),
    );
    expect(cartes.map((carte) => texte(obligatoire(carte, 'p')))).toEqual(
      MODES.map((mode) => TEXTES_DES_MODES[mode]),
    );
  });
});

describe('la creation', () => {
  it('presente chaque mode avec le meme texte que l accueil', () => {
    client.naviguer('creation');

    for (const mode of MODES) {
      const tuile = obligatoire(hote, `[data-mode="${mode}"]`);
      expect(texte(tuile)).toContain(TEXTES_DES_MODES[mode]);
    }
  });
});

describe('l aide', () => {
  it('a une section par mode, qui s ouvre sur le texte du mode', () => {
    const aide = monterAide(document);

    for (const mode of MODES) {
      const section = obligatoire(aide.racine, `.aide-mode[data-mode="${mode}"]`);
      expect(texte(obligatoire(section, 'h3'))).toBe(NOMS_DES_MODES[mode]);
      expect(texte(obligatoire(section, '.aide-accroche'))).toBe(TEXTES_DES_MODES[mode]);
      expect(section.querySelectorAll('p').length).toBeGreaterThan(1);
    }
  });

  it('cite Espace et le bouton Katana pour les trois modes qui s en servent', () => {
    const commandes = texte(obligatoire(monterAide(document).racine, '.aide-commandes'));

    expect(commandes).toContain('Capturer en Tactique et en Chasse, trancher en Massacre');
    expect(commandes).toContain('Bouton Capturer ou Katana');
  });
});

describe('le vocabulaire', () => {
  it('ne parle plus de troupeaux ni de faux ninjas, sur aucun ecran de presentation', () => {
    const lus = [texte(hote), texte(monterAide(document).racine)];
    client.naviguer('creation');
    lus.push(texte(hote));

    for (const lu of lus) {
      expect(lu).not.toMatch(/troupeau|faux ninja/iu);
    }
  });
});
