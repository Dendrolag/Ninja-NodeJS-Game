/**
 * Les alertes de la fluidite (etape 5.15), par courriel au porteur du projet, importees par
 * importer.ts dans Grafana Cloud.
 *
 * UN PROBLEME QUI DURE SE SIGNALE EN DEUX A TROIS MINUTES. Les metriques sont lues toutes les
 * quinze secondes, les regles evaluees toutes les minutes, sur des fenetres de cinq minutes:
 * une saccade isolee ne declenche rien (elle se lit dans les episodes), une degradation qui
 * dure, si.
 *
 * LES SEUILS SONT DES POINTS DE DEPART, a regler sur ce que montre une semaine de production
 * (docs/deploiement.md, section « Surveillance »).
 *
 * La derniere alerte de la fiche, la production en retard sur master, n'est pas ici: Grafana
 * ne lit pas git. C'est un workflow planifie de GitHub (production-a-jour.yml).
 */

import {
  PARTIES_EN_COURS,
  SEUILS,
  centile,
  partDesBattementsEnRetard,
  partDesImagesLentes,
  partDesInstantanesEnRetard,
} from './requetes.ts';

/** Le dossier de Grafana ou vivent le tableau et les alertes. */
export const DOSSIER = { uid: 'neon-ninja', titre: 'Neon Ninja' } as const;

/** Le groupe des regles, evalue toutes les minutes. */
export const GROUPE = { nom: 'fluidite', intervalleS: 60 } as const;

/** Une alerte, decrite independamment de Grafana. */
export interface Alerte {
  readonly uid: string;
  readonly titre: string;
  /** La requete Prometheus dont la valeur se compare au seuil. */
  readonly expr: string;
  /** Plus grand que, ou plus petit que, le seuil. */
  readonly sens: 'gt' | 'lt';
  readonly seuil: number;
  /** La fenetre lue, en secondes: celle de la requete, et un peu plus. */
  readonly fenetreS: number;
  /** Combien de temps la condition doit tenir avant l'alerte. */
  readonly pendant: string;
  /** Ce que dit le courriel. */
  readonly resume: string;
  /** Que faire, renvoye a docs/deploiement.md. */
  readonly quoiFaire: string;
}

/** Le rapport de succes d'une verification de disponibilite, sur deux minutes. */
function disponibilite(verification: string): string {
  return `sum(increase(probe_all_success_sum{job="${verification}"}[2m])) / sum(increase(probe_all_success_count{job="${verification}"}[2m]))`;
}

/** Seulement une heure a deux heures apres le dernier demarrage: apres une mise en ligne. */
const APRES_UNE_MISE_EN_LIGNE = 'and on() ((time() - max(neon_demarrage_secondes)) > 3600 < 7200)';

