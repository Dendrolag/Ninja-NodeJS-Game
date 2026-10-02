/**
 * Tests de la mine posee (etape 7.11): la pose et le plafond de trois, la disparition au
 * depart du poseur, l'armement, le delai et le rayon, et ce que l'explosion fait dans chaque
 * mode.
 *
 * Aucune version du jeu d'origine n'avait de mine: les attentes sont les decisions du porteur
 * du projet du 28 septembre 2026 (docs/plan/etape-7-11.md).
 */

import type { Couleur, Position, ReglagesPartiels } from '@neon-ninja/shared';
import { CHASSE, COULEUR_BOT_NEUTRE, MASSACRE, MINES } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { capturerJoueur } from './capture.js';
import { amputerLeParcours, devenirTraqueur, enrayerLArme, infecter } from './chasse.js';
import type {
  EtatPartie,
  EvenementPartie,
  IdentifiantEntite,
  Joueur,
  MineExplosee,
  MineSurLaCarte,
} from './etat.js';
import { ajouterBot, ajouterJoueur, creerEtatInitial, retirerJoueur } from './etat.js';
import { amputerLaReserve, lancerLaHorde, rallieurDe } from './horde.js';
import { guerrierDe, lancerLeMassacre } from './massacre.js';
import { avancerLesMines, poserUneMine } from './mines.js';
import type { Entrees } from './moteur.js';
import { REGLES_DES_MODES, tick } from './moteur.js';
import { scoreDe } from './score.js';

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
  evade: false,
  objetsDePoche: { fumee: { tauxApparitionPourCent: 0 }, mine: { tauxApparitionPourCent: 0 } },
};

const ROUGE: Couleur = '#FF0000';
const BLEU: Couleur = '#0000FF';
const ICI: Position = { x: 500, y: 500 };

/** Une partie vide, pas encore lancee. */
function partie(mode: EtatPartie['mode'] = 'classique'): EtatPartie {
  return creerEtatInitial({ graine: 7, mode, reglages: AUCUNE_APPARITION });
}

/** Lit un joueur dont on sait qu'il est present. */
function joueurDe(etat: EtatPartie, id: IdentifiantEntite): Joueur {
  const joueur = etat.joueurs[id];
  if (joueur === undefined) {
    throw new Error(`Le joueur ${id} devrait etre dans la partie.`);
  }
  return joueur;
}

/** Change des champs d'un joueur. */
function regler(etat: EtatPartie, id: IdentifiantEntite, champs: Partial<Joueur>): EtatPartie {
  return { ...etat, joueurs: { ...etat.joueurs, [id]: { ...joueurDe(etat, id), ...champs } } };
}

/** Fait entrer un joueur a une place donnee, sorti de sa protection, pret a capturer. */
function avecJoueur(
  etat: EtatPartie,
  id: IdentifiantEntite,
  position: Position,
  couleur: Couleur = id === 'alice' ? ROUGE : BLEU,
): EtatPartie {
  const entre = ajouterJoueur(etat, { id, pseudo: id, couleur, position });
  return regler(entre, id, { protectionSpawnRestanteMs: 0, tempsDepuisDerniereCaptureMs: 5000 });
}

/** Pose des faux ninjas de cette couleur, loin de tout, ou la ou on le dit. */
function avecNinjas(
  etat: EtatPartie,
  prefixe: string,
  nombre: number,
  couleur: Couleur,
  position: Position = { x: 1500, y: 1200 },
): EtatPartie {
  let courant = etat;
  for (let rang = 0; rang < nombre; rang += 1) {
    courant = ajouterBot(courant, { id: `${prefixe}${String(rang)}`, position, couleur });
  }
  return courant;
}

/** Pose une mine d'alice a cet endroit, armee ou non. */
function avecMine(
  etat: EtatPartie,
  position: Position,
  avantExplosionMs?: number,
  poseur: IdentifiantEntite = 'alice',
  id: IdentifiantEntite = 'm1',
): EtatPartie {
  const mine: MineSurLaCarte = {
    id,
    poseur,
    position,
    ...(avantExplosionMs === undefined ? {} : { avantExplosionMs }),
  };
  return { ...etat, minesPosees: { ...etat.minesPosees, [id]: mine } };
}

