// @vitest-environment jsdom

/**
 * Tests de la carte plein ecran d'Among Ninjas (etape 7.21): elle s'ouvre et se ferme, montre
 * nos stations et notre liste, jamais les autres joueurs, et se ferme d'elle-meme hors du jeu.
 */

import type {
  AmongVu,
  DemandeSabotage,
  EntiteVue,
  EtatPriveAmong,
  NomDeSon,
  Nuisance,
  PhaseAmong,
} from '@neon-ninja/shared';
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
  const sabotages: DemandeSabotage[] = [];
  const maledictions: Nuisance[] = [];
  const sons = { jouer: (nom: NomDeSon) => joues.push(nom) } as unknown as LecteurDeSons;
  const carte = monterCarteAmong({
    document,
    sons,
    saboter: (demande) => sabotages.push(demande),
    maudire: (nature) => maledictions.push(nature),
  });
  document.body.append(carte.racine);
  return { carte, joues, sabotages, maledictions };
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

/** La meme partie, vue d'un autre role, avec ce que le flux dit du mode (etape 7.22). */
function etatDe(prive: EtatPriveAmong, among: Partial<AmongVu> = {}): EtatClient {
  const base = etat();
  const partie = base.partie ?? expect.fail('une partie');
  const commune = partie.among ?? expect.fail('le mode');

  return {
    ...base,
    partie: { ...partie, among: { ...commune, ...among } },
    among: { ...base.among, prive },
  };
}

const ASSASSIN: EtatPriveAmong = { ...PROIE, role: 'tueur', taches: [] };
const PROIE_FANTOME: EtatPriveAmong = { ...PROIE, fantome: true };

/** La carte montee, ouverte et affichee pour cet etat. */
function ouverte(client: EtatClient) {
  const monte = monter();
  monte.carte.basculer(client);
  monte.carte.afficher(client);
  return monte;
}

/** Le bouton du panneau de ce sabotage, ou de cette malediction. */
function boutonDe(racine: HTMLElement, nature: string): HTMLButtonElement {
  return (
    racine.querySelector<HTMLButtonElement>(`.carte-among-sabotage[data-nature="${nature}"]`) ??
    expect.fail(`le bouton ${nature}`)
  );
}

