/**
 * L'aide: comment jouer, et avec quelles touches.
 *
 * LES TEXTES ONT ETE REVUS AVEC LE PORTEUR DU PROJET LE 5 OCTOBRE 2026: plus courts,
 * un ton decale, et le plaisir de la decouverte laisse au joueur. L'aide dit ce qu'il
 * faut pour jouer, pas tout: l'Evade, les Black Ninjas et les effets de la mine selon
 * le mode se decouvrent en partie. Sous le texte de chaque mode, que lisent aussi
 * l'accueil et la creation, ses regles, chiffrees depuis les constantes du contrat.
 * Le joueur lit « PNJ » la ou le jeu d'origine disait « faux ninjas ».
 *
 * LES PETITS NOMBRES S'ECRIVENT EN LETTRES (« cinq charges »), toujours tires des
 * constantes: un reglage change, le texte suit.
 *
 * L'AIDE S'ORGANISE PAR MODE. Un principe commun, puis une section par mode, dans
 * l'ordre du contrat: un mode ajoute sans ses regles est une erreur de compilation.
 *
 * LES NOMS DES BONUS, DES MALUS ET DES ZONES VIENNENT DE L'APPARENCE DU JEU: le
 * joueur lit dans l'aide exactement les mots qu'il verra dans le HUD et sur le
 * terrain. Les zones gardent les textes du jeu d'origine, et aucun emoji.
 */

import type {
  Mode,
  NatureObjet,
  ObjetDePoche,
  TypeBonus,
  TypeBonusTactique,
  TypeMalus,
  TypeMalusTactique,
  TypeZone,
} from '@neon-ninja/shared';
import {
  CHASSE,
  IMAGES_PAR_OBJET,
  COMBO,
  MASSACRE,
  MINES_DE_ZONE,
  MODES,
  OBJETS_TACTIQUES,
  TACTIQUE,
} from '@neon-ninja/shared';

import {
  APPARENCE_OBJET,
  APPARENCE_ZONE,
  CADENCE_OBJET_MS,
  adresseDeLIcone,
} from '../../rendu/apparence.js';
import { creer } from '../dom.js';
import { NOMS_DES_MODES, TEXTES_DES_MODES } from '../modeles/cartes.js';
import type { Fenetre } from './fenetre.js';
import { monterFenetre } from './fenetre.js';

/** Un nombre a virgule, a la francaise. */
function nombreFr(valeur: number): string {
  return String(valeur).replace('.', ',');
}

/** Les nombres de un a dix, en lettres. */
const EN_LETTRES = ['un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix'];

/** Les rangs de un a dix, en lettres. */
const RANGS_EN_LETTRES = [
  'première',
  'deuxième',
  'troisième',
  'quatrième',
  'cinquième',
  'sixième',
  'septième',
  'huitième',
  'neuvième',
  'dixième',
];

/** Un petit nombre en lettres, « cinq »; en chiffres au-dela de dix. */
function enLettres(valeur: number): string {
  return EN_LETTRES[valeur - 1] ?? String(valeur);
}

/** Un rang en lettres, au feminin, « troisième »; « 12e » au-dela de dix. */
function rangEnLettres(valeur: number): string {
  return RANGS_EN_LETTRES[valeur - 1] ?? `${String(valeur)}e`;
}

