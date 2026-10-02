/**
 * L'empreinte d'une partie: prouver qu'une optimisation ne change rien au jeu.
 *
 * POURQUOI CET OUTIL. Une optimisation du moteur ne doit rien changer a ce qui se
 * passe dans une partie (fiche de l'etape 5.2). Les tests unitaires le verifient
 * cas par cas; cet outil le verifie en bloc. Il joue quatre parties deterministes,
 * longues et animees (captures, bots noirs, bonus, malus, zones), et en tire deux
 * empreintes par partie:
 *
 *   - L'EMPREINTE DU JEU resume, a chaque battement, l'etat complet du moteur,
 *     l'instantane projete et les notifications. Deux versions du code qui rendent
 *     la meme jouent les memes parties, a l'octet pres. Elle ne depend pas du format
 *     du flux: l'etape 2.3 l'a laissee intacte.
 *   - L'EMPREINTE DU FLUX resume les trames binaires envoyees (etape 2.3). Elle
 *     change quand le format change, ou la politique d'envoi des images.
 *
 * A chaque battement, l'outil verifie en plus que la trame reconstruit exactement
 * l'instantane arrondi, comme le ferait un client present depuis le debut.
 *
 * Il se lance sur la compilation, avant puis apres une modification, et les deux
 * sorties se comparent ligne a ligne:
 *
 *   pnpm typecheck
 *   node --disable-warning=ExperimentalWarning tests/charge/empreinte.ts > avant.txt
 *   (modification, puis pnpm typecheck)
 *   node --disable-warning=ExperimentalWarning tests/charge/empreinte.ts > apres.txt
 *
 * Une empreinte qui change n'est pas forcement une faute: un changement de regle
 * voulu la change aussi. Elle dit seulement que les parties ne sont plus les memes.
 *
 * SANS L'EVADE (etape 7.9). L'Evade est en jeu par defaut: il tire un moment au lancement,
 * et change donc toute la suite des parties. L'option --sans-evade le coupe, et retire de
 * l'empreinte le reglage qui le coupe, seul ajout a l'etat: les parties rejouent alors a
 * l'octet celles d'avant l'etape, ce qui prouve que rien d'autre n'a change.
 *
 *   node --disable-warning=ExperimentalWarning tests/charge/empreinte.ts --sans-evade
 *
 * SANS LA POCHE (etape 7.10). La fumee est en jeu par defaut: elle tente sa chance avec les
 * bonus, et change donc la suite des parties. Les joueurs de l'outil se servent de leur
 * poche de temps en temps, a des battements fixes, sans rien tirer du generateur de
 * l'outil: une poche vide n'y fait rien. L'option --sans-poche coupe la fumee et retire de
 * l'empreinte le reglage qui la coupe: les parties rejouent alors a l'octet celles d'avant
 * l'etape.
 *
 *   node --disable-warning=ExperimentalWarning tests/charge/empreinte.ts --sans-poche
 *
 * Elle coupe aussi la mine depuis l'etape 7.11. SANS LA MINE (etape 7.11), pour la meme
 * raison: la mine tente sa chance apres la fumee. L'option --sans-mine la coupe seule, et
 * retire de l'empreinte le reglage qui la coupe: les parties rejouent alors a l'octet celles
 * de l'etape 7.10, fumee comprise.
 *
 *   node --disable-warning=ExperimentalWarning tests/charge/empreinte.ts --sans-mine
 *
 * SANS LES ZONES (etape 7.12). Depuis cette etape, les zones s'ouvrent sur des mines de zone
 * au lieu d'apparaitre seules: avec les zones en jeu, comme par defaut, toute la suite des
 * parties change. L'option --sans-zones les coupe, et retire de l'empreinte le plafond des
 * mines de zone, seul reglage ajoute: les parties rejouent alors a l'octet celles d'avant
 * l'etape, zones coupees de la meme facon.
 *
 *   node --disable-warning=ExperimentalWarning tests/charge/empreinte.ts --sans-zones
 */

import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

