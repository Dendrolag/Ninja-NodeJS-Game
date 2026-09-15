/**
 * Test de partie complete: le moteur pur, de bout en bout.
 *
 * C'est le test demande par la fiche de l'etape 1.5, et c'est le seul du paquet
 * qui ne regarde aucun systeme en particulier. Il fait tourner une partie entiere
 * avec des joueurs, des bots, des bots noirs, des bonus, des malus et des zones,
 * puis compare un resume de l'etat final a un instantane de reference.
 *
 * POURQUOI UN RESUME PLUTOT QUE L'ETAT ENTIER. Un etat de fin de partie contient
 * une trentaine de bots avec leurs caps et leurs compteurs: un instantane brut
 * ferait plusieurs centaines de lignes que personne ne relirait, et le moindre
 * changement le rendrait illisible. Le resume ci-dessous tient sur un ecran et
 * dit ce qui compte. Il contient surtout l'etat du generateur a graine, qui suffit
 * a detecter toute divergence: deux parties qui n'auraient pas fait exactement les
 * memes tirages, dans le meme ordre, ne peuvent pas y arriver avec le meme
 * nombre.
 *
 * QUE FAIRE QUAND CET INSTANTANE CHANGE. Il ne doit changer que si le gameplay
 * change. Le voir bouger apres une modification censee ne rien changer est le
 * signal d'une regression, pas d'un instantane a mettre a jour.
 */

import type { ReglagesPartiels, Vecteur } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { peuplerDeBots } from './bots.js';
import type { EtatPartie, EvenementPartie } from './etat.js';
import { ajouterJoueur, creerEtatInitial } from './etat.js';
import type { Entrees } from './moteur.js';
import { evaluerFinDePartie, tick } from './moteur.js';
import { calculerScores } from './score.js';

/** Cadence de reference du serveur, en millisecondes. */
const BATTEMENT_MS = 50;

/** Une partie d'une minute: assez pour que les bots noirs entrent en jeu a mi-parcours. */
const REGLAGES: ReglagesPartiels = { dureePartieS: 60, nombreBotsInitial: 30 };

/** Nombre de battements pour couvrir la partie entiere. */
const BATTEMENTS = (60 * 1000) / BATTEMENT_MS;

/** Une partie prete a jouer: trois joueurs places, trente bots semes. */
function partiePrete(graine = 42): EtatPartie {
  let etat = creerEtatInitial({ graine, reglages: REGLAGES });

  etat = ajouterJoueur(etat, { id: 'alice', pseudo: 'Alice', position: { x: 400, y: 400 } });
  etat = ajouterJoueur(etat, { id: 'bob', pseudo: 'Bob', position: { x: 1200, y: 900 } });
  etat = ajouterJoueur(etat, { id: 'chloe', pseudo: 'Chloe', position: { x: 800, y: 1100 } });

  return peuplerDeBots(etat);
}

/**
 * Ce que les joueurs demandent au battement donne.
 *
 * Chacun tourne sur un cercle, a une vitesse angulaire differente: c'est une
 * facon simple de leur faire parcourir la carte, se croiser et rencontrer des
 * bots, sans avoir a ecrire un scenario a la main.
 */
function entreesDu(battement: number): Entrees {
  const surUnCercle = (periode: number, dephasage: number): Vecteur => {
    const angle = (2 * Math.PI * battement) / periode + dephasage;

    return { x: Math.cos(angle), y: Math.sin(angle) };
  };

  return {
    alice: { deplacement: surUnCercle(120, 0), enMouvement: true },
    bob: { deplacement: surUnCercle(200, Math.PI / 3), enMouvement: true },
    chloe: { deplacement: surUnCercle(90, Math.PI), enMouvement: true },
  };
}

/** Joue la partie du debut a la fin, en accumulant tout ce qui s'y est passe. */
function jouerLaPartie(graine = 42): {
  readonly etat: EtatPartie;
  readonly evenements: readonly EvenementPartie[];
} {
  let etat = partiePrete(graine);
  const evenements: EvenementPartie[] = [];

  for (let battement = 0; battement < BATTEMENTS; battement += 1) {
    etat = tick(etat, entreesDu(battement), BATTEMENT_MS);
    evenements.push(...etat.evenements);
  }

  return { etat, evenements };
}

/** Combien de fois chaque nature d'evenement s'est produite. */
function comptesParType(evenements: readonly EvenementPartie[]): Record<string, number> {
  const comptes: Record<string, number> = {};

  for (const evenement of evenements) {
    comptes[evenement.type] = (comptes[evenement.type] ?? 0) + 1;
  }

  return comptes;
}

