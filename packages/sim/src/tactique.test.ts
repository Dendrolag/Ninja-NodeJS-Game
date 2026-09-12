/**
 * Tests du mode Tactique: le cone, le tir, les charges, la visee, et ce que le
 * contact produit encore.
 *
 * Les valeurs sont celles de la version 0.9.0 du jeu d'origine, retenues par le
 * porteur du projet le 12 septembre 2026: 90 degres, 100 pixels, cinq charges, une
 * charge toutes les cinq secondes. Trois cas de la geometrie viennent des tests de
 * cette version (tests/tactical-mode-fix.test.js, branche
 * modular-architecture-broken).
 */

import type { Orientation, ReglagesPartiels } from '@neon-ninja/shared';
import { COULEUR_BOT_NEUTRE, TACTIQUE } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { detecterContacts, regleTactique } from './contacts.js';
import { AUCUN_BONUS, AUCUN_MALUS } from './effets.js';
import type { EtatPartie, EtatTactiqueDuJoueur, IdentifiantEntite, Joueur } from './etat.js';
import { ajouterBot, ajouterJoueur, creerEtatInitial, retirerJoueur } from './etat.js';
import type { EntreeJoueur, Entrees } from './moteur.js';
import { tick } from './moteur.js';
import { mettreEnPause } from './pause.js';
import {
  ETAT_TACTIQUE_DE_DEPART,
  agirEnTactique,
  dansLeCone,
  etatTactiqueDe,
  recharger,
  tirer,
} from './tactique.js';

const ROUGE = '#FF0000';
const BLEU = '#0000FF';
const VERT = '#00FF00';

/** Duree d'un battement a la cadence du serveur, en millisecondes. */
const BATTEMENT_MS = 50;

/** Reglages ou rien n'apparait tout seul: le test pose lui-meme ce qu'il veut. */
const CALME: ReglagesPartiels = {
  botsNoirs: { actifs: false },
  bonus: {
    types: {
      vitesse: { tauxApparitionPourCent: 0 },
      invincibilite: { tauxApparitionPourCent: 0 },
      revelation: { tauxApparitionPourCent: 0 },
    },
  },
  malus: { tauxApparitionPourCent: 0 },
  zones: { actives: false },
};

/** Un joueur qui ne demande rien. */
const IMMOBILE: EntreeJoueur = { deplacement: { x: 0, y: 0 }, enMouvement: false };

/** Une partie Tactique vide, ou rien n'apparait. */
function partieTactique(graine = 1): EtatPartie {
  return creerEtatInitial({ graine, mode: 'tactique', reglages: CALME });
}

/** Ajoute un joueur pret a jouer: place et teint comme demande, sans protection d'apparition. */
function avecJoueur(
  etat: EtatPartie,
  id: IdentifiantEntite,
  couleur: string,
  position: { x: number; y: number },
  champs: Partial<Joueur> = {},
): EtatPartie {
  const ajoute = ajouterJoueur(etat, { id, pseudo: id, couleur, position });
  const joueur = ajoute.joueurs[id] as Joueur;

  return {
    ...ajoute,
    joueurs: { ...ajoute.joueurs, [id]: { ...joueur, protectionSpawnRestanteMs: 0, ...champs } },
  };
}

/** Pose un bot ordinaire, blanc sauf mention contraire. */
function avecBot(
  etat: EtatPartie,
  id: IdentifiantEntite,
  position: { x: number; y: number },
  couleur: string = COULEUR_BOT_NEUTRE,
): EtatPartie {
  return ajouterBot(etat, { id, position, couleur });
}

/** Regle l'etat tactique d'un joueur. */
function armer(
  etat: EtatPartie,
  id: IdentifiantEntite,
  champs: Partial<EtatTactiqueDuJoueur>,
): EtatPartie {
  return {
    ...etat,
    tactique: { ...etat.tactique, [id]: { ...etatTactiqueDe(etat, id), ...champs } },
  };
}

/** La couleur d'un bot ou d'un joueur present. */
function couleurDe(etat: EtatPartie, id: IdentifiantEntite): string | undefined {
  return (etat.bots[id] ?? etat.joueurs[id])?.couleur;
}

