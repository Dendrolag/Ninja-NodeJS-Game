/**
 * Tests de ce que la page retient des reparations d'Among Ninjas (etape 7.27): la fenetre ouverte
 * par le serveur, sa fermeture par nous ou par lui, ce que le client envoie; et ce que la fenetre
 * montre selon le sabotage en cours (modeles/reparation.ts).
 */

import type { EtatPriveAmong, PosteDeReparation, SabotageEnCoursVu } from '@neon-ninja/shared';
import { REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { AMONG_INCONNU, apresLaFermetureDeLaReparation, avecLEtatPrive } from './among.js';
import { creerClient } from './client.js';
import type { EtatClient } from './etat.js';
import { ETAT_INITIAL } from './etat.js';
import { creerHorlogeClientManuelle } from './horloge.js';
import { vueDeLaReparation } from './interface/modeles/reparation.js';
import { creerReseauFactice } from './reseau.js';

/** Une proie, sa reparation ouverte a ce poste si on le demande. */
function proie(reparationEnCours?: PosteDeReparation): EtatPriveAmong {
  return {
    role: 'proie',
    complices: [],
    fantome: false,
    gong: { x: 1145, y: 630 },
    stations: [],
    taches: [],
    ...(reparationEnCours === undefined ? {} : { reparationEnCours }),
    gongUtilise: false,
  };
}

describe('la fenetre d une reparation, dans l etat de la page', () => {
  it('s ouvre quand le serveur dit la reparation ouverte, de cet instant, et pas deux fois', () => {
    const ouverte = avecLEtatPrive(avecLEtatPrive(AMONG_INCONNU, proie(), 0), proie(1), 500);

    expect(ouverte.reparationOuverte).toEqual({ poste: 1, depuis: 500 });
    expect(avecLEtatPrive(ouverte, proie(1), 900).reparationOuverte?.depuis).toBe(500);
    // Un autre poste est une autre reparation.
    expect(avecLEtatPrive(ouverte, proie(0), 900).reparationOuverte).toEqual({
      poste: 0,
      depuis: 900,
    });
  });

  it('se ferme quand le serveur ne la dit plus ouverte', () => {
    const ouverte = avecLEtatPrive(AMONG_INCONNU, proie('boitier'), 0);

    expect(avecLEtatPrive(ouverte, proie(), 10).reparationOuverte).toBeUndefined();
  });

  it('fermee par nous, attend que le serveur la dise fermee, sans se rouvrir d ici la', () => {
    const fermee = apresLaFermetureDeLaReparation(
      avecLEtatPrive(AMONG_INCONNU, proie('boitier'), 0),
    );

    expect(fermee.reparationOuverte).toBeUndefined();
    expect(fermee.reparationFermeeEnAttente).toBe(true);
    const encore = avecLEtatPrive(fermee, proie('boitier'), 100);
    expect(encore.reparationOuverte).toBeUndefined();
    expect(encore.reparationFermeeEnAttente).toBe(true);

    const close = avecLEtatPrive(encore, proie(), 200);
    expect(close.reparationFermeeEnAttente).toBeUndefined();
    expect(avecLEtatPrive(close, proie('boitier'), 300).reparationOuverte?.depuis).toBe(300);
  });

  it('garde la tache et la reparation chacune de leur cote', () => {
    const ouverte = avecLEtatPrive(AMONG_INCONNU, proie('boitier'), 0);

    expect(ouverte.tacheOuverte).toBeUndefined();
    expect(apresLaFermetureDeLaReparation(AMONG_INCONNU)).toEqual(AMONG_INCONNU);
  });

  it('dit au serveur la reparation finie ou fermee, seulement si elle est ouverte', () => {
    const reseau = creerReseauFactice();
    const client = creerClient({ reseau, horloge: creerHorlogeClientManuelle() });
    const reparations = () =>
      reseau.emis.filter(({ nom }) => nom === 'reparation').map(({ arguments_ }) => arguments_);
    reseau.simulerConnexion();

    client.finirLaReparation();
    client.fermerLaReparation();
    expect(reparations()).toEqual([]);

    reseau.recevoir('amongNinjas', proie(0));
    client.finirLaReparation();
    expect(client.etat.among.reparationOuverte).toBeDefined();
    client.fermerLaReparation();
    expect(reparations()).toEqual([['finie'], ['fermee']]);
    expect(client.etat.among.reparationOuverte).toBeUndefined();
  });
});

/** Un sabotage en cours, tel que le flux le dit. */
function sabotage(champs: Partial<SabotageEnCoursVu>): SabotageEnCoursVu {
  return {
    nature: 'surchauffe',
    restantMs: 30_000,
    consolesTenues: [false, false],
    reparation: 'cles',
    consolesPurgees: [false, false],
    interrupteursCoupes: 0,
    ...champs,
  };
}

/** L'etat d'une partie ou cette reparation est ouverte, pendant ce sabotage. */
function etat(poste: PosteDeReparation, enCours: SabotageEnCoursVu | undefined): EtatClient {
  return {
    ...ETAT_INITIAL,
    salon: {
      idRoom: 'r',
      statut: 'enCours',
      mode: 'among',
      visibilite: 'publique',
      capacite: 12,
      joueurs: [],
      reglages: REGLAGES_PAR_DEFAUT,
    },
    partie: {
      tick: 1,
      tempsRestantMs: 0,
      enPause: false,
      entites: [],
      objets: [],
      zones: [],
      classement: [],
      among: {
        phase: 'jeu',
        restantMs: 0,
        tachesFaites: 0,
        tachesTotal: 10,
        ...(enCours === undefined ? {} : { sabotage: enCours }),
      },
    },
    among: { ...AMONG_INCONNU, prive: proie(poste), reparationOuverte: { poste, depuis: 0 } },
  };
}

describe('ce que montre la fenetre d une reparation', () => {
  it('ne montre rien sans sabotage, ni au mauvais poste, ni sans reparation dite', () => {
    expect(vueDeLaReparation(etat(0, undefined))).toBeUndefined();
    expect(vueDeLaReparation(etat('boitier', sabotage({})))).toBeUndefined();
    expect(vueDeLaReparation(etat(0, sabotage({ nature: 'panne', reparation: 'lanceur' })))).toBe(
      undefined,
    );
    const { reparation: _aucune, ...sansReparation } = sabotage({});
    expect(vueDeLaReparation(etat(0, sansReparation))).toBeUndefined();
    expect(vueDeLaReparation({ ...etat(0, sabotage({})), among: AMONG_INCONNU })).toBeUndefined();
  });

  it('montre le geste de la panne au boitier', () => {
    expect(
      vueDeLaReparation(etat('boitier', sabotage({ nature: 'panne', reparation: 'lanceur' }))),
    ).toMatchObject({
      etape: { genre: 'geste', geste: 'lanceur' },
      titre: 'Relancer le générateur',
      lieu: 'Générateur de la rue',
    });
  });

  it('montre la purge, puis la cle, et ce que dit l autre console', () => {
    expect(vueDeLaReparation(etat(0, sabotage({ consolesPurgees: [false, true] })))).toMatchObject({
      etape: { genre: 'geste', geste: 'purge' },
      lieu: 'Console 1',
      statut: 'Autre console : purgée',
    });
    expect(
      vueDeLaReparation(
        etat(1, sabotage({ consolesPurgees: [true, true], consolesTenues: [false, true] })),
      ),
    ).toMatchObject({
      etape: { genre: 'cle' },
      lieu: 'Console 2',
      cleTournee: true,
      autreCleTournee: false,
      statut: 'Autre console : purgée',
    });
  });

  it('donne le premier interrupteur aux deux consoles, puis a celle dont c est le tour', () => {
    const relais = sabotage({ reparation: 'relais' });

    for (const poste of [0, 1] as const) {
      expect(vueDeLaReparation(etat(poste, relais))?.etape).toEqual({
        genre: 'geste',
        geste: 'interrupteur',
        cle: 'interrupteur:0',
      });
    }
    expect(
      vueDeLaReparation(etat(0, { ...relais, interrupteursCoupes: 1, prochaineConsole: 1 }))?.etape,
    ).toEqual({ genre: 'attente' });
  });
});
