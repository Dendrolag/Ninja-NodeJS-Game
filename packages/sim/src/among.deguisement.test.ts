/**
 * Tests du deguisement en PNJ d'Among Ninjas (etape 7.28): l'assassin qui tue un PNJ et en prend
 * l'apparence, l'habit que la proie ramasse et revet, et tout ce qui fait tomber le deguisement.
 * Ce que chacun en voit est l'affaire du serveur (packages/server/src/vues.ts), et se teste la-bas.
 *
 * Aucune version du jeu d'origine n'a ce mode: les attentes sont la fiche docs/plan/etape-7-28.md
 * et les decisions du porteur du projet des 14 et 16 octobre 2026.
 */

import type { Position } from '@neon-ninja/shared';
import {
  AMONG,
  AMONG_PAR_DEFAUT,
  COULEUR_DE_LA_FOULE,
  dureeDuDeguisementMs,
} from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { EtatPartie, IdentifiantEntite } from './etat.js';
import { ajouterBot, ajouterJoueur, creerEtatInitial } from './etat.js';
import type { EtatAmong, EvenementAmong, JoueurAmong } from './etatAmong.js';
import type { EntreeJoueur, Entrees } from './moteur.js';
import { lancerLaPartie, tick } from './moteur.js';

/** Un battement du serveur. */
const BATTEMENT_MS = 50;

/**
 * Le deguisement d'un assassin: la recharge du meurtre par defaut, et cinq secondes de plus
 * (retour du porteur du projet du 16 octobre 2026).
 */
const DUREE_ASSASSIN_MS = dureeDuDeguisementMs('tueur', AMONG_PAR_DEFAUT.rechargeMeurtreS);

/** Une entree sans deplacement, a completer d'un geste. */
const IMMOBILE: EntreeJoueur = { deplacement: { x: 0, y: 0 }, enMouvement: false };

/** Une place libre de Tokyo, loin de tout: le milieu de la grande rue. */
const ICI: Position = { x: 600, y: 680 };

/** Les reglages des parties du test: aucune foule par defaut, des reunions courtes. */
interface Options {
  readonly foule?: number;
  readonly graine?: number;
}

/** Une partie de cinq joueurs, nommes j1 a j5, au debut de son premier tour. */
function enJeu({ foule = 0, graine = 7 }: Options = {}): EtatPartie {
  let etat = creerEtatInitial({
    graine,
    mode: 'among',
    reglages: { among: { foule, discussionS: 15, voteS: 15 } },
  });

  for (let rang = 1; rang <= 5; rang += 1) {
    etat = ajouterJoueur(etat, { id: `j${String(rang)}`, pseudo: `J${String(rang)}` });
  }

  etat = lancerLaPartie(etat);
  const charges: Entrees = Object.fromEntries(
    Object.keys(etat.joueurs).map((id) => [id, { ...IMMOBILE, carteChargee: true as const }]),
  );
  etat = tick(etat, charges, BATTEMENT_MS);

  return tick(etat, {}, AMONG.DUREE_REVELATION_MS);
}

function amongDe(etat: EtatPartie): EtatAmong {
  if (etat.among === undefined) {
    throw new Error('La partie devrait etre lancee.');
  }
  return etat.among;
}

function role(etat: EtatPartie, id: IdentifiantEntite): JoueurAmong {
  const joueur = amongDe(etat).joueurs[id];
  if (joueur === undefined) {
    throw new Error(`Le joueur ${id} devrait etre dans la partie.`);
  }
  return joueur;
}

/** L'assassin de la partie, et ses proies. */
function camps(etat: EtatPartie): { readonly tueur: IdentifiantEntite; readonly proies: string[] } {
  const ids = Object.keys(etat.joueurs);
  const tueur = ids.find((id) => role(etat, id).role === 'tueur') as IdentifiantEntite;
  return { tueur, proies: ids.filter((id) => id !== tueur) };
}

