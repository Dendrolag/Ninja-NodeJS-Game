/**
 * L'ecran de creation: regler une partie, publique ou privee, et en devenir l'hote.
 *
 * Sans equivalent dans le legacy, ou l'on entrait dans le seul salon puis l'hote
 * reglait. Au jalon 1, la creation etait le panneau de reglages du salon; elle a
 * maintenant son ecran, comme dans la maquette, et le panneau reste pour changer les
 * reglages avant le lancement.
 *
 * CET ECRAN NE DECIDE RIEN. Le recapitulatif, ce qui cloche et la demande prete a
 * partir viennent de modeleCreation. Les reglages sont saisis dans le formulaire du
 * panneau du salon (composants/reglages.ts), le meme: une partie ne peut pas naitre
 * avec un reglage que le salon ne saurait pas changer. L'ecran ne retient que la
 * visibilite choisie.
 */

import type { Mode, Visibilite } from '@neon-ninja/shared';

import type { EtatClient } from '../../etat.js';
import { monterChampPseudo } from '../composants/champPseudo.js';
import { monterFormulaireReglages } from '../composants/reglages.js';
import { bouton, creer, ecrireTexte, montrer } from '../dom.js';
import type { Glyphe } from '../icones.js';
import { icone } from '../icones.js';
import { NOMS_DES_MODES } from '../modeles/cartes.js';
import { MODE_DE_CREATION, modeleCreation } from '../modeles/creation.js';
import type { LigneRecapitulatif } from '../modeles/salon.js';
import type { ContexteEcran, EcranAffiche } from './types.js';

/** Ce que la tuile de chaque mode dit de lui. */
const DESCRIPTIONS_DES_MODES: Readonly<Record<Mode, string>> = {
  classique:
    'Ralliez les faux ninjas et capturez les autres joueurs pour leur voler leur troupeau.',
  tactique:
    'Capturez à distance tout ce qui se trouve dans le cône devant vous, avec cinq charges qui reviennent peu à peu.',
};

/** Les deux visibilites, telles que leurs tuiles les presentent. */
const VISIBILITES: readonly {
  readonly valeur: Visibilite;
  readonly nom: string;
  readonly texte: string;
  readonly glyphe: Glyphe;
}[] = [
  {
    valeur: 'publique',
    nom: 'Publique',
    texte: 'Visible de tous dans la liste des parties.',
    glyphe: 'globe',
  },
  {
    valeur: 'privee',
    nom: 'Privée',
    texte: 'Accessible seulement avec son code d’invitation.',
    glyphe: 'cadenas',
  },
];

