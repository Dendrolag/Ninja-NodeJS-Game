/**
 * L'ecran de fin: le podium, le classement, et les deux sorties.
 *
 * Portage de la fenetre de fin du jeu d'origine (showGameOverModal), dans la mise
 * en page de la maquette. Deux differences de fond.
 *
 *   1. LES PSEUDOS SONT DU TEXTE. La fenetre d'origine concatenait les pseudos
 *      dans du HTML: c'est la que la faille S1 frappait tous les joueurs a la
 *      fois, a la fin de chaque partie.
 *   2. « REJOUER » OUVRE UN NOUVEAU SALON. Le retour au salon d'une partie finie
 *      n'existe pas (handoff 2.1): la partie terminee refuse les nouveaux venus.
 *      Rejouer quitte donc la partie et redemande a entrer avec le meme pseudo,
 *      c'est-a-dire la partie rapide: la premiere partie publique en attente, ou
 *      une nouvelle (etape 2.4). Des joueurs qui
 *      rejouent ensemble se retrouvent ainsi dans le meme salon. La minuterie de
 *      trente secondes du jeu d'origine, qui renvoyait d'office au salon, n'est
 *      pas reprise: elle n'aurait nulle part ou renvoyer.
 */

import type { FinDePartie } from '@neon-ninja/shared';

import { moiDansLeSalon } from '../../selecteurs.js';
import { bouton, creer, ecrireTexte } from '../dom.js';
import type { LigneFin, ModeleFin } from '../modeles/fin.js';
import { modeleFin } from '../modeles/fin.js';
import { initiales } from '../modeles/salon.js';
import type { ContexteEcran, EcranAffiche } from './types.js';

/** Monte l'ecran de fin. */
export function monterFin(contexte: ContexteEcran): EcranAffiche {
  const doc = contexte.document;
  const client = contexte.client;

  const ligneContexte = creer(doc, 'p', { classe: 'fin-contexte' });
  const titre = creer(doc, 'h1', { classe: 'fin-titre' });
  const podium = creer(doc, 'div', { classe: 'podium' });
  const corpsTableau = creer(doc, 'tbody');

  const rejouer = (): void => {
    const etat = client.etat;

    client.quitter();

    // Un compte entre sous son propre pseudo, et n'en envoie pas.
    if (etat.session.nature !== 'invite') {
      client.rejoindre(undefined);
      return;
    }

    // Le pseudo retenu par le serveur, s'il est connu: il a deja ete valide et
    // normalise, donc il sera accepte de nouveau.
    const pseudo = moiDansLeSalon(etat)?.pseudo ?? etat.pseudoDemande;

    if (pseudo !== undefined) {
      client.rejoindre(pseudo);
    }
  };

  const racine = creer(
    doc,
    'section',
    { classe: 'ecran ecran-fin' },
    creer(doc, 'header', { classe: 'fin-entete' }, ligneContexte, titre),
    creer(
      doc,
      'div',
      { classe: 'fin-corps' },
      creer(doc, 'div', { classe: 'panneau fin-podium' }, podium),
      creer(
        doc,
        'section',
        { classe: 'panneau fin-classement' },
        creer(doc, 'h2', { texte: 'Classement final' }),
        creer(
          doc,
          'div',
          { classe: 'tableau-defilant' },
          creer(
            doc,
            'table',
            { classe: 'tableau' },
            creer(
              doc,
              'thead',
              {},
              creer(
                doc,
                'tr',
                {},
                ...['Rang', 'Joueur', 'Points', 'Ninjas', 'Captures', 'Black Ninjas'].map(
                  (entete) => creer(doc, 'th', { texte: entete, attributs: { scope: 'col' } }),
                ),
              ),
            ),
            corpsTableau,
          ),
        ),
      ),
    ),
    creer(
      doc,
      'div',
      { classe: 'fin-actions' },
      bouton(
        doc,
        { classe: 'bouton bouton-primaire bouton-large', texte: 'Rejouer', icone: 'replay' },
        rejouer,
      ),
      bouton(doc, { classe: 'bouton bouton-secondaire bouton-large', texte: 'Accueil' }, () => {
        client.quitter();
      }),
    ),
  );

  /** Le classement deja affiche: il est definitif, on ne le redessine pas. */
  let finAffichee: FinDePartie | undefined;

  const dessiner = (modele: ModeleFin): void => {
    ecrireTexte(ligneContexte, modele.contexte);

    titre.replaceChildren();

    if (modele.place !== undefined) {
      titre.append(
        creer(
          doc,
          'span',
          { classe: 'fin-place' },
          doc.createTextNode(String(modele.place.nombre)),
          creer(doc, 'sup', { texte: modele.place.suffixe }),
          doc.createTextNode(' place'),
        ),
        doc.createTextNode(' — '),
      );
    }

    titre.append(creer(doc, 'span', { classe: 'accent', texte: modele.message }));

    podium.replaceChildren(...modele.podium.map((ligne) => marche(doc, ligne)));
    corpsTableau.replaceChildren(...modele.lignes.map((ligne) => rangee(doc, ligne)));
  };

  return {
    racine,

    afficher(etat) {
      if (etat.fin === finAffichee) {
        return;
      }

      finAffichee = etat.fin;
      const modele = modeleFin(etat);

      if (modele !== undefined) {
        dessiner(modele);
      }
    },

    demonter() {
      racine.remove();
    },
  };
}

/** Une marche du podium. */
function marche(doc: Document, ligne: LigneFin): HTMLElement {
  const avatar = creer(doc, 'span', {
    classe: 'avatar',
    texte: initiales(ligne.pseudo),
    attributs: { 'aria-hidden': 'true' },
  });
  avatar.style.setProperty('--couleur-joueur', ligne.couleur);

  return creer(
    doc,
    'div',
    {
      classe: ligne.moi
        ? `marche marche-${String(ligne.rang)} moi`
        : `marche marche-${String(ligne.rang)}`,
      attributs: { 'data-rang': String(ligne.rang) },
    },
    avatar,
    creer(doc, 'span', { classe: 'marche-pseudo', texte: ligne.pseudo }),
    creer(doc, 'span', { classe: 'marche-points', texte: `${String(ligne.points)} pts` }),
    creer(
      doc,
      'div',
      { classe: 'marche-socle' },
      creer(doc, 'span', { texte: String(ligne.rang) }),
    ),
  );
}

/** Une rangee du classement complet. */
function rangee(doc: Document, ligne: LigneFin): HTMLElement {
  const pastille = creer(doc, 'span', { classe: 'pastille', attributs: { 'aria-hidden': 'true' } });
  pastille.style.setProperty('--couleur-joueur', ligne.couleur);

  return creer(
    doc,
    'tr',
    { classe: ligne.moi ? 'moi' : '', attributs: { 'data-joueur': ligne.id } },
    creer(doc, 'td', { classe: 'rang', texte: String(ligne.rang) }),
    creer(doc, 'td', { classe: 'joueur' }, pastille, creer(doc, 'span', { texte: ligne.pseudo })),
    creer(doc, 'td', { classe: 'nombre points', texte: String(ligne.points) }),
    creer(doc, 'td', { classe: 'nombre', texte: String(ligne.botsPortes) }),
    creer(doc, 'td', { classe: 'nombre', texte: String(ligne.captures) }),
    creer(doc, 'td', { classe: 'nombre', texte: String(ligne.botsNoirsDetruits) }),
  );
}