/** Pose un joueur a cette place. */
function placer(etat: EtatPartie, id: IdentifiantEntite, position: Position): EtatPartie {
  const joueur = etat.joueurs[id];
  if (joueur === undefined) {
    throw new Error(`Le joueur ${id} devrait etre dans la partie.`);
  }
  return { ...etat, joueurs: { ...etat.joueurs, [id]: { ...joueur, position } } };
}

/** Change ce que le mode retient d'un joueur. */
function changer(
  etat: EtatPartie,
  id: IdentifiantEntite,
  champs: Partial<JoueurAmong>,
): EtatPartie {
  const among = amongDe(etat);
  return {
    ...etat,
    among: { ...among, joueurs: { ...among.joueurs, [id]: { ...role(etat, id), ...champs } } },
  };
}

/** Eloigne tout le monde les uns des autres, sur une ligne de la grande rue. */
function eloigner(etat: EtatPartie): EtatPartie {
  return Object.keys(etat.joueurs).reduce(
    (courant, id, rang) => placer(courant, id, { x: 200 + rang * 300, y: 680 }),
    etat,
  );
}

/** Un PNJ pose a cette place. */
function avecUnPnj(etat: EtatPartie, id: string, position: Position): EtatPartie {
  return ajouterBot(etat, { id, type: 'bot', position, couleur: COULEUR_DE_LA_FOULE });
}

/** Un battement ou ce joueur fait ce geste, les autres immobiles. */
function geste(etat: EtatPartie, id: IdentifiantEntite, champs: Partial<EntreeJoueur>): EtatPartie {
  return tick(etat, { [id]: { ...IMMOBILE, ...champs } }, BATTEMENT_MS);
}

/** Les evenements du mode du dernier battement, de ce type. */
function evenements<T extends EvenementAmong['type']>(
  etat: EtatPartie,
  type: T,
): Extract<EvenementAmong, { type: T }>[] {
  return etat.evenements.filter(
    (evenement): evenement is Extract<EvenementAmong, { type: T }> => evenement.type === type,
  );
}

/** L'assassin, pret a tuer, a cote d'un PNJ, loin de toute proie. */
function assassinPresDUnPnj(): { readonly etat: EtatPartie; readonly tueur: string } {
  let etat = eloigner(enJeu());
  const { tueur } = camps(etat);
  etat = changer(placer(etat, tueur, ICI), tueur, { rechargeMs: 0 });
  etat = avecUnPnj(etat, 'pnj-a', { x: ICI.x + 12, y: ICI.y });

  return { etat, tueur };
}

