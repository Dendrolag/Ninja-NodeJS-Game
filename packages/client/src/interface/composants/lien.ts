/**
 * La ligne d'etat du lien: ce qui se passe entre la page et le serveur, sur tous les
 * ecrans hors de l'accueil et du jeu (etape 2.6).
 *
 * POURQUOI. Un joueur dont le lien tombe reste desormais sur son ecran pendant que la
 * page le retablit. Sans cette ligne, il verrait ses boutons s'eteindre sans savoir
 * pourquoi, ni que la page s'en occupe. Elle dit la meme chose que l'accueil, et
 * propose les memes issues: reessayer, recharger, continuer en invite.
 *
 * CE COMPOSANT NE DECIDE RIEN: le texte, les boutons et le moment de se montrer
 * viennent de modeles/lien.ts.
 */

import type { Client } from '../../client.js';
import type { EtatClient } from '../../etat.js';
import { bouton, creer, ecrireTexte, montrer } from '../dom.js';
import { lienAMontrer, modeleDuLien } from '../modeles/lien.js';

/** La ligne d'etat du lien, montee. */
export interface LigneDuLien {
  readonly racine: HTMLElement;
  afficher(etat: EtatClient): void;
  demonter(): void;
}

/** Monte la ligne d'etat du lien, cachee tant que le lien va bien. */
export function monterLigneDuLien(
  doc: Document,
  client: Client,
  recharger: () => void,
): LigneDuLien {
  const texte = creer(doc, 'p', { classe: 'ligne-lien-texte', attributs: { role: 'status' } });
  const reessayer = bouton(
    doc,
    { classe: 'bouton bouton-secondaire', texte: 'Réessayer', icone: 'replay' },
    () => {
      client.reessayer();
    },
  );
  const recharge = bouton(
    doc,
    { classe: 'bouton bouton-secondaire', texte: 'Recharger la page', icone: 'replay' },
    recharger,
  );
  const continuerEnInvite = bouton(
    doc,
    { classe: 'bouton bouton-discret', texte: 'Continuer en invité' },
    () => {
      client.continuerEnInvite();
    },
  );

  const racine = creer(
    doc,
    'div',
    { classe: 'ligne-lien' },
    creer(
      doc,
      'div',
      { classe: 'ligne-lien-contenu' },
      texte,
      reessayer,
      recharge,
      continuerEnInvite,
    ),
  );
  racine.hidden = true;

  return {
    racine,

    afficher(etat) {
      const visible = lienAMontrer(etat);
      montrer(racine, visible);

      if (!visible) {
        return;
      }

      const modele = modeleDuLien(etat);

      ecrireTexte(texte, modele.texte);
      montrer(reessayer, modele.peutReessayer);
      montrer(recharge, modele.peutRecharger);
      montrer(continuerEnInvite, modele.peutContinuerEnInvite);
    },

    demonter() {
      racine.remove();
    },
  };
}
