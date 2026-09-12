/**
 * Le flux d'etat en binaire: une image complete, puis des deltas.
 *
 * C'EST L'ETAPE 2.3. L'instantane d'une partie partait en JSON a chaque battement:
 * 21,5 Ko pour une partie pleine, vingt fois par seconde, a chaque joueur. Ce module
 * le remplace par une TRAME binaire, et le serveur comme le client l'utilisent, pour
 * qu'il n'existe qu'une seule definition du format.
 *
 * DEUX NATURES DE TRAME.
 *
 *   - L'IMAGE decrit toute la partie. Elle part au premier battement, a qui entre
 *     dans une partie en cours, et de temps en temps a tout le monde.
 *   - Le DELTA ne decrit que ce qui a change depuis la trame precedente: les bots
 *     qui ont bouge, un score qui monte, un objet qui apparait. Il nomme la trame a
 *     laquelle il s'applique, et un client qui ne la detient pas l'ignore au lieu de
 *     fabriquer un etat faux.
 *
 * CE QUE LE FORMAT ARRONDIT, ET POURQUOI. Les positions voyagent au huitieme de
 * pixel, les durees a la milliseconde, les couleurs en majuscules. Le client ne
 * simule rien, il dessine: un huitieme de pixel ne se voit pas, et c'est ce qui rend
 * un deplacement de cinq pixels codable sur un seul octet. L'arrondi est fait des
 * deux cotes de la meme facon (quantifierInstantane): le client reconstruit donc
 * exactement, a l'unite pres, ce que le serveur a code. Aucun arrondi ne s'accumule,
 * les deltas portant sur des valeurs deja arrondies.
 *
 * COMMENT UNE LISTE VOYAGE. Chaque liste (entites, objets, zones, classement) est
 * codee par rapport a celle de la trame precedente:
 *
 *   1. sa taille;
 *   2. son ordre, seulement s'il a change: pour chaque place, l'element de la liste
 *      precedente qu'elle reprend, ou un element nouveau;
 *   3. les elements nouveaux en entier, et pour les autres, seulement les champs qui
 *      ont change, precedes d'un octet qui dit lesquels.
 *
 * Un element se reconnait a son identifiant. Il est designe par son rang dans la
 * liste: le client n'a donc rien d'autre a retenir que la derniere partie recue,
 * qu'il detient deja pour la dessiner. Les nombres s'ecrivent sur autant d'octets
 * qu'il en faut (un octet jusqu'a 127), et un champ qui change s'ecrit comme
 * l'ecart a sa valeur precedente: un temps restant qui baisse de cinquante
 * millisecondes tient sur un octet.
 *
 * TOUT CE FICHIER EST PUR. Ni reseau, ni horloge: des nombres en entree, des octets
 * en sortie, et l'inverse. Une trame mal formee leve une ErreurDeTrame, que
 * l'appelant decide de traiter.
 */

import type {
  Couleur,
  Direction,
  Orientation,
  TypeBonus,
  TypeMalus,
  TypeZone,
} from './constantes.js';
import { DIRECTIONS, TYPES_BONUS, TYPES_MALUS, TYPES_ZONE } from './constantes.js';
import type {
  BotVu,
  EntiteVue,
  InstantanePartie,
  JoueurVu,
  LigneClassement,
  ObjetVu,
  TactiqueVue,
  ZoneVue,
} from './evenements.js';

/**
 * Une trame telle qu'elle arrive du reseau.
 *
 * Le serveur envoie des octets; Socket.IO les rend en ArrayBuffer dans un
 * navigateur, et en Buffer (une variante de Uint8Array) sous Node. Le decodage
 * accepte les deux.
 */
export type TrameDEtat = Uint8Array | ArrayBuffer;

/**
 * Version du format. Une trame d'une autre version est refusee, jamais devinee.
 *
 * 2 depuis l'etape 7.1: un joueur peut porter l'etat du mode Tactique.
 */
export const VERSION_DU_FLUX = 2;

/** Les positions voyagent au huitieme de pixel. */
export const SUBDIVISIONS_DU_PIXEL = 8;

/** Ce qu'une trame decrit: toute la partie, ou ce qui a change. */
export type NatureDeTrame = 'image' | 'delta';

/** Ce qu'on lit en tete d'une trame, sans la decoder. */
export interface EnTeteDeTrame {
  readonly nature: NatureDeTrame;
  /** Numero du battement que la trame decrit. */
  readonly tick: number;
  /** Numero du battement auquel un delta s'applique. Absent pour une image. */
  readonly base: number | undefined;
}

/** Une trame codee, et la partie telle que le client la reconstruira. */
export interface TrameEncodee {
  readonly octets: Uint8Array;
  /**
   * La partie arrondie, exactement ce que le client obtiendra en decodant.
   *
   * C'est la reference du delta suivant, et le serveur doit la garder telle quelle.
   */
  readonly reference: InstantanePartie;
}

/** Une trame illisible: tronquee, d'une autre version, ou incoherente. */
export class ErreurDeTrame extends Error {
  constructor(motif: string) {
    super(`Trame d'etat illisible: ${motif}.`);
    this.name = 'ErreurDeTrame';
  }
}

// --------------------------------------------------------------------------
// Les valeurs de base: octets, entiers, textes
// --------------------------------------------------------------------------

/** Nature d'une trame, dans son premier octet. */
const NATURE_IMAGE = 0;
const NATURE_DELTA = 1;

/** Ce que dit l'octet d'ordre d'une liste. */
const ORDRE_INCHANGE = 0;
const ORDRE_TOUT_NOUVEAU = 1;
const ORDRE_EXPLICITE = 2;

/**
 * Plus grand entier que le format accepte, en valeur absolue.
 *
 * Assez pour tout ce que le jeu produit (une coordonnee, une duree, un score), et
 * assez petit pour que les calculs restent exacts dans un nombre JavaScript.
 */
const ENTIER_MAXIMUM = 2 ** 50;

/** Plus grand poids d'un octet lu dans un entier: au-dela, l'entier est trop long. */
const POIDS_MAXIMUM = 128 ** 7;

/** Verifie qu'une valeur est un entier que le format sait ecrire. */
function entierValide(valeur: number, nom: string): number {
  if (!Number.isSafeInteger(valeur) || Math.abs(valeur) > ENTIER_MAXIMUM) {
    throw new Error(`Le flux d'etat ne sait pas coder ${nom} = ${String(valeur)}.`);
  }

  return valeur;
}

