/**
 * L'ecran de connexion: se connecter a un compte, ou en creer un.
 *
 * Sans equivalent dans le legacy, qui ne connaissait que des pseudos. LE COMPTE EST
 * FACULTATIF (decision du 11 septembre 2026): l'ecran le dit, et propose de
 * continuer en invite.
 *
 * CET ECRAN NE DECIDE RIEN. Ce qui cloche dans la saisie, ce qui peut partir et ce
 * que le serveur a refuse viennent de modeleConnexion. Il ne retient que ce que le
 * joueur est en train de faire (l'onglet choisi, les champs visites), qui n'a pas a
 * survivre a l'ecran.
 *
 * UN FORMULAIRE, POUR LE NAVIGATEUR. Les champs portent les indications que les
 * gestionnaires de mots de passe reconnaissent. L'envoi est intercepte: la page ne
 * se recharge pas, et la politique de securite du contenu interdit de toute facon
 * a un formulaire de partir ailleurs.
 */

import { BORNES_MOT_DE_PASSE, BORNES_PSEUDO } from '@neon-ninja/shared';

import type { EtatClient, NatureDemandeDeCompte } from '../../etat.js';
import { bouton, creer, ecrireTexte, montrer } from '../dom.js';
import type { SaisieDeCompte } from '../modeles/connexion.js';
import { modeleConnexion } from '../modeles/connexion.js';
import type { ContexteEcran, EcranAffiche } from './types.js';

