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
 * sur un iPhone. Le son passe donc par des noeuds de gain, un pour les effets, un
 * pour les boucles de bonus, un pour la musique, et c'est le gain qui regle le
 * volume.
 *
 * LES EFFETS SONT DES TAMPONS DECODES, PAS DES ELEMENTS AUDIO (etape 5.12). Jusque-la,
 * chaque effet etait un element audio branche sur Web Audio, relance en le ramenant au
 * debut. Sous WebKit, un element audio est un lecteur multimedia complet, et le
 * ramener au debut se paie sur le fil de la page: sur un iPhone, en Tactique, les pas
 * et les tirs faisaient tomber la page de 60 a moins de 10 images par seconde. Chaque
 * fichier d'effet est donc decode une fois en tampon, et chaque lecture est une source
 * neuve, qui ne coute presque rien. La musique, longue et lue d'une traite, reste un
 * element audio: la decoder occuperait des dizaines de megaoctets.
 *
 * Sans Web Audio (les tests, un tres vieux navigateur), le lecteur joue les effets par
 * des elements audio et regle le volume des elements, comme avant.
 *
 * L'AUTORISATION DU NAVIGATEUR. Aucun navigateur ne laisse une page emettre du
 * son avant que l'utilisateur n'ait interagi avec elle. Le lecteur ne se bat pas
 * contre cette regle: il tente, et il ignore le refus. Un son perdu au tout debut
 * d'une partie ne vaut pas une gestion d'erreur bruyante.
 */

import type { NomDeSon, PisteMusicale, TypeBonus } from '@neon-ninja/shared';
import {
  MUSIQUES,
  MUSIQUES_DE_PARTIE,
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
   * pendant un geste (un toucher, une touche). Sans effet s'il tourne deja. Le premier
   * appel lance aussi le chargement des effets (etape 5.12).
   */
  deverrouiller(): void;
  /** Ou en est le son, pour le releve de performance (etape 5.12). */
  etat(): EtatDuLecteur;
}

/** Ou en est le son: ce que le releve de performance en ecrit (etape 5.12). */
export interface EtatDuLecteur {
  /** Tout le son est coupe, par le panneau du son. */
  readonly coupe: boolean;
  /** Volume des effets, de zero a un. */
  readonly volumeSons: number;
  /** Volume de la musique, de zero a un. */
  readonly volumeMusique: number;
  /** La musique peut-elle jouer: non sous la variante du releve qui la retire. */
  readonly musique: boolean;
  /**
   * Par ou passent les effets, et ou en est leur chargement. Sans Web Audio, ce sont des
   * elements audio, qui se chargent seuls.
   */
  readonly voie:
    | { readonly nature: 'elements' }
    | {
        readonly nature: 'web audio';
        /** L'etat du contexte: « running » quand il joue. */
        readonly contexte: string;
        /** Les fichiers d'effets decodes, prets a jouer. */
        readonly prets: number;
        /** Les fichiers d'effets en tout. */
        readonly fichiers: number;
      };
}

/** Ce qu'il faut pour construire un lecteur de sons. */
export interface OptionsLecteur {
  /** Volume des effets, de zero a un. */
  readonly volumeSons?: number;
  /** Volume de la musique, de zero a un. */
  readonly volumeMusique?: number;
  /**
   * La musique peut-elle jouer. Faux sous la variante `musique=0` du releve, qui la
   * retire seule, pour departager la musique et les effets (etape 5.12).
   */
  readonly musique?: boolean;
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
  /**
   * Comment lire le contenu d'un fichier d'effet, pour le decoder (etape 5.12).
   *
   * Injectable pour les tests. En production, une requete du navigateur.
   */
  readonly chargerFichier?: (adresse: string) => Promise<ArrayBuffer>;
}

/** Intervalle entre deux bruits de pas, en millisecondes. Valeurs du jeu d'origine. */
const INTERVALLE_PAS_MS = { normal: 250, presse: 200 } as const;

/**
 * Volume des boucles de bonus, en part du volume des effets: elles accompagnent,
 * elles ne couvrent pas. Elles suivent le reglage des effets depuis l'etape 5.5:
 * avant, les effets coupes a zero laissaient les boucles tourner.
 */
const VOLUME_BOUCLE = 0.2;

/**
 * Volume d'une musique de partie, en part du volume de la musique (decision du porteur
 * du projet du 4 octobre 2026): elle accompagne le jeu, elle ne couvre pas ses bruitages.
 * La musique des menus, elle, joue au volume choisi.
 */
