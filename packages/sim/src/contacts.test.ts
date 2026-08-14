/**
 * Tests du releve des contacts entre entites, et de la regle qui en tire les
 * consequences.
 *
 * Le seuil et son inegalite stricte viennent de la caracterisation du legacy:
 * a vingt pixels pile il n'y a pas contact, juste en dessous il y en a un.
 */

import { describe, expect, it } from 'vitest';

import {
  SEUIL_CONTACT_PX,
  detecterContacts,
  regleClassique,
  resoudreContacts,
} from './contacts.js';
import type { Couleur } from './couleurs.js';
import type { EtatPartie, IdentifiantEntite, Joueur } from './etat.js';
import { ajouterBot, ajouterJoueur, creerEtatInitial } from './etat.js';

const ROUGE = '#FF0000';
const BLEU = '#0000FF';
const VERT = '#00FF00';

/** Partie peuplee de joueurs places ou on veut. */
function partieAvec(places: Readonly<Record<string, { x: number; y: number }>>): EtatPartie {
  let etat = creerEtatInitial({ graine: 1 });
  let teinte = 0;
  for (const [id, position] of Object.entries(places)) {
    teinte += 1;
    etat = ajouterJoueur(etat, {
      id,
      pseudo: id,
      position,
      couleur: `#00000${teinte}`,
    });
  }
  return etat;
}

/** Change quelques champs d'un joueur, pour poser une situation de depart. */
function reglerJoueur(
  etat: EtatPartie,
  id: IdentifiantEntite,
  champs: Partial<Joueur>,
): EtatPartie {
  const joueur = etat.joueurs[id];
  if (joueur === undefined) {
    throw new Error(`Le joueur ${id} devrait etre dans la partie.`);
  }

  return { ...etat, joueurs: { ...etat.joueurs, [id]: { ...joueur, ...champs } } };
}

/**
 * Une partie ou les joueurs demandes sont poses avec leur couleur, prets a
 * capturer: plus de protection d'apparition, plus de delai entre captures.
 */
function joueursPrets(
  graine: number,
  joueurs: readonly (readonly [string, Couleur, { x: number; y: number }])[],
): EtatPartie {
  let etat = creerEtatInitial({ graine });

  for (const [id, couleur, position] of joueurs) {
    etat = ajouterJoueur(etat, { id, pseudo: id, couleur, position });
    etat = reglerJoueur(etat, id, { protectionSpawnRestanteMs: 0 });
  }

  return etat;
}

/** Resout tous les contacts de l'etat, comme le fait le moteur en fin de battement. */
function resoudre(etat: EtatPartie): EtatPartie {
  return resoudreContacts(etat, detecterContacts(etat));
}

describe('detecterContacts', () => {
  it('ne releve rien quand tout le monde est au large', () => {
    const etat = partieAvec({ j1: { x: 500, y: 500 }, j2: { x: 900, y: 900 } });

    expect(detecterContacts(etat)).toEqual([]);
  });

  it('releve un contact juste en dessous du seuil', () => {
    const etat = partieAvec({ j1: { x: 500, y: 500 }, j2: { x: 519, y: 500 } });
    const contacts = detecterContacts(etat);

    expect(contacts).toHaveLength(1);
    expect(contacts[0]?.distance).toBe(19);
  });

  it('ne releve rien a exactement vingt pixels', () => {
    const etat = partieAvec({ j1: { x: 500, y: 500 }, j2: { x: 500 + SEUIL_CONTACT_PX, y: 500 } });

    expect(detecterContacts(etat)).toEqual([]);
  });

  it('ne fait pas se toucher une entite avec elle-meme', () => {
    const etat = partieAvec({ j1: { x: 500, y: 500 } });

    expect(detecterContacts(etat)).toEqual([]);
  });

  it('ne compte chaque paire qu une fois, meme superposee', () => {
    const etat = partieAvec({ j1: { x: 500, y: 500 }, j2: { x: 500, y: 500 } });
    const contacts = detecterContacts(etat);

    expect(contacts).toHaveLength(1);
    expect(contacts[0]?.distance).toBe(0);
  });

  it('releve toutes les paires d un groupe serre', () => {
    const etat = partieAvec({
      j1: { x: 500, y: 500 },
      j2: { x: 505, y: 500 },
      j3: { x: 500, y: 505 },
    });

    expect(detecterContacts(etat)).toHaveLength(3);
  });

  it('donne toujours le meme releve pour le meme etat', () => {
    const etat = partieAvec({
      j1: { x: 500, y: 500 },
      j2: { x: 505, y: 500 },
      j3: { x: 900, y: 900 },
    });

    expect(detecterContacts(etat)).toEqual(detecterContacts(etat));
  });

  it('ne change rien a l etat', () => {
    const etat = partieAvec({ j1: { x: 500, y: 500 }, j2: { x: 505, y: 500 } });
    const avant = structuredClone({ joueurs: etat.joueurs, tick: etat.tick });

    detecterContacts(etat);

    expect({ joueurs: etat.joueurs, tick: etat.tick }).toEqual(avant);
  });
});

