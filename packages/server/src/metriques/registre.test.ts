/**
 * Tests du module de metriques (etape 5.15): ce que comptent les compteurs, les jauges et
 * les histogrammes, le texte que lit l'agent de la machine, et ce qu'observer coute.
 */

import { describe, expect, it } from 'vitest';

import { Histogramme, Registre } from './registre.js';

describe('les series', () => {
  it('un compteur ne fait que monter', () => {
    const compteur = new Registre().compteurs('essais_total', 'Essais.').serie();

    compteur.ajouter();
    compteur.ajouter(4);
    compteur.ajouter(-3);
    compteur.ajouter(Number.NaN);

    expect(compteur.valeur).toBe(5);
  });

  it('une jauge prend la derniere valeur posee, zero si elle est illisible', () => {
    const jauge = new Registre().jauges('memoire', 'Memoire.').serie();

    jauge.poser(12);
    jauge.poser(7);
    expect(jauge.valeur).toBe(7);

    jauge.poser(Number.POSITIVE_INFINITY);
    expect(jauge.valeur).toBe(0);
  });

  it('un histogramme range chaque valeur dans la premiere case qui la contient', () => {
    const histogramme = new Histogramme([1, 5, 10]);

    for (const valeur of [0, 1, 1.01, 5, 9, 10, 11, 500]) {
      histogramme.observer(valeur);
    }

    histogramme.observer(-1);
    histogramme.observer(Number.NaN);

    expect([...histogramme.cases]).toEqual([2, 2, 2, 2]);
    expect(histogramme.nombre).toBe(8);
    expect(histogramme.somme).toBeCloseTo(537.01);
  });

  it('un histogramme fusionne les cases d un bulletin', () => {
    const histogramme = new Histogramme([10, 20]);
    histogramme.observer(15);

    histogramme.fusionner([3, 0, 1], 70);

    expect([...histogramme.cases]).toEqual([3, 1, 1]);
    expect(histogramme.nombre).toBe(5);
    expect(histogramme.somme).toBe(85);
  });

  it('une famille garde une serie par combinaison d etiquettes', () => {
    const famille = new Registre().compteurs('battements_total', 'Battements.', ['mode']);

    famille.serie('classique').ajouter();
    famille.serie('classique').ajouter();
    famille.serie('among').ajouter();

    expect(famille.taille).toBe(2);
    expect(famille.serie('classique').valeur).toBe(2);
  });

  it('refuse une serie demandee avec un mauvais nombre d etiquettes', () => {
    const famille = new Registre().compteurs('battements_total', 'Battements.', ['mode']);

    expect(() => famille.serie()).toThrow(/attend 1 etiquettes/u);
  });

  it('refuse deux familles du meme nom', () => {
    const registre = new Registre();
    registre.compteurs('battements_total', 'Battements.');

    expect(() => registre.jauges('battements_total', 'Encore.')).toThrow(/existe deja/u);
  });
});

describe('le texte de Prometheus', () => {
  it('ecrit chaque famille, ses series, et les etiquettes communes', () => {
    const registre = new Registre({ version: 'abc123' });
    registre.compteurs('neon_essais_total', 'Les essais.', ['mode']).serie('classique').ajouter(3);
    registre.jauges('neon_parties', 'Les parties.').serie().poser(2.5);
    const histogramme = registre.histogrammes('neon_duree_ms', 'Les durees.', [1, 10]).serie();
    histogramme.observer(0.5);
    histogramme.observer(4);
    histogramme.observer(40);

    expect(registre.ecrire()).toBe(
      [
        '# HELP neon_essais_total Les essais.',
        '# TYPE neon_essais_total counter',
        'neon_essais_total{mode="classique",version="abc123"} 3',
        '# HELP neon_parties Les parties.',
        '# TYPE neon_parties gauge',
        'neon_parties{version="abc123"} 2.5',
        '# HELP neon_duree_ms Les durees.',
        '# TYPE neon_duree_ms histogram',
        'neon_duree_ms_bucket{le="1",version="abc123"} 1',
        'neon_duree_ms_bucket{le="10",version="abc123"} 2',
        'neon_duree_ms_bucket{le="+Inf",version="abc123"} 3',
        'neon_duree_ms_sum{version="abc123"} 44.5',
        'neon_duree_ms_count{version="abc123"} 3',
        '',
      ].join('\n'),
    );
  });

  it('n ecrit pas une famille sans serie', () => {
    const registre = new Registre();
    registre.compteurs('neon_vide_total', 'Rien.', ['mode']);

    expect(registre.ecrire()).toBe('\n');
  });

  it('echappe les valeurs d etiquettes', () => {
    const registre = new Registre();
    registre.jauges('neon_essai', 'Essai.', ['texte']).serie('a"b\\c\nd').poser(1);

    expect(registre.ecrire()).toContain('neon_essai{texte="a\\"b\\\\c\\nd"} 1');
  });

  it('compte ses series, histogrammes case par case', () => {
    const registre = new Registre();
    registre.compteurs('neon_a_total', 'A.', ['mode']).serie('x');
    registre.histogrammes('neon_b', 'B.', [1, 2, 3]).serie();

    // Un compteur, et un histogramme de quatre cases plus sa somme et son nombre.
    expect(registre.nombreDeSeries).toBe(1 + 4 + 2);
  });
});

describe('ce qu observer coute', () => {
  it('n alloue rien: un million d observations ne font pas grossir le tas', () => {
    const registre = new Registre();
    const histogramme = registre
      .histogrammes('neon_duree_ms', 'Durees.', [0.25, 0.5, 1, 2, 4, 8, 16, 25, 50, 100])
      .serie();
    const compteur = registre.compteurs('neon_total', 'Total.').serie();

    // Un premier passage installe le code optimise; le second se mesure.
    const observer = (fois: number): void => {
      for (let rang = 0; rang < fois; rang += 1) {
        histogramme.observer(rang % 120);
        compteur.ajouter();
      }
    };
    observer(100_000);

    // La plus petite croissance du tas sur trois essais: le reste du processus peut allouer
    // pendant l'un d'eux.
    const croissances = [0, 1, 2].map(() => {
      const avant = process.memoryUsage().heapUsed;
      observer(1_000_000);
      return process.memoryUsage().heapUsed - avant;
    });

    // Une allocation par observation ferait des dizaines de mega-octets.
    expect(Math.min(...croissances)).toBeLessThan(2_000_000);
    expect(histogramme.nombre).toBe(3_100_000);
  });
});
