/**
 * Le compte dans l'en-tete: les pieces, le niveau, le pseudo et le palier, ou de
 * quoi se connecter.
 *
 * CE COMPOSANT NE DECIDE RIEN. Ce qu'il montre et ce qu'il propose vient de
 * modeleCompteDeLEntete; il ne fait qu'ecrire le document. Comme les ecrans, il ne
 * s'abonne pas au client: l'application lui donne l'etat.
 *
 * L'ANNEAU DU NIVEAU est un degrade conique dont l'angle vient d'une variable de
 * style, posee par le modele objet du document: la politique de securite du
 * contenu refuse les attributs style ecrits a la main, pas cette ecriture-la.
 */

import type { Client } from '../../client.js';
import type { EtatClient } from '../../etat.js';
import { bouton, creer, ecrireTexte, montrer } from '../dom.js';
import { icone } from '../icones.js';
import { modeleCompteDeLEntete } from '../modeles/entete.js';

/** Le compte de l'en-tete, monte. */
export interface CompteDeLEntete {
  readonly racine: HTMLElement;
  afficher(etat: EtatClient): void;
  demonter(): void;
}

/** Monte le compte de l'en-tete. */
export function monterCompteDeLEntete(doc: Document, client: Client): CompteDeLEntete {
  const seConnecter = bouton(
    doc,
    { classe: 'bouton bouton-secondaire entete-connexion', texte: 'Se connecter', icone: 'user' },
    () => {
      client.naviguer('connexion');
    },
  );

  const nombreDePieces = creer(doc, 'span');
  const pieces = creer(
    doc,
    'span',
    { classe: 'pastille-pieces' },
    icone(doc, 'coin', 16),
    creer(doc, 'span', { classe: 'visuellement-cache', texte: 'Pièces : ' }),
    nombreDePieces,
  );

  const niveau = creer(doc, 'span');
  const anneau = creer(doc, 'span', { classe: 'anneau-niveau' }, niveau);
  const pseudo = creer(doc, 'span', { classe: 'carte-compte-pseudo' });
  const palier = creer(doc, 'span', { classe: 'carte-compte-palier' });
  const carte = creer(
    doc,
    'button',
    { classe: 'carte-compte', attributs: { type: 'button' } },
    anneau,
    creer(doc, 'span', { classe: 'carte-compte-identite' }, pseudo, palier),
  );

  const ouvrirLeProfil = (): void => {
    client.naviguer('profil');
  };
  carte.addEventListener('click', ouvrirLeProfil);

  const racine = creer(doc, 'div', { classe: 'entete-compte' }, seConnecter, pieces, carte);

  return {
    racine,

    afficher(etat) {
      const modele = modeleCompteDeLEntete(etat);

      montrer(seConnecter, modele.nature === 'invite' && modele.peutSeConnecter);
      montrer(pieces, modele.nature === 'compte');
      montrer(carte, modele.nature === 'compte');

      if (modele.nature !== 'compte') {
        return;
      }

      ecrireTexte(nombreDePieces, modele.pieces);
      ecrireTexte(niveau, String(modele.niveau));
      ecrireTexte(pseudo, modele.pseudo);
      ecrireTexte(palier, modele.palier);
      anneau.style.setProperty('--avancement', `${String(modele.avancementPourCent)}%`);
      carte.disabled = !modele.peutOuvrirLeProfil;
      carte.setAttribute(
        'aria-label',
        `${modele.pseudo}, niveau ${String(modele.niveau)}, ${modele.xp}, palier ${modele.palier}`,
      );
      carte.title = modele.xp;
    },

    demonter() {
      carte.removeEventListener('click', ouvrirLeProfil);
      racine.remove();
    },
  };
}
