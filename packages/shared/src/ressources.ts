/**
 * Ou trouver les ressources du jeu: les cartes, les sprites, les icones, les sons.
 *
 * CE FICHIER NE LIT AUCUN FICHIER. Il ne fabrique que des CHEMINS, c'est-a-dire
 * des chaines de caracteres. C'est pour cela qu'il a sa place dans le paquet
 * partage: le serveur les resout sur son disque pour decoder les collisions, le
 * client les demande a une adresse pour les afficher, et les deux parlent de la
 * meme arborescence, ecrite une seule fois.
 *
 * POURQUOI CENTRALISER DES CHEMINS. Dans le client d'origine, la construction des
 * chemins etait recopiee a chaque endroit qui en avait besoin: MapManager
 * fabriquait le sien, AudioManager le sien, le gestionnaire de sprites le sien.
 * Deplacer un dossier obligeait a retrouver toutes les copies, et en oublier une
 * ne se voyait qu'a l'execution, sous la forme d'une image manquante. Ici il n'y
 * a qu'un endroit a changer, et une faute de frappe est une erreur de
 * compilation.
 *
 * L'ARBORESCENCE, ecrite une fois pour toutes:
 *
 *   assets/cartes/<carte>/<normal|mirror>/<background|collision|foreground>.png
 *   assets/ninja/<direction>_<1|2>.png, et idle.png
 *   assets/objets/<icone>.png
 *   assets/sons/<son>.<mp3|wav>
 *
 * Les noms de fichiers sont ceux du jeu d'origine, en anglais. Ce sont des noms
 * de CONTENU, pas de code: les renommer obligerait a retoucher des images qui
 * n'ont pas change, pour un gain nul. Leur provenance exacte est dans
 * assets/README.md.
 */

import type { TypeBonus, TypeMalus } from './constantes.js';
import type { Direction } from './constantes.js';

/**
 * Racine des ressources telle que le navigateur la demande.
 *
 * Le serveur servira ce dossier a cette adresse a l'etape 4.3. Cote serveur, la
 * racine est un chemin de disque, qui n'a rien a faire dans un fichier partage:
 * il se calcule dans packages/server.
 */
export const RACINE_RESSOURCES = '/assets';

/** Les trois couches d'image d'une carte. */
export type CoucheCarte =
  /** Le decor, dessine sous les entites. */
  | 'background'
  /** Le masque des murs, lu par le serveur, jamais affiche. */
  | 'collision'
  /** Ce qui passe devant les entites: toitures, feuillages. */
  | 'foreground';

/**
 * Chemin relatif d'une couche de carte, depuis la racine des ressources.
 *
 * LE MODE MIROIR EST UN JEU D'IMAGES, PAS UNE TRANSFORMATION. Le jeu d'origine
 * ne retourne rien a l'affichage: il dessine des images deja retournees, rangees
 * dans un dossier voisin. On garde ce fonctionnement, parce qu'il permet a une
 * carte miroir de differer de son originale autrement que par une symetrie, et
 * parce que retourner le masque de collision a l'execution couterait un balayage
 * complet pour un resultat identique.
 */
export function cheminCarte(carte: string, modeMiroir: boolean, couche: CoucheCarte): string {
  return `cartes/${carte}/${modeMiroir ? 'mirror' : 'normal'}/${couche}.png`;
}

/**
 * Chemin relatif de l'effet de pluie d'une carte, s'il en existe un.
 *
 * Seule map1 en a un dans le jeu d'origine. Rendre l'absence explicite evite au
 * client de demander une image qui n'existe pas, ce que le legacy faisait pour
 * les deux autres cartes.
 */
export function cheminPluie(carte: string, modeMiroir: boolean): string | undefined {
  return carte === 'map1'
    ? `cartes/${carte}/${modeMiroir ? 'mirror' : 'normal'}/rain.png`
    : undefined;
}

/**
 * Chemin relatif de la vignette d'une carte, montree dans les reglages du salon.
 *
 * Une seule vignette par carte, mode miroir compris, comme dans le jeu d'origine.
 * Celles de map1 et map2 sont le meme fichier, et ce n'est pas une erreur: les
 * deux cartes partagent leur decor, la premiere y ajoute la pluie.
 */
export function cheminApercuCarte(carte: string): string {
  return `cartes/${carte}/preview.png`;
}

/**
 * Correspondance entre les directions du moteur et les noms de fichiers du jeu
 * d'origine, qui sont en anglais et qu'on ne renomme pas.
 */
const NOM_DE_DIRECTION: Readonly<Record<Direction, string>> = {
  immobile: 'idle',
  nord: 'north',
  nord_est: 'north_east',
  est: 'east',
  sud_est: 'south_east',
  sud: 'south',
  sud_ouest: 'south_west',
  ouest: 'west',
  nord_ouest: 'north_west',
};

/**
 * Nombre d'images de la marche, pour chaque direction sauf l'immobilite.
 *
 * Deux images par direction, alternees pendant le deplacement. C'est
 * l'animation du jeu d'origine, et sa cadence est dans le client.
 */
export const IMAGES_DE_MARCHE = 2;

/**
 * Chemin relatif d'un sprite de ninja.
 *
 * @param direction Direction affichee. L'immobilite a une seule image.
 * @param image     Numero de l'image de marche, a partir de un. Ignore pour
 *                  l'immobilite, qui n'en a qu'une.
 */
