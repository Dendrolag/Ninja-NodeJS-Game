/**
 * L'ecran d'accueil: choisir comment jouer.
 *
 * Portage du mainMenu du jeu d'origine, dans l'identite de la maquette. Trois
 * chemins, ceux du cadrage (section 3, accueil): la partie rapide, la creation
 * d'une partie, et la liste des parties publiques. La maquette y met aussi les
 * modes, les defis et le pass de saison: les defis et le pass sont reportes apres
 * la v1, et un seul mode existe. Conformement a la decision du 29 juin 2026, ce qui
 * est reporte est absent, pas grise.
 *
 * CET ECRAN NE DECIDE RIEN, ET NE RETIENT RIEN. Peut-on jouer, pourquoi le pseudo
 * est refuse, ou en est le lien, faut-il un pseudo: tout vient de modeleAccueil,
 * qui ne lit que l'etat du client. Le pseudo saisi lui-meme vit dans l'etat
 * (composants/champPseudo.ts): l'ecran est monte a neuf a chaque retour, et une
 * information qu'il garderait pour lui serait perdue.
 */

import type { EtatClient } from '../../etat.js';
import { monterChampPseudo } from '../composants/champPseudo.js';
import { bouton, creer, ecrireTexte, montrer } from '../dom.js';
import type { Glyphe } from '../icones.js';
import { icone } from '../icones.js';
import type { EtatDuLien } from '../modeles/accueil.js';
import { modeleAccueil } from '../modeles/accueil.js';
import type { ContexteEcran, EcranAffiche } from './types.js';

/** Les trois regles du jeu, telles que l'accueil les resume. */
const REGLES: readonly {
  readonly glyphe: Glyphe;
  readonly titre: string;
  readonly texte: string;
}[] = [
  {
    glyphe: 'ninja',
    titre: 'Ralliez les faux ninjas',
    texte:
      'Touchez un faux ninja pour le peindre à votre couleur. Chaque ninja à votre couleur compte un point.',
  },
  {
    glyphe: 'target',
    titre: 'Capturez les joueurs',
    texte:
      'Touchez un autre joueur pour lui prendre tous ses ninjas d’un coup. Il peut vous rendre la pareille.',
  },
  {
    glyphe: 'shield',
    titre: 'Méfiez-vous des Black Ninjas',
    texte:
      'Ils chassent les joueurs en cours de partie. Avec le bonus d’invincibilité, c’est vous qui les détruisez.',
  },
];

/** Ce que l'accueil dit du lien avec le serveur. Un refus, lui, dit son propre motif. */
const TEXTES_DU_LIEN: Readonly<Record<Exclude<EtatDuLien, 'refuse'>, string>> = {
  enCours: 'Connexion au serveur…',
  etabli: '',
  perdu: 'La connexion au serveur a été perdue.',
};

