/**
 * Tests des controles.
 *
 * LE TEST EXIGE PAR LA FICHE EST LE PREMIER: une touche de deplacement fait bien
 * emettre l'evenement deplacer attendu. Il est joue de bout en bout, sur un vrai
 * client relie a un transport d'essai, pour verifier que la chaine complete
 * fonctionne et pas seulement le calcul de direction.
 *
 * RECONCILIATION AVEC LA FICHE. Elle demandait aussi un test verifiant que la
 * capture emet startCapture et endCapture. Ces deux evenements n'existent pas: ils
 * appartiennent a la capture par cone du mode tactique de la version 0.9.0,
 * ecartee du perimetre v1 (section 5 du ROADMAP), et le contrat d'evenements les
 * recense explicitement comme non portes. Dans le mode Classique, on capture en
 * touchant, et le moteur resout le contact: il n'y a aucune commande de capture a
 * emettre. Le test correspondant serait donc impossible a ecrire, et son absence
 * est une consequence du perimetre, pas un manque.
 */

import type { IntentionDeplacement } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { creerClient } from '../client.js';
import { creerHorlogeClientManuelle } from '../horloge.js';
import { creerReseauFactice } from '../reseau.js';
import { brancherClavier } from './clavier.js';
import { Controles } from './controles.js';
import { intentionDepuisDirections, intentionDepuisManette, memeIntention } from './intention.js';
import { directionsDepuisTouches } from './touches.js';

/**
 * Un objet qui recoit des ecoutes et sait declencher un evenement, sans DOM.
 *
 * Les tests unitaires tournent hors navigateur: fournir cette cible plutot que
 * le document est ce qui permet de verifier le branchement du clavier sans en
 * monter un.
 */
function cibleDEssai(): EventTarget & { declencher(type: string, touche: string): void } {
  const ecoutes = new Map<string, Set<EventListenerOrEventListenerObject>>();

  return {
    addEventListener(type: string, ecoute: EventListenerOrEventListenerObject) {
      const pour = ecoutes.get(type) ?? new Set();
      pour.add(ecoute);
      ecoutes.set(type, pour);
    },
    removeEventListener(type: string, ecoute: EventListenerOrEventListenerObject) {
      ecoutes.get(type)?.delete(ecoute);
    },
    dispatchEvent() {
      return true;
    },
    declencher(type: string, touche: string) {
      const evenement = { key: touche, preventDefault: () => undefined } as unknown as Event;

      for (const ecoute of ecoutes.get(type) ?? []) {
        if (typeof ecoute === 'function') {
          ecoute(evenement);
        } else {
          ecoute.handleEvent(evenement);
        }
      }
    },
  };
}

describe('une touche de deplacement emet l evenement deplacer', () => {
  it('envoie une intention vers le haut quand on enfonce Z', () => {
    const reseau = creerReseauFactice();
    const client = creerClient({ reseau, horloge: creerHorlogeClientManuelle() });
    const controles = new Controles();
    const cible = cibleDEssai();
    brancherClavier(controles, { cible, fenetre: cibleDEssai() });

    cible.declencher('keydown', 'z');
    const aEmettre = controles.aEmettre();
    if (aEmettre !== undefined) {
      client.deplacer(aEmettre);
    }

    const emis = reseau.emis.filter((message) => message.nom === 'deplacer');

    expect(emis).toHaveLength(1);
    const intention = emis[0]?.arguments_[0] as IntentionDeplacement;
    expect(intention.enMouvement).toBe(true);
    expect(intention.deplacement).toEqual({ x: 0, y: -1 });

    client.fermer();
  });

  it('envoie un arret quand on relache la touche', () => {
    const reseau = creerReseauFactice();
    const client = creerClient({ reseau, horloge: creerHorlogeClientManuelle() });
    const controles = new Controles();
    const cible = cibleDEssai();
    brancherClavier(controles, { cible, fenetre: cibleDEssai() });

    cible.declencher('keydown', 'd');
    client.deplacer(controles.aEmettre() as IntentionDeplacement);
    cible.declencher('keyup', 'd');
    client.deplacer(controles.aEmettre() as IntentionDeplacement);

    const emis = reseau.emis.filter((message) => message.nom === 'deplacer');

    expect(emis).toHaveLength(2);
    expect((emis[1]?.arguments_[0] as IntentionDeplacement).enMouvement).toBe(false);

    client.fermer();
  });

  it('n emet rien tant que la touche reste enfoncee', () => {
    // Le point de fond: le jeu d'origine emettait cinquante messages par seconde
    // pour dire la meme chose. Le serveur conserve la derniere intention, un seul
    // message suffit.
    const controles = new Controles();
    const cible = cibleDEssai();
    brancherClavier(controles, { cible, fenetre: cibleDEssai() });

    cible.declencher('keydown', 'z');

    expect(controles.aEmettre()).toBeDefined();
    expect(controles.aEmettre()).toBeUndefined();
    expect(controles.aEmettre()).toBeUndefined();
  });

  it('retire ses ecoutes quand on le lui demande', () => {
    const controles = new Controles();
    const cible = cibleDEssai();
    const debrancher = brancherClavier(controles, { cible, fenetre: cibleDEssai() });

    debrancher();
    cible.declencher('keydown', 'z');

    expect(controles.intention().enMouvement).toBe(false);
  });

  it('relache tout quand la fenetre perd le focus', () => {
    const controles = new Controles();
    const cible = cibleDEssai();
    const fenetre = cibleDEssai();
    brancherClavier(controles, { cible, fenetre });

    cible.declencher('keydown', 'z');
    fenetre.declencher('blur', '');

    expect(controles.intention().enMouvement).toBe(false);
  });
});

