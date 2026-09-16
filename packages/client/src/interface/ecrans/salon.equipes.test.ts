// @vitest-environment jsdom
/**
 * Tests de l'ecran du salon d'une partie Equipes (etape 7.2), dans un document: les deux
 * colonnes d'equipe, le bouton pour rejoindre l'autre equipe, et le lancement suspendu
 * tant qu'une equipe est vide.
 */

import type { InfosSalon, JoueurDuSalon } from '@neon-ninja/shared';
import { REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Client } from '../../client.js';
import { creerClient } from '../../client.js';
import { creerHorlogeClientManuelle } from '../../horloge.js';
import type { ReseauFactice } from '../../reseau.js';
import { creerReseauFactice } from '../../reseau.js';
import { contexteDEssai, obligatoire } from '../essais.js';
import { monterSalon } from './salon.js';
import type { EcranAffiche } from './types.js';

const ALICE: JoueurDuSalon = { id: 'moi', pseudo: 'Alice', hote: true, equipe: 'cyan' };
const BOB: JoueurDuSalon = { id: 'bob', pseudo: 'Bob', hote: false, equipe: 'magenta' };

/** Un salon Equipes avec ces membres. */
function salon(
  joueurs: readonly JoueurDuSalon[],
  mode: InfosSalon['mode'] = 'equipes',
): InfosSalon {
  return {
    idRoom: 'room-1',
    statut: 'salon',
    mode,
    visibilite: 'publique',
    capacite: 12,
    joueurs,
    reglages: REGLAGES_PAR_DEFAUT,
  };
}

let reseau: ReseauFactice;
let client: Client;
let ecran: EcranAffiche;

/** Entre dans ce salon et monte l'ecran. */
function monter(infos: InfosSalon): void {
  reseau.simulerConnexion();
  reseau.recevoir('placeAttribuee', { joueur: 'moi', jetonDeRetour: 'M'.repeat(43) });
  client.rejoindre('Alice');
  reseau.dernier('rejoindre')?.[1]({ valide: true, valeur: infos });

  ecran = monterSalon(contexteDEssai(client));
  document.body.append(ecran.racine);
  ecran.afficher(client.etat);
}

/** La colonne d'une equipe. */
function colonne(equipe: string): HTMLElement {
  return obligatoire(document.body, `[data-equipe="${equipe}"]`);
}

/** Le bouton du bas du salon qui porte ce texte, s'il est affiche. */
function boutonAffiche(texte: string): HTMLButtonElement | undefined {
  return [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidat) => candidat.textContent === texte && !candidat.hidden,
  );
}

beforeEach(() => {
  document.body.replaceChildren();
  reseau = creerReseauFactice();
  client = creerClient({ reseau, horloge: creerHorlogeClientManuelle() });
});

afterEach(() => {
  ecran.demonter();
  client.fermer();
});

describe('le salon d une partie Equipes', () => {
  it('range chaque joueur dans la colonne de son equipe, a sa couleur', () => {
    monter(salon([ALICE, BOB]));

    expect(colonne('cyan').querySelector('[data-joueur="moi"]')).not.toBeNull();
    expect(colonne('magenta').querySelector('[data-joueur="bob"]')).not.toBeNull();
    expect(colonne('cyan').style.getPropertyValue('--couleur-equipe')).toBe('#00FFFF');
    expect(colonne('cyan').textContent).toContain('Votre équipe');
    expect(obligatoire(document.body, '.salon-principal > .salon-joueurs').hidden).toBe(true);
  });

  it('propose de rejoindre l autre equipe, et le demande au serveur', () => {
    monter(salon([ALICE, BOB]));

    const rejoindre = colonne('magenta').querySelector('button');
    expect(colonne('cyan').querySelector('button')).toBeNull();
    expect(rejoindre?.textContent).toBe('Rejoindre l’équipe magenta');
    expect(rejoindre?.disabled).toBe(false);

    rejoindre?.click();

    expect(reseau.dernier('changerDEquipe')).toEqual(['magenta']);
  });

  it('dit qu une equipe complete ne peut pas etre rejointe', () => {
    const magentas = ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'].map((id): JoueurDuSalon => ({
      id,
      pseudo: id,
      hote: false,
      equipe: 'magenta',
    }));
    monter(salon([ALICE, ...magentas]));

    const bouton = colonne('magenta').querySelector('button');

    expect(bouton?.textContent).toBe('Équipe complète');
    expect(bouton?.disabled).toBe(true);
  });

  it('suspend le lancement tant qu une equipe est vide, et dit pourquoi', () => {
    monter(salon([ALICE]));

    expect(boutonAffiche('Lancer la partie')).toBeUndefined();
    expect(obligatoire(document.body, '.salon-consigne').textContent).toBe(
      'Il faut au moins un joueur dans chaque équipe pour lancer la partie.',
    );
  });

  it('garde la liste simple hors du mode Equipes', () => {
    monter(salon([{ id: 'moi', pseudo: 'Alice', hote: true }], 'classique'));

    expect(document.querySelectorAll('[data-equipe]')).toHaveLength(0);
    expect(obligatoire(document.body, '.salon-equipes').hidden).toBe(true);
  });
});
