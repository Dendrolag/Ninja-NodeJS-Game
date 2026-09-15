/**
 * Caracterisation du domaine CAPTURE.
 *
 * Perimetre, repris de la fiche docs/plan/etape-0-2.md:
 *   - handlePlayerCapture (legacy/server.js:737): capture d'un joueur par un
 *     autre, transfert des bots, historiques des deux cotes, refus de capture.
 *   - la capture de bot ecrite en ligne dans detectCollisions
 *     (legacy/server.js:1686 a 1707).
 *   - la capture d'un joueur par un bot noir (BlackBot.captureEntity,
 *     legacy/server.js:1257) et la destruction d'un bot noir par un joueur
 *     invincible (legacy/server.js:1718 a 1732).
 *
 * Ce que ces tests figent, c'est le comportement d'aujourd'hui, pas un ideal.
 * Les surprises rencontrees sont signalees par un commentaire et reportees dans
 * le handoff de l'etape.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import type { Harnais, JoueurLegacy } from './harnais/charger-legacy.js';
import { creerHarnais } from './harnais/charger-legacy.js';
import {
  botsParCouleur,
  DELAI_ENTRE_CAPTURES_MS,
  evenementsVers,
  resumeDeJoueur,
  sortirDeLaProtectionDeSpawn,
} from './harnais/scenario.js';

const ROUGE = '#FF0000';
const BLEU = '#0000FF';
const VERT = '#00FF00';
const BLANC = '#FFFFFF';

/** Instant de depart des scenarios, choisi rond pour que les calculs se lisent. */
const DEPART = 1_000_000;

let harnais: Harnais;
let attaquant: JoueurLegacy;
let victime: JoueurLegacy;

/**
 * Situation de base commune: deux joueurs face a face, trois bots a la victime,
 * deux a l'attaquant, un neutre. Les deux joueurs sont sortis de leur
 * protection d'apparition.
 */
function situationDeDepart(): void {
  harnais = creerHarnais({ horlogeInitiale: DEPART });
  attaquant = harnais.ajouterJoueur('a', 'Attaquant', { couleur: ROUGE, x: 500, y: 500 });
  victime = harnais.ajouterJoueur('v', 'Victime', { couleur: BLEU, x: 510, y: 500 });

  harnais.ajouterBot('b1', BLEU, 100, 100);
  harnais.ajouterBot('b2', BLEU, 200, 100);
  harnais.ajouterBot('b3', BLEU, 300, 100);
  harnais.ajouterBot('b4', ROUGE, 400, 100);
  harnais.ajouterBot('b5', ROUGE, 500, 100);
  harnais.ajouterBot('b6', VERT, 600, 100);

  sortirDeLaProtectionDeSpawn(harnais);
}

