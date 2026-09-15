// @vitest-environment jsdom
/**
 * Tests de l'ecran de fin, dans un document: le test exige par la fiche 4.3.
 *
 * Les donnees affichees correspondent au recapitulatif recu: le classement
 * definitif de partieTerminee. La progression d'un compte (experience, pieces,
 * points de ligue), envoyee par le serveur depuis l'etape 3.3 dans
 * progressionDeFin, devra etre ajoutee a ce test quand l'ecran l'affichera, a la
 * reprise des ecrans du jalon 3.
 */

import type { InfosSalon, LigneClassement } from '@neon-ninja/shared';
import { REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Client } from '../../client.js';
import { creerClient } from '../../client.js';
import { creerHorlogeClientManuelle } from '../../horloge.js';
import type { ReseauFactice } from '../../reseau.js';
import { creerReseauFactice } from '../../reseau.js';
import { boutonObligatoire, contexteDEssai, obligatoire } from '../essais.js';
import { monterFin } from './fin.js';
import type { EcranAffiche } from './types.js';

/** Une ligne de classement. */
function ligne(
  id: string,
  pseudo: string,
  points: number,
  captures: number,
  botsNoirsDetruits: number,
): LigneClassement {
  return {
    id,
    pseudo,
    couleur: '#00FFFF',
    points,
    botsPortes: points - botsNoirsDetruits * 15,
    pointsBotsNoirs: botsNoirsDetruits * 15,
    captures,
    botsNoirsDetruits,
  };
}

const CLASSEMENT: readonly LigneClassement[] = [
  ligne('carol', 'Carol', 42, 3, 1),
  ligne('moi', 'Alice', 30, 1, 0),
  ligne('bob', '<i>Bob</i>', 18, 0, 0),
  ligne('dan', 'Dan', 4, 0, 0),
];

const SALON: InfosSalon = {
  idRoom: 'room-1',
  statut: 'salon',
  mode: 'classique',
  visibilite: 'publique',
  capacite: 12,
  joueurs: [
    { id: 'moi', pseudo: 'Alice', hote: true },
    { id: 'carol', pseudo: 'Carol', hote: false },
  ],
  reglages: REGLAGES_PAR_DEFAUT,
};

let reseau: ReseauFactice;
let client: Client;
let ecran: EcranAffiche;

beforeEach(() => {
  document.body.replaceChildren();
  reseau = creerReseauFactice();
  client = creerClient({ reseau, horloge: creerHorlogeClientManuelle() });

  reseau.simulerConnexion('moi');
  client.rejoindre('Alice');
  reseau.dernier('rejoindre')?.[1]({ valide: true, valeur: SALON });
  reseau.recevoir('partieLancee');
  reseau.recevoir('partieTerminee', { classement: CLASSEMENT });

  ecran = monterFin(contexteDEssai(client));
  document.body.append(ecran.racine);
  ecran.afficher(client.etat);
});

afterEach(() => {
  ecran.demonter();
  client.fermer();
});

describe('l ecran de fin', () => {
  it('affiche tout le classement recu, dans son ordre et avec ses nombres', () => {
    const rangees = [...document.querySelectorAll('tbody tr')].map((rangee) =>
      [...rangee.querySelectorAll('td')].map((cellule) => cellule.textContent),
    );

    expect(rangees).toEqual(
      CLASSEMENT.map((recue, index) => [
        String(index + 1),
        recue.pseudo,
        String(recue.points),
        String(recue.botsPortes),
        String(recue.captures),
        String(recue.botsNoirsDetruits),
      ]),
    );
  });

  it('dit notre place et marque notre ligne', () => {
    expect(obligatoire(document, '.fin-place').textContent).toBe('2e place');
    expect(obligatoire(document, '.fin-titre .accent').textContent).toBe('Bien joué !');
    expect(obligatoire(document, 'tbody tr.moi').dataset['joueur']).toBe('moi');
  });

  it('dresse le podium dans l ordre d un vrai podium', () => {
    const marches = [...document.querySelectorAll<HTMLElement>('.marche')];

    expect(marches.map((marche) => marche.dataset['rang'])).toEqual(['2', '1', '3']);
    expect(marches.map((marche) => marche.querySelector('.marche-points')?.textContent)).toEqual([
      '30 pts',
      '42 pts',
      '18 pts',
    ]);
  });

  it('pose les pseudos comme du texte, la ou le jeu d origine executait du balisage', () => {
    expect(document.querySelector('.ecran-fin i')).toBeNull();
    expect(obligatoire(document, '[data-joueur="bob"] .joueur').textContent).toBe('<i>Bob</i>');
  });

  it('dit la carte et le mode de la partie', () => {
    expect(obligatoire(document, '.fin-contexte').textContent).toBe(
      'Partie terminée · Classique · Rainy Tokyo',
    );
  });

  it('rejoue sous le pseudo retenu par le serveur, et revient a l accueil sur demande', () => {
    const avant = reseau.emis.length;

    boutonObligatoire(document, 'Rejouer').click();

    expect(reseau.emis.slice(avant).map((message) => message.nom)).toEqual([
      'quitter',
      'rejoindre',
    ]);
    expect(reseau.dernier('rejoindre')?.[0]).toEqual({ pseudo: 'Alice' });
  });
});