describe('detecterContacts, avec des bots', () => {
  it('releve le contact entre un joueur et un bot', () => {
    let etat = partieAvec({ j1: { x: 500, y: 500 } });
    etat = ajouterBot(etat, { id: 'b1', position: { x: 505, y: 500 } });

    expect(detecterContacts(etat)).toEqual([{ premier: 'j1', second: 'b1', distance: 5 }]);
  });

  it('releve le contact entre deux bots', () => {
    let etat = creerEtatInitial({ graine: 1 });
    etat = ajouterBot(etat, { id: 'b1', position: { x: 500, y: 500 } });
    etat = ajouterBot(etat, { id: 'b2', position: { x: 505, y: 500 } });

    expect(detecterContacts(etat)).toHaveLength(1);
  });

  it('place toujours les joueurs avant les bots dans le releve', () => {
    let etat = creerEtatInitial({ graine: 1 });
    etat = ajouterBot(etat, { id: 'b1', position: { x: 500, y: 500 } });
    etat = ajouterJoueur(etat, { id: 'j1', pseudo: 'j1', position: { x: 505, y: 500 } });

    expect(detecterContacts(etat)[0]?.premier).toBe('j1');
  });
});

describe('regleClassique, contacts avec des bots', () => {
  it('repeint un bot touche par un joueur', () => {
    let etat = joueursPrets(1, [['j1', ROUGE, { x: 500, y: 500 }]]);
    etat = ajouterBot(etat, { id: 'b1', couleur: BLEU, position: { x: 519, y: 500 } });

    expect(resoudre(etat).bots['b1']?.couleur).toBe(ROUGE);
  });

  it('ne repeint pas un bot situe exactement au seuil', () => {
    let etat = joueursPrets(1, [['j1', ROUGE, { x: 500, y: 500 }]]);
    etat = ajouterBot(etat, {
      id: 'b1',
      couleur: BLEU,
      position: { x: 500 + SEUIL_CONTACT_PX, y: 500 },
    });

    expect(resoudre(etat).bots['b1']?.couleur).toBe(BLEU);
  });

  it('laisse le bot le plus ancien repeindre l autre', () => {
    let etat = creerEtatInitial({ graine: 1 });
    etat = ajouterBot(etat, { id: 'ancien', couleur: ROUGE, position: { x: 500, y: 500 } });
    etat = ajouterBot(etat, { id: 'recent', couleur: BLEU, position: { x: 505, y: 500 } });

    const apres = resoudre(etat);
    expect(apres.bots['recent']?.couleur).toBe(ROUGE);
    expect(apres.bots['ancien']?.couleur).toBe(ROUGE);
  });

  it('resout un contact quel que soit l ordre des deux entites', () => {
    // detecterContacts range toujours les joueurs en premier, mais la regle ne
    // s'appuie pas sur cette convention: elle regarde la nature des entites, pas
    // leur rang. Un appelant qui construit sa propre liste obtient le meme
    // resultat.
    let etat = joueursPrets(1, [['j1', ROUGE, { x: 500, y: 500 }]]);
    etat = ajouterBot(etat, { id: 'b1', couleur: BLEU, position: { x: 505, y: 500 } });

    const alEnvers = regleClassique(etat, [{ premier: 'b1', second: 'j1', distance: 5 }]);

    expect(alEnvers.bots['b1']?.couleur).toBe(ROUGE);
  });

  it('detruit le bot noir touche par un joueur invincible', () => {
    let etat = joueursPrets(1, [['j1', ROUGE, { x: 500, y: 500 }]]);
    etat = reglerJoueur(etat, 'j1', { invincibiliteActive: true });
    etat = ajouterBot(etat, { id: 'bn', type: 'botNoir', position: { x: 505, y: 500 } });

    const apres = resoudre(etat);
    expect(apres.bots['bn']).toBeUndefined();
    expect(apres.joueurs['j1']?.botsNoirsDetruits).toBe(1);
  });

  it('ne fait rien quand un joueur ordinaire touche un bot noir', () => {
    // La capture du joueur par le bot noir appartient au comportement du bot
    // noir, donc a l'etape 1.5.
    let etat = joueursPrets(1, [['j1', ROUGE, { x: 500, y: 500 }]]);
    etat = ajouterBot(etat, { id: 'bn', type: 'botNoir', position: { x: 505, y: 500 } });

    const apres = resoudre(etat);
    expect(apres.bots['bn']).toBeDefined();
    expect(apres.evenements).toEqual([]);
  });

  it('ignore un contact dont le bot noir a deja ete detruit dans le meme battement', () => {
    // Deux joueurs invincibles sur le meme bot noir: le second contact porte sur
    // une entite qui n'existe plus, et il ne doit rien produire.
    let etat = joueursPrets(1, [
      ['j1', ROUGE, { x: 500, y: 500 }],
      ['j2', BLEU, { x: 505, y: 500 }],
    ]);
    etat = reglerJoueur(etat, 'j1', { invincibiliteActive: true });
    etat = reglerJoueur(etat, 'j2', { invincibiliteActive: true });
    etat = ajouterBot(etat, { id: 'bn', type: 'botNoir', position: { x: 502, y: 500 } });

    const apres = resoudre(etat);
    expect(apres.joueurs['j1']?.botsNoirsDetruits).toBe(1);
    expect(apres.joueurs['j2']?.botsNoirsDetruits).toBe(0);
    expect(apres.evenements).toHaveLength(1);
  });
});

