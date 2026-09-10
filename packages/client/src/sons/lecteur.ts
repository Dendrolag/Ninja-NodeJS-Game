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
 * L'AUTORISATION DU NAVIGATEUR. Aucun navigateur ne laisse une page emettre du
 * son avant que l'utilisateur n'ait interagi avec elle. Le lecteur ne se bat pas
 * contre cette regle: il tente, et il ignore le refus. Un son perdu au tout debut
 * d'une partie ne vaut pas une gestion d'erreur bruyante.
 */

import type { NomDeSon, TypeBonus } from '@neon-ninja/shared';
import {
  MUSIQUE_DE_JEU,
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
  /** Demarre la musique de partie. */
  demarrerLaMusique(): void;
  /** Arrete la musique de partie. */
  arreterLaMusique(): void;
  /** Coupe tout: boucles, musique, sons en cours. */
  toutArreter(): void;
  /** Change le volume des effets, de zero a un. */
  reglerLeVolumeDesSons(volume: number): void;
  /** Change le volume de la musique, de zero a un. */
  reglerLeVolumeDeLaMusique(volume: number): void;
  /** Coupe ou retablit tout le son. */
  couperLeSon(coupe: boolean): void;
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
}

/** Intervalle entre deux bruits de pas, en millisecondes. Valeurs du jeu d'origine. */
const INTERVALLE_PAS_MS = { normal: 250, presse: 200 } as const;

/** Volume des boucles de bonus: elles accompagnent, elles ne couvrent pas. */
const VOLUME_BOUCLE = 0.2;

/** Cree un lecteur de sons. */
export function creerLecteurDeSons(options: OptionsLecteur = {}): LecteurDeSons {
  const fabriquer = options.creerAudio ?? ((adresse: string) => new Audio(adresse));

  let volumeSons = options.volumeSons ?? 0.9;
  let volumeMusique = options.volumeMusique ?? 0.7;
  let coupe = false;
  let dernierPas = 0;
  /** Compteur des pas, pour alterner les quatre bruits sans tirer au sort. */
  let numeroDePas = 0;

  const ponctuels = new Map<NomDeSon, HTMLAudioElement>();
  const pas: HTMLAudioElement[] = [];
  const boucles = new Map<TypeBonus, HTMLAudioElement>();
  let musique: HTMLAudioElement | undefined;

  /** Fabrique un element audio pour un fichier de ressource. */
  const audioDe = (fichier: string): HTMLAudioElement =>
    fabriquer(`${RACINE_RESSOURCES}/${cheminSon(fichier)}`);

  for (const [nom, fichier] of Object.entries(SONS) as [NomDeSon, string][]) {
    const audio = audioDe(fichier);
    audio.volume = volumeSons;
    ponctuels.set(nom, audio);
  }

  for (const fichier of SONS_DE_PAS) {
    const audio = audioDe(fichier);
    audio.volume = volumeSons;
    pas.push(audio);
  }

  for (const [bonus, fichier] of Object.entries(SONS_EN_BOUCLE) as [TypeBonus, string][]) {
    const audio = audioDe(fichier);
    audio.loop = true;
    audio.volume = VOLUME_BOUCLE;
    boucles.set(bonus, audio);
  }

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

    demarrerLaMusique() {
      musique ??= audioDe(MUSIQUE_DE_JEU);
      musique.loop = true;
      musique.volume = volumeMusique;

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

      for (const audio of [...ponctuels.values(), ...pas]) {
        audio.volume = volumeSons;
      }
    },

    reglerLeVolumeDeLaMusique(volume) {
      volumeMusique = borner(volume);

      if (musique !== undefined) {
        musique.volume = volumeMusique;
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
