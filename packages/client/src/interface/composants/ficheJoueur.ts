/**
 * La fenetre de la fiche d'un joueur (etape 3.5): ce que tout compte connecte peut
 * lire d'un autre, ouverte par-dessus le salon ou le classement de fin.
 *
 * UNE FENETRE, PAS UN ECRAN. Le salon et la fin sont des ecrans de partie: on ne les
 * quitte pas pour lire une fiche. L'application la monte une fois, comme celle du
 * code de secours, et elle suit l'etat: ouverte tant que l'etat porte une fiche,
 * fermee sinon.
 *
 * UNE SUITE DE SECTIONS. L'identite, les statistiques, le tableau par mode. Les
 * succes (etapes 3.7 et 3.8) et, pour un ami, les parties jouees ensemble (etape
 * 3.6) s'y ajouteront chacun en section.
 *
 * CE COMPOSANT NE DECIDE RIEN. Il montre le modele de la fiche, et previent le client
 * a la fermeture, quelle qu'en soit la facon: bouton, croix, Echap ou clic a cote.
 */

import type { Client } from '../../client.js';
import type { EtatClient } from '../../etat.js';
import { bouton, creer, ecrireTexte, montrer } from '../dom.js';
import { icone } from '../icones.js';
import type { ModeleFiche } from '../modeles/fiche.js';
import { modeleFiche } from '../modeles/fiche.js';
import { monterFenetre } from './fenetre.js';
import { tableauParMode, tuilesDeStatistiques } from './statistiques.js';

/** La fenetre de la fiche, montee. */
export interface FenetreDeLaFiche {
  readonly racine: HTMLElement;
  afficher(etat: EtatClient): void;
  demonter(): void;
}

/** Monte la fenetre de la fiche, fermee. */
export function monterFenetreDeLaFiche(doc: Document, client: Client): FenetreDeLaFiche {
  const fenetre = monterFenetre({
    document: doc,
    titre: 'Fiche du joueur',
    classe: 'fenetre-fiche',
    surFermeture: () => {
      client.fermerLaFiche();
    },
  });

  const chargement = creer(doc, 'p', {
    classe: 'fiche-chargement',
    attributs: { role: 'status' },
  });

  const motifDEchec = creer(doc, 'p', { attributs: { role: 'alert' } });
  const reessayer = bouton(
    doc,
    { classe: 'bouton bouton-secondaire', texte: 'Réessayer', icone: 'replay' },
    () => {
      const fiche = client.etat.fiche;

      if (fiche.statut === 'echec') {
        client.ouvrirLaFiche(fiche.pseudo);
      }
    },
  );
  const echec = creer(doc, 'div', { classe: 'fiche-echec' }, motifDEchec, reessayer);

  const avatar = creer(doc, 'span', {
    classe: 'avatar avatar-fiche',
    attributs: { 'aria-hidden': 'true' },
  });
  const pseudo = creer(doc, 'h3', { classe: 'fiche-pseudo' });
  const niveau = creer(doc, 'span', { classe: 'badge fiche-niveau' });
  const palier = creer(doc, 'span');
  const inscription = creer(doc, 'p', { classe: 'fiche-inscription' });
  const statistiques = creer(doc, 'ul', { classe: 'statistiques' });
  const parMode = creer(doc, 'div', { classe: 'fiche-par-mode-tableau' });
  const sansPartie = creer(doc, 'p', {
    classe: 'fiche-vide',
    texte: 'Aucune partie enregistrée pour l’instant.',
  });

  const contenu = creer(
    doc,
    'div',
    { classe: 'fiche-contenu' },
    creer(
      doc,
      'section',
      { classe: 'fiche-identite' },
      avatar,
      creer(
        doc,
        'div',
        {},
        pseudo,
        creer(
          doc,
          'div',
          { classe: 'fiche-badges' },
          niveau,
          creer(doc, 'span', { classe: 'badge badge-palier' }, icone(doc, 'diamond', 12), palier),
        ),
        inscription,
      ),
    ),
    creer(
      doc,
      'section',
      { classe: 'fiche-statistiques' },
      creer(doc, 'h3', { texte: 'Statistiques' }),
      statistiques,
    ),
    creer(
      doc,
      'section',
      { classe: 'fiche-par-mode' },
      creer(doc, 'h3', { texte: 'Par mode' }),
      sansPartie,
      parMode,
    ),
  );

  fenetre.corps.append(chargement, echec, contenu);
  fenetre.pied.append(
    bouton(doc, { classe: 'bouton bouton-secondaire', texte: 'Fermer' }, () => {
      fenetre.fermer();
    }),
  );

  /** La fiche deja dessinee: elle ne se redessine que si elle a change. */
  let dessinee: unknown;

  const dessiner = (modele: Extract<ModeleFiche, { nature: 'chargee' }>): void => {
    ecrireTexte(avatar, modele.initiales);
    ecrireTexte(pseudo, modele.pseudo);
    ecrireTexte(niveau, modele.niveau);
    ecrireTexte(palier, modele.palier);
    ecrireTexte(inscription, modele.inscription);
    statistiques.replaceChildren(...tuilesDeStatistiques(doc, modele.statistiques));
    parMode.replaceChildren(tableauParMode(doc, modele.parMode));
    montrer(parMode, modele.parMode.length > 0);
    montrer(sansPartie, modele.parMode.length === 0);
  };

  return {
    racine: fenetre.racine,

    afficher(etat) {
      const modele = modeleFiche(etat);

      if (modele.nature === 'fermee') {
        fenetre.fermer();
        return;
      }

      montrer(chargement, modele.nature === 'chargement');
      montrer(echec, modele.nature === 'echec');
      montrer(contenu, modele.nature === 'chargee');

      if (modele.nature === 'chargement') {
        ecrireTexte(chargement, `Lecture de la fiche de ${modele.pseudo}…`);
      }

      if (modele.nature === 'echec') {
        ecrireTexte(motifDEchec, modele.motif);
      }

      if (modele.nature === 'chargee' && etat.fiche !== dessinee) {
        dessinee = etat.fiche;
        dessiner(modele);
      }

      fenetre.ouvrir();
    },

    demonter() {
      fenetre.demonter();
    },
  };
}

/**
 * Le pseudo d'un joueur, en bouton qui ouvre sa fiche (etape 3.5). Son nom lu commence
 * par le pseudo affiche, et dit ce que fait le bouton.
 */
export function boutonDeFiche(
  doc: Document,
  pseudo: string,
  classe: string,
  client: Client,
): HTMLButtonElement {
  const element = bouton(doc, { classe: `${classe} lien-fiche`, texte: pseudo }, () => {
    client.ouvrirLaFiche(pseudo);
  });
  element.setAttribute('aria-label', `${pseudo}, voir sa fiche`);
  element.title = 'Voir sa fiche';

  return element;
}
