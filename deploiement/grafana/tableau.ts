/**
 * Le tableau « Fluidite » de Grafana Cloud (etape 5.15), importe par importer.ts.
 *
 * LISIBLE SANS CONNAITRE PROMETHEUS. De haut en bas, il repond aux questions dans l'ordre ou
 * on se les pose: les parties sont-elles fluides en ce moment, et sinon ou nait la saccade
 * (le verdict); lesquelles tournent; ce que vivent les joueurs chez eux, par appareil et par
 * navigateur; ce que fait le serveur, phase par phase et selon la charge; ce qu'a change la
 * derniere mise en ligne; et le detail des derniers episodes.
 *
 * CHAQUE MISE EN LIGNE EST MARQUEE SUR LES COURBES: le serveur redemarre, et l'instant de son
 * demarrage porte sa version.
 *
 * Le tableau est decrit ici en TypeScript plutot qu'en JSON brut: ses requetes partagent les
 * seuils et les formules des alertes (requetes.ts), et un test verifie qu'elles ne lisent
 * que des metriques que le serveur ecrit.
 */

import {
  PARTIES_EN_COURS,
  SEUILS,
  VERDICT,
  centile,
  moyenne,
  partDesBattementsEnRetard,
  partDesImagesLentes,
  partDesInstantanesEnRetard,
} from './requetes.ts';

/** L'identifiant stable du tableau: le reimporter le remplace. */
export const UID_DU_TABLEAU = 'neon-fluidite';

/** Les sources de donnees, choisies par des variables du tableau. */
const PROMETHEUS = { type: 'prometheus', uid: '${prometheus}' };
const LOKI = { type: 'loki', uid: '${loki}' };

/** Un panneau du tableau. */
type Panneau = Record<string, unknown>;

/** Une requete Prometheus d'un panneau. */
interface Requete {
  readonly expr: string;
  readonly legende?: string;
  readonly instantanee?: boolean;
}

let prochainId = 1;

/** Une ligne de titre, qui separe les sections. */
function section(titre: string, y: number): Panneau {
  return {
    id: prochainId++,
    type: 'row',
    title: titre,
    collapsed: false,
    gridPos: { h: 1, w: 24, x: 0, y },
    panels: [],
  };
}

/** Les cibles Prometheus d'un panneau. */
function cibles(requetes: readonly Requete[]): Record<string, unknown>[] {
  return requetes.map((requete, rang) => ({
    refId: String.fromCharCode(65 + rang),
    datasource: PROMETHEUS,
    expr: requete.expr,
    legendFormat: requete.legende ?? '',
    ...(requete.instantanee === true ? { instant: true, range: false, format: 'table' } : {}),
  }));
}

/** Une courbe dans le temps. */
function courbe(
  titre: string,
  description: string,
  position: { x: number; y: number; w: number; h: number },
  requetes: readonly Requete[],
  unite = 'ms',
  options: { readonly empilee?: boolean; readonly seuil?: number } = {},
): Panneau {
  return {
    id: prochainId++,
    type: 'timeseries',
    title: titre,
    description,
    datasource: PROMETHEUS,
    gridPos: position,
    targets: cibles(requetes),
    fieldConfig: {
      defaults: {
        unit: unite,
        custom: {
          lineWidth: 2,
          fillOpacity: options.empilee === true ? 30 : 5,
          stacking: { mode: options.empilee === true ? 'normal' : 'none' },
          thresholdsStyle: { mode: options.seuil === undefined ? 'off' : 'line' },
        },
        thresholds: {
          mode: 'absolute',
          steps: [
            { color: 'green', value: null },
            ...(options.seuil === undefined ? [] : [{ color: 'red', value: options.seuil }]),
          ],
        },
      },
      overrides: [],
    },
    options: { legend: { displayMode: 'list', placement: 'bottom' }, tooltip: { mode: 'multi' } },
  };
}

/** Un chiffre, colore selon son seuil. */
function chiffre(
  titre: string,
  description: string,
  position: { x: number; y: number; w: number; h: number },
  expr: string,
  unite: string,
  seuil?: number,
): Panneau {
  return {
    id: prochainId++,
    type: 'stat',
    title: titre,
    description,
    datasource: PROMETHEUS,
    gridPos: position,
    targets: cibles([{ expr }]),
    fieldConfig: {
      defaults: {
        unit: unite,
        decimals: 1,
        noValue: '-',
        thresholds: {
          mode: 'absolute',
          steps: [
            { color: 'green', value: null },
            ...(seuil === undefined ? [] : [{ color: 'red', value: seuil }]),
          ],
        },
      },
      overrides: [],
    },
    options: {
      colorMode: 'background',
      graphMode: 'area',
      reduceOptions: { calcs: ['lastNotNull'] },
    },
  };
}

