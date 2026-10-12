/**
 * La surveillance de la fluidite des parties en production (etape 5.15).
 *
 * CE QU'ELLE FAIT. Elle compte, pour l'agent de la machine qui lit ses metriques toutes les
 * quinze secondes: les battements de chaque partie et leurs phases, les octets envoyes, la
 * file d'envoi de chaque connexion, le ramasse-miettes et la boucle d'evenements, et ce que
 * les pages disent de leur partie dans leur bulletin. Elle ecrit dans le journal chaque
 * episode, un battement lent ou une page qui saccade, avec son contexte, et toutes les dix
 * secondes une ligne par partie en cours, avec son verdict.
 *
 * CE QU'ELLE NE FAIT PAS. Elle n'envoie rien sur le reseau, et ne change rien au jeu: elle
 * n'est consultee par personne. Sans elle (pas de PORT_DES_METRIQUES), le serveur ne mesure
 * rien de plus qu'a l'etape 8.6.
 *
 * LE BATTEMENT NE PAIE QUE DES OPERATIONS DE COUT FIXE: quelques additions et le parcours
 * des bornes de deux ou trois histogrammes. Les series de chaque partie sont cherchees une
 * fois, a son premier battement, puis toutes les dix secondes; rien n'est alloue ensuite,
 * sauf pour ecrire un episode, au plus un par partie et par minute.
 */

import { monitorEventLoopDelay, PerformanceObserver } from 'node:perf_hooks';
import type { IntervalHistogram } from 'node:perf_hooks';

import type { BulletinDePage, DescriptionDeLAppareil, Mode } from '@neon-ninja/shared';
import {
  CASES_ALLER_RETOUR_MS,
  CASES_DUREE_D_IMAGE_MS,
  CASES_ECART_INSTANTANES_MS,
  ECART_MINIMAL_DES_BULLETINS_MS,
  INTERVALLE_DU_BULLETIN_MS,
  MODES,
  SEUIL_IMAGE_TRES_LENTE_MS,
  SEUIL_INSTANTANE_TRES_EN_RETARD_MS,
  TAILLE_MAXIMALE_DU_BULLETIN,
  lireLeBulletin,
  validerLAppareil,
} from '@neon-ninja/shared';

import type { GameRoom, ObservateurDuBattement } from '../GameRoom.js';
import type { Horloge } from '../horloge.js';
import { horlogeSysteme } from '../horloge.js';
import type { Compteur, Famille, Histogramme, Jauge } from '../metriques/registre.js';
import { Registre } from '../metriques/registre.js';
import type { Journal } from './journal.js';
import { PlafondDesEpisodes, journalSurLaSortie } from './journal.js';
import type { Verdict } from './verdict.js';
import { part, verdict } from './verdict.js';

/** L'ecart a partir duquel un battement est en retard, en millisecondes: deux battements. */
export const BATTEMENT_EN_RETARD_MS = 100;

/** La duree a partir de laquelle un battement fait un episode, en millisecondes. */
export const BATTEMENT_LENT_MS = 25;

/** Les tranches de charge, en nombre de PNJ: la duree du battement se lit par tranche. */
const TRANCHES_DE_CHARGE = [
  { jusqua: 50, nom: '0-50' },
  { jusqua: 150, nom: '51-150' },
  { jusqua: 300, nom: '151-300' },
  { jusqua: 600, nom: '301-600' },
  { jusqua: Number.POSITIVE_INFINITY, nom: '601+' },
] as const;

/** Les bornes des histogrammes du battement, en millisecondes. */
const BORNES_ECART_MS = [45, 50, 55, 60, 75, 100, 150, 250, 500, 1000];
const BORNES_DUREE_MS = [0.25, 0.5, 1, 2, 4, 8, 16, 25, 50, 100];
const BORNES_PHASE_MS = [0.05, 0.1, 0.25, 0.5, 1, 2, 4, 8, 16, 50];
const BORNES_TRAME_OCTETS = [128, 256, 512, 1024, 2048, 4096, 8192, 16384, 65536];
const BORNES_FILE_PAQUETS = [0, 1, 2, 4, 8, 16, 64];
const BORNES_FILE_OCTETS = [0, 1024, 4096, 16384, 65536, 262144, 1048576];
const BORNES_PAUSE_MS = [0.5, 1, 2, 5, 10, 25, 50, 100, 250];

/** Les phases d'un battement, dans l'ordre ou elles se jouent. */
type Phase = 'moteur' | 'vues' | 'codage' | 'envoi';

/** Les genres de pause du ramasse-miettes, selon Node. */
const GENRES_DE_PAUSE: Readonly<Record<number, string>> = {
  1: 'mineure',
  2: 'majeure',
  4: 'incrementale',
  8: 'faible',
};

/** Ce que la surveillance lit du serveur, a la demande. */
export interface SourcesDeLaSurveillance {
  /** Les parties ouvertes. */
  parties(): readonly GameRoom[];
  /** Le transport de chaque connexion ouverte: websocket, ou polling (requetes longues). */
  transports(): Iterable<string>;
}

/** Le joueur d'un bulletin, tel que la couche reseau le connait. */
export interface JoueurDuBulletin {
  readonly room: GameRoom;
  readonly pseudo: string;
}

