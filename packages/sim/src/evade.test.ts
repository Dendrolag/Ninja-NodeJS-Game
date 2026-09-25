/**
 * Tests de l'Evade et de son x2 (etape 7.9): le tirage du moment, l'apparition, la fuite,
 * le depart, la capture dans chacun des quatre modes, et le x2 porte, cede ou perdu.
 *
 * Aucune version du jeu d'origine n'avait d'Evade: les attentes sont les decisions du
 * porteur du projet du 25 septembre 2026 (docs/plan/etape-7-9.md).
 */

import type { Couleur, Position, ReglagesPartiels } from '@neon-ninja/shared';
import { EVADE, TACTIQUE, VITESSES } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { attraperLEvadeAuContact } from './contacts.js';
import type { EtatPartie, EvadeSurLaCarte, IdentifiantEntite, Joueur } from './etat.js';
import { AUCUN_BONUS } from './effets.js';
import { ajouterBot, ajouterJoueur, creerEtatInitial, retirerJoueur } from './etat.js';
import {
  avancerLEvade,
  cederLeDoubleur,
  multiplicateurDuScore,
  perdreLeDoubleur,
  porteLeDoubleur,
  preparerLEvade,
} from './evade.js';
import { capturerJoueur } from './capture.js';
import { frapper, lancerLeMassacre, tuerUnJoueur } from './massacre.js';
import { lancerLaPartie, tick } from './moteur.js';
import { calculerScores, scoreDe } from './score.js';
import { tirer } from './tactique.js';

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

/** Une partie vide, pas encore lancee, de trois minutes. */
function partie(
  mode: EtatPartie['mode'] = 'classique',
  reglages: ReglagesPartiels = {},
): EtatPartie {
  return creerEtatInitial({ graine: 7, mode, reglages: { ...AUCUNE_APPARITION, ...reglages } });
}

/** Lit un joueur dont on sait qu'il est present. */
function joueurDe(etat: EtatPartie, id: IdentifiantEntite): Joueur {
  const joueur = etat.joueurs[id];
  if (joueur === undefined) {
    throw new Error(`Le joueur ${id} devrait etre dans la partie.`);
  }
  return joueur;
}

/** Fait entrer un joueur a une place et d'une couleur donnees, sorti de sa protection. */
function avecJoueur(
  etat: EtatPartie,
  id: IdentifiantEntite,
  position: Position,
  couleur: Couleur = id === 'alice' ? ROUGE : BLEU,
): EtatPartie {
  const entre = ajouterJoueur(etat, { id, pseudo: id, couleur, position });
  return {
    ...entre,
    joueurs: {
      ...entre.joueurs,
      [id]: {
        ...joueurDe(entre, id),
        protectionSpawnRestanteMs: 0,
        tempsDepuisDerniereCaptureMs: 5000,
      },
    },
  };
}

/** Pose l'Evade sur la carte, a une place donnee, cap a l'est, sans decision en attente. */
function avecLEvade(etat: EtatPartie, position: Position, porteur?: IdentifiantEntite): EtatPartie {
  const surLaCarte: EvadeSurLaCarte = {
    id: 'evade-99',
    position,
    direction: 'est',
    cap: { x: 1, y: 0 },
    avantDecisionMs: 0,
    avantChangementDeCapMs: 1000,
    avantDepartMs: EVADE.PRESENCE_MS,
  };

  return {
    ...etat,
    evade: { apparitionMs: 0, surLaCarte, passe: false, porteur },
  };
}

/** Le x2 porte par un joueur, l'Evade deja parti. */
function avecLeDoubleur(etat: EtatPartie, porteur: IdentifiantEntite): EtatPartie {
  return { ...etat, evade: { apparitionMs: 0, surLaCarte: undefined, passe: true, porteur } };
}