describe('Controles', () => {
  it('accepte les fleches autant que ZQSD', () => {
    const clavier = new Controles();
    clavier.enfoncer('ArrowLeft');

    expect(clavier.intention().deplacement).toEqual({ x: -1, y: 0 });
  });

  it('ne distingue pas la casse d une touche', () => {
    const clavier = new Controles();
    clavier.enfoncer('Z');

    expect(clavier.intention().enMouvement).toBe(true);
  });

  it('donne la priorite a la manette quand un pouce y est pose', () => {
    const controles = new Controles();
    controles.enfoncer('z');
    controles.deplacerLaManette({ x: 60, y: 0 }, 60);

    expect(controles.intention().deplacement).toEqual({ x: 1, y: 0 });
  });

  it('revient au clavier quand le pouce se leve', () => {
    const controles = new Controles();
    controles.enfoncer('z');
    controles.deplacerLaManette({ x: 60, y: 0 }, 60);
    controles.relacherLaManette();

    expect(controles.intention().deplacement).toEqual({ x: 0, y: -1 });
  });

  it('remet a zero pour que la premiere intention d une partie parte toujours', () => {
    const controles = new Controles();
    controles.enfoncer('z');
    controles.aEmettre();

    controles.reinitialiser();
    controles.enfoncer('z');

    expect(controles.aEmettre()).toBeDefined();
  });
});

describe('intentionDepuisDirections', () => {
  it('annule deux touches opposees', () => {
    // Le client d'origine laissait la derniere condition l'emporter: haut et bas
    // ensemble faisaient descendre.
    const intention = intentionDepuisDirections({
      haut: true,
      bas: true,
      gauche: false,
      droite: false,
    });

    expect(intention.enMouvement).toBe(false);
    expect(intention.deplacement).toEqual({ x: 0, y: 0 });
  });

  it('normalise la diagonale, pour qu elle n aille pas plus vite', () => {
    const intention = intentionDepuisDirections({
      haut: true,
      bas: false,
      gauche: false,
      droite: true,
    });

    expect(Math.hypot(intention.deplacement.x, intention.deplacement.y)).toBeCloseTo(1);
  });

  it('rend une intention immobile quand rien n est demande', () => {
    const intention = intentionDepuisDirections({
      haut: false,
      bas: false,
      gauche: false,
      droite: false,
    });

    expect(intention.enMouvement).toBe(false);
  });
});

describe('intentionDepuisManette', () => {
  it('ignore un pouce pose sans intention, dans la zone morte', () => {
    expect(intentionDepuisManette({ x: 5, y: 0 }, 60).enMouvement).toBe(false);
  });

  it('rend une direction unitaire des que le pouce sort de la zone morte', () => {
    const intention = intentionDepuisManette({ x: 30, y: 40 }, 60);

    expect(intention.enMouvement).toBe(true);
    expect(Math.hypot(intention.deplacement.x, intention.deplacement.y)).toBeCloseTo(1);
  });

  it('ne va pas plus vite quand le doigt sort du cercle', () => {
    const dansLeCercle = intentionDepuisManette({ x: 60, y: 0 }, 60);
    const bienDehors = intentionDepuisManette({ x: 600, y: 0 }, 60);

    expect(bienDehors.deplacement).toEqual(dansLeCercle.deplacement);
  });
});

describe('directionsDepuisTouches', () => {
  it('reconnait W et A, pour un joueur au clavier qwerty', () => {
    // Sur un clavier qwerty, la touche physique du Z azerty porte un W: sans ces
    // deux alias, un joueur ne peut pas avancer.
    expect(directionsDepuisTouches(new Set(['w'])).haut).toBe(true);
    expect(directionsDepuisTouches(new Set(['a'])).gauche).toBe(true);
  });

  it('ignore une touche qui n appartient pas au jeu', () => {
    expect(directionsDepuisTouches(new Set(['espace']))).toEqual({
      haut: false,
      bas: false,
      gauche: false,
      droite: false,
    });
  });
});

describe('memeIntention', () => {
  it('reconnait deux intentions identiques', () => {
    const aller = { deplacement: { x: 1, y: 0 }, enMouvement: true };

    expect(memeIntention(aller, { ...aller })).toBe(true);
  });

  it('distingue l arret du mouvement', () => {
    expect(
      memeIntention(
        { deplacement: { x: 0, y: 0 }, enMouvement: true },
        { deplacement: { x: 0, y: 0 }, enMouvement: false },
      ),
    ).toBe(false);
  });
});
