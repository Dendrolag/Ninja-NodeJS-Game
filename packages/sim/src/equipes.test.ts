/**
 * Tests du mode Equipes (etape 7.2): la part d'un joueur, la capture d'un adversaire,
 * le bot noir, le malus, et le jeu de regles du mode dans le moteur.
 *
 * Aucune version du jeu d'origine n'a ce mode, donc aucune caracterisation: les
 * attentes sont les decisions du porteur du projet du 15 septembre 2026
 * (docs/plan/etape-7-2.md).
 */

import type { Position, ReglagesPartiels } from '@neon-ninja/shared';
import { COULEUR_BOT_NEUTRE, COULEURS_DES_EQUIPES, DUREES, creerAlea } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { avancerLesBots } from './bots.js';
import { capturerEnEquipe, capturerJoueur } from './capture.js';
import { detecterContacts, regleEquipes, resoudreContacts } from './contacts.js';
import type { Couleur } from './couleurs.js';
import { couleurDeBot, couleurUnique } from './couleurs.js';
import { malusEnEquipe, partDuJoueur, perteEnEquipe } from './equipes.js';
import type { EtatPartie, IdentifiantEntite, Joueur } from './etat.js';
import { ajouterBot, ajouterJoueur, changerDeCouleur, creerEtatInitial } from './etat.js';
import type { Entrees } from './moteur.js';
import { REGLES_DES_MODES, tick } from './moteur.js';
import { poserObjet, ramasserLesObjets } from './objets.js';

const CYAN = COULEURS_DES_EQUIPES.cyan;
const MAGENTA = COULEURS_DES_EQUIPES.magenta;

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
};

/** Une partie Equipes vide. */
function partie(reglages: ReglagesPartiels = AUCUNE_APPARITION): EtatPartie {
  return creerEtatInitial({ graine: 11, mode: 'equipes', reglages });
}

/** Lit un joueur dont on sait qu'il est present. */
function joueurDe(etat: EtatPartie, id: IdentifiantEntite): Joueur {
  const joueur = etat.joueurs[id];
  if (joueur === undefined) {
    throw new Error(`Le joueur ${id} devrait etre dans la partie.`);
  }
  return joueur;
}

/** Change quelques champs d'un joueur, pour poser une situation de depart. */
function regler(etat: EtatPartie, id: IdentifiantEntite, champs: Partial<Joueur>): EtatPartie {
  return { ...etat, joueurs: { ...etat.joueurs, [id]: { ...joueurDe(etat, id), ...champs } } };
}

/** Fait entrer un joueur dans une equipe, a une place donnee, sorti de sa protection. */
function avecJoueur(
  etat: EtatPartie,
  id: IdentifiantEntite,
  couleur: Couleur,
  position: Position,
): EtatPartie {
  return regler(ajouterJoueur(etat, { id, pseudo: id, couleur, position }), id, {
    protectionSpawnRestanteMs: 0,
  });
}

/** Pose des bots d'une couleur, nommes par un prefixe et leur rang. */
function avecBots(
  etat: EtatPartie,
  prefixe: string,
  couleur: Couleur,
  positions: readonly Position[],
): EtatPartie {
  return positions.reduce(
    (courant, position, rang) =>
      ajouterBot(courant, { id: `${prefixe}${String(rang)}`, couleur, position }),
    etat,
  );
}

/** Les identifiants des bots d'une couleur, dans l'ordre de l'etat. */
function botsDeCouleur(etat: EtatPartie, couleur: Couleur): readonly IdentifiantEntite[] {
  return Object.values(etat.bots)
    .filter((bot) => bot.type === 'bot' && bot.couleur === couleur)
    .map((bot) => bot.id);
}

