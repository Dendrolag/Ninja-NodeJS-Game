/**
 * L'aide: comment jouer, et avec quelles touches.
 *
 * LES TEXTES SONT CEUX DE L'ETAPE 4.5, arretes avec le porteur du projet le 19
 * septembre 2026: un ton court et un peu decale pour les bonus et les malus, et le
 * texte de chaque mode que lisent aussi l'accueil et la creation. Sous ce texte, les
 * regles exactes, chiffrees depuis les constantes du contrat: c'est ici qu'un joueur
 * comprend pourquoi son score est retombe. Le joueur lit « PNJ » la ou le jeu
 * d'origine disait « faux ninjas ».
 *
 * L'AIDE S'ORGANISE PAR MODE. Un principe commun, puis une section par mode, dans
 * l'ordre du contrat: un mode ajoute sans ses regles est une erreur de compilation.
 *
 * LES NOMS DES BONUS, DES MALUS ET DES ZONES VIENNENT DE L'APPARENCE DU JEU: le
 * joueur lit dans l'aide exactement les mots qu'il verra dans le HUD et sur le
 * terrain. Les zones gardent les textes du jeu d'origine, et aucun emoji.
 */

import type { Mode, TypeBonus, TypeMalus, TypeZone } from '@neon-ninja/shared';
import {
  CHASSE,
  IMAGES_PAR_OBJET,
  COMBO,
  MASSACRE,
  MODES,
  RACINE_RESSOURCES,
  SCORE,
  TACTIQUE,
  cheminObjet,
} from '@neon-ninja/shared';

import { APPARENCE_OBJET, APPARENCE_ZONE, CADENCE_OBJET_MS } from '../../rendu/apparence.js';
import { creer } from '../dom.js';
import { NOMS_DES_MODES, TEXTES_DES_MODES } from '../modeles/cartes.js';
import type { Fenetre } from './fenetre.js';
import { monterFenetre } from './fenetre.js';

/** Ce que fait chaque bonus (etape 4.5). */
const EFFETS_BONUS: Readonly<Record<TypeBonus, string>> = {
  vitesse: 'Pour ceux qui trouvaient le jeu trop lent.',
  invincibilite: 'Le nom parle de lui-même, non ?',
  revelation: 'Les vrais ninjas ne peuvent plus faire semblant.',
};

/** Ce que fait chaque malus (etape 4.5). */
const EFFETS_MALUS: Readonly<Record<TypeMalus, string>> = {
  controlesInverses: 'Gauche, c’est droite. Bon courage aux autres.',
  flou: 'Les autres joueurs auraient dû prendre leurs lunettes.',
  negatif: 'Ça ne pénalisera pas les daltoniens.',
};

/** Ce que fait chaque zone. Textes du jeu d'origine. */
const EFFETS_ZONES: Readonly<Record<TypeZone, string>> = {
  chaos: 'Les ninjas qui la traversent changent de couleur au hasard.',
  repulsion: 'Repousse les ninjas loin des joueurs.',
  attraction: 'Attire les ninjas vers les joueurs.',
  invisibilite: 'Les joueurs qui s’y cachent deviennent invisibles pour les autres.',
};

/**
 * Les commandes, pour le clavier et pour le tactile. Espace et le bouton d'action
 * servent dans trois modes, pas seulement en Tactique (defaut corrige a l'etape 4.5).
 */
const COMMANDES: readonly (readonly [string, string])[] = [
  ['Z, W ou flèche haut', 'Monter'],
  ['S ou flèche bas', 'Descendre'],
  ['Q, A ou flèche gauche', 'Aller à gauche'],
  ['D ou flèche droite', 'Aller à droite'],
  ['F', 'Localiser votre ninja'],
  ['Espace', 'Capturer en Tactique et en Chasse, trancher en Massacre'],
  ['Pouce sur l’écran', 'Se déplacer, sur téléphone et tablette'],
  ['Bouton Capturer ou Katana', 'La même chose qu’Espace, sur téléphone et tablette'],
];