/** Les alertes de la fiche. */
export const ALERTES: readonly Alerte[] = [
  {
    uid: 'neon-production-muette',
    titre: 'La production ne repond plus',
    expr: disponibilite('production'),
    sens: 'lt',
    seuil: 0.01,
    fenetreS: 300,
    pendant: '0s',
    resume: 'La route /sante de la production ne repond plus depuis deux minutes.',
    quoiFaire: 'Voir docs/deploiement.md, « Surveillance », La production ne repond plus.',
  },
  {
    uid: 'neon-page-muette',
    titre: 'La page publique ne repond plus',
    expr: disponibilite('page'),
    sens: 'lt',
    seuil: 0.01,
    fenetreS: 300,
    pendant: '0s',
    resume: 'https://ninja.dendrolag.fr ne repond plus depuis deux minutes.',
    quoiFaire: 'Voir docs/deploiement.md, « Surveillance », La page publique ne repond plus.',
  },
  {
    uid: 'neon-serveur-peine',
    titre: 'Le serveur peine',
    expr: `(${partDesBattementsEnRetard()}) and on() (${PARTIES_EN_COURS} > 0)`,
    sens: 'gt',
    seuil: SEUILS.battementsEnRetard,
    fenetreS: 600,
    pendant: '1m',
    resume:
      'Plus de 1 % des battements partent en retard depuis 5 minutes, avec des parties en cours.',
    quoiFaire: 'Voir docs/deploiement.md, « Surveillance », Le serveur peine.',
  },
  {
    uid: 'neon-battement-lourd',
    titre: 'Le battement s alourdit',
    expr: centile(0.99, 'neon_battement_duree_ms', [], '5m'),
    sens: 'gt',
    seuil: 25,
    fenetreS: 600,
    pendant: '1m',
    resume: 'Le centile 99 de la duree du battement depasse 25 ms depuis 5 minutes.',
    quoiFaire: 'Voir docs/deploiement.md, « Surveillance », Le battement s alourdit.',
  },
  {
    uid: 'neon-reseau-hoquette',
    titre: 'Le reseau hoquette',
    expr: `(${partDesInstantanesEnRetard()}) and on() ((${partDesBattementsEnRetard()}) <= ${String(SEUILS.battementsEnRetard)}) and on() (sum(neon_joueurs) >= 2)`,
    sens: 'gt',
    seuil: SEUILS.instantanesEnRetard,
    fenetreS: 600,
    pendant: '1m',
    resume:
      'Plus de 5 % des instantanes arrivent en retard chez les joueurs depuis 5 minutes, alors que le serveur bat a l heure.',
    quoiFaire: 'Voir docs/deploiement.md, « Surveillance », Le reseau hoquette.',
  },
  {
    uid: 'neon-page-rame',
    titre: 'La page rame',
    expr: partDesImagesLentes('10m', 'appareil'),
    sens: 'gt',
    seuil: SEUILS.imagesLentes,
    fenetreS: 900,
    pendant: '1m',
    resume: 'Plus de 5 % des images sont lentes sur une famille d appareils depuis 10 minutes.',
    quoiFaire: 'Voir docs/deploiement.md, « Surveillance », La page rame.',
  },
  {
    uid: 'neon-version-page',
    titre: 'Une version a degrade la page',
    expr: `(${partDesImagesLentes('1h')}) / (${partDesImagesLentes('7d', '', '1h')}) ${APRES_UNE_MISE_EN_LIGNE}`,
    sens: 'gt',
    seuil: 1.5,
    fenetreS: 7200,
    pendant: '0s',
    resume:
      'Depuis la derniere mise en ligne, la part d images lentes a augmente de moitie sur celle des sept jours precedents.',
    quoiFaire: 'Voir docs/deploiement.md, « Surveillance », Une version a degrade la fluidite.',
  },
  {
    uid: 'neon-version-serveur',
    titre: 'Une version a alourdi le battement',
    expr: `max(${centile(0.99, 'neon_battement_duree_ms', ['charge'], '1h')} / ${centile(0.99, 'neon_battement_duree_ms', ['charge'], '7d', '1h')}) ${APRES_UNE_MISE_EN_LIGNE}`,
    sens: 'gt',
    seuil: 1.5,
    fenetreS: 7200,
    pendant: '0s',
    resume:
      'Depuis la derniere mise en ligne, le centile 99 de la duree du battement a augmente de moitie, a charge comparable, sur les sept jours precedents.',
    quoiFaire: 'Voir docs/deploiement.md, « Surveillance », Une version a degrade la fluidite.',
  },
  {
    uid: 'neon-memoire-haute',
    titre: 'La memoire du serveur est haute',
    expr: 'max(neon_memoire_octets{nature="rss"})',
    sens: 'gt',
    seuil: 1e9,
    fenetreS: 300,
    pendant: '5m',
    resume: 'Le serveur de jeu occupe plus de 1 Go de memoire.',
    quoiFaire: 'Voir docs/deploiement.md, « Surveillance », La memoire grimpe.',
  },
  {
    uid: 'neon-memoire-en-hausse',
    titre: 'La memoire du serveur grimpe',
    expr: 'min_over_time(deriv(max(neon_memoire_octets{nature="rss"})[30m:5m])[6h:30m])',
    sens: 'gt',
    seuil: 0,
    fenetreS: 25_200,
    pendant: '0s',
    resume:
      'La memoire du serveur de jeu monte sans relache depuis six heures: une fuite, peut-etre.',
    quoiFaire: 'Voir docs/deploiement.md, « Surveillance », La memoire grimpe.',
  },
];

/**
 * Une alerte au format de l'API de Grafana (alert-rules de la provision): la requete, un
 * seuil sur sa valeur, et ce que dit le courriel.
 *
 * @param prometheus L'identifiant de la source des metriques de la pile.
 */
export function regleGrafana(alerte: Alerte, prometheus: string): Record<string, unknown> {
  return {
    uid: alerte.uid,
    title: alerte.titre,
    ruleGroup: GROUPE.nom,
    folderUID: DOSSIER.uid,
    condition: 'C',
    data: [
      {
        refId: 'A',
        relativeTimeRange: { from: alerte.fenetreS, to: 0 },
        datasourceUid: prometheus,
        model: { refId: 'A', expr: alerte.expr, instant: true, range: false },
      },
      {
        refId: 'B',
        datasourceUid: '__expr__',
        model: {
          refId: 'B',
          type: 'reduce',
          expression: 'A',
          reducer: 'max',
          settings: { mode: 'dropNN' },
        },
      },
      {
        refId: 'C',
        datasourceUid: '__expr__',
        model: {
          refId: 'C',
          type: 'threshold',
          expression: 'B',
          conditions: [{ evaluator: { type: alerte.sens, params: [alerte.seuil] } }],
        },
      },
    ],
    noDataState: 'OK',
    execErrState: 'Error',
    for: alerte.pendant,
    annotations: { summary: alerte.resume, description: alerte.quoiFaire },
    labels: { projet: 'neon-ninja' },
    isPaused: false,
  };
}
