// @vitest-environment jsdom
/**
 * Tests des ecrans d'Among Ninjas (etape 7.20): ce que le modele decide de la reunion et de
 * l'ejection, et les traits de vote que le composant en dessine.
 *
 * Retour d'essai du porteur du projet, 9 octobre 2026: les traits vers les joueurs votes se
 * lisaient mal. Redessines a chaque image, leur animation repartait sans fin; leur pointe
 * tombait sous la carte visee; ceux de « Passer » visaient un bouton cache.
 */

import type { EtatPriveAmong, LigneClassement } from '@neon-ninja/shared';
import { REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { describe, expect, it, vi } from 'vitest';

import type { ReunionClient } from '../../among.js';
import type { Client } from '../../client.js';
import type { EtatClient } from '../../etat.js';
import { ETAT_INITIAL } from '../../etat.js';
import { amongHud } from '../../hud/among.js';
import { ecranAmong } from '../modeles/among.js';
import type { Boite } from './among.js';
import { dessinDeVote, monterEcransAmong } from './among.js';

/** Une ligne du classement, tous a zero comme dans ce mode. */
function ligne(id: string, couleur: string): LigneClassement {
  return {
    id,
    pseudo: id,
    couleur,
    points: 0,
    botsPortes: 0,
    pointsBotsNoirs: 0,
    captures: 0,
    botsNoirsDetruits: 0,
  };
}

/** Nous sommes une proie vivante. */
const PRIVE: EtatPriveAmong = {
  role: 'proie',
  complices: [],
  fantome: false,
  gong: { x: 1145, y: 630 },
  stations: [],
  taches: [],
  gongUtilise: false,
};

/** Un client dans une partie Among Ninjas a cinq, a cette phase, avec cette reunion. */
function etat(
  phase: 'chargement' | 'discussion' | 'vote' | 'ejection',
  reunion: ReunionClient,
  prive: EtatPriveAmong = PRIVE,
): EtatClient {
  return {
    ...ETAT_INITIAL,
    ecran: 'jeu',
    moi: 'moi',
    salon: {
      idRoom: 'room-1',
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
      classement: [
        ligne('moi', '#FF5FD2'),
        ligne('bob', '#2EE6FF'),
        ligne('eve', '#FFE81A'),
        ligne('kim', '#1FBF4C'),
        ligne('lou', '#FF8C1A'),
      ],
      among: { phase, restantMs: 12_000, tachesFaites: 0, tachesTotal: 20 },
    },
    among: { prive, reunion, morts: [] },
  };
}

/** Une reunion ouverte sur un cadavre, sans vote encore. */
const REUNION: ReunionClient = {
  numero: 1,
  par: 'bob',
  motif: 'cadavre',
  cadavre: 'lou',
  votants: [],
};

/** Le vote clos: eve ejectee par moi et bob, kim passe, eve vote contre elle-meme. */
const RESULTAT: ReunionClient = {
  ...REUNION,
  votants: ['moi', 'bob', 'kim', 'eve'],
  resultat: {
    quoi: 'resultat',
    ejecte: 'eve',
    votes: { moi: 'eve', bob: 'eve', kim: null, eve: 'eve' },
    decompte: [
      { cible: 'eve', voix: 3 },
      { cible: null, voix: 1 },
    ],
  },
};

describe('le chargement', () => {
  it('fait attendre les autres joueurs, sans dire encore le role, ni a l ecran ni au bandeau', () => {
    const attente = etat('chargement', REUNION);

    expect(ecranAmong(attente)).toEqual({
      ecran: 'chargement',
      titre: 'Préparation de la partie',
      consigne: 'En attente des autres joueurs…',
    });
    expect(amongHud(attente)).toBeUndefined();
  });
});

describe('le modele de la reunion', () => {
  it('titre la reunion par ce qui l a ouverte, et ne laisse voter qu un vivant au vote', () => {
    const discussion = ecranAmong(etat('discussion', REUNION));
    const vote = ecranAmong(etat('vote', REUNION));
    const fantome = ecranAmong(etat('vote', REUNION, { ...PRIVE, fantome: true }));

    expect(discussion).toMatchObject({
      ecran: 'reunion',
      titre: 'bob a trouvé le corps de lou',
      temps: '0:12',
      peutVoter: false,
    });
    expect(vote).toMatchObject({ ecran: 'reunion', peutVoter: true });
    expect(fantome).toMatchObject({ ecran: 'reunion', peutVoter: false });
  });

  it('a l ejection, donne un trait par vote nomme et les voix pour passer, jamais le role', () => {
    const ecran = ecranAmong(etat('ejection', RESULTAT));

    expect(ecran).toMatchObject({
      ecran: 'ejection',
      texte: 'eve (Jaune) a été exécuté.',
      detail: 'eve 3 · passer 1',
      voixPourPasser: 1,
    });
    expect(ecran.ecran === 'ejection' ? ecran.traits : []).toEqual([
      { de: 'moi', vers: 'eve' },
      { de: 'bob', vers: 'eve' },
      { de: 'kim', vers: null },
      { de: 'eve', vers: 'eve' },
    ]);
    expect(JSON.stringify(ecran)).not.toMatch(/tueur|assassin/i);
  });

  it('sans votes nommes, ne donne aucun trait', () => {
    const anonyme: ReunionClient = {
      ...RESULTAT,
      resultat: { quoi: 'resultat', decompte: [{ cible: null, voix: 4 }] },
    };
    const ecran = ecranAmong(etat('ejection', anonyme));

    expect(ecran).toMatchObject({
      ecran: 'ejection',
      texte: 'Personne n’a été exécuté.',
      traits: [],
      voixPourPasser: 4,
    });
  });
});

/** Une carte de 80 sur 60 pixels, centree ici. */
function carte(x: number, y: number): Boite {
  return { x, y, demiLargeur: 40, demiHauteur: 30 };
}

/** Les nombres d'un chemin ou d'une liste de points SVG, dans l'ordre. */
function nombres(texte: string): number[] {
  return (texte.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
}

describe('le dessin d un vote', () => {
  const centre = { x: 200, y: 150 };

  it('part du bord du votant et pose la pointe de sa fleche juste hors de la carte visee', () => {
    // Le votant a gauche, la cible a droite, a la meme hauteur que le centre.
    const dessin = dessinDeVote(carte(40, 150), carte(360, 150), centre);
    const [departX, departY] = nombres(dessin.chemin);
    const [pointeX, pointeY] = nombres(dessin.fleche);

    expect([departX, departY]).toEqual([80, 150]);
    // Le bord gauche de la cible est a 320: la pointe s'arrete quatre pixels avant.
    expect([pointeX, pointeY]).toEqual([316, 150]);
  });

  it('se creuse vers le centre de la table', () => {
    // Deux cartes en haut de la table: la courbe passe sous elles, vers le centre.
    const dessin = dessinDeVote(carte(100, 40), carte(300, 40), centre);
    const [, , , controleY] = nombres(dessin.chemin);

    expect(controleY).toBeGreaterThan(40);
  });

  it('fait une boucle au-dessus de la carte d un vote contre soi-meme', () => {
    const dessin = dessinDeVote(carte(200, 100), carte(200, 100), centre);
    const ordonnees = nombres(dessin.fleche).filter((_, rang) => rang % 2 === 1);

    expect(dessin.chemin).toMatch(/^M [\d.]+ 70 C /);
    expect(Math.max(...ordonnees)).toBeLessThan(70);
  });
});

describe('le deces', () => {
  it('montre le grand texte a la victime, et le relance a une nouvelle mort seulement', () => {
    const client = { voter: vi.fn() } as unknown as Client;
    const ecrans = monterEcransAmong(document, client);
    document.body.append(ecrans.racine);
    const texte = ecrans.racine.querySelector<HTMLElement>('.among-deces');
    const enJeu = (decesA?: number): EtatClient => {
      const base = etat('discussion', REUNION);

      return { ...base, among: { ...base.among, ...(decesA === undefined ? {} : { decesA }) } };
    };

    ecrans.afficher(enJeu());
    expect(texte?.hidden).toBe(true);

    ecrans.afficher(enJeu(1000));
    expect(texte?.hidden).toBe(false);
    expect(texte?.textContent).toBe('TU SUBIS LE DÉCÈS');
    expect(texte?.classList.contains('montre')).toBe(true);
    ecrans.demonter();
  });
});

describe('les traits de l ejection', () => {
  /** Les ecrans montes dans le document, avec un client qui ne fait rien. */
  function monter(): ReturnType<typeof monterEcransAmong> {
    const client = { voter: vi.fn() } as unknown as Client;
    const ecrans = monterEcransAmong(document, client);
    document.body.append(ecrans.racine);

    return ecrans;
  }

  it('dessine un trait et une fleche par vote, une seule fois quelles que soient les images', () => {
    const ecrans = monter();
    ecrans.afficher(etat('ejection', RESULTAT));
    const premiers = [...ecrans.racine.querySelectorAll('.among-trait')];

    expect(premiers).toHaveLength(4);
    expect(ecrans.racine.querySelectorAll('.among-trait-fleche')).toHaveLength(4);

    // Une image de plus ne refait rien: l'animation des traits n'est pas relancee.
    ecrans.afficher(etat('ejection', RESULTAT));

    expect([...ecrans.racine.querySelectorAll('.among-trait')]).toEqual(premiers);
    ecrans.demonter();
  });

  it('garde « Passer » en place et ses voix, pour que son trait y arrive', () => {
    const ecrans = monter();
    ecrans.afficher(etat('ejection', RESULTAT));
    const passer = ecrans.racine.querySelector<HTMLButtonElement>('.among-passer');

    expect(passer?.hidden).toBe(false);
    expect(passer?.disabled).toBe(true);
    expect(passer?.querySelector('.among-place-voix')?.textContent).toBe('1');
    ecrans.demonter();
  });

  it('efface les traits quand la reunion suivante s ouvre', () => {
    const ecrans = monter();
    ecrans.afficher(etat('ejection', RESULTAT));
    ecrans.afficher(etat('discussion', { ...REUNION, numero: 2 }));

    expect(ecrans.racine.querySelectorAll('.among-trait')).toHaveLength(0);
    expect(ecrans.racine.querySelector<HTMLElement>('.among-passer')?.hidden).toBe(true);
    ecrans.demonter();
  });
});