/** Des octets qui s'allongent a mesure qu'on ecrit. */
class Ecrivain {
  private octets = new Uint8Array(4096);
  private taille = 0;

  octet(valeur: number): void {
    this.reserver(1);
    this.octets[this.taille] = valeur;
    this.taille += 1;
  }

  /** Un entier positif ou nul, sur sept bits par octet, les petits en premier. */
  entierPositif(valeur: number): void {
    let reste = valeur;

    while (reste >= 128) {
      this.octet((reste % 128) + 128);
      reste = Math.floor(reste / 128);
    }

    this.octet(reste);
  }

  /** Un entier de signe quelconque: les petites valeurs, negatives comprises, tiennent sur un octet. */
  entier(valeur: number): void {
    this.entierPositif(valeur >= 0 ? valeur * 2 : -valeur * 2 - 1);
  }

  /** Un texte en UTF-8, precede de sa longueur en octets. */
  texte(valeur: string): void {
    const codes = versUtf8(valeur);
    this.entierPositif(codes.length);

    for (const code of codes) {
      this.octet(code);
    }
  }

  resultat(): Uint8Array {
    return this.octets.slice(0, this.taille);
  }

  private reserver(nombre: number): void {
    if (this.taille + nombre <= this.octets.length) {
      return;
    }

    const agrandis = new Uint8Array(Math.max(this.octets.length * 2, this.taille + nombre));
    agrandis.set(this.octets.subarray(0, this.taille));
    this.octets = agrandis;
  }
}

/** Des octets que l'on lit dans l'ordre, sans jamais sortir du tableau. */
class Lecteur {
  private position = 0;

  constructor(private readonly octets: Uint8Array) {}

  /** Nombre d'octets qui restent a lire. */
  get restant(): number {
    return this.octets.length - this.position;
  }

  octet(): number {
    const valeur = this.octets[this.position];

    if (valeur === undefined) {
      throw new ErreurDeTrame('elle est tronquee');
    }

    this.position += 1;
    return valeur;
  }

  entierPositif(): number {
    let valeur = 0;
    let poids = 1;

    for (;;) {
      const octet = this.octet();
      valeur += (octet % 128) * poids;

      if (octet < 128) {
        return valeur;
      }

      poids *= 128;

      if (poids > POIDS_MAXIMUM) {
        throw new ErreurDeTrame('un entier y est trop long');
      }
    }
  }

  entier(): number {
    const code = this.entierPositif();

    return code % 2 === 0 ? code / 2 : -(code + 1) / 2;
  }

  texte(): string {
    const longueur = this.entierPositif();

    if (longueur > this.restant) {
      throw new ErreurDeTrame('un texte y depasse la fin');
    }

    const debut = this.position;
    this.position += longueur;

    return depuisUtf8(this.octets, debut, this.position);
  }
}

/**
 * Un texte en octets UTF-8.
 *
 * Ecrit a la main plutot que par TextEncoder: ce paquet ne suppose ni navigateur ni
 * Node. Un caractere isole de paire de substitution, que TextEncoder remplacerait,
 * est garde tel quel: le texte relu est toujours exactement le texte ecrit.
 */
function versUtf8(texte: string): number[] {
  const codes: number[] = [];

  for (const caractere of texte) {
    const point = caractere.codePointAt(0) as number;

    if (point < 0x80) {
      codes.push(point);
    } else if (point < 0x800) {
      codes.push(0xc0 | (point >> 6), 0x80 | (point & 0x3f));
    } else if (point < 0x10000) {
      codes.push(0xe0 | (point >> 12), 0x80 | ((point >> 6) & 0x3f), 0x80 | (point & 0x3f));
    } else {
      codes.push(
        0xf0 | (point >> 18),
        0x80 | ((point >> 12) & 0x3f),
        0x80 | ((point >> 6) & 0x3f),
        0x80 | (point & 0x3f),
      );
    }
  }

  return codes;
}

/** Relit un texte UTF-8 ecrit par versUtf8. */
function depuisUtf8(octets: Uint8Array, debut: number, fin: number): string {
  let texte = '';
  let position = debut;

  const suite = (): number => {
    const octet = position < fin ? (octets[position] as number) : -1;

    if ((octet & 0xc0) !== 0x80) {
      throw new ErreurDeTrame('un texte y est mal forme');
    }

    position += 1;
    return octet & 0x3f;
  };

  while (position < fin) {
    const premier = octets[position] as number;
    position += 1;

    if (premier < 0x80) {
      texte += String.fromCodePoint(premier);
    } else if ((premier & 0xe0) === 0xc0) {
      texte += String.fromCodePoint(((premier & 0x1f) << 6) | suite());
    } else if ((premier & 0xf0) === 0xe0) {
      texte += String.fromCodePoint(((premier & 0x0f) << 12) | (suite() << 6) | suite());
    } else if ((premier & 0xf8) === 0xf0) {
      const point = ((premier & 0x07) << 18) | (suite() << 12) | (suite() << 6) | suite();

      if (point > 0x10ffff) {
        throw new ErreurDeTrame('un texte y est mal forme');
      }

      texte += String.fromCodePoint(point);
    } else {
      throw new ErreurDeTrame('un texte y est mal forme');
    }
  }

  return texte;
}

// --------------------------------------------------------------------------
// Les valeurs du jeu: listes fermees, couleurs, coordonnees
// --------------------------------------------------------------------------

/** Les natures d'entite, dans l'ordre de leur code. */
const TYPES_ENTITE = ['joueur', 'bot', 'botNoir'] as const;

/** Les categories d'objet, dans l'ordre de leur code. */
const CATEGORIES_OBJET = ['bonus', 'malus'] as const;

/** Les natures d'objet, bonus puis malus, dans l'ordre de leur code. */
const NATURES_OBJET: readonly (TypeBonus | TypeMalus)[] = [...TYPES_BONUS, ...TYPES_MALUS];

/** Le code d'une valeur dans sa liste fermee. */
function codeDans<T>(liste: readonly T[], valeur: T, nom: string): number {
  const code = liste.indexOf(valeur);

  if (code < 0) {
    throw new Error(`Le flux d'etat ne connait pas ${nom} = ${String(valeur)}.`);
  }

  return code;
}