/** Joue des battements de cinquante millisecondes, sans entree. */
function jouer(etat: EtatPartie, battements: number, entrees = {}): EtatPartie {
  let courant = etat;
  for (let rang = 0; rang < battements; rang += 1) {
    courant = tick(courant, entrees, 50);
  }
  return courant;
}

/** La position de l'Evade, dont on sait qu'il est sur la carte. */
function positionDeLEvade(etat: EtatPartie): Position {
  const present = etat.evade?.surLaCarte;
  if (present === undefined) {
    throw new Error("L'Evade devrait etre sur la carte.");
  }
  return present.position;
}

describe('le moment ou il apparait', () => {
  it('est tire au lancement, entre le quart et les trois quarts de la partie', () => {
    for (const graine of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const lancee = lancerLaPartie(creerEtatInitial({ graine }));
      const moment = lancee.evade?.apparitionMs ?? -1;

      expect(moment).toBeGreaterThanOrEqual(lancee.dureeMs * EVADE.DEBUT_DE_LA_FENETRE);
      expect(moment).toBeLessThan(lancee.dureeMs * EVADE.FIN_DE_LA_FENETRE);
    }
  });

  it('est le meme a graine egale', () => {
    const une = lancerLaPartie(creerEtatInitial({ graine: 12 }));
    const autre = lancerLaPartie(creerEtatInitial({ graine: 12 }));

    expect(une.evade).toEqual(autre.evade);
  });

  it('ne coute aucun tirage, et ne laisse aucune trace, quand le reglage est coupe', () => {
    const etat = partie('classique', { evade: false });
    const prepare = preparerLEvade(etat);

    expect(prepare).toBe(etat);
    expect('evade' in prepare).toBe(false);
  });

  it('n existe pas en Chasse, quoi que l hote regle', () => {
    const chasse = creerEtatInitial({ graine: 3, mode: 'chasse', reglages: { evade: true } });

    expect(chasse.reglages.evade).toBe(false);
    expect(preparerLEvade(chasse)).toBe(chasse);
  });

  it('existe dans les quatre autres modes', () => {
    for (const mode of ['classique', 'tactique', 'equipes', 'massacre'] as const) {
      expect(preparerLEvade(partie(mode)).evade, mode).toBeDefined();
    }
  });
});

describe('son apparition et son depart', () => {
  it('apparait a son heure, pas avant, loin des joueurs, et l annonce', () => {
    const lance = preparerLEvade(avecJoueur(partie(), 'alice', { x: 400, y: 400 }));
    const moment = lance.evade?.apparitionMs ?? 0;
    const avant = { ...lance, tempsEcouleMs: moment - 100 };

    expect(avancerLEvade(avant, 50).evade?.surLaCarte).toBeUndefined();

    const pile = avancerLEvade({ ...lance, tempsEcouleMs: moment }, 50);
    const position = positionDeLEvade(pile);

    expect(pile.evenements).toContainEqual({ type: 'evadeApparu', position });
    expect(Math.hypot(position.x - 400, position.y - 400)).toBeGreaterThanOrEqual(100);
  });

  it('s en va au bout de quarante-cinq secondes, et ne revient plus', () => {
    const present = avecLEvade(partie(), { x: 1000, y: 700 });
    const parti = avancerLEvade(present, EVADE.PRESENCE_MS);

    expect(parti.evade?.surLaCarte).toBeUndefined();
    expect(parti.evade?.passe).toBe(true);
    expect(parti.evenements.some((evenement) => evenement.type === 'evadeEnfui')).toBe(true);
    expect(
      avancerLEvade({ ...parti, tempsEcouleMs: 170_000 }, 50).evade?.surLaCarte,
    ).toBeUndefined();
  });
});

