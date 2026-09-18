/**
 * Tests du combo de la Horde, le mode d'identifiant `classique` (etape 7.5): le ralliement
 * qui fait avancer le combo, la prime, la fenetre, la reserve perdue a la capture et face a
 * un Black Ninja, le score, et le jeu de regles dans le moteur.
 *
 * Aucune version du jeu d'origine n'avait de combo: les attentes sont les decisions du
 * porteur du projet du 18 septembre 2026 (docs/plan/etape-7-5.md).
 */

import type { Couleur, Position, ReglagesPartiels } from '@neon-ninja/shared';
import { COMBO } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { detecterContacts, regleClassique, regleHorde, resoudreContacts } from './contacts.js';
import type {
  EtatPartie,
  EvenementPartie,
  IdentifiantEntite,
  Joueur,
  RallieurEnHorde,
} from './etat.js';
import { ajouterBot, ajouterJoueur, creerEtatInitial, retirerJoueur } from './etat.js';
import {
  RALLIEUR_DE_DEPART,
  agirEnHorde,
  lancerLaHorde,
  primeEnHorde,
  rallieurDe,
} from './horde.js';
import { REGLES_DES_MODES, lancerLaPartie, tick } from './moteur.js';
import { calculerScores } from './score.js';

/** Reglages ou rien n'apparait tout seul: les tests posent ce dont ils ont besoin. */
const AUCUNE_APPARITION: ReglagesPartiels = {
  bonus: {
    types: {
      vitesse: { tauxApparitionPourCent: 0 },
      invincibilite: { tauxApparitionPourCent: 0 },
      revelation: { tauxApparitionPourCent: 0 },
    },
  },
  malus: { tauxApparitionPourCent: 0 },
  zones: { actives: false },
  botsNoirs: { actifs: false },
};

const ROUGE: Couleur = '#FF0000';
const BLEU: Couleur = '#0000FF';

/** Ou se tient Alice. */
const ICI: Position = { x: 500, y: 500 };

/** Une partie Horde vide, pas encore lancee. */
function partie(mode: EtatPartie['mode'] = 'classique'): EtatPartie {
  return creerEtatInitial({ graine: 31, mode, reglages: AUCUNE_APPARITION });
}

/** Lit un joueur dont on sait qu'il est present. */
function joueurDe(etat: EtatPartie, id: IdentifiantEntite): Joueur {
  const joueur = etat.joueurs[id];
  if (joueur === undefined) {
    throw new Error(`Le joueur ${id} devrait etre dans la partie.`);
  }
  return joueur;
}

/** Fait entrer un joueur d'une couleur donnee, sorti de sa protection d'apparition. */
function avecJoueur(
  etat: EtatPartie,
  id: IdentifiantEntite,
  couleur: Couleur,
  position: Position,
): EtatPartie {
  const entre = ajouterJoueur(etat, { id, pseudo: id, couleur, position });
  return {
    ...entre,
    joueurs: { ...entre.joueurs, [id]: { ...joueurDe(entre, id), protectionSpawnRestanteMs: 0 } },
  };
}

/** Pose des bots nommes b0, b1... sous Alice, de la couleur donnee (neutres sinon). */
function avecBots(etat: EtatPartie, nombre: number, couleur?: Couleur): EtatPartie {
  let courant = etat;
  for (let rang = 0; rang < nombre; rang += 1) {
    courant = ajouterBot(courant, {
      id: `b${String(rang)}`,
      position: { x: ICI.x + rang * 0.01, y: ICI.y },
      ...(couleur === undefined ? {} : { couleur }),
    });
  }
  return courant;
}

/** Change ce que la Horde retient d'un joueur. */
function rallier(
  etat: EtatPartie,
  id: IdentifiantEntite,
  champs: Partial<RallieurEnHorde>,
): EtatPartie {
  const horde = etat.horde ?? { rallieurs: {} };
  return {
    ...etat,
    horde: { rallieurs: { ...horde.rallieurs, [id]: { ...rallieurDe(etat, id), ...champs } } },
  };
}

