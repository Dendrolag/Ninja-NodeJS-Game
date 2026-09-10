/**
 * L'ecran d'accueil: saisir son pseudo et entrer dans une partie.
 *
 * Portage du mainMenu du jeu d'origine, dans l'identite de la maquette. La
 * maquette y met aussi le resume du compte, les modes, les defis et le pass de
 * saison: tout cela depend des comptes, du matchmaking et de la progression, et
 * n'existe donc pas encore. Conformement a la decision du 29 juin 2026, ce qui est
 * reporte est absent, pas grise.
 *
 * CET ECRAN NE DECIDE RIEN, ET NE RETIENT RIEN. Peut-on jouer, pourquoi le pseudo
 * est refuse, ou en est le lien: tout vient de modeleAccueil, qui ne lit que
 * l'etat du client et le texte du champ. L'ecran est monte a neuf a chaque retour a
 * l'accueil; une information qu'il aurait gardee pour lui serait perdue a ce
 * moment-la, et c'est justement ce que le test de navigation a montre pour la
 * perte de connexion.
 */

import { BORNES_PSEUDO, normaliserTexte } from '@neon-ninja/shared';

import type { EtatClient } from '../../etat.js';
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

/** Ce que l'accueil dit du lien avec le serveur. */
const TEXTES_DU_LIEN: Readonly<Record<EtatDuLien, string>> = {
  enCours: 'Connexion au serveur…',
  etabli: '',
  perdu: 'La connexion au serveur a été perdue.',
};

/** Monte l'ecran d'accueil. */
export function monterAccueil(contexte: ContexteEcran): EcranAffiche {
  const doc = contexte.document;

  const saisie = creer(doc, 'input', {
    classe: 'champ-texte',
    attributs: {
      type: 'text',
      name: 'pseudo',
      maxlength: String(BORNES_PSEUDO.longueur.maximum),
      autocomplete: 'nickname',
      spellcheck: 'false',
      placeholder: 'Votre pseudo',
    },
  });
  const jouer = bouton(doc, {
    classe: 'bouton bouton-primaire bouton-large',
    texte: 'Jouer',
    icone: 'play',
    type: 'submit',
  });
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
  recharger.hidden = true;

  const formulaire = creer(
    doc,
    'form',
    { classe: 'accueil-formulaire' },
    creer(
      doc,
      'label',
      { classe: 'champ-pseudo' },
      creer(doc, 'span', { classe: 'etiquette', texte: 'Pseudo' }),
      saisie,
    ),
    jouer,
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
        formulaire,
        erreur,
        creer(doc, 'div', { classe: 'accueil-etat' }, lien, recharger),
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

  const rendre = (): void => {
    if (etatCourant === undefined) {
      return;
    }

    const modele = modeleAccueil(etatCourant, saisie.value);

    ecrireTexte(erreur, modele.erreur ?? '');
    montrer(erreur, modele.erreur !== undefined);
    saisie.toggleAttribute('aria-invalid', modele.erreur !== undefined);
    jouer.disabled = !modele.peutJouer;
    jouer.toggleAttribute('aria-busy', modele.enAttente);

    ecrireTexte(lien, modele.enAttente ? 'Entrée dans une partie…' : TEXTES_DU_LIEN[modele.lien]);
    montrer(lien, modele.enAttente || modele.lien !== 'etabli');
    montrer(recharger, modele.lien === 'perdu');
  };

  const surSaisie = (): void => {
    rendre();
  };

  const surEnvoi = (evenement: Event): void => {
    evenement.preventDefault();

    // La meme question que celle qui active le bouton: la touche Entree ne doit
    // pas envoyer ce que le bouton refuse.
    if (etatCourant === undefined || !modeleAccueil(etatCourant, saisie.value).peutJouer) {
      return;
    }

    contexte.client.rejoindre(normaliserTexte(saisie.value));
  };

  saisie.addEventListener('input', surSaisie);
  formulaire.addEventListener('submit', surEnvoi);

  return {
    racine,

    afficher(etat) {
      // A la premiere image, le champ reprend le pseudo deja demande: celui du
      // joueur qui revient d'une partie, ou qui a perdu la connexion.
      if (etatCourant === undefined && etat.pseudoDemande !== undefined) {
        saisie.value = etat.pseudoDemande;
      }

      etatCourant = etat;
      rendre();
    },

    demonter() {
      saisie.removeEventListener('input', surSaisie);
      formulaire.removeEventListener('submit', surEnvoi);
      racine.remove();
    },
  };
}
