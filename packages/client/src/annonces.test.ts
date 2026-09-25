/**
 * Tests des annonces.
 *
 * Deux choses a verifier: que chaque fait trouve sa phrase, avec les textes du
 * jeu d'origine, et qu'une meme phrase n'est dite qu'une fois quand on compare
 * deux etats successifs. Le tir du mode Tactique est le seul fait sans phrase.
 */

import type { InfosSalon } from '@neon-ninja/shared';
import { REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { annonceDuFait, annonceDuRefus, annoncesDuChangement } from './annonces.js';
import type { EtatClient } from './etat.js';
import { ETAT_INITIAL } from './etat.js';
import { fait } from './faits.js';
import { APPARENCE_OBJET, adresseDeLIcone } from './rendu/apparence.js';

/** Un salon ou l'hote est celui qu'on designe. */
function salon(hote: string): InfosSalon {
  return {
    idRoom: 'room-1',
    statut: 'salon',
    mode: 'classique',
    visibilite: 'publique',
    capacite: 12,
    joueurs: [
      { id: 'moi', pseudo: 'Alice', hote: hote === 'moi' },
      { id: 'bob', pseudo: 'Bob', hote: hote === 'bob' },
    ],
    reglages: REGLAGES_PAR_DEFAUT,
  };
}

/** Un etat de client identifie, dans un salon. */
function etat(modifications: Partial<EtatClient> = {}): EtatClient {
  return { ...ETAT_INITIAL, moi: 'moi', salon: salon('bob'), ...modifications };
}

describe('annonceDuFait', () => {
  it('reprend le texte du jeu d origine pour une capture subie', () => {
    const annonce = annonceDuFait(
      fait('captureSubie', { parPseudo: 'Bob', nouvelleCouleur: '#00FF00', botsPerdus: 3 }, 0),
    );

    expect(annonce).toEqual({ texte: 'Capturé par Bob !', ton: 'alerte' });
  });

  it('dit a un traqueur la vie perdue sur un faux ninja, et son elimination', () => {
    const deux = annonceDuFait(fait('vieDeTraqueurPerdue', { viesRestantes: 2 }, 0));
    const une = annonceDuFait(fait('vieDeTraqueurPerdue', { viesRestantes: 1 }, 0));
    const aucune = annonceDuFait(fait('vieDeTraqueurPerdue', { viesRestantes: 0 }, 0));

    expect(deux).toEqual({ texte: 'C’était un PNJ, 2 vies restantes', ton: 'alerte' });
    expect(une?.texte).toBe('C’était un PNJ, 1 vie restante');
    expect(aucune?.texte).toBe('C’était un PNJ. Éliminé, vous regardez la suite');
  });

  it('dit une infection comme telle dans une partie Chasse', () => {
    const subie = annonceDuFait(
      fait('captureSubie', { parPseudo: 'Bob', nouvelleCouleur: '#FF2E7E', botsPerdus: 0 }, 0),
      'chasse',
    );
    const reussie = annonceDuFait(
      fait('captureReussie', { victimePseudo: 'Eve', botsGagnes: 0, capturesTotal: 1 }, 0),
      'chasse',
    );

    expect(subie).toEqual({ texte: 'Bob vous a attrapé : vous êtes traqueur !', ton: 'alerte' });
    expect(reussie).toEqual({ texte: 'Eve rejoint les traqueurs', ton: 'succes' });
  });

  it('accorde le nombre de ninjas gagnes', () => {
    const un = annonceDuFait(
      fait('captureReussie', { victimePseudo: 'Bob', botsGagnes: 1, capturesTotal: 1 }, 0),
    );
    const quatre = annonceDuFait(
      fait('captureReussie', { victimePseudo: 'Bob', botsGagnes: 4, capturesTotal: 2 }, 0),
    );

    expect(un?.texte).toBe('Vous avez capturé Bob : +1 ninja');
    expect(quatre?.texte).toBe('Vous avez capturé Bob : +4 ninjas');
  });

  it('nomme celui qui a lance le malus que l on subit', () => {
    const annonce = annonceDuFait(
      fait('malusSubi', { nature: 'flou', dureeMs: 12_000, parPseudo: 'Bob' }, 0),
    );

    expect(annonce).toEqual({
      texte: 'Bob vous a volé vos lunettes',
      ton: 'alerte',
      // Un malus qui nous frappe prend le grand titre, penche et brouille (etape 4.6).
      grandTitre: {
        surtitre: 'Malus',
        titre: 'Vision floue',
        ligne: 'Bob vous a volé vos lunettes',
        couleur: 0x44aaff,
        icone: '/assets/objets/blur.png',
        brouille: true,
      },
    });
  });

  it('dit a celui qui ramasse un malus qu il frappe les autres', () => {
    // Comportement a preserver numero 4: un malus frappe les autres. L'annonce
    // doit le dire, sans quoi le joueur croit s'etre penalise lui-meme.
    const annonce = annonceDuFait(fait('malusRamasse', { nature: 'negatif', dureeMs: 14_000 }, 0));

    expect(annonce).toEqual({
      texte: 'Vous avez privé vos adversaires de couleurs',
      ton: 'succes',
      // Une bonne nouvelle pour nous: le grand titre ne se brouille pas (etape 4.6).
      grandTitre: {
        surtitre: 'Malus envoyé',
        titre: 'Vision négative',
        ligne: 'Vous avez privé vos adversaires de couleurs',
        couleur: 0xaa44ff,
        icone: '/assets/objets/negative.png',
        brouille: false,
      },
    });
  });

  it('donne le grand titre a chacun des douze objets, a sa couleur et avec son icone', () => {
    const bonus = [
      'vitesse',
      'invincibilite',
      'revelation',
      'rafale',
      'rechargeRapide',
      'viseeLarge',
    ] as const;
    const malus = [
      'controlesInverses',
      'flou',
      'negatif',
      'tirUnique',
      'rechargeLente',
      'viseeEtroite',
    ] as const;

    for (const nature of bonus) {
      const titre = annonceDuFait(fait('bonusActive', { nature, dureeMs: 7_000 }, 0))?.grandTitre;

      expect(titre?.surtitre, nature).toBe('Bonus');
      expect(titre?.couleur, nature).toBe(APPARENCE_OBJET[nature].couleur);
      expect(titre?.titre, nature).toBe(APPARENCE_OBJET[nature].libelle);
      expect(titre?.icone, nature).toBe(adresseDeLIcone(nature));
      // La duree vient de l'effet recu: l'hote regle les durees.
      expect(titre?.ligne, nature).toMatch(/ pendant 7 s$/u);
      expect(titre?.brouille, nature).toBe(false);
    }

    for (const nature of malus) {
      const subi = annonceDuFait(
        fait('malusSubi', { nature, dureeMs: 7_000, parPseudo: 'Bob' }, 0),
      );
      const envoye = annonceDuFait(fait('malusRamasse', { nature, dureeMs: 7_000 }, 0));

      expect(subi?.grandTitre?.couleur, nature).toBe(APPARENCE_OBJET[nature].couleur);
      expect(subi?.grandTitre?.ligne, nature).toContain('Bob');
      expect(subi?.grandTitre?.brouille, nature).toBe(true);
      expect(envoye?.grandTitre?.surtitre, nature).toBe('Malus envoyé');
      expect(envoye?.grandTitre?.brouille, nature).toBe(false);
    }
  });

  it('dit ce que fait un bonus sous son grand titre', () => {
    const vitesse = annonceDuFait(fait('bonusActive', { nature: 'vitesse', dureeMs: 10_000 }, 0));
    const recharge = annonceDuFait(
      fait('bonusActive', { nature: 'rechargeRapide', dureeMs: 10_000 }, 0),
    );

    expect(vitesse?.grandTitre?.ligne).toBe('Vitesse x1,7 pendant 10 s');
    expect(recharge?.grandTitre?.ligne).toBe('Une charge revient en 1,5 s pendant 10 s');
  });

  it('laisse les autres faits dans le fil, sans grand titre', () => {
    const capture = annonceDuFait(
      fait('captureSubie', { parPseudo: 'Bob', nouvelleCouleur: '#00FF00', botsPerdus: 3 }, 0),
    );
    const arrivee = annonceDuFait(
      fait('joueurArrive', { id: 'eve', pseudo: 'Eve', hote: false }, 0),
    );

    expect(capture?.grandTitre).toBeUndefined();
    expect(arrivee?.grandTitre).toBeUndefined();
  });

  it('nomme le bonus ramasse avec son libelle affiche', () => {
    const annonce = annonceDuFait(
      fait('bonusActive', { nature: 'invincibilite', dureeMs: 10_000 }, 0),
    );

    expect(annonce?.texte).toBe('Bonus : Invincibilité');
  });

  it('signale le depart de l hote', () => {
    const annonce = annonceDuFait(fait('joueurParti', { id: 'bob', pseudo: 'Bob', hote: true }, 0));

    expect(annonce?.texte).toBe('Bob a quitté la partie (était hôte)');
  });

  it('ne fait pas de phrase pour un tir du mode Tactique', () => {
    // Un tir se voit sur le terrain; la capture d'un joueur, elle, s'annonce.
    const tir = fait(
      'tirDeCapture',
      { tireur: 'bob', x: 0, y: 0, orientation: 'est', captures: 3 },
      0,
    );

    expect(annonceDuFait(tir)).toBeUndefined();
  });
});

describe('annonceDuRefus', () => {
  it('annonce un refus d action avec ses motifs', () => {
    const annonce = annonceDuRefus({
      action: 'demarrer',
      erreurs: [{ champ: 'hote', motif: "Seul l'hôte de la partie peut faire cela." }],
    });

    expect(annonce).toEqual({ texte: "Seul l'hôte de la partie peut faire cela.", ton: 'alerte' });
  });

  it('laisse les refus d entree et de chat a leur champ', () => {
    const erreurs = [{ champ: 'pseudo', motif: 'Pris.' }];

    expect(annonceDuRefus({ action: 'rejoindre', erreurs })).toBeUndefined();
    expect(annonceDuRefus({ action: 'chat', erreurs })).toBeUndefined();
  });
});

describe('annoncesDuChangement', () => {
  it('annonce chaque fait nouveau, et une seule fois', () => {
    const arrivee = fait('joueurArrive', { id: 'carol', pseudo: 'Carol', hote: false }, 10);
    const avant = etat();
    const apres = etat({ journal: [arrivee] });
    const ensuite = etat({ journal: [arrivee], messages: [] });

    expect(annoncesDuChangement(avant, apres).map((annonce) => annonce.texte)).toEqual([
      'Carol a rejoint la partie',
    ]);
    expect(annoncesDuChangement(apres, ensuite)).toEqual([]);
  });

  it('passe un tir sous silence, sans taire ce qui arrive avec lui', () => {
    const tir = fait(
      'tirDeCapture',
      { tireur: 'moi', x: 0, y: 0, orientation: 'est', captures: 1 },
      5,
    );
    const arrivee = fait('joueurArrive', { id: 'carol', pseudo: 'Carol', hote: false }, 10);

    expect(
      annoncesDuChangement(etat(), etat({ journal: [tir, arrivee] })).map(
        (annonce) => annonce.texte,
      ),
    ).toEqual(['Carol a rejoint la partie']);
  });

  it('n annonce rien quand le journal repart a zero au lancement', () => {
    const arrivee = fait('joueurArrive', { id: 'carol', pseudo: 'Carol', hote: false }, 10);

    expect(annoncesDuChangement(etat({ journal: [arrivee] }), etat({ journal: [] }))).toEqual([]);
  });

  it('annonce un refus nouveau, pas celui qui est deja affiche', () => {
    const refus = {
      action: 'reglages' as const,
      erreurs: [{ champ: 'reglages', motif: 'La partie a déjà commencé.' }],
    };

    expect(annoncesDuChangement(etat(), etat({ refus }))).toHaveLength(1);
    expect(annoncesDuChangement(etat({ refus }), etat({ refus }))).toEqual([]);
  });

  it('annonce au joueur qu il devient l hote', () => {
    const annonces = annoncesDuChangement(etat(), etat({ salon: salon('moi') }));

    expect(annonces.map((annonce) => annonce.texte)).toEqual([
      "Vous êtes maintenant l'hôte de la partie",
    ]);
  });

  it('ne l annonce pas a l entree dans un salon que l on vient d ouvrir', () => {
    const avant = etat({ salon: undefined });

    expect(annoncesDuChangement(avant, etat({ salon: salon('moi') }))).toEqual([]);
  });
});

describe("les annonces de l'Evade (etape 7.9)", () => {
  const annonce = (charge: Parameters<typeof fait<'evade'>>[1], mode?: 'equipes' | 'massacre') =>
    annonceDuFait(fait('evade', charge, 0), mode, 'moi');

  it('annonce son apparition a tous, en grand titre raye, sans icone', () => {
    const apparu = annonce({ quoi: 'apparu' });

    expect(apparu?.grandTitre).toMatchObject({
      titre: 'L’Évadé rôde !',
      ligne: 'Son x2 double votre score',
      raye: true,
      icone: undefined,
      brouille: false,
    });
    expect(annonce({ quoi: 'apparu' }, 'equipes')?.grandTitre?.ligne).toBe(
      'Son x2 double le score de votre équipe',
    );
  });

  it('dit a celui qui l attrape que son score compte double, et aux autres qui le porte', () => {
    const moi = annonce({ quoi: 'attrape', par: 'moi', parPseudo: 'Moi' });
    const autre = annonce({ quoi: 'attrape', par: 'bob', parPseudo: 'Bob' });

    expect(moi?.ton).toBe('succes');
    expect(moi?.grandTitre?.titre).toBe('x2');
    expect(autre?.grandTitre?.ligne).toBe('Bob porte le x2 : prenez-le lui');
    expect(
      annonce({ quoi: 'attrape', par: 'moi', parPseudo: 'Moi' }, 'massacre')?.grandTitre?.surtitre,
    ).toBe('L’Évadé éliminé');
  });

  it('dit le vol du x2 a chacun, et le brouille chez qui le perd', () => {
    const vol = { quoi: 'vole' as const, par: 'bob', parPseudo: 'Bob', de: 'moi', dePseudo: 'Moi' };
    const subi = annonce(vol);
    const fait_ = annonce({ ...vol, par: 'moi', parPseudo: 'Moi', de: 'bob', dePseudo: 'Bob' });
    const vu = annonce({ ...vol, de: 'eve', dePseudo: 'Eve' });

    expect(subi?.ton).toBe('alerte');
    expect(subi?.grandTitre?.brouille).toBe(true);
    expect(fait_?.grandTitre?.ligne).toBe('Vous prenez le x2 de Bob');
    expect(vu?.grandTitre?.ligne).toBe('Bob prend le x2 de Eve');
  });

  it('dit la perte du x2 face a un Black Ninja, et la fuite de l Evade', () => {
    expect(annonce({ quoi: 'perdu', de: 'moi', dePseudo: 'Moi' })?.grandTitre?.ligne).toBe(
      'Un Black Ninja a détruit votre x2',
    );
    expect(annonce({ quoi: 'perdu', de: 'bob', dePseudo: 'Bob' })?.grandTitre?.ligne).toBe(
      'Un Black Ninja a détruit le x2 de Bob',
    );
    expect(annonce({ quoi: 'enfui' })?.grandTitre?.titre).toBe('Envolé');
  });
});