import type { Entrees, EtatPartie } from '../../packages/sim/dist/index.js';
import {
  ajouterJoueur,
  creerEtatInitial,
  lancerLaPartie,
  peuplerDeBots,
  tick,
} from '../../packages/sim/dist/index.js';
import type { InstantanePartie } from '../../packages/shared/dist/index.js';
import {
  appliquerTrame,
  creerAlea,
  entier,
  nombre,
  quantifierInstantane,
} from '../../packages/shared/dist/index.js';
import {
  ChargeurDeTerrain,
  FluxDEtat,
  instantaneDe,
  notificationsDe,
} from '../../packages/server/dist/index.js';

/** Une partie jouee par l'outil. */
interface PartieDEmpreinte {
  readonly nom: string;
  readonly bots: number;
  readonly joueurs: number;
  readonly battements: number;
  readonly murs: boolean;
  readonly graine: number;
}

/**
 * Les parties jouees. Leurs reglages font apparaitre souvent bonus, malus, zones
 * et bots noirs, pour que chaque regle ait sa chance de diverger.
 */
const PARTIES: readonly PartieDEmpreinte[] = [
  {
    nom: '150 bots, 12 joueurs, murs',
    bots: 150,
    joueurs: 12,
    battements: 3000,
    murs: true,
    graine: 42,
  },
  {
    nom: '50 bots, 12 joueurs, murs',
    bots: 50,
    joueurs: 12,
    battements: 2000,
    murs: true,
    graine: 7,
  },
  {
    nom: '300 bots, 12 joueurs, sans mur',
    bots: 300,
    joueurs: 12,
    battements: 1500,
    murs: false,
    graine: 99,
  },
  {
    nom: '150 bots, 2 joueurs, murs',
    bots: 150,
    joueurs: 2,
    battements: 2000,
    murs: true,
    graine: 3,
  },
];

/** L'Evade est-il coupe pour cette execution (etape 7.9). */
const SANS_EVADE = process.argv.includes('--sans-evade');

/** La fumee est-elle coupee pour cette execution (etape 7.10). */
const SANS_POCHE = process.argv.includes('--sans-poche');

/** La mine est-elle coupee pour cette execution, seule (etape 7.11). */
const SANS_MINE = process.argv.includes('--sans-mine');

/** Les zones sont-elles coupees pour cette execution (etape 7.12). */
const SANS_ZONES = process.argv.includes('--sans-zones');

/** Tous les combien de battements un joueur de l'outil se sert de sa poche. */
const CADENCE_DE_LA_POCHE = 97;

/**
 * Le terrain ne change jamais pendant une partie: il n'entre pas dans l'empreinte. Les
 * reglages qui coupent l'Evade et la fumee non plus, quand on les coupe: voir l'en-tete.
 */
function sansTerrain(cle: string, valeur: unknown): unknown {
  return cle === 'terrain' ||
    (SANS_EVADE && cle === 'evade' && valeur === false) ||
    (SANS_POCHE && cle === 'objetsDePoche') ||
    (SANS_MINE && cle === 'mine' && estUnReglageCoupe(valeur)) ||
    (SANS_ZONES && cle === 'minesMaximum')
    ? undefined
    : valeur;
}

/** Cette valeur est-elle le reglage d'un objet de poche coupe ? */
function estUnReglageCoupe(valeur: unknown): boolean {
  return typeof valeur === 'object' && valeur !== null && 'actif' in valeur && !valeur.actif;
}