/** Ce qu'il faut pour surveiller. */
export interface OptionsSurveillance {
  /** La version du jeu, etiquette de toutes les series. */
  readonly version?: string;
  /** L'horloge des durees. Celle du systeme par defaut. */
  readonly horloge?: Horloge;
  /** L'heure, pour dater le journal, en millisecondes depuis 1970. */
  readonly date?: () => number;
  /** Ou ecrire les episodes et les lignes des parties. La sortie standard par defaut. */
  readonly journal?: Journal;
  /**
   * Observer le ramasse-miettes et la boucle d'evenements, vrai par defaut. Les tests s'en
   * passent: ce sont des sondes du processus entier.
   */
  readonly processus?: boolean;
}

/** Les series d'un mode, cherchees une fois a la creation. */
interface SeriesDuMode {
  readonly battements: Compteur;
  readonly enRetard: Compteur;
  readonly ecart: Histogramme;
  readonly octets: Compteur;
  readonly trames: Compteur;
  readonly trameOctets: Histogramme;
  readonly imagesDesPages: Compteur;
  readonly imagesLentesDesPages: Compteur;
  readonly instantanesDesPages: Compteur;
  readonly instantanesEnRetardDesPages: Compteur;
}

/** Ce que la surveillance retient d'une partie entre deux lignes du journal. */
interface SuiviDePartie {
  readonly mode: SeriesDuMode;
  /** La duree du battement, pour le mode, la carte et la tranche de charge actuelles. */
  duree: Histogramme;
  pnj: number;
  joueurs: number;
  battements: number;
  enRetard: number;
  ecartMaxMs: number;
  dureeMaxMs: number;
  octets: number;
}

/** Les series des pages d'un genre d'appareil et d'une famille de navigateurs. */
interface SeriesDesPages {
  readonly images: Compteur;
  readonly lentes: Compteur;
  readonly tresLentes: Compteur;
  readonly cachees: Compteur;
  readonly tenues: Compteur;
  readonly duree: Histogramme;
  readonly notreCode: Compteur;
  readonly pixi: Compteur;
  readonly reste: Compteur;
  readonly instantanes: Compteur;
  readonly instantanesEnRetard: Compteur;
  readonly ecartInstantanes: Histogramme;
  readonly allerRetour: Histogramme;
}

/** Ce que la surveillance retient d'une connexion. */
interface SuiviDeConnexion {
  appareil: DescriptionDeLAppareil | undefined;
  series: SeriesDesPages;
  /** L'instant du dernier bulletin accepte. */
  dernierBulletin: number | undefined;
  /** Le dernier bulletin accepte, et sa partie, pour la ligne de la partie. */
  dernier:
    | { readonly room: GameRoom; readonly pseudo: string; readonly bulletin: BulletinDePage }
    | undefined;
}

/** Le genre d'appareil d'une connexion qui ne l'a pas encore dit. */
const APPAREIL_INCONNU = 'inconnu';

/** La surveillance d'un serveur de jeu. */
export class SurveillanceDuJeu implements ObservateurDuBattement {
  /** Le registre des metriques, ecrit par /metriques. */
  readonly registre: Registre;

  private readonly horloge: Horloge;
  private readonly date: () => number;
  private readonly journal: Journal;
  private readonly version: string;
  private readonly avecProcessus: boolean;
  private readonly demarrageS: number;
  private sources: SourcesDeLaSurveillance | undefined;

  private readonly plafond = new PlafondDesEpisodes();
  private readonly suivis = new WeakMap<GameRoom, SuiviDePartie>();
  private readonly connexions = new Map<string, SuiviDeConnexion>();

  /** Les phases de la diffusion du battement en cours, posees avant que le battement finisse. */
  private vuesMs = 0;
  private codageMs = 0;
  private envoiMs = 0;

  /** La derniere pause du ramasse-miettes: son genre, sa duree, son instant. */
  private dernierePause: { genre: string; dureeMs: number; instant: number } | undefined;
  private boucle: IntervalHistogram | undefined;
  private observateurDesPauses: PerformanceObserver | undefined;
  private arreterLesLignes: (() => void) | undefined;

  // Les familles.
  private readonly duree: Famille<Histogramme>;
  private readonly phases: Readonly<Record<Phase, Histogramme>>;
  private readonly seriesDesModes: ReadonlyMap<Mode, SeriesDuMode>;
  private readonly fileEnPaquets: Histogramme;
  private readonly fileEnOctets: Histogramme;
  private readonly reconnexions: Compteur;
  private readonly bulletins: Famille<Compteur>;
  private readonly episodes: Famille<Compteur>;
  private readonly episodesIgnores: Famille<Compteur>;
  private readonly pauses: Famille<Histogramme>;
  private readonly appareils: Famille<Compteur>;
  private readonly erreurs: Famille<Compteur>;
  private readonly famillesDesPages: {
    readonly images: Famille<Compteur>;
    readonly lentes: Famille<Compteur>;
    readonly cachees: Famille<Compteur>;
    readonly tenues: Famille<Compteur>;
    readonly duree: Famille<Histogramme>;
    readonly tempsDesLentes: Famille<Compteur>;
    readonly instantanes: Famille<Compteur>;
    readonly instantanesEnRetard: Famille<Compteur>;
    readonly ecartInstantanes: Famille<Histogramme>;
    readonly allerRetour: Famille<Histogramme>;
  };
  private readonly parties: Famille<Jauge>;
  private readonly joueurs: Famille<Jauge>;
  private readonly pnj: Famille<Jauge>;
  private readonly transports: Famille<Jauge>;
  private readonly boucleRetard: Famille<Jauge>;
  private readonly memoire: Famille<Jauge>;
  private readonly processeur: Famille<Compteur>;
  /** Le processeur lu a la lecture precedente, en microsecondes. */
  private processeurLu = { user: 0, system: 0 };

