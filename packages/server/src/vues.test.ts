/**
 * Tests des vues par destinataire (etape 2.9).
 *
 * Comme pour l'instantane, la garantie la plus importante est ce que la vue NE DIT PAS: en
 * Chasse, rien de ce qu'un traqueur recoit ne doit distinguer une proie d'un PNJ, ni son
 * type, ni son identifiant, ni son pseudo, ni sa place dans la liste. Un client modifie lit
 * tout ce qui part; la page n'est pas une protection.
 */

import type { EntiteVue } from '@neon-ninja/shared';
import { CHASSE } from '@neon-ninja/shared';
import type { EtatPartie, IdentifiantEntite, Joueur } from '@neon-ninja/sim';
import {
  ajouterBot,
  ajouterJoueur,
  creerEtatInitial,
  devenirTraqueur,
  poserUneMine,
} from '@neon-ninja/sim';
import { describe, expect, it } from 'vitest';

import type { Notification } from './instantane.js';
import { instantaneDe } from './instantane.js';
import type { Alias } from './vues.js';
import {
  OCTETS_DU_SECRET,
  VUE_COMMUNE,
  VUE_DES_TRAQUEURS,
  aliasDesNinjas,
  cleDeVue,
  notificationDansLaVue,
  vuePour,
  vuesDe,
} from './vues.js';

/** Un secret de test, toujours le meme. */
const SECRET = new Uint8Array(OCTETS_DU_SECRET).fill(7);

/** Un alias lisible, pour des attentes qui se lisent: le masque d'un identifiant. */
const ALIAS_DE_TEST: Alias = (id) => `masque-${id}`;

/** Lit un joueur dont on sait qu'il est present. */
function joueurDe(etat: EtatPartie, id: IdentifiantEntite): Joueur {
  const joueur = etat.joueurs[id];
  if (joueur === undefined) {
    throw new Error(`Le joueur ${id} devrait etre dans la partie.`);
  }
  return joueur;
}

/** Change quelques champs d'un joueur. */
function regler(etat: EtatPartie, id: IdentifiantEntite, champs: Partial<Joueur>): EtatPartie {
  return { ...etat, joueurs: { ...etat.joueurs, [id]: { ...joueurDe(etat, id), ...champs } } };
}

/**
 * Une Chasse lancee a la main: Alice traqueur, Bob et Carole proies, trois PNJ. Les PNJ sont
 * ajoutes avant les proies dans l'ordre alphabetique de leurs identifiants, pour qu'un tri
 * par identifiant reel ne passe pas pour un tri par alias.
 */
function chasse(): EtatPartie {
  let etat = creerEtatInitial({
    graine: 3,
    mode: 'chasse',
    reglages: { zones: { actives: false } },
  });
  etat = ajouterJoueur(etat, { id: 'alice', pseudo: 'Alice', position: { x: 500, y: 500 } });
  etat = ajouterJoueur(etat, { id: 'bob', pseudo: 'Bob', position: { x: 1500, y: 1000 } });
  etat = ajouterJoueur(etat, { id: 'carole', pseudo: 'Carole', position: { x: 900, y: 300 } });
  for (const [rang, id] of ['bot-1', 'bot-2', 'bot-3'].entries()) {
    etat = ajouterBot(etat, {
      id,
      couleur: joueurDe(etat, 'bob').couleur,
      position: { x: 200 + rang * 300, y: 1200 },
    });
  }
  etat = { ...etat, chasse: { traqueurs: {}, parcours: {}, traqueursEpuises: false } };

  return devenirTraqueur(etat, 'alice');
}

/** Une Classique a deux joueurs et un PNJ. */
function classique(): EtatPartie {
  let etat = creerEtatInitial({ graine: 3 });
  etat = ajouterJoueur(etat, { id: 'alice', pseudo: 'Alice' });
  etat = ajouterJoueur(etat, { id: 'bob', pseudo: 'Bob' });

  return ajouterBot(etat, { id: 'bot-1', position: { x: 300, y: 300 } });
}

/** Les entites de la vue d'un joueur. */
function entitesVuesPar(etat: EtatPartie, id: IdentifiantEntite): readonly EntiteVue[] {
  return vuePour(etat, id, aliasDesNinjas(SECRET)).entites;
}

