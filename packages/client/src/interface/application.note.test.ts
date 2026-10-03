// @vitest-environment jsdom
/**
 * La note de version dans l'application (etape 4.9).
 *
 * Ce qu'on verifie: la note s'ouvre d'elle-meme a l'accueil d'un joueur qui revient,
 * ne revient plus une fois fermee, meme apres un rechargement, se rouvre par le
 * numero du pied, et ne s'ouvre ni pour un joueur tout nouveau, ni par-dessus une
 * invitation, ni ailleurs qu'a l'accueil.
 */

import { NUMERO_DE_VERSION, versionMineure } from '@neon-ninja/shared';
import { afterEach, describe, expect, it } from 'vitest';

import { creerClient } from '../client.js';
import { creerHorlogeClientManuelle } from '../horloge.js';
import type { Invitation } from '../invitation.js';
import { creerReseauFactice } from '../reseau.js';
import type { Application } from './application.js';
import { monterApplication } from './application.js';
import {
  boutonObligatoire,
  estCache,
  jeuDEssai,
  obligatoire,
  stockageEnMemoire,
} from './essais.js';
import { CLE_PREFERENCES_SON } from './preferences.js';
import { CLE_VERSION_VUE } from './souvenirDeVersion.js';

const TITRE = `Nouveautés de la version ${versionMineure(NUMERO_DE_VERSION)}`;

let application: Application | undefined;

/** Monte l'application sur ce stockage, comme a l'ouverture de la page. */
function ouvrirLaPage(stockage: Storage | undefined, invitation?: Invitation): HTMLElement {
  application?.demonter();
  document.body.replaceChildren();

  const hote = document.createElement('div');
  document.body.append(hote);

  application = monterApplication({
    hote,
    client: creerClient({
      reseau: creerReseauFactice(),
      horloge: creerHorlogeClientManuelle(),
      ...(invitation === undefined ? {} : { invitation }),
    }),
    horloge: creerHorlogeClientManuelle(),
    monterLeJeu: jeuDEssai().monteur,
    recharger: () => undefined,
    ...(stockage === undefined ? {} : { stockage }),
  });

  return hote;
}

/** Le cadre de la note dans la page, celui qui porte le role de fenetre. */
function note(hote: HTMLElement): HTMLElement {
  return obligatoire(hote, '.fenetre-note');
}

/** Un navigateur ou un joueur est deja passe, avant que les notes existent. */
function navigateurDUnHabitue(): Storage {
  const stockage = stockageEnMemoire();
  stockage.setItem(CLE_PREFERENCES_SON, '{"volumeMusique":0.2}');

  return stockage;
}

afterEach(() => {
  application?.demonter();
  application = undefined;
  document.body.replaceChildren();
});

describe('la note de version', () => {
  it('s ouvre a l accueil d un joueur qui revient, et ne revient plus une fois fermee', () => {
    const stockage = navigateurDUnHabitue();
    let hote = ouvrirLaPage(stockage);

    expect(estCache(note(hote))).toBe(false);
    expect(note(hote).getAttribute('aria-label')).toBe(TITRE);
    expect(document.activeElement).toBe(note(hote));

    boutonObligatoire(note(hote), 'Compris').click();

    expect(estCache(note(hote))).toBe(true);
    expect(stockage.getItem(CLE_VERSION_VUE)).not.toBeNull();

    // Recharger la page ne la rouvre pas.
    hote = ouvrirLaPage(stockage);

    expect(estCache(note(hote))).toBe(true);
  });

  it('revient au rechargement tant qu elle n a pas ete fermee', () => {
    const stockage = navigateurDUnHabitue();

    ouvrirLaPage(stockage);
    const hote = ouvrirLaPage(stockage);

    expect(estCache(note(hote))).toBe(false);
  });

  it('se rouvre par le numero du pied, et rend le focus au numero', () => {
    const hote = ouvrirLaPage(stockageEnMemoire());
    const numero = obligatoire<HTMLButtonElement>(hote, '.accueil-version');

    expect(estCache(note(hote))).toBe(true);
    expect(numero.tagName).toBe('BUTTON');
    expect(numero.type).toBe('button');
    expect(numero.textContent).toContain(`V${NUMERO_DE_VERSION}`);
    expect(numero.getAttribute('aria-haspopup')).toBe('dialog');

    numero.focus();
    numero.click();

    expect(estCache(note(hote))).toBe(false);

    note(hote).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(estCache(note(hote))).toBe(true);
    expect(document.activeElement).toBe(numero);
  });

  it('ne s ouvre pas pour un joueur tout nouveau, qui retient pourtant la version', () => {
    const stockage = stockageEnMemoire();
    let hote = ouvrirLaPage(stockage);

    expect(estCache(note(hote))).toBe(true);
    expect(stockage.getItem(CLE_VERSION_VUE)).not.toBeNull();

    // Il regle le son pendant sa visite: a son retour, il a deja vu cette version.
    stockage.setItem(CLE_PREFERENCES_SON, '{"volumeMusique":0.2}');
    hote = ouvrirLaPage(stockage);

    expect(estCache(note(hote))).toBe(true);
  });

  it('ne s ouvre pas sans stockage, et l accueil reste utilisable', () => {
    const hote = ouvrirLaPage(undefined);

    expect(estCache(note(hote))).toBe(true);
    expect(boutonObligatoire(hote, 'Partie rapide')).toBeDefined();
  });

  it('ne s ouvre pas par-dessus une invitation', () => {
    const hote = ouvrirLaPage(navigateurDUnHabitue(), { nature: 'code', code: 'ABC123' });

    expect(estCache(note(hote))).toBe(true);
    expect(estCache(obligatoire(hote, '.accueil-invitation'))).toBe(false);
  });

  it('ne reste pas ouverte hors de l accueil', () => {
    const hote = ouvrirLaPage(navigateurDUnHabitue());

    expect(estCache(note(hote))).toBe(false);

    boutonObligatoire(hote, 'Créer une partie').click();

    expect(obligatoire(hote, '.application').dataset['ecran']).toBe('creation');
    expect(hote.querySelector('.fenetre-note')).toBeNull();
  });
});