describe('regleClassique, duel entre deux joueurs', () => {
  it('ne fait rien quand aucun des deux n a le droit de capturer', () => {
    // Situation de depart d'une partie: tout le monde est encore protege.
    const etat = partieAvec({ j1: { x: 500, y: 500 }, j2: { x: 505, y: 500 } });

    expect(resoudre(etat)).toBe(etat);
  });

  it('designe attaquant le seul des deux qui en a le droit', () => {
    // j2 vient de capturer quelqu'un: son delai n'est pas ecoule, il ne peut pas
    // recommencer. j1, lui, le peut.
    let etat = joueursPrets(1, [
      ['j1', ROUGE, { x: 500, y: 500 }],
      ['j2', BLEU, { x: 505, y: 500 }],
    ]);
    etat = reglerJoueur(etat, 'j2', { tempsDepuisDerniereCaptureMs: 0 });

    const apres = resoudre(etat);
    expect(apres.joueurs['j1']?.captures).toBe(1);
    expect(apres.joueurs['j2']?.captures).toBe(0);
  });

  it('designe attaquant le second quand le premier ne peut pas capturer', () => {
    let etat = joueursPrets(1, [
      ['j1', ROUGE, { x: 500, y: 500 }],
      ['j2', BLEU, { x: 505, y: 500 }],
    ]);
    etat = reglerJoueur(etat, 'j1', { tempsDepuisDerniereCaptureMs: 0 });

    const apres = resoudre(etat);
    expect(apres.joueurs['j2']?.captures).toBe(1);
    expect(apres.joueurs['j1']?.captures).toBe(0);
  });

  it('ne produit jamais qu une seule capture par paire', () => {
    // Sans regle explicite, la victime tout juste capturee capturerait son
    // attaquant en retour dans le meme battement.
    const etat = joueursPrets(1, [
      ['j1', ROUGE, { x: 500, y: 500 }],
      ['j2', BLEU, { x: 505, y: 500 }],
    ]);

    const apres = resoudre(etat);
    const total = (apres.joueurs['j1']?.captures ?? 0) + (apres.joueurs['j2']?.captures ?? 0);
    expect(total).toBe(1);
    expect(apres.evenements).toHaveLength(1);
  });

  it('tire au sort quand les deux peuvent capturer, et le tirage depend de la graine', () => {
    // La preuve que le duel n'est pas gagne d'avance par le premier arrive: sur
    // un echantillon de graines, les deux issues se produisent.
    const vainqueurs = new Set<string>();
    for (let graine = 1; graine <= 20; graine += 1) {
      const apres = resoudre(
        joueursPrets(graine, [
          ['j1', ROUGE, { x: 500, y: 500 }],
          ['j2', BLEU, { x: 505, y: 500 }],
        ]),
      );
      vainqueurs.add(apres.joueurs['j1']?.captures === 1 ? 'j1' : 'j2');
    }

    expect(vainqueurs).toEqual(new Set(['j1', 'j2']));
  });

  it('rejoue le meme duel a l identique pour la meme graine', () => {
    const resultat = (): unknown => {
      const apres = resoudre(
        joueursPrets(42, [
          ['j1', ROUGE, { x: 500, y: 500 }],
          ['j2', BLEU, { x: 505, y: 500 }],
        ]),
      );
      // On compare les joueurs et le journal, pas l'etat entier: le terrain pese
      // plusieurs centaines de kilo-octets et n'a pas change.
      return { joueurs: apres.joueurs, evenements: apres.evenements, alea: apres.alea };
    };

    expect(resultat()).toEqual(resultat());
  });

  it('ne capture pas un joueur de meme couleur', () => {
    const etat = joueursPrets(1, [
      ['j1', ROUGE, { x: 500, y: 500 }],
      ['j2', ROUGE, { x: 505, y: 500 }],
    ]);

    expect(resoudre(etat)).toBe(etat);
  });
});

