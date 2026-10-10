/**
 * Tests de ce que la page retient des taches courtes d'Among Ninjas (etape 7.21): la fenetre
 * ouverte par le serveur ou par une feinte, sa fermeture, ce que le client envoie, et les
 * commandes figees pendant la tache.
 */

import type { EtatPriveAmong } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import {
  AMONG_INCONNU,
  apresLaFermeture,
  apresLaReunion,
  avecLEtatPrive,
  avecUneFeinte,
} from './among.js';
import { creerClient } from './client.js';
import { brancherClavier } from './controles/clavier.js';
import { Controles } from './controles/controles.js';
import { creerHorlogeClientManuelle } from './horloge.js';
import { creerReseauFactice } from './reseau.js';

/** Une proie, deux taches: la premiere ouverte si on le demande. */
function proie(tacheEnCours?: number): EtatPriveAmong {
  return {
    role: 'proie',
    complices: [],
    fantome: false,
    gong: { x: 1145, y: 630 },
    stations: [
      { x: 990, y: 190, nom: "Bornes d'arcade", natures: ['couleurs'] },
      { x: 630, y: 1295, nom: 'Cuisine du restaurant', natures: ['sang', 'katana'] },
    ],
    taches: [
      { station: 0, nature: 'couleurs', faite: false },
      { station: 1, nature: 'katana', faite: false },
    ],
    ...(tacheEnCours === undefined ? {} : { tacheEnCours }),
    gongUtilise: false,
  };
}

/** Un assassin, qui voit deux stations. */
const ASSASSIN: EtatPriveAmong = {
  ...proie(),
  role: 'tueur',
  taches: [],
};

describe('la fenetre d une vraie tache', () => {
  it('s ouvre quand le serveur dit la tache ouverte, de cet instant, et pas deux fois', () => {
    const ouverte = avecLEtatPrive(avecLEtatPrive(AMONG_INCONNU, proie(), 0), proie(1), 500);

    expect(ouverte.tacheOuverte).toEqual({
      nature: 'katana',
      station: proie().stations[1],
      depuis: 500,
      feinte: false,
    });
    expect(avecLEtatPrive(ouverte, proie(1), 900).tacheOuverte?.depuis).toBe(500);
  });

  it('se ferme quand le serveur ne la dit plus ouverte', () => {
    const ouverte = avecLEtatPrive(AMONG_INCONNU, proie(0), 0);

    expect(avecLEtatPrive(ouverte, proie(), 10).tacheOuverte).toBeUndefined();
  });

  it('fermee par nous, attend que le serveur la dise fermee, sans se rouvrir d ici la', () => {
    const fermee = apresLaFermeture(avecLEtatPrive(AMONG_INCONNU, proie(0), 0));

    expect(fermee.tacheOuverte).toBeUndefined();
    expect(fermee.fermetureEnAttente).toBe(true);

    const encore = avecLEtatPrive(fermee, proie(0), 20);
    expect(encore.tacheOuverte).toBeUndefined();
    expect(encore.fermetureEnAttente).toBe(true);

    expect(avecLEtatPrive(encore, proie(), 40).fermetureEnAttente).toBeUndefined();
  });

  it('n attend rien d une tache que le serveur avait deja fermee', () => {
    const ouverte = avecLEtatPrive(AMONG_INCONNU, proie(0), 0);
    const deja = avecLEtatPrive(ouverte, proie(), 10);

    const tacheOuverte = ouverte.tacheOuverte;
    expect(tacheOuverte).toBeDefined();
    if (tacheOuverte !== undefined) {
      expect(apresLaFermeture({ ...deja, tacheOuverte }).fermetureEnAttente).toBeUndefined();
    }
  });
});

describe('la feinte d un assassin', () => {
  const assassin = avecLEtatPrive(AMONG_INCONNU, ASSASSIN, 0);

  it('ouvre la fenetre a sa station, avec l une de ses taches, toujours la meme pour lui', () => {
    const feinte = avecUneFeinte(assassin, 1, 's-A', 300);

    expect(feinte.tacheOuverte?.feinte).toBe(true);
    expect(feinte.tacheOuverte?.depuis).toBe(300);
    expect(['sang', 'katana']).toContain(feinte.tacheOuverte?.nature);
    expect(avecUneFeinte(assassin, 1, 's-A', 900).tacheOuverte?.nature).toBe(
      feinte.tacheOuverte?.nature,
    );
  });

  it('n ouvre rien pour une proie, un fantome, une station inconnue, ni par-dessus une autre', () => {
    const proieVue = avecLEtatPrive(AMONG_INCONNU, proie(), 0);
    const fantome = avecLEtatPrive(AMONG_INCONNU, { ...ASSASSIN, fantome: true }, 0);
    const feinte = avecUneFeinte(assassin, 0, 's-A', 0);

    expect(avecUneFeinte(proieVue, 0, 's-A', 0)).toBe(proieVue);
    expect(avecUneFeinte(fantome, 0, 's-A', 0)).toBe(fantome);
    expect(avecUneFeinte(assassin, 5, 's-A', 0)).toBe(assassin);
    expect(avecUneFeinte(feinte, 1, 's-A', 10)).toBe(feinte);
  });

  it('dure malgre l etat prive, et se ferme a la reunion, ou si l assassin devient fantome', () => {
    const feinte = avecUneFeinte(assassin, 0, 's-A', 0);

    expect(avecLEtatPrive(feinte, ASSASSIN, 10).tacheOuverte).toEqual(feinte.tacheOuverte);
    expect(
      apresLaReunion(feinte, { quoi: 'ouverte', numero: 1, motif: 'gong', morts: [] }).tacheOuverte,
    ).toBeUndefined();
    expect(avecLEtatPrive(feinte, { ...ASSASSIN, fantome: true }, 10).tacheOuverte).toBeUndefined();
    expect(apresLaFermeture(feinte)).toEqual({ ...assassin });
  });
});