/** La valeur d'un code lu dans une trame. */
function valeurDe<T>(liste: readonly T[], code: number): T {
  const valeur = liste[code];

  if (valeur === undefined) {
    throw new ErreurDeTrame(`le code ${String(code)} n'y designe rien`);
  }

  return valeur;
}

/** Une couleur au format du jeu: un diese et six chiffres hexadecimaux. */
const FORME_COULEUR = /^#[0-9A-Fa-f]{6}$/u;

/** La couleur telle qu'elle voyage: en majuscules. */
function couleurArrondie(couleur: Couleur): Couleur {
  if (!FORME_COULEUR.test(couleur)) {
    throw new Error(`Le flux d'etat ne sait pas coder la couleur ${couleur}.`);
  }

  return couleur.toUpperCase();
}

function ecrireCouleur(ecrivain: Ecrivain, couleur: Couleur): void {
  const valeur = Number.parseInt(couleur.slice(1), 16);

  ecrivain.octet(valeur >> 16);
  ecrivain.octet((valeur >> 8) & 0xff);
  ecrivain.octet(valeur & 0xff);
}

function lireCouleur(lecteur: Lecteur): Couleur {
  const valeur = (lecteur.octet() << 16) | (lecteur.octet() << 8) | lecteur.octet();

  return `#${valeur.toString(16).toUpperCase().padStart(6, '0')}`;
}

/** Une coordonnee en huitiemes de pixel, entiers. Le zero negatif devient zero. */
function huitiemes(valeur: number, nom: string): number {
  return entierValide(Math.round(valeur * SUBDIVISIONS_DU_PIXEL) + 0, nom);
}

/** Une coordonnee arrondie au huitieme de pixel. */
function coordonneeArrondie(valeur: number, nom: string): number {
  return huitiemes(valeur, nom) / SUBDIVISIONS_DU_PIXEL;
}

/** Une duree ou un compteur arrondi a l'unite. */
function entierArrondi(valeur: number, nom: string): number {
  return entierValide(Math.round(valeur) + 0, nom);
}

/** Un entier qui ne peut pas etre negatif. */
function positifArrondi(valeur: number, nom: string): number {
  const arrondi = entierArrondi(valeur, nom);

  if (arrondi < 0) {
    throw new Error(`Le flux d'etat attend ${nom} positif, recu ${String(valeur)}.`);
  }

  return arrondi;
}

// --------------------------------------------------------------------------
// L'arrondi d'un instantane: ce que le client reconstruira
// --------------------------------------------------------------------------

/**
 * L'instantane tel qu'il voyage: positions au huitieme de pixel, durees a la
 * milliseconde, couleurs en majuscules.
 *
 * Le decodage d'une trame rend exactement l'instantane arrondi par cette fonction.
 * Arrondir un instantane deja arrondi ne change rien. Une valeur que le format ne
 * sait pas coder (une coordonnee infinie, une direction inconnue) leve une erreur:
 * c'est une faute du serveur, qui ne doit pas partir en silence.
 */
export function quantifierInstantane(instantane: InstantanePartie): InstantanePartie {
  return {
    tick: positifArrondi(instantane.tick, 'tick'),
    tempsRestantMs: positifArrondi(instantane.tempsRestantMs, 'tempsRestantMs'),
    enPause: instantane.enPause,
    entites: instantane.entites.map(entiteArrondie),
    objets: instantane.objets.map(objetArrondi),
    zones: instantane.zones.map(zoneArrondie),
    classement: instantane.classement.map(ligneArrondie),
  };
}

function entiteArrondie(entite: EntiteVue): EntiteVue {
  codeDans(TYPES_ENTITE, entite.type, 'type');
  codeDans(DIRECTIONS, entite.direction, 'direction');

  const commun = {
    id: entite.id,
    x: coordonneeArrondie(entite.x, 'x'),
    y: coordonneeArrondie(entite.y, 'y'),
    couleur: couleurArrondie(entite.couleur),
    direction: entite.direction,
  };

  if (entite.type === 'joueur') {
    return {
      ...commun,
      type: 'joueur',
      pseudo: entite.pseudo,
      invincible: entite.invincible,
      protege: entite.protege,
      ...(entite.tactique === undefined ? {} : { tactique: tactiqueArrondie(entite.tactique) }),
    };
  }

  return { ...commun, type: entite.type };
}

/** Les orientations, dans l'ordre de leur code: les directions, sans l'immobilite. */
const ORIENTATIONS: readonly Orientation[] = DIRECTIONS.filter(
  (direction): direction is Orientation => direction !== 'immobile',
);

/** Les charges d'un joueur voyagent sur un octet. */
const CHARGES_CODABLES = 255;

/** L'etat tactique d'un joueur tel qu'il voyage: charges sur un octet, attente a la milliseconde. */
function tactiqueArrondie(tactique: TactiqueVue): TactiqueVue {
  codeDans(ORIENTATIONS, tactique.orientation, 'orientation');
  const charges = positifArrondi(tactique.charges, 'charges');

  if (charges > CHARGES_CODABLES) {
    throw new Error(`Le flux d'etat ne sait pas coder charges = ${String(tactique.charges)}.`);
  }

  return {
    orientation: tactique.orientation,
    charges,
    avantProchaineChargeMs: positifArrondi(
      tactique.avantProchaineChargeMs,
      'avantProchaineChargeMs',
    ),
  };
}

function objetArrondi(objet: ObjetVu): ObjetVu {
  codeDans(CATEGORIES_OBJET, objet.categorie, 'categorie');
  codeDans(NATURES_OBJET, objet.nature, 'nature');

  return {
    id: objet.id,
    categorie: objet.categorie,
    nature: objet.nature,
    x: coordonneeArrondie(objet.x, 'x'),
    y: coordonneeArrondie(objet.y, 'y'),
    dureeDeVieRestanteMs: positifArrondi(objet.dureeDeVieRestanteMs, 'dureeDeVieRestanteMs'),
  };
}

function zoneArrondie(zone: ZoneVue): ZoneVue {
  codeDans(TYPES_ZONE, zone.type, 'type de zone');

  return {
    id: zone.id,
    type: zone.type,
    x: coordonneeArrondie(zone.x, 'x'),
    y: coordonneeArrondie(zone.y, 'y'),
    rayon: coordonneeArrondie(zone.rayon, 'rayon'),
    dureeRestanteMs: positifArrondi(zone.dureeRestanteMs, 'dureeRestanteMs'),
  };
}

