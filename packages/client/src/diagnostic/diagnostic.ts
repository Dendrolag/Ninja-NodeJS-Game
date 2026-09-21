/**
 * Le relevé de performance dans la page: le panneau, et son branchement sur une partie
 * (étape 8.5).
 *
 * IL N'EXISTE QUE SI L'ADRESSE LE DEMANDE (demande.ts). La page de tous les jours ne crée
 * ni ce panneau, ni ce relevé, et la boucle de rendu ne reçoit pas de sonde.
 *
 * CE QU'IL MONTRE, ET RIEN D'AUTRE: la cadence, le neuvième décile et le centile 99 de la
 * durée d'image, et le compte des images d'au moins cinquante millisecondes depuis le
 * début de la partie. C'est un instrument, pas un tableau de bord. Le détail est dans le
 * texte que copie le bouton, prêt à être collé dans le dépôt.
 *
 * IL TOUCHE AU DOCUMENT DEUX FOIS PAR SECONDE, PAS À CHAQUE IMAGE. Écrire dans la page à
 * chaque image fabriquerait une mise en page par image, c'est-à-dire une partie du coût
 * qu'il est censé mesurer.
 *
 * SON STYLE EST POSÉ PAR LE CODE, PAS PAR UNE FEUILLE. La politique de sécurité de la page
 * n'accepte que ses propres feuilles de style: un panneau qui n'existe que sur demande
 * n'a pas à en ajouter une à la page de tous les jours.
 *
 * CE FICHIER N'EST PAS COUVERT PAR LES TESTS UNITAIRES: il branche PixiJS et le document.
 * Le relevé lui-même l'est (releve.ts), et le scénario de bout en bout
 * tests/e2e/diagnostic.spec.ts ouvre le jeu avec et sans le paramètre.
 */

import type { Application, Container } from 'pixi.js';
import { UPDATE_PRIORITY } from 'pixi.js';

import type { Client } from '../client.js';
import type { SondeDImage } from '../rendu/boucle.js';
import type { Variantes } from './demande.js';
import { decrireLesVariantes } from './demande.js';
import { Releve, nombre } from './releve.js';

/** Le relevé ouvert dans la page. */
export interface Diagnostic {
  /** Ce que l'adresse demande de changer au jeu. */
  readonly variantes: Variantes;
  /** Une partie commence: le relevé repart de zéro et la suit jusqu'à `arreter`. */
  suivreUnePartie(partie: PartieSuivie): SuiviDePartie;
}

/** Ce que le relevé doit savoir d'une partie pour la suivre. */
export interface PartieSuivie {
  readonly application: Application;
  readonly client: Client;
  /**
   * La carte, le mode et les réglages qui comptent pour le rendu, en une ligne. Lue à la
   * copie, et figée à la fin de la partie: le nombre d'entités change en cours de partie.
   */
  readonly description: () => string;
}

/** Une partie suivie. */
export interface SuiviDePartie {
  /** À donner à la boucle de rendu. */
  readonly sonde: SondeDImage;
  /** La partie est finie: le relevé garde ses chiffres, pour être copié. */
  arreter(): void;
}

/** Tous les combien le panneau se met à jour, en millisecondes. */
const RAFRAICHISSEMENT_MS = 500;

