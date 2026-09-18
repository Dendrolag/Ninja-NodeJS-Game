/**
 * Tests du signal de vie qui garde le serveur de jeu eveille (etape 5.5).
 *
 * En offre gratuite, Render endort le serveur apres quinze minutes sans requete
 * entrante. Une fois le lien de jeu ouvert en WebSocket, la page n'en envoyait plus:
 * le serveur s'endormait sous un joueur reste sur les menus, qui attendait ensuite
 * son reveil. La page demande donc la route de sante a intervalle regulier, tant
 * qu'elle est visible.
 */

import { describe, expect, it } from 'vitest';

import { INTERVALLE_EVEIL_MS, garderEveille } from './eveil.js';

/** Un environnement d'essai: une horloge a la main, et une page visible ou non. */
function environnement(visible = true) {
  const appels: string[] = [];
  let maintenant = 0;
  let minuterie: (() => void) | undefined;
  let surVisibilite: (() => void) | undefined;
  const page = { visible };

  const arreter = garderEveille({
    adresse: 'https://serveur.exemple/sante',
    demander: (adresse) => {
      appels.push(adresse);
    },
    maintenant: () => maintenant,
    repeter: (rappel) => {
      minuterie = rappel;
      return () => {
        minuterie = undefined;
      };
    },
    estVisible: () => page.visible,
    surChangementDeVisibilite: (rappel) => {
      surVisibilite = rappel;
      return () => {
        surVisibilite = undefined;
      };
    },
  });

  return {
    appels,
    page,
    arreter,
    avancer(ms: number) {
      maintenant += ms;
      minuterie?.();
    },
    changerDeVisibilite(visible: boolean) {
      page.visible = visible;
      surVisibilite?.();
    },
    actif: () => minuterie !== undefined || surVisibilite !== undefined,
  };
}

describe('garderEveille', () => {
  it('reste sous les quinze minutes de Render', () => {
    expect(INTERVALLE_EVEIL_MS).toBeLessThan(15 * 60_000);
  });

  it('demande la route de sante a chaque intervalle, tant que la page est visible', () => {
    const essai = environnement();

    essai.avancer(INTERVALLE_EVEIL_MS);
    essai.avancer(INTERVALLE_EVEIL_MS);

    expect(essai.appels).toEqual([
      'https://serveur.exemple/sante',
      'https://serveur.exemple/sante',
    ]);
  });

  it('se tait quand la page est cachee: un onglet oublie ne garde pas le serveur eveille', () => {
    const essai = environnement(false);

    essai.avancer(INTERVALLE_EVEIL_MS);

    expect(essai.appels).toEqual([]);
  });

  it('reprend aussitot en revenant au premier plan apres un long moment', () => {
    const essai = environnement();

    essai.changerDeVisibilite(false);
    essai.avancer(INTERVALLE_EVEIL_MS * 3);
    essai.changerDeVisibilite(true);

    expect(essai.appels).toHaveLength(1);
  });

  it('ne double pas un signal recent en revenant au premier plan', () => {
    const essai = environnement();

    essai.avancer(INTERVALLE_EVEIL_MS);
    essai.changerDeVisibilite(false);
    essai.changerDeVisibilite(true);

    expect(essai.appels).toHaveLength(1);
  });

  it('s arrete sur demande', () => {
    const essai = environnement();

    essai.arreter();

    expect(essai.actif()).toBe(false);
  });
});