describe('partDuJoueur', () => {
  it('donne tous les bots de son equipe a un joueur seul dans son equipe', () => {
    let etat = avecJoueur(partie(), 'c1', CYAN, { x: 500, y: 500 });
    etat = avecBots(etat, 'c', CYAN, [
      { x: 900, y: 500 },
      { x: 1000, y: 500 },
      { x: 1100, y: 500 },
    ]);

    expect(partDuJoueur(etat, joueurDe(etat, 'c1'))).toHaveLength(3);
  });

  it('divise les bots de l equipe par le nombre de ses membres, arrondi en dessous', () => {
    let etat = avecJoueur(partie(), 'c1', CYAN, { x: 500, y: 500 });
    etat = avecJoueur(etat, 'c2', CYAN, { x: 1500, y: 1000 });
    etat = avecBots(etat, 'c', CYAN, [
      { x: 700, y: 700 },
      { x: 800, y: 700 },
      { x: 900, y: 700 },
      { x: 1000, y: 700 },
      { x: 1100, y: 700 },
    ]);

    expect(partDuJoueur(etat, joueurDe(etat, 'c1'))).toHaveLength(2);
  });

  it('prend les bots de l equipe les plus proches du joueur d abord', () => {
    let etat = avecJoueur(partie(), 'c1', CYAN, { x: 500, y: 500 });
    etat = avecJoueur(etat, 'c2', CYAN, { x: 1500, y: 1000 });
    etat = avecBots(etat, 'c', CYAN, [
      { x: 900, y: 500 },
      { x: 520, y: 500 },
      { x: 1400, y: 500 },
      { x: 600, y: 500 },
    ]);

    const part = partDuJoueur(etat, joueurDe(etat, 'c1')).map((bot) => bot.id);

    expect(part).toEqual(['c1', 'c3']);
  });

  it('departage deux bots a la meme distance par leur ordre dans l etat', () => {
    let etat = avecJoueur(partie(), 'c1', CYAN, { x: 500, y: 500 });
    etat = avecJoueur(etat, 'c2', CYAN, { x: 1500, y: 1000 });
    etat = avecBots(etat, 'c', CYAN, [
      { x: 600, y: 500 },
      { x: 400, y: 500 },
    ]);

    expect(partDuJoueur(etat, joueurDe(etat, 'c1')).map((bot) => bot.id)).toEqual(['c0']);
  });

  it('ne compte ni les bots de l autre equipe ni les bots noirs', () => {
    let etat = avecJoueur(partie(), 'c1', CYAN, { x: 500, y: 500 });
    etat = avecBots(etat, 'c', CYAN, [{ x: 900, y: 500 }]);
    etat = avecBots(etat, 'm', MAGENTA, [{ x: 520, y: 500 }]);
    etat = ajouterBot(etat, { id: 'bn', type: 'botNoir', position: { x: 530, y: 500 } });

    expect(partDuJoueur(etat, joueurDe(etat, 'c1')).map((bot) => bot.id)).toEqual(['c0']);
  });

  it('est vide quand l equipe n a aucun bot', () => {
    const etat = avecJoueur(partie(), 'c1', CYAN, { x: 500, y: 500 });

    expect(partDuJoueur(etat, joueurDe(etat, 'c1'))).toEqual([]);
  });
});

