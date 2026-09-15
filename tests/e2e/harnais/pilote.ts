/**
 * Le pilote: conduire un joueur jusqu'a ce qu'il touche quelque chose.
 *
 * POURQUOI UN PILOTE. Provoquer une capture demande d'amener deux entites a moins
 * de vingt pixels l'une de l'autre, sur une vraie carte, avec de vrais murs et des
 * positions d'apparition tirees au sort. Or la page ne dit a personne ou se
 * trouvent les joueurs: le terrain est un canevas, et l'etat du client n'est
 * expose nulle part, volontairement. Le serveur, lui, le sait, et il tourne dans
 * le processus meme du scenario. Le pilote lit donc les positions dans l'etat du
 * serveur, calcule un chemin qui contourne les murs, puis agit dans la page par
 * une Commande: des touches enfoncees, ou un pouce pose sur la manette virtuelle.
 *
 * CE QUE LE PILOTE NE FAIT JAMAIS: ecrire dans le serveur. Il ne deplace personne,
 * ne fabrique aucune intention, n'appelle aucune methode qui change l'etat. Tout
 * ce qui bouge passe par la page, le client, le reseau et le moteur, c'est-a-dire
 * par le chemin que les scenarios existent pour verifier. Tricher ici rendrait le
 * scenario vert sans rien prouver.
 *
 * LE CHEMIN. Un parcours en largeur sur une grille de mailles, ou une maille est
 * praticable si une entite tient en son centre, selon la regle meme du moteur
 * (positionTenable). Le parcours s'arrete a la premiere cible rencontree, donc a
 * la plus proche en distance de marche et non a vol d'oiseau: un faux ninja
 * derriere un mur n'est pas le plus proche. Il est refait a chaque correction,
 * parce que les cibles bougent.
 *
 * LA VISEE. Suivre le chemin maille par maille ferait avancer le joueur par
 * a-coups, et viser loin devant sans regarder le ferait foncer dans l'angle d'un
 * mur, ou il resterait colle. Le pilote vise donc le point le plus lointain du
 * chemin, dans une courte portee, qu'une entite peut atteindre en ligne droite
 * sans toucher de mur, la encore selon la regle du moteur (trajetTenable).
 *
 * L'APPROCHE FINALE. Une page qui dessine lentement, comme sans carte graphique,
 * ne lit la saisie qu'a chaque image: chaque direction part avec retard. Un
 * poursuivant qui corrige sans cesse reste alors toujours en retard sur l'angle, et
 * finit en orbite autour de sa cible; les positions relevees l'ont montre. Quand
 * une cible immobile est en vue, le pilote s'arrete donc, attend que le serveur le
 * voie arrete, puis fonce en ligne droite vers elle sans plus corriger: depuis
 * l'arret, cette ligne passe par la cible, et le retard ne fait que retarder le
 * contact.
 */

import type { Position, Vecteur } from '../../../packages/shared/dist/index.js';
import { RAYON_ENTITE, VITESSES } from '../../../packages/shared/dist/index.js';
import type { CarteCollisions } from '../../../packages/sim/dist/index.js';
import { positionTenable, trajetTenable } from '../../../packages/sim/dist/index.js';

/**
 * Cote d'une maille de la grille de marche, en pixels.
 *
 * Deux fois plus fin que le rayon d'une entite: un passage a peine plus large
 * qu'un joueur contient toujours une rangee de centres praticables.
 */
const MAILLE_PX = 8;

/** Jusqu'ou, en suivant le chemin, le pilote cherche un point a viser en ligne droite. */
const PORTEE_DE_VISEE_PX = 80;

/**
 * Tous les combien le pilote relit la situation et corrige sa direction.
 *
 * Deux battements du serveur: assez souvent pour suivre une cible qui bouge a cent
 * pixels par seconde, assez peu pour ne pas noyer la page de commandes.
 */
const PERIODE_MS = 100;

/**
 * Temps ajoute a la duree d'une ruee, en millisecondes.
 *
 * La direction part avec le retard d'une page lente: le joueur doit pouvoir aller
 * au bout de sa ligne malgre ce retard.
 */
const MARGE_DE_RUEE_MS = 800;