  constructor(options: OptionsSurveillance = {}) {
    this.horloge = options.horloge ?? horlogeSysteme;
    this.date = options.date ?? Date.now;
    this.journal = options.journal ?? journalSurLaSortie;
    this.avecProcessus = options.processus ?? true;
    this.demarrageS = Math.round(this.date() / 1000);
    this.version = options.version ?? 'developpement';
    this.registre = new Registre({ version: this.version });
    const r = this.registre;

    r.jauges('neon_demarrage_secondes', 'Instant du demarrage du serveur, en secondes depuis 1970.')
      .serie()
      .poser(this.demarrageS);

    const battements = r.compteurs('neon_battements_total', 'Battements joues.', ['mode']);
    const enRetard = r.compteurs(
      'neon_battements_en_retard_total',
      'Battements partis au moins 100 ms apres le precedent.',
      ['mode'],
    );
    const ecart = r.histogrammes(
      'neon_battement_ecart_ms',
      'Ecart reel entre deux battements d une partie, 50 ms attendus.',
      BORNES_ECART_MS,
      ['mode'],
    );
    this.duree = r.histogrammes(
      'neon_battement_duree_ms',
      'Duree d un battement: moteur, vues, codage et envoi.',
      BORNES_DUREE_MS,
      ['mode', 'carte', 'charge'],
    );
    const phases = r.histogrammes(
      'neon_battement_phase_ms',
      'Duree de chaque phase du battement.',
      BORNES_PHASE_MS,
      ['phase'],
    );
    this.phases = {
      moteur: phases.serie('moteur'),
      vues: phases.serie('vues'),
      codage: phases.serie('codage'),
      envoi: phases.serie('envoi'),
    };
    const octets = r.compteurs('neon_octets_envoyes_total', 'Octets des trames d etat envoyees.', [
      'mode',
    ]);
    const trames = r.compteurs('neon_trames_envoyees_total', 'Trames d etat codees.', ['mode']);
    const trameOctets = r.histogrammes(
      'neon_trame_octets',
      'Taille d une trame d etat.',
      BORNES_TRAME_OCTETS,
      ['mode'],
    );
    this.fileEnPaquets = r
      .histogrammes(
        'neon_file_d_envoi_paquets',
        'Paquets en attente sur une connexion, au moment de lui envoyer le battement.',
        BORNES_FILE_PAQUETS,
      )
      .serie();
    this.fileEnOctets = r
      .histogrammes(
        'neon_file_d_envoi_octets',
        'Octets en attente sur une connexion, au moment de lui envoyer le battement.',
        BORNES_FILE_OCTETS,
      )
      .serie();
    this.reconnexions = r
      .compteurs('neon_reconnexions_total', 'Joueurs revenus dans leur partie apres une coupure.')
      .serie();

    const pages = {
      images: r.compteurs(
        'neon_page_images_total',
        'Images jouees par les pages, onglet visible.',
        ['appareil', 'navigateur'],
      ),
      lentes: r.compteurs(
        'neon_page_images_lentes_total',
        'Images d au moins 50 ou 100 ms (seuil).',
        ['appareil', 'navigateur', 'seuil'],
      ),
      cachees: r.compteurs('neon_page_images_cachees_total', 'Images jouees onglet cache.', [
        'appareil',
        'navigateur',
      ]),
      tenues: r.compteurs(
        'neon_page_images_tenues_total',
        'Images ou le lissage attendait l instantane suivant.',
        ['appareil', 'navigateur'],
      ),
      duree: r.histogrammes(
        'neon_page_image_ms',
        'Duree d image dans les pages.',
        CASES_DUREE_D_IMAGE_MS,
        ['appareil', 'navigateur'],
      ),
      tempsDesLentes: r.compteurs(
        'neon_page_temps_des_images_lentes_ms_total',
        'Temps des images lentes: notre code, PixiJS, ou le reste.',
        ['appareil', 'navigateur', 'part'],
      ),
      instantanes: r.compteurs('neon_page_instantanes_total', 'Instantanes recus par les pages.', [
        'appareil',
        'navigateur',
      ]),
      instantanesEnRetard: r.compteurs(
        'neon_page_instantanes_en_retard_total',
        'Instantanes recus au moins 100 ms apres le precedent.',
        ['appareil', 'navigateur'],
      ),
      ecartInstantanes: r.histogrammes(
        'neon_page_ecart_instantanes_ms',
        'Ecart entre deux instantanes recus par une page.',
        CASES_ECART_INSTANTANES_MS,
        ['appareil', 'navigateur'],
      ),
      allerRetour: r.histogrammes(
        'neon_page_aller_retour_ms',
        'Aller et retour de la page au serveur.',
        CASES_ALLER_RETOUR_MS,
        ['appareil', 'navigateur'],
      ),
    };
    this.famillesDesPages = pages;

    const imagesParMode = r.compteurs('neon_page_images_par_mode_total', 'Images des pages.', [
      'mode',
    ]);
    const lentesParMode = r.compteurs(
      'neon_page_images_lentes_par_mode_total',
      'Images d au moins 50 ms des pages.',
      ['mode'],
    );
    const instantanesParMode = r.compteurs(
      'neon_page_instantanes_par_mode_total',
      'Instantanes recus par les pages.',
      ['mode'],
    );
    const enRetardParMode = r.compteurs(
      'neon_page_instantanes_en_retard_par_mode_total',
      'Instantanes recus en retard par les pages.',
      ['mode'],
    );

    this.seriesDesModes = new Map(
      MODES.map((mode) => [
        mode,
        {
          battements: battements.serie(mode),
          enRetard: enRetard.serie(mode),
          ecart: ecart.serie(mode),
          octets: octets.serie(mode),
          trames: trames.serie(mode),
          trameOctets: trameOctets.serie(mode),
          imagesDesPages: imagesParMode.serie(mode),
          imagesLentesDesPages: lentesParMode.serie(mode),
          instantanesDesPages: instantanesParMode.serie(mode),
          instantanesEnRetardDesPages: enRetardParMode.serie(mode),
        },
      ]),
    );

    this.appareils = r.compteurs(
      'neon_page_appareils_total',
      'Connexions qui ont joue, par appareil, navigateur et moteur de rendu.',
      ['appareil', 'navigateur', 'moteur'],
    );
    this.erreurs = r.compteurs('neon_page_erreurs_total', 'Erreurs des pages.', ['nature']);
    this.bulletins = r.compteurs('neon_bulletins_total', 'Bulletins des pages, par issue.', [
      'issue',
    ]);
    this.episodes = r.compteurs('neon_episodes_total', 'Episodes ecrits dans le journal.', [
      'origine',
    ]);
    this.episodesIgnores = r.compteurs(
      'neon_episodes_ignores_total',
      'Episodes non ecrits, au-dela du plafond.',
      ['origine'],
    );
    this.parties = r.jauges('neon_parties', 'Parties ouvertes.', ['mode', 'statut']);
    this.joueurs = r.jauges('neon_joueurs', 'Joueurs des parties en cours.', ['mode']);
    this.pnj = r.jauges('neon_pnj', 'PNJ des parties en cours.', ['mode']);
    this.transports = r.jauges('neon_connexions', 'Connexions ouvertes, par transport.', [
      'transport',
    ]);
    this.pauses = r.histogrammes(
      'neon_ramasse_miettes_pause_ms',
      'Pauses du ramasse-miettes.',
      BORNES_PAUSE_MS,
      ['genre'],
    );
    this.boucleRetard = r.jauges(
      'neon_boucle_retard_ms',
      'Retard de la boucle d evenements depuis la lecture precedente.',
      ['mesure'],
    );
    this.memoire = r.jauges('neon_memoire_octets', 'Memoire du processus.', ['nature']);
    this.processeur = r.compteurs(
      'neon_processeur_secondes_total',
      'Processeur consomme par le serveur, en secondes.',
      ['nature'],
    );
  }