function ligneArrondie(ligne: LigneClassement): LigneClassement {
  return {
    id: ligne.id,
    pseudo: ligne.pseudo,
    couleur: couleurArrondie(ligne.couleur),
    points: entierArrondi(ligne.points, 'points'),
    botsPortes: entierArrondi(ligne.botsPortes, 'botsPortes'),
    pointsBotsNoirs: entierArrondi(ligne.pointsBotsNoirs, 'pointsBotsNoirs'),
    captures: entierArrondi(ligne.captures, 'captures'),
    botsNoirsDetruits: entierArrondi(ligne.botsNoirsDetruits, 'botsNoirsDetruits'),
  };
}

// --------------------------------------------------------------------------
// Les quatre genres d'element d'une liste
// --------------------------------------------------------------------------

/**
 * Comment un genre d'element voyage.
 *
 * Les valeurs recues sont toujours deja arrondies. Le masque dit quels champs d'un
 * element ont change; chaque genre fixe le sens de ses bits.
 */
interface Genre<T> {
  /** L'identifiant qui reconnait un element d'une trame a l'autre. */
  cle(element: T): string;
  /** Deux elements de meme identifiant sont-ils de meme nature? Sinon, le second est un nouveau. */
  memeNature(ancien: T, nouveau: T): boolean;
  /** Les bits que ce genre utilise dans un masque. */
  readonly bitsDuMasque: number;
  ecrireEntier(ecrivain: Ecrivain, element: T): void;
  lireEntier(lecteur: Lecteur): T;
  /** Les champs qui ont change, en bits. Zero: rien n'a change. */
  masque(ancien: T, nouveau: T): number;
  ecrireChangements(ecrivain: Ecrivain, masque: number, ancien: T, nouveau: T): void;
  lireChangements(lecteur: Lecteur, masque: number, ancien: T): T;
}

/** Ecrit l'ecart entre deux coordonnees, en huitiemes de pixel. */
function ecrireEcartDeCoordonnee(ecrivain: Ecrivain, ancienne: number, nouvelle: number): void {
  ecrivain.entier(huitiemes(nouvelle, 'coordonnee') - huitiemes(ancienne, 'coordonnee'));
}

/** Relit une coordonnee a partir de l'ancienne et de l'ecart. */
function lireEcartDeCoordonnee(lecteur: Lecteur, ancienne: number): number {
  return (Math.round(ancienne * SUBDIVISIONS_DU_PIXEL) + lecteur.entier()) / SUBDIVISIONS_DU_PIXEL;
}

function ecrireCoordonnee(ecrivain: Ecrivain, valeur: number): void {
  ecrivain.entier(huitiemes(valeur, 'coordonnee'));
}

function lireCoordonnee(lecteur: Lecteur): number {
  return lecteur.entier() / SUBDIVISIONS_DU_PIXEL;
}

/** Le code d'une valeur dans une liste fermee, sur un octet. */
function ecrireCode<T>(ecrivain: Ecrivain, liste: readonly T[], valeur: T, nom: string): void {
  ecrivain.octet(codeDans(liste, valeur, nom));
}

function lireCode<T>(lecteur: Lecteur, liste: readonly T[]): T {
  return valeurDe(liste, lecteur.octet());
}

/**
 * Les indicateurs d'un joueur, sur un octet: 1 invincible, 2 protege, et 4 quand il
 * porte l'etat du mode Tactique.
 */
function drapeauxDuJoueur(joueur: JoueurVu): number {
  return (
    (joueur.invincible ? 1 : 0) | (joueur.protege ? 2 : 0) | (joueur.tactique === undefined ? 0 : 4)
  );
}

/** Les indicateurs d'un joueur, relus. */
interface DrapeauxDuJoueur {
  readonly invincible: boolean;
  readonly protege: boolean;
  readonly avecTactique: boolean;
}

function lireDrapeauxDuJoueur(lecteur: Lecteur): DrapeauxDuJoueur {
  const drapeaux = lecteur.octet();

  if (drapeaux > 7) {
    throw new ErreurDeTrame("les indicateurs d'un joueur y sont inconnus");
  }

  return {
    invincible: (drapeaux & 1) !== 0,
    protege: (drapeaux & 2) !== 0,
    avecTactique: (drapeaux & 4) !== 0,
  };
}

/**
 * L'etat tactique dont part un joueur qui n'en portait pas encore.
 *
 * Un delta ecrit l'etat tactique d'un joueur par rapport a celui qu'il portait, ou,
 * s'il n'en portait pas, par rapport a celui-ci. Codage et decodage partent du meme.
 */
const TACTIQUE_DE_REFERENCE: TactiqueVue = {
  orientation: 'nord',
  charges: 0,
  avantProchaineChargeMs: 0,
};

/** Les bits du masque d'un joueur qui portent son etat tactique. */
const BITS_TACTIQUES = 64 | 128;

function ecrireTactique(ecrivain: Ecrivain, tactique: TactiqueVue): void {
  ecrireCode(ecrivain, ORIENTATIONS, tactique.orientation, 'orientation');
  ecrivain.octet(tactique.charges);
  ecrivain.entierPositif(tactique.avantProchaineChargeMs);
}

function lireTactique(lecteur: Lecteur): TactiqueVue {
  return {
    orientation: lireCode(lecteur, ORIENTATIONS),
    charges: lecteur.octet(),
    avantProchaineChargeMs: lecteur.entierPositif(),
  };
}

/**
 * Les entites. Bits du masque: 1 x, 2 y, 4 couleur, 8 direction, et pour un joueur,
 * 16 pseudo, 32 indicateurs, puis, dans le mode Tactique, 64 orientation et 128
 * charges et attente de la prochaine.
 */