describe('capturerEnEquipe', () => {
  /**
   * Un joueur Cyan contre deux Magenta. Magenta a cinq bots: deux pres de sa victime,
   * trois au loin. Sa part vaut donc deux bots, les deux proches.
   */
  function situation(): EtatPartie {
    let etat = avecJoueur(partie(), 'c1', CYAN, { x: 500, y: 500 });
    etat = avecJoueur(etat, 'm1', MAGENTA, { x: 510, y: 500 });
    etat = avecJoueur(etat, 'm2', MAGENTA, { x: 1800, y: 1300 });
    etat = avecBots(etat, 'c', CYAN, [{ x: 300, y: 1200 }]);
    return avecBots(etat, 'm', MAGENTA, [
      { x: 1500, y: 1000 },
      { x: 560, y: 500 },
      { x: 1600, y: 1000 },
      { x: 530, y: 500 },
      { x: 1700, y: 1000 },
    ]);
  }

  it('fait passer la part de la victime a l equipe de l attaquant, au plus pres d elle', () => {
    const apres = capturerEnEquipe(situation(), 'c1', 'm1');

    expect(botsDeCouleur(apres, CYAN)).toEqual(['c0', 'm1', 'm3']);
    expect(botsDeCouleur(apres, MAGENTA)).toEqual(['m0', 'm2', 'm4']);
  });

  it('laisse a la victime la couleur de son equipe, et la fait reapparaitre protegee', () => {
    const victime = joueurDe(capturerEnEquipe(situation(), 'c1', 'm1'), 'm1');

    expect(victime.couleur).toBe(MAGENTA);
    expect(victime.position).not.toEqual({ x: 510, y: 500 });
    expect(victime.protectionSpawnRestanteMs).toBe(DUREES.PROTECTION_SPAWN_MS);
    expect(victime.direction).toBe('immobile');
  });

  it('compte la capture a l attaquant et l inscrit au journal du battement', () => {
    const apres = capturerEnEquipe(situation(), 'c1', 'm1');
    const attaquant = joueurDe(apres, 'c1');

    expect(attaquant.captures).toBe(1);
    expect(attaquant.botsGagnesAuTotal).toBe(2);
    expect(attaquant.tempsDepuisDerniereCaptureMs).toBe(0);
    expect(apres.evenements).toEqual([
      {
        type: 'captureJoueur',
        attaquant: 'c1',
        victime: 'm1',
        botsTransferes: 2,
        nouvelleCouleurVictime: MAGENTA,
        position: { x: 510, y: 500 },
      },
    ]);
  });

  it('refuse une capture entre coequipiers', () => {
    const etat = situation();

    expect(capturerEnEquipe(etat, 'm2', 'm1')).toBe(etat);
  });

  it('epargne une victime protegee, et fait attendre le delai entre deux captures', () => {
    const protegee = regler(situation(), 'm1', { protectionSpawnRestanteMs: 1000 });
    const presse = regler(situation(), 'c1', { tempsDepuisDerniereCaptureMs: 0 });

    expect(capturerEnEquipe(protegee, 'c1', 'm1')).toBe(protegee);
    expect(capturerEnEquipe(presse, 'c1', 'm1')).toBe(presse);
  });

  it('repeint en un contre un exactement les bots que repeint le Classique', () => {
    let etat = avecJoueur(partie(), 'c1', CYAN, { x: 500, y: 500 });
    etat = avecJoueur(etat, 'm1', MAGENTA, { x: 510, y: 500 });
    etat = avecBots(etat, 'm', MAGENTA, [
      { x: 1500, y: 1000 },
      { x: 560, y: 500 },
      { x: 1600, y: 1000 },
    ]);

    expect(capturerEnEquipe(etat, 'c1', 'm1').bots).toEqual(capturerJoueur(etat, 'c1', 'm1').bots);
  });
});

describe('regleEquipes', () => {
  /** Resout les contacts de l'etat avec la regle du mode Equipes. */
  function resoudre(etat: EtatPartie): EtatPartie {
    return resoudreContacts(etat, detecterContacts(etat), regleEquipes);
  }

  it('capture au contact un adversaire, qui ne cede que sa part', () => {
    let etat = avecJoueur(partie(), 'c1', CYAN, { x: 500, y: 500 });
    etat = avecJoueur(etat, 'm1', MAGENTA, { x: 510, y: 500 });
    etat = avecJoueur(etat, 'm2', MAGENTA, { x: 1800, y: 1300 });
    // La victime vient de capturer: elle ne peut pas prendre l'attaquant en retour.
    etat = regler(etat, 'm1', { tempsDepuisDerniereCaptureMs: 0 });
    etat = avecBots(etat, 'm', MAGENTA, [
      { x: 1500, y: 1000 },
      { x: 1600, y: 1000 },
    ]);

    const apres = resoudre(etat);

    expect(joueurDe(apres, 'c1').captures).toBe(1);
    expect(botsDeCouleur(apres, CYAN)).toHaveLength(1);
    expect(joueurDe(apres, 'm1').couleur).toBe(MAGENTA);
  });

  it('ne fait rien entre deux coequipiers qui se touchent', () => {
    let etat = avecJoueur(partie(), 'c1', CYAN, { x: 500, y: 500 });
    etat = avecJoueur(etat, 'c2', CYAN, { x: 510, y: 500 });

    expect(resoudre(etat).joueurs).toEqual(etat.joueurs);
  });

  it('repeint a la couleur de son equipe le bot qu un joueur touche', () => {
    let etat = avecJoueur(partie(), 'c1', CYAN, { x: 500, y: 500 });
    etat = avecBots(etat, 'b', '#123456', [{ x: 505, y: 500 }]);

    expect(botsDeCouleur(resoudre(etat), CYAN)).toEqual(['b0']);
  });

  it('laisse les bots d une equipe retourner ceux de l autre', () => {
    let etat = avecJoueur(partie(), 'c1', CYAN, { x: 300, y: 300 });
    etat = avecJoueur(etat, 'm1', MAGENTA, { x: 1800, y: 1300 });
    etat = avecBots(etat, 'c', CYAN, [{ x: 1000, y: 1000 }]);
    etat = avecBots(etat, 'm', MAGENTA, [{ x: 1005, y: 1000 }]);

    expect(botsDeCouleur(resoudre(etat), CYAN)).toEqual(['c0', 'm0']);
  });
});