/** Les regles exactes de chaque mode, sous son texte de presentation. */
const REGLES_DES_MODES: Readonly<Record<Mode, readonly string[]>> = {
  classique: [
    'Touchez un PNJ pour le rallier à votre couleur. Touchez un autre joueur pour le capturer et il vous cède d’un coup tous les ninjas de sa couleur.',
    'Votre score, ce sont les ninjas que vous gardez. Se faire capturer le fait retomber, seul compte ce que vous tenez à la fin.',
    `Ralliez les PNJ à moins de ${String(COMBO.FENETRE_MS / 1000)} secondes d’intervalle et votre combo monte d’un cran tous les ${String(COMBO.COUPS_PAR_CRAN)} ninjas, jusqu’à x${String(COMBO.MULTIPLICATEUR_MAXIMUM)}. Chaque ninja rapporte alors une prime, le multiplicateur moins un. La prime compte dans votre score et se perd avec vos ninjas si l’on vous capture.`,
  ],
  tactique: [
    'Toucher ne capture plus. Espace ou le bouton Capturer prend tout ce qui se trouve dans le cône, à courte distance devant vous.',
    `Vous avez ${String(TACTIQUE.CHARGES_MAXIMUM)} charges. Un tir qui prend quelque chose en coûte une, qui revient en ${String(TACTIQUE.RECHARGE_MS / 1000)} secondes. Un tir dans le vide ne coûte rien.`,
  ],
  equipes: [
    'Les PNJ que vous touchez rejoignent votre équipe. Son score est la somme de ses ninjas et des points de Black Ninjas de ses membres.',
    'Capturer un adversaire vous donne sa part des ninjas de son équipe.',
  ],
  chasse: [
    `Des traqueurs sont tirés au sort. Ils tirent devant eux avec Espace ou le bouton Capturer, et le tir prend ce qui est le plus proche. Une proie devient traqueur à son tour, un PNJ coûte une vie. À la ${String(CHASSE.VIES_DES_TRAQUEURS)}e, le traqueur est éliminé.`,
    `Une proie marque un point tous les ${String(CHASSE.PIXELS_PAR_POINT)} pixels parcourus. Cachée et immobile, elle ne marque rien. Un traqueur marque ${String(CHASSE.POINTS_PAR_CAPTURE)} points par capture et ${String(CHASSE.POINTS_PAR_VIE)} par vie qui lui reste.`,
    'Pas de Black Ninjas dans ce mode.',
  ],
  massacre: [
    `On ne capture plus. Espace ou le bouton Katana tranche tout ce qui se trouve devant vous. Un PNJ vaut ${String(MASSACRE.POINTS_PAR_BOT)} points, un Black Ninja ${String(MASSACRE.POINTS_PAR_BOT_NOIR)}, fois votre multiplicateur.`,
    `Enchaînez les morts à moins de ${String(COMBO.FENETRE_MS / 1000)} secondes d’intervalle et le multiplicateur monte d’un cran toutes les ${String(COMBO.COUPS_PAR_CRAN)} morts, jusqu’à x${String(COMBO.MULTIPLICATEUR_MAXIMUM)}. Un joueur tranché perd son combo et la moitié de ses points, qui vont à son tueur.`,
    `Carte nettoyée avant la fin ? ${String(MASSACRE.POINTS_PAR_SECONDE_RESTANTE)} points par seconde restante. Le sang se règle dans le panneau du son.`,
  ],
};