/** Un battement des mines seules, avec les regles du mode de la partie. */
function mines(etat: EtatPartie, dtMs = 50): EtatPartie {
  const regles = REGLES_DES_MODES[etat.mode];
  return avancerLesMines({ ...etat, evenements: [] }, dtMs, regles, regles.horsJeu(etat));
}

/** Fait sauter une mine d'alice deja armee, a son dernier battement. */
function explosion(etat: EtatPartie, position: Position = ICI): EtatPartie {
  return mines(avecMine(etat, position, 50));
}

/** Les faits d'un type du dernier battement. */
function faits<T extends EvenementPartie['type']>(
  etat: EtatPartie,
  type: T,
): Extract<EvenementPartie, { type: T }>[] {
  return etat.evenements.filter(
    (evenement): evenement is Extract<EvenementPartie, { type: T }> => evenement.type === type,
  );
}

/** Le fait de la derniere explosion. */
function laDetonation(etat: EtatPartie): MineExplosee {
  const [detonation] = faits(etat, 'mineExplosee');
  if (detonation === undefined) {
    throw new Error('Une mine devrait avoir saute.');
  }
  return detonation;
}

/** Les faux ninjas de cette couleur. */
function ninjasDe(etat: EtatPartie, couleur: Couleur): number {
  return Object.values(etat.bots).filter((bot) => bot.type === 'bot' && bot.couleur === couleur)
    .length;
}

/** Un point a cette distance du centre, vers l'est. */
function aLEst(distance: number): Position {
  return { x: ICI.x + distance, y: ICI.y };
}

describe('la pose', () => {
  it('pose la mine sous les pieds du joueur, vide sa poche, et le dit au journal', () => {
    const etat = regler(avecJoueur(partie(), 'alice', ICI), 'alice', { poche: 'mine' });
    const apres = tick(
      etat,
      { alice: { enMouvement: false, deplacement: { x: 0, y: 0 }, utiliserLaPoche: true } },
      50,
    );

    expect(Object.values(apres.minesPosees ?? {})).toEqual([
      { id: `mine-${String(etat.compteurIdentifiants)}`, poseur: 'alice', position: ICI },
    ]);
    expect(joueurDe(apres, 'alice').poche).toBeUndefined();
    expect(faits(apres, 'minePosee')).toEqual([
      {
        type: 'minePosee',
        joueur: 'alice',
        mine: `mine-${String(etat.compteurIdentifiants)}`,
        position: ICI,
      },
    ]);
    expect(apres.compteurIdentifiants).toBe(etat.compteurIdentifiants + 1);
  });

  it('garde trois mines par joueur: la quatrieme chasse la plus ancienne', () => {
    let etat = avecJoueur(avecJoueur(partie(), 'alice', ICI), 'bob', { x: 100, y: 100 });
    etat = poserUneMine(etat, joueurDe(etat, 'bob'));

    for (let pose = 0; pose < 4; pose += 1) {
      const deplacee = regler(etat, 'alice', { position: aLEst(pose * 40) });
      etat = poserUneMine(deplacee, joueurDe(deplacee, 'alice'));
    }

    const restantes = Object.values(etat.minesPosees ?? {});
    expect(
      restantes.filter((mine) => mine.poseur === 'alice').map((mine) => mine.position.x),
    ).toEqual([540, 580, 620]);
    expect(restantes.filter((mine) => mine.poseur === 'bob')).toHaveLength(1);
  });

  it('retire les mines d un joueur qui quitte la partie, et elles seules', () => {
    const etat = avecMine(
      avecMine(avecJoueur(avecJoueur(partie(), 'alice', ICI), 'bob', aLEst(300)), ICI),
      aLEst(300),
      undefined,
      'bob',
      'm2',
    );

    expect(Object.keys(retirerJoueur(etat, 'alice').minesPosees ?? {})).toEqual(['m2']);
    expect(retirerJoueur(retirerJoueur(etat, 'alice'), 'bob').minesPosees).toBeUndefined();
  });

  it('laisse les mines d un joueur qui se fait capturer', () => {
    const etat = avecMine(
      avecJoueur(avecJoueur(partie(), 'alice', ICI), 'bob', aLEst(10)),
      aLEst(400),
    );

    expect(capturerJoueur(etat, 'bob', 'alice').minesPosees).toEqual(etat.minesPosees);
  });

  it('ne change rien a une partie sans mine', () => {
    const etat = avecJoueur(partie(), 'alice', ICI);

    expect(mines(etat)).toEqual({ ...etat, evenements: [] });
  });
});