/** Le verdict, en mots. */
function verdict(position: { x: number; y: number; w: number; h: number }): Panneau {
  const mot = (texte: string, couleur: string, index: number): Record<string, unknown> => ({
    text: texte,
    color: couleur,
    index,
  });

  return {
    id: prochainId++,
    type: 'stat',
    title: 'Les parties sont-elles fluides ?',
    description:
      'Sur les 5 dernieres minutes. Le serveur est mis en cause si plus de 1 % de ses battements partent en retard; sinon le reseau, si plus de 5 % des instantanes arrivent en retard chez les joueurs; sinon la page, si plus de 5 % des images sont lentes (au moins 50 ms).',
    datasource: PROMETHEUS,
    gridPos: position,
    targets: cibles([{ expr: VERDICT }]),
    fieldConfig: {
      defaults: {
        mappings: [
          {
            type: 'value',
            options: {
              '-1': mot('Aucune partie en cours', 'text', 0),
              '0': mot('Fluide', 'green', 1),
              '1': mot('Saccades: le serveur', 'red', 2),
              '2': mot('Saccades: le reseau', 'orange', 3),
              '3': mot('Saccades: la page', 'orange', 4),
            },
          },
        ],
        color: { mode: 'thresholds' },
        thresholds: { mode: 'absolute', steps: [{ color: 'text', value: null }] },
      },
      overrides: [],
    },
    options: {
      colorMode: 'background',
      graphMode: 'none',
      textMode: 'value',
      reduceOptions: { calcs: ['lastNotNull'] },
    },
  };
}

/** Des lignes du journal. */
function journal(
  titre: string,
  description: string,
  position: { x: number; y: number; w: number; h: number },
  expr: string,
  periode?: string,
): Panneau {
  return {
    id: prochainId++,
    type: 'logs',
    title: titre,
    description,
    datasource: LOKI,
    gridPos: position,
    ...(periode === undefined ? {} : { timeFrom: periode }),
    targets: [{ refId: 'A', datasource: LOKI, expr }],
    options: {
      showTime: true,
      wrapLogMessage: true,
      sortOrder: 'Descending',
      enableLogDetails: true,
      prettifyLogMessage: false,
    },
  };
}

/** Un tableau de chiffres par version, sur toute la periode choisie. */
function parVersion(position: { x: number; y: number; w: number; h: number }): Panneau {
  const requetes: Requete[] = [
    {
      expr: `100 * sum by (version) (increase(neon_page_images_lentes_total{seuil="50"}[$__range])) / sum by (version) (increase(neon_page_images_total[$__range]))`,
      legende: 'Images lentes %',
      instantanee: true,
    },
    {
      expr: `100 * sum by (version) (increase(neon_page_instantanes_en_retard_total[$__range])) / sum by (version) (increase(neon_page_instantanes_total[$__range]))`,
      legende: 'Instantanes en retard %',
      instantanee: true,
    },
    {
      expr: `100 * sum by (version) (increase(neon_battements_en_retard_total[$__range])) / sum by (version) (increase(neon_battements_total[$__range]))`,
      legende: 'Battements en retard %',
      instantanee: true,
    },
    {
      expr: `histogram_quantile(0.99, sum by (le, version) (increase(neon_battement_duree_ms_bucket[$__range])))`,
      legende: 'Battement p99 ms',
      instantanee: true,
    },
    {
      expr: `histogram_quantile(0.9, sum by (le, version) (increase(neon_page_aller_retour_ms_bucket[$__range])))`,
      legende: 'Aller et retour p90 ms',
      instantanee: true,
    },
    {
      expr: `sum by (version) (increase(neon_battements_total[$__range])) / 1200`,
      legende: 'Minutes de partie',
      instantanee: true,
    },
  ];

  return {
    id: prochainId++,
    type: 'table',
    title: 'Version par version',
    description:
      'Les memes chiffres pour chaque version mise en ligne pendant la periode choisie en haut a droite. Une baisse de fluidite se voit a la version qui l a apportee; a comparer a charge comparable (minutes de partie, et le panneau de la duree selon la charge).',
    datasource: PROMETHEUS,
    gridPos: position,
    targets: cibles(requetes),
    transformations: [
      { id: 'merge', options: {} },
      {
        id: 'organize',
        options: {
          excludeByName: { Time: true },
          renameByName: {
            'Value #A': 'Images lentes %',
            'Value #B': 'Instantanes en retard %',
            'Value #C': 'Battements en retard %',
            'Value #D': 'Battement p99 ms',
            'Value #E': 'Aller et retour p90 ms',
            'Value #F': 'Minutes de partie',
          },
        },
      },
    ],
    fieldConfig: { defaults: { decimals: 1 }, overrides: [] },
    options: { showHeader: true, sortBy: [{ displayName: 'version', desc: true }] },
  };
}

