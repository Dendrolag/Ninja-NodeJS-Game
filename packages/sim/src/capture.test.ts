/**
 * Tests des captures.
 *
 * La reference de comportement est tests/caracterisation/capture.test.ts, qui
 * s'execute contre le legacy. Les scenarios ci-dessous en sont l'equivalent
 * ecrit contre le moteur pur: memes situations, memes attentes, sans horloge ni
 * socket.
 */

import { COULEUR_BOT_NEUTRE, COULEUR_BOT_NOIR, DUREES, SCORE } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { captureAutorisee, capturerBot, capturerJoueur, detruireBotNoir } from './capture.js';
import type { Couleur } from './couleurs.js';
import type { EtatPartie, IdentifiantEntite, Joueur } from './etat.js';
import { ajouterBot, ajouterJoueur, creerEtatInitial } from './etat.js';

const ROUGE = '#FF0000';
const BLEU = '#0000FF';
const VERT = '#00FF00';

/** Lit un joueur dont on sait qu'il est present. */
function joueurDe(etat: EtatPartie, id: IdentifiantEntite): Joueur {
  const joueur = etat.joueurs[id];
  if (joueur === undefined) {
    throw new Error(`Le joueur ${id} devrait etre dans la partie.`);
  }
  return joueur;
}

/** Change quelques champs d'un joueur, pour poser une situation de depart. */
function reglerJoueur(
  etat: EtatPartie,
  id: IdentifiantEntite,
  champs: Partial<Joueur>,
): EtatPartie {
  return { ...etat, joueurs: { ...etat.joueurs, [id]: { ...joueurDe(etat, id), ...champs } } };
}

/** Sort un joueur de sa protection d'apparition, comme le fait le temps qui passe. */
function pret(etat: EtatPartie, ...ids: readonly IdentifiantEntite[]): EtatPartie {
  return ids.reduce(
    (courant, id) => reglerJoueur(courant, id, { protectionSpawnRestanteMs: 0 }),
    etat,
  );
}

/** Combien de bots ordinaires portent chaque couleur. */
function botsParCouleur(etat: EtatPartie): Record<Couleur, number> {
  const compte: Record<Couleur, number> = {};
  for (const bot of Object.values(etat.bots)) {
    if (bot.type === 'bot') {
      compte[bot.couleur] = (compte[bot.couleur] ?? 0) + 1;
    }
  }
  return compte;
}

/**
 * Situation de base, calquee sur la caracterisation: deux joueurs face a face,
 * trois bots a la victime, deux a l'attaquant, un neutre. Les deux joueurs sont
 * sortis de leur protection d'apparition.
 */
function situationDeDepart(): EtatPartie {
  let etat = creerEtatInitial({ graine: 7 });

  etat = ajouterJoueur(etat, {
    id: 'a',
    pseudo: 'Attaquant',
    couleur: ROUGE,
    position: { x: 500, y: 500 },
  });
  etat = ajouterJoueur(etat, {
    id: 'v',
    pseudo: 'Victime',
    couleur: BLEU,
    position: { x: 510, y: 500 },
  });

  const bots: readonly (readonly [string, Couleur])[] = [
    ['b1', BLEU],
    ['b2', BLEU],
    ['b3', BLEU],
    ['b4', ROUGE],
    ['b5', ROUGE],
    ['b6', VERT],
  ];
  for (const [index, [id, couleur]] of bots.entries()) {
    etat = ajouterBot(etat, { id, couleur, position: { x: 100 + index * 100, y: 100 } });
  }

  return pret(etat, 'a', 'v');
}