describe('l armement', () => {
  const base = (): EtatPartie =>
    avecMine(avecJoueur(avecJoueur(partie(), 'alice', aLEst(-300)), 'bob', aLEst(10)), ICI);

  it('est le fait d un adversaire qui passe dessus', () => {
    const apres = mines(base());

    expect(apres.minesPosees?.['m1']?.avantExplosionMs).toBe(MINES.DELAI_AVANT_EXPLOSION_MS);
    expect(faits(apres, 'mineArmee')).toEqual([
      { type: 'mineArmee', mine: 'm1', poseur: 'alice', par: 'bob', position: ICI },
    ]);
  });

  it('se mesure comme un contact, en inegalite stricte', () => {
    const pile = regler(base(), 'bob', { position: aLEst(MINES.SEUIL_ARMEMENT_PX) });

    expect(mines(pile).minesPosees?.['m1']?.avantExplosionMs).toBeUndefined();
  });

  it('n est jamais le fait du poseur', () => {
    const etat = regler(base(), 'alice', { position: ICI });

    expect(mines(regler(etat, 'bob', { position: aLEst(400) })).minesPosees?.['m1']).toEqual({
      id: 'm1',
      poseur: 'alice',
      position: ICI,
    });
  });

  it('n est pas le fait d un coequipier, en Equipes', () => {
    const etat = avecMine(
      avecJoueur(
        avecJoueur(partie('equipes'), 'alice', aLEst(-300), ROUGE),
        'carole',
        aLEst(5),
        ROUGE,
      ),
      ICI,
    );

    expect(mines(etat).minesPosees?.['m1']?.avantExplosionMs).toBeUndefined();
  });

  it('est le fait d un Black Ninja, pas d un faux ninja', () => {
    const avecFaux = ajouterBot(regler(base(), 'bob', { position: aLEst(400) }), {
      id: 'faux',
      position: ICI,
    });
    expect(mines(avecFaux).minesPosees?.['m1']?.avantExplosionMs).toBeUndefined();

    const avecNoir = ajouterBot(avecFaux, { id: 'noir', type: 'botNoir', position: aLEst(5) });
    expect(faits(mines(avecNoir), 'mineArmee')[0]?.par).toBe('noir');
  });

  it('n est pas le fait de l Evade', () => {
    const etat = regler(base(), 'bob', { position: aLEst(400) });
    const avecLEvade: EtatPartie = {
      ...etat,
      evade: {
        apparitionMs: 0,
        passe: false,
        porteur: undefined,
        surLaCarte: {
          id: 'evade',
          position: ICI,
          direction: 'est',
          cap: { x: 1, y: 0 },
          avantDecisionMs: 100,
          avantChangementDeCapMs: 100,
          avantDepartMs: 10_000,
        },
      },
    };

    expect(mines(avecLEvade).minesPosees?.['m1']?.avantExplosionMs).toBeUndefined();
  });

  it('est le fait d un joueur protege comme d un autre', () => {
    const protege = regler(base(), 'bob', { protectionSpawnRestanteMs: 2000 });

    expect(mines(protege).minesPosees?.['m1']?.avantExplosionMs).toBe(
      MINES.DELAI_AVANT_EXPLOSION_MS,
    );
  });
});

