/**
 * Tests du calcul de l'etat suivant pour la fiche d'un joueur (etape 3.5).
 *
 * Ce qu'ils protegent: une fiche ouverte attend sa lecture, une reponse ne vaut que
 * pour la fiche qui l'attend encore, et la fiche ne survit ni a un changement d'ecran
 * ni au retour en invite.
 */

import type { InfosSalon, MaProgression } from '@neon-ninja/shared';
import { REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { Action } from './actions.js';
import { ficheDEssai } from './comptes/api.js';
import type { EtatClient } from './etat.js';
import { ETAT_INITIAL, FICHE_FERMEE } from './etat.js';
import { reduire } from './reduction.js';

/** Applique une suite d'actions a l'etat de depart. */
function apres(actions: readonly Action[], depart: EtatClient = ETAT_INITIAL): EtatClient {
  return actions.reduce(reduire, depart);
}

const PROGRESSION: MaProgression = {
  pseudo: 'Alice',
  niveau: 2,
  xpTotale: 150,
  pieces: 15,
  pointsLigue: 20,
  inscritLe: '2026-09-11T10:00:00.000Z',
};

const SALON: InfosSalon = {
  idRoom: 'room-1',
  statut: 'salon',
  mode: 'classique',
  visibilite: 'publique',
  capacite: 12,
  joueurs: [
    { id: 'moi', pseudo: 'Alice', hote: true, compte: { niveau: 2 } },
    { id: 'bob', pseudo: 'Bob', hote: false, compte: { niveau: 5 } },
  ],
  reglages: REGLAGES_PAR_DEFAUT,
};

/** Un compte connecte, dans son salon, qui ouvre la fiche de Bob. */
const FICHE_DE_BOB_DEMANDEE: readonly Action[] = [
  { type: 'sessionDeCompte', progression: PROGRESSION },
  { type: 'connexionEtablie' },
  { type: 'entreeDemandee', pseudo: undefined },
  { type: 'entreeAcceptee', salon: SALON },
  { type: 'ficheDemandee', pseudo: 'Bob' },
];

describe('la fiche d un joueur', () => {
  it('est fermee au depart', () => {
    expect(ETAT_INITIAL.fiche).toEqual(FICHE_FERMEE);
  });

  it('s ouvre sur sa lecture, puis montre ce qui est arrive', () => {
    const ouverte = apres(FICHE_DE_BOB_DEMANDEE);

    expect(ouverte.fiche).toEqual({ statut: 'chargement', pseudo: 'Bob' });
    expect(ouverte.ecran).toBe('salon');

    const fiche = ficheDEssai('Bob');

    expect(reduire(ouverte, { type: 'ficheRecue', pseudo: 'Bob', fiche }).fiche).toEqual({
      statut: 'chargee',
      pseudo: 'Bob',
      fiche,
    });
    expect(
      reduire(ouverte, { type: 'ficheRefusee', pseudo: 'Bob', motif: 'Injoignable.' }).fiche,
    ).toEqual({ statut: 'echec', pseudo: 'Bob', motif: 'Injoignable.' });
  });

  it('ignore la reponse d une fiche qu on a fermee, ou remplacee par une autre', () => {
    const fermee = apres([...FICHE_DE_BOB_DEMANDEE, { type: 'ficheFermee' }]);
    const autre = apres([...FICHE_DE_BOB_DEMANDEE, { type: 'ficheDemandee', pseudo: 'Alice' }]);
    const reponseDeBob: Action = { type: 'ficheRecue', pseudo: 'Bob', fiche: ficheDEssai('Bob') };
    const refusDeBob: Action = { type: 'ficheRefusee', pseudo: 'Bob', motif: 'Refus.' };

    // Rien ne change: le meme etat est rendu, et l'interface n'a rien a redessiner.
    expect(reduire(fermee, reponseDeBob)).toBe(fermee);
    expect(reduire(autre, reponseDeBob)).toBe(autre);
    expect(reduire(autre, refusDeBob)).toBe(autre);
    expect(autre.fiche).toEqual({ statut: 'chargement', pseudo: 'Alice' });
  });

  it('ne reprend pas une fiche deja lue a l arrivee d une seconde reponse', () => {
    const lue = apres([
      ...FICHE_DE_BOB_DEMANDEE,
      { type: 'ficheRecue', pseudo: 'Bob', fiche: ficheDEssai('Bob') },
    ]);

    expect(reduire(lue, { type: 'ficheRefusee', pseudo: 'Bob', motif: 'Tard.' })).toBe(lue);
  });

  it('se ferme, et une seconde fermeture ne change rien', () => {
    const fermee = apres([...FICHE_DE_BOB_DEMANDEE, { type: 'ficheFermee' }]);

    expect(fermee.fiche).toEqual(FICHE_FERMEE);
    expect(reduire(fermee, { type: 'ficheFermee' })).toBe(fermee);
  });

  it('se ferme quand l ecran change: la partie qui se lance, la fin, la sortie', () => {
    expect(apres([...FICHE_DE_BOB_DEMANDEE, { type: 'partieLancee' }]).fiche).toEqual(FICHE_FERMEE);
    expect(apres([...FICHE_DE_BOB_DEMANDEE, { type: 'sortie' }]).fiche).toEqual(FICHE_FERMEE);
  });

  it('survit a ce qui ne change pas l ecran, comme un salon mis a jour', () => {
    const etat = apres([
      ...FICHE_DE_BOB_DEMANDEE,
      { type: 'salon', salon: { ...SALON, joueurs: SALON.joueurs.slice(0, 1) } },
    ]);

    expect(etat.fiche).toEqual({ statut: 'chargement', pseudo: 'Bob' });
  });

  it('se ferme quand la session redevient celle d un invite', () => {
    const etat = apres([
      { type: 'sessionDeCompte', progression: PROGRESSION },
      { type: 'ficheDemandee', pseudo: 'Bob' },
      { type: 'sessionDInvite', expiree: true },
    ]);

    expect(etat.fiche).toEqual(FICHE_FERMEE);
  });
});