describe('le bot noir, en Equipes', () => {
  /**
   * Un bot noir a portee de bras d'un joueur Magenta. Son equipe a deux membres et six
   * bots: sa part en vaut trois, les trois plus proches de lui.
   */
  function situationDePrise(): EtatPartie {
    let etat = avecJoueur(partie(), 'm1', MAGENTA, { x: 510, y: 500 });
    etat = avecJoueur(etat, 'm2', MAGENTA, { x: 1800, y: 1300 });
    etat = avecBots(etat, 'm', MAGENTA, [
      { x: 1200, y: 900 },
      { x: 1300, y: 900 },
      { x: 580, y: 500 },
      { x: 1400, y: 900 },
      { x: 540, y: 500 },
      { x: 620, y: 500 },
    ]);
    return ajouterBot(etat, { id: 'bn', type: 'botNoir', position: { x: 500, y: 500 } });
  }

  it('fait perdre la part reglee de la part du joueur, au plus pres de lui', () => {
    // Cinquante pour cent de trois, arrondi en dessous: un bot, le plus proche.
    const apres = avancerLesBots(situationDePrise(), 0, perteEnEquipe);

    expect(botsDeCouleur(apres, COULEUR_BOT_NEUTRE)).toEqual(['m4']);
    expect(joueurDe(apres, 'm1').couleur).toBe(MAGENTA);
    expect(apres.evenements).toEqual([
      expect.objectContaining({ type: 'captureParBotNoir', victime: 'm1', botsPerdus: 1 }),
    ]);
  });

  it('se distingue de la perte du Classique, qui porte sur tous les bots de la couleur', () => {
    // Cinquante pour cent de six: trois bots, les premiers dans l'ordre de l'etat.
    const apres = avancerLesBots(situationDePrise(), 0);

    expect(botsDeCouleur(apres, COULEUR_BOT_NEUTRE)).toEqual(['m0', 'm1', 'm2']);
  });

  it('est la perte que le moteur applique a une partie Equipes', () => {
    const apres = tick(situationDePrise(), {}, 0);

    expect(botsDeCouleur(apres, COULEUR_BOT_NEUTRE)).toEqual(['m4']);
  });
});

describe('le malus, en Equipes', () => {
  /** Un joueur Cyan sur un malus, avec un coequipier et deux adversaires. */
  function situation(): EtatPartie {
    let etat = avecJoueur(partie(), 'c1', CYAN, { x: 500, y: 500 });
    etat = avecJoueur(etat, 'c2', CYAN, { x: 900, y: 900 });
    etat = avecJoueur(etat, 'm1', MAGENTA, { x: 1200, y: 900 });
    etat = avecJoueur(etat, 'm2', MAGENTA, { x: 1500, y: 900 });
    return poserObjet(etat, { categorie: 'malus', nature: 'flou', position: { x: 500, y: 500 } });
  }

  it('frappe l equipe adverse, et epargne le ramasseur et ses coequipiers', () => {
    const apres = ramasserLesObjets(situation(), malusEnEquipe);

    expect(joueurDe(apres, 'c1').malusRestantsMs.flou).toBe(0);
    expect(joueurDe(apres, 'c2').malusRestantsMs.flou).toBe(0);
    expect(joueurDe(apres, 'm1').malusRestantsMs.flou).toBeGreaterThan(0);
    expect(joueurDe(apres, 'm2').malusRestantsMs.flou).toBeGreaterThan(0);
    expect(apres.evenements).toEqual([
      expect.objectContaining({ type: 'malusRamasse', joueur: 'c1', victimes: ['m1', 'm2'] }),
    ]);
  });

  it('se distingue du malus du Classique, qui frappe aussi les coequipiers', () => {
    const apres = ramasserLesObjets(situation());

    expect(joueurDe(apres, 'c2').malusRestantsMs.flou).toBeGreaterThan(0);
  });

  it('est le malus que le moteur applique a une partie Equipes', () => {
    const apres = tick(situation(), {}, 0);

    expect(joueurDe(apres, 'c2').malusRestantsMs.flou).toBe(0);
    expect(joueurDe(apres, 'm1').malusRestantsMs.flou).toBeGreaterThan(0);
  });
});

