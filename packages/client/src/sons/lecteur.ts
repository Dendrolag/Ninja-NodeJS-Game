/**
 * Le lecteur de sons: la seule partie du client qui parle au haut-parleur.
 *
 * Portage de legacy/js/AudioManager.js, avec quatre differences de fond.
 *
 * 1. LES SONS SONT NOMMES PAR CE QU'ILS SIGNIFIENT, dans un type. Le jeu
 *    d'origine les indexait par des chaines libres et en demandait quatre qui
 *    n'existaient pas: ces sons-la n'ont jamais ete entendus, sans qu'aucune
 *    erreur ne le signale. Ici un nom inconnu ne compile pas.
 *
 * 2. UN SON QUI NE SE CHARGE PAS N'EMPECHE PAS LES AUTRES. Le jeu d'origine
 *    attendait le chargement de tous ses fichiers d'un bloc; comme l'un d'eux
 *    n'existait pas, l'attente echouait toujours et son indicateur « pret »
 *    restait faux pour toujours. Ici chaque son se charge pour son compte, et le
 *    jeu commence sans attendre le son.
 *
 * 3. AUCUN ETAT GLOBAL. C'est une instance, comme tout le reste du client. Deux
 *    lecteurs peuvent cohabiter dans un meme processus, ce dont les tests
 *    profitent.
 *
 * 4. LE SON NE PASSE PLUS PAR LE SERVEUR. Le jeu d'origine avait trois evenements
 *    reseau dedies au son, y compris pour transmettre le volume choisi par un
 *    joueur. Le volume est un reglage local; il n'a rien a faire sur le reseau.
 *
 * LE VOLUME PASSE PAR WEB AUDIO (etape 5.5). Sous iOS, tous les navigateurs sont
 * WebKit, qui ignore le volume d'un element audio: les curseurs ne faisaient rien
 * sur un iPhone. Chaque element est donc branche sur un noeud de gain, un pour les
 * effets, un pour les boucles de bonus, un pour la musique, et c'est le gain qui
 * regle le volume. Sans Web Audio (les tests, un tres vieux navigateur), le
 * lecteur regle le volume des elements, comme avant.
 *
 * L'AUTORISATION DU NAVIGATEUR. Aucun navigateur ne laisse une page emettre du
 * son avant que l'utilisateur n'ait interagi avec elle. Le lecteur ne se bat pas
 * contre cette regle: il tente, et il ignore le refus. Un son perdu au tout debut
 * d'une partie ne vaut pas une gestion d'erreur bruyante.
 */

import type { NomDeSon, PisteMusicale, TypeBonus } from '@neon-ninja/shared';
import {
  MUSIQUES,
  RACINE_RESSOURCES,
  SONS,
  SONS_DE_PAS,
  SONS_EN_BOUCLE,
  cheminSon,
} from '@neon-ninja/shared';

/** Ce qu'un lecteur de sons sait faire. */
export interface LecteurDeSons {
  /** Joue un son ponctuel. */
  jouer(nom: NomDeSon): void;
  /** Joue un bruit de pas, en respectant l'intervalle entre deux foulees. */
  jouerUnPas(maintenant: number, presse: boolean): void;
  /** Demarre la boucle sonore d'un bonus, si elle ne tourne pas deja. */
  demarrerLaBoucle(bonus: TypeBonus): void;
  /** Arrete la boucle sonore d'un bonus. */
  arreterLaBoucle(bonus: TypeBonus): void;
  /**
   * Fait jouer une musique, et arrete l'autre.
   *
   * Une seule musique a la fois: celle des menus s'arrete quand la partie
   * commence, et reprend quand on revient au salon ou a la fin.
   */
  demarrerLaMusique(piste: PisteMusicale): void;
  /** Arrete la musique en cours. */
  arreterLaMusique(): void;
  /** Coupe tout: boucles, musique, sons en cours. */
  toutArreter(): void;
  /** Change le volume des effets, de zero a un. */
  reglerLeVolumeDesSons(volume: number): void;
  /** Change le volume de la musique, de zero a un. */
  reglerLeVolumeDeLaMusique(volume: number): void;
  /** Coupe ou retablit tout le son. */
  couperLeSon(coupe: boolean): void;
  /**
   * Debloque le son, a appeler sur un geste du joueur.
   *
   * Un contexte Web Audio nait suspendu, et le navigateur ne le laisse repartir que
   * pendant un geste (un toucher, une touche). Sans effet s'il tourne deja.
   */
  deverrouiller(): void;
}