/** Au-dela de ce temps d'arret, le pilote fonce meme si le serveur voit encore le joueur bouger. */
const ARRET_MAXIMUM_MS = 2_000;

/** Sur quelle duree le message d'echec retrace les positions, en millisecondes. */
const FENETRE_DE_PROGRES_MS = 2_000;

/** Les huit mailles voisines, en decalages de colonne et de ligne. */
const VOISINES: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/** Ce qui fait bouger un joueur dans la page: le clavier, ou le pouce. */
export interface Commande {
  /** Demande d'aller dans cette direction, donnee comme un vecteur unitaire. */
  orienter(direction: Vecteur): Promise<void>;
  /** Lache tout: le joueur s'arrete. */
  relacher(): Promise<void>;
}

/** Ce que le pilote lit dans l'etat du serveur, a chaque correction. */
export interface Situation {
  readonly terrain: CarteCollisions;
  /** Ou se trouve le joueur pilote. */
  readonly position: Position;
  /** Ce qu'il cherche a toucher. Vide: il s'arrete et attend. */
  readonly cibles: readonly Position[];
}

/** Un objectif a atteindre en pilotant un joueur. */
export interface Mission {
  /** Ce que fait la mission, pour le message d'echec. */
  readonly nom: string;
  readonly commande: Commande;
  /** La situation courante, lue dans le serveur. */
  readonly situation: () => Situation;
  /** Vrai quand l'objectif est atteint, lu dans le serveur. */
  readonly accomplie: () => boolean;
  /** Au-dela de ce delai, la mission echoue. */
  readonly delaiMs: number;
}

/** La carte ramenee a des mailles, praticables ou non. */
interface Grille {
  readonly colonnes: number;
  readonly lignes: number;
  /** Un octet par maille: un si une entite tient en son centre. */
  readonly praticable: Uint8Array;
}

/** Le point vise, et la facon dont il a ete trouve. */
interface Visee {
  readonly point: Position;
  /** Faux quand aucun chemin n'a ete trouve et que le pilote vise tout droit. */
  readonly parUnChemin: boolean;
  /** Le point vise est la cible elle-meme, en vue et a portee. */
  readonly surLaCible: boolean;
}

/**
 * Ou en est le pilote.
 *
 *   - route: il suit le chemin et corrige a chaque instant;
 *   - arret: une cible immobile est en vue, il attend que le serveur le voie arrete;
 *   - ruee: il fonce en ligne droite vers la cible, sans corriger, jusqu'a une echeance.
 */
type Phase =
  | { readonly nom: 'route' }
  | { readonly nom: 'arret'; readonly depuis: number }
  | { readonly nom: 'ruee'; readonly jusqua: number };

/** Ce que le pilote a lu et decide a un instant, pour expliquer un echec. */
interface Releve {
  readonly instant: number;
  readonly situation: Situation;
  readonly visee: Visee | undefined;
  readonly phase: Phase['nom'];
}

/**
 * Pilote un joueur jusqu'a ce que la mission soit accomplie.
 *
 * Le joueur est toujours relache en sortant, mission reussie ou non: un joueur
 * laisse en mouvement continuerait de courir, puisque le serveur garde la derniere
 * intention recue.
 *
 * @throws Si la mission n'est pas accomplie dans son delai, avec ce que le pilote
 *         voyait a la fin, pour que l'echec se comprenne sans rejouer.
 */
export async function accomplir(mission: Mission): Promise<void> {
  const echeance = Date.now() + mission.delaiMs;
  const releves: Releve[] = [];
  let grille: Grille | undefined;
  let phase: Phase = { nom: 'route' };
  let precedente: Situation | undefined;
  let viseePrecedente: Visee | undefined;

  try {
    while (!mission.accomplie()) {
      const maintenant = Date.now();

      if (maintenant > echeance) {
        throw new Error(
          `Mission « ${mission.nom} » non accomplie en ${String(mission.delaiMs)} ms. ${bilan(releves)}`,
        );
      }

      const situation = mission.situation();
      grille ??= grilleDe(situation.terrain);
      const visee = viser(grille, situation);

      switch (phase.nom) {
        case 'ruee':
          if (maintenant >= phase.jusqua) {
            phase = { nom: 'route' };
          }
          break;

        case 'arret':
          if (
            (precedente !== undefined && memePosition(precedente.position, situation.position)) ||
            maintenant - phase.depuis > ARRET_MAXIMUM_MS
          ) {
            phase = await ruer(mission.commande, situation, visee, maintenant);
          }
          break;

        case 'route':
          if (cibleImmobileEnVue(viseePrecedente, visee)) {
            await mission.commande.relacher();
            phase = { nom: 'arret', depuis: maintenant };
          } else {
            await suivre(mission.commande, situation, visee);
          }
          break;
      }

      releves.push({ instant: maintenant, situation, visee, phase: phase.nom });
      while ((releves[0]?.instant ?? maintenant) < maintenant - FENETRE_DE_PROGRES_MS) {
        releves.shift();
      }

      precedente = situation;
      viseePrecedente = visee;
      await attendre(PERIODE_MS);
    }
  } finally {
    await mission.commande.relacher();
  }
}