describe('sa fuite', () => {
  it('s eloigne d un joueur qui approche', () => {
    const etat = avecLEvade(avecJoueur(partie(), 'alice', { x: 900, y: 700 }), { x: 1000, y: 700 });
    const apres = jouer(etat, 20);

    expect(positionDeLEvade(apres).x).toBeGreaterThan(1100);
  });

  it('va a 165 pixels par seconde, plus vite qu un joueur sans bonus', () => {
    const etat = avecLEvade(avecJoueur(partie(), 'alice', { x: 700, y: 750 }), { x: 800, y: 750 });
    const apres = jouer(etat, 20);

    expect(positionDeLEvade(apres).x - 800).toBeCloseTo(EVADE.VITESSE_PX_PAR_SECONDE, 0);
    expect(EVADE.VITESSE_PX_PAR_SECONDE).toBeGreaterThan(VITESSES.JOUEUR_PX_PAR_SECONDE);
  });

  it('se fait rattraper en ligne droite par un joueur sous bonus de vitesse', () => {
    const lance = avecLEvade(avecJoueur(partie(), 'alice', { x: 400, y: 750 }), { x: 600, y: 750 });
    const presse = {
      ...lance,
      joueurs: {
        ...lance.joueurs,
        alice: {
          ...joueurDe(lance, 'alice'),
          bonusRestantsMs: { ...AUCUN_BONUS, vitesse: 20_000 },
        },
      },
    };
    const vers = { alice: { deplacement: { x: 1, y: 0 }, enMouvement: true } };
    const apres = jouer(presse, 60, vers);

    expect(apres.evade?.porteur).toBe('alice');
  });

  it('ne se fait pas rattraper en ligne droite par un joueur sans bonus', () => {
    const etat = avecLEvade(avecJoueur(partie(), 'alice', { x: 400, y: 750 }), { x: 600, y: 750 });
    const vers = { alice: { deplacement: { x: 1, y: 0 }, enMouvement: true } };
    const apres = jouer(etat, 60, vers);

    expect(apres.evade?.porteur).toBeUndefined();
  });

  it('longe le bord de la carte au lieu de s y arreter', () => {
    const etat = avecLEvade(avecJoueur(partie(), 'alice', { x: 1850, y: 700 }), {
      x: 1960,
      y: 700,
    });
    const apres = jouer(etat, 20);
    const position = positionDeLEvade(apres);

    expect(position.x).toBeLessThanOrEqual(etat.carte.largeur);
    expect(Math.hypot(position.x - 1960, position.y - 700)).toBeGreaterThan(80);
  });

  it('n est pas pousse par une zone speciale', () => {
    const sans = avecLEvade(partie(), { x: 1000, y: 700 });
    const avec = {
      ...sans,
      zones: {
        'zone-1': {
          id: 'zone-1',
          type: 'repulsion' as const,
          centre: { x: 1000, y: 700 },
          rayon: 200,
          dureeRestanteMs: 10_000,
        },
      },
    };

    expect(positionDeLEvade(jouer(avec, 10))).toEqual(positionDeLEvade(jouer(sans, 10)));
  });

  it('est ignore par les PNJ: aucun ne le repeint, il n en repeint aucun', () => {
    const etat = ajouterBot(avecLEvade(partie(), { x: 1000, y: 700 }), {
      id: 'bot-1',
      type: 'bot',
      couleur: '#123456',
      position: { x: 1005, y: 700 },
    });
    const apres = tick(etat, {}, 50);

    expect(apres.bots['bot-1']?.couleur).toBe('#123456');
  });
});

