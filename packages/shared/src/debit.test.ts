/**
 * Tests de la limitation de debit.
 *
 * Le seau a jetons se teste sans attendre: le temps lui est fourni, comme au
 * moteur. Une minute de silence, c'est un appel avec soixante mille.
 *
 * Ce que ces tests doivent etablir tient en trois points. Un debit soutenu
 * au-dessus de la limite finit toujours par etre refuse. Une rafale courte apres
 * un silence passe, parce que c'est ce que fait un reseau normal. Et un refus ne
 * coute rien au joueur: il ne consomme pas de jeton, donc il ne le punit pas deux
 * fois.
 */

import { describe, expect, it } from 'vitest';

import type { LimiteDebit } from './bornes.js';
import { LIMITES_DEBIT } from './bornes.js';
import { consommer, seauNeuf } from './debit.js';

/** Une limite ronde, pour que les calculs des tests se lisent de tete. */
const DIX_PAR_SECONDE: LimiteDebit = { parSeconde: 10, rafale: 5 };

/**
 * Envoie une salve de messages a intervalle regulier et compte les acceptes.
 *
 * @param limite Cadence autorisee.
 * @param nombre Messages envoyes.
 * @param intervalleMs Temps ecoule entre deux messages.
 */
function salve(limite: LimiteDebit, nombre: number, intervalleMs: number): number {
  let seau = seauNeuf(limite);
  let acceptes = 0;

  for (let numero = 0; numero < nombre; numero += 1) {
    const resultat = consommer(seau, limite, intervalleMs);
    seau = resultat.seau;
    if (resultat.accepte) {
      acceptes += 1;
    }
  }

  return acceptes;
}

describe('seauNeuf', () => {
  it('donne un seau plein, donc toute la rafale des la connexion', () => {
    expect(seauNeuf(DIX_PAR_SECONDE).jetons).toBe(DIX_PAR_SECONDE.rafale);
  });
});

describe('consommer', () => {
  it('accepte un message a la cadence autorisee, indefiniment', () => {
    // Dix par seconde, un message toutes les cent millisecondes: tout passe.
    expect(salve(DIX_PAR_SECONDE, 200, 100)).toBe(200);
  });

  it('refuse ce qui depasse la cadence autorisee', () => {
    // Cent messages d'affilee sans laisser passer de temps: seule la rafale
    // trouve des jetons.
    expect(salve(DIX_PAR_SECONDE, 100, 0)).toBe(DIX_PAR_SECONDE.rafale);
  });

  it('laisse passer une rafale apres un silence, puis revient a la cadence', () => {
    let seau = seauNeuf(DIX_PAR_SECONDE);

    // La rafale d'un seau plein passe entierement.
    for (let numero = 0; numero < DIX_PAR_SECONDE.rafale; numero += 1) {
      const resultat = consommer(seau, DIX_PAR_SECONDE, 0);
      expect(resultat.accepte).toBe(true);
      seau = resultat.seau;
    }

    // Le suivant, immediat, ne trouve plus rien.
    expect(consommer(seau, DIX_PAR_SECONDE, 0).accepte).toBe(false);

    // Une seconde de silence remplit dix jetons, plafonnes a la rafale.
    seau = consommer(seau, DIX_PAR_SECONDE, 1000).seau;
    expect(seau.jetons).toBe(DIX_PAR_SECONDE.rafale - 1);
  });

  it('ne laisse pas le seau deborder au-dela de sa rafale', () => {
    // Une minute de silence n autorise pas une minute de salve: sans plafond, un
    // client patient pourrait accumuler de quoi inonder le serveur d un coup.
    const apresUneMinute = consommer(seauNeuf(DIX_PAR_SECONDE), DIX_PAR_SECONDE, 60_000);

    expect(apresUneMinute.seau.jetons).toBe(DIX_PAR_SECONDE.rafale - 1);
  });

  it('ne consomme rien quand il refuse', () => {
    const vide = { jetons: 0 };
    const refuse = consommer(vide, DIX_PAR_SECONDE, 0);

    expect(refuse.accepte).toBe(false);
    expect(refuse.seau.jetons).toBe(0);
  });

  it('remplit proportionnellement au temps ecoule', () => {
    // Un demi-jeton apres cinquante millisecondes a dix par seconde: pas encore
    // assez pour un message.
    const seau = { jetons: 0 };

    expect(consommer(seau, DIX_PAR_SECONDE, 50).accepte).toBe(false);
    expect(consommer(seau, DIX_PAR_SECONDE, 50).seau.jetons).toBeCloseTo(0.5, 10);
    expect(consommer(seau, DIX_PAR_SECONDE, 100).accepte).toBe(true);
  });

  it('refuse un temps ecoule absurde plutot que de le subir', () => {
    const seau = seauNeuf(DIX_PAR_SECONDE);

    expect(() => consommer(seau, DIX_PAR_SECONDE, -1)).toThrow();
    expect(() => consommer(seau, DIX_PAR_SECONDE, Number.NaN)).toThrow();
    expect(() => consommer(seau, DIX_PAR_SECONDE, Number.POSITIVE_INFINITY)).toThrow();
  });
});

describe('LIMITES_DEBIT', () => {
  it('laisse passer la cadence reelle du client du legacy', () => {
    // Le client de bureau envoyait un deplacement toutes les vingt millisecondes,
    // soit cinquante par seconde. Un joueur honnete ne doit jamais etre refuse.
    expect(salve(LIMITES_DEBIT.deplacement, 500, 20)).toBe(500);
  });

  it('refuse l inondation qui saturait le serveur du legacy', () => {
    // La faille S4: mille messages par seconde, chacun declenchant un releve
    // complet des collisions. Ici, un sur seize passe.
    const acceptes = salve(LIMITES_DEBIT.deplacement, 1000, 1);

    expect(acceptes).toBeLessThan(100);
  });

  it('donne a chaque type d entree une rafale au moins egale a un message', () => {
    for (const limite of Object.values(LIMITES_DEBIT)) {
      expect(limite.rafale).toBeGreaterThanOrEqual(1);
      expect(limite.parSeconde).toBeGreaterThan(0);
    }
  });
});