/** Les entrees d'un battement ou ces joueurs tirent sans bouger. */
function tirs(...ids: IdentifiantEntite[]): Entrees {
  return Object.fromEntries(ids.map((id) => [id, { ...IMMOBILE, capturer: true as const }]));
}

/** Les tirs inscrits au journal. */
function tirsAuJournal(
  etat: EtatPartie,
): readonly Extract<EtatPartie['evenements'][number], { type: 'tirDeCapture' }>[] {
  return etat.evenements.filter((evenement) => evenement.type === 'tirDeCapture');
}

describe('dansLeCone', () => {
  const origine = { x: 500, y: 500 };

  it('prend une cible juste devant, et laisse celles de cote ou trop loin', () => {
    // Les trois cas des tests de la v0.9.0.
    expect(dansLeCone(origine, 'est', { x: 550, y: 500 })).toBe(true);
    expect(dansLeCone(origine, 'est', { x: 500, y: 450 })).toBe(false);
    expect(dansLeCone(origine, 'est', { x: 700, y: 500 })).toBe(false);
  });

  it('compte la portee exacte, bornes comprises', () => {
    expect(dansLeCone(origine, 'est', { x: 500 + TACTIQUE.PORTEE_PX, y: 500 })).toBe(true);
    expect(dansLeCone(origine, 'est', { x: 500 + TACTIQUE.PORTEE_PX + 0.001, y: 500 })).toBe(false);
  });

  it('compte le bord du cone, a 45 degres, et pas au-dela', () => {
    expect(dansLeCone(origine, 'est', { x: 570, y: 570 })).toBe(true);
    expect(dansLeCone(origine, 'est', { x: 570, y: 430 })).toBe(true);
    expect(dansLeCone(origine, 'nord_est', { x: 570, y: 500 })).toBe(true);
    expect(dansLeCone(origine, 'est', { x: 570, y: 570.2 })).toBe(false);
    expect(dansLeCone(origine, 'nord_est', { x: 570, y: 500.2 })).toBe(false);
  });

  it('vise dans chacune des huit orientations, et jamais derriere', () => {
    const devant: Readonly<Record<Orientation, { x: number; y: number }>> = {
      nord: { x: 0, y: -50 },
      nord_est: { x: 35, y: -35 },
      est: { x: 50, y: 0 },
      sud_est: { x: 35, y: 35 },
      sud: { x: 0, y: 50 },
      sud_ouest: { x: -35, y: 35 },
      ouest: { x: -50, y: 0 },
      nord_ouest: { x: -35, y: -35 },
    };

    for (const [orientation, ecart] of Object.entries(devant) as [Orientation, typeof origine][]) {
      const cible = { x: origine.x + ecart.x, y: origine.y + ecart.y };
      const derriere = { x: origine.x - ecart.x, y: origine.y - ecart.y };

      expect(dansLeCone(origine, orientation, cible)).toBe(true);
      expect(dansLeCone(origine, orientation, derriere)).toBe(false);
    }
  });

  it('tient pour visee une cible au meme point que le tireur, comme la v0.9.0', () => {
    expect(dansLeCone(origine, 'ouest', origine)).toBe(true);
  });

  it('laisse hors de portee une position non numerique', () => {
    expect(dansLeCone(origine, 'est', { x: Number.NaN, y: 500 })).toBe(false);
  });
});

