/**
 * Tests de la sonde de surveillance de la page (étape 5.15): les cases, la remise à zéro à
 * chaque bulletin, l'onglet caché et l'écran de préparation exclus, ce qu'une image coûte,
 * et la description de l'appareil.
 */

import { lireLeBulletin, coderLeBulletin } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { MesureDImage } from './releve.js';
import {
  SondeDeSurveillance,
  decrireLAppareil,
  familleDuNavigateur,
  genreDAppareil,
  sondesReunies,
} from './surveillance.js';

/** Une image à cet instant, dont notre code a pris tant de millisecondes. */
function image(instant: number, notreCodeMs = 2, tenue = false): MesureDImage {
  return { instant, renduMs: notreCodeMs / 2, hudMs: notreCodeMs / 2, notreCodeMs, tenue };
}

/** Une sonde dont l'écran de préparation est levé à l'instant zéro. */
function sondeLevee(): SondeDeSurveillance {
  const sonde = new SondeDeSurveillance();
  sonde.leverLeRideau();
  sonde.image(image(0));
  return sonde;
}

describe('la sonde de surveillance', () => {
  it('range les durées d images dans leurs cases et compte les lentes', () => {
    const sonde = sondeLevee();
    let instant = 0;

    // Dix images à 60 Hz, une de 40 ms, une de 60 ms, une de 150 ms.
    for (const duree of [...Array.from({ length: 10 }, () => 16.7), 40, 60, 150]) {
      instant += duree;
      sonde.image(image(instant, 3));
    }

    const bulletin = sonde.bulletin(false);

    expect(bulletin.images.cases).toEqual([0, 10, 0, 0, 1, 1, 1, 0]);
    expect(bulletin.images.sommeMs).toBeCloseTo(417);
    expect(bulletin.images.lentes).toBe(2);
    expect(bulletin.images.tresLentes).toBe(1);
    expect(bulletin.pire).toEqual({ dureeMs: 150, notreCodeMs: 3, pixiMs: 0 });
  });

  it('sépare notre code, PixiJS et le reste dans les images lentes', () => {
    const sonde = sondeLevee();

    sonde.ajouterPixi(20);
    sonde.image(image(80, 10));
    // Une image rapide ne compte pas dans les lentes.
    sonde.ajouterPixi(5);
    sonde.image(image(96, 4));

    expect(sonde.bulletin(true).lentes).toEqual({ notreCodeMs: 10, pixiMs: 20, resteMs: 50 });
  });

  it('suit les instantanés: écarts, retards, et le plus grand', () => {
    const sonde = sondeLevee();

    for (const instant of [0, 50, 100, 150, 280, 330]) {
      sonde.instantane(instant);
    }

    const { instantanes } = sonde.bulletin(false);

    expect(instantanes.cases).toEqual([0, 4, 0, 0, 1, 0, 0, 0]);
    expect(instantanes.enRetard).toBe(1);
    expect(instantanes.ecartMaxMs).toBe(130);
    expect(instantanes.sommeMs).toBe(330);
  });

  it('compte les images tenues, les allers et retours, les personnages et les erreurs', () => {
    const sonde = sondeLevee();

    sonde.image(image(17, 2, true));
    sonde.allerRetour(40);
    sonde.allerRetour(55);
    sonde.personnages(120);
    sonde.personnages(90);
    sonde.erreur('script');
    sonde.erreur('promesse');
    sonde.erreur('promesse');

    const bulletin = sonde.bulletin(true);

    expect(bulletin.images.tenues).toBe(1);
    expect(bulletin.allersRetoursMs).toEqual([40, 55]);
    expect(bulletin.entites).toBe(120);
    expect(bulletin.son).toBe(true);
    expect(bulletin.erreurs).toEqual({ script: 1, promesse: 2 });
  });

  it('ne garde que quatre allers et retours par bulletin', () => {
    const sonde = sondeLevee();

    for (const duree of [1, 2, 3, 4, 5, 6]) {
      sonde.allerRetour(duree);
    }

    expect(sonde.bulletin(false).allersRetoursMs).toEqual([1, 2, 3, 4]);
  });

  it('repart de zéro à chaque bulletin, sans perdre l instant de la dernière image', () => {
    const sonde = sondeLevee();
    sonde.image(image(100));
    sonde.instantane(0);
    sonde.allerRetour(30);
    sonde.bulletin(false);

    expect(sonde.aDuNouveau).toBe(false);

    // L'écart suivant se mesure depuis la dernière image du bulletin précédent.
    sonde.image(image(117));
    sonde.instantane(50);
    const suivant = sonde.bulletin(false);

    expect(suivant.images.cases).toEqual([0, 1, 0, 0, 0, 0, 0, 0]);
    expect(suivant.images.lentes).toBe(0);
    expect(suivant.instantanes.cases).toEqual([0, 1, 0, 0, 0, 0, 0, 0]);
    expect(suivant.allersRetoursMs).toEqual([]);
    expect(suivant.pire.dureeMs).toBe(17);
  });

  it('ne compte pas les images d un onglet caché, ni l écart qui enjambe le passage', () => {
    const sonde = sondeLevee();

    sonde.visibilite(false);
    // Un onglet caché ralentit sa boucle: une image par seconde.
    sonde.image(image(1000));
    sonde.image(image(2000));
    sonde.instantane(1000);
    sonde.instantane(2000);
    sonde.visibilite(true);
    sonde.image(image(5000));
    sonde.image(image(5017));

    const bulletin = sonde.bulletin(false);

    expect(bulletin.images.cachees).toBe(2);
    expect(bulletin.images.lentes).toBe(0);
    expect(bulletin.images.cases).toEqual([0, 1, 0, 0, 0, 0, 0, 0]);
    expect(bulletin.instantanes.cases.every((nombre) => nombre === 0)).toBe(true);
  });

  it('ne compte rien avant le lever de l écran de préparation', () => {
    const sonde = new SondeDeSurveillance();

    // Les premières images préparent le décor et rament.
    sonde.image(image(0));
    sonde.image(image(400));
    sonde.instantane(0);
    sonde.instantane(400);

    expect(sonde.aDuNouveau).toBe(false);

    sonde.leverLeRideau();
    sonde.image(image(410));
    sonde.image(image(427));

    expect(sonde.bulletin(false).images.cases).toEqual([0, 1, 0, 0, 0, 0, 0, 0]);
  });

  it('rend un bulletin que le serveur accepte', () => {
    const sonde = sondeLevee();
    let instant = 0;

    for (let rang = 0; rang < 600; rang += 1) {
      instant += rang % 97 === 0 ? 120 : 16.7;
      sonde.ajouterPixi(1.3);
      sonde.image(image(instant, 2.1, rang % 50 === 0));
      sonde.instantane(instant * 1.01);
    }

    sonde.allerRetour(48.7);

    expect(lireLeBulletin(coderLeBulletin(sonde.bulletin(true))).valide).toBe(true);
  });

  it('n alloue rien par image', () => {
    const sonde = sondeLevee();
    let instant = 0;
    const jouer = (images: number): void => {
      for (let rang = 0; rang < images; rang += 1) {
        instant += rang % 31 === 0 ? 70 : 16.7;
        sonde.ajouterPixi(1);
        sonde.image({ instant, renduMs: 1, hudMs: 1, notreCodeMs: 2, tenue: false });
        sonde.instantane(instant);
      }
    };
    // Le premier passage installe le code optimisé.
    jouer(50_000);

    const avant = process.memoryUsage().heapUsed;
    jouer(500_000);
    const apres = process.memoryUsage().heapUsed;

    // Une allocation par image ferait des dizaines de méga-octets.
    expect(apres - avant).toBeLessThan(1_000_000);
  });

  it('se réunit au relevé sur la même boucle', () => {
    const vues: number[] = [];
    const sonde = sondesReunies(
      { image: (mesure) => vues.push(mesure.instant) },
      { image: (mesure) => vues.push(-mesure.instant) },
    );

    sonde.image(image(12));

    expect(vues).toEqual([12, -12]);
  });
});