  /** Ecrit une ligne au journal, datee et marquee de la version du jeu. */
  private ecrireAuJournal(ligne: Readonly<Record<string, unknown>>): void {
    this.journal.ecrire({
      instant: new Date(this.date()).toISOString(),
      version: this.version,
      ...ligne,
    });
  }

  /** Branche la surveillance sur le serveur: ce qu'elle lira a la demande. */
  brancher(sources: SourcesDeLaSurveillance): void {
    this.sources = sources;
  }

  /**
   * Met en marche ce qui tourne seul: la ligne de chaque partie toutes les dix secondes, et,
   * sauf demande contraire, les sondes du processus.
   */
  demarrer(): void {
    if (this.arreterLesLignes !== undefined) {
      return;
    }

    this.arreterLesLignes = this.horloge.repeter(() => {
      this.ecrireLesParties();
    }, INTERVALLE_DU_BULLETIN_MS);

    if (!this.avecProcessus) {
      return;
    }

    this.boucle = monitorEventLoopDelay({ resolution: 10 });
    this.boucle.enable();

    this.observateurDesPauses = new PerformanceObserver((liste) => {
      for (const entree of liste.getEntries()) {
        const { detail } = entree as { readonly detail?: { readonly kind?: number } | null };
        const genre = GENRES_DE_PAUSE[detail?.kind ?? 0];
        this.pauses.serie(genre ?? 'autre').observer(entree.duration);
        this.dernierePause = {
          genre: genre ?? 'autre',
          dureeMs: entree.duration,
          instant: entree.startTime,
        };
      }
    });
    this.observateurDesPauses.observe({ entryTypes: ['gc'] });
  }

  /** Arrete tout ce qui tourne seul. */
  arreter(): void {
    this.arreterLesLignes?.();
    this.arreterLesLignes = undefined;
    this.boucle?.disable();
    this.boucle = undefined;
    this.observateurDesPauses?.disconnect();
    this.observateurDesPauses = undefined;
  }

  // ------------------------------------------------------------------------
  // Le battement
  // ------------------------------------------------------------------------

  /**
   * Les phases de la diffusion du battement en cours, et ce qui est parti. Appelee par la
   * couche reseau pendant le battement, avant que la partie ne le termine.
   */
  diffusion(
    room: GameRoom,
    vuesMs: number,
    codageMs: number,
    envoiMs: number,
    octets: number,
    trames: number,
    plusGrandeTrame: number,
  ): void {
    this.vuesMs = vuesMs;
    this.codageMs = codageMs;
    this.envoiMs = envoiMs;

    const suivi = this.suiviDe(room);
    suivi.mode.octets.ajouter(octets);
    suivi.mode.trames.ajouter(trames);
    suivi.mode.trameOctets.observer(plusGrandeTrame);
    suivi.octets += octets;
  }