describe('changerDeCouleur', () => {
  it('change la couleur du joueur et rien d autre, a sa place dans la table', () => {
    let etat = avecJoueur(partie(), 'a', CYAN, { x: 500, y: 500 });
    etat = avecJoueur(etat, 'b', CYAN, { x: 900, y: 500 });
    etat = avecJoueur(etat, 'c', MAGENTA, { x: 1300, y: 500 });

    const apres = changerDeCouleur(etat, 'a', MAGENTA);

    expect(Object.keys(apres.joueurs)).toEqual(['a', 'b', 'c']);
    expect(joueurDe(apres, 'a')).toEqual({ ...joueurDe(etat, 'a'), couleur: MAGENTA });
    expect(apres.joueurs['b']).toBe(etat.joueurs['b']);
  });

  it('ne fait rien pour un joueur absent de la partie', () => {
    const etat = partie();

    expect(changerDeCouleur(etat, 'fantome', CYAN)).toBe(etat);
  });
});

describe('les couleurs d equipe et le monde', () => {
  it('ne font jamais naitre un bot, ni ne sortent d une zone de chaos', () => {
    // Une zone de chaos repeint un bot par couleurUnique, en evitant les couleurs des
    // joueurs presents: celles des deux equipes.
    for (let graine = 1; graine <= 200; graine += 1) {
      const alea = creerAlea(graine);

      expect([CYAN, MAGENTA]).not.toContain(couleurDeBot(alea, [CYAN, MAGENTA]).valeur);
      expect([CYAN, MAGENTA]).not.toContain(couleurUnique(alea, [CYAN, CYAN, MAGENTA]).valeur);
    }
  });
});

describe('le mode Equipes dans le moteur', () => {
  it('a son jeu de regles, qui n agit pas sur les entrees', () => {
    const regles = REGLES_DES_MODES.equipes;
    const etat = avecJoueur(partie(), 'c1', CYAN, { x: 500, y: 500 });

    expect(regles.resoudreContacts).toBe(regleEquipes);
    expect(regles.perteFaceAuBotNoir).toBe(perteEnEquipe);
    expect(regles.victimeDuMalus).toBe(malusEnEquipe);
    expect(regles.agir(etat, {}, 50)).toBe(etat);
  });

  it('joue a l identique deux parties de meme graine et de memes entrees', () => {
    /** Une partie animee: deux contre deux, des bots, et tous les objets par defaut. */
    function depart(): EtatPartie {
      let etat = creerEtatInitial({ graine: 42, mode: 'equipes' });
      etat = ajouterJoueur(etat, { id: 'c1', pseudo: 'c1', couleur: CYAN });
      etat = ajouterJoueur(etat, { id: 'c2', pseudo: 'c2', couleur: CYAN });
      etat = ajouterJoueur(etat, { id: 'm1', pseudo: 'm1', couleur: MAGENTA });
      etat = ajouterJoueur(etat, { id: 'm2', pseudo: 'm2', couleur: MAGENTA });
      for (let rang = 0; rang < 60; rang += 1) {
        etat = ajouterBot(etat, { id: `b${String(rang)}`, couleur: '#123456' });
      }
      return etat;
    }

    const entrees: Entrees = {
      c1: { deplacement: { x: 1, y: 0 }, enMouvement: true },
      c2: { deplacement: { x: 0, y: 1 }, enMouvement: true },
      m1: { deplacement: { x: -1, y: 0 }, enMouvement: true },
      m2: { deplacement: { x: 0, y: -1 }, enMouvement: true },
    };

    let une = depart();
    let autre = depart();
    for (let battement = 0; battement < 200; battement += 1) {
      une = tick(une, entrees, 50);
      autre = tick(autre, entrees, 50);
    }

    expect(une).toEqual(autre);
    expect(une.tick).toBe(200);
  });
});
