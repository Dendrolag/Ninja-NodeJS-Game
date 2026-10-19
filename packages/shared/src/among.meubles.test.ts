/**
 * Tests des meubles d'Among Ninjas (16 octobre 2026): une station habillee d'un meuble s'ouvre de
 * tout le tour du meuble, et pas seulement de son disque; et ce que dure un deguisement selon le
 * role.
 */

import { describe, expect, it } from 'vitest';

import type { StationDuMode } from './among.js';
import { AMONG, LIEUX_DES_CARTES, aLaStation, dureeDuDeguisementMs, lieuxDuMode } from './among.js';
import { CARTES } from './constantes.js';

/** Une station devant un meuble de 60 sur 40, centre en (500, 300), elle-meme en (500, 345). */
const STATION: StationDuMode = {
  x: 500,
  y: 345,
  nom: 'Borne',
  natures: ['couleurs'],
  emprise: { x: 500, y: 300, largeur: 60, hauteur: 40 },
};

describe('la portee d une station', () => {
  it('couvre son disque, avec ou sans meuble', () => {
    const { emprise: _sans, ...nue } = STATION;

    expect(aLaStation(STATION, { x: 500, y: 345 + AMONG.RAYON_D_UNE_STATION_PX })).toBe(true);
    expect(aLaStation(nue, { x: 500, y: 345 + AMONG.RAYON_D_UNE_STATION_PX })).toBe(true);
    expect(aLaStation(nue, { x: 500, y: 345 + AMONG.RAYON_D_UNE_STATION_PX + 1 })).toBe(false);
  });

  it('couvre tout le tour du meuble, colle a lui de quelque cote que ce soit', () => {
    // Au nord du meuble, loin du disque: 280 - 16, un ninja colle au bord du haut.
    expect(aLaStation(STATION, { x: 500, y: 280 - 16 })).toBe(true);
    // A l'est et a l'ouest, a la marge exacte.
    expect(aLaStation(STATION, { x: 530 + AMONG.MARGE_D_UN_MEUBLE_PX, y: 300 })).toBe(true);
    expect(aLaStation(STATION, { x: 470 - AMONG.MARGE_D_UN_MEUBLE_PX, y: 300 })).toBe(true);
    // Au-dela de la marge, plus rien.
    expect(aLaStation(STATION, { x: 500, y: 280 - AMONG.MARGE_D_UN_MEUBLE_PX - 1 })).toBe(false);
    expect(aLaStation(STATION, { x: 530 + AMONG.MARGE_D_UN_MEUBLE_PX + 1, y: 300 })).toBe(false);
  });
});

describe('les emprises des meubles de Tokyo', () => {
  const lieux = LIEUX_DES_CARTES.map1 ?? expect.fail('Tokyo a ses lieux');

  it('suivent chaque place d une station habillee, prises de l objet devant elle', () => {
    const roses =
      lieux.stations.find((station) => station.nom === "Bornes roses de l'arcade") ??
      expect.fail('les bornes roses');

    expect(roses.places).toHaveLength(9);
    for (const place of roses.places ?? []) {
      const objet = lieux.objets.find(
        (candidat) => candidat.devant?.x === place.x && candidat.devant.y === place.y,
      );

      expect(place.emprise).toEqual({
        x: objet?.place?.x,
        y: objet?.place?.y,
        largeur: objet?.largeur,
        hauteur: objet?.hauteur,
      });
    }
  });

  it('habillent aussi les stations a une place, et pas celles sans meuble', () => {
    const nom = (cherche: string) =>
      lieux.stations.find((station) => station.nom === cherche) ?? expect.fail(cherche);

    expect(nom('Tapis du salon').emprise).toBeDefined();
    expect(nom('Pierre du jardin zen').emprise).toEqual({
      x: 170,
      y: 180,
      largeur: 96,
      hauteur: 96,
    });
    expect(nom("Lavabos de l'arcade").emprise).toBeUndefined();
  });

  it('se retournent avec la carte en miroir', () => {
    const miroir = lieuxDuMode('map1', true) ?? expect.fail('Tokyo en miroir');
    const tapis = lieux.stations.find((station) => station.nom === 'Tapis du salon');
    const retourne = miroir.stations.find((station) => station.nom === 'Tapis du salon');

    expect(retourne?.emprise?.x).toBe(CARTES.map1.largeur - (tapis?.emprise?.x ?? 0));
    const rouges = miroir.stations.find((station) => station.nom === "Bornes rouges de l'arcade");
    const normales = lieux.stations.find((station) => station.nom === "Bornes rouges de l'arcade");
    expect(rouges?.places?.[2]?.emprise?.x).toBe(
      CARTES.map1.largeur - (normales?.places?.[2]?.emprise?.x ?? 0),
    );
  });
});

describe('ce que dure un deguisement', () => {
  it('vingt secondes pour une proie, la recharge et cinq secondes pour un assassin', () => {
    expect(dureeDuDeguisementMs('proie', 25)).toBe(AMONG.DUREE_DU_DEGUISEMENT_MS);
    expect(dureeDuDeguisementMs('tueur', 25)).toBe(30_000);
    expect(dureeDuDeguisementMs('tueur', 60)).toBe(65_000);
  });
});