  /**
   * Ce qui attend d'etre envoye sur une connexion, au moment de lui envoyer le battement.
   * Lu sur la socket d'engine.io, sans rien supposer: un champ absent compte zero.
   */
  fileDEnvoi(socket: { readonly conn: unknown }): void {
    const conn = socket.conn as {
      readonly writeBuffer?: { readonly length: number };
      readonly transport?: { readonly socket?: { readonly bufferedAmount?: number } };
    };
    this.fileEnPaquets.observer(conn.writeBuffer?.length ?? 0);
    this.fileEnOctets.observer(conn.transport?.socket?.bufferedAmount ?? 0);
  }

  /** Un joueur vient de reprendre sa place apres une coupure. */
  reconnexion(): void {
    this.reconnexions.ajouter();
  }

  /** Un battement vient de finir. Voir ObservateurDuBattement. */
  battement(
    room: GameRoom,
    instant: number,
    ecartMs: number,
    dureeMs: number,
    moteurMs: number,
  ): void {
    const suivi = this.suiviDe(room);
    const enRetard = ecartMs >= BATTEMENT_EN_RETARD_MS;

    suivi.mode.battements.ajouter();
    suivi.mode.ecart.observer(ecartMs);
    suivi.duree.observer(dureeMs);
    this.phases.moteur.observer(moteurMs);
    this.phases.vues.observer(this.vuesMs);
    this.phases.codage.observer(this.codageMs);
    this.phases.envoi.observer(this.envoiMs);

    suivi.battements += 1;
    suivi.ecartMaxMs = Math.max(suivi.ecartMaxMs, ecartMs);
    suivi.dureeMaxMs = Math.max(suivi.dureeMaxMs, dureeMs);

    if (enRetard) {
      suivi.mode.enRetard.ajouter();
      suivi.enRetard += 1;
    }

    if (enRetard || dureeMs >= BATTEMENT_LENT_MS) {
      this.episodeDuServeur(room, suivi, instant, ecartMs, dureeMs, moteurMs);
    }

    this.vuesMs = 0;
    this.codageMs = 0;
    this.envoiMs = 0;
  }

  /** Le suivi d'une partie, cree a son premier battement. */
  private suiviDe(room: GameRoom): SuiviDePartie {
    const existant = this.suivis.get(room);

    if (existant !== undefined) {
      return existant;
    }

    const mode = this.seriesDesModes.get(room.mode);

    if (mode === undefined) {
      throw new Error(`Mode inconnu de la surveillance: ${room.mode}.`);
    }

    const pnj = Object.keys(room.etat.bots).length;
    const suivi: SuiviDePartie = {
      mode,
      duree: this.duree.serie(room.mode, room.reglages.carte, trancheDe(pnj)),
      pnj,
      joueurs: Object.keys(room.etat.joueurs).length,
      battements: 0,
      enRetard: 0,
      ecartMaxMs: 0,
      dureeMaxMs: 0,
      octets: 0,
    };
    this.suivis.set(room, suivi);

    return suivi;
  }

  /** Ecrit l'episode d'un battement lent ou en retard, si le plafond le laisse passer. */
  private episodeDuServeur(
    room: GameRoom,
    suivi: SuiviDePartie,
    instant: number,
    ecartMs: number,
    dureeMs: number,
    moteurMs: number,
  ): void {
    if (!this.plafond.accepter(`partie:${room.id}`, this.date())) {
      this.episodesIgnores.serie('serveur').ajouter();
      return;
    }

    this.episodes.serie('serveur').ajouter();
    const pause = this.dernierePause;

    this.ecrireAuJournal({
      type: 'episode',
      origine: 'serveur',
      partie: room.id,
      mode: room.mode,
      carte: room.reglages.carte,
      pnj: suivi.pnj,
      joueurs: suivi.joueurs,
      ecartMs: arrondi(ecartMs),
      dureeMs: arrondi(dureeMs),
      phasesMs: {
        moteur: arrondi(moteurMs),
        vues: arrondi(this.vuesMs),
        codage: arrondi(this.codageMs),
        envoi: arrondi(this.envoiMs),
      },
      ...(pause === undefined
        ? {}
        : {
            dernierePauseDuRamasseMiettes: {
              genre: pause.genre,
              dureeMs: arrondi(pause.dureeMs),
              ilYAMs: Math.round(instant - pause.instant),
            },
          }),
      ...(this.boucle === undefined
        ? {}
        : { retardMaxDeLaBoucleMs: arrondi(this.boucle.max / 1e6) }),
    });
  }

  // ------------------------------------------------------------------------
  // Les pages
  // ------------------------------------------------------------------------