const ENTITES: Genre<EntiteVue> = {
  cle: (entite) => entite.id,
  memeNature: (ancienne, nouvelle) => ancienne.type === nouvelle.type,
  bitsDuMasque: 255,

  ecrireEntier: (ecrivain, entite) => {
    ecrivain.texte(entite.id);
    ecrireCode(ecrivain, TYPES_ENTITE, entite.type, 'type');
    ecrireCoordonnee(ecrivain, entite.x);
    ecrireCoordonnee(ecrivain, entite.y);
    ecrireCouleur(ecrivain, entite.couleur);
    ecrireCode(ecrivain, DIRECTIONS, entite.direction, 'direction');

    if (entite.type === 'joueur') {
      ecrivain.texte(entite.pseudo);
      ecrivain.octet(drapeauxDuJoueur(entite));

      if (entite.tactique !== undefined) {
        ecrireTactique(ecrivain, entite.tactique);
      }
    }
  },

  lireEntier: (lecteur) => {
    const id = lecteur.texte();
    const type = lireCode(lecteur, TYPES_ENTITE);
    const commun = {
      id,
      x: lireCoordonnee(lecteur),
      y: lireCoordonnee(lecteur),
      couleur: lireCouleur(lecteur),
      direction: lireCode<Direction>(lecteur, DIRECTIONS),
    };

    if (type === 'joueur') {
      const pseudo = lecteur.texte();
      const { avecTactique, ...drapeaux } = lireDrapeauxDuJoueur(lecteur);

      return {
        ...commun,
        type,
        pseudo,
        ...drapeaux,
        ...(avecTactique ? { tactique: lireTactique(lecteur) } : {}),
      };
    }

    const bot: BotVu = { ...commun, type };
    return bot;
  },

  masque: (ancienne, nouvelle) => {
    let masque = 0;

    if (ancienne.x !== nouvelle.x) masque |= 1;
    if (ancienne.y !== nouvelle.y) masque |= 2;
    if (ancienne.couleur !== nouvelle.couleur) masque |= 4;
    if (ancienne.direction !== nouvelle.direction) masque |= 8;

    if (ancienne.type === 'joueur' && nouvelle.type === 'joueur') {
      if (ancienne.pseudo !== nouvelle.pseudo) masque |= 16;
      if (drapeauxDuJoueur(ancienne) !== drapeauxDuJoueur(nouvelle)) masque |= 32;

      if (nouvelle.tactique !== undefined) {
        const avant = ancienne.tactique ?? TACTIQUE_DE_REFERENCE;
        const apres = nouvelle.tactique;

        if (avant.orientation !== apres.orientation) masque |= 64;
        if (
          avant.charges !== apres.charges ||
          avant.avantProchaineChargeMs !== apres.avantProchaineChargeMs
        ) {
          masque |= 128;
        }
      }
    }

    return masque;
  },

  ecrireChangements: (ecrivain, masque, ancienne, nouvelle) => {
    if (masque & 1) ecrireEcartDeCoordonnee(ecrivain, ancienne.x, nouvelle.x);
    if (masque & 2) ecrireEcartDeCoordonnee(ecrivain, ancienne.y, nouvelle.y);
    if (masque & 4) ecrireCouleur(ecrivain, nouvelle.couleur);
    if (masque & 8) ecrireCode(ecrivain, DIRECTIONS, nouvelle.direction, 'direction');

    if (nouvelle.type === 'joueur') {
      if (masque & 16) ecrivain.texte(nouvelle.pseudo);
      if (masque & 32) ecrivain.octet(drapeauxDuJoueur(nouvelle));

      if (nouvelle.tactique !== undefined) {
        const avant =
          (ancienne.type === 'joueur' ? ancienne.tactique : undefined) ?? TACTIQUE_DE_REFERENCE;
        const apres = nouvelle.tactique;

        if (masque & 64) ecrireCode(ecrivain, ORIENTATIONS, apres.orientation, 'orientation');
        if (masque & 128) {
          ecrivain.octet(apres.charges);
          ecrivain.entier(apres.avantProchaineChargeMs - avant.avantProchaineChargeMs);
        }
      }
    }
  },

  lireChangements: (lecteur, masque, ancienne) => {
    const commun = {
      id: ancienne.id,
      x: masque & 1 ? lireEcartDeCoordonnee(lecteur, ancienne.x) : ancienne.x,
      y: masque & 2 ? lireEcartDeCoordonnee(lecteur, ancienne.y) : ancienne.y,
      couleur: masque & 4 ? lireCouleur(lecteur) : ancienne.couleur,
      direction: masque & 8 ? lireCode<Direction>(lecteur, DIRECTIONS) : ancienne.direction,
    };

    if (ancienne.type !== 'joueur') {
      if (masque & (48 | BITS_TACTIQUES)) {
        throw new ErreurDeTrame('un bot y porte un champ de joueur');
      }

      const bot: BotVu = { ...commun, type: ancienne.type };
      return bot;
    }

    const pseudo = masque & 16 ? lecteur.texte() : ancienne.pseudo;
    const { avecTactique, ...drapeaux } =
      masque & 32
        ? lireDrapeauxDuJoueur(lecteur)
        : {
            invincible: ancienne.invincible,
            protege: ancienne.protege,
            avecTactique: ancienne.tactique !== undefined,
          };

    if (!avecTactique) {
      if (masque & BITS_TACTIQUES) {
        throw new ErreurDeTrame('un joueur sans etat tactique y en change un');
      }

      return { ...commun, type: 'joueur', pseudo, ...drapeaux };
    }

    const avant = ancienne.tactique ?? TACTIQUE_DE_REFERENCE;
    const orientation = masque & 64 ? lireCode(lecteur, ORIENTATIONS) : avant.orientation;
    const tactique: TactiqueVue =
      masque & 128
        ? {
            orientation,
            charges: lecteur.octet(),
            avantProchaineChargeMs: positifLu(avant.avantProchaineChargeMs + lecteur.entier()),
          }
        : { ...avant, orientation };

    return { ...commun, type: 'joueur', pseudo, ...drapeaux, tactique };
  },
};