export function cheminNinja(direction: Direction, image: number = 1): string {
  const nom = NOM_DE_DIRECTION[direction];

  if (direction === 'immobile') {
    return `ninja/${nom}.png`;
  }

  return `ninja/${nom}_${String(image)}.png`;
}

/** Toutes les images de ninja a charger, sans doublon. */
export function tousLesNinjas(): readonly string[] {
  const chemins = new Set<string>();

  for (const direction of Object.keys(NOM_DE_DIRECTION) as Direction[]) {
    for (let image = 1; image <= IMAGES_DE_MARCHE; image += 1) {
      chemins.add(cheminNinja(direction, image));
    }
  }

  return [...chemins];
}

/** Nom du fichier d'icone de chaque bonus et de chaque malus. */
const ICONE_OBJET: Readonly<Record<TypeBonus | TypeMalus, string>> = {
  vitesse: 'speed',
  invincibilite: 'shield',
  revelation: 'eye',
  controlesInverses: 'reverse',
  flou: 'blur',
  negatif: 'negative',
};

/** Chemin relatif de l'icone d'un bonus ou d'un malus. */
export function cheminObjet(nature: TypeBonus | TypeMalus): string {
  return `objets/${ICONE_OBJET[nature]}.png`;
}

/** Toutes les icones d'objet a charger. */
export function tousLesObjets(): readonly string[] {
  return Object.values(ICONE_OBJET).map((icone) => `objets/${icone}.png`);
}

/**
 * Les sons du jeu, nommes par ce qu'ils SIGNIFIENT et non par leur fichier.
 *
 * C'est la correction d'un defaut du jeu d'origine. Son gestionnaire audio
 * rangeait ses sons dans une table indexee par des chaines libres, et le client
 * les demandait par des noms qui n'y figuraient pas: « collectBonus » et
 * « collectMalus » etaient joues a chaque ramassage alors que la table
 * s'appelait « bonus » et « malus ». La lecture echouait en silence, si bien que
 * les sons de ramassage n'ont jamais ete entendus. Ici la table est un type: un
 * nom qui n'existe pas ne compile pas.
 */
export const SONS = {
  /** Un bonus vient d'etre ramasse. */
  bonusRamasse: 'collect-bonus.wav',
  /** Un malus vient d'etre ramasse ou subi. */
  malusRamasse: 'collect-malus.wav',
  /** Un bot vient de changer de camp. */
  botCapture: 'bot-convert.mp3',
  /** Une capture generique, plus large que le changement de camp d'un bot. */
  capture: 'capture.wav',
  /** Nous venons de capturer un joueur. */
  joueurCapture: 'player-capture.mp3',
  /** Nous venons d'etre capture. */
  joueurCaptureSubi: 'player-captured.mp3',
  /** Nous venons de detruire un bot noir. */
  botNoirDetruit: 'blackbot-destroy.mp3',
  /** La partie demarre. */
  partieLancee: 'game-start.wav',
  /** La partie est finie. */
  partieTerminee: 'game-over.wav',
  /** Un battement du compte a rebours de demarrage. */
  compteARebours: 'countdown-tick.wav',
  /** Le dernier battement du compte a rebours. */
  compteAReboursFinal: 'final-tick.wav',
  /** Les dernieres secondes de la partie. */
  tempsPresqueEcoule: 'urgent-tick.mp3',
  /** Quelqu'un a parle dans le chat. */
  chat: 'chat-message.mp3',
  /** Un bouton des menus vient d'etre actionne. Ajoute a l'etape 4.3. */
  clic: 'button-click.wav',
} as const;

/** Nom d'un son ponctuel. */
export type NomDeSon = keyof typeof SONS;

/**
 * Les sons qui tournent en boucle tant qu'un bonus dure.
 *
 * Ils sont separes des sons ponctuels parce qu'ils se demarrent et s'arretent,
 * la ou les autres se declenchent et se terminent seuls.
 */
export const SONS_EN_BOUCLE: Readonly<Record<TypeBonus, string>> = {
  vitesse: 'speed-active.mp3',
  invincibilite: 'invincibility-active.mp3',
  revelation: 'reveal-active.mp3',
};

/** Les quatre bruits de pas, tires au sort a chaque foulee. */
export const SONS_DE_PAS = [
  'footstep1.mp3',
  'footstep2.mp3',
  'footstep3.mp3',
  'footstep4.mp3',
] as const;

/**
 * Les deux musiques du jeu, nommees par le moment ou elles jouent.
 *
 * Le jeu d'origine en declarait une troisieme, pour la fin de partie, dont le
 * fichier n'a jamais existe (defaut X32 de l'audit): elle n'est pas reprise. La
 * fin de partie garde la musique des menus, comme elle l'a toujours fait en
 * pratique.
 */
export const MUSIQUES = {
  /** L'accueil, le salon et la fin de partie. Ajoutee a l'etape 4.3. */
  menu: 'menu-music.mp3',
  /** La partie en cours. */
  jeu: 'game-music-2.mp3',
} as const;

/** Le nom d'une musique. */
export type PisteMusicale = keyof typeof MUSIQUES;

/** Chemin relatif d'un fichier de son, depuis la racine des ressources. */
export function cheminSon(fichier: string): string {
  return `sons/${fichier}`;
}
