/**
 * L'aide: comment jouer, et avec quelles touches.
 *
 * LE CONTENU EST CELUI DU JEU D'ORIGINE (helpMenu, index.html:211), avec trois
 * changements. Les emoji des zones speciales sont remplaces par les icones du jeu
 * ou retires, conformement aux conventions du projet. Les regles du score et des
 * Black Ninjas, que le jeu d'origine ne disait nulle part, sont ajoutees: ce sont
 * les comportements a preserver numeros 1 a 3 de CLAUDE.md, et un joueur qui ne
 * les connait pas ne comprend pas pourquoi son score retombe a zero. Enfin la
 * touche F et WASD sont listees, puisqu'elles existent.
 *
 * LES NOMS DES BONUS, DES MALUS ET DES ZONES VIENNENT DE L'APPARENCE DU JEU: le
 * joueur lit dans l'aide exactement les mots qu'il verra dans le HUD et sur le
 * terrain.
 */

import type { TypeBonus, TypeMalus, TypeZone } from '@neon-ninja/shared';
import { RACINE_RESSOURCES, SCORE, TACTIQUE, cheminObjet } from '@neon-ninja/shared';

import { APPARENCE_OBJET, APPARENCE_ZONE } from '../../rendu/apparence.js';
import { creer } from '../dom.js';
import type { Fenetre } from './fenetre.js';
import { monterFenetre } from './fenetre.js';

/** Ce que fait chaque bonus. Textes du jeu d'origine. */
const EFFETS_BONUS: Readonly<Record<TypeBonus, string>> = {
  vitesse: 'Déplacez-vous plus rapidement.',
  invincibilite: 'Personne ne peut vous capturer, et vous détruisez les Black Ninjas.',
  revelation: 'Les vrais ninjas, ceux des joueurs, se révèlent au milieu des faux.',
};

/** Ce que fait chaque malus. Textes du jeu d'origine. */
const EFFETS_MALUS: Readonly<Record<TypeMalus, string>> = {
  controlesInverses: 'Inverse les commandes de vos adversaires.',
  flou: 'Trouble la vision des autres joueurs.',
  negatif: 'Inverse les couleurs de vos adversaires.',
};

/** Ce que fait chaque zone. Textes du jeu d'origine. */
const EFFETS_ZONES: Readonly<Record<TypeZone, string>> = {
  chaos: 'Les ninjas qui la traversent changent de couleur au hasard.',
  repulsion: 'Repousse les ninjas loin des joueurs.',
  attraction: 'Attire les ninjas vers les joueurs.',
  invisibilite: 'Les joueurs qui s’y cachent deviennent invisibles pour les autres.',
};

/** Les commandes, pour le clavier et pour le tactile. */
const COMMANDES: readonly (readonly [string, string])[] = [
  ['Z, W ou flèche haut', 'Monter'],
  ['S ou flèche bas', 'Descendre'],
  ['Q, A ou flèche gauche', 'Aller à gauche'],
  ['D ou flèche droite', 'Aller à droite'],
  ['F', 'Localiser votre ninja'],
  ['Espace', 'Capturer, dans le mode Tactique'],
  ['Pouce sur l’écran', 'Se déplacer, sur téléphone et tablette'],
  ['Bouton Capturer', 'Capturer sur téléphone et tablette, dans le mode Tactique'],
];

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
          'Touchez un faux ninja pour le rallier à votre couleur. Touchez un autre joueur pour le capturer : il vous cède d’un coup tous les ninjas de sa couleur.',
      }),
      creer(doc, 'p', {
        texte:
          'Votre score, ce sont les ninjas que vous gardez. Se faire capturer le fait retomber : seul compte ce que vous tenez à la fin.',
      }),
      creer(doc, 'p', {
        texte: `Les Black Ninjas entrent en jeu en cours de partie et chassent les joueurs. S’ils vous prennent, vous perdez une partie de vos ninjas. Invincible, vous pouvez les détruire : chacun rapporte ${String(SCORE.POINTS_PAR_BOT_NOIR)} points.`,
      }),
      creer(doc, 'p', {
        texte: `Dans le mode Tactique, toucher ne capture plus : Espace, ou le bouton Capturer, prend tout ce qui se trouve dans le cône, à courte distance devant vous. Vous avez ${String(TACTIQUE.CHARGES_MAXIMUM)} charges ; un tir qui prend quelque chose en coûte une, qui revient en ${String(TACTIQUE.RECHARGE_MS / 1000)} secondes, et un tir dans le vide ne coûte rien.`,
      }),
    ),
    liste(doc, 'Bonus', Object.entries(EFFETS_BONUS) as [TypeBonus, string][], true),
    liste(
      doc,
      'Malus, qui frappent les autres',
      Object.entries(EFFETS_MALUS) as [TypeMalus, string][],
      true,
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
): HTMLElement {
  return creer(
    doc,
    'section',
    { classe: 'aide-section' },
    creer(doc, 'h3', { texte: titre }),
    creer(
      doc,
      'ul',
      { classe: 'aide-liste' },
      ...effets.map(([nature, effet]) =>
        creer(
          doc,
          'li',
          {},
          avecIcone
            ? creer(doc, 'img', {
                classe: 'aide-icone',
                attributs: { src: `${RACINE_RESSOURCES}/${cheminObjet(nature)}`, alt: '' },
              })
            : undefined,
          creer(doc, 'strong', { texte: APPARENCE_OBJET[nature].libelle }),
          creer(doc, 'span', { texte: effet }),
        ),
      ),
    ),
  );
}