describe('le delai et le rayon', () => {
  /**
   * Alice a pose sa mine en ICI; Bob court vers l'est et passe dessus au premier battement,
   * Carole le suit, a cet ecart, a la meme vitesse.
   */
  function poursuite(ecartDeCarole: number): EtatPartie {
    let etat = lancerLaHorde(
      avecJoueur(
        avecJoueur(avecJoueur(partie(), 'alice', { x: 100, y: 100 }), 'bob', aLEst(-25)),
        'carole',
        aLEst(-25 - ecartDeCarole),
        '#00FF00',
      ),
    );
    etat = avecNinjas(avecNinjas(etat, 'b', 20, BLEU), 'c', 20, '#00FF00');
    return avecMine(etat, ICI);
  }

  const VERS_L_EST: Entrees = {
    bob: { enMouvement: true, deplacement: { x: 1, y: 0 } },
    carole: { enMouvement: true, deplacement: { x: 1, y: 0 } },
  };

  /** Joue des battements de 50 ms, et rend les explosions vues en route. */
  function jouer(
    etat: EtatPartie,
    battements: number,
  ): { etat: EtatPartie; detonations: MineExplosee[] } {
    let courant = etat;
    const detonations: MineExplosee[] = [];
    for (let battement = 0; battement < battements; battement += 1) {
      courant = tick(courant, VERS_L_EST, 50);
      detonations.push(...faits(courant, 'mineExplosee'));
    }
    return { etat: courant, detonations };
  }

  it('saute 1,5 seconde apres l armement, pas avant', () => {
    const arme = jouer(poursuite(300), 1);
    expect(faits(arme.etat, 'mineArmee')).toHaveLength(1);

    const presque = jouer(arme.etat, MINES.DELAI_AVANT_EXPLOSION_MS / 50 - 1);
    expect(presque.detonations).toEqual([]);

    const pile = jouer(presque.etat, 1);
    expect(pile.detonations).toHaveLength(1);
    expect(pile.etat.minesPosees).toBeUndefined();
  });

  it('epargne celui qui passe dessus sans s arreter, et prend celui qui le suit de loin', () => {
    // A 150 pixels par seconde, Bob est a 207 pixels quand elle saute. Carole, 150 pixels
    // derriere lui, arrive sur la mine a ce moment-la.
    const { detonations } = jouer(poursuite(150), 1 + MINES.DELAI_AVANT_EXPLOSION_MS / 50);

    expect(detonations[0]?.touches.map((touche) => touche.joueur)).toEqual(['carole']);
  });

  it('laisse sortir un poursuivant colle a lui, a la meme vitesse', () => {
    // Mesure de l'etape: a moins de 78 pixels derriere, le poursuivant est deja passe.
    const { detonations } = jouer(poursuite(60), 1 + MINES.DELAI_AVANT_EXPLOSION_MS / 50);

    expect(detonations[0]?.touches).toEqual([]);
  });

  it('touche ce qui est dans son rayon au moment ou elle saute, bord compris', () => {
    const etat = avecNinjas(
      avecNinjas(
        avecJoueur(
          avecJoueur(
            avecJoueur(partie(), 'alice', { x: 100, y: 100 }),
            'bob',
            aLEst(MINES.RAYON_EXPLOSION_PX),
          ),
          'carole',
          aLEst(MINES.RAYON_EXPLOSION_PX + 1),
          '#00FF00',
        ),
        'b',
        20,
        BLEU,
      ),
      'c',
      20,
      '#00FF00',
    );

    expect(laDetonation(explosion(etat)).touches.map((touche) => touche.joueur)).toEqual(['bob']);
  });

  it('ne declenche pas les autres mines: pas de reaction en chaine', () => {
    const etat = avecMine(
      avecJoueur(avecJoueur(partie(), 'alice', { x: 100, y: 100 }), 'bob', { x: 1500, y: 1000 }),
      aLEst(20),
      undefined,
      'alice',
      'm2',
    );
    const apres = explosion(etat);

    expect(faits(apres, 'mineExplosee')).toHaveLength(1);
    expect(apres.minesPosees).toEqual({ m2: { id: 'm2', poseur: 'alice', position: aLEst(20) } });
  });
});

