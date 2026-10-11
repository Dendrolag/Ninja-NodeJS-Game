// @vitest-environment jsdom

/**
 * Tests de la fenetre d'une tache courte d'Among Ninjas (etape 7.21): elle s'ouvre et se ferme
 * sur ce que dit l'etat, fige le jeu pendant ce temps, recoit le clavier, fait entendre les
 * gestes, et n'annonce la tache finie qu'apres sa duree minimale. Un mini-jeu des taches
 * longues (etape 7.24) fini plus tot garde son ecran gagne jusqu'a elle.
 */

import type { EtatPriveAmong, NomDeSon } from '@neon-ninja/shared';
import { DUREES_MINIMALES_DES_TACHES_MS, REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { TacheOuverte } from '../../among.js';
import type { EtatClient } from '../../etat.js';
import { ETAT_INITIAL } from '../../etat.js';
import { creerHorlogeClientManuelle } from '../../horloge.js';
import type { LecteurDeSons } from '../../sons/lecteur.js';
import { TIR_MS, placerLesBateaux } from '../modeles/gestes/bataille.js';
import { graineDuGeste } from '../modeles/gestes/index.js';
import {
  MARGE_DE_L_ANNONCE_MS,
  monterFenetreDeTache,
  partDeLAttente,
  toucheDuGeste,
} from './tache.js';

const STATION = { x: 1335, y: 80, nom: 'Camionnette du parking', natures: ['munitions'] } as const;

/** L'etat d'une partie Among Ninjas ou cette tache est ouverte, ou aucune. */
function etat(ouverte?: TacheOuverte): EtatClient {
  const prive: EtatPriveAmong = {
    role: 'proie',
    complices: [],
    fantome: false,
    gong: { x: 0, y: 0 },
    stations: [STATION],
    taches: [{ station: 0, nature: 'munitions', faite: false }],
    gongUtilise: false,
  };

  return {
    ...ETAT_INITIAL,
    moi: 'moi',
    salon: {
      idRoom: 'r',
      statut: 'enCours',
      mode: 'among',
      visibilite: 'publique',
      capacite: 12,
      joueurs: [],
      reglages: REGLAGES_PAR_DEFAUT,
    },
    among: {
      prive,
      reunion: undefined,
      morts: [],
      ...(ouverte === undefined ? {} : { tacheOuverte: ouverte }),
    },
  };
}

/** Une fenetre montee avec une horloge, des images et des sons pilotes a la main. */
function monter() {
  const horloge = creerHorlogeClientManuelle();
  const rappels: (() => void)[] = [];
  const joues: NomDeSon[] = [];
  const ouvertures: boolean[] = [];
  const annonces: string[] = [];
  const peints: number[] = [];
  const attentes: (number | undefined)[] = [];
  const sons = { jouer: (nom: NomDeSon) => joues.push(nom) } as unknown as LecteurDeSons;
  const fenetre = monterFenetreDeTache({
    document,
    client: {
      finirLaTache: () => annonces.push('finie'),
      fermerLaTache: () => annonces.push('fermee'),
    },
    horloge,
    sons,
    surOuverture: (ouverte) => ouvertures.push(ouverte),
    peindre: (_toile, _geste, maintenant, attente) => {
      peints.push(maintenant);
      attentes.push(attente);
    },
    planifier: (rappel) => {
      rappels.push(rappel);
      return () => {
        rappels.splice(rappels.indexOf(rappel), 1);
      };
    },
  });
  document.body.append(fenetre.racine);

  const depart = horloge.maintenant();

  /** Fait passer une image a cet instant, compte du depart de l'horloge. */
  const image = (instant: number): void => {
    horloge.avancerDe(depart + instant - horloge.maintenant());
    const prochaine = rappels.shift();
    prochaine?.();
  };

  /** Une tache ouverte a cet instant, compte du depart de l'horloge. */
  const ouverte = (depuis = 0): TacheOuverte => ({ ...OUVERTE, depuis: depart + depuis });

  return {
    fenetre,
    depart,
    joues,
    ouvertures,
    annonces,
    peints,
    attentes,
    rappels,
    image,
    ouverte,
  };
}

/** Une touche du clavier, enfoncee ou relachee, sur le document. */
function touche(cle: string, type: 'keydown' | 'keyup' = 'keydown'): KeyboardEvent {
  const evenement = new KeyboardEvent(type, { key: cle, cancelable: true });
  document.dispatchEvent(evenement);
  return evenement;
}

const OUVERTE: TacheOuverte = { nature: 'munitions', station: STATION, depuis: 0, feinte: false };

describe('la fenetre d une tache', () => {
  it('s ouvre sur la tache de l etat, la nomme, et fige le jeu', () => {
    const { fenetre, joues, ouvertures, ouverte } = monter();

    expect(fenetre.racine.hidden).toBe(true);
    fenetre.afficher(etat(ouverte()));

    expect(fenetre.racine.hidden).toBe(false);
    expect(fenetre.racine.querySelector('.tache-titre')?.textContent).toBe(
      'Recharger des munitions',
    );
    expect(fenetre.racine.querySelector('.tache-station')?.textContent).toBe(
      'Camionnette du parking',
    );
    expect(fenetre.racine.querySelector('.tache-aide')?.textContent).toContain('Clavier');
    expect(fenetre.racine.querySelector('.tache-avancement')?.textContent).toBe('0 sur 5');
    expect(fenetre.racine.querySelector('.tache-fenetre')?.getAttribute('data-nature')).toBe(
      'munitions',
    );
    expect(joues).toEqual(['tacheOuverte']);
    expect(ouvertures).toEqual([true]);
    fenetre.demonter();
  });

  it('ne rouvre pas la meme ouverture, et se ferme quand l etat ne la dit plus', () => {
    const { fenetre, ouvertures, joues, ouverte } = monter();

    fenetre.afficher(etat(ouverte()));
    fenetre.afficher(etat(ouverte()));
    fenetre.afficher(etat());

    expect(fenetre.racine.hidden).toBe(true);
    expect(ouvertures).toEqual([true, false]);
    expect(joues).toEqual(['tacheOuverte']);
    fenetre.demonter();
  });

  it('joue le geste au clavier, le fait entendre, et le dit fini', () => {
    const { fenetre, joues, image, ouverte } = monter();
    fenetre.afficher(etat(ouverte()));

    for (let cartouche = 0; cartouche < 5; cartouche += 1) {
      image(cartouche * 800);
      touche(' ');
      touche(' ', 'keyup');
    }
    image(5000);

    expect(joues.filter((nom) => nom === 'tacheCartouche')).toHaveLength(5);
    expect(joues).toContain('tacheReussie');
    expect(fenetre.racine.querySelector('.tache-avancement')?.textContent).toBe('5 sur 5');
    expect(fenetre.racine.querySelector('.tache-fenetre')?.classList.contains('reussie')).toBe(
      true,
    );
    fenetre.demonter();
  });

  it('n annonce la fin qu apres la duree minimale, comptee de l ouverture, puis la repete', () => {
    const { fenetre, annonces, image, ouverte } = monter();
    fenetre.afficher(etat(ouverte(2000)));

    // Cinq cartouches au plus vite, avant que la duree minimale soit passee depuis l'ouverture.
    for (let cartouche = 0; cartouche < 5; cartouche += 1) {
      image(2000 + cartouche * 730);
      touche(' ');
    }
    // Fini a 3,64 secondes de l'ouverture, juste sous la duree minimale et sa marge.
    image(2000 + 4 * 730 + 720);
    expect(fenetre.racine.querySelector('.tache-avancement')?.textContent).toBe('5 sur 5');
    expect(annonces).toEqual([]);

    const permis = 2000 + DUREES_MINIMALES_DES_TACHES_MS.munitions + MARGE_DE_L_ANNONCE_MS;
    image(permis);
    expect(annonces).toEqual(['finie']);

    image(permis + 500);
    expect(annonces).toEqual(['finie']);
    image(permis + 1000);
    expect(annonces).toEqual(['finie', 'finie']);
    fenetre.demonter();
  });

  it('se ferme par Echap ou la croix, ce que le client dit fermee, et libere le jeu', () => {
    const { fenetre, annonces, ouvertures, ouverte } = monter();

    fenetre.afficher(etat(ouverte()));
    const echap = touche('Escape');
    expect(echap.defaultPrevented).toBe(true);
    expect(fenetre.racine.hidden).toBe(true);
    expect(annonces).toEqual(['fermee']);

    fenetre.afficher(etat(ouverte(10)));
    fenetre.racine.querySelector<HTMLButtonElement>('.tache-fermer')?.click();
    expect(annonces).toEqual(['fermee', 'fermee']);
    expect(ouvertures).toEqual([true, false, true, false]);

    // Fermee, la fenetre ne prend plus le clavier.
    expect(touche('ArrowRight').defaultPrevented).toBe(false);
    fenetre.demonter();
  });

  it('prend les fleches et Espace pour elle, pas les autres touches', () => {
    const { fenetre, ouverte } = monter();
    fenetre.afficher(etat(ouverte()));

    expect(touche('ArrowLeft').defaultPrevented).toBe(true);
    expect(touche('z').defaultPrevented).toBe(true);
    expect(touche('m').defaultPrevented).toBe(false);
    fenetre.demonter();
  });

  it('dessine a chaque image, et cesse une fois fermee', () => {
    const { fenetre, peints, image, rappels, depart, ouverte } = monter();
    fenetre.afficher(etat(ouverte()));
    image(16);
    image(32);

    expect(peints).toEqual([depart, depart + 16, depart + 32]);
    fenetre.afficher(etat());
    expect(rappels).toEqual([]);
    fenetre.demonter();
  });

  it('ne s ouvre pas hors d Among Ninjas', () => {
    const { fenetre, ouverte } = monter();
    const ailleurs = etat(ouverte());
    fenetre.afficher({
      ...ailleurs,
      salon: ailleurs.salon === undefined ? undefined : { ...ailleurs.salon, mode: 'massacre' },
    });

    expect(fenetre.racine.hidden).toBe(true);
    fenetre.demonter();
  });
});

describe('un mini-jeu fini avant sa duree minimale (etape 7.24)', () => {
  it('ne dit rien d une tache courte, ni d un mini-jeu fini apres', () => {
    expect(partDeLAttente('munitions', 0, 1000, 1500)).toBeUndefined();
    expect(partDeLAttente('bataille', 0, undefined, 1500)).toBeUndefined();
    const permis = DUREES_MINIMALES_DES_TACHES_MS.bataille + MARGE_DE_L_ANNONCE_MS;
    expect(partDeLAttente('bataille', 0, permis, permis + 10)).toBeUndefined();
    expect(partDeLAttente('bataille', 0, 2000, 2000 + (permis - 2000) / 2)).toBeCloseTo(0.5);
    expect(partDeLAttente('bataille', 0, 2000, permis + 500)).toBe(1);
  });

  it('garde l ecran gagne de la bataille navale jusqu a la duree minimale, puis l annonce', () => {
    const { fenetre, annonces, attentes, image, ouverte } = monter();
    const table = {
      x: 740,
      y: 155,
      nom: "Table de jeu de l'arcade",
      natures: ['bataille'],
    } as const;
    fenetre.afficher(etat({ ...ouverte(), nature: 'bataille', station: table }));

    // Les bateaux de cette ouverture, tires de la meme graine que la fenetre; on vise au clavier
    // depuis la case du milieu, et l'on tire sur chaque case d'un bateau, sans un rate.
    const bateaux = placerLesBateaux(graineDuGeste('moi', table.nom, 'bataille'));
    let visee: readonly [number, number] = [2, 2];
    let instant = 0;
    image(instant);
    for (const [colonne, ligne] of bateaux.flat()) {
      while (visee[0] !== colonne) {
        touche(visee[0] < colonne ? 'ArrowRight' : 'ArrowLeft');
        visee = [visee[0] + (visee[0] < colonne ? 1 : -1), visee[1]];
      }
      while (visee[1] !== ligne) {
        touche(visee[1] < ligne ? 'ArrowDown' : 'ArrowUp');
        visee = [visee[0], visee[1] + (visee[1] < ligne ? 1 : -1)];
      }
      touche(' ');
      instant += TIR_MS;
      image(instant);
    }

    expect(fenetre.racine.querySelector('.tache-avancement')?.textContent).toBe(
      'Enregistrement du score',
    );
    expect(attentes.at(-1)).toBeGreaterThanOrEqual(0);
    expect(attentes.at(-1)).toBeLessThan(1);
    expect(annonces).toEqual([]);

    image(DUREES_MINIMALES_DES_TACHES_MS.bataille + MARGE_DE_L_ANNONCE_MS);
    expect(annonces).toEqual(['finie']);
    fenetre.demonter();
  });
});

describe('les touches d un geste', () => {
  it('lit les fleches, ZQSD et WASD, et Espace', () => {
    expect(['ArrowUp', 'z', 'W'].map(toucheDuGeste)).toEqual(['haut', 'haut', 'haut']);
    expect(['ArrowLeft', 'q', 'a'].map(toucheDuGeste)).toEqual(['gauche', 'gauche', 'gauche']);
    expect([' ', 'Spacebar'].map(toucheDuGeste)).toEqual(['espace', 'espace']);
    expect(toucheDuGeste('e')).toBeUndefined();
  });
});