/** Suit le chemin: une direction corrigee a chaque instant, ou l'arret s'il n'y a rien a viser. */
async function suivre(
  commande: Commande,
  situation: Situation,
  visee: Visee | undefined,
): Promise<void> {
  const direction =
    visee === undefined ? undefined : directionVers(situation.position, visee.point);

  await (direction === undefined ? commande.relacher() : commande.orienter(direction));
}

/**
 * Fonce en ligne droite vers la cible en vue, depuis l'arret.
 *
 * La ruee dure le temps de parcourir la distance a vitesse de joueur, plus une
 * marge pour le retard de la page. Si la cible n'est plus en vue, le pilote reprend
 * la route.
 */
async function ruer(
  commande: Commande,
  situation: Situation,
  visee: Visee | undefined,
  maintenant: number,
): Promise<Phase> {
  const direction =
    visee?.surLaCible === true ? directionVers(situation.position, visee.point) : undefined;

  if (visee === undefined || direction === undefined) {
    return { nom: 'route' };
  }

  await commande.orienter(direction);

  const distance = Math.hypot(
    visee.point.x - situation.position.x,
    visee.point.y - situation.position.y,
  );
  const dureeMs = (distance / VITESSES.JOUEUR_PX_PAR_SECONDE) * 1000 + MARGE_DE_RUEE_MS;

  return { nom: 'ruee', jusqua: maintenant + dureeMs };
}

/** La cible visee est en vue, et elle n'a pas bouge depuis la lecture precedente. */
function cibleImmobileEnVue(precedente: Visee | undefined, courante: Visee | undefined): boolean {
  return (
    precedente?.surLaCible === true &&
    courante?.surLaCible === true &&
    memePosition(precedente.point, courante.point)
  );
}

/** Deux positions identiques: ce qui ne bouge pas garde exactement ses coordonnees. */
function memePosition(une: Position, autre: Position): boolean {
  return une.x === autre.x && une.y === autre.y;
}

/** Decoupe le terrain en mailles, praticables quand une entite tient en leur centre. */
function grilleDe(terrain: CarteCollisions): Grille {
  const colonnes = Math.ceil(terrain.largeur / MAILLE_PX);
  const lignes = Math.ceil(terrain.hauteur / MAILLE_PX);
  const praticable = new Uint8Array(colonnes * lignes);

  for (let ligne = 0; ligne < lignes; ligne += 1) {
    for (let colonne = 0; colonne < colonnes; colonne += 1) {
      if (positionTenable(terrain, centreDe(colonne, ligne), RAYON_ENTITE)) {
        praticable[ligne * colonnes + colonne] = 1;
      }
    }
  }

  return { colonnes, lignes, praticable };
}

/** Ou viser, ou rien s'il n'y a rien a viser. */
function viser(grille: Grille, situation: Situation): Visee | undefined {
  if (situation.cibles.length === 0) {
    return undefined;
  }

  const surLeChemin = pointSurLeChemin(grille, situation);

  // Sans chemin, par exemple quand le joueur est colle a un mur hors de toute
  // maille praticable, on vise tout droit: le moteur le fera glisser.
  return (
    surLeChemin ?? {
      point: laPlusProche(situation.position, situation.cibles),
      parUnChemin: false,
      surLaCible: false,
    }
  );
}

