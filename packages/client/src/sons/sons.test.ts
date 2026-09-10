/**
 * Tests de la couche sonore.
 *
 * Ils couvrent ce que le jeu d'origine ne pouvait pas verifier: qu'un fait de jeu
 * produit bien le son attendu, et qu'un son demande existe. Ses quatre sons de
 * ramassage n'ont jamais ete joues parce qu'il les demandait sous un nom absent
 * de sa table; aucun test ne pouvait le dire, et personne ne l'a remarque.
 */

import type { NomDeSon } from '@neon-ninja/shared';
import { SONS } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { EtatClient } from '../etat.js';
import { ETAT_INITIAL } from '../etat.js';
import { fait } from '../faits.js';
import type { VuePartie } from '../reconstruction.js';
import { battementDeFin, sonDuFait, sonsDuChangement } from './declencheurs.js';
import { creerLecteurDeSons } from './lecteur.js';

/** Une vue de partie avec le temps restant voulu. */
function partie(tempsRestantMs: number): VuePartie {
  return {
    tick: 1,
    tempsRestantMs,
    enPause: false,
    entites: [],
    objets: [],
    zones: [],
    classement: [],
  };
}

describe('sonDuFait', () => {
  it('fait entendre un ramassage de bonus', () => {
    const declenche = sonDuFait(fait('bonusActive', { nature: 'vitesse', dureeMs: 10_000 }, 0));

    expect(declenche).toBe('bonusRamasse');
  });

  it('distingue la capture reussie de la capture subie', () => {
    const reussie = sonDuFait(
      fait('captureReussie', { victimePseudo: 'Bob', botsGagnes: 3, capturesTotal: 1 }, 0),
    );
    const subie = sonDuFait(
      fait('captureSubie', { parPseudo: 'Bob', nouvelleCouleur: '#00FF00', botsPerdus: 3 }, 0),
    );

    expect(reussie).toBe('joueurCapture');
    expect(subie).toBe('joueurCaptureSubi');
    expect(reussie).not.toBe(subie);
  });

  it('ne fait aucun bruit pour une arrivee ou un depart', () => {
    const arrivee = sonDuFait(fait('joueurArrive', { id: 'a', pseudo: 'Alice', hote: false }, 0));

    expect(arrivee).toBeUndefined();
  });

  it('ne nomme que des sons qui existent', () => {
    // Le defaut exact du jeu d'origine. Ici le compilateur le rend impossible,
    // et ce test le verifie une seconde fois a l'execution, au cas ou la table
    // des sons se viderait par accident.
    const nommes: (NomDeSon | undefined)[] = [
      sonDuFait(fait('bonusActive', { nature: 'vitesse', dureeMs: 1 }, 0)),
      sonDuFait(fait('malusSubi', { nature: 'flou', dureeMs: 1, parPseudo: 'Bob' }, 0)),
      sonDuFait(fait('botNoirDetruit', { points: 15, x: 0, y: 0 }, 0)),
    ];

    for (const nom of nommes) {
      expect(nom === undefined || nom in SONS).toBe(true);
    }
  });
});

describe('sonsDuChangement', () => {
  /** Deux etats successifs, a partir de differences. */
  const changement = (
    avant: Partial<EtatClient>,
    apres: Partial<EtatClient>,
  ): readonly NomDeSon[] =>
    sonsDuChangement({ ...ETAT_INITIAL, ...avant }, { ...ETAT_INITIAL, ...apres });

  it('sonne le depart quand on entre en partie', () => {
    expect(changement({ ecran: 'salon' }, { ecran: 'jeu' })).toContain('partieLancee');
  });

  it('ne resonne pas a chaque image une fois la partie lancee', () => {
    expect(changement({ ecran: 'jeu' }, { ecran: 'jeu' })).toEqual([]);
  });

  it('sonne la fin quand le classement definitif arrive', () => {
    expect(changement({ ecran: 'jeu' }, { ecran: 'jeu', fin: { classement: [] } })).toContain(
      'partieTerminee',
    );
  });

  it('bat une fois par seconde du compte a rebours', () => {
    const sons = changement(
      { compteARebours: { secondesRestantes: 4, annulable: true } },
      { compteARebours: { secondesRestantes: 3, annulable: false } },
    );

    expect(sons).toContain('compteARebours');
  });

  it('donne un son different au dernier battement du compte a rebours', () => {
    const sons = changement(
      { compteARebours: { secondesRestantes: 2, annulable: false } },
      { compteARebours: { secondesRestantes: 1, annulable: false } },
    );

    expect(sons).toContain('compteAReboursFinal');
  });

  it('ne rebat pas quand le compte a rebours n a pas avance', () => {
    const meme = { secondesRestantes: 3, annulable: false };

    expect(changement({ compteARebours: meme }, { compteARebours: meme })).toEqual([]);
  });

  it('sonne a l arrivee d un message de chat', () => {
    const message = { auteur: 'a', pseudo: 'Alice', texte: 'salut', recuA: 0 };

    expect(changement({ messages: [] }, { messages: [message] })).toContain('chat');
  });

  it('bat les dernieres secondes de la partie', () => {
    expect(changement({ partie: partie(9_100) }, { partie: partie(8_900) })).toContain(
      'tempsPresqueEcoule',
    );
  });

  it('reste muet tant qu il reste du temps', () => {
    expect(changement({ partie: partie(60_000) }, { partie: partie(59_800) })).toEqual([]);
  });
});