/** Ouvre le relevé: pose son panneau dans la page. */
export function creerDiagnostic(options: {
  readonly document: Document;
  readonly variantes: Variantes;
  readonly version?: string;
}): Diagnostic {
  const doc = options.document;
  const releve = new Releve();
  const panneau = monterLePanneau(doc);
  /** Ce que la partie suivie ajoute à l'en-tête, et de quoi compter ses personnages. */
  let partie:
    { readonly entete: () => [string, string][]; readonly compter: () => number } | undefined;
  let suivie = false;

  if (!options.variantes.flou) {
    retirerLesFlous(doc);
  }

  doc.addEventListener('visibilitychange', () => {
    if (doc.visibilityState === 'hidden') {
      releve.interrompre();
    }
  });

  const entete = (): [string, string][] => [
    ['Relevé copié le', new Date().toISOString()],
    ['Page', options.version ?? 'développement'],
    ['Variantes', decrireLesVariantes(options.variantes)],
    ...appareil(doc),
    ...(partie?.entete() ?? [['Partie', 'aucune suivie']]),
  ];

  panneau.surCopie(() => releve.texte(entete()));

  const vue = doc.defaultView;
  vue?.setInterval(() => {
    if (!suivie && partie === undefined) {
      panneau.ecrire('Relevé: en attente d’une partie');
      return;
    }

    if (suivie && partie !== undefined) {
      releve.echantillonner(performance.now(), partie.compter());
    }

    const resume = releve.resume();
    panneau.ecrire(
      [
        `${String(resume.cadence)} i/s`,
        `p90 ${nombre(resume.p90, 1)}`,
        `p99 ${nombre(resume.p99, 1)} ms`,
        `≥ 50 ms: ${String(resume.saccades)}`,
      ].join(' · '),
    );
  }, RAFRAICHISSEMENT_MS);

  return {
    variantes: options.variantes,

    suivreUnePartie({ application, client, description }) {
      releve.vider();
      suivie = true;

      const personnages = application.stage.getChildByLabel('personnages', true);
      const leRendu = rendu(application);
      partie = {
        entete: () => [['Partie', description()], ...leRendu],
        compter: () => compterLesVisibles(personnages),
      };

      // PixiJS dessine par renderer.render, appelé depuis son propre minuteur: on le
      // chronomètre sans rien changer à ce qu'il fait, comme le banc de rendu.
      const renderer = application.renderer;
      const rendre = renderer.render.bind(renderer);
      renderer.render = ((...parametres: Parameters<typeof rendre>) => {
        const avant = performance.now();
        rendre(...parametres);
        releve.ajouterPixi(performance.now() - avant);
      }) as typeof renderer.render;

      // Un instantané arrive quand le battement de la partie change.
      let battement = client.etat.partie?.tick;
      const desabonner = client.abonner((etat) => {
        const tick = etat.partie?.tick;

        if (tick !== undefined && tick !== battement) {
          battement = tick;
          releve.instantane(performance.now(), tick);
        }
      });

      return {
        sonde: releve,

        arreter() {
          suivie = false;
          desabonner();
          // Le rendu va être détruit et la partie oubliée: l'en-tête et le compte se figent.
          const entete = partie?.entete() ?? [];
          const compte = partie?.compter() ?? 0;
          partie = { entete: () => entete, compter: () => compte };
        },
      };
    },
  };
}

/**
 * Fait tourner la boucle de rendu au pas du minuteur de PixiJS, plafonné à cette cadence
 * (variante `cadence` du relevé).
 *
 * Plafonner deux minuteurs séparément les ferait tourner décalés: PixiJS dessinerait une
 * image sur deux une scène déjà dessinée. La boucle passe donc juste avant le dessin, dans
 * le même battement du minuteur.
 */
export function pilotageParPixi(
  application: Application,
  cadence: number,
): {
  demanderUneImage: (suite: (instant: number) => void) => number;
  annulerUneImage: (identifiant: number) => void;
} {
  const minuteur = application.ticker;
  minuteur.maxFPS = cadence;
  let enAttente: ((instant: number) => void) | undefined;

  // Un seul écouteur, posé une fois: en ajouter un par image pendant que le minuteur les
  // parcourt le ferait jouer dans le même battement.
  const surBattement = (): void => {
    const suite = enAttente;
    enAttente = undefined;
    suite?.(minuteur.lastTime);
  };

  minuteur.add(surBattement, undefined, UPDATE_PRIORITY.HIGH);

  return {
    demanderUneImage(suite) {
      enAttente = suite;
      return 1;
    },

    annulerUneImage() {
      enAttente = undefined;
      minuteur.remove(surBattement);
    },
  };
}

/** Le panneau du relevé. */
interface Panneau {
  ecrire(texte: string): void;
  /** Ce que le bouton copie. */
  surCopie(texte: () => string): void;
}

/** Pose le panneau, en bas de l'écran, au-dessus de tout. */
function monterLePanneau(doc: Document): Panneau {
  const racine = doc.createElement('div');
  racine.className = 'diagnostic';
  poser(racine, {
    position: 'fixed',
    left: '50%',
    bottom: 'calc(env(safe-area-inset-bottom, 0px) + 4px)',
    transform: 'translateX(-50%)',
    zIndex: '10000',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 8px',
    borderRadius: '6px',
    background: 'rgba(0, 0, 0, 0.72)',
    color: '#e8fffe',
    font: '11px/1.3 ui-monospace, Menlo, monospace',
    whiteSpace: 'nowrap',
    pointerEvents: 'auto',
  });

  const texte = doc.createElement('span');
  texte.className = 'diagnostic-resume';
  texte.textContent = 'Relevé: en attente d’une partie';

  const bouton = doc.createElement('button');
  bouton.type = 'button';
  bouton.className = 'diagnostic-copier';
  bouton.textContent = 'Copier le relevé';
  poser(bouton, {
    font: 'inherit',
    padding: '3px 6px',
    border: '1px solid #2de6e0',
    borderRadius: '4px',
    background: 'transparent',
    color: 'inherit',
  });

  racine.append(texte, bouton);
  doc.body.append(racine);

  let fabriquer: () => string = () => '';

  bouton.addEventListener('click', () => {
    const contenu = fabriquer();
    const presse = doc.defaultView?.navigator.clipboard;

    // Écrire dans le presse-papiers pendant le geste même: Safari le refuse sinon.
    if (presse === undefined) {
      montrerLeTexte(doc, contenu);
      return;
    }

    presse.writeText(contenu).then(
      () => {
        bouton.textContent = 'Copié';
        doc.defaultView?.setTimeout(() => {
          bouton.textContent = 'Copier le relevé';
        }, 2000);
      },
      () => {
        montrerLeTexte(doc, contenu);
      },
    );
  });

  return {
    ecrire(nouveau) {
      if (texte.textContent !== nouveau) {
        texte.textContent = nouveau;
      }
    },

    surCopie(source) {
      fabriquer = source;
    },
  };
}

