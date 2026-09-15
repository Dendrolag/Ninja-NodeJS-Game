/**
 * L'ecran des parties publiques: la liste des salons ouverts, et l'entree par code.
 *
 * Sans equivalent dans le legacy, qui n'avait qu'un salon. La maquette y ajoute la
 * latence, un compteur de joueurs en ligne et des filtres de mode: ecartes par le
 * cadrage (un seul serveur, un seul mode).
 *
 * CET ECRAN NE DECIDE RIEN. Ce qui peut etre rejoint, ce qui cloche dans le code ou
 * le pseudo, et le refus du serveur viennent de modeleParties. La liste est demandee
 * par la navigation vers cet ecran (client.ts), et sur demande. L'ecran ne retient
 * que la saisie du code et le fait qu'un envoi ait ete tente.
 */

import type { PartiePublique } from '@neon-ninja/shared';

import type { EtatClient } from '../../etat.js';
import { monterChampPseudo } from '../composants/champPseudo.js';
import { bouton, creer, ecrireTexte, montrer } from '../dom.js';
import type { PartieAffichee } from '../modeles/parties.js';
import { modeleParties } from '../modeles/parties.js';
import type { ContexteEcran, EcranAffiche } from './types.js';

/** Monte l'ecran des parties. */
export function monterParties(contexte: ContexteEcran): EcranAffiche {
  const doc = contexte.document;
  const client = contexte.client;

  let etatCourant: EtatClient | undefined;
  let codeTente = false;

  const compteur = creer(doc, 'p', { classe: 'sous-titre-ecran' });
  const champPseudo = monterChampPseudo(doc, client);
  const aidePseudo = creer(doc, 'p', { classe: 'parties-aide' });
  const erreur = creer(doc, 'p', { classe: 'parties-erreur', attributs: { role: 'alert' } });
  const lien = creer(doc, 'p', {
    classe: 'parties-lien',
    texte: 'Connexion au serveur…',
    attributs: { role: 'status' },
  });

  const saisieCode = creer(doc, 'input', {
    attributs: {
      type: 'text',
      name: 'code',
      maxlength: '8',
      autocomplete: 'off',
      autocapitalize: 'characters',
      spellcheck: 'false',
      placeholder: 'Code privé',
      'aria-label': 'Code d’invitation d’une partie privée',
    },
  });
  const joindre = bouton(doc, {
    classe: 'bouton bouton-primaire',
    texte: 'Joindre',
    type: 'submit',
  });
  const formulaireCode = creer(
    doc,
    'form',
    { classe: 'code-prive', attributs: { novalidate: '' } },
    saisieCode,
    joindre,
  );

  const chargement = creer(doc, 'p', {
    classe: 'parties-chargement',
    texte: 'Recherche des parties ouvertes…',
    attributs: { role: 'status' },
  });
  const vide = creer(
    doc,
    'div',
    { classe: 'parties-vide' },
    creer(doc, 'p', {
      texte:
        'Aucune partie publique n’attend de joueurs. Créez la vôtre, ou lancez une partie rapide depuis l’accueil.',
    }),
    bouton(
      doc,
      { classe: 'bouton bouton-secondaire', texte: 'Créer une partie', icone: 'plus' },
      () => {
        client.naviguer('creation');
      },
    ),
  );
  const liste = creer(doc, 'ul', { classe: 'parties' });

  const racine = creer(
    doc,
    'section',
    { classe: 'ecran ecran-parties' },
    creer(
      doc,
      'header',
      { classe: 'parties-entete' },
      creer(
        doc,
        'div',
        { classe: 'titre-et-sous-titre' },
        creer(doc, 'h1', { classe: 'titre-ecran', texte: 'Parties publiques' }),
        compteur,
      ),
      creer(
        doc,
        'div',
        { classe: 'parties-actions' },
        formulaireCode,
        bouton(doc, { classe: 'bouton bouton-secondaire', texte: 'Créer', icone: 'plus' }, () => {
          client.naviguer('creation');
        }),
      ),
    ),
    creer(doc, 'div', { classe: 'parties-invite' }, champPseudo.racine, aidePseudo),
    erreur,
    lien,
    creer(
      doc,
      'section',
      { classe: 'panneau parties-liste' },
      creer(
        doc,
        'div',
        { classe: 'parties-outils' },
        creer(doc, 'h2', { texte: 'Salons ouverts' }),
        bouton(
          doc,
          { classe: 'bouton bouton-discret', texte: 'Actualiser', icone: 'replay' },
          () => {
            client.listerParties();
          },
        ),
      ),
      chargement,
      vide,
      liste,
    ),
  );

  /** La liste deja dessinee: elle ne se redessine que si le serveur en a rendu une autre. */
  let listeDessinee: readonly PartiePublique[] | undefined;
  /** Les boutons pour rejoindre, a activer ou non a chaque etat. */
  let boutonsRejoindre: HTMLButtonElement[] = [];

  const dessinerLaListe = (parties: readonly PartieAffichee[]): void => {
    const lignes = parties.map((partie) => {
      const rejoindre = bouton(
        doc,
        {
          classe: 'bouton bouton-primaire partie-rejoindre',
          texte: 'Rejoindre',
          etiquette: `Rejoindre le salon de ${partie.hote}`,
        },
        () => {
          if (etatCourant === undefined) {
            return;
          }

          const modele = modeleParties(etatCourant, saisieCode.value, codeTente);

          if (modele.peutRejoindre) {
            client.rejoindre(modele.pseudo, { idRoom: partie.idRoom });
          }
        },
      );

      return {
        rejoindre,
        ligne: creer(
          doc,
          'li',
          { classe: 'partie', attributs: { 'data-partie': partie.idRoom } },
          creer(
            doc,
            'div',
            { classe: 'partie-hote' },
            creer(doc, 'span', {
              classe: 'avatar',
              texte: partie.initiales,
              attributs: { 'aria-hidden': 'true' },
            }),
            creer(
              doc,
              'span',
              { classe: 'partie-identite' },
              creer(doc, 'span', { classe: 'partie-titre', texte: partie.titre }),
              creer(doc, 'span', { classe: 'partie-details', texte: partie.details }),
            ),
          ),
          creer(doc, 'span', {
            classe: 'partie-joueurs',
            texte: partie.joueurs,
            attributs: { title: 'Joueurs présents sur la capacité' },
          }),
          rejoindre,
        ),
      };
    });

    boutonsRejoindre = lignes.map(({ rejoindre }) => rejoindre);
    liste.replaceChildren(...lignes.map(({ ligne }) => ligne));
  };

  const rendre = (): void => {
    if (etatCourant === undefined) {
      return;
    }

    const modele = modeleParties(etatCourant, saisieCode.value, codeTente);

    ecrireTexte(compteur, modele.compteur);
    champPseudo.afficher(etatCourant, modele.pseudoRequis, modele.erreurPseudo);
    ecrireTexte(aidePseudo, modele.aidePseudo ?? '');
    montrer(aidePseudo, modele.aidePseudo !== undefined);

    const texteErreur = modele.refus ?? modele.erreurCode ?? modele.erreurPseudo;
    ecrireTexte(erreur, texteErreur ?? '');
    montrer(erreur, texteErreur !== undefined);
    saisieCode.toggleAttribute('aria-invalid', modele.erreurCode !== undefined);
    montrer(lien, !modele.lienEtabli);

    montrer(chargement, modele.enChargement);
    montrer(vide, modele.vide);
    montrer(liste, modele.parties.length > 0);

    if (etatCourant.partiesPubliques !== listeDessinee) {
      listeDessinee = etatCourant.partiesPubliques;
      dessinerLaListe(modele.parties);
    }

    for (const rejoindre of boutonsRejoindre) {
      rejoindre.disabled = !modele.peutRejoindre;
    }

    joindre.disabled = !modele.peutRejoindre;
    joindre.toggleAttribute('aria-busy', modele.enAttente);
  };

  const surSaisieCode = (): void => {
    rendre();
  };

  const surEnvoiCode = (evenement: Event): void => {
    evenement.preventDefault();
    codeTente = true;

    if (etatCourant !== undefined) {
      const modele = modeleParties(etatCourant, saisieCode.value, codeTente);

      if (modele.peutRejoindre && modele.code !== undefined) {
        client.rejoindre(modele.pseudo, { code: modele.code });
      }
    }

    rendre();
  };

  saisieCode.addEventListener('input', surSaisieCode);
  formulaireCode.addEventListener('submit', surEnvoiCode);

  return {
    racine,

    afficher(etat) {
      etatCourant = etat;
      rendre();
    },

    demonter() {
      saisieCode.removeEventListener('input', surSaisieCode);
      formulaireCode.removeEventListener('submit', surEnvoiCode);
      champPseudo.demonter();
      racine.remove();
    },
  };
}