/** Ce qu'il faut pour construire un lecteur de sons. */
export interface OptionsLecteur {
  /** Volume des effets, de zero a un. */
  readonly volumeSons?: number;
  /** Volume de la musique, de zero a un. */
  readonly volumeMusique?: number;
  /**
   * Comment fabriquer un element audio a partir d'une adresse.
   *
   * Injectable pour les tests, qui n'ont pas de navigateur. En production, c'est
   * le constructeur Audio du navigateur.
   */
  readonly creerAudio?: (adresse: string) => HTMLAudioElement;
  /**
   * Comment obtenir un contexte Web Audio, ou rien s'il n'y en a pas.
   *
   * Injectable pour les tests. En production, un AudioContext du navigateur, s'il
   * existe.
   */
  readonly creerContexte?: () => AudioContext | undefined;
}

/** Intervalle entre deux bruits de pas, en millisecondes. Valeurs du jeu d'origine. */
const INTERVALLE_PAS_MS = { normal: 250, presse: 200 } as const;

/**
 * Volume des boucles de bonus, en part du volume des effets: elles accompagnent,
 * elles ne couvrent pas. Elles suivent le reglage des effets depuis l'etape 5.5:
 * avant, les effets coupes a zero laissaient les boucles tourner.
 */
const VOLUME_BOUCLE = 0.2;

/** Le contexte Web Audio du navigateur, s'il en a un. */
function contexteDuNavigateur(): AudioContext | undefined {
  return typeof AudioContext === 'undefined' ? undefined : new AudioContext();
}

/** Un canal de volume: un noeud de gain, ou a defaut le volume des elements. */
interface Canal {
  brancher(audio: HTMLAudioElement): void;
  regler(volume: number): void;
}

/** Cree un canal de volume, sur le contexte s'il y en a un. */
function creerCanal(contexte: AudioContext | undefined, volume: number): Canal {
  if (contexte === undefined) {
    const elements: HTMLAudioElement[] = [];
    let courant = volume;
    return {
      brancher(audio) {
        audio.volume = courant;
        elements.push(audio);
      },
      regler(nouveau) {
        courant = nouveau;
        for (const audio of elements) {
          audio.volume = nouveau;
        }
      },
    };
  }

  const gain = contexte.createGain();
  gain.gain.value = volume;
  gain.connect(contexte.destination);

  return {
    brancher(audio) {
      contexte.createMediaElementSource(audio).connect(gain);
    },
    regler(nouveau) {
      gain.gain.value = nouveau;
    },
  };
}

