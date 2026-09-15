/**
 * Tests du compte a rebours de demarrage.
 *
 * Ce qu'ils protegent: le comportement a preserver numero 7 de CLAUDE.md, cinq
 * secondes annulables jusqu'a deux. La sequence exacte est celle du legacy, et
 * elle est verifiee annonce par annonce: c'est le genre de detail qu'une
 * reecriture decale d'un cran sans que personne ne le remarque avant de jouer.
 *
 * L'horloge etant manuelle, ces cinq secondes passent instantanement.
 */

import { describe, expect, it, vi } from 'vitest';

import { CompteARebours, SEUIL_ANNULATION_S } from './compteARebours.js';
import { creerHorlogeManuelle } from './horloge.js';

/** Monte un decompte et enregistre tout ce qu'il annonce. */
function monter(dureeS?: number) {
  const horloge = creerHorlogeManuelle();
  const annonces: { secondesRestantes: number; annulable: boolean }[] = [];
  const surDepart = vi.fn();

  const decompte = new CompteARebours({
    horloge,
    ...(dureeS === undefined ? {} : { dureeS }),
    surAnnonce: (secondesRestantes, annulable) => {
      annonces.push({ secondesRestantes, annulable });
    },
    surDepart,
  });

  return { horloge, annonces, surDepart, decompte };
}

describe('CompteARebours', () => {
  it('annonce la premiere seconde des le demarrage, sans attendre', () => {
    const { annonces, decompte } = monter();

    decompte.demarrer();

    expect(annonces).toEqual([{ secondesRestantes: 5, annulable: true }]);
  });

  it('reproduit la sequence exacte du legacy, de cinq a zero', () => {
    const { horloge, annonces, surDepart, decompte } = monter();

    decompte.demarrer();
    horloge.avancerDe(5000);

    expect(annonces).toEqual([
      { secondesRestantes: 5, annulable: true },
      { secondesRestantes: 4, annulable: true },
      { secondesRestantes: 3, annulable: true },
      { secondesRestantes: 2, annulable: false },
      { secondesRestantes: 1, annulable: false },
      { secondesRestantes: 0, annulable: false },
    ]);
    expect(surDepart).toHaveBeenCalledTimes(1);
  });

  it('cesse de battre une fois la partie partie', () => {
    const { horloge, annonces, surDepart, decompte } = monter();

    decompte.demarrer();
    horloge.avancerDe(60_000);

    expect(annonces).toHaveLength(6);
    expect(surDepart).toHaveBeenCalledTimes(1);
    expect(decompte.enCours).toBe(false);
  });

  it('accepte une annulation tant qu il reste plus de deux secondes', () => {
    const { horloge, surDepart, decompte } = monter();

    decompte.demarrer();
    horloge.avancerDe(2000);

    expect(decompte.secondesRestantes).toBe(3);
    expect(decompte.annuler()).toBe(true);

    horloge.avancerDe(60_000);

    expect(surDepart).not.toHaveBeenCalled();
    expect(decompte.enCours).toBe(false);
  });

  it('refuse l annulation des que le seuil est atteint', () => {
    const { horloge, surDepart, decompte } = monter();

    decompte.demarrer();
    horloge.avancerDe(3000);

    expect(decompte.secondesRestantes).toBe(SEUIL_ANNULATION_S);
    expect(decompte.annulable).toBe(false);
    expect(decompte.annuler()).toBe(false);

    horloge.avancerDe(2000);

    expect(surDepart).toHaveBeenCalledTimes(1);
  });

  it('ignore un second demarrage: appuyer deux fois ne va pas deux fois plus vite', () => {
    const { horloge, annonces, surDepart, decompte } = monter();

    decompte.demarrer();
    decompte.demarrer();
    horloge.avancerDe(5000);

    expect(annonces).toHaveLength(6);
    expect(surDepart).toHaveBeenCalledTimes(1);
  });

  it('s arrete sans rien annoncer quand on l arrete de force', () => {
    const { horloge, annonces, surDepart, decompte } = monter();

    decompte.demarrer();
    decompte.arreter();
    horloge.avancerDe(60_000);

    expect(annonces).toHaveLength(1);
    expect(surDepart).not.toHaveBeenCalled();
  });

  it('supporte d etre arrete deux fois', () => {
    const { decompte } = monter();

    decompte.demarrer();
    decompte.arreter();

    expect(() => {
      decompte.arreter();
    }).not.toThrow();
  });

  it('ne dit rien quand il ne tourne pas', () => {
    const { decompte } = monter();

    expect(decompte.enCours).toBe(false);
    expect(decompte.secondesRestantes).toBe(0);
    expect(decompte.annulable).toBe(false);
    expect(decompte.annuler()).toBe(false);
  });

  it('accepte une duree differente de celle du jeu', () => {
    const { horloge, annonces, surDepart, decompte } = monter(2);

    decompte.demarrer();
    horloge.avancerDe(2000);

    expect(annonces).toEqual([
      { secondesRestantes: 2, annulable: false },
      { secondesRestantes: 1, annulable: false },
      { secondesRestantes: 0, annulable: false },
    ]);
    expect(surDepart).toHaveBeenCalledTimes(1);
  });
});
