// @vitest-environment jsdom

/**
 * Tests de la fenetre d'une reparation d'Among Ninjas (etape 7.27): elle s'ouvre et se ferme sur
 * ce que dit l'etat, fige le jeu pendant ce temps, montre le geste de la reparation tiree, et
 * n'annonce la fin qu'apres sa duree minimale; aux deux cles, elle passe de la purge a la cle,
 * que le clavier et le doigt tiennent; au relais, elle attend son tour, et chaque interrupteur
 * est un geste neuf.
 */

import type { EtatPriveAmong, PosteDeReparation, SabotageEnCoursVu } from '@neon-ninja/shared';
import { DUREES_MINIMALES_DES_REPARATIONS_MS, REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { EtatClient } from '../../etat.js';
import { ETAT_INITIAL } from '../../etat.js';
import { creerHorlogeClientManuelle } from '../../horloge.js';
import type { DessinDeReparation } from './dessinsDesReparations.js';
import { monterFenetreDeReparation } from './reparation.js';
import { MARGE_DE_L_ANNONCE_MS } from './tache.js';

/** Un sabotage en cours, tel que le flux le dit. */
function sabotage(champs: Partial<SabotageEnCoursVu>): SabotageEnCoursVu {
  return {
    nature: 'panne',
    restantMs: 0,
    consolesTenues: [false, false],
    reparation: 'fusibles',
    consolesPurgees: [false, false],
    interrupteursCoupes: 0,
    ...champs,
  };
}

/** L'etat d'une partie Among Ninjas ou cette reparation est ouverte, pendant ce sabotage. */
function etat(poste: PosteDeReparation | undefined, enCours: SabotageEnCoursVu): EtatClient {
  const prive: EtatPriveAmong = {
    role: 'proie',
    complices: [],
    fantome: false,
    gong: { x: 0, y: 0 },
    stations: [],
    taches: [],
    ...(poste === undefined ? {} : { reparationEnCours: poste }),
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
    partie: {
      tick: 1,
      tempsRestantMs: 0,
      enPause: false,
      entites: [],
      objets: [],
      zones: [],
      classement: [],
      among: { phase: 'jeu', restantMs: 0, tachesFaites: 0, tachesTotal: 10, sabotage: enCours },
    },
    among: {
      prive,
      reunion: undefined,
      morts: [],
      ...(poste === undefined ? {} : { reparationOuverte: { poste, depuis: 0 } }),
    },
  };
}

/** Une fenetre montee avec une horloge, des images et un client pilotes a la main. */
function monter(tactile = false) {
  const horloge = creerHorlogeClientManuelle();
  const rappels: (() => void)[] = [];
  const ouvertures: boolean[] = [];
  const annonces: string[] = [];
  const actions: boolean[] = [];
  const dessins: DessinDeReparation[] = [];
  const fenetre = monterFenetreDeReparation({
    document,
    client: {
      finirLaReparation: () => annonces.push('finie'),
      fermerLaReparation: () => annonces.push('fermee'),
      tenirLAction: (tenue) => actions.push(tenue),
    },
    horloge,
    tactile,
    surOuverture: (ouverte) => ouvertures.push(ouverte),
    peindre: (_toile, dessin) => {
      dessins.push(dessin);
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
    rappels.shift()?.();
  };

  return { fenetre, ouvertures, annonces, actions, dessins, image };
}

/** Une touche du clavier, enfoncee ou relachee, sur le document. */
function touche(cle: string, type: 'keydown' | 'keyup' = 'keydown', repeat = false): void {
  document.dispatchEvent(new KeyboardEvent(type, { key: cle, cancelable: true, repeat }));
}

/** Le texte d'un element de la fenetre. */
function texte(racine: HTMLElement, selecteur: string): string | null | undefined {
  return racine.querySelector(selecteur)?.textContent;
}

describe('la fenetre d une reparation', () => {
  it('s ouvre sur la reparation de la panne tiree, la nomme, et fige le jeu', () => {
    const { fenetre, ouvertures, dessins, image } = monter();

    fenetre.afficher(etat('boitier', sabotage({ reparation: 'frequence' })));
    image(16);

    expect(fenetre.racine.hidden).toBe(false);
    expect(ouvertures).toEqual([true]);
    expect(texte(fenetre.racine, '.reparation-titre')).toBe('Accorder la fréquence');
    expect(texte(fenetre.racine, '.reparation-poste')).toBe('Générateur de la rue');
    expect(fenetre.racine.querySelector('.reparation-fenetre')?.getAttribute('data-sabotage')).toBe(
      'panne',
    );
    expect(dessins.at(-1)).toMatchObject({ genre: 'geste', geste: { nature: 'frequence' } });

    fenetre.afficher(etat(undefined, sabotage({})));
    expect(fenetre.racine.hidden).toBe(true);
    expect(ouvertures).toEqual([true, false]);
  });

  it('dit l aide au doigt seulement, sur un ecran tactile', () => {
    const { fenetre } = monter(true);

    fenetre.afficher(etat('boitier', sabotage({ reparation: 'lanceur' })));

    expect(texte(fenetre.racine, '.reparation-aide')).not.toMatch(/Clavier/u);
  });

  it('se ferme quand le sabotage finit, repare par un autre', () => {
    const { fenetre } = monter();

    fenetre.afficher(etat('boitier', sabotage({})));
    const sansSabotage = etat('boitier', sabotage({}));
    fenetre.afficher({
      ...sansSabotage,
      partie:
        sansSabotage.partie === undefined
          ? undefined
          : {
              ...sansSabotage.partie,
              among: { phase: 'jeu', restantMs: 0, tachesFaites: 0, tachesTotal: 10 },
            },
    });

    expect(fenetre.racine.hidden).toBe(true);
  });

  it('n annonce le geste fini qu apres sa duree minimale', () => {
    const { fenetre, annonces, image } = monter();

    fenetre.afficher(etat(0, sabotage({ nature: 'surchauffe', reparation: 'relais' })));
    image(0);
    // L'interrupteur, au clavier: la fleche bas tenue jusqu'au declic.
    touche('ArrowDown');
    for (let instant = 16; instant <= 700; instant += 16) {
      image(instant);
    }
    expect(annonces).toEqual([]);

    image(DUREES_MINIMALES_DES_REPARATIONS_MS.interrupteur + MARGE_DE_L_ANNONCE_MS + 20);
    expect(annonces).toEqual(['finie']);
  });

  it('ferme a Echap, et le dit au serveur', () => {
    const { fenetre, annonces, ouvertures } = monter();

    fenetre.afficher(etat('boitier', sabotage({})));
    touche('Escape');

    expect(fenetre.racine.hidden).toBe(true);
    expect(annonces).toEqual(['fermee']);
    expect(ouvertures).toEqual([true, false]);
  });

  it('passe de la purge a la cle, que le clavier tient, et dit l autre console', () => {
    const { fenetre, actions, dessins, image } = monter();
    const cles = sabotage({ nature: 'surchauffe', reparation: 'cles', restantMs: 30_000 });

    fenetre.afficher(etat(1, cles));
    expect(texte(fenetre.racine, '.reparation-titre')).toBe('Purger la console');
    expect(texte(fenetre.racine, '.reparation-statut')).toBe('Autre console : en attente');

    fenetre.afficher(
      etat(1, { ...cles, consolesPurgees: [true, true], consolesTenues: [true, false] }),
    );
    expect(texte(fenetre.racine, '.reparation-titre')).toBe('Tourner la clé');
    expect(texte(fenetre.racine, '.reparation-statut')).toBe('Autre console : clé tournée');

    // La touche d'action repetee, tenue depuis l'ouverture, tient la cle; Espace aussi.
    touche('e', 'keydown', true);
    image(16);
    expect(actions).toEqual([true]);
    expect(dessins.at(-1)).toEqual({ genre: 'cle', tournee: true, autreTournee: true });
    touche('e', 'keyup');
    touche(' ');
    touche(' ', 'keyup');
    expect(actions).toEqual([true, false, true, false]);
  });

  it('lache la cle en se fermant', () => {
    const { fenetre, actions } = monter();
    const purgees = sabotage({
      nature: 'surchauffe',
      reparation: 'cles',
      consolesPurgees: [true, false],
    });

    fenetre.afficher(etat(0, purgees));
    touche(' ');
    fenetre.afficher(etat(undefined, purgees));

    expect(actions).toEqual([true, false]);
  });

  it('attend son tour au relais, et donne un interrupteur neuf a chaque tour', () => {
    const { fenetre, dessins, image } = monter();
    const relais = sabotage({ nature: 'surchauffe', reparation: 'relais' });

    fenetre.afficher(etat(0, { ...relais, interrupteursCoupes: 1, prochaineConsole: 1 }));
    image(16);
    expect(texte(fenetre.racine, '.reparation-statut')).toBe(
      'Interrupteurs coupés : 1 sur 4. À l’autre console',
    );
    expect(dessins.at(-1)).toEqual({ genre: 'attente', interrupteursCoupes: 1 });

    fenetre.afficher(etat(0, { ...relais, interrupteursCoupes: 2, prochaineConsole: 0 }));
    image(32);
    expect(texte(fenetre.racine, '.reparation-statut')).toBe(
      'Interrupteurs coupés : 2 sur 4. À vous',
    );
    expect(dessins.at(-1)).toMatchObject({
      genre: 'geste',
      geste: { nature: 'interrupteur', position: 0 },
    });
  });
});