describe('captureAutorisee', () => {
  it('autorise deux joueurs de couleurs differentes, prets et exposes', () => {
    const etat = situationDeDepart();

    expect(captureAutorisee(joueurDe(etat, 'a'), joueurDe(etat, 'v'))).toBe(true);
  });

  it('refuse deux joueurs de la meme couleur', () => {
    const etat = reglerJoueur(situationDeDepart(), 'v', { couleur: ROUGE });

    expect(captureAutorisee(joueurDe(etat, 'a'), joueurDe(etat, 'v'))).toBe(false);
  });

  it('refuse de se capturer soi-meme', () => {
    const etat = situationDeDepart();

    expect(captureAutorisee(joueurDe(etat, 'a'), joueurDe(etat, 'a'))).toBe(false);
  });
});

describe('capturerJoueur', () => {
  it('transfere tous les bots de la victime a l attaquant, d un seul coup', () => {
    const apres = capturerJoueur(situationDeDepart(), 'a', 'v');

    // Les trois bots bleus passent au rouge. Les autres ne bougent pas.
    expect(botsParCouleur(apres)).toEqual({ [ROUGE]: 5, [VERT]: 1 });
  });

  it('inscrit la capture dans l historique des deux joueurs', () => {
    const apres = capturerJoueur(situationDeDepart(), 'a', 'v');

    expect(joueurDe(apres, 'a').joueursCaptures).toEqual({ v: { pseudo: 'Victime', nombre: 1 } });
    expect(joueurDe(apres, 'v').capturesSubies).toEqual({ a: { pseudo: 'Attaquant', nombre: 1 } });
    expect(joueurDe(apres, 'a').captures).toBe(1);
  });

  it('cumule les captures repetees du meme joueur dans le meme historique', () => {
    const premiere = capturerJoueur(situationDeDepart(), 'a', 'v');

    // Il faut a la fois rendre l'attaquant a nouveau capable de capturer et
    // sortir la victime de la protection acquise a sa reapparition.
    let entre = reglerJoueur(premiere, 'a', {
      tempsDepuisDerniereCaptureMs: DUREES.DELAI_ENTRE_CAPTURES_MS + 1,
    });
    entre = reglerJoueur(entre, 'v', { couleur: BLEU, protectionSpawnRestanteMs: 0 });

    const seconde = capturerJoueur(entre, 'a', 'v');

    expect(joueurDe(seconde, 'a').joueursCaptures['v']).toEqual({ pseudo: 'Victime', nombre: 2 });
    expect(joueurDe(seconde, 'v').capturesSubies['a']).toEqual({ pseudo: 'Attaquant', nombre: 2 });
    expect(joueurDe(seconde, 'a').captures).toBe(2);
  });

  it('compte les bots gagnes dans le cumul personnel de l attaquant', () => {
    const apres = capturerJoueur(situationDeDepart(), 'a', 'v');

    expect(joueurDe(apres, 'a').botsGagnesAuTotal).toBe(3);
  });

  it('fait reapparaitre la victime ailleurs, avec une nouvelle couleur et une protection neuve', () => {
    const avant = situationDeDepart();
    const apres = capturerJoueur(avant, 'a', 'v');
    const victime = joueurDe(apres, 'v');

    expect(victime.couleur).not.toBe(BLEU);
    expect(victime.couleur).not.toBe(ROUGE);
    expect(victime.position).not.toEqual(joueurDe(avant, 'v').position);
    expect(victime.protectionSpawnRestanteMs).toBe(DUREES.PROTECTION_SPAWN_MS);
    expect(victime.direction).toBe('immobile');
  });

  it('remet le compteur de capture de l attaquant a zero', () => {
    const apres = capturerJoueur(situationDeDepart(), 'a', 'v');

    expect(joueurDe(apres, 'a').tempsDepuisDerniereCaptureMs).toBe(0);
  });

  it('depose un evenement decrivant la capture pour le futur client', () => {
    const avant = situationDeDepart();
    const apres = capturerJoueur(avant, 'a', 'v');

    expect(apres.evenements).toEqual([
      {
        type: 'captureJoueur',
        attaquant: 'a',
        victime: 'v',
        botsTransferes: 3,
        nouvelleCouleurVictime: joueurDe(apres, 'v').couleur,
        position: joueurDe(avant, 'v').position,
      },
    ]);
  });

  it('ne modifie pas l etat recu', () => {
    const avant = situationDeDepart();
    const copie = structuredClone({ joueurs: avant.joueurs, bots: avant.bots });

    capturerJoueur(avant, 'a', 'v');

    expect({ joueurs: avant.joueurs, bots: avant.bots }).toEqual(copie);
  });

  it('ne touche pas aux bots noirs, qui n appartiennent a personne', () => {
    let etat = situationDeDepart();
    etat = ajouterBot(etat, { id: 'bn', type: 'botNoir', position: { x: 1000, y: 1000 } });

    const apres = capturerJoueur(etat, 'a', 'v');

    expect(apres.bots['bn']?.couleur).toBe(COULEUR_BOT_NOIR);
  });
});

