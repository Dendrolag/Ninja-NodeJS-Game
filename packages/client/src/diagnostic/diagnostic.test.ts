import { describe, expect, it } from 'vitest';

import { decrireLesVariantes, lireLaDemande } from './demande.js';
import { Histogramme } from './histogramme.js';
import { Releve } from './releve.js';
import { texteDuServeur } from './serveur.js';

describe('les battements du serveur dans le relevé (étape 8.6)', () => {
  it('écrit le résumé que le serveur a rendu', () => {
    const texte = texteDuServeur({
      ageS: 4,
      battement: {
        fenetreS: 300,
        battements: 3600,
        ecart: { mediane: 50, p90: 50.4, p99: 61.2, max: 140 },
        enRetard: 2,
        duree: { mediane: 0.4, p90: 0.9, p99: 1.6, max: 3.1 },
      },
    });

    expect(texte).toContain('== Serveur, battements de toutes ses parties');
    expect(texte).toContain('Fenêtre: les 300 dernières secondes, 3600 battements (lu il y a 4 s)');
    expect(texte).toContain(
      "Écart entre deux battements d'une partie, 50 ms visés: médiane 50,0, p90 50,4, p99 61,2, max 140,0 ms",
    );
    expect(texte).toContain("Battements d'au moins 100 ms: 2");
    expect(texte).toContain(
      "Durée d'un battement (moteur, codage, envoi): médiane 0,4, p90 0,9, p99 1,6, max 3,1 ms",
    );
  });

  it('dit quand le serveur n a pas encore été lu, n a rien battu, ou n a pas répondu', () => {
    expect(texteDuServeur(undefined)).toContain('Pas encore lu');
    expect(texteDuServeur({ ageS: 1, battement: null })).toContain(
      'Aucun battement dans la fenêtre du serveur (lu il y a 1 s).',
    );
    expect(texteDuServeur({ ageS: 2, echec: 'réponse illisible' })).toContain(
      'Lecture impossible (lu il y a 2 s): réponse illisible',
    );
  });
});

describe('la demande du relevé', () => {
  it('ne rend rien sans le paramètre, ni avec une autre valeur', () => {
    expect(lireLaDemande('')).toBeUndefined();
    expect(lireLaDemande('?diagnostic=0')).toBeUndefined();
    expect(lireLaDemande('?diagnostic=oui')).toBeUndefined();
    expect(lireLaDemande('?code=ABCD')).toBeUndefined();
  });

  it('ignore les variantes quand le relevé n est pas demandé', () => {
    expect(lireLaDemande('?densite=1&son=0&hud=0')).toBeUndefined();
  });

  it('rend le jeu tel quel avec le seul paramètre', () => {
    const variantes = lireLaDemande('?diagnostic=1');

    expect(variantes).toEqual({ son: true, lueur: true, hud: true, flou: true });
    expect(decrireLesVariantes(variantes!)).toBe('aucune');
  });

  it('lit chaque variante', () => {
    const variantes = lireLaDemande(
      '?diagnostic=1&rendu=webgpu&densite=1&cadence=60&son=0&lueur=0&hud=0&flou=0',
    );

    expect(variantes).toEqual({
      rendu: 'webgpu',
      densite: 1,
      cadence: 60,
      son: false,
      lueur: false,
      hud: false,
      flou: false,
    });
    expect(decrireLesVariantes(variantes!)).toBe(
      'rendu webgpu, densité 1, cadence 60, sans son, sans lueur, sans HUD, sans flou',
    );
  });

  it('laisse le réglage du jeu pour une valeur illisible ou hors bornes', () => {
    expect(lireLaDemande('?diagnostic=1&rendu=canvas&densite=12&cadence=abc')).toEqual({
      son: true,
      lueur: true,
      hud: true,
      flou: true,
    });
    expect(lireLaDemande('?diagnostic=1&densite=&cadence=5')).not.toHaveProperty('densite');
  });
});

describe('l histogramme des durées', () => {
  /** Cent durées de 1 à 100 millisecondes. */
  const centDurees = (): Histogramme => {
    const histogramme = new Histogramme();

    for (let duree = 1; duree <= 100; duree += 1) {
      histogramme.ajouter(duree);
    }

    return histogramme;
  };

  it('lit la médiane, le neuvième décile et le centile 99 d une série connue', () => {
    const histogramme = centDurees();

    // Arrondis par excès au dixième: la case de 50 va de 50 à 50,1.
    expect(histogramme.centile(0.5)).toBeCloseTo(50.1, 5);
    expect(histogramme.centile(0.9)).toBeCloseTo(90.1, 5);
    expect(histogramme.centile(0.99)).toBeCloseTo(99.1, 5);
    expect(histogramme.maximum).toBe(100);
    expect(histogramme.moyenne).toBeCloseTo(50.5, 5);
    expect(histogramme.total).toBe(100);
  });

  it('compte les durées d au moins un seuil', () => {
    const histogramme = centDurees();

    expect(histogramme.auDela(50)).toBe(51);
    expect(histogramme.auDela(100)).toBe(1);
    expect(histogramme.auDela(101)).toBe(0);
    expect(histogramme.auDela(0)).toBe(100);
  });

  it('dit que la moyenne ment: une saccade parmi cent images fluides', () => {
    const histogramme = new Histogramme();

    for (let image = 0; image < 99; image += 1) {
      histogramme.ajouter(16.7);
    }
    histogramme.ajouter(300);

    expect(histogramme.moyenne).toBeLessThan(20);
    expect(histogramme.centile(0.9)).toBeCloseTo(16.8, 5);
    expect(histogramme.centile(0.99)).toBeCloseTo(16.8, 5);
    expect(histogramme.maximum).toBe(300);
    expect(histogramme.auDela(50)).toBe(1);
  });

  it('range au-delà de deux secondes dans la dernière case, et ignore l illisible', () => {
    const histogramme = new Histogramme();

    histogramme.ajouter(5000);
    histogramme.ajouter(-3);
    histogramme.ajouter(Number.NaN);

    expect(histogramme.total).toBe(1);
    expect(histogramme.centile(0.5)).toBe(2000);
    expect(histogramme.maximum).toBe(5000);
    expect(histogramme.auDela(1000)).toBe(1);
  });

  it('se vide', () => {
    const histogramme = centDurees();

    histogramme.vider();

    expect(histogramme.total).toBe(0);
    expect(histogramme.centile(0.9)).toBe(0);
    expect(histogramme.auDela(0)).toBe(0);
  });
});

