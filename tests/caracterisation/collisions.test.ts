/**
 * Caracterisation du domaine COLLISIONS.
 *
 * Perimetre, repris de la fiche docs/plan/etape-0-2.md:
 *   - CollisionMap.canMove (legacy/server.js:394) et checkCollision (:430) pour
 *     le terrain, y compris la derivation de la carte depuis collision.png.
 *   - detectCollisions (legacy/server.js:1671) pour les contacts entre entites.
 *   - la resolution du deplacement contre un mur, dans le gestionnaire 'move'
 *     (legacy/server.js:2604), qui contient le glissement le long d'un mur.
 *
 * Le decodage de l'image est confie a la bibliotheque native canvas, qui n'est
 * pas une regle de jeu. On lui substitue des pixels connus et on laisse le vrai
 * code de seuillage du legacy les transformer en carte de collisions.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import type { Harnais } from './harnais/charger-legacy.js';
import { creerHarnais, imageDeCollision, imageDUnPixel } from './harnais/charger-legacy.js';
import { sortirDeLaProtectionDeSpawn } from './harnais/scenario.js';

const ROUGE = '#FF0000';
const BLEU = '#0000FF';

/** Rayon par defaut d'une entite dans le legacy, en pixels. */
const RAYON = 16;

let harnais: Harnais;

beforeEach(() => {
  harnais = creerHarnais({ horlogeInitiale: 1_000_000 });
});

describe('derivation de la carte depuis l image collision.png', () => {
  it('traite un pixel comme un mur quand sa luminosite moyenne est sous 128', async () => {
    await harnais.chargerCarteDeCollisions(imageDUnPixel(127, 127, 127), 'sombre');

    expect(harnais.collisionMap.checkCollision(0, 0)).toBe(true);
  });

  it('traite un pixel comme libre a partir d une luminosite moyenne de 128', async () => {
    // Cas limite: le legacy teste (r + v + b) / 3 < 128, borne exclue.
    await harnais.chargerCarteDeCollisions(imageDUnPixel(128, 128, 128), 'clair');

    expect(harnais.collisionMap.checkCollision(0, 0)).toBe(false);
  });

  it('juge sur la moyenne des trois composantes, pas sur une seule', async () => {
    // Bleu pur: moyenne 85, donc un mur, alors que sa composante bleue est au
    // maximum. Jaune pur: moyenne 170, donc du sol.
    await harnais.chargerCarteDeCollisions(imageDUnPixel(0, 0, 255), 'bleu');
    expect(harnais.collisionMap.checkCollision(0, 0)).toBe(true);

    const autre = creerHarnais();
    await autre.chargerCarteDeCollisions(imageDUnPixel(255, 255, 0), 'jaune');
    expect(autre.collisionMap.checkCollision(0, 0)).toBe(false);
  });

  it('produit une grille aux dimensions de la carte, quelle que soit sa taille', async () => {
    await harnais.chargerCarteDeCollisions(
      imageDeCollision(300, 200, (x) => x >= 150),
      'moitie',
    );

    expect(harnais.collisionMap.collisionData).toHaveLength(200);
    expect(harnais.collisionMap.collisionData?.[0]).toHaveLength(300);
    expect(harnais.collisionMap.checkCollision(149, 100)).toBe(false);
    expect(harnais.collisionMap.checkCollision(150, 100)).toBe(true);
  });
});

describe('limites de la carte', () => {
  beforeEach(async () => {
    await harnais.chargerCarteDeCollisions(
      imageDeCollision(200, 150, () => false),
      'vide',
    );
  });

  it('considere tout point hors de la carte comme un mur', () => {
    expect(harnais.collisionMap.checkCollision(-1, 75)).toBe(true);
    expect(harnais.collisionMap.checkCollision(200, 75)).toBe(true);
    expect(harnais.collisionMap.checkCollision(100, 150)).toBe(true);
  });

  it('refuse un deplacement dont la cible sort de la carte', () => {
    expect(harnais.collisionMap.canMove(100, 75, 250, 75)).toBe(false);
    expect(harnais.collisionMap.canMove(100, 75, 100, -10)).toBe(false);
  });

  it('refuse un deplacement au bord, parce que le rayon deborde de la carte', () => {
    // Le contour de l'entite est teste sur seize points: pres du bord, certains
    // tombent hors de la carte, donc dans un mur.
    expect(harnais.collisionMap.canMove(100, 75, 5, 75)).toBe(false);
    expect(harnais.collisionMap.canMove(100, 75, 20, 75)).toBe(true);
  });
});

