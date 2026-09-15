/**
 * La securite du compte, dans le profil (etape 3.4): changer son mot de passe, et
 * obtenir un nouveau code de secours.
 *
 * DEUX FORMULAIRES, CHACUN AVEC LE MOT DE PASSE ACTUEL. Il est exige meme avec une
 * session ouverte: une page restee ouverte, ou un jeton vole, ne doivent pas suffire
 * a s'approprier le compte.
 *
 * CE COMPOSANT NE DECIDE RIEN. Ce qui cloche dans la saisie, ce qui peut partir et ce
 * que le serveur a repondu viennent de modeles/securite.ts. Il ne retient que ce que
 * le joueur est en train de faire: les champs visites, et s'il a retouche sa saisie
 * depuis l'envoi. Une demande acceptee vide son formulaire; le code emis s'affiche
 * dans sa propre fenetre (composants/codeDeSecours.ts).
 *
 * UN FORMULAIRE, POUR LE NAVIGATEUR. Chaque formulaire porte le pseudo du compte dans
 * un champ cache: c'est ce qui permet au gestionnaire de mots de passe de savoir
 * quel compte change de mot de passe.
 */

import { BORNES_MOT_DE_PASSE } from '@neon-ninja/shared';

import type { Client } from '../../client.js';
import type { DemandeDeCompte, EtatClient } from '../../etat.js';
import { creer, ecrireTexte, montrer } from '../dom.js';
import type { ModeleChangement, ModeleCode } from '../modeles/securite.js';
import { modeleChangementMotDePasse, modeleNouveauCode } from '../modeles/securite.js';

/** La securite du compte, montee. */
export interface SecuriteDuCompte {
  readonly racine: HTMLElement;
  afficher(etat: EtatClient): void;
  demonter(): void;
}

/** Un champ de mot de passe, et ce qui s'affiche sous lui. */
interface ChampDeMotDePasse {
  readonly etiquette: HTMLLabelElement;
  readonly champ: HTMLInputElement;
  readonly aide: HTMLElement;
  readonly erreur: HTMLElement;
}

/** Fabrique un champ de mot de passe, avec son etiquette. */
function champDeMotDePasse(
  doc: Document,
  nom: string,
  libelle: string,
  autocompletion: 'current-password' | 'new-password',
): ChampDeMotDePasse {
  const champ = creer(doc, 'input', {
    classe: 'champ-texte',
    attributs: {
      type: 'password',
      name: nom,
      autocomplete: autocompletion,
      maxlength: String(BORNES_MOT_DE_PASSE.longueur.maximum),
    },
  });
  const aide = creer(doc, 'span', { classe: 'connexion-aide' });
  const erreur = creer(doc, 'span', { classe: 'champ-erreur' });
  const etiquette = creer(
    doc,
    'label',
    { classe: 'champ-compte' },
    creer(doc, 'span', { classe: 'etiquette', texte: libelle }),
    champ,
    aide,
    erreur,
  );

  montrer(aide, false);
  montrer(erreur, false);

  return { etiquette, champ, aide, erreur };
}

/** Ecrit un motif sous un champ, ou le cache. */
function ecrireFaute(champ: ChampDeMotDePasse, motif: string | undefined): void {
  ecrireTexte(champ.erreur, motif ?? '');
  montrer(champ.erreur, motif !== undefined);
  champ.champ.toggleAttribute('aria-invalid', motif !== undefined);
}

/** Ce qui s'affiche sous un formulaire, et son bouton d'envoi. */
interface PiedDeFormulaire {
  readonly erreur: HTMLElement;
  readonly confirmation: HTMLElement;
  readonly envoyer: HTMLButtonElement;
}

/** Fabrique le pied d'un formulaire. */
function piedDeFormulaire(doc: Document): PiedDeFormulaire {
  const erreur = creer(doc, 'p', { classe: 'connexion-erreur', attributs: { role: 'alert' } });
  const confirmation = creer(doc, 'p', {
    classe: 'securite-confirmation',
    attributs: { role: 'status' },
  });
  const envoyer = creer(doc, 'button', {
    classe: 'bouton bouton-secondaire',
    attributs: { type: 'submit' },
  });

  montrer(erreur, false);
  montrer(confirmation, false);

  return { erreur, confirmation, envoyer };
}