describe('l assassin qui tue un PNJ', () => {
  it('le tue, laisse un cadavre gris, prend son apparence le temps de sa recharge et cinq secondes, et paie la recharge', () => {
    const { etat, tueur } = assassinPresDUnPnj();
    const apres = geste(etat, tueur, { capturer: true });
    const lui = role(apres, tueur);

    expect(apres.bots['pnj-a']).toBeUndefined();
    expect(Object.values(amongDe(apres).cadavres)).toEqual([
      expect.objectContaining({ victime: 'pnj-a', couleur: COULEUR_DE_LA_FOULE, pnj: true }),
    ]);
    expect(lui.deguisementMs).toBe(DUREE_ASSASSIN_MS);
    expect(DUREE_ASSASSIN_MS).toBe(30_000);
    // Deguise, il peut frapper de nouveau avant que le deguisement tombe.
    expect(lui.rechargeMs).toBeLessThan(DUREE_ASSASSIN_MS);
    expect(lui.deguisements).toBe(1);
    expect(lui.rechargeMs).toBeGreaterThan(0);
    // Aucun point: ce n'est pas un meurtre.
    expect(lui.faits.meurtres).toBe(0);
    expect(evenements(apres, 'pnjTue')).toEqual([expect.objectContaining({ tueur, pnj: 'pnj-a' })]);
    expect(evenements(apres, 'deguisement')).toEqual([
      { type: 'deguisement', joueur: tueur, quoi: 'debut' },
    ]);
    expect(evenements(apres, 'meurtre')).toEqual([]);
  });

  it('ne fait rien sans PNJ a portee, ni avant la fin de sa recharge', () => {
    const { etat, tueur } = assassinPresDUnPnj();
    const loin = avecUnPnj(eloigner(enJeu()), 'pnj-b', {
      x: ICI.x + AMONG.PORTEE_DU_MEURTRE_PX + 20,
      y: ICI.y,
    });
    const { tueur: autreTueur } = camps(loin);
    const sansPortee = geste(
      changer(placer(loin, autreTueur, ICI), autreTueur, { rechargeMs: 0 }),
      autreTueur,
      { capturer: true },
    );

    expect(sansPortee.bots['pnj-b']).toBeDefined();
    expect(role(sansPortee, autreTueur).deguisementMs).toBeUndefined();

    const enRecharge = geste(changer(etat, tueur, { rechargeMs: 5000 }), tueur, {
      capturer: true,
    });
    expect(enRecharge.bots['pnj-a']).toBeDefined();
    expect(role(enRecharge, tueur).deguisementMs).toBeUndefined();
  });

  it('tue la proie a portee plutot que le PNJ', () => {
    const { etat, tueur } = assassinPresDUnPnj();
    const proie = camps(etat).proies[0] as string;
    const apres = geste(placer(etat, proie, { x: ICI.x - 20, y: ICI.y }), tueur, {
      capturer: true,
    });

    expect(role(apres, proie).fantome).toBe(true);
    expect(apres.bots['pnj-a']).toBeDefined();
    expect(role(apres, tueur).deguisementMs).toBeUndefined();
  });

  it('repart pour tout son temps en tuant un autre PNJ deguise, sans cumul ni nouveau debut', () => {
    const { etat, tueur } = assassinPresDUnPnj();
    let apres = geste(etat, tueur, { capturer: true });
    apres = tick(apres, {}, 6000);
    apres = avecUnPnj(changer(apres, tueur, { rechargeMs: 0 }), 'pnj-c', {
      x: (apres.joueurs[tueur]?.position.x ?? 0) + 12,
      y: apres.joueurs[tueur]?.position.y ?? 0,
    });
    apres = geste(apres, tueur, { capturer: true });

    expect(apres.bots['pnj-c']).toBeUndefined();
    expect(role(apres, tueur).deguisementMs).toBe(DUREE_ASSASSIN_MS);
    expect(role(apres, tueur).deguisements).toBe(1);
    expect(evenements(apres, 'deguisement')).toEqual([]);
  });

  it('reprend sa couleur sur-le-champ en tuant une proie', () => {
    const { etat, tueur } = assassinPresDUnPnj();
    let apres = geste(etat, tueur, { capturer: true });
    const proie = camps(apres).proies[0] as string;
    const ici = apres.joueurs[tueur]?.position as Position;
    apres = placer(changer(apres, tueur, { rechargeMs: 0 }), proie, { x: ici.x + 20, y: ici.y });
    apres = geste(apres, tueur, { capturer: true });

    expect(role(apres, proie).fantome).toBe(true);
    expect(role(apres, tueur).deguisementMs).toBeUndefined();
    expect(evenements(apres, 'deguisement')).toEqual([
      { type: 'deguisement', joueur: tueur, quoi: 'fin' },
    ]);
  });

  it('perd son deguisement au bout de sa recharge et cinq secondes de jeu', () => {
    const { etat, tueur } = assassinPresDUnPnj();
    let apres = geste(etat, tueur, { capturer: true });
    apres = tick(apres, {}, DUREE_ASSASSIN_MS - 100);
    expect(role(apres, tueur).deguisementMs).toBe(100);

    apres = tick(apres, {}, BATTEMENT_MS);
    expect(role(apres, tueur).deguisementMs).toBe(50);
    apres = tick(apres, {}, BATTEMENT_MS);
    expect(role(apres, tueur).deguisementMs).toBeUndefined();
    expect(evenements(apres, 'deguisement')).toEqual([
      { type: 'deguisement', joueur: tueur, quoi: 'fin' },
    ]);
  });

  it('marche sans bruit, deguise, comme un PNJ', () => {
    const { etat, tueur } = assassinPresDUnPnj();
    let apres = geste(etat, tueur, { capturer: true });
    const marche: EntreeJoueur = { deplacement: { x: 0, y: 1 }, enMouvement: true };
    const pas: string[] = [];

    for (let battement = 0; battement < 20; battement += 1) {
      apres = tick(apres, { [tueur]: marche }, BATTEMENT_MS);
      pas.push(...(amongDe(apres).pasDuBattement ?? []));
    }

    expect(pas).not.toContain(tueur);
  });
});

