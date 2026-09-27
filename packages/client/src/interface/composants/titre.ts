/**
 * Le titre d'un compte, dessine (etape 3.9): la ligne sous un pseudo, au salon, sur la
 * fiche et au profil, et la liste du profil ou il se choisit.
 *
 * Tout est texte, pose par creer: un nom de titre ne vient que du paquet partage, mais
 * rien ici ne s'ecrit en HTML.
 */

import { estUnSucces } from '@neon-ninja/shared';

import type { Client } from '../../client.js';
import { creer, ecrireTexte, montrer } from '../dom.js';
import type { ChoixDuTitreAffiche, TitreAffiche } from '../modeles/titre.js';
import { SANS_TITRE } from '../modeles/titre.js';

/** Le titre sous un pseudo: son nom, a la couleur de son palier. */
export function ligneDeTitre(doc: Document, titre: TitreAffiche, classe: string): HTMLElement {
  return creer(doc, 'span', {
    classe: `titre-de-compte ${classe}`,
    texte: titre.nom,
    attributs: { 'data-palier': titre.palier },
  });
}

/** Pose le titre sur une ligne deja montee, ou la cache sans titre. */
export function ecrireLeTitre(element: HTMLElement, titre: TitreAffiche | undefined): void {
  ecrireTexte(element, titre?.nom ?? '');
  element.dataset['palier'] = titre?.palier ?? '';
  montrer(element, titre !== undefined);
}

/** La liste du titre au profil, montee. */
export interface ChoixDuTitreMonte {
  readonly racine: HTMLElement;
  afficher(modele: ChoixDuTitreAffiche): void;
}

/**
 * Monte la liste du titre: « Aucun », puis les succes obtenus, palier par palier. Un
 * choix part aussitot; pendant qu'il attend, la liste est desactivee. Sans succes
 * obtenu, une phrase dit comment en obtenir un.
 */
export function monterChoixDuTitre(doc: Document, client: Client): ChoixDuTitreMonte {
  const liste = creer(doc, 'select', {
    classe: 'champ-texte titre-choix',
    attributs: { id: 'profil-titre', 'aria-describedby': 'profil-titre-aide' },
  });
  const aide = creer(doc, 'p', {
    classe: 'titre-aide',
    texte: 'Il s’affiche sous votre pseudo, au salon et sur votre fiche.',
    attributs: { id: 'profil-titre-aide' },
  });
  const erreur = creer(doc, 'p', { classe: 'titre-erreur', attributs: { role: 'alert' } });
  const champ = creer(
    doc,
    'div',
    { classe: 'titre-champ' },
    creer(doc, 'label', {
      classe: 'etiquette',
      texte: 'Titre',
      attributs: { for: 'profil-titre' },
    }),
    liste,
    aide,
    erreur,
  );
  const sansSucces = creer(doc, 'p', {
    classe: 'titre-aide',
    texte: 'Obtenez un succès pour choisir un titre, affiché sous votre pseudo.',
  });

  liste.addEventListener('change', () => {
    const valeur = liste.value;

    if (valeur === SANS_TITRE) {
      client.choisirUnTitre(null);
    } else if (estUnSucces(valeur)) {
      client.choisirUnTitre(valeur);
    }
  });

  /** Les options deja dessinees, decrites: elles ne se refont que si elles ont change. */
  let optionsDessinees = '';

  return {
    racine: creer(doc, 'div', { classe: 'titre-du-profil' }, champ, sansSucces),

    afficher(modele) {
      const description = JSON.stringify(modele.groupes);

      if (description !== optionsDessinees) {
        optionsDessinees = description;
        liste.replaceChildren(
          creer(doc, 'option', { texte: 'Aucun', attributs: { value: SANS_TITRE } }),
          ...modele.groupes.map((groupe) =>
            creer(
              doc,
              'optgroup',
              { attributs: { label: groupe.nom } },
              ...groupe.titres.map((titre) =>
                creer(doc, 'option', { texte: titre.nom, attributs: { value: titre.id } }),
              ),
            ),
          ),
        );
      }

      // Apres un refus, la liste revient au titre vraiment porte. Pendant l'attente, elle
      // garde le choix qui vient de partir.
      if (!modele.enCours && liste.value !== modele.valeur) {
        liste.value = modele.valeur;
      }

      liste.disabled = modele.enCours;
      ecrireTexte(erreur, modele.erreur ?? '');
      montrer(erreur, modele.erreur !== undefined);
      montrer(champ, modele.groupes.length > 0);
      montrer(sansSucces, modele.groupes.length === 0);
    },
  };
}