describe('en Horde et en Tactique', () => {
  function horde(): EtatPartie {
    const etat = lancerLaHorde(
      avecJoueur(avecJoueur(partie(), 'alice', { x: 100, y: 100 }), 'bob', aLEst(50)),
    );
    const rallieurs = {
      ...etat.horde?.rallieurs,
      bob: { combo: 7, avantFinDuComboMs: 1500, prime: 40 },
    };
    return avecNinjas(avecNinjas({ ...etat, horde: { rallieurs } }, 'b', 20, BLEU), 'a', 5, ROUGE);
  }

  it('fait perdre 15 pour cent de ses ninjas a l adversaire, qui redeviennent neutres', () => {
    const apres = explosion(horde());

    expect(ninjasDe(apres, BLEU)).toBe(17);
    expect(ninjasDe(apres, COULEUR_BOT_NEUTRE)).toBe(3);
    expect(laDetonation(apres).touches).toEqual([
      { joueur: 'bob', effet: 'ninjasPerdus', quantite: 3 },
    ]);
  });

  it('ampute la reserve de la meme part, et fait retomber le combo', () => {
    expect(rallieurDe(explosion(horde()), 'bob')).toEqual({
      combo: 0,
      avantFinDuComboMs: 0,
      prime: 34,
    });
  });

  it('ne rapporte rien au poseur, ne deplace pas la victime et ne la protege pas', () => {
    const avant = horde();
    const apres = explosion(avant);

    expect(ninjasDe(apres, ROUGE)).toBe(5);
    expect(scoreDe(apres, joueurDe(apres, 'alice')).points).toBe(
      scoreDe(avant, joueurDe(avant, 'alice')).points,
    );
    expect(joueurDe(apres, 'bob').position).toEqual(aLEst(50));
    expect(joueurDe(apres, 'bob').protectionSpawnRestanteMs).toBe(0);
    expect(laDetonation(apres).points).toBe(0);
  });

  it('laisse le x2 de l Evade a son porteur: ce n est pas une capture', () => {
    const avant = horde();
    const apres = explosion({
      ...avant,
      evade: { apparitionMs: 0, passe: true, porteur: 'bob', surLaCarte: undefined },
    });

    expect(apres.evade?.porteur).toBe('bob');
  });

  it('fait perdre la meme part en Tactique, sans reserve', () => {
    const etat = avecNinjas(
      avecJoueur(avecJoueur(partie('tactique'), 'alice', { x: 100, y: 100 }), 'bob', aLEst(50)),
      'b',
      40,
      BLEU,
    );

    expect(ninjasDe(explosion(etat), BLEU)).toBe(34);
  });

  it('epargne l invincible et le protege', () => {
    const invincible = regler(horde(), 'bob', {
      bonusRestantsMs: { vitesse: 0, invincibilite: 5000, revelation: 0 },
    });
    const protege = regler(horde(), 'bob', { protectionSpawnRestanteMs: 1000 });

    expect(laDetonation(explosion(invincible)).touches).toEqual([]);
    expect(laDetonation(explosion(protege)).touches).toEqual([]);
    expect(ninjasDe(explosion(protege), BLEU)).toBe(20);
  });

  it('ne touche jamais son poseur', () => {
    const etat = regler(horde(), 'alice', { position: ICI });

    expect(laDetonation(explosion(etat)).touches.map((touche) => touche.joueur)).toEqual(['bob']);
    expect(ninjasDe(explosion(etat), ROUGE)).toBe(5);
  });

  it('tue les Black Ninjas du rayon, quinze points chacun pour le poseur', () => {
    const etat = ajouterBot(
      ajouterBot(horde(), { id: 'n1', type: 'botNoir', position: aLEst(-60) }),
      {
        id: 'n2',
        type: 'botNoir',
        position: aLEst(-200),
      },
    );
    const apres = explosion(etat);

    expect(Object.keys(apres.bots)).not.toContain('n1');
    expect(Object.keys(apres.bots)).toContain('n2');
    expect(joueurDe(apres, 'alice').botsNoirsDetruits).toBe(1);
    expect(laDetonation(apres)).toMatchObject({ botsNoirsTues: 1, botsTues: 0, points: 15 });
  });

  it('laisse les faux ninjas et l Evade en vie', () => {
    const etat = avecNinjas(horde(), 'n', 3, COULEUR_BOT_NEUTRE, aLEst(20));
    const avecLEvade: EtatPartie = {
      ...etat,
      evade: {
        apparitionMs: 0,
        passe: false,
        porteur: undefined,
        surLaCarte: {
          id: 'evade',
          position: ICI,
          direction: 'est',
          cap: { x: 1, y: 0 },
          avantDecisionMs: 100,
          avantChangementDeCapMs: 100,
          avantDepartMs: 10_000,
        },
      },
    };
    const apres = explosion(avecLEvade);

    expect(Object.keys(apres.bots)).toHaveLength(Object.keys(etat.bots).length);
    expect(apres.evade?.surLaCarte).toBeDefined();
  });
});