describe('le cadavre d un PNJ et la reunion', () => {
  it('ne se signale pas: le bouton d action l ignore', () => {
    const { etat, tueur } = assassinPresDUnPnj();
    const apres = geste(etat, tueur, { capturer: true });
    const proie = camps(apres).proies[0] as string;
    const cadavre = Object.values(amongDe(apres).cadavres)[0]?.position as Position;
    const signale = geste(placer(apres, proie, { x: cadavre.x + 30, y: cadavre.y }), proie, {
      agir: true,
    });

    expect(amongDe(signale).phase).toBe('jeu');
  });

  it('fait tomber tous les deguisements a son ouverture', () => {
    const { etat, tueur } = assassinPresDUnPnj();
    let apres = geste(etat, tueur, { capturer: true });
    const proie = camps(apres).proies[0] as string;
    // Le gong sonne apres son delai; l'assassin est encore deguise.
    apres = tick(apres, {}, AMONG.DELAI_DU_GONG_MS);
    apres = changer(apres, proie, { deguisementMs: 8000, deguisements: 1 });
    const gong = amongDe(apres).gong;
    apres = geste(placer(apres, proie, gong), proie, { agir: true });

    expect(amongDe(apres).phase).toBe('discussion');
    expect(role(apres, tueur).deguisementMs).toBeUndefined();
    expect(role(apres, proie).deguisementMs).toBeUndefined();
    expect(
      evenements(apres, 'deguisement')
        .map(({ joueur }) => joueur)
        .sort(),
    ).toEqual([tueur, proie].sort());
  });

  it('reforme la foule au tour suivant', () => {
    let etat = enJeu({ foule: 3 });
    const { tueur } = camps(etat);
    const pnj = Object.values(etat.bots)[0];
    etat = changer(
      placer(etat, tueur, { x: (pnj?.position.x ?? 0) + 10, y: pnj?.position.y ?? 0 }),
      tueur,
      {
        rechargeMs: 0,
      },
    );
    etat = geste(etat, tueur, { capturer: true });
    expect(Object.keys(etat.bots)).toHaveLength(2);

    // Une reunion par le gong, puis la discussion, le vote et l'ejection passent.
    etat = tick(etat, {}, AMONG.DELAI_DU_GONG_MS);
    const proie = camps(etat).proies[0] as string;
    etat = geste(placer(etat, proie, amongDe(etat).gong), proie, { agir: true });
    expect(amongDe(etat).phase).toBe('discussion');
    etat = tick(etat, {}, 15_000);
    etat = tick(etat, {}, 15_000);
    etat = tick(etat, {}, AMONG.DUREE_EJECTION_MS);

    expect(amongDe(etat).phase).toBe('jeu');
    expect(amongDe(etat).tour).toBe(2);
    expect(Object.values(etat.bots).filter((bot) => bot.type === 'bot')).toHaveLength(3);
    expect(amongDe(etat).cadavres).toEqual({});
  });
});

