/**
 * Le salon: les joueurs presents, les reglages, le chat, et le lancement.
 *
 * Portage du waitingRoom du jeu d'origine, dans la mise en page de la maquette:
 * les joueurs et les reglages a gauche, le chat a droite, le lancement en bas.
 *
 * L'AUTORITE N'EST PAS DECIDEE ICI. Le bouton de lancement et celui des reglages
 * ne sont montres qu'a l'hote, parce que le modele le dit; mais les cacher n'est
 * qu'une politesse. Le serveur verifie la qualite d'hote a chaque demande, et un
 * invite qui les forcerait recevrait un refus, annonce par le fil des annonces.
 *
 * LE JEU D'ORIGINE AVAIT TROIS FENETRES POUR CE SALON (parametres, carte, aide),
 * dont deux se chevauchaient: la carte se reglait a deux endroits. Il n'y a ici
 * qu'un panneau de reglages, carte comprise, et l'aide est commune a
 * l'application.
 */

import type { EtatClient } from '../../etat.js';
import { monterChat } from '../composants/chat.js';
import { monterPanneauReglages } from '../composants/reglages.js';
import { bouton, creer, ecrireTexte, montrer } from '../dom.js';
import { icone } from '../icones.js';
import type { JoueurAffiche, LigneRecapitulatif } from '../modeles/salon.js';
import { modeleSalon } from '../modeles/salon.js';
import type { ContexteEcran, EcranAffiche } from './types.js';