/** La direction unitaire vers un point, ou rien si on y est deja. */
function directionVers(position: Position, point: Position): Vecteur | undefined {
  const ecart = { x: point.x - position.x, y: point.y - position.y };
  const longueur = Math.hypot(ecart.x, ecart.y);

  return longueur < 1 ? undefined : { x: ecart.x / longueur, y: ecart.y / longueur };
}

/**
 * Le point a viser sur le chemin de la cible la plus proche a pied.
 *
 * @returns Un point du chemin ou la cible elle-meme, ou rien si aucune cible
 *          n'est atteignable depuis la maille du joueur.
 */
function pointSurLeChemin(grille: Grille, situation: Situation): Visee | undefined {
  const arrivees = maillesDArrivee(grille, situation.cibles);
  const debut = indexDe(grille, situation.position);
  const dejaLa = arrivees.get(debut);

  if (dejaLa !== undefined) {
    return { point: dejaLa, parUnChemin: true, surLaCible: true };
  }

  const parent = new Int32Array(grille.colonnes * grille.lignes).fill(-1);
  parent[debut] = debut;
  const file = [debut];

  for (let tete = 0; tete < file.length; tete += 1) {
    const courante = file[tete] as number;
    const colonne = courante % grille.colonnes;
    const ligne = Math.floor(courante / grille.colonnes);

    for (const [dc, dl] of VOISINES) {
      const voisine = indexPraticable(grille, colonne + dc, ligne + dl);

      if (voisine === undefined || parent[voisine] !== -1) {
        continue;
      }

      // En diagonale, les deux mailles longees doivent etre praticables aussi:
      // sinon le chemin couperait l'angle d'un mur.
      if (
        dc !== 0 &&
        dl !== 0 &&
        (indexPraticable(grille, colonne + dc, ligne) === undefined ||
          indexPraticable(grille, colonne, ligne + dl) === undefined)
      ) {
        continue;
      }

      parent[voisine] = courante;
      const cible = arrivees.get(voisine);

      if (cible !== undefined) {
        return pointAViser(grille, situation, cheminVers(parent, debut, voisine), cible);
      }

      file.push(voisine);
    }
  }

  return undefined;
}

/**
 * Les mailles d'ou l'on touche une cible, chacune avec la cible qu'elle touche.
 *
 * La maille d'une cible et ses huit voisines: une cible collee a un mur peut tenir
 * a un endroit ou le centre de sa maille, lui, ne tient pas.
 */
function maillesDArrivee(grille: Grille, cibles: readonly Position[]): Map<number, Position> {
  const arrivees = new Map<number, Position>();

  for (const cible of cibles) {
    const colonne = colonneDe(grille, cible.x);
    const ligne = ligneDe(grille, cible.y);

    for (const [dc, dl] of [[0, 0] as const, ...VOISINES]) {
      const index = indexPraticable(grille, colonne + dc, ligne + dl);

      if (index !== undefined && !arrivees.has(index)) {
        arrivees.set(index, cible);
      }
    }
  }

  return arrivees;
}

/** Les mailles du chemin, dans l'ordre de marche, depart exclu. */
function cheminVers(parent: Int32Array, debut: number, arrivee: number): readonly number[] {
  const chemin: number[] = [];

  for (let maille = arrivee; maille !== debut; maille = parent[maille] as number) {
    chemin.push(maille);
  }

  return chemin.reverse();
}

/**
 * Le point le plus lointain du chemin, dans la portee, atteignable en ligne droite.
 *
 * La cible elle-meme si elle est a portee et en vue. A defaut de toute ligne
 * droite libre, la premiere maille du chemin: le moteur fera glisser le joueur.
 */
function pointAViser(
  grille: Grille,
  situation: Situation,
  chemin: readonly number[],
  cible: Position,
): Visee {
  const { terrain, position } = situation;
  const maillesAPortee = Math.floor(PORTEE_DE_VISEE_PX / MAILLE_PX);

  if (chemin.length <= maillesAPortee && trajetTenable(terrain, position, cible, RAYON_ENTITE)) {
    return { point: cible, parUnChemin: true, surLaCible: true };
  }

  for (let rang = Math.min(chemin.length, maillesAPortee) - 1; rang > 0; rang -= 1) {
    const point = centreDeLIndex(grille, chemin[rang] as number);

    if (trajetTenable(terrain, position, point, RAYON_ENTITE)) {
      return { point, parUnChemin: true, surLaCible: false };
    }
  }

  return {
    point: centreDeLIndex(grille, chemin[0] as number),
    parUnChemin: true,
    surLaCible: false,
  };
}