describe('la vue de chacun', () => {
  it('est la vue commune pour tous hors Chasse, inconnus compris', () => {
    for (const id of ['alice', 'bob', 'personne']) {
      expect(cleDeVue(classique(), id)).toBe(VUE_COMMUNE);
    }
  });

  it('est la vue commune dans une Chasse qui n est pas lancee', () => {
    const { chasse: _lancee, ...salon } = chasse();

    expect(cleDeVue(salon, 'alice')).toBe(VUE_COMMUNE);
  });

  it('est la vue commune pour une proie, celle des traqueurs pour un traqueur', () => {
    const etat = chasse();

    expect(cleDeVue(etat, 'bob')).toBe(VUE_COMMUNE);
    expect(cleDeVue(etat, 'alice')).toBe(VUE_DES_TRAQUEURS);
  });

  it('reste celle des traqueurs pour un traqueur elimine, qui regarde la suite', () => {
    const depart = chasse();
    const arme = depart.chasse?.traqueurs['alice'];
    if (depart.chasse === undefined || arme === undefined) {
      throw new Error('Alice devrait etre traqueur.');
    }
    const etat = {
      ...depart,
      chasse: { ...depart.chasse, traqueurs: { alice: { ...arme, vies: 0 } } },
    };

    expect(cleDeVue(etat, 'alice')).toBe(VUE_DES_TRAQUEURS);
  });

  it('devient la vue commune pour un traqueur sous Revelation, qui voit les vrais joueurs', () => {
    const depart = chasse();
    const etat = regler(depart, 'alice', {
      bonusRestantsMs: { ...joueurDe(depart, 'alice').bonusRestantsMs, revelation: 5000 },
    });

    expect(cleDeVue(etat, 'alice')).toBe(VUE_COMMUNE);
  });

  it('est la plus restrictive pour un destinataire que la Chasse ne connait pas', () => {
    expect(cleDeVue(chasse(), 'personne')).toBe(VUE_DES_TRAQUEURS);
  });
});

describe('la vue commune', () => {
  it('est l instantane d aujourd hui, hors Chasse comme pour une proie', () => {
    expect(vuePour(classique(), 'alice', ALIAS_DE_TEST)).toEqual(instantaneDe(classique()));
    expect(vuePour(chasse(), 'bob', ALIAS_DE_TEST)).toEqual(instantaneDe(chasse()));
  });

  it('montre les proies aux proies, comme des joueurs', () => {
    const joueurs = entitesVuesPar(chasse(), 'bob').filter((entite) => entite.type === 'joueur');

    expect(joueurs.map((entite) => entite.id)).toEqual(['alice', 'bob', 'carole']);
  });
});

describe('la vue des traqueurs', () => {
  it('ne montre comme joueur que les traqueurs, avec leur arme', () => {
    const joueurs = entitesVuesPar(chasse(), 'alice').filter((entite) => entite.type === 'joueur');

    expect(joueurs).toHaveLength(1);
    expect(joueurs[0]).toMatchObject({
      id: 'alice',
      pseudo: 'Alice',
      tactique: { charges: CHASSE.VIES_DES_TRAQUEURS },
    });
  });

  it('montre chaque proie comme un PNJ, sans rien de plus qu un PNJ', () => {
    const etat = chasse();
    const bob = joueurDe(etat, 'bob');
    const ninjas = entitesVuesPar(etat, 'alice').filter((entite) => entite.type === 'bot');

    expect(ninjas).toHaveLength(5);
    expect(ninjas).toContainEqual({
      type: 'bot',
      id: aliasDesNinjas(SECRET)('bob'),
      x: bob.position.x,
      y: bob.position.y,
      couleur: bob.couleur,
      direction: bob.direction,
    });
    expect(ninjas.every((ninja) => Object.keys(ninja).length === 6)).toBe(true);
  });

  it('ne laisse lire nulle part l identifiant ni le pseudo d une proie, ni celui d un PNJ', () => {
    const entites = JSON.stringify(entitesVuesPar(chasse(), 'alice'));

    for (const indice of ['bob', 'Bob', 'carole', 'Carole', 'bot-1', 'bot-2', 'bot-3']) {
      expect(entites).not.toContain(indice);
    }
  });

  it('range les ninjas apres les traqueurs, dans l ordre de leurs alias', () => {
    const ids = entitesVuesPar(chasse(), 'alice').map((entite) => entite.id);
    const ninjas = ids.slice(1);

    expect(ids[0]).toBe('alice');
    expect(ninjas).toEqual([...ninjas].sort());
    expect(ninjas.every((id) => /^pnj-[0-9a-f]{12}$/u.test(id))).toBe(true);
  });

  it('efface une proie cachee dans une zone d invisibilite, comme la page le faisait', () => {
    const etat: EtatPartie = {
      ...chasse(),
      zones: {
        brume: {
          id: 'brume',
          type: 'invisibilite',
          centre: { x: 1500, y: 1000 },
          rayon: 100,
          dureeRestanteMs: 10_000,
        },
      },
    };
    const alias = aliasDesNinjas(SECRET);
    const ids = vuePour(etat, 'alice', alias).entites.map((entite) => entite.id);

    expect(ids).not.toContain(alias('bob'));
    expect(ids).toContain(alias('carole'));
  });

  it('masque le poseur d une mine de proie, et laisse le sien a un traqueur', () => {
    let etat = chasse();
    etat = poserUneMine(etat, joueurDe(etat, 'bob'));
    etat = poserUneMine(etat, joueurDe(etat, 'alice'));
    const alias = aliasDesNinjas(SECRET);
    const mines = vuePour(etat, 'alice', alias).entites.filter((entite) => entite.type === 'mine');

    expect(mines.map((mine) => (mine.type === 'mine' ? mine.poseur : ''))).toEqual([
      alias('bob'),
      'alice',
    ]);
  });

  it('garde le classement de tous: il dit qui joue, pas ou', () => {
    expect(vuePour(chasse(), 'alice', ALIAS_DE_TEST).classement).toEqual(
      instantaneDe(chasse()).classement,
    );
  });
});

