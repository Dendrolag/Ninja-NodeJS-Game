/**
 * Tests du magasin.
 *
 * Ils portent sur ce que le magasin ajoute au calcul de l'etat suivant: la
 * detention d'une seule valeur, la diffusion aux abonnes, et le silence quand
 * rien n'a change. C'est ce dernier point qui compte le plus a l'usage: le flux
 * d'etat arrive vingt fois par seconde, et reveiller les menus a chaque message
 * inutile reviendrait a payer le prix du legacy, qui redessinait tout a la
 * cadence du reseau.
 */

import { describe, expect, it } from 'vitest';

import type { EtatClient } from './etat.js';
import { ETAT_INITIAL } from './etat.js';
import { creerMagasin } from './magasin.js';

/** Un instantane minimal, au numero de battement demande. */
function instantane(tick: number) {
  return {
    tick,
    tempsRestantMs: 180_000,
    enPause: false,
    entites: [],
    objets: [],
    zones: [],
    classement: [],
  };
}

describe('magasin', () => {
  it('part de l etat initial', () => {
    expect(creerMagasin().etat).toBe(ETAT_INITIAL);
  });

  it('accepte un etat de depart, pour se placer dans une situation donnee', () => {
    const depart: EtatClient = { ...ETAT_INITIAL, ecran: 'jeu' };

    expect(creerMagasin(depart).etat.ecran).toBe('jeu');
  });

  it('remplace son etat quand une action arrive', () => {
    const magasin = creerMagasin();

    magasin.appliquer({ type: 'connexionEtablie', identifiant: 'abc' });

    expect(magasin.etat.moi).toBe('abc');
    expect(magasin.etat).not.toBe(ETAT_INITIAL);
  });

  it('previent ses abonnes du nouvel etat', () => {
    const magasin = creerMagasin();
    const vus: EtatClient[] = [];

    magasin.abonner((etat) => vus.push(etat));
    magasin.appliquer({ type: 'connexionEtablie', identifiant: 'abc' });

    expect(vus).toHaveLength(1);
    expect(vus[0]).toBe(magasin.etat);
  });

  it('previent tous ses abonnes', () => {
    const magasin = creerMagasin();
    let premier = 0;
    let second = 0;

    magasin.abonner(() => (premier += 1));
    magasin.abonner(() => (second += 1));
    magasin.appliquer({ type: 'connexionEtablie', identifiant: 'abc' });

    expect(premier).toBe(1);
    expect(second).toBe(1);
  });

  it('ne previent plus apres desabonnement', () => {
    const magasin = creerMagasin();
    let appels = 0;

    const desabonner = magasin.abonner(() => (appels += 1));
    magasin.appliquer({ type: 'connexionEtablie', identifiant: 'abc' });
    desabonner();
    magasin.appliquer({ type: 'entreeDemandee', pseudo: 'Alice' });

    expect(appels).toBe(1);
  });

  it('supporte qu un abonne se desabonne en recevant l etat', () => {
    const magasin = creerMagasin();
    let voisin = 0;

    const desabonner = magasin.abonner(() => {
      desabonner();
    });
    magasin.abonner(() => (voisin += 1));

    magasin.appliquer({ type: 'connexionEtablie', identifiant: 'abc' });

    // Le voisin doit avoir ete prevenu malgre le desabonnement du premier.
    expect(voisin).toBe(1);
  });

  it('ne previent personne quand l action ne change rien', () => {
    const magasin = creerMagasin();
    let appels = 0;

    magasin.appliquer({ type: 'connexionEtablie', identifiant: 'moi' });
    magasin.appliquer({ type: 'partieLancee' });
    magasin.appliquer({ type: 'etat', instantane: instantane(5) });

    magasin.abonner(() => (appels += 1));

    // Un instantane perime ne change rien: personne ne doit etre reveille.
    magasin.appliquer({ type: 'etat', instantane: instantane(3) });

    expect(appels).toBe(0);
    expect(magasin.etat.partie?.tick).toBe(5);
  });

  it('tient deux magasins independants dans le meme processus', () => {
    // C'est ce que l'absence de variable globale mutable rend possible, et ce
    // que le client d'origine interdisait.
    const premier = creerMagasin();
    const second = creerMagasin();

    premier.appliquer({ type: 'connexionEtablie', identifiant: 'un' });
    second.appliquer({ type: 'connexionEtablie', identifiant: 'deux' });

    expect(premier.etat.moi).toBe('un');
    expect(second.etat.moi).toBe('deux');
  });
});