describe('refus de capture', () => {
  /** Verifie qu'aucune capture n'a eu lieu: ni transfert, ni compteur, ni evenement. */
  function rienNAEuLieu(etat: EtatPartie): void {
    expect(botsParCouleur(etat)).toEqual({ [BLEU]: 3, [ROUGE]: 2, [VERT]: 1 });
    expect(joueurDe(etat, 'a').captures).toBe(0);
    expect(joueurDe(etat, 'v').capturesSubies).toEqual({});
    expect(etat.evenements).toEqual([]);
  }

  it('refuse quand la victime porte le bonus d invincibilite', () => {
    const etat = reglerJoueur(situationDeDepart(), 'v', { invincibiliteActive: true });

    rienNAEuLieu(capturerJoueur(etat, 'a', 'v'));
  });

  it('refuse quand la victime est encore protegee par son apparition', () => {
    const etat = reglerJoueur(situationDeDepart(), 'v', { protectionSpawnRestanteMs: 1 });

    rienNAEuLieu(capturerJoueur(etat, 'a', 'v'));
  });

  it('refuse tant que le delai entre deux captures n est pas ecoule', () => {
    const etat = reglerJoueur(situationDeDepart(), 'a', { tempsDepuisDerniereCaptureMs: 0 });

    rienNAEuLieu(capturerJoueur(etat, 'a', 'v'));
  });

  it('refuse encore a exactement une seconde, et accepte juste apres', () => {
    // Le legacy teste une inegalite stricte: Date.now() - lastCapture > 1000.
    const pile = reglerJoueur(situationDeDepart(), 'a', {
      tempsDepuisDerniereCaptureMs: DUREES.DELAI_ENTRE_CAPTURES_MS,
    });
    expect(joueurDe(capturerJoueur(pile, 'a', 'v'), 'a').captures).toBe(0);

    const juste = reglerJoueur(pile, 'a', {
      tempsDepuisDerniereCaptureMs: DUREES.DELAI_ENTRE_CAPTURES_MS + 1,
    });
    expect(joueurDe(capturerJoueur(juste, 'a', 'v'), 'a').captures).toBe(1);
  });

  it('refuse entre deux joueurs de la meme couleur', () => {
    // Le legacy verifiait cela dans la detection, pas dans la capture: appelee
    // directement, sa fonction comptait une capture et « transferait » a
    // l'attaquant ses propres bots. Ici la verification ne peut plus etre omise.
    const etat = reglerJoueur(situationDeDepart(), 'v', { couleur: ROUGE });

    expect(capturerJoueur(etat, 'a', 'v')).toBe(etat);
  });

  it('refuse quand l un des deux joueurs n existe pas', () => {
    const etat = situationDeDepart();

    expect(capturerJoueur(etat, 'a', 'inconnu')).toBe(etat);
    expect(capturerJoueur(etat, 'inconnu', 'v')).toBe(etat);
  });
});