const VOLUME_MUSIQUE_DE_PARTIE = 0.5;

/** La part du volume de la musique a laquelle joue une piste. */
function partDuVolume(piste: PisteMusicale | undefined): number {
  return MUSIQUES_DE_PARTIE.some((musique) => musique === piste) ? VOLUME_MUSIQUE_DE_PARTIE : 1;
}

/** Le contexte Web Audio du navigateur, s'il en a un. */
function contexteDuNavigateur(): AudioContext | undefined {
  return typeof AudioContext === 'undefined' ? undefined : new AudioContext();
}

/** Le contenu d'un fichier, lu par le navigateur. */
async function fichierDuNavigateur(adresse: string): Promise<ArrayBuffer> {
  const reponse = await fetch(adresse);

  if (!reponse.ok) {
    throw new Error(`${adresse}: ${String(reponse.status)}`);
  }

  return reponse.arrayBuffer();
}

/**
 * Un effet sonore: un fichier, et la voix qui le joue.
 *
 * Une voix ne joue qu'une lecture a la fois: relancer un effet coupe sa lecture
 * precedente, comme le faisait l'element audio qu'on ramenait au debut.
 */
interface Effet {
  readonly voix: string;
  readonly fichier: string;
  /** Une boucle de bonus: elle tourne jusqu'a ce qu'on l'arrete, sur son propre canal. */
  readonly boucle: boolean;
}

/** Tous les effets du jeu: les sons ponctuels, les pas et les boucles de bonus. */
const EFFETS: readonly Effet[] = [
  ...Object.entries(SONS).map(([nom, fichier]) => ({
    voix: voixDuSon(nom as NomDeSon),
    fichier,
    boucle: false,
  })),
  ...SONS_DE_PAS.map((fichier, rang) => ({ voix: voixDuPas(rang), fichier, boucle: false })),
  ...(Object.entries(SONS_EN_BOUCLE) as [TypeBonus, string][]).map(([bonus, fichier]) => ({
    voix: voixDeLaBoucle(bonus),
    fichier,
    boucle: true,
  })),
];

function voixDuSon(nom: NomDeSon): string {
  return `son:${nom}`;
}

function voixDuPas(rang: number): string {
  return `pas:${String(rang)}`;
}

function voixDeLaBoucle(bonus: TypeBonus): string {
  return `boucle:${bonus}`;
}

/** L'adresse d'un fichier de son. */
function adresseDuSon(fichier: string): string {
  return `${RACINE_RESSOURCES}/${cheminSon(fichier)}`;
}

/** Ce qui joue les effets, par des tampons decodes ou par des elements audio. */
interface Effets {
  /** Joue un effet depuis son debut, en coupant sa lecture precedente. */
  jouer(voix: string): void;
  /** Demarre une boucle, si elle ne tourne pas deja. */
  demarrer(voix: string): void;
  /** Arrete un effet en cours. */
  arreter(voix: string): void;
  /** Arrete tous les effets en cours. */
  toutArreter(): void;
  /** Change le volume des effets ponctuels et des pas. */
  reglerLesSons(volume: number): void;
  /** Change le volume des boucles de bonus. */
  reglerLesBoucles(volume: number): void;
  /** Lance le chargement des effets, au premier deblocage. */
  charger(): void;
  /** Ou en sont les effets, pour le releve. */
  voie(): EtatDuLecteur['voie'];
}

/**
 * Les effets joues par des tampons decodes, sur Web Audio (etape 5.12).
 *
 * Une lecture est une source de tampon neuve, branchee sur le gain de son canal: le
 * navigateur la cree et la lance sans rien chercher dans un fichier. Un effet dont le
 * fichier n'est pas encore decode, ou n'a pas pu l'etre, se tait.
 */