/**
 * Montre le relevé dans une zone de texte sélectionnée, quand le presse-papiers refuse:
 * il reste à le copier à la main.
 */
function montrerLeTexte(doc: Document, contenu: string): void {
  const fond = doc.createElement('div');
  fond.className = 'diagnostic-texte';
  poser(fond, {
    position: 'fixed',
    inset: '0',
    zIndex: '10001',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '16px',
    background: 'rgba(0, 0, 0, 0.9)',
  });

  const zone = doc.createElement('textarea');
  zone.readOnly = true;
  zone.value = contenu;
  poser(zone, { flex: '1', font: '11px/1.3 ui-monospace, Menlo, monospace' });

  const fermer = doc.createElement('button');
  fermer.type = 'button';
  fermer.textContent = 'Fermer';
  fermer.addEventListener('click', () => {
    fond.remove();
  });

  fond.append(zone, fermer);
  doc.body.append(fond);
  zone.focus();
  zone.select();
}

/**
 * Retire les fonds floutés de l'interface (variante `flou=0`).
 *
 * La règle est ajoutée à une feuille de la page par le modèle objet des styles, que la
 * politique de sécurité accepte, là où une balise de style ajoutée serait refusée.
 */
function retirerLesFlous(doc: Document): void {
  const feuille = doc.styleSheets[doc.styleSheets.length - 1];

  try {
    feuille?.insertRule(
      '* { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }',
      feuille.cssRules.length,
    );
  } catch {
    // Une feuille d'une autre origine refuse qu'on la lise: la variante est sans effet,
    // et le relevé dit quand même qu'elle était demandée.
  }
}

/** Ce que la page sait de l'appareil. */
function appareil(doc: Document): [string, string][] {
  const vue = doc.defaultView;

  if (vue === null) {
    return [];
  }

  const memoire = (vue.performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;

  return [
    ['Navigateur', vue.navigator.userAgent],
    [
      'Écran',
      `${String(vue.screen.width)} × ${String(vue.screen.height)}, densité ${String(vue.devicePixelRatio)}`,
    ],
    ['Fenêtre', `${String(vue.innerWidth)} × ${String(vue.innerHeight)}`],
    ['Processeurs logiques', String(vue.navigator.hardwareConcurrency)],
    ...(memoire === undefined
      ? []
      : [
          ['Mémoire JavaScript', `${nombre(memoire.usedJSHeapSize / 1_048_576, 1)} Mo`] as [
            string,
            string,
          ],
        ]),
  ];
}

/** Ce que la page sait du rendu monté. */
function rendu(application: Application): [string, string][] {
  const renderer = application.renderer as Application['renderer'] & {
    readonly gl?: WebGLRenderingContext;
  };
  const canevas = application.canvas;
  const gl = renderer.gl;
  let carteGraphique = 'inconnue';

  if (gl !== undefined) {
    const extension = gl.getExtension('WEBGL_debug_renderer_info');
    carteGraphique = String(
      gl.getParameter(extension === null ? gl.RENDERER : extension.UNMASKED_RENDERER_WEBGL),
    );
  }

  const version =
    gl === undefined
      ? ''
      : typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext
        ? ' 2'
        : ' 1';

  return [
    [
      'Rendu',
      `${renderer.name}${version}, densité ${String(renderer.resolution)}, canevas ${String(canevas.width)} × ${String(canevas.height)}`,
    ],
    ['Carte graphique', carteGraphique],
  ];
}

/** Le nombre de personnages affichés dans ce calque. */
function compterLesVisibles(calque: Container | null): number {
  if (calque === null || calque.destroyed) {
    return 0;
  }

  let compte = 0;

  for (const enfant of calque.children) {
    compte += enfant.visible ? 1 : 0;
  }

  return compte;
}

/** Pose des propriétés de style une à une, ce que la politique de sécurité accepte. */
function poser(element: HTMLElement, style: Partial<CSSStyleDeclaration>): void {
  Object.assign(element.style, style);
}