/** Monte l'ecran du salon. */
export function monterSalon(contexte: ContexteEcran): EcranAffiche {
  const doc = contexte.document;
  const client = contexte.client;
  let etatCourant: EtatClient | undefined;

  const titre = creer(doc, 'h1', { classe: 'salon-titre' });
  const sousTitre = creer(doc, 'p', { classe: 'salon-sous-titre' });
  const effectif = creer(doc, 'span', { classe: 'salon-effectif' });
  const listeJoueurs = creer(doc, 'ul', { classe: 'salon-joueurs' });
  const recapitulatif = creer(doc, 'dl', { classe: 'recapitulatif' });
  const consigne = creer(doc, 'p', { classe: 'salon-consigne' });

  const panneau = monterPanneauReglages({
    document: doc,
    surEnregistrer: (reglages) => {
      client.changerReglages(reglages);
    },
  });

  const ouvrirReglages = bouton(
    doc,
    { classe: 'bouton bouton-secondaire', texte: 'Réglages', icone: 'gear' },
    () => {
      const reglages = etatCourant?.salon?.reglages;

      if (reglages !== undefined) {
        panneau.ouvrirAvec(reglages);
      }
    },
  );

  const lancer = bouton(
    doc,
    { classe: 'bouton bouton-primaire bouton-large', texte: 'Lancer la partie', icone: 'play' },
    () => {
      client.demarrer();
    },
  );

  const quitter = (): void => {
    client.quitter();
  };

  const chat = monterChat(doc, client);

  const secondes = creer(doc, 'span', { classe: 'compte-nombre' });
  const annuler = bouton(
    doc,
    { classe: 'bouton bouton-secondaire', texte: 'Annuler le lancement' },
    () => {
      client.annulerDemarrage();
    },
  );
  const compteARebours = creer(
    doc,
    'div',
    {
      classe: 'compte-a-rebours',
      attributs: { role: 'alertdialog', 'aria-label': 'La partie va commencer' },
    },
    creer(
      doc,
      'div',
      { classe: 'compte-contenu panneau' },
      creer(doc, 'p', { classe: 'compte-titre', texte: 'La partie commence dans' }),
      secondes,
      annuler,
    ),
  );
  compteARebours.hidden = true;

  const racine = creer(
    doc,
    'section',
    { classe: 'ecran ecran-salon' },
    creer(
      doc,
      'header',
      { classe: 'salon-entete' },
      bouton(
        doc,
        { classe: 'bouton-icone bouton-retour', icone: 'arrowLeft', etiquette: 'Quitter le salon' },
        quitter,
      ),
      creer(doc, 'div', { classe: 'salon-intitule' }, titre, sousTitre),
      creer(
        doc,
        'div',
        { classe: 'salon-entete-actions' },
        bouton(
          doc,
          { classe: 'bouton bouton-secondaire', texte: 'Aide', icone: 'keyboard' },
          contexte.ouvrirAide,
        ),
        ouvrirReglages,
      ),
    ),
    creer(
      doc,
      'div',
      { classe: 'salon-corps' },
      creer(
        doc,
        'div',
        { classe: 'salon-principal' },
        creer(
          doc,
          'div',
          { classe: 'titre-de-section' },
          creer(doc, 'h2', { texte: 'Joueurs' }),
          effectif,
        ),
        listeJoueurs,
        creer(
          doc,
          'section',
          { classe: 'panneau salon-reglages' },
          creer(doc, 'h2', { texte: 'Réglages de la partie' }),
          recapitulatif,
        ),
        creer(
          doc,
          'div',
          { classe: 'salon-actions' },
          consigne,
          creer(
            doc,
            'div',
            { classe: 'salon-boutons' },
            bouton(doc, { classe: 'bouton bouton-secondaire', texte: 'Quitter le salon' }, quitter),
            lancer,
          ),
        ),
      ),
      chat.racine,
    ),
    compteARebours,
    panneau.racine,
  );

  /** La signature de la liste affichee, pour ne la refaire que si elle a change. */
  let signatureJoueurs = '';
  let signatureRecapitulatif = '';

  const majJoueurs = (joueurs: readonly JoueurAffiche[]): void => {
    const signature = joueurs
      .map((joueur) => `${joueur.id}|${joueur.pseudo}|${String(joueur.hote)}|${String(joueur.moi)}`)
      .join('\n');

    if (signature === signatureJoueurs) {
      return;
    }

    signatureJoueurs = signature;
    listeJoueurs.replaceChildren(...joueurs.map((joueur) => carteJoueur(doc, joueur)));
  };

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

  return {
    racine,

    afficher(etat) {
      etatCourant = etat;
      const modele = modeleSalon(etat);

      if (modele === undefined) {
        return;
      }

      ecrireTexte(titre, modele.titre);
      ecrireTexte(sousTitre, modele.sousTitre);
      ecrireTexte(effectif, modele.effectif);
      ecrireTexte(consigne, modele.consigne);
      montrer(ouvrirReglages, modele.jeSuisHote);
      montrer(lancer, modele.peutLancer);

      // Un hote qui cede sa place ne garde pas un panneau qu'il ne peut plus
      // enregistrer.
      if (!modele.jeSuisHote && panneau.ouvert) {
        panneau.fermer();
      }

      majJoueurs(modele.joueurs);
      majRecapitulatif(modele.recapitulatif);
      chat.afficher(modele.messages, etat.refus?.action === 'chat' ? etat.refus : undefined);

      const compte = modele.compteARebours;
      montrer(compteARebours, compte !== undefined);

      if (compte !== undefined) {
        ecrireTexte(secondes, String(compte.secondes));
        montrer(annuler, compte.peutAnnuler);
      }
    },

    demonter() {
      chat.demonter();
      panneau.demonter();
      racine.remove();
    },
  };
}

/** La carte d'un joueur du salon. */
function carteJoueur(doc: Document, joueur: JoueurAffiche): HTMLElement {
  return creer(
    doc,
    'li',
    {
      classe: joueur.moi ? 'carte-joueur moi' : 'carte-joueur',
      attributs: { 'data-joueur': joueur.id },
    },
    creer(doc, 'span', {
      classe: 'avatar',
      texte: joueur.initiales,
      attributs: { 'aria-hidden': 'true' },
    }),
    creer(
      doc,
      'span',
      { classe: 'carte-joueur-identite' },
      creer(doc, 'span', { classe: 'carte-joueur-pseudo', texte: joueur.pseudo }),
      joueur.moi ? creer(doc, 'span', { classe: 'carte-joueur-note', texte: 'Vous' }) : undefined,
    ),
    joueur.hote
      ? creer(
          doc,
          'span',
          { classe: 'badge badge-hote' },
          icone(doc, 'crown', 12),
          creer(doc, 'span', { texte: 'Hôte' }),
        )
      : undefined,
  );
}