describe('tirer', () => {
  /** Un tireur rouge au milieu de la carte, tourne vers l'est, face a un joueur bleu lointain. */
  function situation(): EtatPartie {
    return avecJoueur(
      avecJoueur(partieTactique(), 'tireur', ROUGE, { x: 500, y: 500 }),
      'bleu',
      BLEU,
      { x: 1500, y: 1000 },
    );
  }

  it('capture les bots blancs et ceux des autres joueurs, ni les siens ni ceux hors du cone', () => {
    let depart = situation();
    depart = avecBot(depart, 'blanc', { x: 550, y: 500 });
    depart = avecBot(depart, 'adverse', { x: 560, y: 510 }, BLEU);
    depart = avecBot(depart, 'sien', { x: 540, y: 490 }, ROUGE);
    depart = avecBot(depart, 'derriere', { x: 450, y: 500 });
    depart = avecBot(depart, 'lointain', { x: 620, y: 500 });

    const apres = tirer(depart, 'tireur');

    expect(couleurDe(apres, 'blanc')).toBe(ROUGE);
    expect(couleurDe(apres, 'adverse')).toBe(ROUGE);
    expect(couleurDe(apres, 'sien')).toBe(ROUGE);
    expect(couleurDe(apres, 'derriere')).toBe(COULEUR_BOT_NEUTRE);
    expect(couleurDe(apres, 'lointain')).toBe(COULEUR_BOT_NEUTRE);
    expect(tirsAuJournal(apres)).toEqual([
      {
        type: 'tirDeCapture',
        joueur: 'tireur',
        position: { x: 500, y: 500 },
        orientation: 'est',
        captures: 2,
      },
    ]);
  });

  it('ne vise pas les bots noirs', () => {
    const depart = ajouterBot(situation(), {
      id: 'noir',
      type: 'botNoir',
      position: { x: 550, y: 500 },
    });

    const apres = tirer(depart, 'tireur');

    expect(apres.bots['noir']).toEqual(depart.bots['noir']);
    expect(etatTactiqueDe(apres, 'tireur').charges).toBe(TACTIQUE.CHARGES_MAXIMUM);
  });

  it('capture un joueur du cone, qui cede tous ses bots d un coup', () => {
    let depart = avecJoueur(situation(), 'victime', VERT, { x: 560, y: 500 });
    depart = avecBot(depart, 'v1', { x: 1500, y: 200 }, VERT);
    depart = avecBot(depart, 'v2', { x: 1600, y: 200 }, VERT);

    const apres = tirer(depart, 'tireur');

    expect(couleurDe(apres, 'v1')).toBe(ROUGE);
    expect(couleurDe(apres, 'v2')).toBe(ROUGE);
    expect(apres.joueurs['victime']?.position).not.toEqual({ x: 560, y: 500 });
    expect(apres.evenements).toContainEqual(
      expect.objectContaining({ type: 'captureJoueur', attaquant: 'tireur', botsTransferes: 2 }),
    );
    expect(tirsAuJournal(apres)[0]?.captures).toBe(1);
    expect(etatTactiqueDe(apres, 'tireur').charges).toBe(TACTIQUE.CHARGES_MAXIMUM - 1);
  });

  it('ne capture qu un joueur par tir, a cause du delai entre deux captures', () => {
    let depart = avecJoueur(situation(), 'premier', VERT, { x: 550, y: 500 });
    depart = avecJoueur(depart, 'second', '#FFFF00', { x: 560, y: 505 });

    const apres = tirer(depart, 'tireur');

    expect(apres.joueurs['premier']?.position).not.toEqual({ x: 550, y: 500 });
    expect(apres.joueurs['second']?.position).toEqual({ x: 560, y: 505 });
    expect(tirsAuJournal(apres)[0]?.captures).toBe(1);
  });

  it('epargne un joueur protege, et ce tir sans effet ne coute rien', () => {
    const depart = avecJoueur(
      situation(),
      'protege',
      VERT,
      { x: 550, y: 500 },
      {
        protectionSpawnRestanteMs: 2000,
      },
    );

    const apres = tirer(depart, 'tireur');

    expect(apres.joueurs['protege']?.position).toEqual({ x: 550, y: 500 });
    expect(etatTactiqueDe(apres, 'tireur')).toEqual(ETAT_TACTIQUE_DE_DEPART);
    expect(tirsAuJournal(apres)[0]?.captures).toBe(0);
  });

  it('epargne un joueur invincible', () => {
    const depart = avecJoueur(
      situation(),
      'invincible',
      VERT,
      { x: 550, y: 500 },
      {
        bonusRestantsMs: { ...AUCUN_BONUS, invincibilite: 10_000 },
      },
    );

    const apres = tirer(depart, 'tireur');

    expect(apres.joueurs['invincible']?.position).toEqual({ x: 550, y: 500 });
    expect(etatTactiqueDe(apres, 'tireur').charges).toBe(TACTIQUE.CHARGES_MAXIMUM);
  });

  it('n a pas lieu sans charge', () => {
    const depart = armer(avecBot(situation(), 'blanc', { x: 550, y: 500 }), 'tireur', {
      charges: 0,
    });

    expect(tirer(depart, 'tireur')).toBe(depart);
  });

  it('n a pas lieu pour un joueur absent', () => {
    const depart = situation();

    expect(tirer(depart, 'personne')).toBe(depart);
  });

  it('debite une seule charge et relance l attente, quel que soit le nombre de captures', () => {
    let depart = armer(situation(), 'tireur', { charges: 3, avantProchaineChargeMs: 1200 });
    depart = avecBot(depart, 'b1', { x: 530, y: 500 });
    depart = avecBot(depart, 'b2', { x: 560, y: 500 });
    depart = avecBot(depart, 'b3', { x: 590, y: 500 });

    const apres = tirer(depart, 'tireur');

    expect(tirsAuJournal(apres)[0]?.captures).toBe(3);
    expect(etatTactiqueDe(apres, 'tireur')).toMatchObject({
      charges: 2,
      avantProchaineChargeMs: TACTIQUE.RECHARGE_MS,
    });
  });
});

