/**
 * Tests de la couche sonore.
 *
 * Ils couvrent ce que le jeu d'origine ne pouvait pas verifier: qu'un fait de jeu
 * produit bien le son attendu, et qu'un son demande existe. Ses quatre sons de
 * ramassage n'ont jamais ete joues parce qu'il les demandait sous un nom absent
 * de sa table; aucun test ne pouvait le dire, et personne ne l'a remarque.
 */

import type { Mode, NomDeSon } from '@neon-ninja/shared';
import { CHASSE, REGLAGES_PAR_DEFAUT, SONS, SONS_DE_PAS } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { EtatClient } from '../etat.js';
import { ETAT_INITIAL } from '../etat.js';
import type { FaitDeJeu } from '../faits.js';
import { fait } from '../faits.js';
import type { VuePartie } from '../reconstruction.js';
import { battementDeFin, rechargeApresLeTir, sonDuFait, sonsDuChangement } from './declencheurs.js';
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

  it('fait entendre notre tir s il a capture, et ni nos tirs vides ni ceux des autres', () => {
    const tir = (tireur: string, captures: number): ReturnType<typeof fait> =>
      fait('tirDeCapture', { tireur, x: 0, y: 0, orientation: 'est', captures }, 0);

    expect(sonDuFait(tir('moi', 2), 'moi')).toBe('capture');
    expect(sonDuFait(tir('moi', 0), 'moi')).toBeUndefined();
    expect(sonDuFait(tir('autre', 3), 'moi')).toBeUndefined();
  });

  it('fait entendre le fusil a chacun de nos tirs en Tactique, reussi ou non (etape 5.5)', () => {
    const tir = (tireur: string, captures: number): ReturnType<typeof fait> =>
      fait('tirDeCapture', { tireur, x: 0, y: 0, orientation: 'est', captures }, 0);

    expect(sonDuFait(tir('moi', 2), 'moi', 'tactique')).toBe('tirFusil');
    expect(sonDuFait(tir('moi', 0), 'moi', 'tactique')).toBe('tirFusil');
    expect(sonDuFait(tir('autre', 3), 'moi', 'tactique')).toBeUndefined();
  });

  it('fait entendre le fusil aux tirs du traqueur en Chasse, reussis ou non', () => {
    const tir = (tireur: string, captures: number): ReturnType<typeof fait> =>
      fait('tirDeCapture', { tireur, x: 0, y: 0, orientation: 'est', captures }, 0);

    expect(sonDuFait(tir('moi', 1), 'moi', 'chasse')).toBe('tirFusil');
    expect(sonDuFait(tir('moi', 0), 'moi', 'chasse')).toBe('tirFusil');
    expect(sonDuFait(tir('autre', 1), 'moi', 'chasse')).toBeUndefined();
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

  describe('les faux ninjas ralliés (etape 5.5)', () => {
    const MOI = {
      type: 'joueur',
      id: 'moi',
      x: 100,
      y: 100,
      couleur: '#FF0000',
      direction: 'sud',
      pseudo: 'Alice',
      invincible: false,
      protege: false,
    } as const;

    /** Une partie ou un faux ninja porte cette couleur. */
    const avecUnBot = (couleur: string): VuePartie => ({
      ...partie(60_000),
      entites: [MOI, { type: 'bot', id: 'b1', x: 120, y: 100, couleur, direction: 'nord' }],
    });

    const enMode = (mode: Mode) =>
      ({
        moi: 'moi',
        salon: {
          idRoom: 'r',
          statut: 'enCours',
          mode,
          visibilite: 'publique',
          capacite: 12,
          joueurs: [],
          reglages: REGLAGES_PAR_DEFAUT,
        },
      }) as const;

    it('sonnent quand un faux ninja neutre passe a notre couleur', () => {
      // Le son du jeu d'origine (botConvert), qui ne se jouait plus: il accompagne le
      // point « +1 ».
      const contexte = enMode('equipes');

      expect(
        changement(
          { ...contexte, partie: avecUnBot('#ABCDEF') },
          { ...contexte, partie: avecUnBot('#FF0000') },
        ),
      ).toEqual(['botCapture']);
    });

    it('se taisent en Horde, ou ils suivent les ralliements annonces (etape 7.5)', () => {
      const contexte = enMode('classique');

      expect(
        changement(
          { ...contexte, partie: avecUnBot('#ABCDEF') },
          { ...contexte, partie: avecUnBot('#FF0000') },
        ),
      ).toEqual([]);
    });

    it('sonnent aussi en Tactique, apres le coup de fusil', () => {
      const contexte = enMode('tactique');

      expect(
        changement(
          { ...contexte, partie: avecUnBot('#ABCDEF') },
          { ...contexte, partie: avecUnBot('#FF0000') },
        ),
      ).toEqual(['botCapture']);
    });

    it('rechargent le fusil quand une de nos charges revient, en Tactique', () => {
      const contexte = enMode('tactique');
      const avecCharges = (charges: number): VuePartie => ({
        ...partie(60_000),
        entites: [
          {
            ...MOI,
            tactique: { orientation: 'est', charges, avantProchaineChargeMs: 1_000 },
          },
        ],
      });

      expect(
        changement(
          { ...contexte, partie: avecCharges(2) },
          { ...contexte, partie: avecCharges(3) },
        ),
      ).toEqual(['rechargeFusil']);
      // Un tir fait baisser les charges: rien a recharger.
      expect(
        changement(
          { ...contexte, partie: avecCharges(3) },
          { ...contexte, partie: avecCharges(2) },
        ),
      ).toEqual([]);
    });
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

  it('baisse sans Web Audio le volume d un son situe, sans toucher aux autres (etape 4.11)', () => {
    const { lecteur, audios } = lecteurDEssai();
    const adresse = `/assets/sons/${SONS.mineExplosee}`;
    lecteur.reglerLeVolumeDesSons(0.8);

    lecteur.jouer('mineExplosee', { volume: 0.5, cote: 0.4 });
    expect(audios.get(adresse)?.volume).toBeCloseTo(0.4);
    expect(audios.get(`/assets/sons/${SONS.fumee}`)?.volume).toBeCloseTo(0.8);

    lecteur.reglerLeVolumeDesSons(0.6);
    expect(audios.get(adresse)?.volume).toBeCloseTo(0.3);

    lecteur.jouer('mineExplosee');
    expect(audios.get(adresse)?.volume).toBeCloseTo(0.6);
  });

  describe('avec Web Audio (etapes 5.5 et 5.12)', () => {
    // Sous iOS, tous les navigateurs sont WebKit, qui ignore le volume d'un element
    // audio: les curseurs ne faisaient rien. Le son passe donc par des noeuds de gain.
    // Et un element audio relance a chaque pas ou a chaque tir faisait ramer l'iPhone
    // (etape 5.12): les effets sont des tampons decodes, la musique seule reste un element.

    /** Un noeud de gain d'essai. */
    interface GainDEssai {
      gain: { value: number };
      branches: unknown[];
      /** Le noeud sur lequel il est branche. */
      vers?: unknown;
    }

    /** Un panoramique stereo d'essai (etape 4.11). */
    interface PanoramiqueDEssai {
      pan: { value: number };
      vers?: unknown;
    }

    /** Une source de tampon d'essai, qui note sa vie. */
    interface SourceDEssai {
      buffer: { fichier: string } | null;
      loop: boolean;
      branchee?: GainDEssai;
      lancee: boolean;
      arretee: boolean;
    }

    /** Un contexte audio d'essai, qui note ses noeuds et ce qui s'y branche. */
    function contexteDEssai() {
      const gains: GainDEssai[] = [];
      const sources: SourceDEssai[] = [];
      const panoramiques: PanoramiqueDEssai[] = [];
      const contexte = {
        state: 'suspended' as AudioContextState,
        destination: {},
        reprises: 0,
        gains,
        sources,
        panoramiques,
        createGain() {
          const noeud: GainDEssai & { connect(cible: unknown): unknown } = {
            gain: { value: 1 },
            branches: [] as unknown[],
            connect(cible: unknown) {
              noeud.vers = cible;
              return cible;
            },
          };
          gains.push(noeud);
          return noeud;
        },
        createStereoPanner(): PanoramiqueDEssai {
          const noeud: PanoramiqueDEssai & { connect(cible: unknown): unknown } = {
            pan: { value: 0 },
            connect(cible: unknown) {
              noeud.vers = cible;
              return cible;
            },
          };
          panoramiques.push(noeud);
          return noeud;
        },
        createMediaElementSource(element: HTMLMediaElement) {
          return {
            connect(cible: GainDEssai) {
              cible.branches.push(element);
              return cible;
            },
          };
        },
        createBufferSource() {
          const source: SourceDEssai & {
            connect(cible: GainDEssai): GainDEssai;
            start(): void;
            stop(): void;
          } = {
            buffer: null,
            loop: false,
            lancee: false,
            arretee: false,
            connect(cible) {
              source.branchee = cible;
              return cible;
            },
            start() {
              source.lancee = true;
            },
            stop() {
              source.arretee = true;
            },
          };
          sources.push(source);
          return source;
        },
        // Le tampon d'essai retient le fichier dont il vient.
        decodeAudioData(contenu: { fichier: string }) {
          return Promise.resolve({ fichier: contenu.fichier });
        },
        resume() {
          contexte.reprises += 1;
          contexte.state = 'running';
          return Promise.resolve();
        },
      };
      return contexte;
    }

    function lecteurWebAudio(
      options: {
        readonly manquants?: readonly string[];
        readonly musique?: boolean;
        /** Un navigateur qui a Web Audio sans le panoramique stereo. */
        readonly sansPanoramique?: boolean;
      } = {},
    ) {
      const contexte: Omit<ReturnType<typeof contexteDEssai>, 'createStereoPanner'> & {
        createStereoPanner?: () => PanoramiqueDEssai;
      } = contexteDEssai();

      if (options.sansPanoramique === true) {
        delete contexte.createStereoPanner;
      }

      const audios = new Map<string, HTMLAudioElement & { lectures: number }>();
      const charges: string[] = [];
      const lecteur = creerLecteurDeSons({
        creerAudio: (adresse) => {
          const audio = audioDEssai();
          audios.set(adresse, audio);
          return audio;
        },
        creerContexte: () => contexte as unknown as AudioContext,
        chargerFichier: (adresse) => {
          charges.push(adresse);
          const fichier = adresse.slice(adresse.lastIndexOf('/') + 1);
          return (options.manquants ?? []).includes(fichier)
            ? Promise.reject(new Error('introuvable'))
            : Promise.resolve({ fichier } as unknown as ArrayBuffer);
        },
        ...(options.musique === undefined ? {} : { musique: options.musique }),
      });
      /** Le noeud de gain par lequel passe l'element de cette adresse. */
      const gainDe = (adresse: string) =>
        contexte.gains.find((noeud) => noeud.branches.includes(audios.get(adresse)));
      /** Les sources lancees pour ce fichier. */
      const lectures = (fichier: string) =>
        contexte.sources.filter((source) => source.buffer?.fichier === fichier && source.lancee);
      /** Debloque le son, et attend le decodage des effets. */
      const debloquer = async () => {
        lecteur.deverrouiller();
        await new Promise((resolu) => setTimeout(resolu, 0));
      };
      return { lecteur, contexte, audios, charges, gainDe, lectures, debloquer };
    }

    it('ne fabrique aucun element audio pour les effets', () => {
      const { audios } = lecteurWebAudio();

      expect(audios.size).toBe(0);
    });

    it('joue un effet par une source de tampon, sur le gain des effets', async () => {
      const { lecteur, lectures, debloquer } = lecteurWebAudio();
      await debloquer();

      lecteur.reglerLeVolumeDesSons(0.25);
      lecteur.jouer('bonusRamasse');

      const [source] = lectures('collect-bonus.wav');
      expect(source?.loop).toBe(false);
      expect(source?.branchee?.gain.value).toBe(0.25);
    });

    describe('les sons situes sur la carte (etape 4.11)', () => {
      it('passent par un gain et un panoramique propres a la lecture, puis par le gain des effets', async () => {
        const { lecteur, lectures, contexte, debloquer } = lecteurWebAudio();
        await debloquer();
        lecteur.reglerLeVolumeDesSons(0.5);

        lecteur.jouer('mineExplosee', { volume: 0.25, cote: -0.6 });

        const distance = lectures(SONS.mineExplosee)[0]?.branchee;
        const cote = contexte.panoramiques[0];
        expect(distance?.gain.value).toBe(0.25);
        expect(distance?.vers).toBe(cote);
        expect(cote?.pan.value).toBe(-0.6);
        expect((cote?.vers as GainDEssai | undefined)?.gain.value).toBe(0.5);
      });

      it('donnent a chaque lecture sa propre place', async () => {
        const { lecteur, lectures, debloquer } = lecteurWebAudio();
        await debloquer();

        lecteur.jouer('mineArmee', { volume: 0.9, cote: 0 });
        lecteur.jouer('mineArmee', { volume: 0.1, cote: 0.8 });

        expect(lectures(SONS.mineArmee).map((source) => source.branchee?.gain.value)).toEqual([
          0.9, 0.1,
        ]);
      });

      it('se taisent hors de portee, sans couper le meme son joue plus pres', async () => {
        const { lecteur, lectures, debloquer } = lecteurWebAudio();
        await debloquer();

        lecteur.jouer('mineExplosee', { volume: 0.8, cote: 0 });
        lecteur.jouer('mineExplosee', { volume: 0, cote: 0.8 });

        const explosions = lectures(SONS.mineExplosee);
        expect(explosions).toHaveLength(1);
        expect(explosions[0]?.arretee).toBe(false);
      });

      it('gardent la distance seule dans un navigateur sans panoramique stereo', async () => {
        const { lecteur, lectures, debloquer } = lecteurWebAudio({ sansPanoramique: true });
        await debloquer();
        lecteur.reglerLeVolumeDesSons(0.5);

        lecteur.jouer('fumee', { volume: 0.3, cote: 0.5 });

        const distance = lectures(SONS.fumee)[0]?.branchee;
        expect(distance?.gain.value).toBe(0.3);
        expect((distance?.vers as GainDEssai | undefined)?.gain.value).toBe(0.5);
      });

      it('laissent les sons sans place jouer comme avant, sur le gain des effets', async () => {
        const { lecteur, lectures, contexte, debloquer } = lecteurWebAudio();
        await debloquer();
        lecteur.reglerLeVolumeDesSons(0.5);

        lecteur.jouer('mineExplosee');

        expect(lectures(SONS.mineExplosee)[0]?.branchee?.gain.value).toBe(0.5);
        expect(contexte.panoramiques).toEqual([]);
      });
    });

    it('coupe la lecture precedente d un effet qu on relance: une voix par effet', async () => {
      const { lecteur, lectures, debloquer } = lecteurWebAudio();
      await debloquer();

      lecteur.jouer('tirFusil');
      lecteur.jouer('tirFusil');
      lecteur.jouer('rechargeFusil');

      const tirs = lectures('shotgun-wave.mp3');
      expect(tirs.map((source) => source.arretee)).toEqual([true, false]);
      expect(lectures('shotgun-reload.mp3')[0]?.arretee).toBe(false);
    });

    it('fait tourner les pas sur des tampons, eux aussi', async () => {
      const { lecteur, contexte, debloquer } = lecteurWebAudio();
      await debloquer();

      lecteur.jouerUnPas(1_000, false);
      lecteur.jouerUnPas(1_300, false);

      expect(contexte.sources.map((source) => source.buffer?.fichier)).toEqual([
        SONS_DE_PAS[1],
        SONS_DE_PAS[2],
      ]);
    });

    it('ne charge les effets qu au premier deblocage, et une seule fois', async () => {
      const { lecteur, charges, debloquer } = lecteurWebAudio();

      expect(charges).toEqual([]);

      await debloquer();
      const premiers = charges.length;
      lecteur.deverrouiller();

      expect(premiers).toBeGreaterThan(0);
      expect(charges).toHaveLength(premiers);
      expect(new Set(charges).size).toBe(premiers);
      expect(charges).toContain('/assets/sons/collect-bonus.wav');
      // La musique se charge par son element, pas avec les effets.
      expect(charges).not.toContain('/assets/sons/menu-music.mp3');
    });

    it('tait un effet pas encore decode, sans erreur', () => {
      const { lecteur, contexte } = lecteurWebAudio();
      contexte.state = 'running';

      expect(() => {
        lecteur.jouer('bonusRamasse');
      }).not.toThrow();
      expect(contexte.sources).toEqual([]);
    });

    it('tait un effet demande contexte suspendu, au lieu de le garder pour la reprise', async () => {
      const { lecteur, contexte, debloquer } = lecteurWebAudio();
      await debloquer();
      contexte.state = 'suspended';

      lecteur.jouer('bonusRamasse');

      expect(contexte.sources).toEqual([]);
    });

    it('ne laisse pas un fichier manquant faire taire les autres', async () => {
      const { lecteur, lectures, debloquer } = lecteurWebAudio({
        manquants: ['collect-bonus.wav'],
      });
      await debloquer();

      lecteur.jouer('bonusRamasse');
      lecteur.jouer('malusRamasse');

      expect(lectures('collect-bonus.wav')).toEqual([]);
      expect(lectures('collect-malus.wav')).toHaveLength(1);
    });

    it('fait tourner une boucle de bonus une seule fois, sur son canal, jusqu a l arret', async () => {
      const { lecteur, lectures, debloquer } = lecteurWebAudio();
      await debloquer();

      lecteur.reglerLeVolumeDesSons(0.5);
      lecteur.demarrerLaBoucle('vitesse');
      lecteur.demarrerLaBoucle('vitesse');

      const boucles = lectures('speed-active.mp3');
      expect(boucles).toHaveLength(1);
      expect(boucles[0]?.loop).toBe(true);
      // Les boucles suivent le volume des effets, a un cinquieme (etape 5.5).
      expect(boucles[0]?.branchee?.gain.value).toBeCloseTo(0.1);

      lecteur.arreterLaBoucle('vitesse');
      expect(boucles[0]?.arretee).toBe(true);

      lecteur.demarrerLaBoucle('vitesse');
      expect(lectures('speed-active.mp3')).toHaveLength(2);
    });

    it('arrete tous les effets en cours quand on coupe le son, et n en joue plus', async () => {
      const { lecteur, contexte, debloquer } = lecteurWebAudio();
      await debloquer();

      lecteur.jouer('capture');
      lecteur.demarrerLaBoucle('invincibilite');
      lecteur.couperLeSon(true);
      lecteur.jouer('capture');
      lecteur.jouerUnPas(5_000, false);
      lecteur.demarrerLaBoucle('vitesse');

      expect(contexte.sources).toHaveLength(2);
      expect(contexte.sources.every((source) => source.arretee)).toBe(true);
    });

    it('regle le volume de la musique par son propre noeud de gain', () => {
      const { lecteur, gainDe } = lecteurWebAudio();

      lecteur.demarrerLaMusique('menu');
      lecteur.reglerLeVolumeDeLaMusique(0.1);

      expect(gainDe('/assets/sons/menu-music.mp3')?.gain.value).toBe(0.1);
    });

    it('joue les musiques de partie a la moitie du volume de la musique', () => {
      const { lecteur, gainDe } = lecteurWebAudio();

      lecteur.reglerLeVolumeDeLaMusique(0.8);
      lecteur.demarrerLaMusique('infiltration');

      expect(gainDe('/assets/sons/infiltration.mp3')?.gain.value).toBeCloseTo(0.4);

      lecteur.reglerLeVolumeDeLaMusique(0.6);
      expect(gainDe('/assets/sons/infiltration.mp3')?.gain.value).toBeCloseTo(0.3);

      // Revenue aux menus, la musique reprend le volume choisi, sans moitie.
      lecteur.demarrerLaMusique('menu');
      expect(gainDe('/assets/sons/menu-music.mp3')?.gain.value).toBeCloseTo(0.6);
    });

    it('ne fait jouer aucune musique sous la variante qui la retire', () => {
      const { lecteur, audios } = lecteurWebAudio({ musique: false });

      lecteur.demarrerLaMusique('menu');

      expect(audios.size).toBe(0);
      expect(lecteur.etat().musique).toBe(false);
    });

    it('se debloque au geste du joueur', () => {
      const { lecteur, contexte } = lecteurWebAudio();

      lecteur.deverrouiller();
      lecteur.deverrouiller();

      expect(contexte.state).toBe('running');
      expect(contexte.reprises).toBe(1);
    });

    it('dit au releve ou en est le son', async () => {
      const { lecteur, debloquer } = lecteurWebAudio({ manquants: ['capture.wav'] });

      expect(lecteur.etat()).toMatchObject({
        coupe: false,
        musique: true,
        voie: { nature: 'web audio', contexte: 'suspended', prets: 0 },
      });

      await debloquer();
      lecteur.reglerLeVolumeDesSons(0.4);
      lecteur.reglerLeVolumeDeLaMusique(0.2);
      lecteur.couperLeSon(true);
      const etat = lecteur.etat();

      expect(etat).toMatchObject({ coupe: true, volumeSons: 0.4, volumeMusique: 0.2 });
      expect(etat.voie).toMatchObject({ nature: 'web audio', contexte: 'running' });
      // Un fichier manquant: tous les autres sont prets.
      const voie = etat.voie as { prets: number; fichiers: number };
      expect(voie.fichiers - voie.prets).toBe(1);
    });
  });

  it('dit au releve que les effets passent par des elements, faute de Web Audio', () => {
    const { lecteur } = lecteurDEssai();

    expect(lecteur.etat().voie).toEqual({ nature: 'elements' });
  });

  it('borne le volume entre zero et un', () => {
    const { lecteur, audios } = lecteurDEssai();
    lecteur.reglerLeVolumeDesSons(5);

    expect([...audios.values()].every((audio) => audio.volume <= 1)).toBe(true);

    lecteur.reglerLeVolumeDesSons(-3);

    expect([...audios.values()].every((audio) => audio.volume >= 0)).toBe(true);
  });
});

describe('rechargeApresLeTir (Chasse)', () => {
  const tir = (tireur: string): ReturnType<typeof fait> =>
    fait('tirDeCapture', { tireur, x: 0, y: 0, orientation: 'est', captures: 0 }, 1_000);

  it('recharge le fusil du traqueur quand il peut tirer de nouveau', () => {
    expect(rechargeApresLeTir(tir('moi'), 'moi', 'chasse')).toBe(
      1_000 + CHASSE.DELAI_ENTRE_TIRS_MS,
    );
  });

  it('ne recharge ni le tir d un autre, ni en Tactique, ou les charges le disent', () => {
    expect(rechargeApresLeTir(tir('autre'), 'moi', 'chasse')).toBeUndefined();
    expect(rechargeApresLeTir(tir('moi'), 'moi', 'tactique')).toBeUndefined();
  });
});

describe("les sons de l'Evade (etape 7.9)", () => {
  it('fait entendre son apparition a tous, et sa capture a qui l attrape seulement', () => {
    expect(sonDuFait(fait('evade', { quoi: 'apparu' }, 0), 'moi')).toBe('compteAReboursFinal');
    expect(
      sonDuFait(fait('evade', { quoi: 'attrape', par: 'moi', parPseudo: 'Moi' }, 0), 'moi'),
    ).toBe('joueurCapture');
    expect(
      sonDuFait(fait('evade', { quoi: 'attrape', par: 'bob', parPseudo: 'Bob' }, 0), 'moi'),
    ).toBeUndefined();
    expect(sonDuFait(fait('evade', { quoi: 'enfui' }, 0), 'moi')).toBeUndefined();
  });
});

describe('les sons de la fumee (etape 7.10)', () => {
  it('fait entendre la fumee empochee comme un bonus, et le nuage a tous', () => {
    expect(sonDuFait(fait('objetEmpoche', { nature: 'fumee' }, 0), 'moi')).toBe('bonusRamasse');

    const nuage = { depart: { x: 1, y: 2 }, arrivee: { x: 900, y: 700 } };
    expect(sonDuFait(fait('fumee', { joueur: 'moi', ...nuage }, 0), 'moi')).toBe('fumee');
    expect(sonDuFait(fait('fumee', { joueur: 'bob', ...nuage }, 0), 'moi')).toBe('fumee');
    expect(SONS.fumee).toBeDefined();
  });
});

describe('les sons de la mine (etape 7.11)', () => {
  it('a un son a elle pour sa pose, son armement et son explosion', () => {
    const mine = { mine: 'm', x: 0, y: 0 };

    expect(sonDuFait(fait('minePosee', mine, 0), 'moi')).toBe('minePosee');
    expect(sonDuFait(fait('mineArmee', { ...mine, poseur: 'bob', par: 'moi' }, 0), 'moi')).toBe(
      'mineArmee',
    );
    expect(
      sonDuFait(
        fait(
          'mineExplosee',
          { ...mine, poseur: 'bob', touches: [], botsNoirsTues: 0, botsTues: 0, points: 0 },
          0,
        ),
        'moi',
      ),
    ).toBe('mineExplosee');
    expect([SONS.minePosee, SONS.mineArmee, SONS.mineExplosee]).toHaveLength(3);
  });
});

describe('les sons de la mine de zone (etape 7.12)', () => {
  const faitDe = (quoi: 'posee' | 'armee' | 'ouverte'): FaitDeJeu =>
    fait('mineDeZone', { quoi, mine: 'mz', nature: 'chaos', x: 0, y: 0 }, 0);

  it('se tait a la pose, et sonne a l armement et a l ouverture, chez tous', () => {
    expect(sonDuFait(faitDe('posee'), 'moi')).toBeUndefined();
    expect(sonDuFait(faitDe('armee'), 'moi')).toBe('mineDeZoneArmee');
    expect(sonDuFait(faitDe('ouverte'), 'moi')).toBe('zoneOuverte');
    expect([SONS.mineDeZoneArmee, SONS.zoneOuverte]).toHaveLength(2);
  });
});