describe('capture d un joueur par un autre', () => {
  beforeEach(situationDeDepart);

  it('transfere tous les bots de la victime a l attaquant, d un seul coup', () => {
    harnais.handlePlayerCapture(attaquant, victime);

    // Les trois bots bleus passent au rouge. Les autres ne bougent pas.
    expect(botsParCouleur(harnais)).toEqual({ [ROUGE]: 5, [VERT]: 1 });
  });

  it('produit l instantane de reference de la capture', () => {
    harnais.handlePlayerCapture(attaquant, victime);

    expect({
      bots: botsParCouleur(harnais),
      attaquant: resumeDeJoueur(attaquant),
      victime: resumeDeJoueur(victime),
      emissions: harnais.emissions.map((emission) => ({
        cible: emission.cible,
        evenement: emission.evenement,
      })),
    }).toMatchSnapshot();
  });

  it('inscrit la capture dans l historique des deux joueurs', () => {
    harnais.handlePlayerCapture(attaquant, victime);

    expect(attaquant.capturedPlayers).toEqual({ v: { nickname: 'Victime', count: 1 } });
    expect(victime.capturedBy).toEqual({ a: { nickname: 'Attaquant', count: 1 } });
    expect(attaquant.captures).toBe(1);
  });

  it('cumule les captures repetees du meme joueur dans le meme historique', () => {
    harnais.handlePlayerCapture(attaquant, victime);

    // Il faut a la fois attendre le delai entre captures et sortir de la
    // protection dont la victime beneficie a sa reapparition.
    harnais.horloge.avancerDe(4000);
    victime.color = BLEU;
    harnais.handlePlayerCapture(attaquant, victime);

    expect(attaquant.capturedPlayers['v']).toEqual({ nickname: 'Victime', count: 2 });
    expect(victime.capturedBy['a']).toEqual({ nickname: 'Attaquant', count: 2 });
    expect(attaquant.captures).toBe(2);
  });

  it('compte les bots gagnes dans totalBotsCaptures, mais laisse botsControlled a zero', () => {
    harnais.handlePlayerCapture(attaquant, victime);

    expect(attaquant.totalBotsCaptures).toBe(3);
    // Surprenant: botsControlled n'est incremente nulle part dans le legacy. Le
    // serveur l'envoie pourtant au client dans playerCapturedEnemy, ou il vaut
    // donc toujours zero. Classe en bug franc dans le handoff.
    expect(attaquant.botsControlled).toBe(0);
  });

  it('fait reapparaitre la victime avec une nouvelle couleur et une nouvelle protection', () => {
    const positionAvant = { x: victime.x, y: victime.y };

    harnais.handlePlayerCapture(attaquant, victime);

    expect(victime.color).not.toBe(BLEU);
    expect(victime.color).not.toBe(ROUGE);
    expect({ x: victime.x, y: victime.y }).not.toEqual(positionAvant);
    expect(victime.spawnProtection).toBe(harnais.horloge.maintenant() + 3000);
    expect(victime.isInvulnerable()).toBe(true);
  });

  it('notifie la victime et l attaquant avec les details de la capture', () => {
    harnais.handlePlayerCapture(attaquant, victime);

    expect(evenementsVers(harnais, 'v')).toEqual(['playerCaptured']);
    expect(evenementsVers(harnais, 'a')).toEqual(['playerCapturedEnemy']);

    const versAttaquant = harnais.emissionsVers('a')[0]?.donnees as Record<string, unknown>;
    expect(versAttaquant).toMatchObject({
      capturedNickname: 'Victime',
      capturedId: 'v',
      captures: 1,
      botsGained: 3,
      playSound: 'player-capture',
    });

    const versVictime = harnais.emissionsVers('v')[0]?.donnees as Record<string, unknown>;
    expect(versVictime).toMatchObject({
      capturedBy: 'Attaquant',
      totalTimesCaptured: 1,
      playSound: 'player-captured',
    });
  });

  it('enregistre l instant de la capture chez l attaquant', () => {
    const instant = harnais.horloge.maintenant();

    harnais.handlePlayerCapture(attaquant, victime);

    expect(attaquant.lastCapture).toBe(instant);
  });
});