describe('l appareil', () => {
  it('reconnaît la famille du navigateur', () => {
    const agents: [string, string][] = [
      [
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
        'safari',
      ],
      [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        'chrome',
      ],
      [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
        'edge',
      ],
      [
        'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
        'samsung',
      ],
      ['Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0', 'firefox'],
      [
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1',
        'chrome',
      ],
      ['un robot quelconque', 'autre'],
    ];

    for (const [agent, famille] of agents) {
      expect(familleDuNavigateur(agent)).toBe(famille);
    }
  });

  it('distingue le téléphone, la tablette et l ordinateur', () => {
    expect(genreDAppareil(true, 390, 844)).toBe('telephone');
    expect(genreDAppareil(true, 844, 390)).toBe('telephone');
    expect(genreDAppareil(true, 820, 1180)).toBe('tablette');
    expect(genreDAppareil(false, 1920, 1080)).toBe('ordinateur');
    expect(genreDAppareil(false, 390, 844)).toBe('ordinateur');
  });

  it('décrit l appareil, sans ce que le navigateur ne dit pas', () => {
    expect(
      decrireLAppareil({
        agent: 'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0',
        tactile: false,
        largeur: 1920,
        hauteur: 1080,
        densite: 1.25,
        coeurs: 16,
        rendu: 'webgl',
      }),
    ).toEqual({
      appareil: 'ordinateur',
      navigateur: 'firefox',
      moteur: 'webgl',
      largeur: 1920,
      hauteur: 1080,
      densite: 1.25,
      coeurs: 16,
    });

    expect(
      decrireLAppareil({
        agent: '',
        tactile: true,
        largeur: 390,
        hauteur: 844,
        densite: 3,
        rendu: 'webgl2',
      }).moteur,
    ).toBe('inconnu');
  });
});