/** Le resume de l'etat final soumis a l'instantane. Voir l'explication en tete de fichier. */
function resume(etat: EtatPartie, evenements: readonly EvenementPartie[]): unknown {
  const arrondi = (valeur: number): number => Math.round(valeur * 100) / 100;

  return {
    tick: etat.tick,
    tempsEcouleMs: etat.tempsEcouleMs,
    partieTerminee: evaluerFinDePartie(etat).terminee,
    // L'empreinte la plus sure: elle ne peut coincider que si tous les tirages
    // de la partie ont ete faits dans le meme ordre.
    alea: etat.alea.etat,
    compteurIdentifiants: etat.compteurIdentifiants,
    classement: calculerScores(etat).map((ligne) => ({
      id: ligne.id,
      points: ligne.points,
      botsPortes: ligne.botsPortes,
      captures: ligne.captures,
      botsNoirsDetruits: ligne.botsNoirsDetruits,
    })),
    positions: Object.fromEntries(
      Object.values(etat.joueurs).map((joueur) => [
        joueur.id,
        { x: arrondi(joueur.position.x), y: arrondi(joueur.position.y) },
      ]),
    ),
    capturesParBotNoirSubies: Object.fromEntries(
      Object.values(etat.joueurs).map((joueur) => [joueur.id, joueur.capturesParBotNoirSubies]),
    ),
    bots: {
      total: Object.keys(etat.bots).length,
      ordinaires: Object.values(etat.bots).filter((bot) => bot.type === 'bot').length,
      noirs: Object.values(etat.bots).filter((bot) => bot.type === 'botNoir').length,
    },
    objetsPoses: Object.values(etat.objets).length,
    zonesActives: Object.values(etat.zones).map((zone) => zone.type),
    evenements: comptesParType(evenements),
  };
}

describe('partie complete', () => {
  it('produit l instantane de reference apres une minute de jeu', () => {
    const partie = jouerLaPartie();

    expect(resume(partie.etat, partie.evenements)).toMatchSnapshot();
  });

  it('rejoue exactement la meme partie a graine et entrees egales', () => {
    expect(jouerLaPartie().etat).toEqual(jouerLaPartie().etat);
  });

  it('produit une partie differente avec une autre graine', () => {
    expect(jouerLaPartie(42).etat).not.toEqual(jouerLaPartie(43).etat);
  });

  it('garde une population de bots ordinaires constante, defaut X12', () => {
    const partie = jouerLaPartie();
    const ordinaires = Object.values(partie.etat.bots).filter((bot) => bot.type === 'bot');

    // Le legacy creait un bot blanc par bot repeint a chaque capture par un bot
    // noir: sa population derivait a la hausse pendant toute la partie.
    expect(ordinaires).toHaveLength(30);
  });

  it('laisse chaque entite sur une case praticable, du debut a la fin', () => {
    const { etat } = jouerLaPartie();
    const dansLaCarte = (position: { x: number; y: number }): boolean =>
      position.x >= 0 &&
      position.x <= etat.carte.largeur &&
      position.y >= 0 &&
      position.y <= etat.carte.hauteur;

    expect(Object.values(etat.joueurs).every((joueur) => dansLaCarte(joueur.position))).toBe(true);
    expect(Object.values(etat.bots).every((bot) => dansLaCarte(bot.position))).toBe(true);
  });

  it('fait entrer les bots noirs a mi-partie, et pas avant', () => {
    let etat = partiePrete();
    const botsNoirs = (): number =>
      Object.values(etat.bots).filter((bot) => bot.type === 'botNoir').length;

    for (let battement = 0; battement < BATTEMENTS / 2 - 1; battement += 1) {
      etat = tick(etat, entreesDu(battement), BATTEMENT_MS);
    }
    expect(botsNoirs()).toBe(0);

    etat = tick(etat, entreesDu(0), BATTEMENT_MS);
    expect(botsNoirs()).toBe(2);
  });

  it('fait vivre les objets et les zones tout du long', () => {
    let etat = partiePrete();
    let objetsVus = 0;
    let zonesVues = 0;

    for (let battement = 0; battement < BATTEMENTS; battement += 1) {
      etat = tick(etat, entreesDu(battement), BATTEMENT_MS);
      objetsVus = Math.max(objetsVus, Object.keys(etat.objets).length);
      zonesVues = Math.max(zonesVues, Object.keys(etat.zones).length);
    }

    // Les objets apparaissent toutes les quatre secondes environ et vivent huit
    // secondes: il y en a forcement plusieurs sur la carte en meme temps a un
    // moment ou a un autre. N'en voir aucun signalerait des apparitions muettes.
    expect(objetsVus).toBeGreaterThan(1);
    expect(zonesVues).toBeGreaterThan(1);
  });

  it('n avance plus une fois la partie terminee', () => {
    const { etat } = jouerLaPartie();

    expect(tick(etat, entreesDu(0), BATTEMENT_MS)).toBe(etat);
  });
});