describe('deplacement au contact d un mur', () => {
  beforeEach(async () => {
    // Carte de 200 sur 150, mur plein a partir de l'abscisse 100.
    await harnais.chargerCarteDeCollisions(
      imageDeCollision(200, 150, (x) => x >= 100),
      'mur',
    );
  });

  it('refuse un deplacement dont le centre tombe dans le mur', () => {
    expect(harnais.collisionMap.canMove(50, 75, 120, 75)).toBe(false);
  });

  it('accepte un deplacement loin du mur', () => {
    expect(harnais.collisionMap.canMove(50, 75, 60, 75)).toBe(true);
  });

  it('bloque des le rayon de l entite, avant que le centre touche le mur', () => {
    // A 84, le point du contour situe a l'est vaut exactement 100: c'est deja
    // le mur. A 83, il vaut 99, donc encore du sol.
    expect(harnais.collisionMap.canMove(50, 75, 84, 75, RAYON)).toBe(false);
    expect(harnais.collisionMap.canMove(50, 75, 83, 75, RAYON)).toBe(true);
  });

  it('tient compte du rayon demande', () => {
    // Avec un rayon de 4, la meme position est franchissable.
    expect(harnais.collisionMap.canMove(50, 75, 90, 75, 4)).toBe(true);
    expect(harnais.collisionMap.canMove(50, 75, 90, 75, RAYON)).toBe(false);
  });

  it('produit l instantane de reference des positions tenables autour du mur', () => {
    // Une ligne par ordonnee testee, un caractere par abscisse: le point
    // signale une position ou l'entite tient, le diese une position refusee.
    const carte: string[] = [];
    for (let y = 20; y <= 120; y += 20) {
      let ligne = '';
      for (let x = 0; x <= 120; x += 4) {
        ligne += harnais.collisionMap.canMove(x, y, x, y, RAYON) ? '.' : '#';
      }
      carte.push(ligne);
    }
    expect(carte).toMatchSnapshot();
  });
});

describe('nature du test de collision: un echantillon, pas un balayage', () => {
  it('laisse traverser un mur fin en un seul deplacement', async () => {
    // Mur de deux pixels de large. Aucun des seize points du contour ne tombe
    // dessus quand l'entite arrive de l'autre cote: le deplacement est accepte.
    // Ce n'est pas un reglage de jeu, c'est une limite de la methode. A traiter
    // par conception a l'etape 1.2, pas a reproduire.
    await harnais.chargerCarteDeCollisions(
      imageDeCollision(200, 150, (x) => x === 100 || x === 101),
      'murfin',
    );

    expect(harnais.collisionMap.canMove(90, 75, 115, 75)).toBe(true);
  });

  it('ignore completement le point de depart du deplacement', async () => {
    await harnais.chargerCarteDeCollisions(
      imageDeCollision(200, 150, () => false),
      'vide',
    );

    // Les deux premiers arguments ne sont lus nulle part dans canMove.
    expect(harnais.collisionMap.canMove(0, 0, 100, 75)).toBe(
      harnais.collisionMap.canMove(199, 149, 100, 75),
    );
  });
});

