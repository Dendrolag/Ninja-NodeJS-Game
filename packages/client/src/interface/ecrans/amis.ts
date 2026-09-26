/**
 * L'ecran des amis (etape 3.6): ajouter un joueur par son pseudo, repondre aux
 * demandes recues, retrouver ses amis, annuler ses demandes, debloquer.
 *
 * Sans equivalent dans le legacy. L'etude des amis (section 4.5) le place en cinquieme
 * destination de la navigation. La presence des amis et les invitations viendront a
 * l'etape 2.8.
 *
 * CET ECRAN NE DECIDE RIEN. Ce qu'il montre vient de modeleAmis; la liste se relit a
 * chaque navigation (client.ts), et chaque pseudo ouvre la fiche du joueur, montee par
 * l'application, ou se trouvent les autres gestes: retirer un ami, bloquer. L'ecran ne
 * retient que le pseudo qu'il vient d'envoyer, pour vider le champ une fois la demande
 * faite.
 */

import { BORNES_PSEUDO, reperePseudo } from '@neon-ninja/shared';

import type { EtatClient } from '../../etat.js';
import { boutonDeFiche } from '../composants/ficheJoueur.js';
import { boutonsDeGestes } from '../composants/gestesDAmitie.js';
import { bouton, creer, ecrireTexte, montrer } from '../dom.js';
import type { LigneDAmi, ModeleAmis, SectionDAmis } from '../modeles/amis.js';
import { modeleAmis, modeleDuGeste } from '../modeles/amis.js';
import type { ContexteEcran, EcranAffiche } from './types.js';

/** Une section montee: son titre, sa liste, et ce qu'elle dit vide. */
interface SectionMontee {
  readonly racine: HTMLElement;
  readonly liste: HTMLUListElement;
  readonly vide: HTMLElement;
  readonly nombre: HTMLElement;
}

/** Monte l'ecran des amis. */
export function monterAmis(contexte: ContexteEcran): EcranAffiche {
  const doc = contexte.document;
  const client = contexte.client;

  /** Le pseudo que le formulaire vient d'envoyer, tant que sa demande n'est pas faite. */
  let envoye: string | undefined;

  const compte = creer(doc, 'p', { classe: 'sous-titre-ecran' });

  const saisie = creer(doc, 'input', {
    classe: 'champ-texte',
    attributs: {
      type: 'text',
      name: 'ami',
      maxlength: String(BORNES_PSEUDO.longueur.maximum),
      autocomplete: 'off',
      spellcheck: 'false',
      placeholder: 'Pseudo d’un joueur',
    },
  });
  const envoyer = bouton(doc, {
    classe: 'bouton bouton-primaire',
    texte: 'Envoyer la demande',
    icone: 'plus',
    type: 'submit',
  });
  const formulaire = creer(
    doc,
    'form',
    { classe: 'panneau amis-ajout', attributs: { novalidate: '' } },
    creer(
      doc,
      'label',
      { classe: 'amis-champ' },
      creer(doc, 'span', { classe: 'etiquette', texte: 'Ajouter par pseudo' }),
      saisie,
    ),
    envoyer,
  );

  const surEnvoi = (evenement: Event): void => {
    evenement.preventDefault();
    envoye = saisie.value.trim();
    client.faireUnGeste('demander', envoye);
  };
  formulaire.addEventListener('submit', surEnvoi);

  const annonce = creer(doc, 'p', { classe: 'amis-annonce', attributs: { role: 'status' } });
  const erreur = creer(doc, 'p', { classe: 'amis-erreur', attributs: { role: 'alert' } });

  const chargement = creer(doc, 'p', {
    classe: 'amis-chargement',
    texte: 'Lecture de vos amis…',
    attributs: { role: 'status' },
  });
  const motifDEchec = creer(doc, 'p', { attributs: { role: 'alert' } });
  const echec = creer(
    doc,
    'div',
    { classe: 'amis-echec' },
    motifDEchec,
    bouton(doc, { classe: 'bouton bouton-secondaire', texte: 'Réessayer', icone: 'replay' }, () => {
      client.chargerLesAmis();
    }),
  );

  const sections = {
    recues: monterSection(doc, 'amis-recues'),
    amis: monterSection(doc, 'amis-amis'),
    envoyees: monterSection(doc, 'amis-envoyees'),
    bloques: monterSection(doc, 'amis-bloques'),
  };
  const listes = creer(
    doc,
    'div',
    { classe: 'amis-listes' },
    sections.recues.racine,
    sections.amis.racine,
    sections.envoyees.racine,
    sections.bloques.racine,
  );

  const racine = creer(
    doc,
    'section',
    { classe: 'ecran ecran-amis' },
    creer(
      doc,
      'header',
      { classe: 'titre-et-sous-titre' },
      creer(doc, 'h1', { classe: 'titre-ecran', texte: 'Amis' }),
      compte,
    ),
    formulaire,
    annonce,
    erreur,
    chargement,
    echec,
    listes,
  );

  /** Les listes deja dessinees, decrites: elles ne se refont que si elles ont change. */
  let dessinees = '';

  const dessiner = (modele: Extract<ModeleAmis, { nature: 'chargee' }>, enCours: boolean): void => {
    const description = JSON.stringify([modele, enCours]);

    if (description === dessinees) {
      return;
    }

    dessinees = description;
    ecrireTexte(compte, `${modele.compte} amis`);

    for (const nom of ['recues', 'amis', 'envoyees', 'bloques'] as const) {
      remplirSection(sections[nom], modele[nom], (ligne) =>
        ligneDAmi(doc, contexte, ligne, enCours),
      );
    }
  };

  return {
    racine,

    afficher(etat: EtatClient) {
      const modele = modeleAmis(etat);
      const geste = modeleDuGeste(etat.amis.geste);

      montrer(chargement, modele.nature === 'chargement');
      montrer(echec, modele.nature === 'echec');
      montrer(listes, modele.nature === 'chargee');
      montrer(compte, modele.nature === 'chargee');

      if (modele.nature === 'echec') {
        ecrireTexte(motifDEchec, modele.motif);
      }

      if (modele.nature === 'chargee') {
        dessiner(modele, geste.enCours);
      }

      envoyer.disabled = geste.enCours;
      ecrireTexte(annonce, geste.annonce ?? '');
      montrer(annonce, geste.annonce !== undefined);
      ecrireTexte(erreur, geste.erreur ?? '');
      montrer(erreur, geste.erreur !== undefined);
      saisie.toggleAttribute('aria-invalid', geste.erreur !== undefined && envoye !== undefined);

      // La demande envoyee depuis le champ est faite: le champ se vide pour la suivante.
      const dernier = etat.amis.geste;
      if (
        envoye !== undefined &&
        dernier.statut === 'fait' &&
        dernier.geste === 'demander' &&
        reperePseudo(dernier.pseudo) === reperePseudo(envoye)
      ) {
        envoye = undefined;
        saisie.value = '';
      }
    },

    demonter() {
      formulaire.removeEventListener('submit', surEnvoi);
      racine.remove();
    },
  };
}