describe('en Equipes', () => {
  it('fait perdre sa part a l adversaire, et epargne les coequipiers du poseur', () => {
    let etat = avecJoueur(partie('equipes'), 'alice', { x: 100, y: 100 }, ROUGE);
    etat = avecJoueur(etat, 'carole', aLEst(30), ROUGE);
    etat = avecJoueur(etat, 'bob', aLEst(50), BLEU);
    etat = avecJoueur(etat, 'dan', { x: 1500, y: 1000 }, BLEU);
    etat = avecNinjas(avecNinjas(etat, 'b', 40, BLEU), 'r', 10, ROUGE);
    const apres = explosion(etat);

    // La part de Bob: 20 des 40 ninjas bleus, dont il perd 15 pour cent, 3.
    expect(laDetonation(apres).touches).toEqual([
      { joueur: 'bob', effet: 'ninjasPerdus', quantite: 3 },
    ]);
    expect(ninjasDe(apres, BLEU)).toBe(37);
    expect(ninjasDe(apres, ROUGE)).toBe(10);
  });
});

describe('en Massacre', () => {
  function massacre(): EtatPartie {
    const etat = lancerLeMassacre(
      avecNinjas(
        avecJoueur(avecJoueur(partie('massacre'), 'alice', { x: 100, y: 100 }), 'bob', aLEst(50)),
        'loin',
        2,
        COULEUR_BOT_NEUTRE,
      ),
    );
    const guerriers = {
      ...etat.massacre?.guerriers,
      alice: { ...guerrierDe(etat, 'alice'), combo: 3, avantFinDuComboMs: 1000 },
      bob: { ...guerrierDe(etat, 'bob'), points: 101 },
    };
    return { ...etat, massacre: { guerriers, carteVidee: false } };
  }

  it('tue l adversaire, qui cede la moitie de ses points au poseur et reapparait', () => {
    const apres = explosion(massacre());

    expect(guerrierDe(apres, 'bob').points).toBe(51);
    expect(guerrierDe(apres, 'alice').points).toBe(50);
    expect(joueurDe(apres, 'bob').position).not.toEqual(aLEst(50));
    expect(joueurDe(apres, 'bob').protectionSpawnRestanteMs).toBeGreaterThan(0);
    expect(joueurDe(apres, 'alice').captures).toBe(1);
    expect(laDetonation(apres).touches).toEqual([{ joueur: 'bob', effet: 'tue', quantite: 50 }]);
  });

  it('tue plusieurs joueurs d un coup, sans tenir compte du delai du poseur', () => {
    const etat = regler(avecJoueur(massacre(), 'carole', aLEst(-40), '#00FF00'), 'alice', {
      tempsDepuisDerniereCaptureMs: 0,
    });
    const apres = explosion(lancerLeMassacre(etat));

    expect(laDetonation(apres).touches.map((touche) => touche.joueur)).toEqual(['bob', 'carole']);
    expect(joueurDe(apres, 'alice').tempsDepuisDerniereCaptureMs).toBe(0);
  });

  it('tue les faux ninjas et les Black Ninjas du rayon, sans multiplicateur ni combo', () => {
    const etat = ajouterBot(avecNinjas(massacre(), 'b', 2, COULEUR_BOT_NEUTRE, aLEst(-30)), {
      id: 'noir',
      type: 'botNoir',
      position: aLEst(30),
    });
    const apres = explosion(regler(etat, 'bob', { position: { x: 1500, y: 1000 } }));
    const alice = guerrierDe(apres, 'alice');

    expect(alice.points).toBe(2 * MASSACRE.POINTS_PAR_BOT + MASSACRE.POINTS_PAR_BOT_NOIR);
    expect(alice.combo).toBe(3);
    expect(alice.botsTues).toBe(3);
    expect(joueurDe(apres, 'alice').botsNoirsDetruits).toBe(1);
    expect(laDetonation(apres)).toMatchObject({ botsTues: 2, botsNoirsTues: 1, points: 35 });
  });

  it('prend le x2 du porteur tue pour le poseur', () => {
    const etat = {
      ...massacre(),
      evade: { apparitionMs: 0, passe: true, porteur: 'bob', surLaCarte: undefined },
    };

    expect(explosion(etat).evade?.porteur).toBe('alice');
  });

  it('tue l Evade, dont le x2 va au poseur', () => {
    const etat: EtatPartie = {
      ...regler(massacre(), 'bob', { position: { x: 1500, y: 1000 } }),
      evade: {
        apparitionMs: 0,
        passe: false,
        porteur: undefined,
        surLaCarte: {
          id: 'evade',
          position: aLEst(40),
          direction: 'est',
          cap: { x: 1, y: 0 },
          avantDecisionMs: 100,
          avantChangementDeCapMs: 100,
          avantDepartMs: 10_000,
        },
      },
    };
    const apres = explosion(etat);

    expect(apres.evade?.porteur).toBe('alice');
    expect(apres.evade?.surLaCarte).toBeUndefined();
  });

  it('vide la carte quand elle tue le dernier faux ninja', () => {
    const etat = lancerLeMassacre(
      avecNinjas(
        avecJoueur(partie('massacre'), 'alice', { x: 100, y: 100 }),
        'dernier',
        1,
        COULEUR_BOT_NEUTRE,
        aLEst(10),
      ),
    );
    const apres = explosion(etat);

    expect(apres.massacre?.carteVidee).toBe(true);
    expect(faits(apres, 'carteVidee')).toHaveLength(1);
  });
});

