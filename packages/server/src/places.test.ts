/**
 * Tests du registre des places (etape 2.5).
 *
 * Le registre se teste sans reseau: une horloge manuelle fait passer le delai de
 * retour, et un tirage de jetons previsible permet de dire lequel est en vigueur.
 */

import type { SessionJoueur } from '@neon-ninja/shared';
import { BORNES_JETON, DELAI_DE_RETOUR_MS } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { HorlogeManuelle } from './horloge.js';
import { creerHorlogeManuelle } from './horloge.js';
import type { Place } from './places.js';
import { RETOUR_REFUSE, RegistreDesPlaces } from './places.js';

const ALICE: SessionJoueur = { id: 'c-alice', pseudo: 'Alice' };
const BOB_COMPTE: SessionJoueur = {
  id: 'c-bob',
  pseudo: 'Bob',
  compte: { id: 'compte-bob', niveau: 3 },
};

/** Un registre, son horloge, et des jetons numerotes dans l'ordre du tirage. */
function registreDeTest(): {
  readonly registre: RegistreDesPlaces;
  readonly horloge: HorlogeManuelle;
} {
  const horloge = creerHorlogeManuelle();
  let numero = 0;
  const registre = new RegistreDesPlaces({
    horloge,
    tirerJeton: () => {
      numero += 1;
      return `jeton-${String(numero)}`;
    },
  });

  return { registre, horloge };
}

/** Le motif d'un refus, ou un echec de test si c'etait accepte. */
function motifDuRefus(verdict: ReturnType<RegistreDesPlaces['verifier']>): string | undefined {
  if (verdict.valide) {
    throw new Error('Attendu un refus, recu une place.');
  }

  return verdict.erreurs[0]?.motif;
}

describe('RegistreDesPlaces, attribution', () => {
  it('donne une place jouee par la connexion qui entre, avec un jeton', () => {
    const { registre } = registreDeTest();

    const place = registre.attribuer('room-1', ALICE, 's1');

    expect(place).toEqual({
      idRoom: 'room-1',
      session: ALICE,
      connexion: 's1',
      jetonDeRetour: 'jeton-1',
    });
    expect(registre.placeDeLaConnexion('s1')).toEqual(place);
    expect(registre.connexionDuJoueur('c-alice')).toBe('s1');
    expect(registre.nombreDePlaces).toBe(1);
  });

  it('tire par defaut un jeton de la forme d un jeton de session, jamais deux fois le meme', () => {
    const registre = new RegistreDesPlaces({ horloge: creerHorlogeManuelle() });

    const premier = registre.attribuer('room-1', ALICE, 's1').jetonDeRetour;
    const second = registre.attribuer('room-1', BOB_COMPTE, 's2').jetonDeRetour;

    expect(BORNES_JETON.forme.test(premier)).toBe(true);
    expect(second).not.toBe(premier);
  });

  it('retire un jeton deja porte par une place', () => {
    const horloge = creerHorlogeManuelle();
    const tirages = ['double', 'double', 'autre'];
    const registre = new RegistreDesPlaces({ horloge, tirerJeton: () => tirages.shift() ?? '' });

    registre.attribuer('room-1', ALICE, 's1');

    expect(registre.attribuer('room-1', BOB_COMPTE, 's2').jetonDeRetour).toBe('autre');
  });

  it('remplace la place qu un joueur tenait deja, et son ancien jeton ne vaut plus rien', () => {
    const { registre } = registreDeTest();

    registre.attribuer('room-1', ALICE, 's1');
    registre.attribuer('room-2', ALICE, 's1');

    expect(registre.nombreDePlaces).toBe(1);
    expect(motifDuRefus(registre.verifier('jeton-1', undefined))).toBe(RETOUR_REFUSE);
    expect(registre.placeDeLaConnexion('s1')?.idRoom).toBe('room-2');
  });
});

describe('RegistreDesPlaces, suspension et expiration', () => {
  it('garde la place sans connexion pendant le delai, puis la libere et previent', () => {
    const { registre, horloge } = registreDeTest();
    const expirees: Place[] = [];

    registre.attribuer('room-1', ALICE, 's1');
    registre.suspendre('c-alice', (place) => expirees.push(place));

    expect(registre.connexionDuJoueur('c-alice')).toBeUndefined();
    expect(registre.placeDeLaConnexion('s1')).toBeUndefined();
    expect(registre.verifier('jeton-1', undefined).valide).toBe(true);

    horloge.avancerDe(DELAI_DE_RETOUR_MS - 1);
    expect(expirees).toEqual([]);

    horloge.avancerDe(1);
    expect(expirees).toEqual([
      { idRoom: 'room-1', session: ALICE, connexion: undefined, jetonDeRetour: 'jeton-1' },
    ]);
    expect(registre.nombreDePlaces).toBe(0);
    expect(motifDuRefus(registre.verifier('jeton-1', undefined))).toBe(RETOUR_REFUSE);

    // Le delai ne se repete pas.
    horloge.avancerDe(DELAI_DE_RETOUR_MS * 3);
    expect(expirees).toHaveLength(1);
  });

  it('ne suspend pas deux fois, ni un joueur sans place', () => {
    const { registre, horloge } = registreDeTest();
    let expirations = 0;

    registre.attribuer('room-1', ALICE, 's1');
    registre.suspendre('c-alice', () => (expirations += 1));
    horloge.avancerDe(DELAI_DE_RETOUR_MS / 2);
    registre.suspendre('c-alice', () => (expirations += 1));
    registre.suspendre('inconnu', () => (expirations += 1));

    horloge.avancerDe(DELAI_DE_RETOUR_MS / 2);

    expect(expirations).toBe(1);
  });

  it('accepte un autre delai que celui du jeu', () => {
    const horloge = creerHorlogeManuelle();
    const registre = new RegistreDesPlaces({ horloge, delaiDeRetourMs: 100 });
    let expiree = false;

    registre.attribuer('room-1', ALICE, 's1');
    registre.suspendre('c-alice', () => (expiree = true));
    horloge.avancerDe(100);

    expect(expiree).toBe(true);
  });

  it('libere une place suspendue sans prevenir, et son delai s arrete', () => {
    const { registre, horloge } = registreDeTest();
    let expiree = false;

    registre.attribuer('room-1', ALICE, 's1');
    registre.suspendre('c-alice', () => (expiree = true));
    registre.liberer('c-alice');
    horloge.avancerDe(DELAI_DE_RETOUR_MS);

    expect(expiree).toBe(false);
    expect(registre.nombreDePlaces).toBe(0);
  });

  it('se ferme en arretant tous les delais', () => {
    const { registre, horloge } = registreDeTest();
    let expirations = 0;

    registre.attribuer('room-1', ALICE, 's1');
    registre.attribuer('room-1', BOB_COMPTE, 's2');
    registre.suspendre('c-alice', () => (expirations += 1));
    registre.suspendre('c-bob', () => (expirations += 1));
    registre.fermer();
    horloge.avancerDe(DELAI_DE_RETOUR_MS);

    expect(expirations).toBe(0);
    expect(registre.nombreDePlaces).toBe(0);
  });

  it('liberer un joueur sans place ne fait rien', () => {
    const { registre } = registreDeTest();

    registre.attribuer('room-1', ALICE, 's1');
    registre.liberer('inconnu');

    expect(registre.nombreDePlaces).toBe(1);
  });
});