/** Le texte avec une majuscule en tete. */
function majuscule(texte: string): string {
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

/** Ce que fait chaque bonus (etape 4.5). */
const EFFETS_BONUS: Readonly<Record<TypeBonus, string>> = {
  vitesse: 'Pour ceux qui trouvaient le jeu trop lent.',
  invincibilite: 'Le nom parle de lui-même, non ?',
  revelation: 'Les vrais ninjas ne peuvent plus faire semblant.',
};

/** Ce que fait chaque objet de poche (etape 7.10). */
const EFFETS_POCHE: Readonly<Record<ObjetDePoche, string>> = {
  fumee: 'Un nuage, et vous voilà loin, à l’abri. Personne ne sait que vous en avez une.',
  mine: 'Posez-la, les autres n’en voient qu’un reflet. Qu’un adversaire ou un Black Ninja marche dessus et elle saute peu après. Jamais sur vous ni sur vos coéquipiers. Trois au plus sur la carte.',
};

/** Ce que fait chaque malus (etape 4.5). */
const EFFETS_MALUS: Readonly<Record<TypeMalus, string>> = {
  controlesInverses: 'Gauche, c’est droite. Bon courage aux autres.',
  flou: 'Les autres joueurs auraient dû prendre leurs lunettes.',
  negatif: 'Ça ne pénalisera pas les daltoniens.',
};

/** Ce que fait chaque bonus du Tactique (etape 7.7). */
const EFFETS_BONUS_TACTIQUES: Readonly<Record<TypeBonusTactique, string>> = {
  rafale: 'Tirez sans compter.',
  rechargeRapide: `Vos charges reviennent en ${nombreFr(OBJETS_TACTIQUES.RECHARGE_RAPIDE_MS / 1000)} seconde.`,
  viseeLarge: 'Votre cône s’ouvre et porte plus loin.',
};

/** Ce que fait chaque malus du Tactique (etape 7.7). */
const EFFETS_MALUS_TACTIQUES: Readonly<Record<TypeMalusTactique, string>> = {
  tirUnique: 'Les autres n’ont plus qu’une charge.',
  rechargeLente: `Leurs charges mettent ${enLettres(OBJETS_TACTIQUES.RECHARGE_LENTE_MS / 1000)} secondes à revenir.`,
  viseeEtroite: 'Leur cône se resserre et porte moins loin.',
};

/**
 * La couleur de la mine de zone qui cache chaque zone (etape 7.12), qui est celle de la zone
 * une fois ouverte (APPARENCE_ZONE).
 */
const COULEURS_ZONES: Readonly<Record<TypeZone, string>> = {
  chaos: 'rouge',
  repulsion: 'bleue',
  attraction: 'verte',
  invisibilite: 'violette',
};

/** Comment une zone s'ouvre, depuis l'etape 7.12. */
const MINES_DE_ZONE_AIDE = `Les zones dorment sous des mines visibles de tous, de leur couleur. Marchez dessus et la zone s’ouvre ${enLettres(MINES_DE_ZONE.DELAI_AVANT_OUVERTURE_MS / 1000)} secondes plus tard. À vous de choisir où.`;

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
  ['E', 'Sortir l’objet de la poche'],
  ['Espace', 'Capturer en Tactique et en Chasse, trancher en Massacre'],
  ['Pouce sur l’écran', 'Se déplacer, sur téléphone et tablette'],
  ['Bouton Capturer ou Katana', 'La même chose qu’Espace, sur téléphone et tablette'],
  ['Bouton de la poche', 'La même chose que E, sur téléphone et tablette'],
];

