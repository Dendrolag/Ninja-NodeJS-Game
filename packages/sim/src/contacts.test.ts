/**
 * Tests du releve des contacts entre entites.
 *
 * Le seuil et son inegalite stricte viennent de la caracterisation du legacy:
 * a vingt pixels pile il n'y a pas contact, juste en dessous il y en a un.
 */

import { describe, expect, it } from 'vitest';

import { SEUIL_CONTACT_PX, detecterContacts, resoudreContacts } from './contacts.js';
import type { EtatPartie } from './etat.js';
import { ajouterJoueur, creerEtatInitial } from './etat.js';

/** Partie peuplee de joueurs places ou on veut. */
function partieAvec(places: Readonly<Record<string, { x: number; y: number }>>): EtatPartie {
  let etat = creerEtatInitial({ graine: 1 });
  let teinte = 0;
  for (const [id, position] of Object.entries(places)) {
    teinte += 1;
    etat = ajouterJoueur(etat, {
      id,
      pseudo: id,
      position,
      couleur: `#00000${teinte}`,
    });
  }
  return etat;
}

describe('detecterContacts', () => {
  it('ne releve rien quand tout le monde est au large', () => {
    const etat = partieAvec({ j1: { x: 500, y: 500 }, j2: { x: 900, y: 900 } });

    expect(detecterContacts(etat)).toEqual([]);
  });

  it('releve un contact juste en dessous du seuil', () => {
    const etat = partieAvec({ j1: { x: 500, y: 500 }, j2: { x: 519, y: 500 } });
    const contacts = detecterContacts(etat);

    expect(contacts).toHaveLength(1);
    expect(contacts[0]?.distance).toBe(19);
  });

  it('ne releve rien a exactement vingt pixels', () => {
    const etat = partieAvec({ j1: { x: 500, y: 500 }, j2: { x: 500 + SEUIL_CONTACT_PX, y: 500 } });

    expect(detecterContacts(etat)).toEqual([]);
  });

  it('ne fait pas se toucher une entite avec elle-meme', () => {
    const etat = partieAvec({ j1: { x: 500, y: 500 } });

    expect(detecterContacts(etat)).toEqual([]);
  });

  it('ne compte chaque paire qu une fois, meme superposee', () => {
    const etat = partieAvec({ j1: { x: 500, y: 500 }, j2: { x: 500, y: 500 } });
    const contacts = detecterContacts(etat);

    expect(contacts).toHaveLength(1);
    expect(contacts[0]?.distance).toBe(0);
  });

  it('releve toutes les paires d un groupe serre', () => {
    const etat = partieAvec({
      j1: { x: 500, y: 500 },
      j2: { x: 505, y: 500 },
      j3: { x: 500, y: 505 },
    });

    expect(detecterContacts(etat)).toHaveLength(3);
  });

  it('donne toujours le meme releve pour le meme etat', () => {
    const etat = partieAvec({
      j1: { x: 500, y: 500 },
      j2: { x: 505, y: 500 },
      j3: { x: 900, y: 900 },
    });

    expect(detecterContacts(etat)).toEqual(detecterContacts(etat));
  });

  it('ne change rien a l etat', () => {
    const etat = partieAvec({ j1: { x: 500, y: 500 }, j2: { x: 505, y: 500 } });
    const avant = structuredClone({ joueurs: etat.joueurs, tick: etat.tick });

    detecterContacts(etat);

    expect({ joueurs: etat.joueurs, tick: etat.tick }).toEqual(avant);
  });
});

describe('resoudreContacts', () => {
  it('ne tire encore aucune consequence d un contact', () => {
    // La capture et le score sont l'etape 1.3, les bots l'etape 1.5. Ce test
    // documente la frontiere: la detection est branchee, la resolution attend.
    const etat = partieAvec({ j1: { x: 500, y: 500 }, j2: { x: 505, y: 500 } });

    expect(resoudreContacts(etat, detecterContacts(etat))).toBe(etat);
  });
});