/** Les objets poses. Bits du masque: 1 x, 2 y, 4 duree de vie. */
const OBJETS: Genre<ObjetVu> = {
  cle: (objet) => objet.id,
  memeNature: (ancien, nouveau) =>
    ancien.categorie === nouveau.categorie && ancien.nature === nouveau.nature,
  bitsDuMasque: 7,

  ecrireEntier: (ecrivain, objet) => {
    ecrivain.texte(objet.id);
    ecrireCode(ecrivain, CATEGORIES_OBJET, objet.categorie, 'categorie');
    ecrireCode(ecrivain, NATURES_OBJET, objet.nature, 'nature');
    ecrireCoordonnee(ecrivain, objet.x);
    ecrireCoordonnee(ecrivain, objet.y);
    ecrivain.entierPositif(objet.dureeDeVieRestanteMs);
  },

  lireEntier: (lecteur) => ({
    id: lecteur.texte(),
    categorie: lireCode(lecteur, CATEGORIES_OBJET),
    nature: lireCode(lecteur, NATURES_OBJET),
    x: lireCoordonnee(lecteur),
    y: lireCoordonnee(lecteur),
    dureeDeVieRestanteMs: lecteur.entierPositif(),
  }),

  masque: (ancien, nouveau) =>
    (ancien.x !== nouveau.x ? 1 : 0) |
    (ancien.y !== nouveau.y ? 2 : 0) |
    (ancien.dureeDeVieRestanteMs !== nouveau.dureeDeVieRestanteMs ? 4 : 0),

  ecrireChangements: (ecrivain, masque, ancien, nouveau) => {
    if (masque & 1) ecrireEcartDeCoordonnee(ecrivain, ancien.x, nouveau.x);
    if (masque & 2) ecrireEcartDeCoordonnee(ecrivain, ancien.y, nouveau.y);
    if (masque & 4) ecrivain.entier(nouveau.dureeDeVieRestanteMs - ancien.dureeDeVieRestanteMs);
  },

  lireChangements: (lecteur, masque, ancien) => ({
    ...ancien,
    x: masque & 1 ? lireEcartDeCoordonnee(lecteur, ancien.x) : ancien.x,
    y: masque & 2 ? lireEcartDeCoordonnee(lecteur, ancien.y) : ancien.y,
    dureeDeVieRestanteMs:
      masque & 4
        ? positifLu(ancien.dureeDeVieRestanteMs + lecteur.entier())
        : ancien.dureeDeVieRestanteMs,
  }),
};

/** Les zones speciales. Bits du masque: 1 x, 2 y, 4 rayon, 8 duree restante. */
const ZONES: Genre<ZoneVue> = {
  cle: (zone) => zone.id,
  memeNature: (ancienne, nouvelle) => ancienne.type === nouvelle.type,
  bitsDuMasque: 15,

  ecrireEntier: (ecrivain, zone) => {
    ecrivain.texte(zone.id);
    ecrireCode<TypeZone>(ecrivain, TYPES_ZONE, zone.type, 'type de zone');
    ecrireCoordonnee(ecrivain, zone.x);
    ecrireCoordonnee(ecrivain, zone.y);
    ecrireCoordonnee(ecrivain, zone.rayon);
    ecrivain.entierPositif(zone.dureeRestanteMs);
  },

  lireEntier: (lecteur) => ({
    id: lecteur.texte(),
    type: lireCode<TypeZone>(lecteur, TYPES_ZONE),
    x: lireCoordonnee(lecteur),
    y: lireCoordonnee(lecteur),
    rayon: lireCoordonnee(lecteur),
    dureeRestanteMs: lecteur.entierPositif(),
  }),

  masque: (ancienne, nouvelle) =>
    (ancienne.x !== nouvelle.x ? 1 : 0) |
    (ancienne.y !== nouvelle.y ? 2 : 0) |
    (ancienne.rayon !== nouvelle.rayon ? 4 : 0) |
    (ancienne.dureeRestanteMs !== nouvelle.dureeRestanteMs ? 8 : 0),

  ecrireChangements: (ecrivain, masque, ancienne, nouvelle) => {
    if (masque & 1) ecrireEcartDeCoordonnee(ecrivain, ancienne.x, nouvelle.x);
    if (masque & 2) ecrireEcartDeCoordonnee(ecrivain, ancienne.y, nouvelle.y);
    if (masque & 4) ecrireEcartDeCoordonnee(ecrivain, ancienne.rayon, nouvelle.rayon);
    if (masque & 8) ecrivain.entier(nouvelle.dureeRestanteMs - ancienne.dureeRestanteMs);
  },

  lireChangements: (lecteur, masque, ancienne) => ({
    ...ancienne,
    x: masque & 1 ? lireEcartDeCoordonnee(lecteur, ancienne.x) : ancienne.x,
    y: masque & 2 ? lireEcartDeCoordonnee(lecteur, ancienne.y) : ancienne.y,
    rayon: masque & 4 ? lireEcartDeCoordonnee(lecteur, ancienne.rayon) : ancienne.rayon,
    dureeRestanteMs:
      masque & 8
        ? positifLu(ancienne.dureeRestanteMs + lecteur.entier())
        : ancienne.dureeRestanteMs,
  }),
};

/** Les champs numeriques d'une ligne de classement, dans l'ordre de leurs bits (4 a 64). */
const COMPTES_DU_CLASSEMENT = [
  'points',
  'botsPortes',
  'pointsBotsNoirs',
  'captures',
  'botsNoirsDetruits',
] as const;

/** Le classement. Bits du masque: 1 pseudo, 2 couleur, puis un bit par compte. */
const CLASSEMENT: Genre<LigneClassement> = {
  cle: (ligne) => ligne.id,
  memeNature: () => true,
  bitsDuMasque: 127,

  ecrireEntier: (ecrivain, ligne) => {
    ecrivain.texte(ligne.id);
    ecrivain.texte(ligne.pseudo);
    ecrireCouleur(ecrivain, ligne.couleur);

    for (const compte of COMPTES_DU_CLASSEMENT) {
      ecrivain.entier(ligne[compte]);
    }
  },

  lireEntier: (lecteur) => {
    const id = lecteur.texte();
    const pseudo = lecteur.texte();
    const couleur = lireCouleur(lecteur);

    return {
      id,
      pseudo,
      couleur,
      points: lecteur.entier(),
      botsPortes: lecteur.entier(),
      pointsBotsNoirs: lecteur.entier(),
      captures: lecteur.entier(),
      botsNoirsDetruits: lecteur.entier(),
    };
  },

  masque: (ancienne, nouvelle) => {
    let masque =
      (ancienne.pseudo !== nouvelle.pseudo ? 1 : 0) |
      (ancienne.couleur !== nouvelle.couleur ? 2 : 0);

    COMPTES_DU_CLASSEMENT.forEach((compte, rang) => {
      if (ancienne[compte] !== nouvelle[compte]) {
        masque |= 4 << rang;
      }
    });

    return masque;
  },

  ecrireChangements: (ecrivain, masque, ancienne, nouvelle) => {
    if (masque & 1) ecrivain.texte(nouvelle.pseudo);
    if (masque & 2) ecrireCouleur(ecrivain, nouvelle.couleur);

    COMPTES_DU_CLASSEMENT.forEach((compte, rang) => {
      if (masque & (4 << rang)) {
        ecrivain.entier(nouvelle[compte] - ancienne[compte]);
      }
    });
  },

  lireChangements: (lecteur, masque, ancienne) => {
    const pseudo = masque & 1 ? lecteur.texte() : ancienne.pseudo;
    const couleur = masque & 2 ? lireCouleur(lecteur) : ancienne.couleur;
    const comptes = COMPTES_DU_CLASSEMENT.map((compte, rang) =>
      masque & (4 << rang) ? ancienne[compte] + lecteur.entier() : ancienne[compte],
    ) as [number, number, number, number, number];

    return {
      id: ancienne.id,
      pseudo,
      couleur,
      points: comptes[0],
      botsPortes: comptes[1],
      pointsBotsNoirs: comptes[2],
      captures: comptes[3],
      botsNoirsDetruits: comptes[4],
    };
  },
};