describe('les vues d un battement', () => {
  it('construit chaque vue demandee une fois, et rien sans demande', () => {
    const vues = vuesDe(chasse(), [VUE_COMMUNE, VUE_DES_TRAQUEURS, VUE_COMMUNE], ALIAS_DE_TEST);

    expect([...vues.keys()]).toEqual([VUE_COMMUNE, VUE_DES_TRAQUEURS]);
    expect(vues.get(VUE_DES_TRAQUEURS)).toEqual(vuePour(chasse(), 'alice', ALIAS_DE_TEST));
    expect(vuesDe(chasse(), [], ALIAS_DE_TEST).size).toBe(0);
  });

  it('construit la vue des traqueurs meme si personne n a la vue commune', () => {
    const vues = vuesDe(chasse(), [VUE_DES_TRAQUEURS], ALIAS_DE_TEST);

    expect([...vues.keys()]).toEqual([VUE_DES_TRAQUEURS]);
  });
});

describe('les alias des ninjas', () => {
  it('donnent toujours le meme alias a un meme identifiant', () => {
    const alias = aliasDesNinjas(SECRET);

    expect(alias('bot-1')).toBe(alias('bot-1'));
    expect(aliasDesNinjas(SECRET)('bot-1')).toBe(alias('bot-1'));
  });

  it('different d un identifiant a l autre', () => {
    const alias = aliasDesNinjas(SECRET);
    const ids = Array.from({ length: 500 }, (_, rang) => `bot-${String(rang)}`);

    expect(new Set(ids.map(alias)).size).toBe(500);
  });

  it('changent avec le secret: sans lui, on ne peut pas les recalculer', () => {
    const autre = new Uint8Array(OCTETS_DU_SECRET).fill(8);

    expect(aliasDesNinjas(autre)('bot-1')).not.toBe(aliasDesNinjas(SECRET)('bot-1'));
  });

  it('refusent un secret trop court', () => {
    expect(() => aliasDesNinjas(new Uint8Array(OCTETS_DU_SECRET - 1))).toThrow();
  });
});

