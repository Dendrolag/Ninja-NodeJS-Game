/**
 * Tests des pas entendus d'Among Ninjas cote serveur (etape 7.23), sans reseau: ce que la vue de
 * chacun en porte. Un vivant entend les pas des vivants qu'il ne voit pas, a portee, en
 * direction arrondie et en palier, sans position, sans marcheur, sans nombre exact. Un fantome
 * n'en recoit aucun.
 */

import { AMONG } from '@neon-ninja/shared';
import type { EtatAmong, EtatPartie, IdentifiantEntite, JoueurAmong } from '@neon-ninja/sim';
import { ajouterJoueur, creerEtatInitial, estTueur, lancerLaPartie, tick } from '@neon-ninja/sim';
import { describe, expect, it } from 'vitest';

import { vuePour, vuesDe, cleDeVue } from './vues.js';

/** Un alias qui ne sert jamais: aucune vue d'Among Ninjas ne masque. */
const SANS_ALIAS = (id: string): string => id;

/** Ou se tient la proie qui ecoute. */
const ICI = { x: 1000, y: 600 };

/** Une partie de cinq, nommes j1 a j5, au debut de son premier tour, sans foule. */
function enJeu(): EtatPartie {
  let etat = creerEtatInitial({ graine: 11, mode: 'among', reglages: { among: { foule: 0 } } });
  for (let rang = 1; rang <= 5; rang += 1) {
    etat = ajouterJoueur(etat, { id: `j${String(rang)}`, pseudo: `Joueur ${String(rang)}` });
  }
  const lancee = lancerLaPartie(etat);
  const charges = Object.fromEntries(
    Object.keys(lancee.joueurs).map((id) => [
      id,
      { deplacement: { x: 0, y: 0 }, enMouvement: false, carteChargee: true as const },
    ]),
  );

  return tick(tick(lancee, charges, 50), {}, AMONG.DUREE_REVELATION_MS);
}

function amongDe(etat: EtatPartie): EtatAmong {
  if (etat.among === undefined) {
    throw new Error('La partie devrait etre lancee.');
  }
  return etat.among;
}

function placer(etat: EtatPartie, id: IdentifiantEntite, x: number, y: number): EtatPartie {
  const joueur = etat.joueurs[id];
  if (joueur === undefined) {
    throw new Error(`${id} devrait etre la.`);
  }
  return { ...etat, joueurs: { ...etat.joueurs, [id]: { ...joueur, position: { x, y } } } };
}

function avecRole(
  etat: EtatPartie,
  id: IdentifiantEntite,
  champs: Partial<JoueurAmong>,
): EtatPartie {
  const among = amongDe(etat);
  const joueur = among.joueurs[id] as JoueurAmong;
  return {
    ...etat,
    among: { ...among, joueurs: { ...among.joueurs, [id]: { ...joueur, ...champs } } },
  };
}

/** Ces joueurs viennent de faire un pas. */
function marchent(etat: EtatPartie, ...ids: IdentifiantEntite[]): EtatPartie {
  return { ...etat, among: { ...amongDe(etat), pasDuBattement: ids } };
}

/**
 * La scene: une proie qui ecoute, ICI; le tueur a 300 pixels a l'est, hors de son disque de 260;
 * une proie a 450 au nord; une a 100 a l'ouest, en vue; une a 600 au sud, hors de portee.
 */
function scene(): {
  etat: EtatPartie;
  ecoute: string;
  tueur: string;
  nord: string;
  enVue: string;
  horsDePortee: string;
} {
  const base = enJeu();
  const ids = Object.keys(base.joueurs);
  const tueur = ids.find((id) => estTueur(base, id)) as string;
  const [ecoute, nord, enVue, horsDePortee] = ids.filter((id) => id !== tueur) as [
    string,
    string,
    string,
    string,
  ];
  let etat = placer(base, ecoute, ICI.x, ICI.y);
  etat = placer(etat, tueur, ICI.x + 300, ICI.y);
  etat = placer(etat, nord, ICI.x, ICI.y - 450);
  etat = placer(etat, enVue, ICI.x - 100, ICI.y);
  etat = placer(etat, horsDePortee, ICI.x, ICI.y + 600);

  return { etat, ecoute, tueur, nord, enVue, horsDePortee };
}

