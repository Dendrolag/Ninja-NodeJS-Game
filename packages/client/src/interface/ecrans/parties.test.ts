// @vitest-environment jsdom
/**
 * Tests de l'ecran des parties publiques, dans un document.
 *
 * Le test exige par la fiche de la reprise des ecrans du jalon 3 pour le navigateur:
 * la liste affichee correspond a la liste recue, on rejoint par la liste et par un
 * code, un code mal forme est refuse avant l'envoi, et le refus du serveur se dit.
 * L'application entiere est montee, pour que la liste soit demandee comme en jeu: a
 * l'arrivee sur l'ecran.
 */

import type { InfosSalon, PartiePublique } from '@neon-ninja/shared';
import { REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Client } from '../../client.js';
import { creerClient } from '../../client.js';
import { creerHorlogeClientManuelle } from '../../horloge.js';
import type { ReseauFactice } from '../../reseau.js';
import { creerReseauFactice } from '../../reseau.js';
import type { Application } from '../application.js';
import { monterApplication } from '../application.js';
import {
  boutonObligatoire,
  estCache,
  jeuDEssai,
  obligatoire,
  saisir,
  soumettre,
} from '../essais.js';

const PARTIES: readonly PartiePublique[] = [
  {
    idRoom: 'room-1',
    hote: 'KageOni',
    mode: 'classique',
    carte: 'map2',
    modeMiroir: false,
    joueurs: 3,
    capacite: 12,
  },
  {
    idRoom: 'room-2',
    hote: 'Akumu',
    mode: 'classique',
    carte: 'map3',
    modeMiroir: true,
    joueurs: 11,
    capacite: 12,
  },
];

const SALON: InfosSalon = {
  idRoom: 'room-1',
  statut: 'salon',
  mode: 'classique',
  visibilite: 'publique',
  capacite: 12,
  joueurs: [
    { id: 'kage', pseudo: 'KageOni', hote: true },
    { id: 'moi', pseudo: 'Alice', hote: false },
  ],
  reglages: REGLAGES_PAR_DEFAUT,
};

let hote: HTMLElement;
let reseau: ReseauFactice;
let client: Client;
let application: Application;

/** L'ecran affiche par l'application. */
function ecranAffiche(): string | undefined {
  return obligatoire(hote, '.application').dataset['ecran'];
}

/** Le nombre de demandes de liste envoyees. */
function demandesDeListe(): number {
  return reseau.emis.filter((message) => message.nom === 'listerParties').length;
}

/** Repond a la derniere demande de liste. */
function repondreALaListe(parties: readonly PartiePublique[]): void {
  reseau.dernier('listerParties')?.[0](parties);
}

/** Va de l'accueil a la liste, apres avoir saisi ce pseudo. */
function allerALaListe(pseudo: string): void {
  saisir(obligatoire<HTMLInputElement>(hote, 'input[name="pseudo"]'), pseudo);
  boutonObligatoire(hote, 'Parcourir').click();
}

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
  reseau.simulerConnexion('moi');
});

afterEach(() => {
  application.demonter();
  client.fermer();
});

describe('l ecran des parties', () => {
  it('demande la liste en arrivant, puis affiche les salons recus dans leur ordre', () => {
    allerALaListe('Alice');

    expect(ecranAffiche()).toBe('parties');
    expect(demandesDeListe()).toBe(1);
    expect(estCache(obligatoire(hote, '.parties-chargement'))).toBe(false);

    repondreALaListe(PARTIES);

    const lignes = [...hote.querySelectorAll('.partie')].map((ligne) => [
      ligne.querySelector('.partie-titre')?.textContent,
      ligne.querySelector('.partie-details')?.textContent,
      ligne.querySelector('.partie-joueurs')?.textContent,
    ]);

    expect(lignes).toEqual([
      ['Salon de KageOni', 'Classique · Tokyo', '3/12'],
      ['Salon de Akumu', 'Classique · Spirit & Time · Miroir', '11/12'],
    ]);
    expect(obligatoire(hote, '.sous-titre-ecran').textContent).toBe('2 parties ouvertes');
    expect(estCache(obligatoire(hote, '.parties-chargement'))).toBe(true);
  });

  it('garde le pseudo saisi a l accueil', () => {
    allerALaListe('Alice');

    expect(obligatoire<HTMLInputElement>(hote, 'input[name="pseudo"]').value).toBe('Alice');
  });

  it('rejoint un salon de la liste sous le pseudo saisi, et entre dans son salon', () => {
    allerALaListe('Alice');
    repondreALaListe(PARTIES);

    boutonObligatoire(hote, 'Rejoindre le salon de KageOni').click();

    expect(reseau.dernier('rejoindre')?.[0]).toStrictEqual({ pseudo: 'Alice', idRoom: 'room-1' });

    reseau.dernier('rejoindre')?.[1]({ valide: true, valeur: SALON });

    expect(ecranAffiche()).toBe('salon');
  });

  it('ne laisse pas un invite rejoindre sans pseudo, et lui dit pourquoi', () => {
    allerALaListe('');
    repondreALaListe(PARTIES);

    expect(boutonObligatoire(hote, 'Rejoindre le salon de KageOni').disabled).toBe(true);
    expect(obligatoire(hote, '.parties-aide').textContent).toBe(
      'Choisissez un pseudo pour rejoindre une partie.',
    );
  });

  it('refuse un code mal forme avant de l envoyer, puis envoie un code valide sous sa forme canonique', () => {
    allerALaListe('Alice');
    const code = obligatoire<HTMLInputElement>(hote, 'input[name="code"]');
    const formulaire = obligatoire<HTMLFormElement>(hote, '.code-prive');

    saisir(code, 'abc');
    soumettre(formulaire);

    expect(estCache(obligatoire(hote, '.parties-erreur'))).toBe(false);
    expect(reseau.dernier('rejoindre')).toBeUndefined();

    saisir(code, ' nx7k2p ');
    soumettre(formulaire);

    expect(reseau.dernier('rejoindre')?.[0]).toStrictEqual({ pseudo: 'Alice', code: 'NX7K2P' });
  });

  it('affiche le refus du serveur sans quitter l ecran', () => {
    allerALaListe('Alice');
    repondreALaListe(PARTIES);

    boutonObligatoire(hote, 'Rejoindre le salon de Akumu').click();
    reseau.dernier('rejoindre')?.[1]({
      valide: false,
      erreurs: [{ champ: 'rejoindre', motif: 'Cette partie est complète.' }],
    });

    expect(ecranAffiche()).toBe('parties');
    expect(obligatoire(hote, '.parties-erreur').textContent).toBe('Cette partie est complète.');
  });

  it('propose de creer une partie quand aucune n attend de joueurs', () => {
    allerALaListe('Alice');
    repondreALaListe([]);

    expect(estCache(obligatoire(hote, '.parties-vide'))).toBe(false);

    boutonObligatoire(obligatoire(hote, '.parties-vide'), 'Créer une partie').click();

    expect(ecranAffiche()).toBe('creation');
  });

  it('actualise la liste sur demande', () => {
    allerALaListe('Alice');
    repondreALaListe(PARTIES);

    boutonObligatoire(hote, 'Actualiser').click();

    expect(demandesDeListe()).toBe(2);
  });
});