/** Monte l'ecran d'accueil. */
export function monterAccueil(contexte: ContexteEcran): EcranAffiche {
  const doc = contexte.document;
  const client = contexte.client;

  const champPseudo = monterChampPseudo(doc, client);
  const partieRapide = bouton(doc, {
    classe: 'bouton bouton-primaire bouton-large',
    texte: 'Partie rapide',
    icone: 'play',
    type: 'submit',
  });

  const nomDuCompte = creer(doc, 'strong');
  const ligneDuCompte = creer(
    doc,
    'p',
    { classe: 'accueil-compte' },
    doc.createTextNode('Vous jouez avec votre compte, '),
    nomDuCompte,
    doc.createTextNode('.'),
  );
  const avis = creer(doc, 'p', { classe: 'accueil-avis', attributs: { role: 'status' } });
  const erreur = creer(doc, 'p', { classe: 'accueil-erreur', attributs: { role: 'alert' } });
  erreur.hidden = true;
  const lien = creer(doc, 'p', { classe: 'accueil-lien', attributs: { role: 'status' } });
  const recharger = bouton(
    doc,
    { classe: 'bouton bouton-secondaire', texte: 'Recharger la page', icone: 'replay' },
    () => {
      contexte.recharger();
    },
  );
  const reessayer = bouton(
    doc,
    { classe: 'bouton bouton-secondaire', texte: 'Réessayer', icone: 'replay' },
    () => {
      client.reessayer();
    },
  );
  const continuerEnInvite = bouton(
    doc,
    { classe: 'bouton bouton-discret', texte: 'Continuer en invité' },
    () => {
      client.continuerEnInvite();
    },
  );

  const formulaire = creer(
    doc,
    'form',
    { classe: 'accueil-formulaire' },
    champPseudo.racine,
    partieRapide,
  );

  const racine = creer(
    doc,
    'section',
    { classe: 'ecran ecran-accueil' },
    creer(
      doc,
      'div',
      { classe: 'accueil-banniere panneau' },
      creer(
        doc,
        'div',
        { classe: 'accueil-texte' },
        creer(
          doc,
          'p',
          { classe: 'surtitre' },
          creer(doc, 'span', { classe: 'point-vivant' }),
          creer(doc, 'span', { texte: 'Mode classique · 3 cartes' }),
        ),
        creer(
          doc,
          'h1',
          { classe: 'accueil-titre' },
          creer(doc, 'span', { texte: 'Prêt à frapper' }),
          creer(doc, 'span', { classe: 'accent', texte: 'dans l’ombre ?' }),
        ),
        creer(doc, 'p', {
          classe: 'accueil-accroche',
          texte:
            'Ralliez les faux ninjas, volez les troupeaux des autres joueurs, et gardez le plus grand jusqu’au bout.',
        }),
        avis,
        ligneDuCompte,
        formulaire,
        erreur,
        creer(
          doc,
          'div',
          { classe: 'accueil-actions' },
          bouton(
            doc,
            { classe: 'bouton bouton-secondaire', texte: 'Créer une partie', icone: 'plus' },
            () => {
              client.naviguer('creation');
            },
          ),
          bouton(
            doc,
            { classe: 'bouton bouton-secondaire', texte: 'Parcourir', icone: 'globe' },
            () => {
              client.naviguer('parties');
            },
          ),
        ),
        creer(
          doc,
          'div',
          { classe: 'accueil-etat' },
          lien,
          recharger,
          reessayer,
          continuerEnInvite,
        ),
      ),
      creer(doc, 'span', {
        classe: 'accueil-kanji',
        texte: '忍',
        attributs: { 'aria-hidden': 'true' },
      }),
    ),
    creer(
      doc,
      'ul',
      { classe: 'accueil-regles' },
      ...REGLES.map((regle) =>
        creer(
          doc,
          'li',
          { classe: 'panneau regle' },
          icone(doc, regle.glyphe, 22),
          creer(doc, 'h2', { texte: regle.titre }),
          creer(doc, 'p', { texte: regle.texte }),
        ),
      ),
    ),
  );

  let etatCourant: EtatClient | undefined;

  const surEnvoi = (evenement: Event): void => {
    evenement.preventDefault();

    if (etatCourant === undefined) {
      return;
    }

    // La meme question que celle qui active le bouton: la touche Entree ne doit
    // pas envoyer ce que le bouton refuse.
    const modele = modeleAccueil(etatCourant, etatCourant.pseudoSaisi);

    if (modele.peutJouer) {
      client.rejoindre(modele.pseudo);
    }
  };

  formulaire.addEventListener('submit', surEnvoi);

  return {
    racine,

    afficher(etat) {
      etatCourant = etat;
      const modele = modeleAccueil(etat, etat.pseudoSaisi);

      champPseudo.afficher(etat, modele.pseudoRequis, modele.erreur);
      ecrireTexte(nomDuCompte, modele.pseudoDuCompte ?? '');
      montrer(ligneDuCompte, modele.pseudoDuCompte !== undefined);
      ecrireTexte(avis, modele.avis ?? '');
      montrer(avis, modele.avis !== undefined);

      ecrireTexte(erreur, modele.erreur ?? '');
      montrer(erreur, modele.erreur !== undefined);
      partieRapide.disabled = !modele.peutJouer;
      partieRapide.toggleAttribute('aria-busy', modele.enAttente);

      const texteDuLien = modele.enAttente
        ? 'Entrée dans une partie…'
        : modele.lien === 'refuse'
          ? (modele.motifDuLien ?? '')
          : TEXTES_DU_LIEN[modele.lien];

      ecrireTexte(lien, texteDuLien);
      montrer(lien, texteDuLien !== '');
      montrer(recharger, modele.lien === 'perdu');
      montrer(reessayer, modele.lien === 'refuse');
      montrer(continuerEnInvite, modele.peutContinuerEnInvite);
    },

    demonter() {
      formulaire.removeEventListener('submit', surEnvoi);
      champPseudo.demonter();
      racine.remove();
    },
  };
}