describe('les notifications dans la vue des traqueurs', () => {
  const etat = chasse();
  const masque = (id: string): string => (id === 'alice' ? id : ALIAS_DE_TEST(id));

  /** La notification telle qu'Alice, traqueur, la recoit. */
  function chezLeTraqueur(notification: Notification): Notification {
    return notificationDansLaVue(notification, etat, VUE_DES_TRAQUEURS, ALIAS_DE_TEST);
  }

  it('restent telles quelles dans la vue commune', () => {
    const fumee: Notification = {
      nom: 'fumee',
      pour: 'bob',
      charge: { joueur: 'carole', depart: { x: 1, y: 2 }, arrivee: { x: 3, y: 4 } },
    };

    expect(notificationDansLaVue(fumee, etat, VUE_COMMUNE, ALIAS_DE_TEST)).toBe(fumee);
  });

  it('laissent telles quelles celles qui ne designent aucune autre entite', () => {
    const notifications: Notification[] = [
      {
        nom: 'captureReussie',
        pour: 'alice',
        charge: { victimePseudo: 'Bob', botsGagnes: 0, capturesTotal: 1 },
      },
      {
        nom: 'malusSubi',
        pour: 'alice',
        charge: { nature: 'flou', dureeMs: 1000, parPseudo: 'Bob' },
      },
      { nom: 'minePosee', pour: 'alice', charge: { mine: 'mine-1', x: 1, y: 2 } },
      { nom: 'evade', pour: 'alice', charge: { quoi: 'apparu' } },
      {
        nom: 'mineDeZone',
        pour: 'alice',
        charge: { quoi: 'posee', mine: 'mine-2', nature: 'chaos', x: 1, y: 2 },
      },
    ];

    for (const notification of notifications) {
      expect(chezLeTraqueur(notification)).toEqual(notification);
    }
  });

  it('masquent chaque identifiant de proie ou de PNJ, et gardent celui d un traqueur', () => {
    const cas: readonly (readonly [Notification, Notification['charge']])[] = [
      [
        {
          nom: 'fumee',
          pour: 'alice',
          charge: { joueur: 'bob', depart: { x: 1, y: 2 }, arrivee: { x: 3, y: 4 } },
        },
        { joueur: masque('bob'), depart: { x: 1, y: 2 }, arrivee: { x: 3, y: 4 } },
      ],
      [
        {
          nom: 'tirDeCapture',
          pour: 'alice',
          charge: { tireur: 'alice', x: 1, y: 2, orientation: 'est', captures: 1 },
        },
        { tireur: 'alice', x: 1, y: 2, orientation: 'est', captures: 1 },
      ],
      [
        {
          nom: 'mineArmee',
          pour: 'alice',
          charge: { mine: 'mine-1', poseur: 'alice', par: 'bob', x: 1, y: 2 },
        },
        { mine: 'mine-1', poseur: 'alice', par: masque('bob'), x: 1, y: 2 },
      ],
      [
        {
          nom: 'mineExplosee',
          pour: 'alice',
          charge: {
            mine: 'mine-1',
            poseur: 'carole',
            x: 1,
            y: 2,
            touches: [{ joueur: 'alice', effet: 'armeEnrayee', quantite: 0 }],
            botsNoirsTues: 0,
            botsTues: 0,
            points: 0,
          },
        },
        {
          mine: 'mine-1',
          poseur: masque('carole'),
          x: 1,
          y: 2,
          touches: [{ joueur: 'alice', effet: 'armeEnrayee', quantite: 0 }],
          botsNoirsTues: 0,
          botsTues: 0,
          points: 0,
        },
      ],
      [
        {
          nom: 'mineDeZone',
          pour: 'alice',
          charge: { quoi: 'armee', mine: 'mine-2', nature: 'chaos', x: 1, y: 2, par: 'bob' },
        },
        { quoi: 'armee', mine: 'mine-2', nature: 'chaos', x: 1, y: 2, par: masque('bob') },
      ],
      [
        {
          nom: 'botNoirTouche',
          pour: 'alice',
          charge: { botNoir: 'bot-1', x: 1, y: 2, coups: 1, coupsRequis: 3 },
        },
        { botNoir: masque('bot-1'), x: 1, y: 2, coups: 1, coupsRequis: 3 },
      ],
      [
        {
          nom: 'coupDeKatana',
          pour: 'alice',
          charge: {
            frappeur: 'bob',
            x: 1,
            y: 2,
            orientation: 'est',
            morts: [{ id: 'bot-1', x: 1, y: 2, noir: false, points: 1, couleur: '#123456' }],
            combo: 1,
            multiplicateur: 1,
          },
        },
        {
          frappeur: masque('bob'),
          x: 1,
          y: 2,
          orientation: 'est',
          morts: [{ id: masque('bot-1'), x: 1, y: 2, noir: false, points: 1, couleur: '#123456' }],
          combo: 1,
          multiplicateur: 1,
        },
      ],
      [
        {
          nom: 'joueurTranche',
          pour: 'alice',
          charge: {
            attaquant: 'alice',
            attaquantPseudo: 'Alice',
            victime: 'bob',
            victimePseudo: 'Bob',
            x: 1,
            y: 2,
            orientation: 'est',
            pointsVoles: 0,
          },
        },
        {
          attaquant: 'alice',
          attaquantPseudo: 'Alice',
          victime: masque('bob'),
          victimePseudo: 'Bob',
          x: 1,
          y: 2,
          orientation: 'est',
          pointsVoles: 0,
        },
      ],
      [
        { nom: 'evade', pour: 'alice', charge: { quoi: 'attrape', par: 'bob', parPseudo: 'Bob' } },
        { quoi: 'attrape', par: masque('bob'), parPseudo: 'Bob' },
      ],
      [
        {
          nom: 'evade',
          pour: 'alice',
          charge: { quoi: 'perdu', de: 'carole', dePseudo: 'Carole' },
        },
        { quoi: 'perdu', de: masque('carole'), dePseudo: 'Carole' },
      ],
      [
        {
          nom: 'evade',
          pour: 'alice',
          charge: { quoi: 'vole', par: 'bob', parPseudo: 'Bob', de: 'alice', dePseudo: 'Alice' },
        },
        { quoi: 'vole', par: masque('bob'), parPseudo: 'Bob', de: 'alice', dePseudo: 'Alice' },
      ],
    ];

    for (const [notification, attendue] of cas) {
      expect(chezLeTraqueur(notification)).toEqual({ ...notification, charge: attendue });
    }
  });
});