  /**
   * Un bulletin arrive d'une page. Il est verifie, compte, et ecrit comme episode s'il
   * franchit un seuil.
   *
   * @param idConnexion La connexion qui l'envoie.
   * @param joueur Sa partie et son pseudo, si elle joue une partie en cours.
   * @param brut Ce qui est arrive, sans rien en supposer.
   */
  recevoirUnBulletin(
    idConnexion: string,
    joueur: JoueurDuBulletin | undefined,
    brut: unknown,
  ): void {
    if (JSON.stringify(brut ?? null).length > TAILLE_MAXIMALE_DU_BULLETIN) {
      this.bulletins.serie('trop_gros').ajouter();
      return;
    }

    const lu = lireLeBulletin(brut);

    if (!lu.valide) {
      this.bulletins.serie('mal_forme').ajouter();
      return;
    }

    if (joueur?.room.statut !== 'enCours') {
      this.bulletins.serie('hors_partie').ajouter();
      return;
    }

    const connexion = this.suiviDeConnexion(idConnexion);
    const maintenant = this.horloge.maintenant();

    if (
      connexion.dernierBulletin !== undefined &&
      maintenant - connexion.dernierBulletin < ECART_MINIMAL_DES_BULLETINS_MS
    ) {
      this.bulletins.serie('trop_frequent').ajouter();
      return;
    }

    connexion.dernierBulletin = maintenant;
    this.bulletins.serie('accepte').ajouter();
    const bulletin = lu.valeur;
    connexion.dernier = { room: joueur.room, pseudo: joueur.pseudo, bulletin };
    this.compterLeBulletin(connexion.series, this.suiviDe(joueur.room).mode, bulletin);

    if (
      bulletin.pire.dureeMs >= SEUIL_IMAGE_TRES_LENTE_MS ||
      bulletin.instantanes.ecartMaxMs >= SEUIL_INSTANTANE_TRES_EN_RETARD_MS
    ) {
      this.episodeDeLaPage(idConnexion, connexion, joueur, bulletin);
    }
  }

  /**
   * Une page dit son appareil: au debut de chaque partie, puis une fois par minute. Il ne se
   * compte qu'a la premiere description de la connexion.
   */
  recevoirLAppareil(idConnexion: string, brut: unknown): void {
    const lu = validerLAppareil(brut);

    if (!lu.valide) {
      this.bulletins.serie('appareil_mal_forme').ajouter();
      return;
    }

    const connexion = this.suiviDeConnexion(idConnexion);
    const appareil = lu.valeur;
    const dejaDecrite = connexion.appareil !== undefined;
    connexion.appareil = appareil;
    connexion.series = this.seriesDesPages(appareil.appareil, appareil.navigateur);

    if (!dejaDecrite) {
      this.appareils.serie(appareil.appareil, appareil.navigateur, appareil.moteur).ajouter();
    }
  }

  /** Une connexion s'est fermee: on l'oublie. */
  connexionFermee(idConnexion: string): void {
    this.connexions.delete(idConnexion);
  }

  /** Le suivi d'une connexion, cree a son premier message. */
  private suiviDeConnexion(idConnexion: string): SuiviDeConnexion {
    const existant = this.connexions.get(idConnexion);

    if (existant !== undefined) {
      return existant;
    }

    const suivi: SuiviDeConnexion = {
      appareil: undefined,
      series: this.seriesDesPages(APPAREIL_INCONNU, 'autre'),
      dernierBulletin: undefined,
      dernier: undefined,
    };
    this.connexions.set(idConnexion, suivi);

    return suivi;
  }

  /** Les series des pages de cet appareil et de ce navigateur. */
  private seriesDesPages(appareil: string, navigateur: string): SeriesDesPages {
    const f = this.famillesDesPages;

    return {
      images: f.images.serie(appareil, navigateur),
      lentes: f.lentes.serie(appareil, navigateur, '50'),
      tresLentes: f.lentes.serie(appareil, navigateur, '100'),
      cachees: f.cachees.serie(appareil, navigateur),
      tenues: f.tenues.serie(appareil, navigateur),
      duree: f.duree.serie(appareil, navigateur),
      notreCode: f.tempsDesLentes.serie(appareil, navigateur, 'notre_code'),
      pixi: f.tempsDesLentes.serie(appareil, navigateur, 'pixi'),
      reste: f.tempsDesLentes.serie(appareil, navigateur, 'reste'),
      instantanes: f.instantanes.serie(appareil, navigateur),
      instantanesEnRetard: f.instantanesEnRetard.serie(appareil, navigateur),
      ecartInstantanes: f.ecartInstantanes.serie(appareil, navigateur),
      allerRetour: f.allerRetour.serie(appareil, navigateur),
    };
  }

  /** Ajoute un bulletin aux series de sa page et de son mode. */
  private compterLeBulletin(
    series: SeriesDesPages,
    mode: SeriesDuMode,
    bulletin: BulletinDePage,
  ): void {
    const images = total(bulletin.images.cases);
    const instantanes = total(bulletin.instantanes.cases);

    series.images.ajouter(images);
    series.lentes.ajouter(bulletin.images.lentes);
    series.tresLentes.ajouter(bulletin.images.tresLentes);
    series.cachees.ajouter(bulletin.images.cachees);
    series.tenues.ajouter(bulletin.images.tenues);
    series.duree.fusionner(bulletin.images.cases, bulletin.images.sommeMs);
    series.notreCode.ajouter(bulletin.lentes.notreCodeMs);
    series.pixi.ajouter(bulletin.lentes.pixiMs);
    series.reste.ajouter(bulletin.lentes.resteMs);
    series.instantanes.ajouter(instantanes);
    series.instantanesEnRetard.ajouter(bulletin.instantanes.enRetard);
    series.ecartInstantanes.fusionner(bulletin.instantanes.cases, bulletin.instantanes.sommeMs);

    for (const allerRetour of bulletin.allersRetoursMs) {
      series.allerRetour.observer(allerRetour);
    }

    mode.imagesDesPages.ajouter(images);
    mode.imagesLentesDesPages.ajouter(bulletin.images.lentes);
    mode.instantanesDesPages.ajouter(instantanes);
    mode.instantanesEnRetardDesPages.ajouter(bulletin.instantanes.enRetard);
    this.erreurs.serie('script').ajouter(bulletin.erreurs.script);
    this.erreurs.serie('promesse').ajouter(bulletin.erreurs.promesse);
  }

