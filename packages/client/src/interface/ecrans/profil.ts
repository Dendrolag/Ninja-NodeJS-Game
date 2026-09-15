/**
 * L'ecran du profil: ce que le compte a accumule, et ses dernieres parties.
 *
 * Sans equivalent dans le legacy. La maquette y met aussi le pass de saison, les
 * skins, les succes et le rang mondial: tous reportes apres la v1, et absents.
 *
 * CET ECRAN NE DECIDE RIEN. Ce qu'il montre vient de modeleProfil; la lecture du
 * profil part de la navigation vers cet ecran (client.ts), pas de son montage. Il
 * ne propose qu'une action qui lui soit propre: se deconnecter, qui ramene a
 * l'accueil en invite.
 */

import { bouton, creer, ecrireTexte, montrer } from '../dom.js';
import { icone } from '../icones.js';
import type { LigneDHistorique, ModeleProfil } from '../modeles/profil.js';
import { modeleProfil } from '../modeles/profil.js';
import type { ContexteEcran, EcranAffiche } from './types.js';

/** Les colonnes de l'historique. */
const COLONNES = ['Date', 'Partie', 'Place', 'Points', 'XP', 'Pièces', 'Ligue'] as const;

/** Monte l'ecran du profil. */
export function monterProfil(contexte: ContexteEcran): EcranAffiche {
  const doc = contexte.document;
  const client = contexte.client;

  const chargement = creer(doc, 'p', {
    classe: 'profil-chargement',
    texte: 'Lecture du profil…',
    attributs: { role: 'status' },
  });

  const motifDEchec = creer(doc, 'p', { attributs: { role: 'alert' } });
  const echec = creer(
    doc,
    'div',
    { classe: 'profil-echec' },
    motifDEchec,
    bouton(doc, { classe: 'bouton bouton-secondaire', texte: 'Réessayer', icone: 'replay' }, () => {
      client.chargerLeProfil();
    }),
  );

  const avatar = creer(doc, 'span', {
    classe: 'avatar avatar-profil',
    attributs: { 'aria-hidden': 'true' },
  });
  const pseudo = creer(doc, 'h1');
  const palier = creer(doc, 'span');
  const inscription = creer(doc, 'p', { classe: 'profil-inscription' });
  const niveau = creer(doc, 'span');
  const niveauSuivant = creer(doc, 'span');
  const remplissage = creer(doc, 'span', { classe: 'barre-remplie' });
  const xp = creer(doc, 'p', { classe: 'barre-niveau-xp' });
  const statistiques = creer(doc, 'ul', { classe: 'statistiques' });
  const corpsHistorique = creer(doc, 'tbody');
  const historique = creer(
    doc,
    'div',
    { classe: 'tableau-defilant' },
    creer(
      doc,
      'table',
      { classe: 'tableau tableau-historique' },
      creer(
        doc,
        'thead',
        {},
        creer(
          doc,
          'tr',
          {},
          ...COLONNES.map((colonne) =>
            creer(doc, 'th', { texte: colonne, attributs: { scope: 'col' } }),
          ),
        ),
      ),
      corpsHistorique,
    ),
  );
  const historiqueVide = creer(doc, 'p', {
    classe: 'profil-vide',
    texte:
      'Aucune partie enregistrée pour l’instant. Jouez avec votre compte : chaque partie terminée apparaîtra ici.',
  });

  const contenu = creer(
    doc,
    'div',
    { classe: 'profil-contenu' },
    creer(
      doc,
      'header',
      { classe: 'panneau profil-entete' },
      avatar,
      creer(
        doc,
        'div',
        { classe: 'profil-identite' },
        creer(
          doc,
          'div',
          { classe: 'profil-nom' },
          pseudo,
          creer(doc, 'span', { classe: 'badge badge-palier' }, icone(doc, 'diamond', 12), palier),
        ),
        inscription,
        creer(
          doc,
          'div',
          { classe: 'barre-niveau' },
          niveau,
          creer(doc, 'span', { classe: 'barre' }, remplissage),
          niveauSuivant,
        ),
        xp,
      ),
      bouton(
        doc,
        { classe: 'bouton bouton-secondaire', texte: 'Se déconnecter', icone: 'sortir' },
        () => {
          client.seDeconnecter();
        },
      ),
    ),
    creer(
      doc,
      'section',
      { classe: 'profil-statistiques' },
      creer(doc, 'h2', { texte: 'Statistiques' }),
      statistiques,
    ),
    creer(
      doc,
      'section',
      { classe: 'panneau profil-parties' },
      creer(doc, 'h2', { texte: 'Dernières parties' }),
      historiqueVide,
      historique,
    ),
  );

  const racine = creer(
    doc,
    'section',
    { classe: 'ecran ecran-profil' },
    chargement,
    echec,
    contenu,
  );

  /** Le profil deja dessine: il ne se redessine que s'il a change. */
  let dessine: unknown;

  const dessiner = (modele: Extract<ModeleProfil, { nature: 'charge' }>): void => {
    ecrireTexte(avatar, modele.initiales);
    ecrireTexte(pseudo, modele.pseudo);
    ecrireTexte(palier, modele.palier);
    ecrireTexte(inscription, modele.inscription);
    ecrireTexte(niveau, `Niv. ${String(modele.barre.niveau)}`);
    ecrireTexte(niveauSuivant, `Niv. ${String(modele.barre.niveau + 1)}`);
    remplissage.style.setProperty('--remplissage', `${String(modele.barre.pourCent)}%`);
    ecrireTexte(xp, modele.barre.xp);

    statistiques.replaceChildren(
      ...modele.statistiques.map((statistique) =>
        creer(
          doc,
          'li',
          { classe: 'panneau statistique' },
          creer(doc, 'strong', { texte: statistique.valeur }),
          creer(doc, 'span', { texte: statistique.libelle }),
        ),
      ),
    );

    corpsHistorique.replaceChildren(...modele.parties.map((partie) => rangee(doc, partie)));
    montrer(historique, modele.parties.length > 0);
    montrer(historiqueVide, modele.parties.length === 0);
  };

  return {
    racine,

    afficher(etat) {
      const modele = modeleProfil(etat);

      montrer(chargement, modele.nature === 'chargement');
      montrer(echec, modele.nature === 'echec');
      montrer(contenu, modele.nature === 'charge');

      if (modele.nature === 'echec') {
        ecrireTexte(motifDEchec, modele.motif);
      }

      if (modele.nature === 'charge' && etat.profil !== dessine) {
        dessine = etat.profil;
        dessiner(modele);
      }
    },

    demonter() {
      racine.remove();
    },
  };
}

/** Une rangee de l'historique. */
function rangee(doc: Document, partie: LigneDHistorique): HTMLElement {
  return creer(
    doc,
    'tr',
    {},
    creer(doc, 'td', { classe: 'profil-date', texte: partie.date }),
    creer(doc, 'td', { texte: partie.partie }),
    creer(doc, 'td', { classe: 'nombre', texte: partie.place }),
    creer(doc, 'td', { classe: 'nombre', texte: partie.points }),
    creer(doc, 'td', { classe: 'nombre', texte: partie.xp }),
    creer(doc, 'td', { classe: 'nombre', texte: partie.pieces }),
    creer(doc, 'td', {
      classe: `nombre ligue-${partie.sensDeLaLigue}`,
      texte: partie.ligue,
    }),
  );
}