describe('regleClassique, plusieurs contacts dans le meme battement', () => {
  it('resout deux captures independantes dans le meme battement', () => {
    const etat = joueursPrets(5, [
      ['a', ROUGE, { x: 500, y: 500 }],
      ['v', BLEU, { x: 505, y: 500 }],
      ['b', VERT, { x: 1500, y: 1000 }],
      ['w', '#FFFF00', { x: 1505, y: 1000 }],
    ]);

    const apres = resoudre(etat);
    expect(apres.evenements).toHaveLength(2);
  });

  it('ecarte les contacts d une victime deja replacee ailleurs', () => {
    // Trois joueurs en tas: trois paires sont relevees. La premiere capture
    // teleporte la victime, donc les deux paires qui la concernaient encore ne
    // decrivent plus rien de reel.
    const etat = joueursPrets(5, [
      ['j1', ROUGE, { x: 500, y: 500 }],
      ['j2', BLEU, { x: 503, y: 500 }],
      ['j3', VERT, { x: 500, y: 503 }],
    ]);
    expect(detecterContacts(etat)).toHaveLength(3);

    const apres = resoudre(etat);
    const captures = apres.evenements.filter((evenement) => evenement.type === 'captureJoueur');

    // Les trois paires ne peuvent pas toutes se resoudre, et surtout: un joueur
    // deja capture, donc replace a l'autre bout de la carte, ne capture plus
    // personne ensuite. L'inverse reste possible et voulu: un joueur peut en
    // capturer un puis se faire capturer par un troisieme dans le meme
    // battement, comme dans une melee a trois.
    expect(captures.length).toBeLessThan(3);

    const dejaReplacees = new Set<IdentifiantEntite>();
    for (const capture of captures) {
      expect(dejaReplacees.has(capture.attaquant)).toBe(false);
      dejaReplacees.add(capture.victime);
    }
  });

  it('ne laisse jamais un joueur etre capture deux fois dans le meme battement', () => {
    const etat = joueursPrets(9, [
      ['j1', ROUGE, { x: 500, y: 500 }],
      ['j2', BLEU, { x: 503, y: 500 }],
      ['j3', VERT, { x: 500, y: 503 }],
    ]);

    const victimes = resoudre(etat)
      .evenements.filter((evenement) => evenement.type === 'captureJoueur')
      .map((evenement) => evenement.victime);

    expect(new Set(victimes).size).toBe(victimes.length);
  });
});

describe('resoudreContacts', () => {
  it('applique la regle du mode Classique par defaut', () => {
    const etat = joueursPrets(1, [
      ['j1', ROUGE, { x: 500, y: 500 }],
      ['j2', BLEU, { x: 505, y: 500 }],
    ]);
    const contacts = detecterContacts(etat);

    expect(resoudreContacts(etat, contacts)).toEqual(regleClassique(etat, contacts));
  });

  it('accepte une autre regle, sans qu aucune autre ligne du moteur ne change', () => {
    // Le point d'extension du moteur: un mode de jeu futur, capture par cone par
    // exemple, s'ecrit comme une fonction de ce type. On verifie seulement que
    // le branchement existe, on ne construit pas cet autre mode ici.
    const etat = joueursPrets(1, [
      ['j1', ROUGE, { x: 500, y: 500 }],
      ['j2', BLEU, { x: 505, y: 500 }],
    ]);

    const regleQuiNeCapturePas = (courant: EtatPartie): EtatPartie => courant;

    expect(resoudreContacts(etat, detecterContacts(etat), regleQuiNeCapturePas)).toBe(etat);
  });

  it('ne change rien quand il n y a aucun contact', () => {
    const etat = joueursPrets(1, [
      ['j1', ROUGE, { x: 500, y: 500 }],
      ['j2', BLEU, { x: 900, y: 900 }],
    ]);

    expect(resoudre(etat)).toBe(etat);
  });
});