/** Une duree relue par ecart ne peut pas devenir negative. */
function positifLu(valeur: number): number {
  if (valeur < 0) {
    throw new ErreurDeTrame('une duree y devient negative');
  }

  return valeur;
}

// --------------------------------------------------------------------------
// Une liste: son ordre, puis ses changements
// --------------------------------------------------------------------------

/** Ce qu'un element ecrit dans la liste: tout, ou seulement ses changements. */
interface Changement<T> {
  readonly rang: number;
  readonly element: T;
  /** Absent: l'element est nouveau et s'ecrit en entier. */
  readonly ancien: T | undefined;
  readonly masque: number;
}

/** Ecrit une liste par rapport a celle de la trame precedente. */
function ecrireListe<T>(
  ecrivain: Ecrivain,
  genre: Genre<T>,
  anciens: readonly T[],
  nouveaux: readonly T[],
): void {
  ecrivain.entierPositif(nouveaux.length);

  const origines = originesDesElements(genre, anciens, nouveaux);

  if (origines === 'inchange') {
    ecrivain.octet(ORDRE_INCHANGE);
  } else if (anciens.length === 0) {
    ecrivain.octet(ORDRE_TOUT_NOUVEAU);
  } else {
    ecrivain.octet(ORDRE_EXPLICITE);

    for (const origine of origines) {
      ecrivain.entierPositif(origine + 1);
    }
  }

  const changements: Changement<T>[] = [];

  nouveaux.forEach((element, rang) => {
    const origine = origines === 'inchange' ? rang : (origines[rang] as number);
    const ancien = origine < 0 ? undefined : (anciens[origine] as T);

    if (ancien === undefined) {
      changements.push({ rang, element, ancien, masque: 0 });
      return;
    }

    const masque = genre.masque(ancien, element);

    if (masque !== 0) {
      changements.push({ rang, element, ancien, masque });
    }
  });

  ecrivain.entierPositif(changements.length);

  let precedent = -1;

  for (const changement of changements) {
    ecrivain.entierPositif(changement.rang - precedent - 1);
    precedent = changement.rang;

    if (changement.ancien === undefined) {
      genre.ecrireEntier(ecrivain, changement.element);
    } else {
      ecrivain.octet(changement.masque);
      genre.ecrireChangements(ecrivain, changement.masque, changement.ancien, changement.element);
    }
  }
}

/**
 * Pour chaque element de la nouvelle liste, le rang de l'ancien qu'il reprend, ou
 * -1 s'il est nouveau. « inchange » quand la liste a les memes elements, dans le
 * meme ordre.
 */
function originesDesElements<T>(
  genre: Genre<T>,
  anciens: readonly T[],
  nouveaux: readonly T[],
): readonly number[] | 'inchange' {
  const memeOrdre =
    anciens.length === nouveaux.length &&
    nouveaux.every((element, rang) => {
      const ancien = anciens[rang] as T;
      return genre.cle(ancien) === genre.cle(element) && genre.memeNature(ancien, element);
    });

  if (memeOrdre) {
    return 'inchange';
  }

  const rangs = new Map(anciens.map((ancien, rang) => [genre.cle(ancien), rang]));

  return nouveaux.map((element) => {
    const rang = rangs.get(genre.cle(element));

    return rang !== undefined && genre.memeNature(anciens[rang] as T, element) ? rang : -1;
  });
}

/** Relit une liste a partir de celle de la trame precedente. */
function lireListe<T>(lecteur: Lecteur, genre: Genre<T>, anciens: readonly T[]): T[] {
  const taille = lecteur.entierPositif();
  const ordre = lecteur.octet();
  const origines: number[] = [];

  if (ordre === ORDRE_INCHANGE) {
    if (taille !== anciens.length) {
      throw new ErreurDeTrame("une liste y change de taille sans changer d'ordre");
    }

    for (let rang = 0; rang < taille; rang += 1) {
      origines.push(rang);
    }
  } else if (ordre === ORDRE_TOUT_NOUVEAU || ordre === ORDRE_EXPLICITE) {
    // Chaque element nouveau ou repris coute au moins un octet: une taille plus grande
    // que ce qui reste ne peut venir que d'une trame fausse.
    if (taille > lecteur.restant) {
      throw new ErreurDeTrame("une liste y annonce plus d'elements qu'il n'y a d'octets");
    }

    for (let rang = 0; rang < taille; rang += 1) {
      const origine = ordre === ORDRE_TOUT_NOUVEAU ? -1 : lecteur.entierPositif() - 1;

      if (origine >= anciens.length) {
        throw new ErreurDeTrame('une liste y reprend un element qui n existait pas');
      }

      origines.push(origine);
    }
  } else {
    throw new ErreurDeTrame(`l'ordre ${String(ordre)} y est inconnu`);
  }

  const elements: (T | undefined)[] = origines.map((origine) =>
    origine < 0 ? undefined : anciens[origine],
  );

  const nombreDeChangements = lecteur.entierPositif();

  if (nombreDeChangements > taille) {
    throw new ErreurDeTrame("une liste y change plus d'elements qu'elle n'en a");
  }

  let precedent = -1;

  for (let lu = 0; lu < nombreDeChangements; lu += 1) {
    const rang = precedent + 1 + lecteur.entierPositif();

    if (rang >= taille) {
      throw new ErreurDeTrame('un changement y vise un rang hors de la liste');
    }

    precedent = rang;
    const origine = origines[rang] as number;

    if (origine < 0) {
      elements[rang] = genre.lireEntier(lecteur);
      continue;
    }

    const masque = lecteur.octet();

    if (masque === 0 || (masque & ~genre.bitsDuMasque) !== 0) {
      throw new ErreurDeTrame(`le masque ${String(masque)} y est invalide`);
    }

    elements[rang] = genre.lireChangements(lecteur, masque, anciens[origine] as T);
  }

  if (elements.some((element) => element === undefined)) {
    throw new ErreurDeTrame('un element nouveau y est annonce sans son contenu');
  }

  return elements as T[];
}