/** L'indice d'une maille si elle existe et est praticable. */
function indexPraticable(grille: Grille, colonne: number, ligne: number): number | undefined {
  if (colonne < 0 || ligne < 0 || colonne >= grille.colonnes || ligne >= grille.lignes) {
    return undefined;
  }

  const index = ligne * grille.colonnes + colonne;

  return grille.praticable[index] === 1 ? index : undefined;
}

/** L'indice de la maille qui contient une position, bornee a la carte. */
function indexDe(grille: Grille, position: Position): number {
  return ligneDe(grille, position.y) * grille.colonnes + colonneDe(grille, position.x);
}

function colonneDe(grille: Grille, x: number): number {
  return Math.min(Math.max(Math.floor(x / MAILLE_PX), 0), grille.colonnes - 1);
}

function ligneDe(grille: Grille, y: number): number {
  return Math.min(Math.max(Math.floor(y / MAILLE_PX), 0), grille.lignes - 1);
}

/** Le centre d'une maille, en pixels de carte. */
function centreDe(colonne: number, ligne: number): Position {
  return { x: (colonne + 0.5) * MAILLE_PX, y: (ligne + 0.5) * MAILLE_PX };
}

/** Le centre de la maille d'indice donne. */
function centreDeLIndex(grille: Grille, index: number): Position {
  return centreDe(index % grille.colonnes, Math.floor(index / grille.colonnes));
}

/** La cible la plus proche a vol d'oiseau. */
function laPlusProche(depart: Position, cibles: readonly Position[]): Position {
  const distance = (cible: Position): number => Math.hypot(cible.x - depart.x, cible.y - depart.y);

  return cibles.reduce((meilleure, cible) =>
    distance(cible) < distance(meilleure) ? cible : meilleure,
  );
}

/**
 * Ce que le pilote voyait a la fin d'une mission echouee.
 *
 * La geometrie plutot qu'un simple constat: les positions recentes, la cible, le
 * point vise et la phase disent si le joueur etait bloque, s'il oscillait, ou s'il
 * suivait un chemin trop long. C'est ce qu'il faut pour corriger sans rejouer a
 * l'aveugle.
 */
function bilan(releves: readonly Releve[]): string {
  const premier = releves[0];
  const dernier = releves.at(-1);

  if (premier === undefined || dernier === undefined) {
    return 'Aucune situation lue.';
  }

  const trajet = echantillon(releves, 6)
    .map((releve) => `${coordonnees(releve.situation.position)} en ${releve.phase}`)
    .join(', ');
  const positions = `Positions sur les ${String(dernier.instant - premier.instant)} dernieres ms: ${trajet}.`;
  const { position, cibles } = dernier.situation;

  if (cibles.length === 0 || dernier.visee === undefined) {
    return `${positions} Aucune cible.`;
  }

  const proche = laPlusProche(position, cibles);
  const distance = Math.hypot(proche.x - position.x, proche.y - position.y);
  const chemin = dernier.visee.parUnChemin ? 'par un chemin trouve' : 'sans chemin trouve';

  return `${positions} ${String(cibles.length)} cibles, la plus proche en ${coordonnees(proche)}, a ${distance.toFixed(0)} px a vol d'oiseau. Visee ${chemin}, vers ${coordonnees(dernier.visee.point)}.`;
}

/** Quelques elements repartis du premier au dernier. */
function echantillon<T>(elements: readonly T[], nombre: number): readonly T[] {
  if (elements.length <= nombre) {
    return elements;
  }

  return Array.from(
    { length: nombre },
    (_, rang) => elements[Math.round((rang * (elements.length - 1)) / (nombre - 1))] as T,
  );
}

/** Une position lisible, au pixel pres. */
function coordonnees(position: Position): string {
  return `(${position.x.toFixed(0)}, ${position.y.toFixed(0)})`;
}

/** Attend un moment. */
async function attendre(millisecondes: number): Promise<void> {
  await new Promise((resoudre) => {
    setTimeout(resoudre, millisecondes);
  });
}
