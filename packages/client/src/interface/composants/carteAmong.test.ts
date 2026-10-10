// @vitest-environment jsdom

/**
 * Tests de la carte plein ecran d'Among Ninjas (etape 7.21): elle s'ouvre et se ferme, montre
 * nos stations et notre liste, jamais les autres joueurs, et se ferme d'elle-meme hors du jeu.
 */

import type { EntiteVue, EtatPriveAmong, NomDeSon, PhaseAmong } from '@neon-ninja/shared';
import { REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { EtatClient } from '../../etat.js';
import { ETAT_INITIAL } from '../../etat.js';
import type { LecteurDeSons } from '../../sons/lecteur.js';
import { monterCarteAmong } from './carteAmong.js';

const PROIE: EtatPriveAmong = {
  role: 'proie',
  complices: [],
  fantome: false,
  gong: { x: 1145, y: 630 },
  stations: [
    { x: 170, y: 180, nom: 'Pierre du jardin zen', natures: ['katana'] },
    { x: 1320, y: 1070, nom: 'Tapis du salon', natures: ['fumee'] },
  ],
  taches: [
    { station: 0, nature: 'katana', faite: true },
    { station: 1, nature: 'fumee', faite: false },
  ],
  gongUtilise: false,
};

/** Un joueur vu. */
function joueur(id: string, couleur: string): EntiteVue {
  return {
    type: 'joueur',
    id,
    x: 500,
    y: 500,
    couleur,
    direction: 'sud',
    pseudo: id,
    invincible: false,
    protege: false,
  };
}

/** Une partie en cette phase, nous et un autre joueur en vue. */
function etat(phase: PhaseAmong = 'jeu'): EtatClient {
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
      reglages: { ...REGLAGES_PAR_DEFAUT, carte: 'map1' },
    },
    partie: {
      tick: 1,
      tempsRestantMs: 0,
      enPause: false,
      entites: [joueur('moi', '#2EE6FF'), joueur('autre', '#FF5FD2')],
      objets: [],
      zones: [],
      classement: [],
      among: { phase, restantMs: 0, tachesFaites: 1, tachesTotal: 10 },
    },
    among: { prive: PROIE, reunion: undefined, morts: [] },
  };
}

function monter() {
  const joues: NomDeSon[] = [];
  const sons = { jouer: (nom: NomDeSon) => joues.push(nom) } as unknown as LecteurDeSons;
  const carte = monterCarteAmong({ document, sons });
  document.body.append(carte.racine);
  return { carte, joues };
}

describe('la carte plein ecran', () => {
  it('s ouvre et se ferme a la demande, avec un son', () => {
    const { carte, joues } = monter();

    expect(carte.estOuverte()).toBe(false);
    carte.basculer(etat());
    expect(carte.estOuverte()).toBe(true);
    carte.basculer(etat());
    expect(carte.estOuverte()).toBe(false);
    expect(joues).toEqual(['carteOuverte', 'carteOuverte']);
    carte.demonter();
  });

  it('montre nos stations nommees, faites cochees, notre liste, et nous', () => {
    const { carte } = monter();
    carte.basculer(etat());
    carte.afficher(etat());

    const reperes = [...carte.racine.querySelectorAll('.carte-among-repere')];
    expect(reperes.map((repere) => repere.textContent)).toEqual([
      'Aiguiser un katana',
      'Remplir de fumée',
    ]);
    expect(reperes.map((repere) => repere.classList.contains('faite'))).toEqual([true, false]);
    expect(carte.racine.querySelector('.carte-among-titre')?.textContent).toBe(
      'Mes tâches 1 sur 2',
    );
    expect(carte.racine.querySelectorAll('.carte-among-ligne')).toHaveLength(2);
    expect(carte.racine.querySelector<HTMLElement>('.carte-among-moi')?.hidden).toBe(false);
    carte.demonter();
  });

  it('ne montre jamais les autres joueurs', () => {
    const { carte } = monter();
    carte.basculer(etat());
    carte.afficher(etat());

    expect(carte.racine.innerHTML).not.toContain('FF5FD2');
    expect(carte.racine.innerHTML).not.toContain('autre');
    carte.demonter();
  });

  it('ne s ouvre pas hors du jeu, en reunion par exemple', () => {
    const { carte, joues } = monter();

    for (const phase of ['revelation', 'discussion', 'vote', 'ejection'] as const) {
      carte.basculer(etat(phase));
      expect(carte.estOuverte()).toBe(false);
    }

    expect(joues).toEqual([]);
    carte.demonter();
  });

  it('se ferme hors du jeu, et par Echap', () => {
    const { carte } = monter();
    carte.basculer(etat());
    carte.afficher(etat('discussion'));
    expect(carte.estOuverte()).toBe(false);

    carte.basculer(etat());
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(carte.estOuverte()).toBe(false);
    carte.demonter();
  });

  it('se ferme par sa croix', () => {
    const { carte } = monter();
    carte.basculer(etat());
    carte.racine.querySelector<HTMLButtonElement>('.carte-among-fermer')?.click();

    expect(carte.estOuverte()).toBe(false);
    carte.demonter();
  });
});