// --------------------------------------------------------------------------
// Les trames
// --------------------------------------------------------------------------

/**
 * Code une image: toute la partie, que l'on detienne une trame precedente ou non.
 *
 * @returns Les octets, et la partie arrondie, reference du delta suivant.
 */
export function encoderImage(instantane: InstantanePartie): TrameEncodee {
  return encoder(undefined, instantane);
}

/**
 * Code un delta: ce qui a change depuis la reference.
 *
 * @param reference La reference rendue par le codage de la trame precedente. Son
 *                  battement doit etre plus ancien que celui de l'instantane.
 */
export function encoderDelta(
  reference: InstantanePartie,
  instantane: InstantanePartie,
): TrameEncodee {
  return encoder(reference, instantane);
}

function encoder(
  reference: InstantanePartie | undefined,
  instantane: InstantanePartie,
): TrameEncodee {
  const partie = quantifierInstantane(instantane);
  const ecrivain = new Ecrivain();

  ecrivain.octet(VERSION_DU_FLUX * 2 + (reference === undefined ? NATURE_IMAGE : NATURE_DELTA));
  ecrivain.entierPositif(partie.tick);

  if (reference === undefined) {
    ecrivain.entierPositif(partie.tempsRestantMs);
  } else {
    const ecart = partie.tick - reference.tick;

    if (!Number.isSafeInteger(ecart) || ecart < 1) {
      throw new Error(
        `Un delta doit suivre sa reference: battement ${String(partie.tick)} apres ${String(reference.tick)}.`,
      );
    }

    ecrivain.entierPositif(ecart);
    ecrivain.entier(partie.tempsRestantMs - Math.round(reference.tempsRestantMs));
  }

  ecrivain.octet(partie.enPause ? 1 : 0);

  ecrireListe(ecrivain, ENTITES, reference?.entites ?? [], partie.entites);
  ecrireListe(ecrivain, OBJETS, reference?.objets ?? [], partie.objets);
  ecrireListe(ecrivain, ZONES, reference?.zones ?? [], partie.zones);
  ecrireListe(ecrivain, CLASSEMENT, reference?.classement ?? [], partie.classement);

  return { octets: ecrivain.resultat(), reference: partie };
}

/** Des octets, quelle que soit la forme sous laquelle le reseau les a rendus. */
function octetsDe(trame: TrameDEtat): Uint8Array {
  return ArrayBuffer.isView(trame)
    ? new Uint8Array(trame.buffer, trame.byteOffset, trame.byteLength)
    : new Uint8Array(trame);
}

/** Lit l'en-tete d'une trame. */
function lireLEnTete(lecteur: Lecteur): EnTeteDeTrame {
  const premier = lecteur.octet();
  const version = Math.floor(premier / 2);

  if (version !== VERSION_DU_FLUX) {
    throw new ErreurDeTrame(`sa version ${String(version)} est inconnue`);
  }

  const nature: NatureDeTrame = premier % 2 === NATURE_IMAGE ? 'image' : 'delta';
  const tick = lecteur.entierPositif();

  if (nature === 'image') {
    return { nature, tick, base: undefined };
  }

  const ecart = lecteur.entierPositif();

  if (ecart < 1 || ecart > tick) {
    throw new ErreurDeTrame('son battement de reference est incoherent');
  }

  return { nature, tick, base: tick - ecart };
}

/** Ce qu'une trame dit d'elle-meme: sa nature, son battement, et celui qu'elle suppose. */
export function lireEnTete(trame: TrameDEtat): EnTeteDeTrame {
  return lireLEnTete(new Lecteur(octetsDe(trame)));
}

/**
 * Reconstruit la partie a partir d'une trame.
 *
 * Une image s'applique toujours. Un delta ne s'applique qu'a la partie dont il
 * nomme le battement: sur une autre, ou sans partie, il rend undefined, et
 * l'appelant garde ce qu'il avait en attendant la prochaine image.
 *
 * @param reference La partie detenue: celle que la trame precedente a reconstruite.
 * @throws ErreurDeTrame si la trame est mal formee.
 */
export function appliquerTrame(
  reference: InstantanePartie | undefined,
  trame: TrameDEtat,
): InstantanePartie | undefined {
  const lecteur = new Lecteur(octetsDe(trame));
  const enTete = lireLEnTete(lecteur);

  if (enTete.nature === 'delta' && reference?.tick !== enTete.base) {
    return undefined;
  }

  const base = enTete.nature === 'delta' ? reference : undefined;
  const tempsRestantMs =
    base === undefined
      ? lecteur.entierPositif()
      : positifLu(Math.round(base.tempsRestantMs) + lecteur.entier());

  const drapeaux = lecteur.octet();

  if (drapeaux > 1) {
    throw new ErreurDeTrame('ses indicateurs sont inconnus');
  }

  const partie: InstantanePartie = {
    tick: enTete.tick,
    tempsRestantMs,
    enPause: drapeaux === 1,
    entites: lireListe(lecteur, ENTITES, base?.entites ?? []),
    objets: lireListe(lecteur, OBJETS, base?.objets ?? []),
    zones: lireListe(lecteur, ZONES, base?.zones ?? []),
    classement: lireListe(lecteur, CLASSEMENT, base?.classement ?? []),
  };

  if (lecteur.restant !== 0) {
    throw new ErreurDeTrame('des octets y restent apres la fin');
  }

  return partie;
}