describe('RegistreDesPlaces, retour', () => {
  it('ouvre la place a la meme identite: un invite pour un invite, le meme compte pour un compte', () => {
    const { registre } = registreDeTest();

    registre.attribuer('room-1', ALICE, 's1');
    registre.attribuer('room-1', BOB_COMPTE, 's2');

    expect(registre.verifier('jeton-1', undefined).valide).toBe(true);
    expect(registre.verifier('jeton-2', 'compte-bob').valide).toBe(true);
  });

  it('refuse du meme motif un jeton inconnu, une place d invite pour un compte, et un autre compte', () => {
    const { registre } = registreDeTest();

    registre.attribuer('room-1', ALICE, 's1');
    registre.attribuer('room-1', BOB_COMPTE, 's2');

    expect(motifDuRefus(registre.verifier('jeton-inconnu', undefined))).toBe(RETOUR_REFUSE);
    expect(motifDuRefus(registre.verifier('jeton-1', 'compte-bob'))).toBe(RETOUR_REFUSE);
    expect(motifDuRefus(registre.verifier('jeton-2', undefined))).toBe(RETOUR_REFUSE);
    expect(motifDuRefus(registre.verifier('jeton-2', 'compte-carole'))).toBe(RETOUR_REFUSE);
  });

  it('verifier ne change rien a la place', () => {
    const { registre } = registreDeTest();

    const avant = registre.attribuer('room-1', ALICE, 's1');
    registre.verifier('jeton-1', undefined);

    expect(registre.placeDeLaConnexion('s1')).toEqual(avant);
  });

  it('reprend une place suspendue: nouvelle connexion, jeton neuf, delai arrete', () => {
    const { registre, horloge } = registreDeTest();
    let expiree = false;

    registre.attribuer('room-1', ALICE, 's1');
    registre.suspendre('c-alice', () => (expiree = true));
    horloge.avancerDe(DELAI_DE_RETOUR_MS - 1);

    const reprise = registre.reprendre('c-alice', 's2');
    horloge.avancerDe(DELAI_DE_RETOUR_MS);

    expect(reprise).toEqual({
      place: { idRoom: 'room-1', session: ALICE, connexion: 's2', jetonDeRetour: 'jeton-2' },
      connexionRemplacee: undefined,
    });
    expect(expiree).toBe(false);
    expect(registre.connexionDuJoueur('c-alice')).toBe('s2');
    expect(registre.placeDeLaConnexion('s2')?.session).toEqual(ALICE);
    expect(motifDuRefus(registre.verifier('jeton-1', undefined))).toBe(RETOUR_REFUSE);
    expect(registre.verifier('jeton-2', undefined).valide).toBe(true);
  });

  it('reprend une place encore tenue, et dit a quelle connexion elle a ete prise', () => {
    const { registre } = registreDeTest();

    registre.attribuer('room-1', ALICE, 's1');
    const reprise = registre.reprendre('c-alice', 's2');

    expect(reprise.connexionRemplacee).toBe('s1');
    expect(registre.placeDeLaConnexion('s1')).toBeUndefined();
    expect(registre.connexionDuJoueur('c-alice')).toBe('s2');
  });

  it('une place reprise se suspend et expire de nouveau', () => {
    const { registre, horloge } = registreDeTest();
    let expirations = 0;

    registre.attribuer('room-1', ALICE, 's1');
    registre.suspendre('c-alice', () => (expirations += 1));
    registre.reprendre('c-alice', 's2');
    registre.suspendre('c-alice', () => (expirations += 1));
    horloge.avancerDe(DELAI_DE_RETOUR_MS);

    expect(expirations).toBe(1);
  });

  it('refuse de reprendre la place d un joueur qui n en a pas: c est une faute de l appelant', () => {
    const { registre } = registreDeTest();

    expect(() => registre.reprendre('inconnu', 's1')).toThrow();
  });
});