describe('le relevé d une partie', () => {
  /** Joue des images régulières, et rend l'instant de la dernière. */
  const jouer = (releve: Releve, depuis: number, ecartMs: number, images: number): number => {
    let instant = depuis;

    for (let rang = 0; rang < images; rang += 1) {
      releve.image({ instant, renduMs: 1, hudMs: 0.5, notreCodeMs: 2, tenue: false });
      releve.ajouterPixi(3);
      instant += ecartMs;
    }

    return instant - ecartMs;
  };

  it('compte les saccades et les attribue', () => {
    const releve = new Releve();
    const fin = jouer(releve, 1000, 16, 100);

    // Une image de 120 ms, dont PixiJS n'explique que 3.
    releve.image({ instant: fin + 120, renduMs: 1, hudMs: 0.5, notreCodeMs: 2, tenue: true });

    const resume = releve.resume();
    expect(resume.saccades).toBe(1);
    expect(resume.p90).toBeCloseTo(16.1, 5);

    const texte = releve.texte([['Appareil', 'essai']]);
    expect(texte).toContain('Appareil: essai');
    expect(texte).toContain("Images d'au moins 25 ms: 1, 50 ms: 1, 100 ms: 1, 250 ms: 0");
    expect(texte).toContain('Images tenues, le lissage attendant le réseau: 1');
    // La pire image est en tête de sa liste, avec le temps de PixiJS qui l'a précédée.
    expect(texte).toMatch(/pendant\n1,70 \| 120,0 \| 2,00 \| 3,00 \| 0/u);
  });

  it('suit les instantanés, leurs écarts et les battements sautés', () => {
    const releve = new Releve();
    jouer(releve, 0, 16, 10);

    releve.instantane(0, 1);
    releve.instantane(50, 2);
    releve.instantane(200, 5);

    const texte = releve.texte([]);
    expect(texte).toContain('Instantanés reçus: 3');
    expect(texte).toContain('battements sautés: 2');
    expect(texte).toContain("Instantanés d'au moins 100 ms: 1");
  });

  it('compte à part les images lentes vues après le lever de l écran de préparation', () => {
    const releve = new Releve();
    let instant = jouer(releve, 0, 16, 5);

    // Une image lente sous l'écran de préparation: le joueur ne la voit pas.
    instant += 200;
    releve.image({ instant, renduMs: 1, hudMs: 0.5, notreCodeMs: 2, tenue: false });
    releve.leverLeRideau(instant);

    instant = jouer(releve, instant + 16, 16, 5);
    instant += 80;
    releve.image({ instant, renduMs: 1, hudMs: 0.5, notreCodeMs: 2, tenue: false });

    const texte = releve.texte([]);
    expect(texte).toContain("Images d'au moins 25 ms: 2, 50 ms: 2");
    expect(texte).toContain(
      "Écran de préparation levé à 0,26 s; images d'au moins 50 ms ensuite: 1",
    );
  });

  it('dit quand l écran de préparation n est pas encore levé', () => {
    const releve = new Releve();
    jouer(releve, 0, 16, 5);

    expect(releve.texte([])).toContain('Écran de préparation: pas encore levé');
  });

  it('ne compte pas l écart d une page cachée', () => {
    const releve = new Releve();
    const fin = jouer(releve, 0, 16, 10);

    releve.interrompre();
    releve.image({ instant: fin + 5000, renduMs: 1, hudMs: 0.5, notreCodeMs: 2, tenue: false });

    expect(releve.resume().saccades).toBe(0);
    expect(releve.texte([])).toContain('Interruptions (page cachée): 1');
  });

  it('déroule la partie par fenêtres de cinq secondes', () => {
    const releve = new Releve();
    jouer(releve, 0, 20, 500);

    const texte = releve.texte([]);
    // Dix secondes de jeu à cinquante images par seconde: deux fenêtres. La toute
    // première image n'a pas d'image précédente: PixiJS n'y est pas compté. La seconde
    // fenêtre, pas encore finie, se rapporte à sa durée jouée: 250 images en 4,98 s.
    expect(texte).toContain('\n0 | 50,0 | 20,0 | 0 | 2,00 | 2,99');
    expect(texte).toContain('\n5 | 50,2 | 20,0 | 0 | 2,00 | 3,00');
  });

  it('repart de zéro quand une partie commence', () => {
    const releve = new Releve();
    const fin = jouer(releve, 0, 16, 10);
    releve.image({ instant: fin + 200, renduMs: 1, hudMs: 0.5, notreCodeMs: 2, tenue: false });

    releve.vider();

    expect(releve.resume()).toEqual({ cadence: 0, p90: 0, p99: 0, saccades: 0 });
    expect(releve.texte([])).toContain('Durée mesurée: 0,0 s, 0 images');
  });
});