/** Met a jour le pied d'un formulaire. */
function ecrirePied(pied: PiedDeFormulaire, modele: ModeleChangement | ModeleCode): void {
  ecrireTexte(pied.erreur, modele.erreurGenerale ?? '');
  montrer(pied.erreur, modele.erreurGenerale !== undefined);
  ecrireTexte(pied.confirmation, modele.confirmation ?? '');
  montrer(pied.confirmation, modele.confirmation !== undefined);
  ecrireTexte(pied.envoyer, modele.bouton);
  pied.envoyer.disabled = modele.enCours;
  pied.envoyer.toggleAttribute('aria-busy', modele.enCours);
}

/** Le champ cache qui dit au gestionnaire de mots de passe de quel compte il s'agit. */
function champDuPseudo(doc: Document): HTMLInputElement {
  const champ = creer(doc, 'input', {
    attributs: { type: 'text', name: 'pseudo', autocomplete: 'username', readonly: '' },
  });
  champ.hidden = true;

  return champ;
}

/** Monte la securite du compte. */
export function monterSecuriteDuCompte(doc: Document, client: Client): SecuriteDuCompte {
  let etatCourant: EtatClient | undefined;

  // -- Changer le mot de passe ------------------------------------------------

  const actuel = champDeMotDePasse(
    doc,
    'mot-de-passe-actuel',
    'Mot de passe actuel',
    'current-password',
  );
  const nouveau = champDeMotDePasse(
    doc,
    'nouveau-mot-de-passe',
    'Nouveau mot de passe',
    'new-password',
  );
  const piedChangement = piedDeFormulaire(doc);
  const pseudoChangement = champDuPseudo(doc);
  let changement = { motDePasseVisite: false, nouveauVisite: false, modifieeDepuisLEnvoi: false };

  const formulaireChangement = creer(
    doc,
    'form',
    { classe: 'panneau securite-formulaire', attributs: { novalidate: '' } },
    creer(doc, 'h3', { texte: 'Changer le mot de passe' }),
    pseudoChangement,
    actuel.etiquette,
    nouveau.etiquette,
    piedChangement.erreur,
    piedChangement.confirmation,
    piedChangement.envoyer,
  );

  // -- Nouveau code de secours ------------------------------------------------

  const aideDuCode = creer(doc, 'p', { classe: 'securite-aide' });
  const duCode = champDeMotDePasse(
    doc,
    'mot-de-passe-du-code',
    'Mot de passe actuel',
    'current-password',
  );
  const piedCode = piedDeFormulaire(doc);
  const pseudoCode = champDuPseudo(doc);
  let saisieDuCode = { motDePasseVisite: false, modifieeDepuisLEnvoi: false };

  const formulaireCode = creer(
    doc,
    'form',
    { classe: 'panneau securite-formulaire', attributs: { novalidate: '' } },
    creer(doc, 'h3', { texte: 'Code de secours' }),
    aideDuCode,
    pseudoCode,
    duCode.etiquette,
    piedCode.erreur,
    piedCode.confirmation,
    piedCode.envoyer,
  );

  const racine = creer(
    doc,
    'section',
    { classe: 'profil-securite' },
    creer(doc, 'h2', { texte: 'Sécurité' }),
    creer(doc, 'div', { classe: 'securite-formulaires' }, formulaireChangement, formulaireCode),
  );

  /** La demande dont le formulaire a deja ete vide: il ne l'est qu'une fois par reponse. */
  let demandeVidee: DemandeDeCompte | undefined;

  const saisieDeChangement = () => ({
    motDePasse: actuel.champ.value,
    nouveauMotDePasse: nouveau.champ.value,
    ...changement,
  });

  const saisieDeCode = () => ({ motDePasse: duCode.champ.value, ...saisieDuCode });

  /** Vide le formulaire dont la demande vient d'aboutir. */
  const viderApresReponse = (etat: EtatClient): void => {
    const demande = etat.demandeDeCompte;

    if (!demande.acceptee || demande === demandeVidee) {
      return;
    }

    demandeVidee = demande;

    if (demande.nature === 'motDePasse') {
      actuel.champ.value = '';
      nouveau.champ.value = '';
      changement = { ...changement, motDePasseVisite: false, nouveauVisite: false };
    } else if (demande.nature === 'codeDeSecours') {
      duCode.champ.value = '';
      saisieDuCode = { ...saisieDuCode, motDePasseVisite: false };
    }
  };

  function rendre(): void {
    if (etatCourant === undefined) {
      return;
    }

    viderApresReponse(etatCourant);

    const pseudo =
      etatCourant.session.nature === 'compte' ? etatCourant.session.progression.pseudo : '';
    pseudoChangement.value = pseudo;
    pseudoCode.value = pseudo;

    const modeleChangement = modeleChangementMotDePasse(etatCourant, saisieDeChangement());
    ecrireFaute(actuel, modeleChangement.erreurMotDePasse);
    ecrireFaute(nouveau, modeleChangement.erreurNouveau);
    ecrireTexte(nouveau.aide, modeleChangement.aideNouveau);
    montrer(nouveau.aide, true);
    ecrirePied(piedChangement, modeleChangement);

    const modeleCode = modeleNouveauCode(etatCourant, saisieDeCode());
    ecrireTexte(aideDuCode, modeleCode.aide);
    aideDuCode.classList.toggle('securite-alerte', modeleCode.sansCode);
    ecrireFaute(duCode, modeleCode.erreurMotDePasse);
    ecrirePied(piedCode, modeleCode);
  }

  const surSaisieDuChangement = (): void => {
    changement = { ...changement, modifieeDepuisLEnvoi: true };
    rendre();
  };

  const surSaisieDuCode = (): void => {
    saisieDuCode = { ...saisieDuCode, modifieeDepuisLEnvoi: true };
    rendre();
  };

  const surSortieActuel = (): void => {
    changement = { ...changement, motDePasseVisite: true };
    rendre();
  };

  const surSortieNouveau = (): void => {
    changement = { ...changement, nouveauVisite: true };
    rendre();
  };

  const surSortieDuCode = (): void => {
    saisieDuCode = { ...saisieDuCode, motDePasseVisite: true };
    rendre();
  };

  // Tenter d'envoyer montre toutes les fautes d'un coup.
  const surEnvoiDuChangement = (evenement: Event): void => {
    evenement.preventDefault();
    changement = { motDePasseVisite: true, nouveauVisite: true, modifieeDepuisLEnvoi: false };

    if (etatCourant !== undefined) {
      const envoi = modeleChangementMotDePasse(etatCourant, saisieDeChangement()).envoi;

      if (envoi !== undefined) {
        client.changerMotDePasse(envoi);
      }
    }

    rendre();
  };

  const surEnvoiDuCode = (evenement: Event): void => {
    evenement.preventDefault();
    saisieDuCode = { motDePasseVisite: true, modifieeDepuisLEnvoi: false };

    if (etatCourant !== undefined) {
      const envoi = modeleNouveauCode(etatCourant, saisieDeCode()).envoi;

      if (envoi !== undefined) {
        client.demanderUnCodeDeSecours(envoi);
      }
    }

    rendre();
  };

  formulaireChangement.addEventListener('input', surSaisieDuChangement);
  formulaireChangement.addEventListener('submit', surEnvoiDuChangement);
  actuel.champ.addEventListener('blur', surSortieActuel);
  nouveau.champ.addEventListener('blur', surSortieNouveau);
  formulaireCode.addEventListener('input', surSaisieDuCode);
  formulaireCode.addEventListener('submit', surEnvoiDuCode);
  duCode.champ.addEventListener('blur', surSortieDuCode);

  return {
    racine,

    afficher(etat) {
      etatCourant = etat;
      rendre();
    },

    demonter() {
      formulaireChangement.removeEventListener('input', surSaisieDuChangement);
      formulaireChangement.removeEventListener('submit', surEnvoiDuChangement);
      actuel.champ.removeEventListener('blur', surSortieActuel);
      nouveau.champ.removeEventListener('blur', surSortieNouveau);
      formulaireCode.removeEventListener('input', surSaisieDuCode);
      formulaireCode.removeEventListener('submit', surEnvoiDuCode);
      duCode.champ.removeEventListener('blur', surSortieDuCode);
      racine.remove();
    },
  };
}