describe('sa capture', () => {
  it('au contact, en Horde et en Equipes, par le joueur le plus proche', () => {
    for (const mode of ['classique', 'equipes'] as const) {
      const etat = avecLEvade(
        avecJoueur(avecJoueur(partie(mode), 'alice', { x: 1012, y: 700 }), 'bob', {
          x: 1000,
          y: 690,
        }),
        { x: 1000, y: 700 },
      );
      const attrape = attraperLEvadeAuContact(etat, new Set());

      expect(attrape.evade?.porteur, mode).toBe('bob');
      expect(attrape.evade?.surLaCarte, mode).toBeUndefined();
      expect(attrape.evade?.passe, mode).toBe(true);
      expect(attrape.evenements, mode).toContainEqual({
        type: 'evadeAttrape',
        joueur: 'bob',
        position: { x: 1000, y: 700 },
      });
    }
  });

  it('pas au contact en Tactique, mais d un tir en cone, qui coute une charge', () => {
    const touche = avecLEvade(avecJoueur(partie('tactique'), 'alice', { x: 990, y: 700 }), {
      x: 1000,
      y: 700,
    });

    expect(tick(touche, {}, 1).evade?.porteur).toBeUndefined();

    const etat = avecLEvade(avecJoueur(partie('tactique'), 'alice', { x: 950, y: 700 }), {
      x: 1000,
      y: 700,
    });
    const tire = tirer(etat, 'alice');

    expect(tire.evade?.porteur).toBe('alice');
    expect(tire.tactique?.['alice']?.charges).toBe(TACTIQUE.CHARGES_MAXIMUM - 1);
  });

  it('d un coup de katana en Massacre, sans points ni combo', () => {
    const etat = avecLEvade(
      lancerLeMassacre(avecJoueur(partie('massacre'), 'alice', { x: 970, y: 700 })),
      { x: 1000, y: 700 },
    );
    const coup = frapper(etat, 'alice').etat;

    expect(coup.evade?.porteur).toBe('alice');
    expect(coup.massacre?.guerriers['alice']?.points).toBe(0);
    expect(coup.massacre?.guerriers['alice']?.combo).toBe(0);
  });

  it('laisse le Massacre se finir carte nettoyee sans l attendre', () => {
    const etat = avecLEvade(
      lancerLeMassacre(
        ajouterBot(avecJoueur(partie('massacre'), 'alice', { x: 500, y: 500 }), {
          id: 'bot-1',
          type: 'bot',
          couleur: '#123456',
          position: { x: 530, y: 500 },
        }),
      ),
      { x: 1500, y: 1000 },
    );
    const apres = tick(
      etat,
      { alice: { deplacement: { x: 1, y: 0 }, enMouvement: false, capturer: true } },
      50,
    );

    expect(apres.massacre?.carteVidee).toBe(true);
  });
});