describe('ce que le client dit de la tache', () => {
  /** Un client branche sur un reseau d'essai, a qui le serveur a dit cet etat prive. */
  function client(prive: EtatPriveAmong) {
    const reseau = creerReseauFactice();
    const leClient = creerClient({ reseau, horloge: creerHorlogeClientManuelle() });
    reseau.simulerConnexion();
    reseau.recevoir('amongNinjas', prive);
    return { reseau, client: leClient };
  }

  it('annonce une vraie tache finie au serveur, et sa fermeture, qui la ferme aussi ici', () => {
    const { reseau, client: leClient } = client(proie(0));

    leClient.finirLaTache();
    expect(reseau.emis.filter((message) => message.nom === 'tache')).toEqual([
      { nom: 'tache', arguments_: ['finie'] },
    ]);
    expect(leClient.etat.among.tacheOuverte).toBeDefined();

    leClient.fermerLaTache();
    expect(reseau.emis.filter((message) => message.nom === 'tache').at(-1)).toEqual({
      nom: 'tache',
      arguments_: ['fermee'],
    });
    expect(leClient.etat.among.tacheOuverte).toBeUndefined();
  });

  it('ne dit rien d une feinte au serveur: la page seule la ferme', () => {
    const { reseau, client: leClient } = client(ASSASSIN);

    leClient.feindreUneTache(0);
    expect(leClient.etat.among.tacheOuverte?.feinte).toBe(true);
    leClient.finirLaTache();

    expect(leClient.etat.among.tacheOuverte).toBeUndefined();
    leClient.feindreUneTache(1);
    leClient.fermerLaTache();
    expect(reseau.emis.some((message) => message.nom === 'tache')).toBe(false);
  });
});

describe('les commandes figees pendant une tache', () => {
  it('n emettent ni deplacement, ni tir, ni poche, ni action, et relachent tout', () => {
    const controles = new Controles();
    controles.enfoncer('ArrowLeft');
    controles.enfoncer('e');
    expect(controles.actionAEmettre()).toBe(true);

    controles.figer(true);
    expect(controles.estFige()).toBe(true);
    expect(controles.intention().enMouvement).toBe(false);
    expect(controles.actionAEmettre()).toBe(false);

    controles.enfoncer('ArrowRight');
    controles.tenirLAction(true);
    controles.demanderUnTir();
    controles.demanderLaPoche();
    controles.deplacerLaManette({ x: 30, y: 0 }, 40);
    expect(controles.intention().enMouvement).toBe(false);
    expect(controles.actionAEmettre()).toBeUndefined();
    expect(controles.prendreLaDemandeDeTir()).toBe(false);
    expect(controles.prendreLaDemandeDePoche()).toBe(false);

    controles.figer(false);
    controles.enfoncer('ArrowRight');
    expect(controles.intention().enMouvement).toBe(true);
  });

  it('se liberent a l entree en partie', () => {
    const controles = new Controles();
    controles.figer(true);
    controles.reinitialiser();

    expect(controles.estFige()).toBe(false);
  });
});

describe('la touche M', () => {
  /** Une cible d'essai qui transmet une touche, avec son element vise. */
  function cible(): EventTarget & { touche(cle: string, sur?: string): void } {
    const ecoutes: EventListener[] = [];

    return {
      addEventListener(type: string, ecoute: EventListenerOrEventListenerObject) {
        if (type === 'keydown' && typeof ecoute === 'function') {
          ecoutes.push(ecoute);
        }
      },
      removeEventListener() {
        return undefined;
      },
      dispatchEvent() {
        return true;
      },
      touche(cle: string, sur?: string) {
        const evenement = {
          key: cle,
          repeat: false,
          target: sur === undefined ? null : { tagName: sur },
          preventDefault: () => undefined,
        } as unknown as Event;
        for (const ecoute of ecoutes) {
          ecoute(evenement);
        }
      },
    };
  }

  it('ouvre et ferme la carte, sauf dans un champ de saisie ou pendant une tache', () => {
    const controles = new Controles();
    const clavier = cible();
    let bascules = 0;
    brancherClavier(controles, {
      cible: clavier,
      fenetre: cible(),
      basculerLaCarte: () => {
        bascules += 1;
      },
    });

    clavier.touche('m');
    clavier.touche('M');
    clavier.touche('m', 'INPUT');
    controles.figer(true);
    clavier.touche('m');

    expect(bascules).toBe(2);
  });
});
