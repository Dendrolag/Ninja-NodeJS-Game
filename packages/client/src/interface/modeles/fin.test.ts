/**
 * Tests du modele de l'ecran de fin.
 *
 * Le test exige par la fiche 4.3: les donnees affichees correspondent au
 * recapitulatif recu. Ce recapitulatif est le classement definitif de
 * partieTerminee, et, pour un compte, la progression de progressionDeFin (etape
 * 3.3, affichee depuis la reprise des ecrans du jalon 3). Le meme test est rejoue
 * sur la page construite dans ecrans/fin.test.ts et ecrans/fin.progression.test.ts.
 */

import type {
  LigneClassement,
  MaProgression,
  Mode,
  ProgressionEnregistree,
  ReglagesPartie,
  StatistiquesDUnJoueur,
} from '@neon-ninja/shared';
import { REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { EtatClient } from '../../etat.js';
import { ETAT_INITIAL } from '../../etat.js';
import { SANS_OBJET, ecrireUneStatistique, modeleFin } from './fin.js';
import { formaterNombre } from './progression.js';

/** Une ligne de classement. */
function ligne(id: string, pseudo: string, points: number): LigneClassement {
  return {
    id,
    pseudo,
    couleur: '#FF0000',
    points,
    botsPortes: points,
    pointsBotsNoirs: 0,
    captures: 1,
    botsNoirsDetruits: 0,
  };
}

const CLASSEMENT: readonly LigneClassement[] = [
  ligne('alice', 'Alice', 30),
  ligne('moi', 'Moi', 20),
  ligne('carol', 'Carol', 10),
  ligne('dan', 'Dan', 5),
];

/** Un client dont la partie vient de finir sur ce classement. */
function etat(classement: readonly LigneClassement[], moi = 'moi'): EtatClient {
  return {
    ...ETAT_INITIAL,
    ecran: 'fin',
    moi,
    salon: {
      idRoom: 'room-1',
      statut: 'terminee',
      mode: 'classique',
      visibilite: 'publique',
      capacite: 12,
      joueurs: [],
      reglages: REGLAGES_PAR_DEFAUT,
    },
    fin: { classement },
  };
}

describe('modeleFin', () => {
  it('ne rend rien tant que la partie n est pas finie', () => {
    expect(modeleFin(ETAT_INITIAL)).toBeUndefined();
  });

  it('reprend le classement recu, dans son ordre et avec ses nombres', () => {
    const modele = modeleFin(etat(CLASSEMENT));

    expect(modele?.lignes.map(({ rang, pseudo, points }) => ({ rang, pseudo, points }))).toEqual(
      CLASSEMENT.map((recue, index) => ({
        rang: index + 1,
        pseudo: recue.pseudo,
        points: recue.points,
      })),
    );
  });

  it('donne notre place et le mot qui va avec', () => {
    const modele = modeleFin(etat(CLASSEMENT));

    expect(modele?.place).toEqual({ nombre: 2, suffixe: 'e' });
    expect(modele?.message).toBe('Bien joué !');
  });

  it('ecrit la premiere place avec son suffixe', () => {
    const modele = modeleFin(etat(CLASSEMENT, 'alice'));

    expect(modele?.place).toEqual({ nombre: 1, suffixe: 're' });
    expect(modele?.message).toBe('Victoire !');
  });

  it('range le podium comme un vrai podium: deuxieme, premier, troisieme', () => {
    expect(modeleFin(etat(CLASSEMENT))?.podium.map((marche) => marche.pseudo)).toEqual([
      'Moi',
      'Alice',
      'Carol',
    ]);
  });

  it('se contente de deux marches a deux joueurs', () => {
    expect(modeleFin(etat(CLASSEMENT.slice(0, 2)))?.podium.map((marche) => marche.pseudo)).toEqual([
      'Moi',
      'Alice',
    ]);
  });

  it('dit le mode et la carte de la partie', () => {
    expect(modeleFin(etat(CLASSEMENT))?.contexte).toBe('Partie terminée · Horde · Tokyo');
  });

  it('ne donne aucune place a qui ne figure pas au classement', () => {
    const modele = modeleFin(etat(CLASSEMENT, 'spectateur'));

    expect(modele?.place).toBeUndefined();
    expect(modele?.message).toBe('Partie terminée');
  });
});

describe('rejouer (etape 2.6)', () => {
  it('n est actif qu avec un lien etabli', () => {
    expect(modeleFin({ ...etat(CLASSEMENT), connexion: 'connecte' })?.peutRejouer).toBe(true);
    expect(modeleFin({ ...etat(CLASSEMENT), connexion: 'retablissement' })?.peutRejouer).toBe(
      false,
    );
    expect(modeleFin({ ...etat(CLASSEMENT), connexion: 'perdue' })?.peutRejouer).toBe(false);
  });
});

describe('la progression de fin', () => {
  const COMPTE: MaProgression = {
    pseudo: 'Moi',
    niveau: 1,
    xpTotale: 90,
    pieces: 1200,
    pointsLigue: 90,
    inscritLe: '2026-09-11T10:00:00.000Z',
  };

  /** Le recapitulatif d'une partie qui fait passer du niveau 1 au 2 et de Bronze a Argent. */
  const ENREGISTREE: ProgressionEnregistree = {
    enregistree: true,
    placement: 2,
    nombreJoueurs: 4,
    xpGagnee: 150,
    piecesGagnees: 1500,
    variationPointsLigue: 10,
    avant: { xpTotale: 90, niveau: 1, pieces: 1200, pointsLigue: 90, palier: 'bronze' },
    apres: { xpTotale: 240, niveau: 2, pieces: 2700, pointsLigue: 100, palier: 'argent' },
    succes: {
      debloques: ['premier-pas', 'sur-le-podium'],
      plusProche: { id: 'habitue', actuel: 1, seuil: 25 },
    },
    defis: { releves: [], defis: [] },
  };

  /** Un compte dont la partie vient de finir, avec ou sans recapitulatif. */
  function etatDuCompte(modifications: Partial<EtatClient> = {}): EtatClient {
    return {
      ...etat(CLASSEMENT),
      session: { nature: 'compte', progression: COMPTE },
      ...modifications,
    };
  }

  it('n existe pas pour un invite, qui n a que le classement', () => {
    expect(modeleFin(etat(CLASSEMENT))?.progression).toBeUndefined();
  });

  it('dit qu elle s enregistre tant que le recapitulatif n est pas arrive', () => {
    expect(modeleFin(etatDuCompte())?.progression).toEqual({ nature: 'attente' });
  });

  it('reprend exactement le recapitulatif recu', () => {
    const progression = modeleFin(etatDuCompte({ progressionDeFin: ENREGISTREE }))?.progression;

    // 240 XP: le niveau 2 commence a 100 et coute 200.
    expect(progression).toEqual({
      nature: 'enregistree',
      xp: '+150 XP',
      barre: { niveau: 2, pourCent: 70, xp: '140 / 200 XP' },
      passageDeNiveau: 'Niveau 2 atteint !',
      pieces: `+${formaterNombre(1500)}`,
      variationLigue: '+10',
      sensDeLaLigue: 'hausse',
      palier: 'Argent · 100 points',
      changementDePalier: 'Bronze → Argent',
      // Etape 3.7: les succes que la partie a donnes, dans l'ordre recu, et le plus proche.
      succes: [
        {
          id: 'premier-pas',
          nom: 'Premier pas',
          description: 'Jouer une partie. Voilà, c’est fait.',
          palier: 'decouverte',
          nomDuPalier: 'Découverte',
        },
        {
          id: 'sur-le-podium',
          nom: 'Sur le podium',
          description:
            'Finir dans les trois premiers d’une partie d’au moins quatre joueurs, ou la gagner en Équipes.',
          palier: 'decouverte',
          nomDuPalier: 'Découverte',
        },
      ],
      plusProche: 'Plus que 24 parties pour Habitué',
      defisReleves: [],
      defis: [],
      avisDesDefis: undefined,
    });
  });

  it('dit qu une partie de moins de trois minutes ne fait pas avancer les defis (etape 3.10)', () => {
    const base = etatDuCompte({ progressionDeFin: ENREGISTREE });
    const courte = modeleFin({
      ...base,
      salon: base.salon && {
        ...base.salon,
        reglages: { ...base.salon.reglages, dureePartieS: 30 },
      },
    })?.progression;

    expect(courte).toMatchObject({
      nature: 'enregistree',
      avisDesDefis: 'Une partie de moins de trois minutes ne fait pas avancer les défis.',
    });
  });

  it('annonce les defis que la partie a releves, et ceux de la semaine (etape 3.10)', () => {
    const progression = modeleFin(
      etatDuCompte({
        progressionDeFin: {
          ...ENREGISTREE,
          defis: {
            releves: [{ id: 'trois-cartes', xp: 300 }],
            defis: [
              { id: 'trois-cartes', actuel: 3, seuil: 3, xp: 300, accompli: true },
              { id: 'doubleurs', actuel: 1, seuil: 2, xp: 400, accompli: false },
            ],
          },
        },
      }),
    )?.progression;

    expect(progression).toMatchObject({
      nature: 'enregistree',
      defisReleves: [
        {
          id: 'trois-cartes',
          texte: 'Défi relevé : Jouer sur 3 cartes différentes.',
          xp: '+300 XP',
        },
      ],
      defis: [
        { id: 'trois-cartes', avancee: 'Relevé', pourCent: 100, accompli: true },
        { id: 'doubleurs', avancee: '1 / 2', pourCent: 50, accompli: false },
      ],
    });
  });

  it('ignore un succes que cette page ne connait pas, et se passe du plus proche', () => {
    const progression = modeleFin(
      etatDuCompte({
        progressionDeFin: {
          ...ENREGISTREE,
          succes: { debloques: ['succes-a-venir' as 'habitue'] },
        },
      }),
    )?.progression;

    expect(progression).toMatchObject({ succes: [], plusProche: undefined });
  });

  it('ne parle ni de niveau ni de palier quand ils n ont pas change, et signe une perte', () => {
    const progression = modeleFin(
      etatDuCompte({
        progressionDeFin: {
          ...ENREGISTREE,
          xpGagnee: 0,
          piecesGagnees: 0,
          variationPointsLigue: -10,
          avant: { ...ENREGISTREE.avant, pointsLigue: 90 },
          apres: { ...ENREGISTREE.avant, pointsLigue: 80 },
        },
      }),
    )?.progression;

    expect(progression).toMatchObject({
      nature: 'enregistree',
      xp: '+0 XP',
      passageDeNiveau: undefined,
      variationLigue: '−10',
      sensDeLaLigue: 'baisse',
      palier: 'Bronze · 80 points',
      changementDePalier: undefined,
    });
  });

  it('dit pourquoi une partie n a pas ete enregistree', () => {
    const progression = modeleFin(
      etatDuCompte({
        progressionDeFin: {
          enregistree: false,
          motif: "Cette partie n'a pas pu être enregistrée.",
        },
      }),
    )?.progression;

    expect(progression).toEqual({
      nature: 'nonEnregistree',
      motif: "Cette partie n'a pas pu être enregistrée.",
    });
  });
});

describe('les statistiques du classement final, selon le mode (9 octobre 2026)', () => {
  /** La partie finie dans ce mode, avec ces reglages et ces statistiques. */
  function finie(
    mode: Mode,
    statistiques: Readonly<Record<string, StatistiquesDUnJoueur>> | undefined,
    reglages: ReglagesPartie = REGLAGES_PAR_DEFAUT,
  ): EtatClient {
    const base = etat([ligne('alice', 'Alice', 60), ligne('moi', 'Moi', 20)]);

    return {
      ...base,
      salon: base.salon === undefined ? undefined : { ...base.salon, mode, reglages },
      fin: {
        classement: base.fin?.classement ?? [],
        ...(statistiques === undefined ? {} : { statistiques }),
      },
    };
  }

  it('montre en Horde les ninjas, les captures, les ralliés, le combo, les Black Ninjas et l Evade', () => {
    const modele = modeleFin(
      finie('classique', {
        alice: {
          ninjas: 12,
          captures: 3,
          ninjasRallies: 9,
          meilleurCombo: 4,
          botsNoirsDetruits: 1,
          evade: 1,
        },
        moi: { ninjas: 4, captures: 0, ninjasRallies: 2, botsNoirsDetruits: 0, evade: 0 },
      }),
    );

    expect(modele?.colonnes.map((colonne) => colonne.entete)).toEqual([
      'Ninjas',
      'Captures',
      'Ralliés',
      'Combo',
      'Black Ninjas',
      'Évadé',
    ]);
    expect(modele?.lignes.map((une) => une.statistiques)).toEqual([
      ['12', '3', '9', 'x4', '1', 'Oui'],
      ['4', '0', '2', '—', '0', '—'],
    ]);
  });

  it('montre en Massacre les PNJ et les joueurs massacres, les Black Ninjas, le combo et l Evade', () => {
    const modele = modeleFin(
      finie('massacre', {
        alice: { ninjasTues: 40, joueursTues: 2, botsNoirsDetruits: 1, meilleurCombo: 5, evade: 0 },
        moi: { ninjasTues: 7, joueursTues: 0, botsNoirsDetruits: 0, evade: 1 },
      }),
    );

    expect(modele?.colonnes.map((colonne) => [colonne.entete, colonne.description])).toEqual([
      ['PNJ', 'PNJ massacrés'],
      ['Joueurs', 'Joueurs massacrés'],
      ['Black Ninjas', 'Black Ninjas détruits'],
      ['Combo', 'Plus haut combo'],
      ['Évadé', 'A attrapé l’Évadé'],
    ]);
    expect(modele?.lignes.map((une) => une.statistiques)).toEqual([
      ['40', '2', '1', 'x5', '—'],
      ['7', '0', '0', '—', 'Oui'],
    ]);
  });

  it('retire les colonnes des Black Ninjas et de l Evade quand l hote les a coupes', () => {
    const reglages: ReglagesPartie = {
      ...REGLAGES_PAR_DEFAUT,
      evade: false,
      botsNoirs: { ...REGLAGES_PAR_DEFAUT.botsNoirs, actifs: false },
    };
    const modele = modeleFin(finie('tactique', {}, reglages));

    expect(modele?.colonnes.map((colonne) => colonne.id)).toEqual([
      'ninjas',
      'captures',
      'meilleurTir',
    ]);
  });

  it('ne montre plus le x2 de l Evade a cote du pseudo: il n est que dans sa colonne', () => {
    const base = finie('classique', { alice: { evade: 1 } });
    const modele = modeleFin({
      ...base,
      fin: {
        ...(base.fin ?? { classement: [] }),
        classement: [{ ...ligne('alice', 'Alice', 60), doubleur: true }],
      },
    });

    expect(modele?.lignes[0]).not.toHaveProperty('doubleur');
    expect(modele?.podium[0]).not.toHaveProperty('doubleur');
    expect(modele?.lignes[0]?.statistiques.at(-1)).toBe('Oui');
  });

  it('montre des tirets quand le serveur n a pas envoye de statistiques', () => {
    const modele = modeleFin(finie('classique', undefined));

    expect(modele?.lignes[0]?.statistiques).toEqual(['—', '—', '—', '—', '—', '—']);
  });

  it('n invente aucune colonne sans salon: le mode n est pas connu', () => {
    const modele = modeleFin({ ...finie('classique', {}), salon: undefined });

    expect(modele?.colonnes).toEqual([]);
    expect(modele?.lignes[0]?.statistiques).toEqual([]);
  });
});

describe('ecrireUneStatistique', () => {
  it('ecrit chaque format, et un tiret pour ce qui est sans objet', () => {
    expect(ecrireUneStatistique(1234, 'nombre')).toBe(formaterNombre(1234));
    expect(ecrireUneStatistique(0, 'nombre')).toBe('0');
    expect(ecrireUneStatistique(undefined, 'nombre')).toBe(SANS_OBJET);
    expect(ecrireUneStatistique(3, 'multiplicateur')).toBe('x3');
    expect(ecrireUneStatistique(1, 'multiplicateur')).toBe(SANS_OBJET);
    expect(ecrireUneStatistique(125_000, 'duree')).toBe('2:05');
    expect(ecrireUneStatistique(undefined, 'duree')).toBe(SANS_OBJET);
    expect(ecrireUneStatistique(1, 'drapeau')).toBe('Oui');
    expect(ecrireUneStatistique(0, 'drapeau')).toBe(SANS_OBJET);
  });
});

describe('la fiche des joueurs au classement final (etape 3.5)', () => {
  /** La partie finie, vue d'un compte, avec ces membres encore au salon. */
  function etatAvecLeSalon(session: EtatClient['session']): EtatClient {
    const base = etat(CLASSEMENT);

    return {
      ...base,
      session,
      salon: base.salon && {
        ...base.salon,
        joueurs: [
          { id: 'moi', pseudo: 'Moi', hote: true, compte: { niveau: 3 } },
          { id: 'alice', pseudo: 'Alice', hote: false, compte: { niveau: 9 } },
          { id: 'carol', pseudo: 'Carol', hote: false },
        ],
      },
    };
  }

  const COMPTE: EtatClient['session'] = {
    nature: 'compte',
    progression: {
      pseudo: 'Moi',
      niveau: 3,
      xpTotale: 400,
      pieces: 0,
      pointsLigue: 0,
      inscritLe: '2026-09-11T10:00:00.000Z',
    },
  };

  it('ouvre la fiche des comptes encore au salon, pas celle d un invite ni d un joueur parti', () => {
    const lignes = modeleFin(etatAvecLeSalon(COMPTE))?.lignes ?? [];

    expect(lignes.map((une) => [une.id, une.aUneFiche])).toEqual([
      ['alice', true],
      ['moi', true],
      ['carol', false],
      // Dan est parti avant la fin: le classement seul ne dit pas s'il avait un compte.
      ['dan', false],
    ]);
  });

  it('n ouvre aucune fiche a un invite', () => {
    const lignes =
      modeleFin(etatAvecLeSalon({ nature: 'invite', sessionExpiree: false }))?.lignes ?? [];

    expect(lignes.some((une) => une.aUneFiche)).toBe(false);
  });
});
