/**
 * L'ecran d'accueil: choisir comment jouer.
 *
 * Portage du mainMenu du jeu d'origine, dans l'identite de la maquette. Trois
 * chemins, ceux du cadrage (section 3, accueil): la partie rapide, la creation
 * d'une partie, et la liste des parties publiques. La maquette y met aussi les
 * defis et le pass de saison, reportes apres la v1: conformement a la decision du
 * 29 juin 2026, ce qui est reporte est absent, pas grise.
 *
 * LES TEXTES SONT CEUX DE L'ETAPE 4.5, arretes avec le porteur du projet. Sous la
 * banniere, une carte par mode, avec le texte de sa tuile de creation: la grille
 * s'allonge d'elle-meme quand un mode s'ajoute. Elle remplace les trois regles de la
 * Horde, qui ne valaient plus pour les autres modes.
 *
 * OUVERT PAR UN LIEN D'INVITATION (etape 2.7), il annonce la partie privee qui attend
 * le joueur, et son bouton principal la rejoint au lieu de la partie rapide. « Ignorer »
 * le rend a l'accueil de tous les jours.
 *
 * CET ECRAN NE DECIDE RIEN, ET NE RETIENT RIEN. Peut-on jouer, pourquoi le pseudo
 * est refuse, ou en est le lien, faut-il un pseudo: tout vient de modeleAccueil,
 * qui ne lit que l'etat du client. Le pseudo saisi lui-meme vit dans l'etat
 * (composants/champPseudo.ts): l'ecran est monte a neuf a chaque retour, et une
 * information qu'il garderait pour lui serait perdue.
 */

import { CARTES, MODES } from '@neon-ninja/shared';

import type { EtatClient } from '../../etat.js';
import { monterChampPseudo } from '../composants/champPseudo.js';
import { bouton, creer, ecrireTexte, montrer } from '../dom.js';
import { GLYPHES_DES_MODES, icone } from '../icones.js';
import { modeleAccueil } from '../modeles/accueil.js';
import { NOMS_DES_MODES, TEXTES_DES_MODES } from '../modeles/cartes.js';
import type { EtatDuLien } from '../modeles/lien.js';
import type { ContexteEcran, EcranAffiche } from './types.js';

/** Le lien est-il en train de s'etablir, de sorte que le joueur n'a qu'a attendre. */
function lienEnAttente(lien: EtatDuLien): boolean {
  return lien === 'enCours' || lien === 'reveil' || lien === 'retablissement' || lien === 'retour';
}

