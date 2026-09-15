// @vitest-environment jsdom
/**
 * Tests de la securite du compte dans le profil, dans un document (etape 3.4).
 *
 * Ils jouent les gestes du joueur (saisir, quitter un champ, envoyer) sur un vrai
 * client connecte a un compte d'essai, et verifient ce qui part, ce que la page dit,
 * et que le formulaire se vide une fois la demande acceptee.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Client } from '../../client.js';
import { creerClient } from '../../client.js';
import type { ApiComptesFactice } from '../../comptes/api.js';
import {
  CODE_DESSAI,
  JETON_DESSAI,
  creerApiComptesFactice,
  profilDEssai,
} from '../../comptes/api.js';
import { creerCoffreDeJeton } from '../../comptes/coffre.js';
import { creerHorlogeClientManuelle } from '../../horloge.js';
import { creerReseauFactice } from '../../reseau.js';
import { estCache, obligatoire, saisir, soumettre } from '../essais.js';
import {
  AIDE_DU_CODE,
  AIDE_SANS_CODE,
  CONFIRMATION_DU_CHANGEMENT,
  CONFIRMATION_DU_CODE,
} from '../modeles/securite.js';
import type { SecuriteDuCompte } from './securiteDuCompte.js';
import { monterSecuriteDuCompte } from './securiteDuCompte.js';

let api: ApiComptesFactice;
let client: Client;
let securite: SecuriteDuCompte;
let desabonner: () => void;

/** Laisse les reponses des comptes d'essai arriver. */
async function laisserRepondre(): Promise<void> {
  await new Promise((resoudre) => setTimeout(resoudre, 0));
}

/** Un champ, par son nom. */
function champ(nom: string): HTMLInputElement {
  return obligatoire<HTMLInputElement>(document, `input[name="${nom}"]`);
}

/** Le formulaire de changement du mot de passe, puis celui du code. */
function formulaires(): HTMLFormElement[] {
  return [...document.querySelectorAll<HTMLFormElement>('.securite-formulaire')];
}

/** Les textes visibles sous ces selecteurs. */
function visibles(selecteur: string): string[] {
  return [...document.querySelectorAll(selecteur)]
    .filter((element) => !estCache(element))
    .map((element) => element.textContent ?? '');
}

beforeEach(async () => {
  document.body.replaceChildren();
  const reseau = creerReseauFactice();
  const coffre = creerCoffreDeJeton();
  coffre.garder(JETON_DESSAI);
  api = creerApiComptesFactice();
  client = creerClient({ reseau, comptes: api, coffre, horloge: creerHorlogeClientManuelle() });
  client.ouvrir();
  await laisserRepondre();
  reseau.simulerConnexion();

  securite = monterSecuriteDuCompte(document, client);
  document.body.append(securite.racine);
  desabonner = client.abonner((etat) => {
    securite.afficher(etat);
  });
  securite.afficher(client.etat);
});

afterEach(() => {
  desabonner();
  securite.demonter();
  client.fermer();
});

describe('la securite du compte', () => {
  it('change le mot de passe, vide le formulaire, et le dit', async () => {
    saisir(champ('mot-de-passe-actuel'), 'correct cheval');
    saisir(champ('nouveau-mot-de-passe'), 'nouveau secret');
    soumettre(formulaires()[0] as HTMLFormElement);
    await laisserRepondre();

    expect(api.appels.at(-1)).toEqual({
      nom: 'changerMotDePasse',
      argument: {
        jeton: JETON_DESSAI,
        demande: { motDePasse: 'correct cheval', nouveauMotDePasse: 'nouveau secret' },
      },
    });
    expect([champ('mot-de-passe-actuel').value, champ('nouveau-mot-de-passe').value]).toEqual([
      '',
      '',
    ]);
    expect(visibles('.securite-confirmation')).toEqual([CONFIRMATION_DU_CHANGEMENT]);
    expect(client.etat.codeDeSecours).toBe(CODE_DESSAI);
  });

  it('montre un mot de passe faux sous son champ, et l oublie quand le joueur retape', async () => {
    api.reponses.changerMotDePasse = async () => ({
      acceptee: false,
      statut: 403,
      erreurs: [{ champ: 'motDePasse', motif: 'Mot de passe incorrect.' }],
    });

    saisir(champ('mot-de-passe-actuel'), 'mauvais');
    saisir(champ('nouveau-mot-de-passe'), 'nouveau secret');
    soumettre(formulaires()[0] as HTMLFormElement);
    await laisserRepondre();

    expect(visibles('.champ-erreur')).toEqual(['Mot de passe incorrect.']);
    expect(client.etat.session.nature).toBe('compte');

    saisir(champ('mot-de-passe-actuel'), 'correct cheval');

    expect(visibles('.champ-erreur')).toEqual([]);
  });

  it('montre toutes les fautes a la tentative d envoi, sans rien envoyer', () => {
    const appels = api.appels.length;

    saisir(champ('mot-de-passe-actuel'), 'correct cheval');
    saisir(champ('nouveau-mot-de-passe'), 'court');

    expect(visibles('.champ-erreur')).toEqual([]);

    soumettre(formulaires()[0] as HTMLFormElement);

    expect(visibles('.champ-erreur')).toHaveLength(1);
    expect(api.appels).toHaveLength(appels);
  });

  it('demande un nouveau code avec le mot de passe actuel', async () => {
    saisir(champ('mot-de-passe-du-code'), 'correct cheval');
    soumettre(formulaires()[1] as HTMLFormElement);
    await laisserRepondre();

    expect(api.appels.at(-1)).toEqual({
      nom: 'nouveauCodeDeSecours',
      argument: { jeton: JETON_DESSAI, demande: { motDePasse: 'correct cheval' } },
    });
    expect(champ('mot-de-passe-du-code').value).toBe('');
    expect(visibles('.securite-confirmation')).toEqual([CONFIRMATION_DU_CODE]);
  });

  it('avertit un compte qui n a pas de code, jusqu a ce qu il en cree un', async () => {
    api.reponses.profil = async () => ({
      acceptee: true,
      valeur: { ...profilDEssai('Alice'), codeDeSecours: false },
    });
    client.chargerLeProfil();
    await laisserRepondre();

    const aide = obligatoire(document, '.securite-aide');

    expect(aide.textContent).toBe(AIDE_SANS_CODE);
    expect(aide.classList.contains('securite-alerte')).toBe(true);

    saisir(champ('mot-de-passe-du-code'), 'correct cheval');
    soumettre(formulaires()[1] as HTMLFormElement);
    await laisserRepondre();

    expect(aide.textContent).toBe(AIDE_DU_CODE);
    expect(aide.classList.contains('securite-alerte')).toBe(false);
  });

  it('dit au gestionnaire de mots de passe quel compte change de mot de passe', () => {
    const pseudos = [...document.querySelectorAll<HTMLInputElement>('input[name="pseudo"]')];

    expect(pseudos).toHaveLength(2);
    for (const pseudo of pseudos) {
      expect(pseudo.value).toBe('Alice');
      expect(pseudo.getAttribute('autocomplete')).toBe('username');
      expect(pseudo.hidden).toBe(true);
    }
    expect(champ('nouveau-mot-de-passe').getAttribute('autocomplete')).toBe('new-password');
  });
});