/** Monte une section vide: titre, nombre, liste, et phrase de liste vide. */
function monterSection(doc: Document, classe: string): SectionMontee {
  const titre = creer(doc, 'h2');
  const nombre = creer(doc, 'span', { classe: 'badge amis-nombre' });
  const liste = creer(doc, 'ul', { classe: 'amis-liste' });
  const vide = creer(doc, 'p', { classe: 'amis-vide' });

  return {
    racine: creer(
      doc,
      'section',
      { classe: `panneau amis-section ${classe}` },
      creer(doc, 'div', { classe: 'amis-section-titre' }, titre, nombre),
      liste,
      vide,
    ),
    liste,
    vide,
    nombre,
  };
}

/** Remplit une section. Vide, elle dit pourquoi, ou se cache si elle n'a rien a dire. */
function remplirSection(
  montee: SectionMontee,
  section: SectionDAmis,
  ligne: (ligne: LigneDAmi) => HTMLElement,
): void {
  const titre = montee.racine.querySelector('h2');
  if (titre !== null) {
    ecrireTexte(titre, section.titre);
  }

  ecrireTexte(montee.nombre, String(section.lignes.length));
  montee.liste.replaceChildren(...section.lignes.map(ligne));
  ecrireTexte(montee.vide, section.vide ?? '');
  montrer(montee.liste, section.lignes.length > 0);
  montrer(montee.vide, section.lignes.length === 0 && section.vide !== undefined);
  montrer(montee.racine, section.lignes.length > 0 || section.vide !== undefined);
}

/** Une ligne de liste: l'avatar, le pseudo qui ouvre la fiche, le niveau, les gestes. */
function ligneDAmi(
  doc: Document,
  contexte: ContexteEcran,
  ligne: LigneDAmi,
  enCours: boolean,
): HTMLElement {
  return creer(
    doc,
    'li',
    { classe: 'ligne-ami' },
    creer(doc, 'span', {
      classe: 'avatar',
      texte: ligne.initiales,
      attributs: { 'aria-hidden': 'true' },
    }),
    creer(
      doc,
      'div',
      { classe: 'ligne-ami-identite' },
      boutonDeFiche(doc, ligne.pseudo, 'ligne-ami-pseudo', contexte.client),
      creer(doc, 'span', { classe: 'ligne-ami-niveau', texte: ligne.niveau }),
    ),
    ...boutonsDeGestes(doc, contexte.client, ligne.pseudo, ligne.gestes, enCours),
  );
}
