/**
 * L'ecran de connexion: se connecter a un compte, en creer un, ou retrouver l'acces
 * au sien avec son code de secours (etape 3.4).
 *
 * Sans equivalent dans le legacy, qui ne connaissait que des pseudos. LE COMPTE EST
 * FACULTATIF (decision du 11 septembre 2026): l'ecran le dit, et propose de
 * continuer en invite.
 *
 * CET ECRAN NE DECIDE RIEN. Ce qui cloche dans la saisie, ce qui peut partir et ce
 * que le serveur a refuse viennent de modeleConnexion. Il ne retient que ce que le
 * joueur est en train de faire (le formulaire choisi, les champs visites), qui n'a
 * pas a survivre a l'ecran.
 *
 * UN FORMULAIRE, POUR LE NAVIGATEUR. Les champs portent les indications que les
 * gestionnaires de mots de passe reconnaissent. L'envoi est intercepte: la page ne
 * se recharge pas, et la politique de securite du contenu interdit de toute facon
 * a un formulaire de partir ailleurs.
 */

import { BORNES_CODE_DE_SECOURS, BORNES_MOT_DE_PASSE, BORNES_PSEUDO } from '@neon-ninja/shared';

import type { EtatClient } from '../../etat.js';
import { bouton, creer, ecrireTexte, montrer } from '../dom.js';
import type { FormulaireDeCompte, SaisieDeCompte } from '../modeles/connexion.js';
import { modeleConnexion } from '../modeles/connexion.js';
import type { ContexteEcran, EcranAffiche } from './types.js';

