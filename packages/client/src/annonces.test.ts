/**
 * Tests des annonces.
 *
 * Deux choses a verifier: que chaque fait trouve sa phrase, avec les textes du
 * jeu d'origine, et qu'une meme phrase n'est dite qu'une fois quand on compare
 * deux etats successifs.
 */

import type { InfosSalon } from '@neon-ninja/shared';
import { REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { annonceDuFait, annonceDuRefus, annoncesDuChangement } from './annonces.js';
import type { EtatClient } from './etat.js';
import { ETAT_INITIAL } from './etat.js';
import { fait } from './faits.js';

/** Un salon ou l'hote est celui qu'on designe. */
function salon(hote: string): InfosSalon {
  return {
    idRoom: 'room-1',
    statut: 'salon',
    mode: 'classique',
    visibilite: 'publique',
    capacite: 12,
    joueurs: [
      { id: 'moi', pseudo: 'Alice', hote: hote === 'moi' },
      { id: 'bob', pseudo: 'Bob', hote: hote === 'bob' },
    ],
    reglages: REGLAGES_PAR_DEFAUT,
  };
}

/** Un etat de client identifie, dans un salon. */
function etat(modifications: Partial<EtatClient> = {}): EtatClient {
  return { ...ETAT_INITIAL, moi: 'moi', salon: salon('bob'), ...modifications };
}

describe('annonceDuFait', () => {
  it('reprend le texte du jeu d origine pour une capture subie', () => {
    const annonce = annonceDuFait(
      fait('captureSubie', { parPseudo: 'Bob', nouvelleCouleur: '#00FF00', botsPerdus: 3 }, 0),
    );

    expect(annonce).toEqual({ texte: 'Capturé par Bob !', ton: 'alerte' });
  });

  it('accorde le nombre de ninjas gagnes', () => {
    const un = annonceDuFait(
      fait('captureReussie', { victimePseudo: 'Bob', botsGagnes: 1, capturesTotal: 1 }, 0),
    );
    const quatre = annonceDuFait(
      fait('captureReussie', { victimePseudo: 'Bob', botsGagnes: 4, capturesTotal: 2 }, 0),
    );

    expect(un.texte).toBe('Vous avez capturé Bob : +1 ninja');
    expect(quatre.texte).toBe('Vous avez capturé Bob : +4 ninjas');
  });

  it('nomme celui qui a lance le malus que l on subit', () => {
    const annonce = annonceDuFait(
      fait('malusSubi', { nature: 'flou', dureeMs: 12_000, parPseudo: 'Bob' }, 0),
    );

    expect(annonce).toEqual({ texte: 'Bob vous a volé vos lunettes', ton: 'alerte' });
  });

  it('dit a celui qui ramasse un malus qu il frappe les autres', () => {
    // Comportement a preserver numero 4: un malus frappe les autres. L'annonce
    // doit le dire, sans quoi le joueur croit s'etre penalise lui-meme.
    const annonce = annonceDuFait(fait('malusRamasse', { nature: 'negatif', dureeMs: 14_000 }, 0));

    expect(annonce).toEqual({
      texte: 'Vous avez privé vos adversaires de couleurs',
      ton: 'succes',
    });
  });

  it('nomme le bonus ramasse avec son libelle affiche', () => {
    const annonce = annonceDuFait(
      fait('bonusActive', { nature: 'invincibilite', dureeMs: 10_000 }, 0),
    );

    expect(annonce.texte).toBe('Bonus : Invincibilité');
  });

  it('signale le depart de l hote', () => {
    const annonce = annonceDuFait(fait('joueurParti', { id: 'bob', pseudo: 'Bob', hote: true }, 0));

    expect(annonce.texte).toBe('Bob a quitté la partie (était hôte)');
  });
});

describe('annonceDuRefus', () => {
  it('annonce un refus d action avec ses motifs', () => {
    const annonce = annonceDuRefus({
      action: 'demarrer',
      erreurs: [{ champ: 'hote', motif: "Seul l'hôte de la partie peut faire cela." }],
    });

    expect(annonce).toEqual({ texte: "Seul l'hôte de la partie peut faire cela.", ton: 'alerte' });
  });

  it('laisse les refus d entree et de chat a leur champ', () => {
    const erreurs = [{ champ: 'pseudo', motif: 'Pris.' }];

    expect(annonceDuRefus({ action: 'rejoindre', erreurs })).toBeUndefined();
    expect(annonceDuRefus({ action: 'chat', erreurs })).toBeUndefined();
  });
});

describe('annoncesDuChangement', () => {
  it('annonce chaque fait nouveau, et une seule fois', () => {
    const arrivee = fait('joueurArrive', { id: 'carol', pseudo: 'Carol', hote: false }, 10);
    const avant = etat();
    const apres = etat({ journal: [arrivee] });
    const ensuite = etat({ journal: [arrivee], messages: [] });

    expect(annoncesDuChangement(avant, apres).map((annonce) => annonce.texte)).toEqual([
      'Carol a rejoint la partie',
    ]);
    expect(annoncesDuChangement(apres, ensuite)).toEqual([]);
  });

  it('n annonce rien quand le journal repart a zero au lancement', () => {
    const arrivee = fait('joueurArrive', { id: 'carol', pseudo: 'Carol', hote: false }, 10);

    expect(annoncesDuChangement(etat({ journal: [arrivee] }), etat({ journal: [] }))).toEqual([]);
  });

  it('annonce un refus nouveau, pas celui qui est deja affiche', () => {
    const refus = {
      action: 'reglages' as const,
      erreurs: [{ champ: 'reglages', motif: 'La partie a déjà commencé.' }],
    };

    expect(annoncesDuChangement(etat(), etat({ refus }))).toHaveLength(1);
    expect(annoncesDuChangement(etat({ refus }), etat({ refus }))).toEqual([]);
  });

  it('annonce au joueur qu il devient l hote', () => {
    const annonces = annoncesDuChangement(etat(), etat({ salon: salon('moi') }));

    expect(annonces.map((annonce) => annonce.texte)).toEqual([
      "Vous êtes maintenant l'hôte de la partie",
    ]);
  });

  it('ne l annonce pas a l entree dans un salon que l on vient d ouvrir', () => {
    const avant = etat({ salon: undefined });

    expect(annoncesDuChangement(avant, etat({ salon: salon('moi') }))).toEqual([]);
  });
});
