/**
 * Les reglages d'une partie: le formulaire, et le panneau de l'hote qui le contient.
 *
 * UN FORMULAIRE, DEUX ENDROITS. Le panneau du salon (etape 4.3) le montre dans une
 * fenetre, pour l'hote qui change les reglages avant le lancement. L'ecran de
 * creation (reprise des ecrans du jalon 3) le montre dans la page, pour les
 * reglages de depart. C'est le meme formulaire: une partie ne peut pas se creer
 * avec un reglage que le salon ne saurait pas changer, ni l'inverse.
 *
 * CE FICHIER NE CONNAIT AUCUN REGLAGE PAR SON NOM. Il dessine les champs en
 * parcourant GROUPES_REGLAGES, lit ce que le joueur a saisi, et fait verifier le
 * tout par verifierLesValeurs, qui applique la regle du serveur. Ajouter un
 * reglage au contrat ajoute un champ ici sans toucher a ce fichier.
 *
 * UNE CONFIGURATION INVALIDE NE PART PAS. Chaque champ fautif porte son motif, et
 * l'enregistrement reste inactif tant qu'il en reste un. C'est le test exige par
 * la fiche: une configuration invalide est signalee cote client, avec le motif que
 * le serveur donnerait.
 */

import type { IdentifiantCarte, ReglagesPartie, ResultatValidation } from '@neon-ninja/shared';
import {
  CARTES,
  RACINE_RESSOURCES,
  REGLAGES_PAR_DEFAUT,
  cheminApercuCarte,
} from '@neon-ninja/shared';

import { bouton, creer, ecrireTexte, montrer } from '../dom.js';
import { PRESENTATION_CARTES } from '../modeles/cartes.js';
import type { ChampReglage, GroupeReglages, ValeursFormulaire } from '../modeles/reglages.js';
import {
  GROUPES_REGLAGES,
  erreursParChamp,
  tousLesChamps,
  valeursDepuisReglages,
  verifierLesValeurs,
} from '../modeles/reglages.js';
import { monterFenetre } from './fenetre.js';

// --------------------------------------------------------------------------
// Le formulaire
// --------------------------------------------------------------------------

/** Ce qu'il faut pour monter le formulaire des reglages. */
export interface OptionsFormulaireReglages {
  readonly document: Document;
  /**
   * Replier les reglages avances sous un titre: tous les groupes sauf le premier
   * (carte, miroir, duree, faux ninjas). Pour l'ecran de creation, ou ils
   * noieraient l'essentiel.
   */
  readonly avancesRepliables?: boolean;
  /** Appele apres chaque saisie, avec le verdict de la regle du serveur. */
  readonly surChangement?: (verdict: ResultatValidation<ReglagesPartie>) => void;
  /** Appele quand le joueur valide le formulaire, par la touche Entree. */
  readonly surSoumission?: () => void;
}

/** Le formulaire des reglages, monte. */
export interface FormulaireReglages {
  readonly racine: HTMLFormElement;
  /** Ce que le joueur a saisi, champ par champ. */
  lire(): ValeursFormulaire;
  /** Remplit les champs avec ces valeurs. */
  ecrire(valeurs: ValeursFormulaire): void;
  /** Verifie la saisie, montre les motifs, et rend le verdict. */
  verifier(): ResultatValidation<ReglagesPartie>;
  demonter(): void;
}

/** Le nom du groupe de boutons radio des cartes. Un seul formulaire par page. */
const NOM_CHOIX_CARTE = 'reglages-carte';

