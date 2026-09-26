/**
 * Les boutons des gestes d'amitie (etape 3.6), communs a la fiche d'un joueur et a
 * l'ecran Amis.
 *
 * CE COMPOSANT NE DECIDE RIEN. Les gestes proposes viennent du modele, qui suit la
 * relation; un clic demande le geste au client, et c'est le serveur qui le permet ou
 * le refuse. Les gestes qui defont (retirer, bloquer) sont tenus a part, en style
 * discret, loin du geste principal.
 */

import type { Client } from '../../client.js';
import { bouton, creer } from '../dom.js';
import type { GestePropose, NatureDUnGeste } from '../modeles/amis.js';

/** La classe du bouton de chaque nature de geste. */
const CLASSES: Readonly<Record<NatureDUnGeste, string>> = {
  principal: 'bouton bouton-primaire bouton-compact',
  secondaire: 'bouton bouton-secondaire bouton-compact',
  defait: 'bouton bouton-discret bouton-compact',
};

/**
 * Les boutons de ces gestes sur ce pseudo, en deux groupes: ceux qui font, puis ceux
 * qui defont.
 *
 * @param desactives Un geste attend sa reponse: aucun bouton ne repart.
 */
export function boutonsDeGestes(
  doc: Document,
  client: Client,
  pseudo: string,
  gestes: readonly GestePropose[],
  desactives: boolean,
): HTMLElement[] {
  const fabriquer = (propose: GestePropose): HTMLButtonElement => {
    const element = bouton(doc, { classe: CLASSES[propose.nature], texte: propose.libelle }, () => {
      client.faireUnGeste(propose.geste, pseudo);
    });
    element.disabled = desactives;
    element.dataset['geste'] = propose.geste;

    return element;
  };

  const font = gestes.filter((propose) => propose.nature !== 'defait');
  const defont = gestes.filter((propose) => propose.nature === 'defait');

  return [
    ...(font.length > 0
      ? [creer(doc, 'div', { classe: 'gestes-d-amitie' }, ...font.map(fabriquer))]
      : []),
    ...(defont.length > 0
      ? [
          creer(
            doc,
            'div',
            { classe: 'gestes-d-amitie gestes-qui-defont' },
            ...defont.map(fabriquer),
          ),
        ]
      : []),
  ];
}
