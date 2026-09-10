/**
 * Tests du calcul de l'etat suivant.
 *
 * C'est le deuxieme jeu de tests que la fiche de l'etape 4.1 exige: les
 * notifications discretes se posent par-dessus l'etat reconstruit a partir du
 * flux, sans jamais le remplacer. On y verifie aussi ce que chaque etape du
 * cycle de partie efface, ce qui est la moitie du travail: le client d'origine
 * gardait des effets affiches d'une partie a l'autre.
 */

import type { InfosSalon, InstantanePartie, StatutPartie } from '@neon-ninja/shared';
import { REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { Action } from './actions.js';
import type { EtatClient } from './etat.js';
import { ETAT_INITIAL, MAX_JOURNAL, MAX_MESSAGES } from './etat.js';
import { fait } from './faits.js';
import { reduire } from './reduction.js';

/** Applique une suite d'actions a l'etat de depart. */
function apres(actions: readonly Action[], depart: EtatClient = ETAT_INITIAL): EtatClient {
  return actions.reduce(reduire, depart);
}

/** Un salon minimal. */
function salon(statut: StatutPartie = 'salon'): InfosSalon {
  return {
    idRoom: 'partie-1',
    statut,
    joueurs: [
      { id: 'moi', pseudo: 'Alice', hote: true },
      { id: 'autre', pseudo: 'Bob', hote: false },
    ],
    reglages: REGLAGES_PAR_DEFAUT,
  };
}

/** Un instantane minimal. */
function instantane(modifications: Partial<InstantanePartie> = {}): InstantanePartie {
  return {
    tick: 1,
    tempsRestantMs: 180_000,
    enPause: false,
    entites: [],
    objets: [],
    zones: [],
    classement: [],
    ...modifications,
  };
}

/** La suite d'actions qui amene un client jusqu'au debut d'une partie. */
const JUSQU_AU_JEU: readonly Action[] = [
  { type: 'connexionEtablie', identifiant: 'moi' },
  { type: 'entreeDemandee', pseudo: 'Alice' },
  { type: 'entreeAcceptee', salon: salon() },
  { type: 'partieLancee' },
];

describe('le lien et l entree en partie', () => {
  it('retient l identifiant donne par le serveur a la connexion', () => {
    const etat = apres([{ type: 'connexionEtablie', identifiant: 'session-42' }]);

    expect(etat.connexion).toBe('connecte');
    expect(etat.moi).toBe('session-42');
  });

  it('retient le pseudo demande avant meme la reponse du serveur', () => {
    const etat = apres([{ type: 'entreeDemandee', pseudo: 'Alice' }]);

    expect(etat.pseudoDemande).toBe('Alice');
    expect(etat.salon).toBeUndefined();
  });

  it('garde le salon recu en reponse a l entree', () => {
    const etat = apres([
      { type: 'entreeDemandee', pseudo: 'Alice' },
      { type: 'entreeAcceptee', salon: salon() },
    ]);

    expect(etat.ecran).toBe('salon');
    expect(etat.salon?.idRoom).toBe('partie-1');
  });

  it('garde le motif d un refus d entree, et le pseudo saisi avec lui', () => {
    const etat = apres([
      { type: 'entreeDemandee', pseudo: 'Alice' },
      {
        type: 'entreeRefusee',
        erreurs: [{ champ: 'pseudo', motif: 'Ce pseudo est déjà pris dans cette partie.' }],
      },
    ]);

    expect(etat.refus?.action).toBe('rejoindre');
    expect(etat.refus?.erreurs[0]?.champ).toBe('pseudo');
    // Le joueur doit retrouver ce qu'il avait saisi pour le corriger.
    expect(etat.pseudoDemande).toBe('Alice');
  });

  it('efface le refus precedent des qu on redemande a entrer', () => {
    const etat = apres([
      { type: 'entreeDemandee', pseudo: 'Alice' },
      { type: 'entreeRefusee', erreurs: [{ champ: 'pseudo', motif: 'Deja pris.' }] },
      { type: 'entreeDemandee', pseudo: 'Alice2' },
    ]);

    expect(etat.refus).toBeUndefined();
    expect(etat.pseudoDemande).toBe('Alice2');
  });

  it('oublie tout ce qui touche a la partie quand on quitte, mais garde le lien', () => {
    const etat = apres([
      ...JUSQU_AU_JEU,
      { type: 'etat', instantane: instantane() },
      { type: 'sortie' },
    ]);

    expect(etat.ecran).toBe('accueil');
    expect(etat.connexion).toBe('connecte');
    expect(etat.moi).toBe('moi');
    expect(etat.salon).toBeUndefined();
    expect(etat.partie).toBeUndefined();
  });

  it('oublie jusqu a son identifiant quand le lien tombe', () => {
    const etat = apres([...JUSQU_AU_JEU, { type: 'connexionPerdue' }]);

    expect(etat.ecran).toBe('accueil');
    expect(etat.connexion).toBe('perdue');
    expect(etat.moi).toBeUndefined();
    expect(etat.salon).toBeUndefined();
    // Le pseudo saisi survit: c'est ce qu'on repropose pour se reconnecter.
    expect(etat.pseudoDemande).toBe('Alice');
  });
});

describe('le flux d etat', () => {
  it('remplace la vue de partie a chaque instantane', () => {
    const etat = apres([
      ...JUSQU_AU_JEU,
      { type: 'etat', instantane: instantane({ tick: 1, tempsRestantMs: 180_000 }) },
      { type: 'etat', instantane: instantane({ tick: 2, tempsRestantMs: 179_500 }) },
    ]);

    expect(etat.partie?.tick).toBe(2);
    expect(etat.partie?.tempsRestantMs).toBe(179_500);
  });

  it('ne diffuse rien quand l instantane est perime', () => {
    const avant = apres([...JUSQU_AU_JEU, { type: 'etat', instantane: instantane({ tick: 5 }) }]);
    const apresPerime = reduire(avant, { type: 'etat', instantane: instantane({ tick: 3 }) });

    // L'etat rendu est le meme objet: c'est ce qui permet au magasin de ne
    // reveiller personne.
    expect(apresPerime).toBe(avant);
  });

  it('oublie la vue quand une nouvelle partie est lancee', () => {
    // Le numero de battement repart de zero a la partie suivante. Sans cet
    // oubli, la reconstruction prendrait toute la nouvelle partie pour des
    // messages perimes.
    const etat = apres([
      ...JUSQU_AU_JEU,
      { type: 'etat', instantane: instantane({ tick: 300 }) },
      { type: 'partieTerminee', fin: { classement: [] } },
      { type: 'partieLancee' },
      { type: 'etat', instantane: instantane({ tick: 1, tempsRestantMs: 180_000 }) },
    ]);

    expect(etat.partie?.tick).toBe(1);
    expect(etat.fin).toBeUndefined();
  });
});

describe('les notifications posees par-dessus l etat', () => {
  it('ajoute chaque fait au journal, dans l ordre d arrivee', () => {
    const etat = apres([
      ...JUSQU_AU_JEU,
      { type: 'etat', instantane: instantane() },
      {
        type: 'fait',
        fait: fait(
          'captureSubie',
          { parPseudo: 'Bob', nouvelleCouleur: '#00FF00', botsPerdus: 4 },
          1000,
        ),
      },
      {
        type: 'fait',
        fait: fait(
          'captureReussie',
          { victimePseudo: 'Bob', botsGagnes: 4, capturesTotal: 1 },
          1200,
        ),
      },
    ]);

    expect(etat.journal.map((entree) => entree.nature)).toEqual(['captureSubie', 'captureReussie']);
    expect(etat.journal[0]?.instant).toBe(1000);
  });

  it('laisse l etat reconstruit intact quand un fait arrive', () => {
    const etat = apres([
      ...JUSQU_AU_JEU,
      { type: 'etat', instantane: instantane({ tick: 9, tempsRestantMs: 1234 }) },
      { type: 'fait', fait: fait('botNoirDetruit', { points: 15, x: 1, y: 2 }, 500) },
    ]);

    // La notification s'ajoute, elle ne remplace pas: le flux reste la seule
    // source de l'etat de la partie.
    expect(etat.partie?.tick).toBe(9);
    expect(etat.partie?.tempsRestantMs).toBe(1234);
    expect(etat.journal).toHaveLength(1);
  });

  it('borne le journal aux faits les plus recents', () => {
    const trop = Array.from({ length: MAX_JOURNAL + 10 }, (_, index) => index);
    const etat = apres([
      ...JUSQU_AU_JEU,
      ...trop.map<Action>((index) => ({
        type: 'fait',
        fait: fait('botNoirDetruit', { points: index, x: 0, y: 0 }, index),
      })),
    ]);

    expect(etat.journal).toHaveLength(MAX_JOURNAL);
    expect(etat.journal[0]?.instant).toBe(10);
  });

  it('date les messages de chat a leur arrivee, et borne la conversation', () => {
    const etat = apres([
      ...JUSQU_AU_JEU,
      {
        type: 'chat',
        message: { auteur: 'autre', pseudo: 'Bob', texte: 'salut' },
        instant: 4242,
      },
    ]);

    expect(etat.messages).toHaveLength(1);
    expect(etat.messages[0]?.texte).toBe('salut');
    expect(etat.messages[0]?.recuA).toBe(4242);

    const inonde = apres(
      Array.from<unknown, Action>({ length: MAX_MESSAGES + 5 }, (_, index) => ({
        type: 'chat',
        message: { auteur: 'autre', pseudo: 'Bob', texte: `message ${String(index)}` },
        instant: index,
      })),
      etat,
    );

    expect(inonde.messages).toHaveLength(MAX_MESSAGES);
    // Les plus anciens sont oublies, les plus recents sont gardes.
    expect(inonde.messages.at(-1)?.texte).toBe(`message ${String(MAX_MESSAGES + 4)}`);
  });
});

describe('les effets affiches', () => {
  it('retient un bonus ramasse et la fin prevue de son effet', () => {
    const etat = apres([
      ...JUSQU_AU_JEU,
      { type: 'fait', fait: fait('bonusActive', { nature: 'vitesse', dureeMs: 10_000 }, 1000) },
    ]);

    expect(etat.effets).toEqual([{ categorie: 'bonus', nature: 'vitesse', finPrevueA: 11_000 }]);
  });

  it('cumule les durees d un meme bonus au lieu de les remplacer', () => {
    // Comportement a preserver numero 10 de CLAUDE.md: deux bonus de vitesse
    // ramasses coup sur coup donnent vingt secondes.
    const etat = apres([
      ...JUSQU_AU_JEU,
      { type: 'fait', fait: fait('bonusActive', { nature: 'vitesse', dureeMs: 10_000 }, 1000) },
      { type: 'fait', fait: fait('bonusActive', { nature: 'vitesse', dureeMs: 10_000 }, 3000) },
    ]);

    expect(etat.effets).toHaveLength(1);
    expect(etat.effets[0]?.finPrevueA).toBe(21_000);
  });

  it('ne cumule pas avec un effet deja expire', () => {
    const etat = apres([
      ...JUSQU_AU_JEU,
      { type: 'fait', fait: fait('bonusActive', { nature: 'vitesse', dureeMs: 10_000 }, 1000) },
      { type: 'fait', fait: fait('bonusActive', { nature: 'vitesse', dureeMs: 10_000 }, 50_000) },
    ]);

    expect(etat.effets).toHaveLength(1);
    expect(etat.effets[0]?.finPrevueA).toBe(60_000);
  });

  it('distingue un bonus et un malus de meme duree', () => {
    const etat = apres([
      ...JUSQU_AU_JEU,
      { type: 'fait', fait: fait('bonusActive', { nature: 'vitesse', dureeMs: 5000 }, 1000) },
      {
        type: 'fait',
        fait: fait(
          'malusSubi',
          { nature: 'controlesInverses', dureeMs: 5000, parPseudo: 'Bob' },
          1000,
        ),
      },
    ]);

    expect(etat.effets).toHaveLength(2);
    expect(etat.effets.map((effet) => effet.categorie)).toEqual(['bonus', 'malus']);
  });

  it('retient aussi le malus que l on ramasse soi-meme', () => {
    const etat = apres([
      ...JUSQU_AU_JEU,
      { type: 'fait', fait: fait('malusRamasse', { nature: 'flou', dureeMs: 4000 }, 1000) },
    ]);

    expect(etat.effets).toEqual([{ categorie: 'malus', nature: 'flou', finPrevueA: 5000 }]);
  });

  it('n ajoute aucun effet pour un fait qui n en porte pas', () => {
    const etat = apres([
      ...JUSQU_AU_JEU,
      { type: 'fait', fait: fait('joueurArrive', { id: 'x', pseudo: 'Chloe', hote: false }, 1000) },
    ]);

    expect(etat.effets).toHaveLength(0);
    expect(etat.journal).toHaveLength(1);
  });

  it('efface les effets a la fin de la partie', () => {
    // Le legacy diffusait un message clearMalusEffects pour cela. Le contrat ne
    // le porte pas: la fin de partie suffit a le dire.
    const etat = apres([
      ...JUSQU_AU_JEU,
      { type: 'fait', fait: fait('bonusActive', { nature: 'vitesse', dureeMs: 10_000 }, 1000) },
      { type: 'partieTerminee', fin: { classement: [] } },
    ]);

    expect(etat.effets).toHaveLength(0);
    expect(etat.ecran).toBe('fin');
  });
});

describe('le cycle de la partie', () => {
  it('suit le compte a rebours et l oublie quand il est annule', () => {
    const enCours = apres([
      { type: 'entreeAcceptee', salon: salon() },
      { type: 'compteARebours', compte: { secondesRestantes: 3, annulable: true } },
    ]);

    expect(enCours.compteARebours?.secondesRestantes).toBe(3);

    const annule = reduire(enCours, { type: 'demarrageAnnule' });

    expect(annule.compteARebours).toBeUndefined();
    expect(annule.ecran).toBe('salon');
  });

  it('oublie le compte a rebours quand la partie part', () => {
    const etat = apres([
      { type: 'entreeAcceptee', salon: salon() },
      { type: 'compteARebours', compte: { secondesRestantes: 0, annulable: false } },
      { type: 'partieLancee' },
    ]);

    expect(etat.compteARebours).toBeUndefined();
    expect(etat.ecran).toBe('jeu');
  });

  it('retient qui a suspendu la partie, et l oublie a la reprise', () => {
    const suspendue = apres([
      ...JUSQU_AU_JEU,
      { type: 'partieEnPause', pause: { parPseudo: 'Alice' } },
    ]);

    expect(suspendue.pausePar).toBe('Alice');
    // L'ecran ne change pas: on reste dans le jeu, avec un bandeau par-dessus.
    expect(suspendue.ecran).toBe('jeu');

    const reprise = reduire(suspendue, { type: 'partieReprise' });

    expect(reprise.pausePar).toBeUndefined();
  });

  it('garde le classement definitif a la fin', () => {
    const etat = apres([
      ...JUSQU_AU_JEU,
      {
        type: 'partieTerminee',
        fin: {
          classement: [
            {
              id: 'moi',
              pseudo: 'Alice',
              couleur: '#FF0000',
              points: 30,
              botsPortes: 27,
              pointsBotsNoirs: 3,
              captures: 2,
              botsNoirsDetruits: 1,
            },
          ],
        },
      },
    ]);

    expect(etat.ecran).toBe('fin');
    expect(etat.fin?.classement[0]?.points).toBe(30);
  });

  it('remplace le salon a chaque changement', () => {
    const etat = apres([
      { type: 'entreeAcceptee', salon: salon() },
      {
        type: 'salon',
        salon: { ...salon(), joueurs: [{ id: 'moi', pseudo: 'Alice', hote: true }] },
      },
    ]);

    expect(etat.salon?.joueurs).toHaveLength(1);
  });

  it('sait qu une entree attend sa reponse, jusqu a ce qu elle arrive', () => {
    const demande = { type: 'entreeDemandee', pseudo: 'Alice' } as const;

    expect(apres([demande]).entreeEnCours).toBe(true);
    expect(apres([demande, { type: 'entreeAcceptee', salon: salon() }]).entreeEnCours).toBe(false);
    expect(apres([demande, { type: 'entreeRefusee', erreurs: [] }]).entreeEnCours).toBe(false);
    expect(apres([demande, { type: 'connexionPerdue' }]).entreeEnCours).toBe(false);
  });

  it('garde le dernier refus recu du serveur', () => {
    const etat = apres([
      ...JUSQU_AU_JEU,
      {
        type: 'refus',
        refus: { action: 'reglages', erreurs: [{ champ: 'hote', motif: 'Reserve a l hote.' }] },
      },
    ]);

    expect(etat.refus?.action).toBe('reglages');
  });
});

describe('l immuabilite de l etat', () => {
  it('ne modifie jamais l etat recu', () => {
    const depart = apres(JUSQU_AU_JEU);
    const copie = structuredClone(depart);

    reduire(depart, { type: 'etat', instantane: instantane({ tick: 12 }) });
    reduire(depart, { type: 'fait', fait: fait('botNoirDetruit', { points: 15, x: 0, y: 0 }, 1) });
    reduire(depart, { type: 'sortie' });

    expect(depart).toEqual(copie);
  });
});