/** Une Horde lancee, avec Alice en rouge sur des bots neutres. */
function hordeAvec(nombreDeBots: number): EtatPartie {
  return lancerLaHorde(avecBots(avecJoueur(partie(), 'alice', ROUGE, ICI), nombreDeBots));
}

/** Resout les contacts de la Horde. */
function toucher(etat: EtatPartie): EtatPartie {
  return resoudreContacts(etat, detecterContacts(etat), regleHorde);
}

/** Les evenements d'un type donne. */
function faits<T extends EvenementPartie['type']>(
  etat: EtatPartie,
  type: T,
): Extract<EvenementPartie, { type: T }>[] {
  return etat.evenements.filter(
    (evenement): evenement is Extract<EvenementPartie, { type: T }> => evenement.type === type,
  );
}

/** La prime que rapportent n ralliements d'un combo parti de zero. */
function primeDe(ralliements: number): number {
  return primeEnHorde(toucher(hordeAvec(ralliements)), joueurDe(hordeAvec(0), 'alice'));
}

describe('lancerLaHorde', () => {
  it('donne a chaque joueur present un combo vide et une reserve vide', () => {
    const lancee = lancerLaHorde(
      avecJoueur(avecJoueur(partie(), 'alice', ROUGE, ICI), 'bob', BLEU, { x: 900, y: 900 }),
    );

    expect(lancee.horde?.rallieurs).toEqual({ alice: RALLIEUR_DE_DEPART, bob: RALLIEUR_DE_DEPART });
    expect(RALLIEUR_DE_DEPART).toEqual({ combo: 0, avantFinDuComboMs: 0, prime: 0 });
  });

  it('est le lancement du mode classique, et d aucun autre', () => {
    const avecAlice = (mode: EtatPartie['mode']): EtatPartie =>
      avecJoueur(partie(mode), 'alice', ROUGE, ICI);

    expect(lancerLaPartie(avecAlice('classique')).horde).toBeDefined();
    expect(lancerLaPartie(avecAlice('tactique')).horde).toBeUndefined();
    expect(lancerLaPartie(avecAlice('equipes')).horde).toBeUndefined();
    expect(REGLES_DES_MODES.classique.resoudreContacts).toBe(regleHorde);
  });

  it('laisse a l etat de depart un joueur entre en cours de partie', () => {
    const entre = avecJoueur(hordeAvec(0), 'bob', BLEU, { x: 900, y: 900 });

    expect(rallieurDe(entre, 'bob')).toEqual(RALLIEUR_DE_DEPART);
  });
});