  /** Ecrit l'episode d'une page qui saccade, si le plafond le laisse passer. */
  private episodeDeLaPage(
    idConnexion: string,
    connexion: SuiviDeConnexion,
    joueur: JoueurDuBulletin,
    bulletin: BulletinDePage,
  ): void {
    const origine =
      bulletin.instantanes.ecartMaxMs >= SEUIL_INSTANTANE_TRES_EN_RETARD_MS ? 'reseau' : 'page';

    if (!this.plafond.accepter(`connexion:${idConnexion}`, this.date())) {
      this.episodesIgnores.serie(origine).ajouter();
      return;
    }

    this.episodes.serie(origine).ajouter();
    const room = joueur.room;
    const suivi = this.suiviDe(room);
    const images = total(bulletin.images.cases);
    const instantanes = total(bulletin.instantanes.cases);

    this.ecrireAuJournal({
      type: 'episode',
      origine,
      partie: room.id,
      mode: room.mode,
      carte: room.reglages.carte,
      joueur: joueur.pseudo,
      ...(connexion.appareil === undefined ? {} : { appareil: connexion.appareil }),
      pireImage: bulletin.pire,
      images,
      imagesLentes: bulletin.images.lentes,
      imagesTresLentes: bulletin.images.tresLentes,
      imagesTenues: bulletin.images.tenues,
      tempsDesImagesLentesMs: bulletin.lentes,
      instantanes,
      instantanesEnRetard: bulletin.instantanes.enRetard,
      ecartMaxDesInstantanesMs: bulletin.instantanes.ecartMaxMs,
      allersRetoursMs: bulletin.allersRetoursMs,
      entites: bulletin.entites,
      son: bulletin.son,
      serveur: {
        pnj: suivi.pnj,
        joueurs: suivi.joueurs,
        battements: suivi.battements,
        battementsEnRetard: suivi.enRetard,
        dureeMaxMs: arrondi(suivi.dureeMaxMs),
      },
    });
  }

  // ------------------------------------------------------------------------
  // La ligne de chaque partie, toutes les dix secondes
  // ------------------------------------------------------------------------

  /**
   * Ecrit une ligne par partie en cours: son mode, sa carte, ses joueurs, ses PNJ, son
   * battement, son pire joueur et son verdict. Puis remet ses comptes a zero, et
   * recherche la serie de sa duree, la charge ayant pu changer de tranche.
   */
  ecrireLesParties(): void {
    const maintenant = this.horloge.maintenant();

    for (const room of this.sources?.parties() ?? []) {
      const suivi = this.suivis.get(room);

      if (room.statut !== 'enCours' || suivi === undefined) {
        continue;
      }

      suivi.pnj = Object.keys(room.etat.bots).length;
      suivi.joueurs = Object.keys(room.etat.joueurs).length;
      const pire = this.pireJoueurDe(room, maintenant);

      this.ecrireAuJournal({
        type: 'partie',
        partie: room.id,
        mode: room.mode,
        carte: room.reglages.carte,
        joueurs: suivi.joueurs,
        pnj: suivi.pnj,
        battements: suivi.battements,
        battementsEnRetard: suivi.enRetard,
        ecartMaxMs: arrondi(suivi.ecartMaxMs),
        dureeMaxMs: arrondi(suivi.dureeMaxMs),
        koParSeconde: arrondi(suivi.octets / 1024 / (INTERVALLE_DU_BULLETIN_MS / 1000)),
        verdict: this.verdictDe(suivi, pire?.bulletin),
        ...(pire === undefined
          ? {}
          : {
              pireJoueur: {
                pseudo: pire.pseudo,
                imagesLentesPourCent: pourCent(
                  pire.bulletin.images.lentes,
                  total(pire.bulletin.images.cases),
                ),
                instantanesEnRetardPourCent: pourCent(
                  pire.bulletin.instantanes.enRetard,
                  total(pire.bulletin.instantanes.cases),
                ),
                allerRetourMaxMs: Math.max(0, ...pire.bulletin.allersRetoursMs),
              },
            }),
      });

      suivi.duree = this.duree.serie(room.mode, room.reglages.carte, trancheDe(suivi.pnj));
      suivi.battements = 0;
      suivi.enRetard = 0;
      suivi.ecartMaxMs = 0;
      suivi.dureeMaxMs = 0;
      suivi.octets = 0;
    }
  }