describe('battementDeFin', () => {
  it('bat une fois par seconde entamee, et pas a chaque battement recu', () => {
    // Le serveur bat vingt fois par seconde: sans cette regle, le tic-tac des
    // dernieres secondes serait un bourdonnement.
    expect(battementDeFin(5_000, 4_950)).toBe(false);
    expect(battementDeFin(4_050, 3_950)).toBe(true);
  });

  it('se tait une fois le temps ecoule', () => {
    expect(battementDeFin(100, 0)).toBe(false);
  });

  it('se tait quand la partie n a pas encore de temps', () => {
    expect(battementDeFin(undefined, 5_000)).toBe(false);
  });
});

describe('creerLecteurDeSons', () => {
  /** Un element audio d'essai, qui note ce qu'on lui demande. */
  function audioDEssai(): HTMLAudioElement & { lectures: number; adresse: string } {
    let lectures = 0;

    return {
      lectures: 0,
      adresse: '',
      currentTime: 0,
      volume: 1,
      loop: false,
      paused: true,
      play() {
        lectures += 1;
        (this as unknown as { lectures: number }).lectures = lectures;
        return Promise.resolve();
      },
      pause() {
        return undefined;
      },
    } as unknown as HTMLAudioElement & { lectures: number; adresse: string };
  }

  /** Un lecteur relie a des elements d'essai, retrouvables par leur adresse. */
  function lecteurDEssai(): {
    lecteur: ReturnType<typeof creerLecteurDeSons>;
    audios: Map<string, HTMLAudioElement & { lectures: number }>;
  } {
    const audios = new Map<string, HTMLAudioElement & { lectures: number }>();

    const lecteur = creerLecteurDeSons({
      creerAudio: (adresse) => {
        const audio = audioDEssai();
        audios.set(adresse, audio);
        return audio;
      },
    });

    return { lecteur, audios };
  }

  it('demande le bon fichier pour un son nomme', () => {
    const { lecteur, audios } = lecteurDEssai();
    lecteur.jouer('bonusRamasse');

    const joue = [...audios.entries()].find(([, audio]) => audio.lectures > 0);

    expect(joue?.[0]).toBe('/assets/sons/collect-bonus.wav');
  });

  it('espace les bruits de pas', () => {
    const { lecteur, audios } = lecteurDEssai();
    const lectures = (): number =>
      [...audios.values()].reduce((total, audio) => total + audio.lectures, 0);

    lecteur.jouerUnPas(1_000, false);
    lecteur.jouerUnPas(1_100, false);

    expect(lectures()).toBe(1);

    lecteur.jouerUnPas(1_300, false);

    expect(lectures()).toBe(2);
  });

  it('espace moins les pas quand le joueur court', () => {
    const { lecteur, audios } = lecteurDEssai();
    const lectures = (): number =>
      [...audios.values()].reduce((total, audio) => total + audio.lectures, 0);

    lecteur.jouerUnPas(1_000, true);
    lecteur.jouerUnPas(1_210, true);

    expect(lectures()).toBe(2);
  });

  it('ne joue plus rien quand le son est coupe', () => {
    const { lecteur, audios } = lecteurDEssai();
    lecteur.couperLeSon(true);
    lecteur.jouer('bonusRamasse');

    expect([...audios.values()].every((audio) => audio.lectures === 0)).toBe(true);
  });

  it('borne le volume entre zero et un', () => {
    const { lecteur, audios } = lecteurDEssai();
    lecteur.reglerLeVolumeDesSons(5);

    expect([...audios.values()].every((audio) => audio.volume <= 1)).toBe(true);

    lecteur.reglerLeVolumeDesSons(-3);

    expect([...audios.values()].every((audio) => audio.volume >= 0)).toBe(true);
  });
});