describe('l habit de la proie', () => {
  it('se pose des le lancement, loin du gong et des stations, a la meme place a graine egale', () => {
    const among = amongDe(enJeu());
    const habit = among.habit as Position;
    const loin = (une: Position, autre: Position) => Math.hypot(une.x - autre.x, une.y - autre.y);

    expect(habit).toBeDefined();
    expect(loin(habit, among.gong)).toBeGreaterThanOrEqual(AMONG.ECART_DE_L_HABIT_AU_GONG_PX);
    for (const station of among.stations) {
      expect(loin(habit, station)).toBeGreaterThanOrEqual(AMONG.ECART_DE_L_HABIT_AUX_STATIONS_PX);
    }
    expect(amongDe(enJeu()).habit).toEqual(habit);
    expect(amongDe(enJeu({ graine: 8 })).habit).not.toEqual(habit);
  });

  it('se prend par une proie vivante qui passe dessus, et revient ailleurs 45 secondes apres', () => {
    let etat = eloigner(enJeu());
    const { tueur, proies } = camps(etat);
    const habit = amongDe(etat).habit as Position;
    const proie = proies[0] as string;

    // L'assassin passe dessus: rien.
    etat = tick(placer(etat, tueur, habit), {}, BATTEMENT_MS);
    expect(amongDe(etat).habit).toEqual(habit);
    etat = placer(etat, tueur, ICI);

    etat = tick(placer(etat, proie, habit), {}, BATTEMENT_MS);
    expect(role(etat, proie).habit).toBe(true);
    expect(amongDe(etat).habit).toBeUndefined();
    expect(amongDe(etat).habitDansMs).toBe(AMONG.REAPPARITION_DE_L_HABIT_MS);
    expect(evenements(etat, 'habitPris')).toEqual([{ type: 'habitPris', joueur: proie }]);

    etat = tick(etat, {}, AMONG.REAPPARITION_DE_L_HABIT_MS - 100);
    expect(amongDe(etat).habit).toBeUndefined();
    etat = tick(etat, {}, 200);
    expect(amongDe(etat).habit).toBeDefined();
    expect(amongDe(etat).habit).not.toEqual(habit);
    expect(amongDe(etat).habitDansMs).toBeUndefined();
  });

  it('ne se prend pas par une proie qui en porte deja un, ni par un fantome', () => {
    let etat = eloigner(enJeu());
    const habit = amongDe(etat).habit as Position;
    const [porteuse, fantome] = camps(etat).proies as [string, string];
    etat = changer(etat, porteuse, { habit: true });
    etat = changer(etat, fantome, { fantome: true });
    etat = tick(placer(placer(etat, porteuse, habit), fantome, habit), {}, BATTEMENT_MS);

    expect(amongDe(etat).habit).toEqual(habit);
  });

  it('se revet quand la proie le veut: vingt secondes de deguisement, l habit quitte', () => {
    let etat = eloigner(enJeu());
    const proie = camps(etat).proies[0] as string;
    etat = changer(etat, proie, { habit: true });
    etat = geste(etat, proie, { capturer: true });

    expect(role(etat, proie).habit).toBeUndefined();
    expect(role(etat, proie).deguisementMs).toBe(AMONG.DUREE_DU_DEGUISEMENT_MS);
    expect(role(etat, proie).deguisements).toBe(1);
    expect(evenements(etat, 'deguisement')).toEqual([
      { type: 'deguisement', joueur: proie, quoi: 'debut' },
    ]);
  });

  it('ne se revet pas sans habit, ni par un fantome', () => {
    let etat = eloigner(enJeu());
    const [sansHabit, fantome] = camps(etat).proies as [string, string];
    etat = changer(etat, fantome, { habit: true, fantome: true });
    etat = geste(geste(etat, sansHabit, { capturer: true }), fantome, { capturer: true });

    expect(role(etat, sansHabit).deguisementMs).toBeUndefined();
    expect(role(etat, fantome).deguisementMs).toBeUndefined();
    expect(role(etat, fantome).habit).toBe(true);
  });

  it('se perd, revetu ou non, quand la proie est tuee', () => {
    let etat = eloigner(enJeu());
    const { tueur, proies } = camps(etat);
    const proie = proies[0] as string;
    etat = changer(etat, proie, { habit: true, deguisementMs: 5000, deguisements: 1 });
    etat = changer(placer(etat, tueur, ICI), tueur, { rechargeMs: 0 });
    etat = geste(placer(etat, proie, { x: ICI.x + 20, y: ICI.y }), tueur, { capturer: true });

    expect(role(etat, proie).fantome).toBe(true);
    expect(role(etat, proie).habit).toBeUndefined();
    expect(role(etat, proie).deguisementMs).toBeUndefined();
    // Le cadavre dit sa vraie couleur: le deguisement n'est qu'un affichage.
    expect(Object.values(amongDe(etat).cadavres)[0]?.couleur).toBe(etat.joueurs[proie]?.couleur);
  });

  it('tombe quand la proie deguisee ouvre une tache', () => {
    let etat = eloigner(enJeu());
    const proie = camps(etat).proies[0] as string;
    const tache = role(etat, proie).taches[0];
    const station = amongDe(etat).stations[tache?.station ?? 0] as Position;
    etat = changer(placer(etat, proie, station), proie, { deguisementMs: 9000, deguisements: 1 });
    etat = geste(etat, proie, { agir: true });

    expect(role(etat, proie).tacheEnCours).toBeDefined();
    expect(role(etat, proie).deguisementMs).toBeUndefined();
    expect(evenements(etat, 'deguisement')).toEqual([
      { type: 'deguisement', joueur: proie, quoi: 'fin' },
    ]);
  });

  it('reste porte d un tour a l autre, sans etre revetu', () => {
    let etat = eloigner(enJeu());
    const proie = camps(etat).proies[0] as string;
    etat = changer(etat, proie, { habit: true });
    etat = tick(etat, {}, AMONG.DELAI_DU_GONG_MS);
    etat = geste(placer(etat, proie, amongDe(etat).gong), proie, { agir: true });
    etat = tick(tick(tick(etat, {}, 15_000), {}, 15_000), {}, AMONG.DUREE_EJECTION_MS);

    expect(amongDe(etat).tour).toBe(2);
    expect(role(etat, proie).habit).toBe(true);
  });
});