/** Joue une partie et rend sa ligne de sortie: ses deux empreintes, et ce qui s'y est passe. */
function empreinteDe(partie: PartieDEmpreinte, murs: EtatPartie['terrain']): string {
  let etat = creerEtatInitial({
    graine: partie.graine,
    reglages: {
      nombreBotsInitial: partie.bots,
      dureePartieS: 200,
      bonus: { intervalleApparitionS: 2 },
      malus: { intervalleApparitionS: 4 },
      zones: { intervalleApparitionS: 5, ...(SANS_ZONES ? { actives: false } : {}) },
      botsNoirs: { momentApparitionPourCent: 5 },
      ...(SANS_EVADE ? { evade: false } : {}),
      ...(SANS_POCHE ? { objetsDePoche: { fumee: { actif: false }, mine: { actif: false } } } : {}),
      ...(SANS_MINE && !SANS_POCHE ? { objetsDePoche: { mine: { actif: false } } } : {}),
    },
    ...(partie.murs ? { terrain: murs } : {}),
  });

  for (let rang = 1; rang <= partie.joueurs; rang += 1) {
    etat = ajouterJoueur(etat, { id: `j${String(rang)}`, pseudo: `Joueur${String(rang)}` });
  }
  // Lancee comme le serveur la lance (GameRoom): depuis l'etape 7.5, c'est ce qui donne ses
  // combos a la Horde.
  etat = lancerLaPartie(peuplerDeBots(etat));

  let alea = creerAlea(partie.graine ^ 0x1234);
  const entrees: Record<string, Entrees[string]> = {};
  const empreinteDuJeu = createHash('sha256');
  const empreinteDuFlux = createHash('sha256');
  const flux = new FluxDEtat();
  let reconstruite: InstantanePartie | undefined;
  const faits = new Map<string, number>();

  for (let battement = 0; battement < partie.battements; battement += 1) {
    // Chaque joueur change d'intention une fois sur vingt en moyenne, et s'arrete
    // parfois: des joueurs qui bougent, capturent et ramassent.
    for (let rang = 1; rang <= partie.joueurs; rang += 1) {
      const changer = nombre(alea);
      alea = changer.alea;

      if (changer.valeur < 0.05) {
        const angle = nombre(alea);
        alea = angle.alea;
        const radians = angle.valeur * 2 * Math.PI;
        entrees[`j${String(rang)}`] = {
          deplacement: { x: Math.cos(radians), y: Math.sin(radians) },
          enMouvement: angle.valeur > 0.1,
        };
      }
    }

    // Chaque joueur se sert de sa poche a son tour, a des battements fixes: rien n'est tire
    // du generateur de l'outil, pour que les parties sans fumee restent celles d'avant.
    const duBattement: Record<string, Entrees[string]> = { ...entrees };
    for (let rang = 1; rang <= partie.joueurs; rang += 1) {
      const id = `j${String(rang)}`;
      const intention = entrees[id];
      if (intention !== undefined && battement % CADENCE_DE_LA_POCHE === rang) {
        duBattement[id] = { ...intention, utiliserLaPoche: true };
      }
    }

    // Un pas de temps irregulier, de 20 a 80 millisecondes, comme un vrai serveur.
    const pas = entier(alea, 61);
    alea = pas.alea;
    etat = tick(etat, duBattement, 20 + pas.valeur);

    const instantane = instantaneDe(etat);
    empreinteDuJeu.update(JSON.stringify(etat, sansTerrain));
    empreinteDuJeu.update(JSON.stringify(instantane));
    empreinteDuJeu.update(JSON.stringify(notificationsDe(etat)));

    const trame = flux.trameDuBattement(instantane);
    empreinteDuFlux.update(trame);
    reconstruite = appliquerTrame(reconstruite, trame);

    if (!isDeepStrictEqual(reconstruite, quantifierInstantane(instantane))) {
      throw new Error(
        `${partie.nom}, battement ${String(etat.tick)}: la trame ne reconstruit pas l'instantane.`,
      );
    }

    for (const fait of etat.evenements) {
      faits.set(fait.type, (faits.get(fait.type) ?? 0) + 1);
    }
  }

  const resume = [...faits]
    .sort(([premier], [second]) => premier.localeCompare(second))
    .map(([type, nombreDeFaits]) => `${type}=${String(nombreDeFaits)}`)
    .join(' ');

  return `${partie.nom}: jeu ${empreinteDuJeu.digest('hex')} | flux ${empreinteDuFlux.digest('hex')} | ${resume}`;
}

const murs = new ChargeurDeTerrain().charger({ carte: 'map1', modeMiroir: false });

for (const partie of PARTIES) {
  console.log(empreinteDe(partie, murs));
}