/** Les regles exactes de chaque mode, sous son texte de presentation. */
const REGLES_DES_MODES: Readonly<Record<Mode, readonly string[]>> = {
  classique: [
    'Touchez un PNJ pour le rallier, un joueur pour lui prendre tous ses ninjas.',
    'Votre score, c’est ce que vous tenez. Capturé, il retombe à zéro.',
    `Ralliez vite et le combo grimpe jusqu’à x${String(COMBO.MULTIPLICATEUR_MAXIMUM)}. Ses points partent avec vos ninjas si l’on vous capture.`,
  ],
  tactique: [
    'Toucher ne suffit plus. Espace ou le bouton Capturer prend tout ce qui est dans le cône devant vous.',
    `${majuscule(enLettres(TACTIQUE.CHARGES_MAXIMUM))} charges, une revient toutes les ${enLettres(TACTIQUE.RECHARGE_MS / 1000)} secondes. Un tir dans le vide ne coûte rien.`,
    `Un Black Ninja encaisse ${enLettres(TACTIQUE.COUPS_POUR_VAINCRE_UN_BOT_NOIR)} tirs avant de tomber.`,
    'Vue plus serrée, radar limité, et six objets rien que pour ce mode.',
  ],
  equipes: [
    'Vos PNJ rejoignent votre équipe, qui marque tout ce qu’elle tient.',
    'Capturez un adversaire pour lui prendre sa part.',
  ],
  chasse: [
    `Les traqueurs, tirés au sort, tirent avec Espace ou le bouton Capturer. Une proie touchée devient traqueur. Un PNJ touché leur coûte une vie, et à la ${rangEnLettres(CHASSE.VIES_DES_TRAQUEURS)} ils sont éliminés.`,
    `Les proies marquent en bougeant. Les traqueurs marquent ${String(CHASSE.POINTS_PAR_CAPTURE)} points par prise et ${String(CHASSE.POINTS_PAR_VIE)} par vie restante.`,
    'Pas de Black Ninjas ici.',
  ],
  massacre: [
    `On ne capture plus, on tranche, avec Espace ou le bouton Katana. Un PNJ vaut ${String(MASSACRE.POINTS_PAR_BOT)} points, un Black Ninja ${String(MASSACRE.POINTS_PAR_BOT_NOIR)}, multipliés par votre combo.`,
    `Enchaînez et le combo grimpe jusqu’à x${String(COMBO.MULTIPLICATEUR_MAXIMUM)}. Tranché, vous perdez votre combo et la moitié de vos points, au profit de votre tueur.`,
    `Carte nettoyée avant la fin\u00a0? ${String(MASSACRE.POINTS_PAR_SECONDE_RESTANTE)} points par seconde restante.`,
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
          'Quelques joueurs, des centaines de PNJ (des ninjas sans joueur derrière) et un seul gagnant, le meilleur score à la fin.',
      }),
      creer(doc, 'p', {
        texte:
          'Vous incarnez un ninja parmi des dizaines voire des centaines d’autres. Cachez-vous des autres joueurs, identifiez-les et capturez-les ou éliminez-les.',
      }),
    ),
    creer(
      doc,
      'section',
      { classe: 'aide-section' },
      creer(doc, 'h3', { texte: 'Les Black Ninjas' }),
      creer(doc, 'p', {
        texte:
          'Ils débarquent en cours de partie et cherchent les vrais joueurs. S’ils vous attrapent, adieu la moitié de vos points. Trouvez un moyen de les éliminer.',
      }),
    ),
    // L'Evade (etape 7.9), dans tous les modes sauf la Chasse.
    creer(
      doc,
      'section',
      { classe: 'aide-section aide-evade' },
      creer(doc, 'h3', { texte: 'L’Évadé' }),
      creer(doc, 'p', {
        texte:
          'Un ninja au style particulier cherche à échapper aux vrais ninjas, peut-être vaudrait-il le coup de l’attraper…',
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
      'À garder en poche',
      Object.entries(EFFETS_POCHE) as [ObjetDePoche, string][],
      true,
      'Un seul objet à la fois, à sortir quand vous voulez. Pleine, vous ne pouvez rien prendre de plus. Capturé, vous la perdez.',
    ),
    liste(
      doc,
      'Malus, qui frappent les autres',
      Object.entries(EFFETS_MALUS) as [TypeMalus, string][],
      true,
      'En Équipes et en Chasse, ils ne frappent que l’autre camp.',
    ),
    liste(
      doc,
      'Objets du Tactique',
      [
        ...(Object.entries(EFFETS_BONUS_TACTIQUES) as [TypeBonusTactique, string][]),
        ...(Object.entries(EFFETS_MALUS_TACTIQUES) as [TypeMalusTactique, string][]),
      ],
      true,
      'Trois bonus pour vous, trois malus pour les autres. Un bonus et son contraire s’annulent.',
    ),
    creer(
      doc,
      'section',
      { classe: 'aide-section' },
      creer(doc, 'h3', { texte: 'Zones spéciales' }),
      creer(doc, 'p', { texte: MINES_DE_ZONE_AIDE }),
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
            creer(doc, 'span', { texte: `Mine ${COULEURS_ZONES[zone]}. ${effet}` }),
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
  effets: readonly [NatureObjet, string][],
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
function iconeAnimee(doc: Document, nature: NatureObjet): HTMLElement {
  const icone = creer(doc, 'span', { classe: 'aide-icone', attributs: { 'aria-hidden': 'true' } });
  icone.style.backgroundImage = `url("${adresseDeLIcone(nature)}")`;
  icone.style.setProperty('--images', String(IMAGES_PAR_OBJET));
  icone.style.setProperty('--duree', `${String(CADENCE_OBJET_MS * IMAGES_PAR_OBJET)}ms`);

  return creer(doc, 'span', { classe: 'aide-halo' }, icone);
}