describe('refus de capture', () => {
  beforeEach(situationDeDepart);

  /** Verifie qu'aucune capture n'a eu lieu: ni transfert, ni compteur, ni message. */
  function riennAEuLieu(): void {
    expect(botsParCouleur(harnais)).toEqual({ [BLEU]: 3, [ROUGE]: 2, [VERT]: 1 });
    expect(attaquant.captures).toBe(0);
    expect(victime.capturedBy).toEqual({});
    expect(harnais.emissions).toHaveLength(0);
  }

  it('refuse quand la victime porte le bonus d invincibilite', () => {
    victime.invincibilityActive = true;

    harnais.handlePlayerCapture(attaquant, victime);

    riennAEuLieu();
  });

  it('refuse quand la victime est encore protegee par son apparition', () => {
    const nouveauVenu = harnais.ajouterJoueur('n', 'Nouveau', { couleur: VERT, x: 500, y: 500 });

    harnais.handlePlayerCapture(attaquant, nouveauVenu);

    expect(nouveauVenu.capturedBy).toEqual({});
    expect(attaquant.captures).toBe(0);
  });

  it('refuse tant que le delai entre deux captures n est pas ecoule', () => {
    attaquant.lastCapture = harnais.horloge.maintenant();

    harnais.handlePlayerCapture(attaquant, victime);

    riennAEuLieu();
  });

  it('refuse encore a exactement une seconde, et accepte a la milliseconde suivante', () => {
    // Le legacy teste une inegalite stricte: Date.now() - lastCapture > 1000.
    attaquant.lastCapture = harnais.horloge.maintenant() - DELAI_ENTRE_CAPTURES_MS;

    harnais.handlePlayerCapture(attaquant, victime);
    expect(attaquant.captures).toBe(0);

    harnais.horloge.avancerDe(1);
    harnais.handlePlayerCapture(attaquant, victime);
    expect(attaquant.captures).toBe(1);
  });
});

describe('capture d un bot par contact, dans detectCollisions', () => {
  beforeEach(() => {
    situationDeDepart();
    // On retire la victime du terrain: sa presence a dix pixels declencherait
    // une capture de joueur, qui repeindrait des bots et masquerait ce que ces
    // scenarios veulent observer.
    delete harnais.players['v'];
  });

  it('repeint le bot a la couleur du joueur en dessous de vingt pixels', () => {
    harnais.ajouterBot('proche', BLEU, 519, 500);

    harnais.detectCollisions(attaquant, 'a');

    expect(harnais.bots['proche']?.color).toBe(ROUGE);
  });

  it('ne repeint pas un bot situe exactement a vingt pixels', () => {
    // Cas limite: le test du legacy est distance < 20, borne exclue.
    harnais.ajouterBot('limite', BLEU, 520, 500);

    harnais.detectCollisions(attaquant, 'a');

    expect(harnais.bots['limite']?.color).toBe(BLEU);
  });

  it('propage la couleur d un bot a un autre bot au contact', () => {
    const contaminant = harnais.ajouterBot('c1', ROUGE, 800, 800);
    harnais.ajouterBot('c2', BLEU, 810, 800);

    harnais.detectCollisions(contaminant, 'c1');

    expect(harnais.bots['c2']?.color).toBe(ROUGE);
  });
});

describe('capture de joueur declenchee par la detection de collision', () => {
  beforeEach(situationDeDepart);

  it('declenche la capture quand deux joueurs de couleurs differentes se touchent', () => {
    // Les deux joueurs sont a dix pixels l'un de l'autre depuis la situation de
    // depart: la detection de collision doit suffire a lancer la capture.
    harnais.detectCollisions(attaquant, 'a');

    expect(botsParCouleur(harnais)).toEqual({ [ROUGE]: 5, [VERT]: 1 });
    expect(attaquant.captures).toBe(1);
  });

  it('ne capture pas un joueur de meme couleur', () => {
    victime.color = ROUGE;

    harnais.detectCollisions(attaquant, 'a');

    expect(attaquant.captures).toBe(0);
  });
});

