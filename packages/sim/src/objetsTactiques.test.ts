/**
 * Tests des six objets du mode Tactique (etape 7.7): leur apparition, leur ramassage, et
 * ce qu'ils font a l'arme.
 *
 * Les valeurs sont celles tranchees par le porteur du projet le 19 septembre 2026. Rafale,
 * 5 secondes, un tir ne coute rien; Recharge rapide, 10 secondes, une charge en 1,5
 * seconde; Visee large, 10 secondes, 120 degres sur 150 pixels. Leurs contraires: Tir
 * unique, 10 secondes, une charge en main; Recharge lente, 12 secondes, une charge en 10
 * secondes; Visee etroite, 10 secondes, 60 degres sur 70 pixels.
 */

import type { EffetTactique, NatureObjet, ReglagesPartiels } from '@neon-ninja/shared';
import {
  COULEUR_BOT_NEUTRE,
  EFFETS_TACTIQUES,
  TACTIQUE,
  TYPES_BONUS_TACTIQUES,
  TYPES_MALUS_TACTIQUES,
} from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { AUCUN_BONUS, AUCUN_MALUS } from './effets.js';
import type { EtatPartie, EtatTactiqueDuJoueur, IdentifiantEntite, Joueur } from './etat.js';
import { ajouterBot, ajouterJoueur, creerEtatInitial } from './etat.js';
import type { Entrees } from './moteur.js';
import { tick } from './moteur.js';
import { faireApparaitreLesObjets, poserObjet, ramasser } from './objets.js';
import {
  AUCUN_EFFET_TACTIQUE,
  chargesMaximum,
  dureeDeLEffet,
  effetQuiAgit,
  estUnEffetTactique,
  gelerOuRendre,
  objetTactiqueActif,
  peutTirer,
  viseeDe,
  vitesseDeRecharge,
} from './objetsTactiques.js';
import {
  CONES_DES_VISEES,
  ETAT_TACTIQUE_DE_DEPART,
  avanceeDeLAttente,
  dansLeCone,
  etatTactiqueDe,
  recharger,
  tirer,
  vieillirLesEffets,
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
  objetsTactiques: {
    bonus: {
      rafale: { tauxApparitionPourCent: 0 },
      rechargeRapide: { tauxApparitionPourCent: 0 },
      viseeLarge: { tauxApparitionPourCent: 0 },
    },
  },
};

/** Une partie vide d'un mode donne, ou rien n'apparait. */
function partie(mode: 'tactique' | 'classique' = 'tactique', graine = 1): EtatPartie {
  return creerEtatInitial({ graine, mode, reglages: CALME });
}

/** Ajoute un joueur pret a jouer, sans protection d'apparition. */
function avecJoueur(
  etat: EtatPartie,
  id: IdentifiantEntite,
  couleur: string,
  position: { x: number; y: number },
): EtatPartie {
  const ajoute = ajouterJoueur(etat, { id, pseudo: id, couleur, position });
  const joueur = ajoute.joueurs[id] as Joueur;

  return {
    ...ajoute,
    joueurs: { ...ajoute.joueurs, [id]: { ...joueur, protectionSpawnRestanteMs: 0 } },
  };
}