describe('les pas entendus dans les vues (etape 7.23)', () => {
  it('font entendre a un vivant les pas hors de vue, en direction et en palier seulement', () => {
    const { etat, ecoute, tueur, nord } = scene();
    const vue = vuePour(marchent(etat, tueur, nord), ecoute, SANS_ALIAS);

    // L'est au palier moyen, le nord au palier lointain, ranges dans leur ordre.
    expect(vue.among?.pas).toEqual([
      { secteur: 0, palier: 1 },
      { secteur: 6, palier: 2 },
    ]);
    expect(vue.entites.map((entite) => entite.id)).not.toContain(tueur);
    // Rien d'autre que le secteur et le palier: ni position, ni marcheur.
    for (const pas of vue.among?.pas ?? []) {
      expect(Object.keys(pas).sort()).toEqual(['palier', 'secteur']);
    }
  });

  it('taisent ses propres pas, ceux qu il voit, et ceux d au-dela de la portee', () => {
    const { etat, ecoute, enVue, horsDePortee } = scene();
    const vue = vuePour(marchent(etat, ecoute, enVue, horsDePortee), ecoute, SANS_ALIAS);

    expect(vue.entites.map((entite) => entite.id)).toContain(enVue);
    expect(vue.among).toBeDefined();
    expect(vue.among).not.toHaveProperty('pas');
  });

  it('ne disent pas combien marchent: un seul pas par secteur et par palier', () => {
    const { etat, ecoute, tueur, nord } = scene();
    // Le nord rejoint le tueur, a l'est, presque au meme endroit.
    const cote = placer(etat, nord, ICI.x + 310, ICI.y + 20);

    expect(vuePour(marchent(cote, tueur, nord), ecoute, SANS_ALIAS).among?.pas).toEqual([
      { secteur: 0, palier: 1 },
    ]);
  });

  it('ne suivent pas l ordre de l etat', () => {
    const { etat, ecoute, tueur, nord } = scene();

    expect(vuePour(marchent(etat, nord, tueur), ecoute, SANS_ALIAS).among?.pas).toEqual(
      vuePour(marchent(etat, tueur, nord), ecoute, SANS_ALIAS).among?.pas,
    );
  });

  it('s entendent a travers le nuage noir, qui cache le marcheur', () => {
    const { etat, ecoute, tueur } = scene();
    const station = 0;
    const centre = amongDe(etat).stations[station] as { x: number; y: number };
    // La proie au bord du nuage, le tueur dedans, a 120 pixels d'elle: en vue sans le nuage.
    let nuage = placer(etat, ecoute, centre.x - AMONG.RAYON_DU_NUAGE_PX - 20, centre.y);
    nuage = placer(nuage, tueur, centre.x - AMONG.RAYON_DU_NUAGE_PX + 100, centre.y);
    nuage = {
      ...nuage,
      among: {
        ...amongDe(nuage),
        sabotage: {
          nature: 'nuage',
          restantMs: 10_000,
          station,
          reparationMs: 0,
          consolesTenues: [false, false],
          consolesPurgees: [false, false],
          interrupteursCoupes: 0,
        },
      },
    };
    const vue = vuePour(marchent(nuage, tueur), ecoute, SANS_ALIAS);

    expect(vue.entites.map((entite) => entite.id)).not.toContain(tueur);
    expect(vue.among?.pas).toEqual([{ secteur: 0, palier: 0 }]);
  });

  it('se font entendre d un assassin, et jamais d un fantome', () => {
    const { etat, ecoute, tueur } = scene();
    // L'ecoute marche, a 300 pixels a l'ouest du tueur, dont la vision normale va a 320.
    const loin = placer(etat, ecoute, ICI.x - 100, ICI.y);
    const fantome = avecRole(marchent(etat, tueur), ecoute, { fantome: true });

    expect(vuePour(marchent(loin, ecoute), tueur, SANS_ALIAS).among?.pas).toEqual([
      { secteur: 4, palier: 2 },
    ]);
    expect(vuePour(fantome, ecoute, SANS_ALIAS).among).not.toHaveProperty('pas');
  });

  it('taisent un marcheur deja fantome', () => {
    const { etat, ecoute, tueur, nord } = scene();
    const mort = avecRole(marchent(etat, tueur, nord), nord, { fantome: true });

    expect(vuePour(mort, ecoute, SANS_ALIAS).among?.pas).toEqual([{ secteur: 0, palier: 1 }]);
  });

  it('ne touchent pas la vue des fantomes, partagee', () => {
    const { etat, ecoute, nord, tueur } = scene();
    const fantome = avecRole(marchent(etat, tueur), nord, { fantome: true });
    const cles = [cleDeVue(fantome, ecoute), cleDeVue(fantome, nord)];
    const vues = vuesDe(fantome, cles, SANS_ALIAS);

    expect(vues.get(cles[0] as string)?.among?.pas).toEqual([{ secteur: 0, palier: 1 }]);
    expect(vues.get(cles[1] as string)?.among).not.toHaveProperty('pas');
  });
});