describe('le ralliement', () => {
  it('fait avancer le combo d un joueur qui touche un faux ninja neutre', () => {
    const apres = toucher(hordeAvec(1));

    expect(apres.bots.b0?.couleur).toBe(ROUGE);
    expect(rallieurDe(apres, 'alice')).toEqual({
      combo: 1,
      avantFinDuComboMs: COMBO.FENETRE_MS,
      prime: 0,
    });
    expect(faits(apres, 'ralliement')).toEqual([
      {
        type: 'ralliement',
        joueur: 'alice',
        bot: 'b0',
        position: ICI,
        combo: 1,
        multiplicateur: 1,
      },
    ]);
  });

  it('compte un faux ninja pris a un autre joueur', () => {
    const lancee = lancerLaHorde(
      avecBots(
        avecJoueur(avecJoueur(partie(), 'alice', ROUGE, ICI), 'bob', BLEU, { x: 900, y: 900 }),
        1,
        BLEU,
      ),
    );

    const apres = toucher(lancee);

    expect(apres.bots.b0?.couleur).toBe(ROUGE);
    expect(rallieurDe(apres, 'alice').combo).toBe(1);
  });

  it('ne compte pas un faux ninja deja a notre couleur', () => {
    const lancee = lancerLaHorde(avecBots(avecJoueur(partie(), 'alice', ROUGE, ICI), 1, ROUGE));

    const apres = toucher(lancee);

    expect(rallieurDe(apres, 'alice')).toEqual(RALLIEUR_DE_DEPART);
    expect(faits(apres, 'ralliement')).toEqual([]);
  });

  it('ne compte pas la contagion entre faux ninjas', () => {
    // Un ninja rouge, loin d'Alice, touche un ninja neutre: il le repeint, sans combo.
    const loin: Position = { x: 1200, y: 900 };
    let etat = avecJoueur(partie(), 'alice', ROUGE, ICI);
    etat = ajouterBot(etat, { id: 'rouge', position: loin, couleur: ROUGE });
    etat = ajouterBot(etat, { id: 'neutre', position: { x: loin.x + 5, y: loin.y } });

    const apres = toucher(lancerLaHorde(etat));

    expect(apres.bots.neutre?.couleur).toBe(ROUGE);
    expect(rallieurDe(apres, 'alice')).toEqual(RALLIEUR_DE_DEPART);
    expect(faits(apres, 'ralliement')).toEqual([]);
  });

  it('ne fait rien d une Horde au salon, qui joue comme le Classique d avant', () => {
    const auSalon = avecBots(avecJoueur(partie(), 'alice', ROUGE, ICI), 3);

    const apres = toucher(auSalon);

    expect(apres.horde).toBeUndefined();
    expect(faits(apres, 'ralliement')).toEqual([]);
    expect(apres).toEqual(resoudreContacts(auSalon, detecterContacts(auSalon), regleClassique));
  });
});

describe('la prime de combo', () => {
  it('ne rapporte rien avant le premier palier', () => {
    expect(primeDe(4)).toBe(0);
  });

  it('ajoute le multiplicateur moins un a chaque ralliement, x2 a la cinquieme', () => {
    // Du cinquieme au neuvieme: x2, un de prime chacun. Le dixieme: x3, deux de prime.
    expect(primeDe(5)).toBe(1);
    expect(primeDe(9)).toBe(5);
    expect(primeDe(10)).toBe(7);
  });

  it('plafonne le multiplicateur a x5', () => {
    const apres = toucher(rallier(hordeAvec(2), 'alice', { combo: 40, avantFinDuComboMs: 100 }));

    expect(faits(apres, 'ralliement').map((fait) => fait.multiplicateur)).toEqual([5, 5]);
    expect(rallieurDe(apres, 'alice').prime).toBe(8);
  });

  it('s ajoute au score, avec les faux ninjas portes et les Black Ninjas', () => {
    const apres = toucher(hordeAvec(10));
    const alice = joueurDe(apres, 'alice');
    const ligne = calculerScores({
      ...apres,
      joueurs: { alice: { ...alice, botsNoirsDetruits: 1 } },
    })[0];

    expect(ligne?.points).toBe(10 + 15 + 7);
  });

  it('ne s ajoute pas au score des autres modes', () => {
    const tactique = {
      ...toucher(hordeAvec(10)),
      mode: 'tactique' as const,
    };

    expect(calculerScores(tactique)[0]?.points).toBe(10);
  });
});

