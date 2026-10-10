/**
 * Tests des taches visuelles d'Among Ninjas cote page (etape 7.21): les etincelles et la
 * bouffee dessinees a la station une seconde et demie, et leur son, situe, entendu de ceux qui
 * les voient.
 */

import { describe, expect, it } from 'vitest';

import { fait } from '../faits.js';
import { sonDuFait } from '../sons/declencheurs.js';
import { lieuDuSon } from '../sons/espace.js';
import { APPARENCE_DES_TACHES_VISUELLES, effetsDesTachesVisuelles } from './among.js';

const ETINCELLES = fait('tacheVisuelle', { nature: 'katana', x: 170, y: 180 }, 1000);
const BOUFFEE = fait('tacheVisuelle', { nature: 'fumee', x: 1320, y: 1070 }, 1000);

describe('les taches visuelles', () => {
  it('jettent une gerbe d etincelles autour de la station, qui s eteint', () => {
    const debut = effetsDesTachesVisuelles([ETINCELLES], 1000);
    const milieu = effetsDesTachesVisuelles([ETINCELLES], 1750);

    expect(debut).toHaveLength(APPARENCE_DES_TACHES_VISUELLES.etincelles.nombre);
    expect(debut.every((disque) => disque.x === 170 && disque.y === 180)).toBe(true);
    expect(milieu.some((disque) => disque.y < 180)).toBe(true);
    expect(milieu.every((disque) => (disque.remplissage?.alpha ?? 0) < 1)).toBe(true);
  });

  it('lachent une bouffee grise qui monte au-dessus de la station', () => {
    const milieu = effetsDesTachesVisuelles([BOUFFEE], 1750);

    expect(milieu).toHaveLength(APPARENCE_DES_TACHES_VISUELLES.bouffee.nombre);
    expect(milieu.every((disque) => disque.y < 1070)).toBe(true);
    expect(milieu.every((disque) => disque.remplissage?.couleur === 0xcfd4dc)).toBe(true);
  });

  it('durent une seconde et demie, et rien d autre ne se dessine', () => {
    const fin = 1000 + APPARENCE_DES_TACHES_VISUELLES.dureeMs;

    expect(effetsDesTachesVisuelles([ETINCELLES, BOUFFEE], fin)).toEqual([]);
    expect(effetsDesTachesVisuelles([ETINCELLES], 999)).toEqual([]);
    expect(
      effetsDesTachesVisuelles(
        [fait('joueurParti', { id: 'a', pseudo: 'A', hote: false }, 1000)],
        1100,
      ),
    ).toEqual([]);
  });

  it('s entendent a leur station, en etincelles ou en bouffee', () => {
    expect(sonDuFait(ETINCELLES)).toBe('tacheEtincelles');
    expect(sonDuFait(BOUFFEE)).toBe('tacheBouffee');
    expect(lieuDuSon(BOUFFEE, 'moi', { x: 0, y: 0 })).toEqual({ x: 1320, y: 1070 });
  });
});