/** Monte le formulaire des reglages, rempli des valeurs par defaut. */
export function monterFormulaireReglages(options: OptionsFormulaireReglages): FormulaireReglages {
  const doc = options.document;

  /** Les saisies de chaque champ, par chemin: une seule, ou une par carte. */
  const saisies = new Map<string, HTMLInputElement[]>();
  /** L'emplacement du motif d'erreur de chaque champ. */
  const motifs = new Map<string, HTMLElement>();
  /** La valeur ecrite a cote de chaque curseur. */
  const valeursAffichees = new Map<string, { sortie: HTMLOutputElement; unite: string }>();

  const formulaire = creer(doc, 'form', { classe: 'reglages', attributs: { novalidate: '' } });

  const groupeEnElement = (groupe: GroupeReglages): HTMLElement => {
    const ensemble = creer(
      doc,
      'fieldset',
      { classe: 'reglages-groupe' },
      creer(doc, 'legend', { texte: groupe.titre }),
    );

    for (const section of groupe.sections) {
      ensemble.append(
        creer(
          doc,
          'div',
          { classe: 'reglages-section' },
          section.titre === undefined ? undefined : creer(doc, 'h3', { texte: section.titre }),
          ...section.champs.map((champ) =>
            champEnElement(doc, champ, saisies, motifs, valeursAffichees),
          ),
        ),
      );
    }

    return ensemble;
  };

  const [essentiel, ...avances] = GROUPES_REGLAGES;

  if (options.avancesRepliables === true && essentiel !== undefined) {
    formulaire.append(
      groupeEnElement(essentiel),
      creer(
        doc,
        'details',
        { classe: 'reglages-avances' },
        creer(
          doc,
          'summary',
          {},
          creer(doc, 'strong', { texte: 'Réglages avancés' }),
          creer(doc, 'span', {
            texte: avances.map((groupe) => groupe.titre.toLocaleLowerCase('fr')).join(' · '),
          }),
        ),
        creer(doc, 'div', { classe: 'reglages-groupes' }, ...avances.map(groupeEnElement)),
      ),
    );
  } else {
    formulaire.append(...GROUPES_REGLAGES.map(groupeEnElement));
  }

  // Un motif sans champ correspondant ne devrait pas exister: chaque reglage a son
  // champ. S'il en arrivait un, il ne serait pas perdu pour autant.
  const erreurGenerale = creer(doc, 'p', {
    classe: 'reglages-erreur',
    attributs: { role: 'alert' },
  });
  erreurGenerale.hidden = true;
  formulaire.append(erreurGenerale);

  const lire = (): ValeursFormulaire => {
    const valeurs: Record<string, string | boolean> = {};

    for (const champ of tousLesChamps()) {
      const elements = saisies.get(champ.chemin) ?? [];

      if (champ.nature === 'carte') {
        valeurs[champ.chemin] = elements.find((element) => element.checked)?.value ?? '';
      } else if (champ.nature === 'interrupteur') {
        valeurs[champ.chemin] = elements[0]?.checked === true;
      } else {
        valeurs[champ.chemin] = elements[0]?.value ?? '';
      }
    }

    return valeurs;
  };

  const ecrire = (valeurs: ValeursFormulaire): void => {
    for (const champ of tousLesChamps()) {
      const valeur = valeurs[champ.chemin];

      for (const element of saisies.get(champ.chemin) ?? []) {
        if (champ.nature === 'carte') {
          element.checked = element.value === valeur;
        } else if (champ.nature === 'interrupteur') {
          element.checked = valeur === true;
        } else {
          element.value = String(valeur ?? '');
        }
      }
    }
  };

  const verifier = (): ResultatValidation<ReglagesPartie> => {
    const verdict = verifierLesValeurs(lire());
    const parChamp = verdict.valide ? new Map<string, string>() : erreursParChamp(verdict.erreurs);

    for (const [chemin, element] of motifs) {
      const motif = parChamp.get(chemin);
      ecrireTexte(element, motif ?? '');
      montrer(element, motif !== undefined);

      for (const saisie of saisies.get(chemin) ?? []) {
        saisie.toggleAttribute('aria-invalid', motif !== undefined);
      }
    }

    const orphelins = [...parChamp].filter(([chemin]) => !motifs.has(chemin));
    ecrireTexte(erreurGenerale, orphelins.map(([, motif]) => motif).join(' '));
    montrer(erreurGenerale, orphelins.length > 0);

    for (const [chemin, { sortie, unite }] of valeursAffichees) {
      const valeur = saisies.get(chemin)?.[0]?.value ?? '';
      ecrireTexte(sortie, unite === '' ? valeur : `${valeur} ${unite}`);
    }

    return verdict;
  };

  const surSaisie = (): void => {
    const verdict = verifier();
    options.surChangement?.(verdict);
  };

  const surSoumission = (evenement: Event): void => {
    evenement.preventDefault();
    options.surSoumission?.();
  };

  formulaire.addEventListener('input', surSaisie);
  formulaire.addEventListener('change', surSaisie);
  formulaire.addEventListener('submit', surSoumission);

  ecrire(valeursDepuisReglages(REGLAGES_PAR_DEFAUT));
  verifier();

  return {
    racine: formulaire,
    lire,
    ecrire,
    verifier,

    demonter() {
      formulaire.removeEventListener('input', surSaisie);
      formulaire.removeEventListener('change', surSaisie);
      formulaire.removeEventListener('submit', surSoumission);
      formulaire.remove();
    },
  };
}

// --------------------------------------------------------------------------
// Le panneau de l'hote, dans le salon
// --------------------------------------------------------------------------

/** Ce qu'il faut pour monter le panneau des reglages. */
export interface OptionsPanneauReglages {
  readonly document: Document;
  /** Appele avec des reglages verifies, quand l'hote enregistre. */
  readonly surEnregistrer: (reglages: ReglagesPartie) => void;
}

/** Le panneau des reglages, monte. */
export interface PanneauReglages {
  readonly racine: HTMLElement;
  readonly ouvert: boolean;
  /** Ouvre le panneau, rempli avec ces reglages. */
  ouvrirAvec(reglages: ReglagesPartie): void;
  fermer(): void;
  demonter(): void;
}