function effetsParTampons(
  contexte: AudioContext,
  volumes: { readonly sons: number; readonly boucles: number },
  chargerFichier: (adresse: string) => Promise<ArrayBuffer>,
): Effets {
  const gainSons = gainBranche(contexte, volumes.sons);
  const gainBoucles = gainBranche(contexte, volumes.boucles);
  const effets = new Map(EFFETS.map((effet) => [effet.voix, effet]));
  const fichiers = [...new Set(EFFETS.map((effet) => effet.fichier))];
  /** Les fichiers decodes, par nom de fichier. */
  const tampons = new Map<string, AudioBuffer>();
  /** La lecture en cours de chaque voix. */
  const lectures = new Map<string, AudioBufferSourceNode>();
  let chargementLance = false;

  const lancer = (voix: string): void => {
    const effet = effets.get(voix);
    const tampon = effet === undefined ? undefined : tampons.get(effet.fichier);

    // Un contexte suspendu garderait la lecture pour sa reprise: tous les effets
    // demandes d'ici la partiraient alors ensemble. Un effet qui ne peut pas jouer
    // maintenant se tait.
    if (effet === undefined || tampon === undefined || contexte.state !== 'running') {
      return;
    }

    const source = contexte.createBufferSource();
    source.buffer = tampon;
    source.loop = effet.boucle;
    source.connect(effet.boucle ? gainBoucles : gainSons);
    source.start();
    lectures.set(voix, source);
  };

  const arreter = (voix: string): void => {
    const source = lectures.get(voix);

    if (source !== undefined) {
      lectures.delete(voix);
      source.stop();
    }
  };

  return {
    jouer(voix) {
      arreter(voix);
      lancer(voix);
    },

    demarrer(voix) {
      if (!lectures.has(voix)) {
        lancer(voix);
      }
    },

    arreter,

    toutArreter() {
      for (const voix of [...lectures.keys()]) {
        arreter(voix);
      }
    },

    reglerLesSons(volume) {
      gainSons.gain.value = volume;
    },

    reglerLesBoucles(volume) {
      gainBoucles.gain.value = volume;
    },

    charger() {
      if (chargementLance) {
        return;
      }

      chargementLance = true;

      // Chaque fichier pour son compte: un fichier qui manque ou ne se decode pas ne
      // fait taire que ses effets.
      for (const fichier of fichiers) {
        chargerFichier(adresseDuSon(fichier))
          .then(async (contenu) => contexte.decodeAudioData(contenu))
          .then((tampon) => {
            tampons.set(fichier, tampon);
          })
          .catch(() => undefined);
      }
    },

    voie() {
      return {
        nature: 'web audio',
        contexte: contexte.state,
        prets: tampons.size,
        fichiers: fichiers.length,
      };
    },
  };
}

/** Les effets joues par des elements audio, faute de Web Audio. */
function effetsParElements(
  fabriquer: (adresse: string) => HTMLAudioElement,
  volumes: { readonly sons: number; readonly boucles: number },
): Effets {
  const sons = canalDElements(volumes.sons);
  const boucles = canalDElements(volumes.boucles);
  const elements = new Map<string, HTMLAudioElement>();

  for (const effet of EFFETS) {
    const audio = fabriquer(adresseDuSon(effet.fichier));
    audio.loop = effet.boucle;
    (effet.boucle ? boucles : sons).brancher(audio);
    elements.set(effet.voix, audio);
  }

  return {
    jouer(voix) {
      relancer(elements.get(voix));
    },

    demarrer(voix) {
      const audio = elements.get(voix);

      if (audio?.paused === true) {
        void audio.play().catch(() => undefined);
      }
    },

    arreter(voix) {
      arreterLElement(elements.get(voix));
    },

    toutArreter() {
      for (const audio of elements.values()) {
        arreterLElement(audio);
      }
    },

    reglerLesSons: sons.regler,
    reglerLesBoucles: boucles.regler,

    // Un element audio se charge de lui-meme.
    charger: () => undefined,

    voie: () => ({ nature: 'elements' }),
  };
}

/** Un noeud de gain branche sur le haut-parleur. */
function gainBranche(contexte: AudioContext, volume: number): GainNode {
  const gain = contexte.createGain();
  gain.gain.value = volume;
  gain.connect(contexte.destination);
  return gain;
}

/** Un canal de volume: un noeud de gain, ou a defaut le volume des elements. */
interface Canal {
  brancher(audio: HTMLAudioElement): void;
  regler(volume: number): void;
}