/** Monte l'ecran de connexion. */
export function monterConnexion(contexte: ContexteEcran): EcranAffiche {
  const doc = contexte.document;
  const client = contexte.client;

  let nature: NatureDemandeDeCompte = 'connexion';
  let pseudoVisite = false;
  let motDePasseVisite = false;
  let etatCourant: EtatClient | undefined;

  const onglet = (valeur: NatureDemandeDeCompte, texte: string): HTMLButtonElement => {
    const element = bouton(doc, { classe: 'onglet', texte }, () => {
      nature = valeur;
      rendre();
    });
    element.setAttribute('role', 'tab');

    return element;
  };

  const ongletConnexion = onglet('connexion', 'Se connecter');
  const ongletInscription = onglet('inscription', 'Créer un compte');

  const champPseudo = creer(doc, 'input', {
    classe: 'champ-texte',
    attributs: {
      type: 'text',
      name: 'pseudo',
      autocomplete: 'username',
      maxlength: String(BORNES_PSEUDO.longueur.maximum),
      spellcheck: 'false',
    },
  });
  const champMotDePasse = creer(doc, 'input', {
    classe: 'champ-texte',
    attributs: {
      type: 'password',
      name: 'mot-de-passe',
      maxlength: String(BORNES_MOT_DE_PASSE.longueur.maximum),
    },
  });

  const erreurPseudo = creer(doc, 'span', { classe: 'champ-erreur' });
  const erreurMotDePasse = creer(doc, 'span', { classe: 'champ-erreur' });
  const aideMotDePasse = creer(doc, 'span', { classe: 'connexion-aide' });
  const erreurGenerale = creer(doc, 'p', {
    classe: 'connexion-erreur',
    attributs: { role: 'alert' },
  });
  const envoyer = bouton(doc, { classe: 'bouton bouton-primaire bouton-large', type: 'submit' });
  const texteEnvoyer = creer(doc, 'span');
  envoyer.append(texteEnvoyer);

  const formulaire = creer(
    doc,
    'form',
    { classe: 'connexion-formulaire', attributs: { novalidate: '' } },
    creer(
      doc,
      'label',
      { classe: 'champ-compte' },
      creer(doc, 'span', { classe: 'etiquette', texte: 'Pseudo' }),
      champPseudo,
      erreurPseudo,
    ),
    creer(
      doc,
      'label',
      { classe: 'champ-compte' },
      creer(doc, 'span', { classe: 'etiquette', texte: 'Mot de passe' }),
      champMotDePasse,
      aideMotDePasse,
      erreurMotDePasse,
    ),
    erreurGenerale,
    envoyer,
  );

  const racine = creer(
    doc,
    'section',
    { classe: 'ecran ecran-connexion' },
    creer(
      doc,
      'div',
      { classe: 'panneau connexion-panneau' },
      creer(doc, 'h1', { classe: 'connexion-titre', texte: 'Votre compte' }),
      creer(doc, 'p', {
        classe: 'connexion-intro',
        texte:
          'Le compte est facultatif : il garde votre XP, vos pièces et vos points de ligue. Sans compte, vous jouez en invité, avec un simple pseudo.',
      }),
      creer(
        doc,
        'div',
        {
          classe: 'onglets',
          attributs: { role: 'tablist', 'aria-label': 'Connexion ou inscription' },
        },
        ongletConnexion,
        ongletInscription,
      ),
      formulaire,
      bouton(doc, { classe: 'bouton bouton-discret', texte: 'Continuer en invité' }, () => {
        client.naviguer('accueil');
      }),
    ),
  );

  const saisie = (): SaisieDeCompte => ({
    nature,
    pseudo: champPseudo.value,
    motDePasse: champMotDePasse.value,
    pseudoVisite,
    motDePasseVisite,
  });

  function rendre(): void {
    if (etatCourant === undefined) {
      return;
    }

    const modele = modeleConnexion(etatCourant, saisie());

    ongletConnexion.setAttribute('aria-selected', String(nature === 'connexion'));
    ongletInscription.setAttribute('aria-selected', String(nature === 'inscription'));
    champMotDePasse.setAttribute('autocomplete', modele.autocompletion);

    ecrireTexte(erreurPseudo, modele.erreurPseudo ?? '');
    montrer(erreurPseudo, modele.erreurPseudo !== undefined);
    champPseudo.toggleAttribute('aria-invalid', modele.erreurPseudo !== undefined);

    ecrireTexte(erreurMotDePasse, modele.erreurMotDePasse ?? '');
    montrer(erreurMotDePasse, modele.erreurMotDePasse !== undefined);
    champMotDePasse.toggleAttribute('aria-invalid', modele.erreurMotDePasse !== undefined);

    ecrireTexte(aideMotDePasse, modele.aideMotDePasse ?? '');
    montrer(aideMotDePasse, modele.aideMotDePasse !== undefined);

    ecrireTexte(erreurGenerale, modele.erreurGenerale ?? '');
    montrer(erreurGenerale, modele.erreurGenerale !== undefined);

    ecrireTexte(texteEnvoyer, modele.enCours ? 'Un instant…' : modele.bouton);
    envoyer.disabled = modele.enCours;
    envoyer.toggleAttribute('aria-busy', modele.enCours);
  }

  const surSaisie = (): void => {
    rendre();
  };

  const surSortiePseudo = (): void => {
    pseudoVisite = true;
    rendre();
  };

  const surSortieMotDePasse = (): void => {
    motDePasseVisite = true;
    rendre();
  };

  // Tenter d'envoyer montre toutes les fautes d'un coup: c'est le moment ou le
  // joueur veut savoir ce qui manque.
  const surEnvoi = (evenement: Event): void => {
    evenement.preventDefault();
    pseudoVisite = true;
    motDePasseVisite = true;

    if (etatCourant !== undefined) {
      const envoi = modeleConnexion(etatCourant, saisie()).envoi;

      if (envoi?.nature === 'connexion') {
        client.seConnecter(envoi.demande);
      } else if (envoi?.nature === 'inscription') {
        client.sInscrire(envoi.demande);
      }
    }

    rendre();
  };

  formulaire.addEventListener('input', surSaisie);
  champPseudo.addEventListener('blur', surSortiePseudo);
  champMotDePasse.addEventListener('blur', surSortieMotDePasse);
  formulaire.addEventListener('submit', surEnvoi);

  return {
    racine,

    afficher(etat) {
      etatCourant = etat;
      rendre();
    },

    demonter() {
      formulaire.removeEventListener('input', surSaisie);
      champPseudo.removeEventListener('blur', surSortiePseudo);
      champMotDePasse.removeEventListener('blur', surSortieMotDePasse);
      formulaire.removeEventListener('submit', surEnvoi);
      racine.remove();
    },
  };
}