/** Monte le panneau des reglages, ferme. */
export function monterPanneauReglages(options: OptionsPanneauReglages): PanneauReglages {
  const doc = options.document;
  const fenetre = monterFenetre({
    document: doc,
    titre: 'Réglages de la partie',
    classe: 'fenetre-reglages',
  });

  /**
   * Enregistre, si la saisie est valide.
   *
   * La verification est refaite ici et pas seulement lue sur le bouton: un bouton
   * inactif empeche le clic, il n'empeche pas la touche Entree dans un champ.
   */
  const soumettre = (): void => {
    const verdict = formulaire.verifier();
    enregistrer.disabled = !verdict.valide;

    if (verdict.valide) {
      options.surEnregistrer(verdict.valeur);
      fenetre.fermer();
    }
  };

  const formulaire = monterFormulaireReglages({
    document: doc,
    surChangement: (verdict) => {
      enregistrer.disabled = !verdict.valide;
    },
    surSoumission: soumettre,
  });

  fenetre.corps.append(formulaire.racine);

  const enregistrer = bouton(
    doc,
    { classe: 'bouton bouton-primaire', texte: 'Enregistrer', icone: 'check' },
    soumettre,
  );

  fenetre.pied.append(
    bouton(doc, { classe: 'bouton bouton-discret', texte: 'Valeurs par défaut' }, () => {
      formulaire.ecrire(valeursDepuisReglages(REGLAGES_PAR_DEFAUT));
      enregistrer.disabled = !formulaire.verifier().valide;
    }),
    bouton(doc, { classe: 'bouton bouton-secondaire', texte: 'Annuler' }, () => {
      fenetre.fermer();
    }),
    enregistrer,
  );

  return {
    racine: fenetre.racine,

    get ouvert() {
      return fenetre.ouverte;
    },

    ouvrirAvec(reglages) {
      formulaire.ecrire(valeursDepuisReglages(reglages));
      enregistrer.disabled = !formulaire.verifier().valide;
      fenetre.ouvrir();
    },

    fermer() {
      fenetre.fermer();
    },

    demonter() {
      formulaire.demonter();
      fenetre.demonter();
    },
  };
}

/** Fabrique l'element d'un champ, et retient ses saisies et son motif. */
function champEnElement(
  doc: Document,
  champ: ChampReglage,
  saisies: Map<string, HTMLInputElement[]>,
  motifs: Map<string, HTMLElement>,
  valeursAffichees: Map<string, { sortie: HTMLOutputElement; unite: string }>,
): HTMLElement {
  const motif = creer(doc, 'span', { classe: 'champ-erreur' });
  motif.hidden = true;
  motifs.set(champ.chemin, motif);

  switch (champ.nature) {
    case 'carte': {
      const choix = (Object.keys(CARTES) as IdentifiantCarte[]).map((carte) => {
        const saisie = creer(doc, 'input', {
          attributs: {
            type: 'radio',
            name: NOM_CHOIX_CARTE,
            value: carte,
            'data-chemin': champ.chemin,
          },
        });

        return {
          saisie,
          element: creer(
            doc,
            'label',
            { classe: 'carte-choix' },
            saisie,
            creer(doc, 'img', {
              classe: 'carte-apercu',
              attributs: { src: `${RACINE_RESSOURCES}/${cheminApercuCarte(carte)}`, alt: '' },
            }),
            creer(doc, 'span', { classe: 'carte-nom', texte: PRESENTATION_CARTES[carte].nom }),
            creer(doc, 'span', {
              classe: 'carte-ambiance',
              texte: PRESENTATION_CARTES[carte].ambiance,
            }),
          ),
        };
      });

      saisies.set(
        champ.chemin,
        choix.map(({ saisie }) => saisie),
      );

      return creer(
        doc,
        'div',
        { classe: 'champ-carte', attributs: { role: 'radiogroup', 'aria-label': champ.libelle } },
        ...choix.map(({ element }) => element),
        motif,
      );
    }

    case 'interrupteur': {
      const saisie = creer(doc, 'input', {
        attributs: { type: 'checkbox', 'data-chemin': champ.chemin },
      });
      saisies.set(champ.chemin, [saisie]);

      return creer(
        doc,
        'label',
        { classe: 'interrupteur' },
        saisie,
        creer(doc, 'span', { classe: 'interrupteur-piste' }),
        creer(doc, 'span', { texte: champ.libelle }),
        motif,
      );
    }

    case 'entier': {
      const curseur = champ.pas !== undefined;
      const saisie = creer(doc, 'input', {
        classe: curseur ? 'champ-curseur' : 'champ-nombre',
        attributs: {
          type: curseur ? 'range' : 'number',
          min: String(champ.bornes.minimum),
          max: String(champ.bornes.maximum),
          step: String(champ.pas ?? 1),
          inputmode: 'numeric',
          'data-chemin': champ.chemin,
        },
      });
      saisies.set(champ.chemin, [saisie]);

      let apres: HTMLElement | undefined;

      if (curseur) {
        const sortie = creer(doc, 'output', { classe: 'champ-valeur' });
        valeursAffichees.set(champ.chemin, { sortie, unite: champ.unite });
        apres = sortie;
      } else if (champ.unite !== '') {
        apres = creer(doc, 'span', { classe: 'champ-unite', texte: champ.unite });
      }

      return creer(
        doc,
        'label',
        { classe: 'champ-entier' },
        creer(doc, 'span', { classe: 'champ-libelle', texte: champ.libelle }),
        creer(doc, 'span', { classe: 'champ-saisie' }, saisie, apres),
        motif,
      );
    }
  }
}
