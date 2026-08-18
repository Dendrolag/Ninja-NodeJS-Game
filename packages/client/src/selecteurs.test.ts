/**
 * Tests des selecteurs.
 *
 * Ce sont les questions que l'affichage posera a l'etat: qui suis-je dans cette
 * partie, suis-je l'hote, quels effets sont encore en cours. Elles sont
 * verifiees ici parce que chacune est une deduction, et qu'une deduction fausse
 * se voit a l'ecran sans qu'on sache d'ou elle vient.
 */

import { REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { EtatClient } from './etat.js';
import { ETAT_INITIAL } from './etat.js';
import {
  effetsEnCours,
  jeSuisHote,
  maLigneDeClassement,
  moiDansLaPartie,
  moiDansLeSalon,
  partieEnMouvement,
  resteDeLEffet,
} from './selecteurs.js';

/** Un etat de partie en cours, ou l'on est Alice, hote de la partie. */
function enPartie(modifications: Partial<EtatClient> = {}): EtatClient {
  return {
    ...ETAT_INITIAL,
    ecran: 'jeu',
    connexion: 'connecte',
    moi: 'moi',
    salon: {
      idRoom: 'partie-1',
      statut: 'enCours',
      joueurs: [
        { id: 'moi', pseudo: 'Alice', hote: true },
        { id: 'autre', pseudo: 'Bob', hote: false },
      ],
      reglages: REGLAGES_PAR_DEFAUT,
    },
    partie: {
      tick: 10,
      tempsRestantMs: 90_000,
      enPause: false,
      entites: [
        {
          type: 'joueur',
          id: 'moi',
          x: 100,
          y: 200,
          couleur: '#FF0000',
          direction: 'est',
          pseudo: 'Alice',
          invincible: false,
          protege: false,
        },
        {
          type: 'joueur',
          id: 'autre',
          x: 300,
          y: 400,
          couleur: '#00FF00',
          direction: 'ouest',
          pseudo: 'Bob',
          invincible: false,
          protege: false,
        },
      ],
      objets: [],
      zones: [],
      classement: [
        {
          id: 'autre',
          pseudo: 'Bob',
          couleur: '#00FF00',
          points: 20,
          botsPortes: 20,
          pointsBotsNoirs: 0,
          captures: 0,
          botsNoirsDetruits: 0,
        },
        {
          id: 'moi',
          pseudo: 'Alice',
          couleur: '#FF0000',
          points: 12,
          botsPortes: 12,
          pointsBotsNoirs: 0,
          captures: 0,
          botsNoirsDetruits: 0,
        },
      ],
    },
    ...modifications,
  };
}

describe('qui suis-je', () => {
  it('retrouve notre place dans le salon', () => {
    expect(moiDansLeSalon(enPartie())?.pseudo).toBe('Alice');
  });

  it('dit que nous sommes l hote quand nous le sommes', () => {
    expect(jeSuisHote(enPartie())).toBe(true);
  });

  it('dit que nous ne le sommes pas quand un autre l est', () => {
    const etat = enPartie();
    const sansMoi: EtatClient = { ...etat, moi: 'autre' };

    expect(jeSuisHote(sansMoi)).toBe(false);
  });

  it('ne pretend rien quand on n est dans aucun salon', () => {
    expect(jeSuisHote(ETAT_INITIAL)).toBe(false);
    expect(moiDansLeSalon(ETAT_INITIAL)).toBeUndefined();
  });

  it('retrouve notre entite dans la partie, celle que la camera suit', () => {
    expect(moiDansLaPartie(enPartie())?.x).toBe(100);
  });

  it('ne retrouve aucune entite tant que le lien n est pas etabli', () => {
    const etat = enPartie();

    expect(moiDansLaPartie({ ...etat, moi: undefined })).toBeUndefined();
  });

  it('retrouve notre ligne de classement pendant la partie', () => {
    expect(maLigneDeClassement(enPartie())?.points).toBe(12);
  });

  it('prefere le classement definitif quand la partie est finie', () => {
    const etat = enPartie({
      ecran: 'fin',
      fin: {
        classement: [
          {
            id: 'moi',
            pseudo: 'Alice',
            couleur: '#FF0000',
            points: 42,
            botsPortes: 40,
            pointsBotsNoirs: 2,
            captures: 3,
            botsNoirsDetruits: 1,
          },
        ],
      },
    });

    expect(maLigneDeClassement(etat)?.points).toBe(42);
  });
});

describe('les effets en cours', () => {
  const etat = enPartie({
    effets: [
      { categorie: 'bonus', nature: 'vitesse', finPrevueA: 5000 },
      { categorie: 'malus', nature: 'flou', finPrevueA: 12_000 },
    ],
  });

  it('rend ceux qui n ont pas encore expire', () => {
    expect(effetsEnCours(etat, 4000)).toHaveLength(2);
    expect(effetsEnCours(etat, 6000).map((effet) => effet.nature)).toEqual(['flou']);
    expect(effetsEnCours(etat, 20_000)).toHaveLength(0);
  });

  it('dit ce qu il reste d un effet, et jamais moins que rien', () => {
    const effet = { categorie: 'bonus' as const, nature: 'vitesse' as const, finPrevueA: 5000 };

    expect(resteDeLEffet(effet, 1000)).toBe(4000);
    expect(resteDeLEffet(effet, 9000)).toBe(0);
  });
});

describe('la partie bouge-t-elle', () => {
  it('dit oui quand on joue et que rien ne suspend', () => {
    expect(partieEnMouvement(enPartie())).toBe(true);
  });

  it('dit non pendant une pause', () => {
    const etat = enPartie();
    const partie = etat.partie;

    if (partie === undefined) {
      throw new Error("L'etat de reference porte forcement une partie.");
    }

    const suspendue: EtatClient = { ...etat, partie: { ...partie, enPause: true } };

    expect(partieEnMouvement(suspendue)).toBe(false);
  });

  it('dit non hors de l ecran de jeu', () => {
    expect(partieEnMouvement(enPartie({ ecran: 'fin' }))).toBe(false);
    expect(partieEnMouvement(ETAT_INITIAL)).toBe(false);
  });
});
