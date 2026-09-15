// @vitest-environment jsdom
/**
 * Tests de la fenetre du code de secours, dans un document (etape 3.4).
 *
 * Ils montent un vrai client sur le banc d'essai du transport et des comptes d'essai,
 * et verifient que le code emis s'affiche, qu'il s'oublie a la fermeture quelle
 * qu'en soit la facon, et que la copie n'est proposee que si le navigateur la permet.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Client } from '../../client.js';
import { creerClient } from '../../client.js';
import { CODE_DESSAI, creerApiComptesFactice } from '../../comptes/api.js';
import { creerHorlogeClientManuelle } from '../../horloge.js';
import { creerReseauFactice } from '../../reseau.js';
import { boutonNomme, boutonObligatoire, estCache, obligatoire } from '../essais.js';
import type { FenetreDuCode } from './codeDeSecours.js';
import { monterFenetreDuCode } from './codeDeSecours.js';

let client: Client;
let fenetre: FenetreDuCode;
let desabonner: () => void;

/** Laisse les reponses des comptes d'essai arriver. */
async function laisserRepondre(): Promise<void> {
  await new Promise((resoudre) => setTimeout(resoudre, 0));
}

/** Monte un client en invite et la fenetre, branchee sur son etat. */
function monter(): void {
  document.body.replaceChildren();
  const reseau = creerReseauFactice();
  client = creerClient({
    reseau,
    comptes: creerApiComptesFactice(),
    horloge: creerHorlogeClientManuelle(),
  });
  client.ouvrir();
  reseau.simulerConnexion();

  fenetre = monterFenetreDuCode(document, client);
  document.body.append(fenetre.racine);
  desabonner = client.abonner((etat) => {
    fenetre.afficher(etat);
  });
  fenetre.afficher(client.etat);
}

/** Inscrit un compte: le serveur d'essai rend un code. */
async function sInscrire(): Promise<void> {
  client.sInscrire({ pseudo: 'Alice', motDePasse: 'correct cheval' });
  await laisserRepondre();
}

afterEach(() => {
  desabonner();
  fenetre.demonter();
  client.fermer();
});

describe('la fenetre du code de secours', () => {
  beforeEach(monter);

  it('reste fermee tant qu aucun code n est emis', () => {
    expect(estCache(fenetre.racine)).toBe(true);
  });

  it('s ouvre avec le code emis a l inscription', async () => {
    await sInscrire();

    expect(estCache(fenetre.racine)).toBe(false);
    expect(obligatoire(document, '.code-de-secours').textContent).toBe(CODE_DESSAI);
    expect(obligatoire(document, '[role="dialog"]').getAttribute('aria-label')).toBe(
      'Votre code de secours',
    );
  });

  it('oublie le code quand le joueur dit l avoir note', async () => {
    await sInscrire();

    boutonObligatoire(document, 'J’ai noté mon code').click();

    expect(client.etat.codeDeSecours).toBeUndefined();
    expect(estCache(fenetre.racine)).toBe(true);
  });

  it('oublie le code aussi quand la fenetre se ferme a la touche Echap', async () => {
    await sInscrire();

    fenetre.racine.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(client.etat.codeDeSecours).toBeUndefined();
    expect(estCache(fenetre.racine)).toBe(true);
  });

  it('ne propose pas de copier quand le navigateur n a pas de presse-papiers', async () => {
    await sInscrire();

    expect(boutonNomme(document, 'Copier')).toBeUndefined();
  });
});

describe('la copie du code', () => {
  const ecrire = vi.fn(async () => undefined);

  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: ecrire },
      configurable: true,
    });
    monter();
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'clipboard');
    ecrire.mockClear();
  });

  it('copie le code dans le presse-papiers, et le dit', async () => {
    await sInscrire();

    boutonObligatoire(document, 'Copier').click();
    await laisserRepondre();

    expect(ecrire).toHaveBeenCalledWith(CODE_DESSAI);
    expect(obligatoire(document, '.code-copie').textContent).toBe('Code copié.');
  });
});