/** Monte l'ecran de creation. */
export function monterCreation(contexte: ContexteEcran): EcranAffiche {
  const doc = contexte.document;
  const client = contexte.client;

  let etatCourant: EtatClient | undefined;
  let visibilite: Visibilite = 'publique';

  const formulaire = monterFormulaireReglages({
    document: doc,
    avancesRepliables: true,
    surChangement: () => {
      rendre();
    },
    surSoumission: () => {
      creer_();
    },
  });

  const choixDeVisibilite = VISIBILITES.map((choix) => {
    const saisie = creer(doc, 'input', {
      attributs: { type: 'radio', name: 'visibilite', value: choix.valeur },
    });
    saisie.checked = choix.valeur === visibilite;

    return {
      saisie,
      element: creer(
        doc,
        'label',
        { classe: 'tuile tuile-choix', attributs: { 'data-visibilite': choix.valeur } },
        saisie,
        icone(doc, choix.glyphe, 22),
        creer(doc, 'strong', { texte: choix.nom }),
        creer(doc, 'span', { texte: choix.texte }),
      ),
    };
  });

  const titre = creer(doc, 'h2');
  const recapitulatif = creer(doc, 'dl', { classe: 'recapitulatif' });
  const champPseudo = monterChampPseudo(doc, client);
  const aidePseudo = creer(doc, 'p', { classe: 'creation-aide' });
  const erreur = creer(doc, 'p', { classe: 'creation-erreur', attributs: { role: 'alert' } });
  const creerLeSalon = bouton(
    doc,
    { classe: 'bouton bouton-primaire bouton-large', texte: 'Créer le salon', icone: 'play' },
    () => {
      creer_();
    },
  );

  const racine = creer(
    doc,
    'section',
    { classe: 'ecran ecran-creation' },
    creer(
      doc,
      'header',
      { classe: 'titre-et-sous-titre' },
      creer(doc, 'h1', { classe: 'titre-ecran', texte: 'Créer une partie' }),
      creer(doc, 'p', {
        classe: 'sous-titre-ecran',
        texte: 'Réglez votre partie, puis invitez vos amis dans son salon.',
      }),
    ),
    creer(
      doc,
      'div',
      { classe: 'creation-corps' },
      creer(
        doc,
        'div',
        { classe: 'creation-etapes' },
        creer(
          doc,
          'section',
          { classe: 'creation-etape' },
          creer(doc, 'h2', { texte: '01 · Mode de jeu' }),
          creer(
            doc,
            'div',
            { classe: 'tuiles' },
            ...[MODE_DE_CREATION].map((mode) =>
              creer(
                doc,
                'div',
                { classe: 'tuile tuile-choisie', attributs: { 'data-mode': mode } },
                icone(doc, 'ninja', 22),
                creer(doc, 'strong', { texte: NOMS_DES_MODES[mode] }),
                creer(doc, 'span', { texte: DESCRIPTIONS_DES_MODES[mode] }),
              ),
            ),
            creer(
              doc,
              'div',
              { classe: 'tuile tuile-a-venir', attributs: { 'aria-disabled': 'true' } },
              icone(doc, 'plus', 22),
              creer(doc, 'strong', { texte: 'À venir' }),
              creer(doc, 'span', { texte: 'D’autres modes de jeu arriveront plus tard.' }),
            ),
          ),
        ),
        creer(
          doc,
          'fieldset',
          { classe: 'creation-etape' },
          creer(doc, 'legend', { texte: '02 · Visibilité' }),
          creer(
            doc,
            'div',
            { classe: 'tuiles' },
            ...choixDeVisibilite.map(({ element }) => element),
          ),
        ),
        creer(
          doc,
          'section',
          { classe: 'creation-etape' },
          creer(doc, 'h2', { texte: '03 · Réglages' }),
          formulaire.racine,
        ),
      ),
      creer(
        doc,
        'aside',
        { classe: 'panneau creation-recapitulatif' },
        creer(doc, 'p', { classe: 'etiquette', texte: 'Résumé du salon' }),
        titre,
        recapitulatif,
        champPseudo.racine,
        aidePseudo,
        erreur,
        creerLeSalon,
      ),
    ),
  );

  /** Envoie la demande de creation, si elle est prete. */
  function creer_(): void {
    if (etatCourant === undefined) {
      return;
    }

    const envoi = modeleCreation(etatCourant, { visibilite, valeurs: formulaire.lire() }).envoi;

    if (envoi !== undefined) {
      client.creerPartie(envoi.pseudo, envoi.configuration);
    }
  }

  let signatureRecapitulatif = '';

  const majRecapitulatif = (lignes: readonly LigneRecapitulatif[]): void => {
    const signature = lignes.map((ligne) => `${ligne.libelle}|${ligne.valeur}`).join('\n');

    if (signature === signatureRecapitulatif) {
      return;
    }

    signatureRecapitulatif = signature;
    recapitulatif.replaceChildren(
      ...lignes.flatMap((ligne) => [
        creer(doc, 'dt', { texte: ligne.libelle }),
        creer(doc, 'dd', { texte: ligne.valeur }),
      ]),
    );
  };

  function rendre(): void {
    if (etatCourant === undefined) {
      return;
    }

    const modele = modeleCreation(etatCourant, { visibilite, valeurs: formulaire.lire() });

    ecrireTexte(titre, modele.titre);
    majRecapitulatif(modele.recapitulatif);
    champPseudo.afficher(etatCourant, modele.pseudoRequis, modele.erreurPseudo);
    ecrireTexte(aidePseudo, modele.aidePseudo ?? '');
    montrer(aidePseudo, modele.aidePseudo !== undefined);

    const texteErreur =
      modele.refus ??
      modele.erreurPseudo ??
      (modele.reglagesValides ? undefined : 'Corrigez les réglages signalés pour créer la partie.');
    ecrireTexte(erreur, texteErreur ?? '');
    montrer(erreur, texteErreur !== undefined);

    creerLeSalon.disabled = modele.envoi === undefined;
    creerLeSalon.toggleAttribute('aria-busy', modele.enAttente);
  }

  const surVisibilite = (evenement: Event): void => {
    const cible = evenement.target;

    if (cible instanceof HTMLInputElement && cible.name === 'visibilite' && cible.checked) {
      visibilite = cible.value === 'privee' ? 'privee' : 'publique';
      rendre();
    }
  };

  racine.addEventListener('change', surVisibilite);

  return {
    racine,

    afficher(etat) {
      etatCourant = etat;
      rendre();
    },

    demonter() {
      racine.removeEventListener('change', surVisibilite);
      formulaire.demonter();
      champPseudo.demonter();
      racine.remove();
    },
  };
}
