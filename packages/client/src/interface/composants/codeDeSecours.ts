/**
 * La fenetre du code de secours: le code que le serveur vient d'emettre, a noter
 * (etape 3.4).
 *
 * ELLE S'OUVRE D'ELLE-MEME des que l'etat porte un code: apres une inscription, une
 * reinitialisation, un changement de mot de passe ou la demande d'un nouveau code.
 * C'est la seule fois que le joueur le voit: le serveur n'en garde que l'empreinte.
 *
 * LA FERMER, C'EST DIRE QU'ON L'A NOTE, quelle que soit la facon: le bouton, la
 * croix, la touche Echap ou un clic a cote. Le code est alors oublie. La fenetre le
 * dit, et dit aussi qu'un autre code se cree depuis le profil: une fermeture trop
 * rapide ne fait pas perdre le compte a qui connait encore son mot de passe.
 *
 * CE COMPOSANT NE DECIDE RIEN. Il montre le code de l'etat, et previent le client a
 * la fermeture. Comme les ecrans, il ne s'abonne pas: l'application lui donne l'etat.
 */

import type { Client } from '../../client.js';
import type { EtatClient } from '../../etat.js';
import { bouton, creer, ecrireTexte, montrer } from '../dom.js';
import { monterFenetre } from './fenetre.js';

/** La fenetre du code de secours, montee. */
export interface FenetreDuCode {
  readonly racine: HTMLElement;
  afficher(etat: EtatClient): void;
  demonter(): void;
}

/** Ce que dit la fenetre, au-dessus du code. */
export const EXPLICATION_DU_CODE =
  'Notez ce code et gardez-le hors du jeu : il remplace votre mot de passe si vous l’oubliez. Il ne sera plus jamais affiché.';

/** Ce que dit la fenetre, sous le code. */
export const AVERTISSEMENT_DU_CODE =
  'Chaque nouveau code annule le précédent. Sans code, un mot de passe oublié ne se retrouve pas ; tant que vous connaissez votre mot de passe, vous pouvez en créer un autre depuis votre profil.';

/** Monte la fenetre du code de secours, fermee. */
export function monterFenetreDuCode(doc: Document, client: Client): FenetreDuCode {
  const fenetre = monterFenetre({
    document: doc,
    titre: 'Votre code de secours',
    classe: 'fenetre-code',
    surFermeture: () => {
      client.noterLeCodeDeSecours();
    },
  });

  const code = creer(doc, 'p', {
    classe: 'code-de-secours',
    attributs: { translate: 'no' },
  });
  const copie = creer(doc, 'p', { classe: 'code-copie', attributs: { role: 'status' } });

  fenetre.corps.append(
    creer(doc, 'p', { texte: EXPLICATION_DU_CODE }),
    code,
    creer(doc, 'p', { classe: 'code-avertissement', texte: AVERTISSEMENT_DU_CODE }),
    copie,
  );

  // Le presse-papiers n'existe que sur une page servie de facon sure: sans lui, le
  // bouton n'est pas propose, et le code se recopie a la main.
  const pressePapiers = doc.defaultView?.navigator.clipboard;

  const copier = bouton(doc, { classe: 'bouton bouton-secondaire', texte: 'Copier' }, () => {
    void pressePapiers?.writeText(code.textContent ?? '').then(
      () => {
        ecrireTexte(copie, 'Code copié.');
      },
      () => {
        ecrireTexte(copie, 'La copie a échoué : recopiez le code à la main.');
      },
    );
  });
  montrer(copier, pressePapiers !== undefined);

  fenetre.pied.append(
    copier,
    bouton(doc, { classe: 'bouton bouton-primaire', texte: 'J’ai noté mon code' }, () => {
      fenetre.fermer();
    }),
  );

  return {
    racine: fenetre.racine,

    afficher(etat) {
      if (etat.codeDeSecours === undefined) {
        fenetre.fermer();
        return;
      }

      if (code.textContent !== etat.codeDeSecours) {
        ecrireTexte(code, etat.codeDeSecours);
        ecrireTexte(copie, '');
      }

      fenetre.ouvrir();
    },

    demonter() {
      fenetre.demonter();
    },
  };
}