describe('recharger', () => {
  it('rend une charge au bout de cinq secondes, pas avant', () => {
    const depart = { orientation: 'est' as const, charges: 3, avantProchaineChargeMs: 5000 };

    const presque = recharger(depart, 4999);
    const arrivee = recharger(presque, 1);

    expect(presque).toMatchObject({ charges: 3, avantProchaineChargeMs: 1 });
    expect(arrivee).toMatchObject({ charges: 4, avantProchaineChargeMs: TACTIQUE.RECHARGE_MS });
  });

  it('reporte le reste de l attente: le decoupage du temps ne change rien', () => {
    const depart = { orientation: 'sud' as const, charges: 0, avantProchaineChargeMs: 5000 };

    let parBattements = depart;
    for (let battement = 0; battement < 257; battement += 1) {
      parBattements = recharger(parBattements, 47);
    }

    expect(parBattements).toEqual(recharger(depart, 257 * 47));
    // 12 079 millisecondes: deux charges revenues, a 5 000 et a 10 000, et la
    // troisieme a 2 921 millisecondes de revenir.
    expect(parBattements).toMatchObject({ charges: 2, avantProchaineChargeMs: 2921 });
  });

  it('ne depasse jamais le maximum, et garde une attente entiere aux charges pleines', () => {
    const presquePlein = { orientation: 'est' as const, charges: 4, avantProchaineChargeMs: 100 };
    const plein = recharger(presquePlein, 1_000_000);

    expect(plein).toEqual({ ...ETAT_TACTIQUE_DE_DEPART, orientation: 'est' });
    expect(recharger(plein, BATTEMENT_MS)).toBe(plein);
  });
});