describe('en Chasse', () => {
  /** Alice et Bob proies, Tom traqueur, lancee sans tirage: Tom devient traqueur a la main. */
  function chasse(): EtatPartie {
    let etat = avecJoueur(
      avecJoueur(partie('chasse'), 'alice', { x: 100, y: 100 }),
      'bob',
      aLEst(50),
    );
    etat = avecJoueur(etat, 'tom', { x: 1500, y: 1000 }, '#00FF00');
    // Une Chasse lancee a la main, sans tirage: seul Tom est traqueur, et Bob a couru 2000 px.
    etat = {
      ...etat,
      chasse: {
        traqueurs: {},
        parcours: {
          alice: { distancePx: 0, derniere: { x: 100, y: 100 } },
          bob: { distancePx: 2000, derniere: aLEst(50) },
        },
        traqueursEpuises: false,
      },
    };
    return devenirTraqueur(etat, 'tom');
  }

  it('ne touche pas la proie d une autre proie: elles sont du meme camp', () => {
    expect(laDetonation(explosion(chasse())).touches).toEqual([]);
  });

  it('fait perdre a la proie 15 pour cent de sa distance, donc de ses points', () => {
    // La mine est a Tom, traqueur: Bob, proie, est de l'autre camp.
    const etat = avecMine(chasse(), ICI, 50, 'tom');
    const apres = mines(etat);

    expect(apres.chasse?.parcours['bob']?.distancePx).toBe(1700);
    expect(laDetonation(apres).touches).toEqual([
      { joueur: 'bob', effet: 'pointsPerdus', quantite: 3 },
    ]);
    expect(Math.floor(1700 / CHASSE.PIXELS_PAR_POINT)).toBe(17);
  });

  it('enraye trois secondes l arme du traqueur touche', () => {
    const etat = regler(chasse(), 'tom', { position: aLEst(40), protectionSpawnRestanteMs: 0 });
    const apres = explosion(etat);

    expect(apres.chasse?.traqueurs['tom']?.avantProchainTirMs).toBe(MINES.ENRAYEMENT_MS);
    expect(apres.chasse?.traqueurs['tom']?.vies).toBe(CHASSE.VIES_DES_TRAQUEURS);
    expect(laDetonation(apres).touches).toContainEqual({
      joueur: 'tom',
      effet: 'armeEnrayee',
      quantite: MINES.ENRAYEMENT_MS,
    });
  });

  it('change de camp avec son poseur: la mine d une proie infectee frappe les proies', () => {
    const etat = infecter(
      regler(chasse(), 'tom', { position: { x: 101, y: 101 } }),
      'tom',
      'alice',
    );

    expect(laDetonation(explosion(etat)).touches.map((touche) => touche.joueur)).toEqual(['bob']);
  });
});