/** Monte l'ecran de connexion. */
export function monterConnexion(contexte: ContexteEcran): EcranAffiche {
  const doc = contexte.document;
  const client = contexte.client;

  let nature: FormulaireDeCompte = 'connexion';
  let pseudoVisite = false;
  let motDePasseVisite = false;
  let codeVisite = false;
  let etatCourant: EtatClient | undefined;

  const onglet = (valeur: 'connexion' | 'inscription', texte: string): HTMLButtonElement => {
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
  const champCode = creer(doc, 'input', {
    classe: 'champ-texte champ-code',
    attributs: {
      type: 'text',
      name: 'code-de-secours',
      autocomplete: 'off',
      autocapitalize: 'characters',
      maxlength: String(BORNES_CODE_DE_SECOURS.saisieMaximum),
      spellcheck: 'false',
      placeholder: 'XXXX-XXXX-XXXX-XXXX',
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

  const titre = creer(doc, 'h1', { classe: 'connexion-titre' });
  const intro = creer(doc, 'p', { classe: 'connexion-intro' });
  const erreurPseudo = creer(doc, 'span', { classe: 'champ-erreur' });
  const erreurCode = creer(doc, 'span', { classe: 'champ-erreur' });
  const erreurMotDePasse = creer(doc, 'span', { classe: 'champ-erreur' });
  const libelleMotDePasse = creer(doc, 'span', { classe: 'etiquette' });
  const aideMotDePasse = creer(doc, 'span', { classe: 'connexion-aide' });
  const erreurGenerale = creer(doc, 'p', {
    classe: 'connexion-erreur',
    attributs: { role: 'alert' },
  });
  const envoyer = bouton(doc, { classe: 'bouton bouton-primaire bouton-large', type: 'submit' });
  const texteEnvoyer = creer(doc, 'span');
  envoyer.append(texteEnvoyer);

  const etiquetteCode = creer(
    doc,
    'label',
    { classe: 'champ-compte' },
    creer(doc, 'span', { classe: 'etiquette', texte: 'Code de secours' }),
    champCode,
    erreurCode,
  );

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
    etiquetteCode,
    creer(
      doc,
      'label',
      { classe: 'champ-compte' },
      libelleMotDePasse,
      champMotDePasse,
      aideMotDePasse,
      erreurMotDePasse,
    ),
    erreurGenerale,
    envoyer,
  );

  const onglets = creer(
    doc,
    'div',
    {
      classe: 'onglets',
      attributs: { role: 'tablist', 'aria-label': 'Connexion ou inscription' },
    },
    ongletConnexion,
    ongletInscription,
  );

  /**
   * Passe d'un formulaire a l'autre entre la connexion et le mot de passe oublie.
   *
   * Le mot de passe saisi est efface: le mot de passe errone d'une connexion ne doit
   * pas devenir, sans qu'on le voie, le nouveau mot de passe d'une reinitialisation.
   */
  const passerA = (vers: FormulaireDeCompte): void => {
    nature = vers;
    champMotDePasse.value = '';
    motDePasseVisite = false;
    codeVisite = false;
    rendre();
  };

  const motDePasseOublie = bouton(
    doc,
    { classe: 'bouton bouton-discret', texte: 'Mot de passe oublié ?' },
    () => {
      passerA('reinitialisation');
    },
  );
  const retourALaConnexion = bouton(
    doc,
    { classe: 'bouton bouton-discret', texte: 'Retour à la connexion' },
    () => {
      passerA('connexion');
    },
  );

  const racine = creer(
    doc,
    'section',
    { classe: 'ecran ecran-connexion' },
    creer(
      doc,
      'div',
      { classe: 'panneau connexion-panneau' },
      titre,
      intro,
      onglets,
      formulaire,
      motDePasseOublie,
      retourALaConnexion,
      bouton(doc, { classe: 'bouton bouton-discret', texte: 'Continuer en invité' }, () => {
        client.naviguer('accueil');
      }),
    ),
  );

  const saisie = (): SaisieDeCompte => ({
    nature,
    pseudo: champPseudo.value,
    motDePasse: champMotDePasse.value,
    codeDeSecours: champCode.value,
    pseudoVisite,
    motDePasseVisite,
    codeVisite,
  });

  function rendre(): void {
    if (etatCourant === undefined) {
      return;
    }

    const modele = modeleConnexion(etatCourant, saisie());

    ecrireTexte(titre, modele.titre);
    ecrireTexte(intro, modele.intro);
    montrer(onglets, modele.onglets);
    montrer(etiquetteCode, modele.demandeLeCode);
    montrer(motDePasseOublie, nature === 'connexion');
    montrer(retourALaConnexion, nature === 'reinitialisation');
    ecrireTexte(libelleMotDePasse, modele.libelleMotDePasse);

    ongletConnexion.setAttribute('aria-selected', String(nature === 'connexion'));
    ongletInscription.setAttribute('aria-selected', String(nature === 'inscription'));
    champMotDePasse.setAttribute('autocomplete', modele.autocompletion);

    ecrireTexte(erreurPseudo, modele.erreurPseudo ?? '');
    montrer(erreurPseudo, modele.erreurPseudo !== undefined);
    champPseudo.toggleAttribute('aria-invalid', modele.erreurPseudo !== undefined);

    ecrireTexte(erreurCode, modele.erreurCode ?? '');
    montrer(erreurCode, modele.erreurCode !== undefined);
    champCode.toggleAttribute('aria-invalid', modele.erreurCode !== undefined);

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

  const surSortieCode = (): void => {
    codeVisite = true;
    rendre();
  };

  // Tenter d'envoyer montre toutes les fautes d'un coup: c'est le moment ou le
  // joueur veut savoir ce qui manque.
  const surEnvoi = (evenement: Event): void => {
    evenement.preventDefault();
    pseudoVisite = true;
    motDePasseVisite = true;
    codeVisite = true;

    if (etatCourant !== undefined) {
      const envoi = modeleConnexion(etatCourant, saisie()).envoi;

      if (envoi?.nature === 'connexion') {
        client.seConnecter(envoi.demande);
      } else if (envoi?.nature === 'inscription') {
        client.sInscrire(envoi.demande);
      } else if (envoi?.nature === 'reinitialisation') {
        client.reinitialiserMotDePasse(envoi.demande);
      }
    }

    rendre();
  };

  formulaire.addEventListener('input', surSaisie);
  champPseudo.addEventListener('blur', surSortiePseudo);
  champMotDePasse.addEventListener('blur', surSortieMotDePasse);
  champCode.addEventListener('blur', surSortieCode);
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
      champCode.removeEventListener('blur', surSortieCode);
      formulaire.removeEventListener('submit', surEnvoi);
      racine.remove();
    },
  };
}