describe('resolution du deplacement dans le gestionnaire move', () => {
  // Carte plus grande que les precedentes: creer un joueur passe par le tirage
  // de position du legacy, qui s'ecarte de cent pixels des bords. Sur une carte
  // de deux cents pixels de large, les cent tentatives echouent toutes et le
  // legacy part dans un chemin de secours qui plante (defaut X3 de l'audit).
  beforeEach(async () => {
    await harnais.chargerCarteDeCollisions(
      imageDeCollision(600, 400, (x) => x >= 300),
      'murLarge',
    );
  });

  it('applique la vitesse de base du joueur sur un vecteur normalise', () => {
    const socket = harnais.connecterSocket('j1');
    const joueur = harnais.ajouterJoueur('j1', 'Alice', { couleur: ROUGE, x: 50, y: 75 });

    socket.declencher('move', { x: 10, y: 0, isMoving: true });

    // Le vecteur recu est normalise puis multiplie par la vitesse de base, 3.
    expect(joueur.x).toBe(53);
    expect(joueur.y).toBe(75);
  });

  it('applique les multiplicateurs de vitesse annonces par le client', () => {
    // Ce test fige les valeurs de vitesse, qui sont un reglage de jeu fragile.
    // Il ne fige pas le fait que le client soit cru sur parole quand il annonce
    // un bonus ou un appareil mobile: c'est une faille, traitee par conception
    // a l'etape 1.6.
    const socket = harnais.connecterSocket('j1');
    const joueur = harnais.ajouterJoueur('j1', 'Alice', { couleur: ROUGE, x: 20, y: 75 });

    socket.declencher('move', { x: 1, y: 0, isMoving: true, speedBoostActive: true });
    expect(joueur.x).toBeCloseTo(20 + 3 * 1.7, 10);

    joueur.x = 20;
    socket.declencher('move', { x: 1, y: 0, isMoving: true, isMobile: true });
    expect(joueur.x).toBeCloseTo(20 + 3 * 2, 10);

    joueur.x = 20;
    socket.declencher('move', {
      x: 1,
      y: 0,
      isMoving: true,
      speedBoostActive: true,
      isMobile: true,
    });
    expect(joueur.x).toBeCloseTo(20 + 3 * 1.7 * 2, 10);
  });

  it('fait glisser le joueur le long du mur au lieu de le bloquer net', () => {
    const socket = harnais.connecterSocket('j1');
    const joueur = harnais.ajouterJoueur('j1', 'Alice', { couleur: ROUGE, x: 283, y: 200 });

    // Vers le sud-est: la composante horizontale est bloquee par le mur, la
    // composante verticale passe. Le joueur longe le mur vers le bas.
    socket.declencher('move', { x: 1, y: 1, isMoving: true });

    expect(joueur.x).toBe(283);
    expect(joueur.y).toBeGreaterThan(200);
  });

  it('ne bouge pas du tout quand aucune direction n est praticable', () => {
    const socket = harnais.connecterSocket('j1');
    // Coince dans l'angle superieur gauche: le rayon deborde de la carte des
    // que le joueur tente quoi que ce soit.
    const joueur = harnais.ajouterJoueur('j1', 'Alice', { couleur: ROUGE, x: 0, y: 0 });

    socket.declencher('move', { x: -1, y: -1, isMoving: true });

    expect({ x: joueur.x, y: joueur.y }).toEqual({ x: 0, y: 0 });
    expect(joueur.direction).toBe('idle');
  });

  it('ignore un message de deplacement qui ne declare pas de mouvement', () => {
    const socket = harnais.connecterSocket('j1');
    const joueur = harnais.ajouterJoueur('j1', 'Alice', { couleur: ROUGE, x: 50, y: 75 });

    socket.declencher('move', { x: 1, y: 0 });

    expect(joueur.x).toBe(50);
  });

  it('met a jour la direction du joueur selon le deplacement effectif', () => {
    const socket = harnais.connecterSocket('j1');
    const joueur = harnais.ajouterJoueur('j1', 'Alice', { couleur: ROUGE, x: 50, y: 75 });

    socket.declencher('move', { x: 0, y: 1, isMoving: true });

    expect(joueur.direction).toBe('south');
  });

  it('resout les collisions entre entites dans la foulee du deplacement', () => {
    const socket = harnais.connecterSocket('j1');
    harnais.ajouterJoueur('j1', 'Alice', { couleur: ROUGE, x: 50, y: 75 });
    harnais.ajouterBot('b1', BLEU, 54, 75);

    socket.declencher('move', { x: 1, y: 0, isMoving: true });

    expect(harnais.bots['b1']?.color).toBe(ROUGE);
  });
});

describe('distance de securite au moment de l apparition', () => {
  // La fiche de l'etape cite ce cas en exemple: un comportement surprenant, a
  // caracteriser tel quel plutot qu'a corriger au passage.

  it('ne tient aucun registre des positions, donc la distance ne s applique jamais', () => {
    harnais.ajouterJoueur('j1', 'Alice');
    harnais.ajouterJoueur('j2', 'Bob');
    harnais.ajouterBot('b1', ROUGE);
    harnais.ajouterBotNoir('bn1');

    // registerEntity n'est appelee nulle part dans le legacy: le registre reste
    // vide quoi qu'il arrive, donc deux entites peuvent apparaitre collees.
    expect(harnais.positionManager.entitiesPositions.size).toBe(0);
    expect(harnais.positionManager.isValidPosition(500, 500)).toBe(true);
  });

  it('ecarterait bien les entites de cent pixels si le registre etait alimente', () => {
    // Le mecanisme fonctionne, il n'est simplement jamais branche. On le montre
    // en alimentant le registre a la main.
    harnais.positionManager.registerEntity('temoin', 500, 500);

    expect(harnais.positionManager.isValidPosition(599, 500)).toBe(false);
    expect(harnais.positionManager.isValidPosition(600, 500)).toBe(true);
  });
});