describe('la fenetre du combo', () => {
  it('prolonge le combo d une capture a deux secondes pile', () => {
    const lance = toucher(hordeAvec(1));
    const tard = agirEnHorde(lance, {}, COMBO.FENETRE_MS);

    expect(rallieurDe(tard, 'alice')).toEqual({ combo: 1, avantFinDuComboMs: 0, prime: 0 });
  });

  it('fait retomber le combo une fois la fenetre depassee, sans toucher a la reserve', () => {
    const lance = rallier(hordeAvec(0), 'alice', {
      combo: 7,
      avantFinDuComboMs: COMBO.FENETRE_MS,
      prime: 3,
    });

    const tombe = agirEnHorde(lance, {}, COMBO.FENETRE_MS + 1);

    expect(rallieurDe(tombe, 'alice')).toEqual({ combo: 0, avantFinDuComboMs: 0, prime: 3 });
  });

  it('oublie un joueur parti', () => {
    const parti = retirerJoueur(toucher(hordeAvec(1)), 'alice');

    expect(agirEnHorde(parti, {}, 50).horde?.rallieurs).toEqual({});
  });

  it('ne fait rien d une Horde au salon', () => {
    const auSalon = avecJoueur(partie(), 'alice', ROUGE, ICI);

    expect(agirEnHorde(auSalon, {}, 50)).toBe(auSalon);
  });
});

describe('la reserve perdue', () => {
  it('se vide avec le combo quand on se fait capturer, sans aller au capteur', () => {
    let etat = avecJoueur(partie(), 'alice', ROUGE, ICI);
    etat = avecJoueur(etat, 'bob', BLEU, { x: ICI.x + 5, y: ICI.y });
    etat = lancerLaHorde(etat);
    etat = rallier(etat, 'alice', { combo: 6, avantFinDuComboMs: 1000, prime: 9 });
    etat = rallier(etat, 'bob', { combo: 2, avantFinDuComboMs: 1000, prime: 4 });

    const apres = toucher(etat);
    const capture = faits(apres, 'captureJoueur')[0];
    const victime = capture?.victime === 'alice' ? 'alice' : 'bob';
    const capteur = victime === 'alice' ? 'bob' : 'alice';

    expect(capture).toBeDefined();
    expect(rallieurDe(apres, victime)).toEqual(RALLIEUR_DE_DEPART);
    expect(rallieurDe(apres, capteur)).toEqual(rallieurDe(etat, capteur));
  });

  it('perd la part reglee face a un Black Ninja, arrondie en dessous, et le combo', () => {
    const lance = rallier(hordeAvec(0), 'alice', { combo: 6, avantFinDuComboMs: 1000, prime: 9 });
    const pris: EtatPartie = {
      ...lance,
      evenements: [
        {
          type: 'captureParBotNoir',
          botNoir: 'noir',
          victime: 'alice',
          botsPerdus: 0,
          position: ICI,
        },
      ],
    };

    const apres = agirEnHorde(pris, {}, 50);

    expect(rallieurDe(apres, 'alice')).toEqual({ combo: 0, avantFinDuComboMs: 0, prime: 5 });
  });

  it('ne bouge pas quand un joueur invincible detruit un Black Ninja', () => {
    let etat = avecJoueur(partie(), 'alice', ROUGE, ICI);
    etat = ajouterBot(etat, { id: 'noir', type: 'botNoir', position: ICI });
    etat = lancerLaHorde(etat);
    etat = {
      ...etat,
      joueurs: {
        alice: {
          ...joueurDe(etat, 'alice'),
          bonusRestantsMs: { ...joueurDe(etat, 'alice').bonusRestantsMs, invincibilite: 5000 },
        },
      },
    };
    etat = rallier(etat, 'alice', { combo: 3, avantFinDuComboMs: 1000, prime: 2 });

    const apres = toucher(etat);

    expect(faits(apres, 'botNoirDetruit')).toHaveLength(1);
    expect(rallieurDe(apres, 'alice')).toEqual(rallieurDe(etat, 'alice'));
  });
});

describe('la Horde dans le moteur', () => {
  it('rallie en jouant, et reste reproductible', () => {
    const lancee = hordeAvec(6);
    const entrees = { alice: { deplacement: { x: 1, y: 0 }, enMouvement: true } };

    const premier = tick(lancee, entrees, 50);
    const second = tick(lancee, entrees, 50);

    expect(faits(premier, 'ralliement')).toHaveLength(6);
    expect(rallieurDe(premier, 'alice').prime).toBe(2);
    expect(second).toEqual(premier);
  });
});