/** Trois joueurs eloignes les uns des autres. */
function troisJoueurs(etat: EtatPartie = partie()): EtatPartie {
  let courant = avecJoueur(etat, 'alice', ROUGE, { x: 300, y: 300 });
  courant = avecJoueur(courant, 'bob', BLEU, { x: 900, y: 300 });
  return avecJoueur(courant, 'carla', VERT, { x: 300, y: 900 });
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

/** Des effets du Tactique: aucun, sauf ceux donnes. */
function effets(durees: Partial<Record<EffetTactique, number>>): EtatTactiqueDuJoueur['effets'] {
  return { ...AUCUN_EFFET_TACTIQUE, ...durees };
}

/** Une arme au depart, avec ces champs. */
function arme(champs: Partial<EtatTactiqueDuJoueur>): EtatTactiqueDuJoueur {
  return { ...ETAT_TACTIQUE_DE_DEPART, ...champs };
}

/** Un joueur ramasse un objet pose a ses pieds. */
function ramasse(etat: EtatPartie, id: IdentifiantEntite, nature: NatureObjet): EtatPartie {
  const joueur = etat.joueurs[id] as Joueur;
  const categorie = (TYPES_MALUS_TACTIQUES as readonly string[]).includes(nature)
    ? 'malus'
    : 'bonus';
  const pose = poserObjet(etat, {
    categorie,
    nature,
    position: joueur.position,
  } as Parameters<typeof poserObjet>[1]);
  const objetId = Object.keys(pose.objets).at(-1) as IdentifiantEntite;

  return ramasser(pose, id, objetId);
}

/** Ce que fait un battement du Tactique a une arme seule: recharger, vieillir, geler. */
function battre(courant: EtatTactiqueDuJoueur, dtMs: number): EtatTactiqueDuJoueur {
  return gelerOuRendre(vieillirLesEffets(recharger(courant, dtMs), dtMs));
}

/** Les entrees d'un battement ou ces joueurs tirent sans bouger. */
function tirs(...ids: IdentifiantEntite[]): Entrees {
  return Object.fromEntries(
    ids.map((id) => [
      id,
      { deplacement: { x: 0, y: 0 }, enMouvement: false, capturer: true as const },
    ]),
  );
}

describe('le catalogue des objets du Tactique', () => {
  it('reconnait ses six natures, et aucune du jeu d origine', () => {
    for (const nature of EFFETS_TACTIQUES) {
      expect(estUnEffetTactique(nature)).toBe(true);
    }
    for (const nature of ['vitesse', 'invincibilite', 'revelation', 'flou'] as const) {
      expect(estUnEffetTactique(nature)).toBe(false);
    }
  });

  it('refuse de donner la duree d un objet hors d une partie Tactique', () => {
    // Une faute d'appelant: aucun objet du Tactique n'apparait ailleurs.
    expect(() => dureeDeLEffet(partie('classique').reglages, 'rafale')).toThrow(/Tactique/u);
  });

  it('n en met aucun en jeu hors du Tactique', () => {
    const horde = partie('classique');

    expect(horde.reglages.objetsTactiques).toBeUndefined();
    for (const nature of EFFETS_TACTIQUES) {
      expect(objetTactiqueActif(horde.reglages, nature)).toBe(false);
    }
  });
});

describe('effetQuiAgit', () => {
  it('fait agir un effet en cours, et pas un effet echu', () => {
    expect(effetQuiAgit(effets({ rafale: 1 }), 'rafale')).toBe(true);
    expect(effetQuiAgit(effets({ rafale: 0 }), 'rafale')).toBe(false);
  });

  it('annule un bonus et son malus contraire tant que les deux durent', () => {
    const paires = [
      ['rafale', 'tirUnique'],
      ['rechargeRapide', 'rechargeLente'],
      ['viseeLarge', 'viseeEtroite'],
    ] as const;

    for (const [bonus, malus] of paires) {
      const lesDeux = effets({ [bonus]: 3000, [malus]: 8000 });

      expect(effetQuiAgit(lesDeux, bonus)).toBe(false);
      expect(effetQuiAgit(lesDeux, malus)).toBe(false);
    }
  });

  it('n annule pas deux effets qui ne sont pas contraires', () => {
    const melange = effets({ rafale: 3000, viseeEtroite: 3000, rechargeRapide: 3000 });

    expect(effetQuiAgit(melange, 'rafale')).toBe(true);
    expect(effetQuiAgit(melange, 'viseeEtroite')).toBe(true);
    expect(effetQuiAgit(melange, 'rechargeRapide')).toBe(true);
  });
});

describe('la visee', () => {
  it('suit la visee large, la visee etroite, et revient a l ordinaire si elles s annulent', () => {
    expect(viseeDe(AUCUN_EFFET_TACTIQUE)).toBe('normale');
    expect(viseeDe(effets({ viseeLarge: 10 }))).toBe('large');
    expect(viseeDe(effets({ viseeEtroite: 10 }))).toBe('etroite');
    expect(viseeDe(effets({ viseeLarge: 10, viseeEtroite: 10 }))).toBe('normale');
  });

  it('elargit le cone a 120 degres sur 150 pixels, bornes comprises', () => {
    const large = CONES_DES_VISEES.large;
    const origine = { x: 0, y: 0 };
    const bord = (60 * Math.PI) / 180;

    expect(dansLeCone(origine, 'est', { x: 150, y: 0 }, large)).toBe(true);
    expect(dansLeCone(origine, 'est', { x: 150.01, y: 0 }, large)).toBe(false);
    expect(
      dansLeCone(origine, 'est', { x: 100 * Math.cos(bord), y: 100 * Math.sin(bord) }, large),
    ).toBe(true);
    // A 50 degres de l'axe: hors du cone ordinaire, dans le cone large.
    const cinquante = { x: 80 * Math.cos(0.873), y: 80 * Math.sin(0.873) };
    expect(dansLeCone(origine, 'est', cinquante, large)).toBe(true);
    expect(dansLeCone(origine, 'est', cinquante, CONES_DES_VISEES.normale)).toBe(false);
  });

  it('retrecit le cone a 60 degres sur 70 pixels, bornes comprises', () => {
    const etroit = CONES_DES_VISEES.etroite;
    const origine = { x: 0, y: 0 };
    const bord = (30 * Math.PI) / 180;

    expect(dansLeCone(origine, 'est', { x: 70, y: 0 }, etroit)).toBe(true);
    expect(dansLeCone(origine, 'est', { x: 71, y: 0 }, etroit)).toBe(false);
    expect(
      dansLeCone(origine, 'est', { x: 50 * Math.cos(bord), y: 50 * Math.sin(bord) }, etroit),
    ).toBe(true);
    expect(
      dansLeCone(origine, 'est', { x: 50 * Math.cos(0.6), y: 50 * Math.sin(0.6) }, etroit),
    ).toBe(false);
  });
});

describe('la recharge sous effet', () => {
  it('va 5 / 1,5 fois plus vite sous Recharge rapide, deux fois moins vite sous Recharge lente', () => {
    expect(vitesseDeRecharge(AUCUN_EFFET_TACTIQUE)).toBe(1);
    expect(vitesseDeRecharge(effets({ rechargeRapide: 10 }))).toBeCloseTo(5 / 1.5, 12);
    expect(vitesseDeRecharge(effets({ rechargeLente: 10 }))).toBe(0.5);
    expect(vitesseDeRecharge(effets({ rechargeRapide: 10, rechargeLente: 10 }))).toBe(1);
  });

  it('rend une charge en 1,5 seconde sous Recharge rapide', () => {
    const depart = arme({ charges: 0, effets: effets({ rechargeRapide: 10_000 }) });

    expect(recharger(depart, 1499).charges).toBe(0);
    expect(recharger(depart, 1500).charges).toBe(1);
  });

  it('rend une charge en 10 secondes sous Recharge lente', () => {
    const depart = arme({ charges: 0, effets: effets({ rechargeLente: 12_000 }) });

    expect(recharger(depart, 9999).charges).toBe(0);
    expect(recharger(depart, 10_000).charges).toBe(1);
  });

  it('garde le temps deja attendu quand l effet finit au milieu d une attente', () => {
    // Une seconde de Recharge rapide vaut 5 / 1,5 secondes d'attente ordinaire, puis le
    // temps reprend son cours: la charge revient 1 666 millisecondes plus tard.
    const depart = arme({ charges: 0, effets: effets({ rechargeRapide: 1000 }) });

    expect(avanceeDeLAttente(depart.effets, 2000)).toBeCloseTo(1000 * (5 / 1.5) + 1000, 9);
    expect(battre(depart, 2666).charges).toBe(0);
    expect(battre(depart, 2667).charges).toBe(1);
  });

  it('ne depend pas du decoupage du temps, effets compris', () => {
    const depart = arme({
      charges: 0,
      effets: effets({ rechargeRapide: 730, rechargeLente: 2100, viseeLarge: 400 }),
    });

    let parBattements = depart;
    for (let battement = 0; battement < 300; battement += 1) {
      parBattements = battre(parBattements, 41);
    }
    const dUnCoup = battre(depart, 300 * 41);

    expect(parBattements.charges).toBe(dUnCoup.charges);
    expect(parBattements.avantProchaineChargeMs).toBeCloseTo(dUnCoup.avantProchaineChargeMs, 6);
    expect(parBattements.effets).toEqual(dUnCoup.effets);
  });

  it('fait s ecouler les effets sans passer sous zero, et laisse une arme sans effet telle quelle', () => {
    const vieillie = vieillirLesEffets(
      arme({ effets: effets({ rafale: 30, viseeLarge: 900 }) }),
      50,
    );

    expect(vieillie.effets).toEqual(effets({ rafale: 0, viseeLarge: 850 }));

    const sansEffet = arme({});
    expect(vieillirLesEffets(sansEffet, 50)).toBe(sansEffet);
  });
});

describe('le Tir unique', () => {
  it('ne laisse qu une charge en main et gele les autres', () => {
    const gelee = gelerOuRendre(arme({ charges: 4, effets: effets({ tirUnique: 10_000 }) }));

    expect(gelee).toMatchObject({ charges: 1, chargesGelees: 3 });
    expect(chargesMaximum(gelee.effets)).toBe(1);
  });

  it('rend les charges gelees a la fin de l effet, sans depasser le maximum', () => {
    const finie = gelerOuRendre(arme({ charges: 1, chargesGelees: 4, effets: effets({}) }));

    expect(finie).toMatchObject({ charges: TACTIQUE.CHARGES_MAXIMUM, chargesGelees: 0 });

    const rendue = gelerOuRendre(arme({ charges: 0, chargesGelees: 3 }));
    expect(rendue).toMatchObject({ charges: 3, chargesGelees: 0 });
  });

  it('ne recharge que la charge en main', () => {
    const depart = arme({ charges: 0, chargesGelees: 4, effets: effets({ tirUnique: 60_000 }) });
    const apres = battre(depart, 20_000);

    expect(apres).toMatchObject({ charges: 1, chargesGelees: 4 });
    expect(apres.avantProchaineChargeMs).toBe(TACTIQUE.RECHARGE_MS);
  });

  it('empeche d enchainer deux tirs: il faut attendre la charge suivante', () => {
    let etat = troisJoueurs();
    etat = ajouterBot(etat, {
      id: 'b1',
      position: { x: 350, y: 300 },
      couleur: COULEUR_BOT_NEUTRE,
    });
    etat = armer(etat, 'alice', { orientation: 'est', effets: effets({ tirUnique: 10_000 }) });

    etat = tick(etat, tirs('alice'), BATTEMENT_MS);
    expect(etatTactiqueDe(etat, 'alice')).toMatchObject({ charges: 0, chargesGelees: 4 });

    etat = ajouterBot(etat, {
      id: 'b2',
      position: { x: 350, y: 310 },
      couleur: COULEUR_BOT_NEUTRE,
    });
    etat = tick(etat, tirs('alice'), BATTEMENT_MS);
    expect(etat.bots.b2?.couleur).toBe(COULEUR_BOT_NEUTRE);
  });

  it('est annule par une Rafale, qui rend les charges', () => {
    const annule = gelerOuRendre(
      arme({ charges: 1, chargesGelees: 3, effets: effets({ tirUnique: 5000, rafale: 2000 }) }),
    );

    expect(annule).toMatchObject({ charges: 4, chargesGelees: 0 });
  });
});

describe('la Rafale', () => {
  it('laisse tirer sans charge, et ne coute rien', () => {
    expect(peutTirer(arme({ charges: 0 }))).toBe(false);
    expect(peutTirer(arme({ charges: 0, effets: effets({ rafale: 100 }) }))).toBe(true);

    let etat = troisJoueurs();
    etat = ajouterBot(etat, {
      id: 'b1',
      position: { x: 350, y: 300 },
      couleur: COULEUR_BOT_NEUTRE,
    });
    etat = armer(etat, 'alice', {
      orientation: 'est',
      charges: 0,
      effets: effets({ rafale: 5000 }),
    });

    const apres = tirer(etat, 'alice');

    expect(apres.bots.b1?.couleur).toBe(ROUGE);
    expect(etatTactiqueDe(apres, 'alice').charges).toBe(0);
  });

  it('garde la seconde entre deux captures de joueur', () => {
    let etat = troisJoueurs();
    etat = avecJoueur(etat, 'dan', BLEU, { x: 350, y: 300 });
    etat = armer(etat, 'alice', { orientation: 'est', effets: effets({ rafale: 5000 }) });

    etat = tick(etat, tirs('alice'), BATTEMENT_MS);
    expect(etat.joueurs.dan?.position).not.toEqual({ x: 350, y: 300 });

    // Un second joueur dans le cone, au battement suivant: la seconde n'est pas passee.
    etat = avecJoueur(etat, 'eve', VERT, { x: 350, y: 310 });
    etat = tick(etat, tirs('alice'), BATTEMENT_MS);

    expect(etat.joueurs.eve?.position).toEqual({ x: 350, y: 310 });
  });
});

describe('le ramassage des objets du Tactique', () => {
  it('donne un bonus au ramasseur seul, et additionne deux bonus identiques', () => {
    let etat = ramasse(troisJoueurs(), 'alice', 'rafale');
    etat = ramasse(etat, 'alice', 'rafale');

    expect(etatTactiqueDe(etat, 'alice').effets.rafale).toBe(10_000);
    expect(etatTactiqueDe(etat, 'bob').effets).toEqual(AUCUN_EFFET_TACTIQUE);
    expect(etat.joueurs.alice?.bonusRestantsMs).toEqual(AUCUN_BONUS);
    expect(etat.evenements.at(-1)).toMatchObject({
      type: 'bonusRamasse',
      joueur: 'alice',
      nature: 'rafale',
      dureeMs: 5000,
    });
  });

  it('frappe les autres d un malus, epargne le ramasseur, et relance la duree sans l allonger', () => {
    let etat = ramasse(troisJoueurs(), 'alice', 'rechargeLente');
    etat = armer(etat, 'bob', { effets: effets({ rechargeLente: 4000 }) });
    etat = ramasse(etat, 'alice', 'rechargeLente');

    expect(etatTactiqueDe(etat, 'alice').effets.rechargeLente).toBe(0);
    expect(etatTactiqueDe(etat, 'bob').effets.rechargeLente).toBe(12_000);
    expect(etatTactiqueDe(etat, 'carla').effets.rechargeLente).toBe(12_000);
    expect(etat.joueurs.bob?.malusRestantsMs).toEqual(AUCUN_MALUS);
    expect(etat.evenements.at(-1)).toMatchObject({
      type: 'malusRamasse',
      joueur: 'alice',
      nature: 'rechargeLente',
      dureeMs: 12_000,
      victimes: ['bob', 'carla'],
    });
  });

  it('prend la duree reglee par l hote', () => {
    const regle = creerEtatInitial({
      graine: 1,
      mode: 'tactique',
      reglages: { ...CALME, objetsTactiques: { malus: { viseeEtroite: { dureeS: 20 } } } },
    });
    const etat = ramasse(troisJoueurs(regle), 'alice', 'viseeEtroite');

    expect(etatTactiqueDe(etat, 'bob').effets.viseeEtroite).toBe(20_000);
  });

  it('tire avec le cone large apres une Visee large, et le dit dans le journal', () => {
    let etat = ramasse(troisJoueurs(), 'alice', 'viseeLarge');
    etat = ajouterBot(etat, {
      id: 'loin',
      position: { x: 440, y: 300 },
      couleur: COULEUR_BOT_NEUTRE,
    });
    etat = armer(etat, 'alice', { orientation: 'est' });

    etat = tick(etat, tirs('alice'), BATTEMENT_MS);

    expect(etat.bots.loin?.couleur).toBe(ROUGE);
    expect(etat.evenements).toContainEqual(
      expect.objectContaining({ type: 'tirDeCapture', joueur: 'alice', visee: 'large' }),
    );
  });

  it('ne dit rien du cone d un tir ordinaire', () => {
    let etat = troisJoueurs();
    etat = armer(etat, 'alice', { orientation: 'est' });
    etat = tick(etat, tirs('alice'), BATTEMENT_MS);

    const tir = etat.evenements.find((evenement) => evenement.type === 'tirDeCapture');
    expect(tir).toBeDefined();
    expect(tir !== undefined && 'visee' in tir).toBe(false);
  });
});

describe('l apparition des objets du Tactique', () => {
  /**
   * Les natures posees sur la carte en cinq minutes, a une graine donnee. Chaque objet est
   * retire aussitot vu, pour que le plafond des malus poses n'arrete rien.
   */
  function naturesPosees(mode: 'tactique' | 'classique', reglages: ReglagesPartiels): string[] {
    let etat = creerEtatInitial({ graine: 7, mode, reglages });
    const natures: string[] = [];

    for (let battement = 0; battement < 6000; battement += 1) {
      etat = faireApparaitreLesObjets(etat, BATTEMENT_MS);
      natures.push(...Object.values(etat.objets).map((objet) => objet.nature));
      etat = { ...etat, objets: {} };
    }

    return natures;
  }

  it('fait apparaitre les six objets en Tactique', () => {
    const natures = new Set(
      naturesPosees('tactique', {
        botsNoirs: { actifs: false },
        malus: { tauxApparitionPourCent: 100 },
      }),
    );

    for (const nature of [...TYPES_BONUS_TACTIQUES, ...TYPES_MALUS_TACTIQUES]) {
      expect(natures.has(nature)).toBe(true);
    }
  });

  it('n en fait apparaitre aucun hors du Tactique', () => {
    const natures = naturesPosees('classique', { malus: { tauxApparitionPourCent: 100 } });

    expect(natures.length).toBeGreaterThan(0);
    expect(natures.some((nature) => estUnEffetTactique(nature as NatureObjet))).toBe(false);
  });

  it('pose a peu pres autant de bonus en Tactique qu ailleurs, les six a la moitie de leur taux', () => {
    const bonus = (mode: 'tactique' | 'classique'): number => {
      const vus = new Set<string>();
      for (let graine = 1; graine <= 40; graine += 1) {
        let etat = creerEtatInitial({ graine, mode, reglages: { botsNoirs: { actifs: false } } });
        for (let battement = 0; battement < 1200; battement += 1) {
          etat = faireApparaitreLesObjets(etat, BATTEMENT_MS);
          for (const objet of Object.values(etat.objets)) {
            if (objet.categorie === 'bonus') {
              vus.add(`${String(graine)}:${objet.id}`);
            }
          }
        }
      }
      return vus.size;
    };

    const tactique = bonus('tactique');
    const horde = bonus('classique');

    // Les taux par defaut font 60 pour cent par tentative dans les deux modes: 25, 15 et
    // 20 ailleurs; 12,5, 7,5, 10, puis 7,5, 12,5 et 10 en Tactique.
    expect(Math.abs(tactique - horde) / horde).toBeLessThan(0.1);
  });

  it('ne tire rien pour un objet du Tactique desactive', () => {
    const tousInactifs: ReglagesPartiels = {
      botsNoirs: { actifs: false },
      objetsTactiques: {
        bonus: {
          rafale: { actif: false },
          rechargeRapide: { actif: false },
          viseeLarge: { actif: false },
        },
        malus: {
          tirUnique: { actif: false },
          rechargeLente: { actif: false },
          viseeEtroite: { actif: false },
        },
      },
    };

    const natures = naturesPosees('tactique', tousInactifs);
    expect(natures.some((nature) => estUnEffetTactique(nature as NatureObjet))).toBe(false);
  });
});