  /**
   * Le joueur de cette partie dont le dernier bulletin, arrive dans les quinze dernieres
   * secondes, est le plus mauvais: la plus grande part d'images lentes ou d'instantanes en
   * retard.
   */
  private pireJoueurDe(
    room: GameRoom,
    maintenant: number,
  ): { readonly pseudo: string; readonly bulletin: BulletinDePage } | undefined {
    let pire: { readonly pseudo: string; readonly bulletin: BulletinDePage } | undefined;
    let pireNote = -1;

    for (const connexion of this.connexions.values()) {
      const dernier = connexion.dernier;

      if (
        dernier?.room !== room ||
        connexion.dernierBulletin === undefined ||
        maintenant - connexion.dernierBulletin > INTERVALLE_DU_BULLETIN_MS * 1.5
      ) {
        continue;
      }

      const note = Math.max(
        part(dernier.bulletin.images.lentes, total(dernier.bulletin.images.cases)),
        part(dernier.bulletin.instantanes.enRetard, total(dernier.bulletin.instantanes.cases)),
      );

      if (note > pireNote) {
        pireNote = note;
        pire = { pseudo: dernier.pseudo, bulletin: dernier.bulletin };
      }
    }

    return pire;
  }

  /** Le verdict d'une partie: son battement, et le pire de ses joueurs. */
  private verdictDe(suivi: SuiviDePartie, bulletin: BulletinDePage | undefined): Verdict {
    return verdict({
      battements: suivi.battements,
      battementsEnRetard: suivi.enRetard,
      instantanes: bulletin === undefined ? 0 : total(bulletin.instantanes.cases),
      instantanesEnRetard: bulletin?.instantanes.enRetard ?? 0,
      images: bulletin === undefined ? 0 : total(bulletin.images.cases),
      imagesLentes: bulletin?.images.lentes ?? 0,
    });
  }

  // ------------------------------------------------------------------------
  // L'ecriture
  // ------------------------------------------------------------------------

  /**
   * Toutes les metriques, au format texte de Prometheus. Les jauges qui se lisent sur le
   * serveur sont relevees d'abord: parties, joueurs, connexions, processus.
   */
  ecrire(): string {
    this.releverLesJauges();
    return this.registre.ecrire();
  }

  /** Releve les jauges qui ne se tiennent pas au fil de l'eau. */
  private releverLesJauges(): void {
    const parties = new Map<string, number>();
    const joueurs = new Map<Mode, number>(MODES.map((mode) => [mode, 0]));
    const pnj = new Map<Mode, number>(MODES.map((mode) => [mode, 0]));

    for (const mode of MODES) {
      for (const statut of ['salon', 'enCours', 'terminee']) {
        parties.set(`${mode}\u0000${statut}`, 0);
      }
    }

    for (const room of this.sources?.parties() ?? []) {
      const cle = `${room.mode}\u0000${room.statut}`;
      parties.set(cle, (parties.get(cle) ?? 0) + 1);

      if (room.statut === 'enCours') {
        joueurs.set(
          room.mode,
          (joueurs.get(room.mode) ?? 0) + Object.keys(room.etat.joueurs).length,
        );
        pnj.set(room.mode, (pnj.get(room.mode) ?? 0) + Object.keys(room.etat.bots).length);
      }
    }

    for (const [cle, nombre] of parties) {
      const [mode = '', statut = ''] = cle.split('\u0000');
      this.parties.serie(mode, statut).poser(nombre);
    }

    for (const mode of MODES) {
      this.joueurs.serie(mode).poser(joueurs.get(mode) ?? 0);
      this.pnj.serie(mode).poser(pnj.get(mode) ?? 0);
    }

    const transports = new Map<string, number>([
      ['websocket', 0],
      ['polling', 0],
    ]);

    for (const transport of this.sources?.transports() ?? []) {
      const nom = transport === 'websocket' || transport === 'polling' ? transport : 'autre';
      transports.set(nom, (transports.get(nom) ?? 0) + 1);
    }

    for (const [transport, nombre] of transports) {
      this.transports.serie(transport).poser(nombre);
    }

    if (this.boucle !== undefined) {
      this.boucleRetard.serie('mediane').poser(this.boucle.percentile(50) / 1e6);
      this.boucleRetard.serie('p99').poser(this.boucle.percentile(99) / 1e6);
      this.boucleRetard.serie('max').poser(this.boucle.max / 1e6);
      this.boucle.reset();
    }

    const memoire = process.memoryUsage();
    this.memoire.serie('rss').poser(memoire.rss);
    this.memoire.serie('tas_utilise').poser(memoire.heapUsed);
    this.memoire.serie('tas_total').poser(memoire.heapTotal);
    this.memoire.serie('externe').poser(memoire.external);

    const processeur = process.cpuUsage();
    this.processeur.serie('utilisateur').ajouter((processeur.user - this.processeurLu.user) / 1e6);
    this.processeur.serie('systeme').ajouter((processeur.system - this.processeurLu.system) / 1e6);
    this.processeurLu = processeur;
  }
}

/** La tranche de charge d'une partie, selon ses PNJ. */
function trancheDe(pnj: number): string {
  return (TRANCHES_DE_CHARGE.find((tranche) => pnj <= tranche.jusqua) ?? TRANCHES_DE_CHARGE[4]).nom;
}

/** La somme d'une liste de comptes. */
function total(cases: readonly number[]): number {
  let somme = 0;

  for (const nombre of cases) {
    somme += nombre;
  }

  return somme;
}

/** Une part en pour cent, au dixieme. */
function pourCent(compte: number, sur: number): number {
  return arrondi(100 * part(compte, sur));
}

/** Arrondit au dixieme. */
function arrondi(valeur: number): number {
  return Math.round(valeur * 10) / 10;
}