describe('capturerBot', () => {
  it('repeint le bot a la couleur du joueur', () => {
    let etat = situationDeDepart();
    etat = ajouterBot(etat, { id: 'proche', couleur: BLEU, position: { x: 519, y: 500 } });

    expect(capturerBot(etat, 'a', 'proche').bots['proche']?.couleur).toBe(ROUGE);
  });

  it('repeint aussi un bot neutre', () => {
    let etat = situationDeDepart();
    etat = ajouterBot(etat, { id: 'neutre', position: { x: 800, y: 800 } });
    expect(etat.bots['neutre']?.couleur).toBe(COULEUR_BOT_NEUTRE);

    expect(capturerBot(etat, 'a', 'neutre').bots['neutre']?.couleur).toBe(ROUGE);
  });

  it('propage la couleur d un bot a un autre bot au contact', () => {
    let etat = situationDeDepart();
    etat = ajouterBot(etat, { id: 'c1', couleur: ROUGE, position: { x: 800, y: 800 } });
    etat = ajouterBot(etat, { id: 'c2', couleur: BLEU, position: { x: 810, y: 800 } });

    expect(capturerBot(etat, 'c1', 'c2').bots['c2']?.couleur).toBe(ROUGE);
  });

  it('ne fait rien quand les deux portent deja la meme couleur', () => {
    const etat = situationDeDepart();

    expect(capturerBot(etat, 'a', 'b4')).toBe(etat);
  });

  it('ne repeint jamais un bot noir', () => {
    let etat = situationDeDepart();
    etat = ajouterBot(etat, { id: 'bn', type: 'botNoir', position: { x: 505, y: 500 } });

    expect(capturerBot(etat, 'a', 'bn')).toBe(etat);
  });

  it('ne fait rien quand une des deux entites n existe pas', () => {
    const etat = situationDeDepart();

    expect(capturerBot(etat, 'a', 'inconnu')).toBe(etat);
    expect(capturerBot(etat, 'inconnu', 'b1')).toBe(etat);
  });
});

describe('detruireBotNoir', () => {
  /** La situation de base, plus un bot noir au contact de l'attaquant. */
  function avecBotNoir(invincible: boolean): EtatPartie {
    const etat = ajouterBot(situationDeDepart(), {
      id: 'bn',
      type: 'botNoir',
      position: { x: 505, y: 500 },
    });

    return reglerJoueur(etat, 'a', { invincibiliteActive: invincible });
  }

  it('supprime le bot noir et cree quinze points pour le joueur invincible', () => {
    const apres = detruireBotNoir(avecBotNoir(true), 'a', 'bn');

    expect(apres.bots['bn']).toBeUndefined();
    expect(joueurDe(apres, 'a').botsNoirsDetruits).toBe(1);
    expect(apres.evenements).toEqual([
      {
        type: 'botNoirDetruit',
        joueur: 'a',
        botNoir: 'bn',
        position: { x: 505, y: 500 },
        points: SCORE.POINTS_PAR_BOT_NOIR,
      },
    ]);
  });

  it('ne detruit rien si le joueur n est pas invincible', () => {
    const etat = avecBotNoir(false);

    expect(detruireBotNoir(etat, 'a', 'bn')).toBe(etat);
  });

  it('ne suffit pas d etre protege par son apparition', () => {
    // Le legacy testait invincibilityActive, pas isInvulnerable: la protection
    // de trois secondes epargne le joueur, elle ne detruit pas les bots noirs.
    const etat = reglerJoueur(avecBotNoir(false), 'a', {
      protectionSpawnRestanteMs: DUREES.PROTECTION_SPAWN_MS,
    });

    expect(detruireBotNoir(etat, 'a', 'bn')).toBe(etat);
  });

  it('ne detruit pas un bot ordinaire', () => {
    const etat = avecBotNoir(true);

    expect(detruireBotNoir(etat, 'a', 'b1')).toBe(etat);
  });

  it('ne fait rien quand une des deux entites n existe pas', () => {
    const etat = avecBotNoir(true);

    expect(detruireBotNoir(etat, 'a', 'inconnu')).toBe(etat);
    expect(detruireBotNoir(etat, 'inconnu', 'bn')).toBe(etat);
  });
});