describe('une station habillee d un meuble (16 octobre 2026)', () => {
  /** Une proie dont la premiere tache est a une station posee devant un meuble, rue degagee. */
  function devantUnMeuble(): { readonly etat: EtatPartie; readonly proie: string } {
    let etat = eloigner(enJeu());
    const proie = camps(etat).proies[0] as string;
    const among = amongDe(etat);
    const tache = role(etat, proie).taches[0];
    const rang = tache?.station ?? 0;
    const stations = [...among.stations];
    stations[rang] = {
      ...(stations[rang] as (typeof stations)[number]),
      x: 600,
      y: 760,
      emprise: { x: 600, y: 700, largeur: 60, hauteur: 40 },
    };
    etat = { ...etat, among: { ...among, stations } };

    return { etat, proie };
  }

  it('ouvre la tache de l autre cote du meuble, hors du disque, et la garde ouverte', () => {
    const { etat, proie } = devantUnMeuble();
    // Colle au haut du meuble: a cent pixels du centre de la station, a vingt du meuble.
    let apres = geste(placer(etat, proie, { x: 600, y: 660 }), proie, { agir: true });

    expect(role(apres, proie).tacheEnCours).toBeDefined();
    apres = tick(apres, {}, 500);
    expect(role(apres, proie).tacheEnCours).toBeDefined();

    // Trop loin du meuble, la tache se ferme.
    apres = tick(placer(apres, proie, { x: 600, y: 600 }), {}, BATTEMENT_MS);
    expect(role(apres, proie).tacheEnCours).toBeUndefined();
  });
});
