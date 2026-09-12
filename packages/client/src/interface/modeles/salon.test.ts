/**
 * Tests du modele du salon.
 *
 * Le test exige par la fiche 4.3 pour le salon porte sur l'affichage des joueurs
 * et sur le lancement reserve a l'hote. Il est ecrit deux fois: ici sur le calcul,
 * et dans ecrans/salon.test.ts sur la page reellement construite.
 */

import type { InfosSalon, JoueurDuSalon } from '@neon-ninja/shared';
import { REGLAGES_PAR_DEFAUT, completerReglages } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { EtatClient } from '../../etat.js';
import { ETAT_INITIAL } from '../../etat.js';
import { initiales, modeleSalon } from './salon.js';

/** Les membres du salon, avec l'hote designe. */
function joueurs(hote: string): readonly JoueurDuSalon[] {
  return [
    { id: 'moi', pseudo: 'Alice', hote: hote === 'moi' },
    { id: 'bob', pseudo: 'Bob', hote: hote === 'bob' },
  ];
}

/** Un salon dont l'hote est designe. */
function salon(hote: string, modifications: Partial<InfosSalon> = {}): InfosSalon {
  return {
    idRoom: 'room-1',
    statut: 'salon',
    mode: 'classique',
    visibilite: 'publique',
    capacite: 12,
    joueurs: joueurs(hote),
    reglages: REGLAGES_PAR_DEFAUT,
    ...modifications,
  };
}

/** Un client dans ce salon. */
function etat(infos: InfosSalon, modifications: Partial<EtatClient> = {}): EtatClient {
  return {
    ...ETAT_INITIAL,
    ecran: 'salon',
    connexion: 'connecte',
    moi: 'moi',
    salon: infos,
    ...modifications,
  };
}