/** Un canal qui regle le volume de ses elements, faute de Web Audio. */
function canalDElements(volume: number): Canal {
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

/** Le canal de la musique, sur le contexte s'il y en a un. */
function canalDeMusique(contexte: AudioContext | undefined, volume: number): Canal {
  if (contexte === undefined) {
    return canalDElements(volume);
  }

  const gain = gainBranche(contexte, volume);

  return {
    brancher(audio) {
      contexte.createMediaElementSource(audio).connect(gain);
    },
    regler(nouveau) {
      gain.gain.value = nouveau;
    },
  };
}

/**
 * Relance un element depuis son debut, en ignorant un refus du navigateur.
 *
 * play rend une promesse rejetee tant que l'utilisateur n'a pas interagi avec
 * la page. Ce n'est pas une panne, c'est la regle: on n'en fait pas un incident.
 */
function relancer(audio: HTMLAudioElement | undefined): void {
  if (audio === undefined) {
    return;
  }

  audio.currentTime = 0;
  void audio.play().catch(() => undefined);
}

function arreterLElement(audio: HTMLAudioElement | undefined): void {
  if (audio === undefined) {
    return;
  }

  audio.pause();
  audio.currentTime = 0;
}

/** Cree un lecteur de sons. */
export function creerLecteurDeSons(options: OptionsLecteur = {}): LecteurDeSons {
  const fabriquer = options.creerAudio ?? ((adresse: string) => new Audio(adresse));
  const contexte = (options.creerContexte ?? contexteDuNavigateur)();
  const musiquePermise = options.musique ?? true;

  let volumeSons = options.volumeSons ?? 0.9;
  let volumeMusique = options.volumeMusique ?? 0.7;
  let coupe = false;
  let dernierPas = 0;
  /** Compteur des pas, pour alterner les quatre bruits sans tirer au sort. */
  let numeroDePas = 0;

  /** Les musiques deja fabriquees, pour ne pas recharger un fichier a chaque ecran. */
  const musiques = new Map<PisteMusicale, HTMLAudioElement>();
  let musique: HTMLAudioElement | undefined;
  let pisteEnCours: PisteMusicale | undefined;

  const volumes = { sons: volumeSons, boucles: volumeSons * VOLUME_BOUCLE };
  const effets =
    contexte === undefined
      ? effetsParElements(fabriquer, volumes)
      : effetsParTampons(contexte, volumes, options.chargerFichier ?? fichierDuNavigateur);
  const canalMusique = canalDeMusique(contexte, volumeMusique);

  /** Fabrique l'element d'une musique, branche sur son canal, une fois pour toutes. */
  const nouvelleMusique = (piste: PisteMusicale): HTMLAudioElement => {
    const audio = fabriquer(adresseDuSon(MUSIQUES[piste]));
    canalMusique.brancher(audio);
    musiques.set(piste, audio);
    return audio;
  };

  return {
    jouer(nom) {
      if (!coupe) {
        effets.jouer(voixDuSon(nom));
      }
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
      numeroDePas = (numeroDePas + 1) % SONS_DE_PAS.length;

      if (!coupe) {
        effets.jouer(voixDuPas(numeroDePas));
      }
    },

    demarrerLaBoucle(bonus) {
      if (!coupe) {
        effets.demarrer(voixDeLaBoucle(bonus));
      }
    },

    arreterLaBoucle(bonus) {
      effets.arreter(voixDeLaBoucle(bonus));
    },

    demarrerLaMusique(piste) {
      if (!musiquePermise) {
        return;
      }

      // Changer de piste arrete la precedente; redemander la meme la laisse
      // continuer, sans la reprendre du debut.
      if (pisteEnCours !== piste) {
        arreterLElement(musique);
        musique = musiques.get(piste) ?? nouvelleMusique(piste);
        pisteEnCours = piste;
        // Une seule musique joue a la fois: le canal prend le volume de celle-ci.
        canalMusique.regler(volumeMusique * partDuVolume(piste));
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
      arreterLElement(musique);
    },

    toutArreter() {
      effets.toutArreter();
      arreterLElement(musique);
    },

    reglerLeVolumeDesSons(volume) {
      volumeSons = borner(volume);
      effets.reglerLesSons(volumeSons);
      effets.reglerLesBoucles(volumeSons * VOLUME_BOUCLE);
    },

    reglerLeVolumeDeLaMusique(volume) {
      volumeMusique = borner(volume);
      canalMusique.regler(volumeMusique * partDuVolume(pisteEnCours));
    },

    deverrouiller() {
      if (contexte?.state === 'suspended') {
        void contexte.resume().catch(() => undefined);
      }

      effets.charger();
    },

    couperLeSon(couper) {
      coupe = couper;

      if (coupe) {
        this.toutArreter();
      }
    },

    etat() {
      return {
        coupe,
        volumeSons,
        volumeMusique,
        musique: musiquePermise,
        voie: effets.voie(),
      };
    },
  };
}

/** Ramene un volume entre zero et un. */
function borner(volume: number): number {
  return Math.min(Math.max(volume, 0), 1);
}