describe('les cas limites', () => {
  it('n arme ni ne fait sauter la mine d un poseur absent: elle disparait sans bruit', () => {
    const sansPoseur = avecMine(avecJoueur(partie(), 'bob', ICI), ICI, undefined, 'fantome');
    expect(mines(sansPoseur).minesPosees?.['m1']?.avantExplosionMs).toBeUndefined();

    const armee = avecMine(avecJoueur(partie(), 'bob', ICI), ICI, 50, 'fantome');
    const apres = mines(armee);
    expect(apres.minesPosees).toBeUndefined();
    expect(faits(apres, 'mineExplosee')).toEqual([]);
  });

  it('n enraye que l arme d un traqueur, et n ampute que le parcours d une proie qui en a un', () => {
    const etat = avecJoueur(partie('chasse'), 'bob', ICI);

    expect(enrayerLArme(etat, 'bob', MINES.ENRAYEMENT_MS)).toBe(etat);
    expect(amputerLeParcours(etat, 'bob', 15)).toEqual({ etat, pointsPerdus: 0 });

    const lancee: EtatPartie = {
      ...etat,
      chasse: { traqueurs: {}, parcours: {}, traqueursEpuises: false },
    };
    expect(amputerLeParcours(lancee, 'bob', 15)).toEqual({ etat: lancee, pointsPerdus: 0 });
  });

  it('garde une attente de tir plus longue que l enrayement', () => {
    let etat = devenirTraqueur(avecJoueur(partie('chasse'), 'tom', ICI), 'tom');
    const arme = etat.chasse?.traqueurs['tom'];
    etat = {
      ...etat,
      chasse: {
        ...(etat.chasse as NonNullable<EtatPartie['chasse']>),
        traqueurs: { tom: { ...(arme as NonNullable<typeof arme>), avantProchainTirMs: 5000 } },
      },
    };

    expect(
      enrayerLArme(etat, 'tom', MINES.ENRAYEMENT_MS).chasse?.traqueurs['tom']?.avantProchainTirMs,
    ).toBe(5000);
  });

  it('n ampute la reserve que d une Horde lancee', () => {
    const etat = avecJoueur(partie(), 'bob', ICI);

    expect(amputerLaReserve(etat, 'bob', 15)).toBe(etat);
  });
});