/** Monte l'ecran d'accueil. */
export function monterAccueil(contexte: ContexteEcran): EcranAffiche {
  const doc = contexte.document;
  const client = contexte.client;

  const champPseudo = monterChampPseudo(doc, client);
  // Son texte suit l'invitation: « Partie rapide », ou « Rejoindre la partie ».
  const libelleDuBouton = creer(doc, 'span');
  const partieRapide = bouton(doc, {
    classe: 'bouton bouton-primaire bouton-large',
    icone: 'play',
    type: 'submit',
  });
  partieRapide.append(libelleDuBouton);

  const titreDInvitation = creer(doc, 'p', { classe: 'accueil-invitation-titre' });
  const texteDInvitation = creer(doc, 'p', { classe: 'accueil-invitation-texte' });
  const codeDInvitation = creer(doc, 'strong', { classe: 'accueil-invitation-valeur' });
  const ligneDuCode = creer(
    doc,
    'p',
    { classe: 'accueil-invitation-code' },
    doc.createTextNode('Code '),
    codeDInvitation,
  );
  const invitation = creer(
    doc,
    'div',
    { classe: 'accueil-invitation', attributs: { role: 'status' } },
    creer(
      doc,
      'div',
      { classe: 'accueil-invitation-contenu' },
      titreDInvitation,
      texteDInvitation,
      ligneDuCode,
    ),
    bouton(doc, { classe: 'bouton bouton-discret', texte: 'Ignorer' }, () => {
      client.ignorerLInvitation();
    }),
  );

  const nomDuCompte = creer(doc, 'strong');
  const ligneDuCompte = creer(
    doc,
    'p',
    { classe: 'accueil-compte' },
    doc.createTextNode('Bienvenue, '),
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
          // Compte depuis le contrat: il disait encore « Mode classique » apres l'ajout
          // de quatre modes (etape 5.5).
          creer(doc, 'span', {
            texte: `${String(MODES.length)} modes · ${String(Object.keys(CARTES).length)} cartes`,
          }),
        ),
        creer(
          doc,
          'h1',
          { classe: 'accueil-titre' },
          creer(doc, 'span', { texte: 'Le ninja, c’est vous.' }),
          creer(doc, 'span', { classe: 'accent', texte: 'Enfin, un des trois cents.' }),
        ),
        creer(doc, 'p', {
          classe: 'accueil-accroche',
          texte: 'Plusieurs modes, beaucoup de ninjas.',
        }),
        // L'etat du lien, en haut, visible sans defiler sur telephone (etape 5.5).
        creer(
          doc,
          'div',
          { classe: 'accueil-etat' },
          lien,
          recharger,
          reessayer,
          continuerEnInvite,
        ),
        avis,
        invitation,
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
      { classe: 'accueil-modes' },
      ...MODES.map((mode) =>
        creer(
          doc,
          'li',
          { classe: 'panneau carte-mode' },
          icone(doc, GLYPHES_DES_MODES[mode], 22),
          creer(doc, 'h2', { texte: NOMS_DES_MODES[mode] }),
          creer(doc, 'p', { texte: TEXTES_DES_MODES[mode] }),
        ),
      ),
    ),
    // De quand date le jeu qu'on a sous les yeux (etape 8.4). Le 20 septembre 2026,
    // la production est restee trois commits en arriere sans que rien ne le signale:
    // il fallait interroger la route de sante du serveur pour s'en apercevoir.
    // L'empreinte complete est dans l'infobulle, pour qui a le depot sous la main.
    creer(
      doc,
      'footer',
      { classe: 'accueil-pied' },
      creer(doc, 'span', {
        texte: contexte.libelleDeVersion,
        ...(contexte.version === undefined
          ? {}
          : { attributs: { title: `Commit ${contexte.version}` } }),
      }),
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
      client.rejoindre(
        modele.pseudo,
        modele.codeDEntree === undefined ? undefined : { code: modele.codeDEntree },
      );
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

      montrer(invitation, modele.invitation !== undefined);
      invitation.dataset['invitation'] =
        modele.invitation?.code === undefined ? 'malFormee' : 'code';
      ecrireTexte(titreDInvitation, modele.invitation?.titre ?? '');
      ecrireTexte(texteDInvitation, modele.invitation?.texte ?? '');
      ecrireTexte(codeDInvitation, modele.invitation?.code ?? '');
      montrer(ligneDuCode, modele.invitation?.code !== undefined);

      ecrireTexte(erreur, modele.erreur ?? '');
      montrer(erreur, modele.erreur !== undefined);
      ecrireTexte(libelleDuBouton, modele.libelleDuBouton);
      partieRapide.disabled = !modele.peutJouer;
      partieRapide.toggleAttribute('aria-busy', modele.enAttente);

      const texteDuLien = modele.enAttente ? 'Entrée dans une partie…' : modele.texteDuLien;

      // L'etat du lien se voit franchement (etape 5.5): une pastille coloree selon
      // l'etat, qui tourne tant qu'on attend, et le bouton de jeu qui attend avec elle.
      ecrireTexte(lien, texteDuLien);
      montrer(lien, texteDuLien !== '');
      lien.dataset['lien'] = modele.enAttente ? 'entree' : modele.lien;
      partieRapide.toggleAttribute('data-attente', lienEnAttente(modele.lien));
      montrer(recharger, modele.peutRecharger);
      montrer(reessayer, modele.peutReessayer);
      montrer(continuerEnInvite, modele.peutContinuerEnInvite);
    },

    demonter() {
      formulaire.removeEventListener('submit', surEnvoi);
      champPseudo.demonter();
      racine.remove();
    },
  };
}