describe('le mode Tactique dans le battement', () => {
  it('oriente un joueur dans la direction de son deplacement, et la garde a l arret', () => {
    const depart = avecJoueur(partieTactique(), 'alice', ROUGE, { x: 500, y: 500 });

    const enMarche = tick(
      depart,
      { alice: { deplacement: { x: 0, y: -1 }, enMouvement: true } },
      50,
    );
    const arrete = tick(enMarche, { alice: IMMOBILE }, 50);

    expect(etatTactiqueDe(enMarche, 'alice').orientation).toBe('nord');
    expect(arrete.joueurs['alice']?.direction).toBe('immobile');
    expect(etatTactiqueDe(arrete, 'alice').orientation).toBe('nord');
  });

  it('suit le deplacement reel, commandes inversees comprises', () => {
    const depart = avecJoueur(
      partieTactique(),
      'alice',
      ROUGE,
      { x: 500, y: 500 },
      {
        malusRestantsMs: { ...AUCUN_MALUS, controlesInverses: 10_000 },
      },
    );

    const apres = tick(depart, { alice: { deplacement: { x: 1, y: 0 }, enMouvement: true } }, 50);

    expect(etatTactiqueDe(apres, 'alice').orientation).toBe('ouest');
  });

  it('commence tourne vers l est, charges pleines', () => {
    const apres = tick(avecJoueur(partieTactique(), 'alice', ROUGE, { x: 500, y: 500 }), {}, 50);

    expect(apres.tactique?.['alice']).toEqual(ETAT_TACTIQUE_DE_DEPART);
  });

  it('joue une demande de tir dans le battement qui la recoit, et seulement dans celui-la', () => {
    let depart = avecJoueur(partieTactique(), 'alice', ROUGE, { x: 500, y: 500 });
    depart = avecBot(depart, 'premier', { x: 550, y: 500 });

    const apresTir = tick(depart, tirs('alice'), BATTEMENT_MS);
    const suite = tick(
      avecBot(apresTir, 'second', { x: 550, y: 520 }),
      { alice: IMMOBILE },
      BATTEMENT_MS,
    );

    expect(couleurDe(apresTir, 'premier')).toBe(ROUGE);
    expect(couleurDe(suite, 'second')).toBe(COULEUR_BOT_NEUTRE);
    expect(tirsAuJournal(suite)).toEqual([]);
    expect(etatTactiqueDe(suite, 'alice').charges).toBe(TACTIQUE.CHARGES_MAXIMUM - 1);
  });

  it('rend la charge cinq secondes de jeu apres le tir', () => {
    let etat = tick(
      avecBot(avecJoueur(partieTactique(), 'alice', ROUGE, { x: 500, y: 500 }), 'b', {
        x: 550,
        y: 500,
      }),
      tirs('alice'),
      BATTEMENT_MS,
    );

    for (let battement = 1; battement < TACTIQUE.RECHARGE_MS / BATTEMENT_MS; battement += 1) {
      etat = tick(etat, {}, BATTEMENT_MS);
    }
    expect(etatTactiqueDe(etat, 'alice').charges).toBe(TACTIQUE.CHARGES_MAXIMUM - 1);

    etat = tick(etat, {}, BATTEMENT_MS);
    expect(etatTactiqueDe(etat, 'alice').charges).toBe(TACTIQUE.CHARGES_MAXIMUM);
  });

  it('ne tire ni ne recharge pendant la pause', () => {
    let depart = avecJoueur(partieTactique(), 'alice', ROUGE, { x: 500, y: 500 });
    depart = armer(avecBot(depart, 'b', { x: 550, y: 500 }), 'alice', {
      charges: 2,
      avantProchaineChargeMs: 50,
    });

    const apres = tick(mettreEnPause(depart), tirs('alice'), 10_000);

    expect(couleurDe(apres, 'b')).toBe(COULEUR_BOT_NEUTRE);
    expect(etatTactiqueDe(apres, 'alice')).toMatchObject({
      charges: 2,
      avantProchaineChargeMs: 50,
    });
  });

  it('laisse a une victime son orientation apres sa capture', () => {
    let depart = avecJoueur(partieTactique(), 'alice', ROUGE, { x: 500, y: 500 });
    depart = armer(avecJoueur(depart, 'bob', BLEU, { x: 550, y: 500 }), 'bob', {
      orientation: 'nord',
    });

    const apres = tick(tick(depart, tirs('alice'), BATTEMENT_MS), {}, BATTEMENT_MS);

    expect(apres.joueurs['bob']?.position).not.toEqual({ x: 550, y: 500 });
    expect(etatTactiqueDe(apres, 'bob').orientation).toBe('nord');
  });

  it('tire au sort l issue de deux tirs croises, et le perdant ne tire pas', () => {
    const vainqueurs = new Set<IdentifiantEntite>();

    for (let graine = 1; graine <= 40; graine += 1) {
      let depart = avecJoueur(partieTactique(graine), 'alice', ROUGE, { x: 500, y: 500 });
      depart = armer(avecJoueur(depart, 'bob', BLEU, { x: 550, y: 500 }), 'bob', {
        orientation: 'ouest',
      });

      const apres = tick(depart, tirs('alice', 'bob'), BATTEMENT_MS);
      const captures = apres.evenements.filter((evenement) => evenement.type === 'captureJoueur');

      expect(captures).toHaveLength(1);
      expect(tirsAuJournal(apres)).toHaveLength(1);
      vainqueurs.add(tirsAuJournal(apres)[0]?.joueur ?? '');
    }

    expect(vainqueurs).toEqual(new Set(['alice', 'bob']));
  });

  it('ne consomme aucun tirage au sort pour un seul tireur', () => {
    const depart = avecJoueur(partieTactique(), 'alice', ROUGE, { x: 500, y: 500 });

    expect(agirEnTactique(depart, tirs('alice'), BATTEMENT_MS).alea).toEqual(depart.alea);
  });

  it('rejoue une partie tactique a l identique, a graine et entrees egales', () => {
    function jouer(): EtatPartie {
      let etat = creerEtatInitial({ graine: 7, mode: 'tactique' });
      etat = avecJoueur(etat, 'alice', ROUGE, { x: 500, y: 500 });
      etat = avecJoueur(etat, 'bob', BLEU, { x: 700, y: 600 });
      for (let rang = 0; rang < 30; rang += 1) {
        etat = avecBot(etat, `b${String(rang)}`, { x: 300 + rang * 40, y: 450 + (rang % 5) * 30 });
      }

      for (let battement = 0; battement < 400; battement += 1) {
        const tour = battement % 40;
        etat = tick(
          etat,
          {
            alice: {
              deplacement: { x: tour < 20 ? 1 : -1, y: 0 },
              enMouvement: tour % 7 !== 0,
              ...(tour === 5 ? { capturer: true as const } : {}),
            },
            bob: {
              deplacement: { x: 0, y: tour < 20 ? -1 : 1 },
              enMouvement: true,
              ...(tour === 5 || tour === 25 ? { capturer: true as const } : {}),
            },
          },
          BATTEMENT_MS,
        );
      }

      return etat;
    }

    expect(jouer()).toEqual(jouer());
  });

  it('oublie un joueur qui a quitte la partie', () => {
    const depart = tick(avecJoueur(partieTactique(), 'alice', ROUGE, { x: 500, y: 500 }), {}, 50);

    const apres = tick(retirerJoueur(depart, 'alice'), {}, 50);

    expect(apres.tactique).toEqual({});
  });
});

