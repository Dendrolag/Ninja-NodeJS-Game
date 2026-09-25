/**
 * Comment les cartes et les modes de jeu se presentent au joueur.
 *
 * Les noms des cartes sont ceux retenus le 29 juin 2026 pour la version 1
 * (journal de conception): Rainy Tokyo, Tokyo et Spirit & Time. Le jeu d'origine
 * appelait la troisieme « Room Of Spirit and Time ». Les ambiances viennent de la
 * maquette. Depuis l'etape 7.6, Rainy Tokyo et Tokyo, qui avaient le meme decor, sont
 * une seule carte « Tokyo », dont la pluie est un reglage; une partie enregistree sur
 * l'une ou l'autre s'appelle donc « Tokyo » (decision du porteur du projet du 18
 * septembre 2026).
 *
 * LES TABLES SONT INDEXEES PAR LES IDENTIFIANTS DU CONTRAT. Ajouter une carte ou
 * un mode au contrat sans lui donner de nom ici est donc une erreur de
 * compilation: rien ne peut apparaitre a l'ecran sous son identifiant technique.
 */

import type { CarteEnregistree, Equipe, Mode, ReglagesPartie } from '@neon-ninja/shared';
import { cheminPluie } from '@neon-ninja/shared';

/** Ce que le joueur lit d'une carte. */
export interface PresentationCarte {
  readonly nom: string;
  readonly ambiance: string;
}

/**
 * La presentation de chaque carte, jouable ou seulement enregistree.
 *
 * map2, l'ancienne Tokyo sans pluie, ne se joue plus: elle n'apparait que dans
 * l'historique d'un profil, sous le meme nom que map1.
 *
 * Le Quartier est la carte de travail de l'etape 8.2: un plan au trait, sans
 * decor, pose en jeu pour savoir si une carte structuree vaut mieux qu'un terrain
 * ouvert. Son ambiance le dit au joueur, pour que personne ne la prenne pour un
 * decor reste en chemin.
 */
export const PRESENTATION_CARTES: Readonly<Record<CarteEnregistree, PresentationCarte>> = {
  map1: { nom: 'Tokyo', ambiance: 'Néon · Nuit' },
  map2: { nom: 'Tokyo', ambiance: 'Néon · Nuit' },
  map3: { nom: 'Spirit & Time', ambiance: 'Vide · Infini' },
  quartier: { nom: 'Quartier', ambiance: 'Essai · Plan au trait' },
};

/**
 * Le nom de chaque mode de jeu, tel que le joueur le lit.
 *
 * Le mode est un jeu de regles enfichable (decision du 29 juin 2026), et le salon
 * le transporte depuis l'etape 2.4. Le Tactique s'est ajoute au Classique a l'etape
 * 7.1, les Equipes a l'etape 7.2, la Chasse a l'etape 7.3, le Massacre a l'etape 7.4. Le
 * Classique s'appelle la Horde depuis l'etape 7.5, sur decision du porteur du projet; son
 * identifiant reste `classique`, pour que les parties et records enregistres restent lisibles.
 */
export const NOMS_DES_MODES: Readonly<Record<Mode, string>> = {
  classique: 'Horde',
  tactique: 'Tactique',
  equipes: 'Équipes',
  chasse: 'Chasse',
  massacre: 'Massacre',
};

/** Le nom de chaque equipe du mode Equipes, tel que le joueur le lit (etape 7.2). */
export const NOMS_DES_EQUIPES: Readonly<Record<Equipe, string>> = {
  cyan: 'Cyan',
  magenta: 'Magenta',
};

/**
 * Ce que chaque mode dit de lui, en une ou deux phrases (etape 4.5).
 *
 * Textes arretes avec le porteur du projet le 19 septembre 2026: courts, un peu
 * decales, juste assez pour comprendre le principe et laisser de la decouverte. Une
 * seule source, que lisent l'accueil, la creation et l'aide: deux ecrans ne peuvent
 * plus presenter un mode de deux facons. Les regles exactes sont dans l'aide.
 */
export const TEXTES_DES_MODES: Readonly<Record<Mode, string>> = {
  classique: 'Faites grossir vos rangs et attrapez les autres joueurs pour tout leur piquer.',
  tactique:
    'Réfléchir avant d’agir, pour une fois. Visez devant vous et capturez tout ce qui passe.',
  equipes: 'Deux couleurs, une seule qui gagne. Ralliez pour votre camp, ne trahissez personne.',
  chasse:
    'Cache-cache, version ninja. Les traqueurs cherchent les vrais joueurs dans la foule. Les proies prises changent de camp.',
  massacre:
    'Fini les couleurs, place au bain de sang. Tranchez tout au katana et enchaînez pour faire exploser le score.',
};

/**
 * Comment on capture dans chaque mode: ce que le salon rappelle avant le lancement,
 * pour qu'un joueur arrive par la partie rapide sache a quoi il joue. Ce rappel reste
 * pratique, touches, charges et vies comprises. Depuis l'etape 4.5, le joueur lit
 * « PNJ » la ou il lisait « faux ninjas ».
 */
export const CAPTURES_DES_MODES: Readonly<Record<Mode, string>> = {
  classique:
    'On capture en touchant. Un PNJ rejoint votre couleur, un joueur vous cède tous les siens. Enchaînez les PNJ pour monter votre combo.',
  tactique:
    'On capture à distance. Espace ou le bouton Capturer prend tout ce qui est dans le cône devant vous. Cinq charges, dont une revient toutes les cinq secondes.',
  equipes:
    'On capture en touchant, en équipe. Un PNJ passe à la couleur de votre équipe, un adversaire vous cède sa part des ninjas de son équipe.',
  chasse:
    'Les traqueurs tirent devant eux avec Espace ou le bouton Capturer. Une proie touchée devient traqueur, un PNJ leur coûte une vie sur trois. Les proies marquent en bougeant.',
  massacre:
    'On ne capture plus. Espace ou le bouton Katana tranche tout ce qui est devant vous, PNJ comme joueurs. Enchaînez les morts pour multiplier les points.',
};

/** Le nom d'une carte tel qu'on l'affiche, mode miroir compris. */
export function nomDeCarte(carte: CarteEnregistree, modeMiroir: boolean): string {
  const nom = PRESENTATION_CARTES[carte].nom;

  return modeMiroir ? `${nom} · Miroir` : nom;
}

/**
 * La carte d'une partie a venir, telle que le salon la recapitule: son nom, miroir
 * compris, et « Pluie » quand la pluie tombera (etape 7.6). Sur une carte sans pluie,
 * le reglage est sans effet et ne se dit pas.
 */
export function carteDeLaPartie(reglages: ReglagesPartie): string {
  const nom = nomDeCarte(reglages.carte, reglages.modeMiroir);
  const pleut = reglages.pluie && cheminPluie(reglages.carte) !== undefined;

  return pleut ? `${nom} · Pluie` : nom;
}