describe('le panneau des sabotages (etape 7.22)', () => {
  it('montre a un assassin les six sabotages, et en demande un au toucher', () => {
    const { carte, sabotages } = ouverte(etatDe(ASSASSIN, { rechargeDesSabotagesMs: 0 }));
    const panneau = carte.racine.querySelector<HTMLElement>('.carte-among-sabotages');

    expect(panneau?.hidden).toBe(false);
    expect(panneau?.dataset['genre']).toBe('sabotages');
    expect(carte.racine.querySelector('.carte-among-sabotages-etat')?.textContent).toBe('Prêt');
    expect(carte.racine.querySelectorAll('.carte-among-sabotage')).toHaveLength(6);

    boutonDe(carte.racine, 'panne').click();
    expect(sabotages).toEqual([{ nature: 'panne' }]);
    carte.demonter();
  });

  it('pose le nuage sur la station touchee, ou choisie au clavier, apres son bouton', () => {
    const { carte, sabotages } = ouverte(etatDe(ASSASSIN));
    const aide = carte.racine.querySelector<HTMLElement>('.carte-among-sabotages-aide');
    const reperes = Array.from(carte.racine.querySelectorAll<HTMLElement>('.carte-among-repere'));

    // Une station touchee sans avoir choisi le nuage ne demande rien.
    reperes[1]?.click();
    expect(sabotages).toEqual([]);
    expect(reperes.every((repere) => repere.tabIndex === -1)).toBe(true);

    boutonDe(carte.racine, 'nuage').click();
    expect(sabotages).toEqual([]);
    expect(aide?.hidden).toBe(false);
    expect(reperes.every((repere) => repere.tabIndex === 0)).toBe(true);
    reperes[1]?.click();
    expect(sabotages).toEqual([{ nature: 'nuage', station: 1 }]);
    expect(aide?.hidden).toBe(true);

    boutonDe(carte.racine, 'nuage').click();
    reperes[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(sabotages).toEqual([
      { nature: 'nuage', station: 1 },
      { nature: 'nuage', station: 0 },
    ]);
    carte.demonter();
  });

  it('renonce au nuage si son bouton est touche une seconde fois', () => {
    const { carte, sabotages } = ouverte(etatDe(ASSASSIN));

    boutonDe(carte.racine, 'nuage').click();
    boutonDe(carte.racine, 'nuage').click();
    carte.racine.querySelector<HTMLElement>('.carte-among-repere')?.click();

    expect(sabotages).toEqual([]);
    carte.demonter();
  });

  it('grise les boutons pendant la recharge, qui ne demandent plus rien', () => {
    const { carte, sabotages } = ouverte(etatDe(ASSASSIN, { rechargeDesSabotagesMs: 9_000 }));

    expect(carte.racine.querySelector('.carte-among-sabotages-etat')?.textContent).toBe(
      'Prochain dans 9 s',
    );
    expect(boutonDe(carte.racine, 'flou').disabled).toBe(true);
    boutonDe(carte.racine, 'flou').click();
    expect(sabotages).toEqual([]);

    // La recharge finie, les boutons reviennent a l'image suivante.
    carte.afficher(etatDe(ASSASSIN, { rechargeDesSabotagesMs: 0 }));
    expect(boutonDe(carte.racine, 'flou').disabled).toBe(false);
    carte.demonter();
  });

  it('oublie le choix du nuage quand un sabotage commence entre-temps', () => {
    const { carte, sabotages } = ouverte(etatDe(ASSASSIN));

    boutonDe(carte.racine, 'nuage').click();
    carte.afficher(
      etatDe(ASSASSIN, {
        sabotage: {
          nature: 'panne',
          restantMs: 0,
          consolesTenues: [false, false],
          consolesPurgees: [false, false],
          interrupteursCoupes: 0,
        },
      }),
    );
    carte.racine.querySelector<HTMLElement>('.carte-among-repere')?.click();

    expect(sabotages).toEqual([]);
    expect(carte.racine.classList.contains('choix-du-nuage')).toBe(false);
    carte.demonter();
  });

  it('n a pas de panneau pour une proie vivante', () => {
    const { carte } = ouverte(etat());

    expect(carte.racine.querySelector<HTMLElement>('.carte-among-sabotages')?.hidden).toBe(true);
    expect(carte.racine.querySelectorAll('.carte-among-sabotage')).toHaveLength(0);
    carte.demonter();
  });

  it('marque le boitier pendant la panne', () => {
    const { carte } = ouverte(
      etatDe(PROIE, {
        sabotage: {
          nature: 'panne',
          restantMs: 0,
          consolesTenues: [false, false],
          consolesPurgees: [false, false],
          interrupteursCoupes: 0,
        },
      }),
    );
    const postes = Array.from(carte.racine.querySelectorAll<HTMLElement>('.carte-among-poste'));

    expect(postes.filter((poste) => !poste.hidden)).toHaveLength(1);
    carte.demonter();
  });
});

describe('le panneau des maledictions (etape 7.22)', () => {
  it('montre a une proie fantome les trois malus, et maudit au toucher', () => {
    const { carte, maledictions, sabotages } = ouverte(etatDe(PROIE_FANTOME));
    const panneau = carte.racine.querySelector<HTMLElement>('.carte-among-sabotages');

    expect(panneau?.dataset['genre']).toBe('maledictions');
    expect(carte.racine.querySelector('.carte-among-sabotages-titre')?.textContent).toBe(
      'Maudire les assassins',
    );
    expect(carte.racine.querySelectorAll('.carte-among-sabotage')).toHaveLength(3);

    boutonDe(carte.racine, 'controlesInverses').click();
    expect(maledictions).toEqual(['controlesInverses']);
    expect(sabotages).toEqual([]);
    carte.demonter();
  });

  it('grise les malus pendant la recharge commune', () => {
    const { carte, maledictions } = ouverte(
      etatDe(PROIE_FANTOME, { rechargeDeLaMaledictionMs: 30_000 }),
    );

    boutonDe(carte.racine, 'flou').click();
    expect(maledictions).toEqual([]);
    expect(carte.racine.querySelector('.carte-among-sabotages-etat')?.textContent).toBe(
      'Prochain dans 30 s',
    );
    carte.demonter();
  });
});