describe('regleTactique', () => {
  it('ne capture rien au contact: ni bot, ni joueur', () => {
    let depart = avecJoueur(partieTactique(), 'alice', ROUGE, { x: 500, y: 500 });
    depart = avecJoueur(depart, 'bob', BLEU, { x: 510, y: 500 });
    depart = avecBot(depart, 'blanc', { x: 500, y: 510 });

    const apres = regleTactique(depart, detecterContacts(depart));

    expect(apres).toBe(depart);
  });

  it('laisse les bots se transmettre la couleur d un joueur', () => {
    let depart = avecJoueur(partieTactique(), 'alice', ROUGE, { x: 1500, y: 1000 });
    depart = avecBot(depart, 'rouge', { x: 500, y: 500 }, ROUGE);
    depart = avecBot(depart, 'blanc', { x: 510, y: 500 });

    const apres = regleTactique(depart, detecterContacts(depart));

    expect(couleurDe(apres, 'blanc')).toBe(ROUGE);
  });

  it('laisse un joueur invincible detruire le bot noir qu il touche', () => {
    let depart = avecJoueur(
      partieTactique(),
      'alice',
      ROUGE,
      { x: 500, y: 500 },
      {
        bonusRestantsMs: { ...AUCUN_BONUS, invincibilite: 10_000 },
      },
    );
    depart = ajouterBot(depart, { id: 'noir', type: 'botNoir', position: { x: 510, y: 500 } });

    const apres = regleTactique(depart, detecterContacts(depart));

    expect(apres.bots['noir']).toBeUndefined();
    expect(apres.joueurs['alice']?.botsNoirsDetruits).toBe(1);
  });

  it('laisse un joueur ordinaire indifferent au bot noir qu il touche', () => {
    let depart = avecJoueur(partieTactique(), 'alice', ROUGE, { x: 500, y: 500 });
    depart = ajouterBot(depart, { id: 'noir', type: 'botNoir', position: { x: 510, y: 500 } });

    expect(regleTactique(depart, detecterContacts(depart))).toBe(depart);
  });

  it('laisse un bot noir capturer la proie qu il poursuit, comme en Classique', () => {
    let depart = creerEtatInitial({
      graine: 1,
      mode: 'tactique',
      reglages: { ...CALME, botsNoirs: { actifs: true } },
    });
    depart = avecJoueur(depart, 'alice', ROUGE, { x: 510, y: 500 });
    depart = ajouterBot(depart, { id: 'noir', type: 'botNoir', position: { x: 500, y: 500 } });

    const apres = tick(depart, {}, BATTEMENT_MS);

    expect(apres.evenements).toContainEqual(
      expect.objectContaining({ type: 'captureParBotNoir', botNoir: 'noir', victime: 'alice' }),
    );
  });
});