/** Cree un lecteur de sons. */
export function creerLecteurDeSons(options: OptionsLecteur = {}): LecteurDeSons {
  const fabriquer = options.creerAudio ?? ((adresse: string) => new Audio(adresse));
  const contexte = (options.creerContexte ?? contexteDuNavigateur)();

  let volumeSons = options.volumeSons ?? 0.9;
  let volumeMusique = options.volumeMusique ?? 0.7;
  let coupe = false;
  let dernierPas = 0;
  /** Compteur des pas, pour alterner les quatre bruits sans tirer au sort. */
  let numeroDePas = 0;

  const ponctuels = new Map<NomDeSon, HTMLAudioElement>();
  const pas: HTMLAudioElement[] = [];
  const boucles = new Map<TypeBonus, HTMLAudioElement>();
  /** Les musiques deja fabriquees, pour ne pas recharger un fichier a chaque ecran. */
  const musiques = new Map<PisteMusicale, HTMLAudioElement>();
  let musique: HTMLAudioElement | undefined;
  let pisteEnCours: PisteMusicale | undefined;

  /** Fabrique un element audio pour un fichier de ressource. */
  const audioDe = (fichier: string): HTMLAudioElement =>
    fabriquer(`${RACINE_RESSOURCES}/${cheminSon(fichier)}`);

  const canalSons = creerCanal(contexte, volumeSons);
  const canalBoucles = creerCanal(contexte, volumeSons * VOLUME_BOUCLE);
  const canalMusique = creerCanal(contexte, volumeMusique);

  for (const [nom, fichier] of Object.entries(SONS) as [NomDeSon, string][]) {
    const audio = audioDe(fichier);
    canalSons.brancher(audio);
    ponctuels.set(nom, audio);
  }

  for (const fichier of SONS_DE_PAS) {
    const audio = audioDe(fichier);
    canalSons.brancher(audio);
    pas.push(audio);
  }

  for (const [bonus, fichier] of Object.entries(SONS_EN_BOUCLE) as [TypeBonus, string][]) {
    const audio = audioDe(fichier);
    audio.loop = true;
    canalBoucles.brancher(audio);
    boucles.set(bonus, audio);
  }

  /** Fabrique l'element d'une musique, branche sur son canal, une fois pour toutes. */
  const nouvelleMusique = (piste: PisteMusicale): HTMLAudioElement => {
    const audio = audioDe(MUSIQUES[piste]);
    canalMusique.brancher(audio);
    musiques.set(piste, audio);
    return audio;
  };

  /**
   * Lance la lecture en ignorant un refus du navigateur.
   *
   * play rend une promesse rejetee tant que l'utilisateur n'a pas interagi avec
   * la page. Ce n'est pas une panne, c'est la regle: on n'en fait pas un incident.
   */
  const lancer = (audio: HTMLAudioElement | undefined): void => {
    if (audio === undefined || coupe) {
      return;
    }

    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
  };

  const arreter = (audio: HTMLAudioElement | undefined): void => {
    if (audio === undefined) {
      return;
    }

    audio.pause();
    audio.currentTime = 0;
  };

  return {
    jouer(nom) {
      lancer(ponctuels.get(nom));
    },

    jouerUnPas(maintenant, presse) {
      const intervalle = presse ? INTERVALLE_PAS_MS.presse : INTERVALLE_PAS_MS.normal;

      if (maintenant - dernierPas < intervalle) {
        return;
      }

      dernierPas = maintenant;
      // Les quatre bruits tournent dans l'ordre plutot qu'au hasard: le resultat
      // s'entend pareil, et le client ne tire aucun nombre au sort, ce qui le
      // rend reproductible d'un essai a l'autre.
      numeroDePas = (numeroDePas + 1) % pas.length;
      lancer(pas[numeroDePas]);
    },

    demarrerLaBoucle(bonus) {
      const audio = boucles.get(bonus);

      if (audio === undefined || coupe || !audio.paused) {
        return;
      }

      void audio.play().catch(() => undefined);
    },

    arreterLaBoucle(bonus) {
      arreter(boucles.get(bonus));
    },

    demarrerLaMusique(piste) {
      // Changer de piste arrete la precedente; redemander la meme la laisse
      // continuer, sans la reprendre du debut.
      if (pisteEnCours !== piste) {
        arreter(musique);
        musique = musiques.get(piste) ?? nouvelleMusique(piste);
        pisteEnCours = piste;
      }

      if (musique === undefined) {
        return;
      }

      musique.loop = true;

      if (!coupe && musique.paused) {
        void musique.play().catch(() => undefined);
      }
    },

    arreterLaMusique() {
      arreter(musique);
    },

    toutArreter() {
      for (const audio of [...ponctuels.values(), ...pas, ...boucles.values()]) {
        arreter(audio);
      }

      arreter(musique);
    },

    reglerLeVolumeDesSons(volume) {
      volumeSons = borner(volume);
      canalSons.regler(volumeSons);
      canalBoucles.regler(volumeSons * VOLUME_BOUCLE);
    },

    reglerLeVolumeDeLaMusique(volume) {
      volumeMusique = borner(volume);
      canalMusique.regler(volumeMusique);
    },

    deverrouiller() {
      if (contexte?.state === 'suspended') {
        void contexte.resume().catch(() => undefined);
      }
    },

    couperLeSon(couper) {
      coupe = couper;

      if (coupe) {
        this.toutArreter();
      }
    },
  };
}

/** Ramene un volume entre zero et un. */
function borner(volume: number): number {
  return Math.min(Math.max(volume, 0), 1);
}