describe('capture d un joueur par un bot noir', () => {
  beforeEach(situationDeDepart);

  it('fait perdre la moitie des bots, arrondie a l entier inferieur', () => {
    // Cinq bots rouges au total pour l'attaquant: la moitie arrondie vaut deux.
    harnais.ajouterBot('b7', ROUGE, 700, 100);
    harnais.ajouterBot('b8', ROUGE, 800, 100);
    harnais.ajouterBot('b9', ROUGE, 900, 100);
    const botNoir = harnais.ajouterBotNoir('bn1', 500, 500);

    botNoir.captureEntity(attaquant);

    expect(botsParCouleur(harnais)[ROUGE]).toBe(3);
    expect(attaquant.capturedByBlackBot).toBe(1);
  });

  it('cree en plus autant de bots blancs qu il en a repeint', () => {
    harnais.ajouterBot('b7', ROUGE, 700, 100);
    harnais.ajouterBot('b8', ROUGE, 800, 100);
    const botNoir = harnais.ajouterBotNoir('bn1', 500, 500);
    const nombreDeBotsAvant = Object.keys(harnais.bots).length;

    botNoir.captureEntity(attaquant);

    // Surprenant: le legacy repeint en blanc les bots perdus, puis en cree
    // autant de nouveaux. La population de bots augmente donc a chaque capture
    // par un bot noir, ce qui contredit le reglage initialBotCount. Classe en
    // bug franc (defaut X12 de l'audit): a ne pas porter tel quel a l'etape 1.3.
    expect(Object.keys(harnais.bots).length).toBe(nombreDeBotsAvant + 2);
    expect(botsParCouleur(harnais)[BLANC]).toBe(4);
  });

  it('fait reapparaitre le joueur en lui laissant sa couleur', () => {
    const botNoir = harnais.ajouterBotNoir('bn1', 500, 500);

    botNoir.captureEntity(attaquant);

    expect(attaquant.color).toBe(ROUGE);
    expect(attaquant.spawnProtection).toBe(harnais.horloge.maintenant() + 3000);
  });

  it('previent le joueur du nombre de points perdus', () => {
    const botNoir = harnais.ajouterBotNoir('bn1', 500, 500);

    botNoir.captureEntity(attaquant);

    expect(harnais.emissionsVers('a')[0]).toMatchObject({
      evenement: 'capturedByBlackBot',
      donnees: { pointsLost: 1 },
    });
  });

  it('epargne un joueur invincible ou encore protege par son apparition', () => {
    const botNoir = harnais.ajouterBotNoir('bn1', 500, 500);
    attaquant.invincibilityActive = true;

    botNoir.captureEntity(attaquant);

    expect(attaquant.capturedByBlackBot).toBe(0);
    expect(botsParCouleur(harnais)[ROUGE]).toBe(2);
  });

  it('respecte son propre delai de deux secondes entre deux captures', () => {
    harnais.ajouterBot('b7', ROUGE, 700, 100);
    harnais.ajouterBot('b8', ROUGE, 800, 100);
    const botNoir = harnais.ajouterBotNoir('bn1', 500, 500);

    botNoir.captureEntity(attaquant);
    const rougesApresPremiere = botsParCouleur(harnais)[ROUGE];

    harnais.horloge.avancerDe(1999);
    attaquant.spawnProtection = 0;
    botNoir.captureEntity(attaquant);

    expect(botsParCouleur(harnais)[ROUGE]).toBe(rougesApresPremiere);
    expect(attaquant.capturedByBlackBot).toBe(1);
  });
});

describe('destruction d un bot noir par un joueur invincible', () => {
  beforeEach(() => {
    situationDeDepart();
    // Meme raison que plus haut: seule la rencontre avec le bot noir doit
    // produire des messages.
    delete harnais.players['v'];
  });

  it('supprime le bot noir et cree quinze points pour le joueur', () => {
    harnais.ajouterBotNoir('bn1', 505, 500);
    attaquant.invincibilityActive = true;

    harnais.detectCollisions(attaquant, 'a');

    expect(harnais.blackBots['bn1']).toBeUndefined();
    expect(attaquant.blackBotsDestroyed).toBe(1);
    expect(harnais.emissionsVers('a')[0]).toMatchObject({
      evenement: 'playerCapturedEnemy',
      donnees: { capturedNickname: 'Bot Noir', pointsGained: 15 },
    });
  });

  it('ne detruit rien si le joueur n est pas invincible', () => {
    harnais.ajouterBotNoir('bn1', 505, 500);

    harnais.detectCollisions(attaquant, 'a');

    expect(harnais.blackBots['bn1']).toBeDefined();
    expect(attaquant.blackBotsDestroyed).toBe(0);
  });
});
