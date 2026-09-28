/**
 * La fenetre des credits (etape 4.7), ouverte depuis le pied de l'accueil.
 *
 * Deux lignes, arretees avec le porteur du projet: a qui est le jeu, puis qui y a
 * participe. Elle ne dit rien de plus, et ne s'ouvre que si on la demande: les
 * credits se voient sans charger aucun ecran.
 *
 * UN NOM AVEC UNE ADRESSE DEVIENT UN LIEN SUR. Il s'ouvre dans un nouvel onglet, pour
 * qu'un joueur ne quitte pas sa partie, et sans transmettre la page d'origine:
 * `noopener` coupe l'acces de la page ouverte a la notre, `noreferrer` tait d'ou
 * vient le visiteur.
 */

import { creer } from '../dom.js';
import type { Credits, Participation } from '../modeles/credits.js';
import { AVANT_LE_NOM, CREDITS, apresLeNom } from '../modeles/credits.js';
import type { Fenetre } from './fenetre.js';
import { monterFenetre } from './fenetre.js';

/** Le nom d'une participation: un lien vers sa page s'il y en a une, sinon du texte. */
function nomDeLaParticipation(doc: Document, participation: Participation): HTMLElement {
  if (participation.adresse === undefined) {
    return creer(doc, 'strong', { texte: participation.nom });
  }

  return creer(doc, 'a', {
    classe: 'credits-lien',
    texte: participation.nom,
    attributs: {
      href: participation.adresse,
      target: '_blank',
      rel: 'noopener noreferrer',
    },
  });
}

/**
 * Monte la fenetre des credits, fermee.
 *
 * Les credits se passent en parametre pour que les tests eprouvent aussi un nom avec
 * une adresse, que les credits du jeu n'ont pas encore.
 */
export function monterCredits(doc: Document, credits: Credits = CREDITS): Fenetre {
  const fenetre = monterFenetre({ document: doc, titre: 'Crédits', classe: 'fenetre-credits' });

  fenetre.corps.append(
    creer(doc, 'p', { classe: 'credits-creation', texte: credits.creation }),
    ...credits.participations.map((participation) =>
      creer(
        doc,
        'p',
        { classe: 'credits-participation' },
        doc.createTextNode(AVANT_LE_NOM),
        nomDeLaParticipation(doc, participation),
        doc.createTextNode(apresLeNom(participation)),
      ),
    ),
  );

  return fenetre;
}