describe('modeleSalon', () => {
  it('ne rend rien hors d un salon', () => {
    expect(modeleSalon(ETAT_INITIAL)).toBeUndefined();
  });

  it('rappelle comment on capture dans le mode de la partie', () => {
    const classique = modeleSalon(etat(salon('bob')));
    const tactique = modeleSalon(etat({ ...salon('bob'), mode: 'tactique' }));

    expect(classique?.regle).toContain('en touchant');
    expect(tactique?.regle).toContain('cône');
  });

  it('nomme le salon d apres son hote et marque l hote et nous-memes', () => {
    const modele = modeleSalon(etat(salon('bob')));

    expect(modele?.titre).toBe('Salon de Bob');
    expect(modele?.effectif).toBe('2 joueurs');
    expect(modele?.joueurs).toEqual([
      { id: 'moi', pseudo: 'Alice', initiales: 'AL', hote: false, moi: true },
      { id: 'bob', pseudo: 'Bob', initiales: 'BO', hote: true, moi: false },
    ]);
  });

  it('montre le niveau d un compte, et aucun pour un invite', () => {
    const infos = salon('bob', {
      joueurs: [
        { id: 'moi', pseudo: 'Alice', hote: false, compte: { niveau: 7 } },
        { id: 'bob', pseudo: 'Bob', hote: true },
      ],
    });

    expect(
      modeleSalon(etat(infos))?.joueurs.map((joueur) => [joueur.pseudo, joueur.niveau]),
    ).toEqual([
      ['Alice', 7],
      ['Bob', undefined],
    ]);
  });

  it('reserve le lancement a l hote', () => {
    expect(modeleSalon(etat(salon('moi')))?.peutLancer).toBe(true);
    expect(modeleSalon(etat(salon('bob')))?.peutLancer).toBe(false);
  });

  it('ne propose plus le lancement pendant le compte a rebours', () => {
    const modele = modeleSalon(
      etat(salon('moi'), { compteARebours: { secondesRestantes: 4, annulable: true } }),
    );

    expect(modele?.peutLancer).toBe(false);
    expect(modele?.compteARebours).toEqual({ secondes: 4, peutAnnuler: true });
  });

  it('reserve l annulation a l hote, tant qu il est encore temps', () => {
    const tardif = { secondesRestantes: 2, annulable: false };
    const tot = { secondesRestantes: 4, annulable: true };

    expect(modeleSalon(etat(salon('bob'), { compteARebours: tot }))?.compteARebours).toEqual({
      secondes: 4,
      peutAnnuler: false,
    });
    expect(
      modeleSalon(etat(salon('moi'), { compteARebours: tardif }))?.compteARebours?.peutAnnuler,
    ).toBe(false);
  });

  it('recapitule les reglages par defaut pour tout le monde', () => {
    const lignes = modeleSalon(etat(salon('bob')))?.recapitulatif;

    expect(
      Object.fromEntries((lignes ?? []).map((ligne) => [ligne.libelle, ligne.valeur])),
    ).toEqual({
      Carte: 'Rainy Tokyo',
      Durée: '3:00',
      'Faux ninjas': '50',
      'Black Ninjas': '2, à 50 % de la partie',
      Bonus: '3/3',
      Malus: '3/3',
      'Zones spéciales': '4/4',
    });
  });

  it('dit ce qui est desactive, et la carte en miroir', () => {
    const reglages = completerReglages({
      carte: 'map3',
      modeMiroir: true,
      malus: { actifs: false },
      botsNoirs: { actifs: false },
    });
    const lignes = modeleSalon(etat(salon('bob', { reglages })))?.recapitulatif ?? [];
    const valeur = (libelle: string): string | undefined =>
      lignes.find((ligne) => ligne.libelle === libelle)?.valeur;

    expect(valeur('Carte')).toBe('Spirit & Time · Miroir');
    expect(valeur('Malus')).toBe('Désactivés');
    expect(valeur('Black Ninjas')).toBe('Désactivés');
  });

  it('dit la visibilite et les places libres d une partie publique, sans code', () => {
    const modele = modeleSalon(etat(salon('bob')));

    expect(modele?.visibilite).toBe('Partie publique');
    expect(modele?.privee).toBe(false);
    expect(modele?.code).toBeUndefined();
    expect(modele?.placesLibres).toBe('10 places libres');
  });

  it('donne le code d une partie privee, a partager', () => {
    const modele = modeleSalon(etat(salon('bob', { visibilite: 'privee', code: 'NX7K2P' })));

    expect(modele?.visibilite).toBe('Partie privée');
    expect(modele?.privee).toBe(true);
    expect(modele?.code).toBe('NX7K2P');
  });

  it('dit la derniere place libre, puis que la partie est complete', () => {
    expect(modeleSalon(etat(salon('bob', { capacite: 3 })))?.placesLibres).toBe('1 place libre');
    expect(modeleSalon(etat(salon('bob', { capacite: 2 })))?.placesLibres).toBe('Partie complète');
  });

  it('distingue nos messages de ceux des autres', () => {
    const modele = modeleSalon(
      etat(salon('bob'), {
        messages: [
          { auteur: 'bob', pseudo: 'Bob', texte: 'on lance ?', recuA: 10 },
          { auteur: 'moi', pseudo: 'Alice', texte: 'go', recuA: 20 },
        ],
      }),
    );

    expect(modele?.messages.map((message) => [message.texte, message.moi])).toEqual([
      ['on lance ?', false],
      ['go', true],
    ]);
  });
});

describe('initiales', () => {
  it('prend une lettre par mot, une majuscule interieure comptant comme un mot', () => {
    expect(initiales('ShadowFox')).toBe('SF');
    expect(initiales('neo blade')).toBe('NB');
    expect(initiales('Sora.exe')).toBe('SE');
  });

  it('prend les deux premieres lettres d un mot seul, accents compris', () => {
    expect(initiales('Vyper')).toBe('VY');
    expect(initiales('éloïse')).toBe('ÉL');
    expect(initiales('x')).toBe('X');
  });
});