describe('le x2 porte', () => {
  it('double le score du porteur, et de lui seul, en Horde', () => {
    const etat = avecLeDoubleur(
      ajouterBot(
        avecJoueur(avecJoueur(partie(), 'alice', { x: 300, y: 300 }), 'bob', { x: 900, y: 900 }),
        {
          id: 'bot-1',
          type: 'bot',
          couleur: ROUGE,
          position: { x: 1500, y: 300 },
        },
      ),
      'alice',
    );

    expect(scoreDe(etat, joueurDe(etat, 'alice')).points).toBe(2);
    expect(scoreDe(etat, joueurDe(etat, 'alice')).doubleur).toBe(true);
    expect(scoreDe(etat, joueurDe(etat, 'bob')).doubleur).toBe(false);
  });

  it('double le score de toute l equipe du porteur, en Equipes', () => {
    const base = ajouterBot(
      avecJoueur(
        avecJoueur(
          avecJoueur(partie('equipes'), 'alice', { x: 300, y: 300 }, ROUGE),
          'carla',
          { x: 600, y: 300 },
          ROUGE,
        ),
        'bob',
        { x: 900, y: 900 },
        BLEU,
      ),
      { id: 'bot-1', type: 'bot', couleur: ROUGE, position: { x: 1500, y: 300 } },
    );
    const etat = avecLeDoubleur(base, 'alice');

    expect(multiplicateurDuScore(etat, joueurDe(etat, 'carla'))).toBe(EVADE.MULTIPLICATEUR);
    expect(multiplicateurDuScore(etat, joueurDe(etat, 'bob'))).toBe(1);
    expect(calculerScores(etat).find((ligne) => ligne.id === 'carla')?.points).toBe(2);
  });

  it('double les points du Massacre', () => {
    const lance = lancerLeMassacre(avecJoueur(partie('massacre'), 'alice', { x: 300, y: 300 }));
    const etat = avecLeDoubleur(
      {
        ...lance,
        massacre: {
          ...lance.massacre!,
          guerriers: { alice: { ...lance.massacre!.guerriers['alice']!, points: 40 } },
        },
      },
      'alice',
    );

    expect(scoreDe(etat, joueurDe(etat, 'alice')).points).toBe(80);
  });

  it('passe a qui capture le porteur, avec ses ninjas', () => {
    const etat = avecLeDoubleur(
      avecJoueur(avecJoueur(partie(), 'alice', { x: 300, y: 300 }), 'bob', { x: 310, y: 300 }),
      'alice',
    );
    const capture = capturerJoueur(etat, 'bob', 'alice');

    expect(capture.evade?.porteur).toBe('bob');
    expect(capture.evenements).toContainEqual({ type: 'doubleurVole', par: 'bob', de: 'alice' });
  });

  it('passe a qui tue le porteur, en Massacre, qui ne vole que la moitie des points ranges', () => {
    const lance = lancerLeMassacre(
      avecJoueur(avecJoueur(partie('massacre'), 'alice', { x: 300, y: 300 }), 'bob', {
        x: 330,
        y: 300,
      }),
    );
    const etat = avecLeDoubleur(
      {
        ...lance,
        massacre: {
          ...lance.massacre!,
          guerriers: {
            ...lance.massacre!.guerriers,
            alice: { ...lance.massacre!.guerriers['alice']!, points: 40 },
          },
        },
      },
      'alice',
    );
    const tue = tuerUnJoueur(etat, 'bob', 'alice', 'ouest');

    expect(tue.evade?.porteur).toBe('bob');
    expect(tue.massacre?.guerriers['bob']?.points).toBe(20);
    expect(scoreDe(tue, joueurDe(tue, 'bob')).points).toBe(40);
  });

  it('est detruit par un Black Ninja qui attrape le porteur', () => {
    const etat = avecLeDoubleur(avecJoueur(partie(), 'alice', { x: 300, y: 300 }), 'alice');
    const perdu = perdreLeDoubleur(etat, 'alice');

    expect(perdu.evade?.porteur).toBeUndefined();
    expect(perdu.evenements).toContainEqual({ type: 'doubleurPerdu', de: 'alice' });
    expect(perdreLeDoubleur(etat, 'bob')).toBe(etat);
  });

  it('est detruit dans une vraie prise par un Black Ninja', () => {
    const base = avecLeDoubleur(
      avecJoueur(
        partie('classique', { botsNoirs: { actifs: true, momentApparitionPourCent: 100 } }),
        'alice',
        {
          x: 300,
          y: 300,
        },
      ),
      'alice',
    );
    const etat = ajouterBot(base, { id: 'noir-1', type: 'botNoir', position: { x: 310, y: 300 } });
    const apres = jouer(etat, 20);

    expect(apres.evade?.porteur).toBeUndefined();
  });

  it('part avec un porteur qui quitte la partie', () => {
    const etat = avecLeDoubleur(avecJoueur(partie(), 'alice', { x: 300, y: 300 }), 'alice');

    expect(retirerJoueur(etat, 'alice').evade?.porteur).toBeUndefined();
  });

  it('ne se cede pas a soi-meme, ni par un joueur qui ne le porte pas', () => {
    const etat = avecLeDoubleur(avecJoueur(partie(), 'alice', { x: 300, y: 300 }), 'alice');

    expect(cederLeDoubleur(etat, 'alice', 'alice')).toBe(etat);
    expect(cederLeDoubleur(etat, 'bob', 'alice')).toBe(etat);
    expect(porteLeDoubleur(etat, 'alice')).toBe(true);
    expect(porteLeDoubleur(etat, 'bob')).toBe(false);
  });
});