/** Monte la fenetre d'aide, fermee. */
export function monterAide(doc: Document): Fenetre {
  const fenetre = monterFenetre({ document: doc, titre: 'Comment jouer', classe: 'fenetre-aide' });

  fenetre.corps.append(
    creer(
      doc,
      'section',
      { classe: 'aide-section' },
      creer(doc, 'h3', { texte: 'Le principe' }),
      creer(doc, 'p', {
        texte:
          'Des joueurs et des centaines de PNJ, ces ninjas sans joueur, se partagent la carte. Chaque mode en fait autre chose. Le meilleur score à la fin de la partie l’emporte.',
      }),
      creer(doc, 'p', {
        texte: `Les Black Ninjas débarquent en cours de partie et chassent les joueurs. S’ils vous attrapent, vous perdez une partie de votre score. Invincible, vous les détruisez en les touchant et chacun rapporte ${String(SCORE.POINTS_PAR_BOT_NOIR)} points. En Massacre, seul le katana en vient à bout.`,
      }),
    ),
    ...MODES.map((mode) =>
      creer(
        doc,
        'section',
        { classe: 'aide-section aide-mode', attributs: { 'data-mode': mode } },
        creer(doc, 'h3', { texte: NOMS_DES_MODES[mode] }),
        creer(doc, 'p', { classe: 'aide-accroche', texte: TEXTES_DES_MODES[mode] }),
        ...REGLES_DES_MODES[mode].map((regle) => creer(doc, 'p', { texte: regle })),
      ),
    ),
    liste(doc, 'Bonus', Object.entries(EFFETS_BONUS) as [TypeBonus, string][], true),
    liste(
      doc,
      'Malus, qui frappent les autres',
      Object.entries(EFFETS_MALUS) as [TypeMalus, string][],
      true,
      'En Équipes et en Chasse, ils ne frappent que l’autre camp.',
    ),
    creer(
      doc,
      'section',
      { classe: 'aide-section' },
      creer(doc, 'h3', { texte: 'Zones spéciales' }),
      creer(
        doc,
        'ul',
        { classe: 'aide-liste' },
        ...(Object.entries(EFFETS_ZONES) as [TypeZone, string][]).map(([zone, effet]) =>
          creer(
            doc,
            'li',
            {},
            creer(doc, 'strong', { texte: APPARENCE_ZONE[zone].libelle }),
            creer(doc, 'span', { texte: effet }),
          ),
        ),
      ),
    ),
    creer(
      doc,
      'section',
      { classe: 'aide-section' },
      creer(doc, 'h3', { texte: 'Commandes' }),
      creer(
        doc,
        'dl',
        { classe: 'aide-commandes' },
        ...COMMANDES.flatMap(([touches, action]) => [
          creer(doc, 'dt', { texte: touches }),
          creer(doc, 'dd', { texte: action }),
        ]),
      ),
    ),
  );

  return fenetre;
}

/** Une liste de bonus ou de malus, avec leur icone de jeu. */
function liste(
  doc: Document,
  titre: string,
  effets: readonly [TypeBonus | TypeMalus, string][],
  avecIcone: boolean,
  precision?: string,
): HTMLElement {
  return creer(
    doc,
    'section',
    { classe: 'aide-section' },
    creer(doc, 'h3', { texte: titre }),
    precision === undefined ? undefined : creer(doc, 'p', { texte: precision }),
    creer(
      doc,
      'ul',
      { classe: 'aide-liste' },
      ...effets.map(([nature, effet]) =>
        creer(
          doc,
          'li',
          {},
          avecIcone ? iconeAnimee(doc, nature) : undefined,
          creer(doc, 'strong', { texte: APPARENCE_OBJET[nature].libelle }),
          creer(doc, 'span', { texte: effet }),
        ),
      ),
    ),
  );
}

/**
 * L'icone d'un objet, animee comme en partie, sur un halo clair (etape 5.5).
 *
 * Le fichier est une planche de deux images cote a cote: l'aide la posait entiere
 * dans un carre, si bien que chaque icone se montrait en double, et sombre sur le
 * fond sombre. Le carre ne montre plus qu'une image a la fois, qui alterne a la
 * cadence des objets du terrain (feuille de style, .aide-icone).
 */
function iconeAnimee(doc: Document, nature: TypeBonus | TypeMalus): HTMLElement {
  const icone = creer(doc, 'span', { classe: 'aide-icone', attributs: { 'aria-hidden': 'true' } });
  icone.style.backgroundImage = `url("${RACINE_RESSOURCES}/${cheminObjet(nature)}")`;
  icone.style.setProperty('--images', String(IMAGES_PAR_OBJET));
  icone.style.setProperty('--duree', `${String(CADENCE_OBJET_MS * IMAGES_PAR_OBJET)}ms`);

  return creer(doc, 'span', { classe: 'aide-halo' }, icone);
}