/** Une variable du tableau, a choix dans une liste fixe. */
function liste(nom: string, libelle: string, valeurs: readonly string[]): Record<string, unknown> {
  return {
    name: nom,
    label: libelle,
    type: 'custom',
    query: valeurs.join(','),
    includeAll: true,
    allValue: '.*',
    multi: false,
    current: { text: 'All', value: '$__all' },
  };
}

/** Le tableau « Fluidite », au format JSON des tableaux de Grafana. */
export function tableauDeLaFluidite(): Record<string, unknown> {
  prochainId = 1;
  const appareilNavigateur = ['appareil', 'navigateur'];
  const legendeAppareil = '{{appareil}} {{navigateur}}';

  const panneaux: Panneau[] = [
    section('Le verdict', 0),
    verdict({ x: 0, y: 1, w: 8, h: 5 }),
    chiffre(
      'Battements en retard',
      'Part des battements du serveur partis au moins 100 ms apres le precedent (50 ms attendus). Au-dela de 1 %, le serveur est en cause.',
      { x: 8, y: 1, w: 4, h: 5 },
      `100 * (${partDesBattementsEnRetard()})`,
      'percent',
      100 * SEUILS.battementsEnRetard,
    ),
    chiffre(
      'Instantanes en retard',
      'Part des instantanes recus par les pages au moins 100 ms apres le precedent. Au-dela de 5 %, avec un serveur a l heure, le reseau est en cause.',
      { x: 12, y: 1, w: 4, h: 5 },
      `100 * (${partDesInstantanesEnRetard()})`,
      'percent',
      100 * SEUILS.instantanesEnRetard,
    ),
    chiffre(
      'Images lentes',
      'Part des images d au moins 50 ms dans les pages, onglet visible. Au-dela de 5 %, avec des instantanes a l heure, la page est en cause.',
      { x: 16, y: 1, w: 4, h: 5 },
      `100 * (${partDesImagesLentes()})`,
      'percent',
      100 * SEUILS.imagesLentes,
    ),
    chiffre(
      'Parties en cours',
      'Toutes les parties lancees.',
      { x: 20, y: 1, w: 2, h: 5 },
      PARTIES_EN_COURS,
      'none',
    ),
    chiffre(
      'Joueurs',
      'Les joueurs des parties en cours.',
      { x: 22, y: 1, w: 2, h: 5 },
      'sum(neon_joueurs)',
      'none',
    ),

    section('Les parties en cours', 6),
    journal(
      'Les parties, toutes les dix secondes',
      'Une ligne par partie en cours: son verdict, son mode, sa carte, ses joueurs, ses PNJ, le pire de son battement, et son pire joueur. Deplier une ligne en donne tout le detail.',
      { x: 0, y: 7, w: 24, h: 7 },
      '{job="neon-ninja", type="partie"} | json | line_format "{{.verdict}} | {{.mode}} sur {{.carte}} | {{.joueurs}} joueurs, {{.pnj}} PNJ | battement max {{.dureeMaxMs}} ms, ecart max {{.ecartMaxMs}} ms, {{.battementsEnRetard}} en retard | pire joueur {{.pireJoueur_pseudo}}: {{.pireJoueur_imagesLentesPourCent}} % images lentes, {{.pireJoueur_instantanesEnRetardPourCent}} % instantanes en retard | {{.partie}}"',
      '30s',
    ),

    section('Les joueurs chez eux', 14),
    courbe(
      'Duree d image, centile 90',
      'Neuf images sur dix sont plus courtes. 16,7 ms a 60 images par seconde, 8,3 ms a 120.',
      { x: 0, y: 15, w: 8, h: 8 },
      [{ expr: centile(0.9, 'neon_page_image_ms', appareilNavigateur), legende: legendeAppareil }],
      'ms',
      { seuil: 50 },
    ),
    courbe(
      'Duree d image, centile 99',
      'Une image sur cent est plus longue: c est la que se voit une saccade.',
      { x: 8, y: 15, w: 8, h: 8 },
      [{ expr: centile(0.99, 'neon_page_image_ms', appareilNavigateur), legende: legendeAppareil }],
      'ms',
      { seuil: 50 },
    ),
    courbe(
      'Images lentes',
      'Part des images d au moins 50 ms, par appareil et navigateur.',
      { x: 16, y: 15, w: 8, h: 8 },
      [
        {
          expr: `100 * (${partDesImagesLentes('$__rate_interval', 'appareil, navigateur')})`,
          legende: legendeAppareil,
        },
      ],
      'percent',
      { seuil: 100 * SEUILS.imagesLentes },
    ),
    courbe(
      'Images par seconde',
      'Le nombre d images par seconde d un joueur: images jouees divisees par la duree jouee.',
      { x: 0, y: 23, w: 8, h: 8 },
      [
        {
          expr: '1000 / (sum by (appareil, navigateur) (rate(neon_page_image_ms_sum[$__rate_interval])) / sum by (appareil, navigateur) (rate(neon_page_image_ms_count[$__rate_interval])))',
          legende: legendeAppareil,
        },
      ],
      'fps',
    ),
    courbe(
      'Aller et retour jusqu au serveur',
      'Mediane et centile 90, mesures toutes les cinq secondes par chaque page.',
      { x: 8, y: 23, w: 8, h: 8 },
      [
        {
          expr: centile(0.5, 'neon_page_aller_retour_ms', appareilNavigateur),
          legende: `mediane ${legendeAppareil}`,
        },
        {
          expr: centile(0.9, 'neon_page_aller_retour_ms', appareilNavigateur),
          legende: `p90 ${legendeAppareil}`,
        },
      ],
    ),
    courbe(
      'Instantanes en retard',
      'Part des instantanes recus au moins 100 ms apres le precedent, et part des images ou le lissage attendait le suivant (l a-coup que voit le joueur).',
      { x: 16, y: 23, w: 8, h: 8 },
      [
        {
          expr: '100 * sum by (appareil, navigateur) (rate(neon_page_instantanes_en_retard_total[$__rate_interval])) / sum by (appareil, navigateur) (rate(neon_page_instantanes_total[$__rate_interval]))',
          legende: `en retard ${legendeAppareil}`,
        },
        {
          expr: '100 * sum by (appareil, navigateur) (rate(neon_page_images_tenues_total[$__rate_interval])) / sum by (appareil, navigateur) (rate(neon_page_images_total[$__rate_interval]))',
          legende: `images tenues ${legendeAppareil}`,
        },
      ],
      'percent',
      { seuil: 100 * SEUILS.instantanesEnRetard },
    ),
    courbe(
      'Ou passe le temps des images lentes',
      'Dans les images d au moins 50 ms: notre code, PixiJS, et le reste (le navigateur, la carte graphique, le ramasse-miettes). Le reste qui domine designe le navigateur ou l appareil.',
      { x: 0, y: 31, w: 8, h: 8 },
      [
        {
          expr: 'sum by (part) (rate(neon_page_temps_des_images_lentes_ms_total[$__rate_interval]))',
          legende: '{{part}}',
        },
      ],
      'ms',
      { empilee: true },
    ),
    courbe(
      'Images lentes, par mode',
      'Part des images d au moins 50 ms selon le mode de la partie.',
      { x: 8, y: 31, w: 8, h: 8 },
      [
        {
          expr: '100 * sum by (mode) (rate(neon_page_images_lentes_par_mode_total[$__rate_interval])) / sum by (mode) (rate(neon_page_images_par_mode_total[$__rate_interval]))',
          legende: '{{mode}}',
        },
      ],
      'percent',
      { seuil: 100 * SEUILS.imagesLentes },
    ),
    courbe(
      'Bulletins et erreurs des pages',
      'Les bulletins recus par issue (un bulletin refuse dit une page modifiee ou d une autre version), et les erreurs des pages.',
      { x: 16, y: 31, w: 8, h: 8 },
      [
        {
          expr: 'sum by (issue) (rate(neon_bulletins_total[$__rate_interval])) * 60',
          legende: 'bulletins {{issue}}',
        },
        {
          expr: 'sum by (nature) (rate(neon_page_erreurs_total[$__rate_interval])) * 60',
          legende: 'erreurs {{nature}}',
        },
      ],
      'cpm',
    ),

    section('Le serveur', 39),
    courbe(
      'Ecart entre deux battements',
      'Centile 99 de l ecart reel entre deux battements d une partie, par mode. 50 ms attendus; a 100 ms, un instantane est en retard.',
      { x: 0, y: 40, w: 8, h: 8 },
      [{ expr: centile(0.99, 'neon_battement_ecart_ms', ['mode']), legende: '{{mode}}' }],
      'ms',
      { seuil: 100 },
    ),
    courbe(
      'Duree du battement',
      'Mediane et centile 99 du temps que prend un battement: moteur, vues, codage et envoi. Doit rester loin sous 50 ms.',
      { x: 8, y: 40, w: 8, h: 8 },
      [
        { expr: centile(0.5, 'neon_battement_duree_ms', ['mode']), legende: 'mediane {{mode}}' },
        { expr: centile(0.99, 'neon_battement_duree_ms', ['mode']), legende: 'p99 {{mode}}' },
      ],
      'ms',
      { seuil: 25 },
    ),
    courbe(
      'Les phases du battement',
      'Le temps moyen de chaque phase: le moteur (le jeu), les vues (ce que chacun voit), le codage des trames, l envoi. C est ce qui dit quoi optimiser.',
      { x: 16, y: 40, w: 8, h: 8 },
      [{ expr: moyenne('neon_battement_phase_ms', ['phase']), legende: '{{phase}}' }],
      'ms',
      { empilee: true },
    ),
    courbe(
      'Duree du battement selon la charge',
      'Centile 99 de la duree du battement par tranche de PNJ et par mode. La courbe qui monte annonce une optimisation avant qu elle ne se ressente.',
      { x: 0, y: 48, w: 8, h: 8 },
      [
        {
          expr: centile(0.99, 'neon_battement_duree_ms', ['mode', 'charge']),
          legende: '{{mode}} {{charge}} PNJ',
        },
      ],
      'ms',
      { seuil: 25 },
    ),
    courbe(
      'Duree du battement par carte',
      'Centile 99 par carte.',
      { x: 8, y: 48, w: 8, h: 8 },
      [{ expr: centile(0.99, 'neon_battement_duree_ms', ['carte']), legende: '{{carte}}' }],
      'ms',
      { seuil: 25 },
    ),
    courbe(
      'Ramasse-miettes et boucle d evenements',
      'Le temps de pause du ramasse-miettes par seconde, et le retard de la boucle d evenements (sa pire valeur sur chaque lecture). Une longue pause arrete tout, battements compris.',
      { x: 16, y: 48, w: 8, h: 8 },
      [
        {
          expr: 'sum by (genre) (rate(neon_ramasse_miettes_pause_ms_sum[$__rate_interval]))',
          legende: 'pauses {{genre}} (ms par s)',
        },
        { expr: 'max by (mesure) (neon_boucle_retard_ms)', legende: 'boucle {{mesure}}' },
      ],
    ),
    courbe(
      'Reseau du serveur',
      'Les octets d etat envoyes par seconde, par mode, et la taille des trames (centile 90).',
      { x: 0, y: 56, w: 8, h: 8 },
      [
        {
          expr: 'sum by (mode) (rate(neon_octets_envoyes_total[$__rate_interval]))',
          legende: 'envoyes {{mode}}',
        },
        { expr: centile(0.9, 'neon_trame_octets', ['mode']), legende: 'trame p90 {{mode}}' },
      ],
      'Bps',
    ),
    courbe(
      'File d envoi et connexions',
      'Ce qui attend encore d etre envoye a un joueur quand le battement suivant part (centile 99): un joueur dont la file grossit recoit en retard. Et les connexions par transport: les requetes longues (polling) font saccader a elles seules.',
      { x: 8, y: 56, w: 8, h: 8 },
      [
        { expr: centile(0.99, 'neon_file_d_envoi_octets'), legende: 'octets en file p99' },
        { expr: centile(0.99, 'neon_file_d_envoi_paquets'), legende: 'paquets en file p99' },
        { expr: 'sum by (transport) (neon_connexions)', legende: 'connexions {{transport}}' },
        {
          expr: 'sum(increase(neon_reconnexions_total[$__rate_interval]))',
          legende: 'reconnexions',
        },
      ],
      'short',
    ),
    courbe(
      'Memoire et processeur du serveur',
      'La memoire du processus, et le processeur qu il consomme, en part d un coeur.',
      { x: 16, y: 56, w: 8, h: 8 },
      [
        {
          expr: 'max by (emplacement) (neon_memoire_octets{nature="rss"})',
          legende: 'memoire {{emplacement}}',
        },
        {
          expr: 'max by (emplacement) (neon_memoire_octets{nature="tas_utilise"})',
          legende: 'tas {{emplacement}}',
        },
      ],
      'bytes',
    ),
    courbe(
      'La machine',
      'Le processeur de la machine, dont le vol par l hote (steal): une machine partagee qui peine. Et celui du serveur de jeu et de l agent Alloy.',
      { x: 0, y: 64, w: 12, h: 8 },
      [
        {
          expr: '100 * avg(rate(node_cpu_seconds_total{mode="steal"}[$__rate_interval]))',
          legende: 'vol par l hote',
        },
        {
          expr: '100 * (1 - avg(rate(node_cpu_seconds_total{mode="idle"}[$__rate_interval])))',
          legende: 'machine occupee',
        },
        {
          expr: '100 * sum(rate(neon_processeur_secondes_total[$__rate_interval]))',
          legende: 'serveur de jeu (coeur)',
        },
        {
          expr: '100 * sum(rate(alloy_resources_process_cpu_seconds_total[$__rate_interval]))',
          legende: 'agent Alloy (coeur)',
        },
      ],
      'percent',
    ),
    courbe(
      'Memoire de la machine et de l agent',
      'La memoire disponible de la machine, et celle de l agent Alloy (300 Mo au plus).',
      { x: 12, y: 64, w: 12, h: 8 },
      [
        { expr: 'node_memory_MemAvailable_bytes', legende: 'disponible' },
        { expr: 'alloy_resources_process_resident_memory_bytes', legende: 'agent Alloy' },
      ],
      'bytes',
    ),

    section('Avant et apres chaque mise en ligne', 72),
    parVersion({ x: 0, y: 73, w: 24, h: 7 }),

    section('Les derniers episodes', 80),
    journal(
      'Episodes',
      'Chaque battement lent ou en retard, chaque page qui saccade ou recoit en retard, avec tout son contexte: deplier une ligne pour le lire. Les filtres en haut du tableau s appliquent ici.',
      { x: 0, y: 81, w: 24, h: 12 },
      '{job="neon-ninja", type="episode", origine=~"$origine"} | json | mode=~"$mode" | carte=~"$carte" | version=~"$version" | appareil_appareil=~"$appareil"',
    ),
  ];

  return {
    uid: UID_DU_TABLEAU,
    title: 'Neon Ninja: fluidite',
    description: 'La fluidite des parties en production, en direct (etape 5.15).',
    tags: ['neon-ninja'],
    timezone: 'browser',
    refresh: '15s',
    time: { from: 'now-3h', to: 'now' },
    schemaVersion: 39,
    editable: true,
    graphTooltip: 1,
    annotations: {
      list: [
        {
          name: 'Mises en ligne',
          datasource: PROMETHEUS,
          enable: true,
          iconColor: 'purple',
          expr: 'max by (version) (neon_demarrage_secondes) * 1000',
          step: '60s',
          titleFormat: 'Mise en ligne {{version}}',
          useValueForTime: 'on',
        },
      ],
    },
    templating: {
      list: [
        {
          name: 'prometheus',
          label: 'Metriques',
          type: 'datasource',
          query: 'prometheus',
          regex: '.*-prom$',
          current: {},
        },
        {
          name: 'loki',
          label: 'Journal',
          type: 'datasource',
          query: 'loki',
          regex: '.*-logs$',
          current: {},
        },
        liste('origine', 'Origine', ['serveur', 'reseau', 'page']),
        liste('mode', 'Mode', ['classique', 'tactique', 'equipes', 'chasse', 'massacre', 'among']),
        liste('carte', 'Carte', ['map1', 'map3', 'quartier', 'station', 'prison']),
        liste('appareil', 'Appareil', ['telephone', 'tablette', 'ordinateur']),
        {
          name: 'version',
          label: 'Version',
          type: 'query',
          datasource: PROMETHEUS,
          query: { query: 'label_values(neon_demarrage_secondes, version)', refId: 'version' },
          includeAll: true,
          allValue: '.*',
          current: { text: 'All', value: '$__all' },
          refresh: 2,
        },
      ],
    },
    panels: panneaux,
  };
}