describe('vitesses relatives', () => {
  // Cinquieme comportement a preserver de CLAUDE.md, signale comme le plus
  // fragile du jeu: quatre corrections successives dans le journal des versions.
  // Ce qui suit mesure les vitesses reellement appliquees par le legacy, et non
  // celles annoncees par la configuration.

  it('deplace le joueur de trois pixels par message de mouvement', () => {
    const socket = harnais.connecterSocket('j1');
    const joueur = harnais.ajouterJoueur('j1', 'Alice', { couleur: ROUGE, x: 500, y: 500 });

    socket.declencher('move', { x: 0, y: 1, isMoving: true });

    expect(joueur.y).toBe(503);
  });

  it('deplace le bot noir en poursuite de cinq pixels, et non de six', () => {
    // Le reglage blackBotSpeed vaut 6, mais BlackBot lit GAME_CONFIG.BOT_SPEED,
    // qui vaut 5: le bot noir avance exactement a la vitesse d'un bot ordinaire.
    // Le reglage n'est lu nulle part (defaut X13 de l'audit).
    // Decision du 13 aout 2026: on garde 5, la valeur reellement jouee. CLAUDE.md
    // et l'audit, qui annoncaient 6, ont ete corriges.
    const botNoir = harnais.ajouterBotNoir('bn1', 500, 500);
    botNoir.targetEntity = harnais.ajouterBot('cible', BLEU, 800, 500);

    botNoir.pursueTarget();

    expect(botNoir.baseSpeed).toBe(5);
    expect(botNoir.x).toBe(505);
    expect(harnais.currentGameSettings['blackBotSpeed']).toBe(6);
  });

  it('ignore le reglage de vitesse des bots noirs choisi pour la partie', () => {
    harnais.currentGameSettings['blackBotSpeed'] = 12;
    const botNoir = harnais.ajouterBotNoir('bn1', 500, 500);
    botNoir.targetEntity = harnais.ajouterBot('cible', BLEU, 800, 500);

    botNoir.pursueTarget();

    expect(botNoir.x).toBe(505);
  });
});

describe('contacts entre entites, dans detectCollisions', () => {
  it('ramasse un bonus en dessous de quinze pixels, et le retire du terrain', () => {
    const joueur = harnais.ajouterJoueur('j1', 'Alice', { couleur: ROUGE, x: 500, y: 500 });
    harnais.ajouterBonus('speed', 514, 500);

    harnais.detectCollisions(joueur, 'j1');

    expect(harnais.bonuses).toHaveLength(0);
    expect(joueur.speedBoostActive).toBe(true);
  });

  it('ne ramasse pas un bonus situe exactement a quinze pixels', () => {
    const joueur = harnais.ajouterJoueur('j1', 'Alice', { couleur: ROUGE, x: 500, y: 500 });
    harnais.ajouterBonus('speed', 515, 500);

    harnais.detectCollisions(joueur, 'j1');

    expect(harnais.bonuses).toHaveLength(1);
    expect(joueur.speedBoostActive).toBe(false);
  });

  it('ramasse plusieurs objets d un seul passage', () => {
    const joueur = harnais.ajouterJoueur('j1', 'Alice', { couleur: ROUGE, x: 500, y: 500 });
    harnais.ajouterBonus('speed', 505, 500);
    harnais.ajouterBonus('reveal', 500, 505);
    harnais.ajouterMalus('blur', 495, 500);

    harnais.detectCollisions(joueur, 'j1');

    expect(harnais.bonuses).toHaveLength(0);
    expect(harnais.malusItems).toHaveLength(0);
  });

  it('ne fait rien pour un bot qui rencontre un bonus', () => {
    // Seuls les joueurs ramassent: le legacy n'examine bonus et malus que
    // lorsque l'entite testee est de type player.
    const bot = harnais.ajouterBot('b1', ROUGE, 500, 500);
    harnais.ajouterBonus('speed', 505, 500);

    harnais.detectCollisions(bot, 'b1');

    expect(harnais.bonuses).toHaveLength(1);
  });

  it('ignore l entite testee dans sa propre detection', () => {
    const joueur = harnais.ajouterJoueur('j1', 'Alice', { couleur: ROUGE, x: 500, y: 500 });
    harnais.ajouterJoueur('j2', 'Bob', { couleur: BLEU, x: 500, y: 500 });
    sortirDeLaProtectionDeSpawn(harnais);

    // Superposition parfaite: la distance vaut zero, et pourtant l'entite ne se
    // capture pas elle-meme.
    harnais.detectCollisions(joueur, 'j1');

    expect(joueur.captures).toBe(1);
    expect(harnais.players['j2']?.captures).toBe(0);
  });
});
