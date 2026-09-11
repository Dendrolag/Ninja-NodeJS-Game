/**
 * L'application: l'en-tete, l'ecran affiche, les annonces, l'aide et le son.
 *
 * C'EST LE SEUL ABONNE DU CLIENT. A chaque changement d'etat, elle regarde quel
 * ecran doit etre affiche (la reponse est deja dans etat.ecran, calculee par
 * ecrans.ts), monte le bon s'il a change, et lui donne l'etat. Le jeu d'origine
 * montrait et cachait ses div depuis chacun de ses gestionnaires d'evenement,
 * si bien qu'il y avait autant de reponses a « quel ecran afficher » que
 * d'endroits ou la question se posait.
 *
 * UN ECRAN QUITTE EST DEMONTE, PAS CACHE. Ses ecoutes sont retirees, sa boucle de
 * rendu arretee, son GPU libere. Revenir a l'accueil puis rejouer remonte des
 * ecrans neufs: rien ne peut s'empiler d'une partie a l'autre.
 *
 * ELLE FAIT ENTENDRE LES PASSAGES D'UN ECRAN A L'AUTRE, et ce qui arrive hors de
 * la partie: le compte a rebours, le chat du salon, le depart et la fin. Pendant
 * la partie, c'est la boucle de rendu qui fait entendre ce qui s'y passe; les deux
 * ne jouent jamais le meme son, parce que l'application se tait tant que l'etat
 * precedent et l'etat courant sont tous deux en jeu.
 *
 * L'ECRAN DE JEU LUI EST FOURNI. Il monte PixiJS, qui ne se charge pas hors d'un
 * navigateur: le recevoir plutot que l'importer permet de tester toute la
 * navigation avec un ecran de jeu d'essai.
 */

import type { PisteMusicale } from '@neon-ninja/shared';

import { annoncesDuChangement } from '../annonces.js';
import type { Client } from '../client.js';
import type { Ecran } from '../ecrans.js';
import type { HorlogeClient } from '../horloge.js';
import { horlogeNavigateur } from '../horloge.js';
import { sonsDuChangement } from '../sons/declencheurs.js';
import type { LecteurDeSons } from '../sons/lecteur.js';
import { monterAide } from './composants/aide.js';
import { monterFilDAnnonces } from './composants/annonces.js';
import { monterCompteDeLEntete } from './composants/compte.js';
import { monterPanneauSon } from './composants/son.js';
import { bouton, creer, ecrireTexte } from './dom.js';
import { monterAccueil } from './ecrans/accueil.js';
import { monterConnexion } from './ecrans/connexion.js';
import { monterFin } from './ecrans/fin.js';
import { monterSalon } from './ecrans/salon.js';
import type { ContexteEcran, EcranAffiche, MonteurEcran } from './ecrans/types.js';

/** Ce qu'il faut pour monter l'application. */
export interface OptionsApplication {
  /** L'element de la page qui recoit l'application. */
  readonly hote: HTMLElement;
  readonly client: Client;
  /** L'ecran de jeu. Celui de ecrans/jeu.ts en production, un ecran d'essai dans les tests. */
  readonly monterLeJeu: MonteurEcran;
  readonly sons?: LecteurDeSons;
  readonly horloge?: HorlogeClient;
  /** Le stockage du navigateur, pour retenir les reglages du son. */
  readonly stockage?: Storage;
  /** Recharger la page. Celui du navigateur par defaut. */
  readonly recharger?: () => void;
}

/** L'application montee. */
export interface Application {
  demonter(): void;
}

/** Les ecrans de menu, et qui les monte. */
const MONTEURS_DE_MENU: Readonly<Record<Exclude<Ecran, 'jeu'>, MonteurEcran>> = {
  accueil: monterAccueil,
  connexion: monterConnexion,
  salon: monterSalon,
  fin: monterFin,
};

/** Le nom de chaque ecran, ecrit dans l'en-tete. Les libelles de la maquette. */
const LIBELLES_ECRAN: Readonly<Record<Ecran, string>> = {
  accueil: 'Accueil',
  connexion: 'Compte',
  salon: 'Salon',
  jeu: 'En jeu',
  fin: 'Résultats',
};

/** La musique d'un ecran: celle de la partie en jeu, celle des menus partout ailleurs. */
function musiqueDe(ecran: Ecran): PisteMusicale {
  return ecran === 'jeu' ? 'jeu' : 'menu';
}

/** Monte l'application dans la page, sur l'ecran que l'etat du client designe. */
export function monterApplication(options: OptionsApplication): Application {
  const doc = options.hote.ownerDocument;
  const { client, sons } = options;

  let ecranCourant: Ecran = client.etat.ecran;

  const aide = monterAide(doc);
  const panneauSon = monterPanneauSon({
    document: doc,
    sons,
    stockage: options.stockage,
    // Retablir le son relance la musique que la coupure avait arretee.
    surChangement: (preferences) => {
      if (!preferences.coupe) {
        sons?.demarrerLaMusique(musiqueDe(ecranCourant));
      }
    },
  });
  const annonces = monterFilDAnnonces(doc);
  const compte = monterCompteDeLEntete(doc, client);

  const libelle = creer(doc, 'span', { classe: 'marque-ecran' });
  const scene = creer(doc, 'main', { classe: 'scene-ecran' });

  const racine = creer(
    doc,
    'div',
    { classe: 'application' },
    creer(
      doc,
      'header',
      { classe: 'entete' },
      creer(
        doc,
        'div',
        { classe: 'marque' },
        creer(doc, 'span', { classe: 'logo', texte: '忍', attributs: { 'aria-hidden': 'true' } }),
        creer(
          doc,
          'span',
          { classe: 'marque-nom' },
          creer(doc, 'span', { texte: 'NEON' }),
          creer(doc, 'span', { classe: 'accent', texte: 'NINJA' }),
        ),
        libelle,
      ),
      creer(
        doc,
        'div',
        { classe: 'entete-actions' },
        compte.racine,
        bouton(
          doc,
          { classe: 'bouton-icone', icone: 'keyboard', etiquette: 'Aide et commandes' },
          () => {
            aide.ouvrir();
          },
        ),
        bouton(doc, { classe: 'bouton-icone', icone: 'son', etiquette: 'Son' }, () => {
          panneauSon.ouvrir();
        }),
      ),
    ),
    scene,
    annonces.racine,
    aide.racine,
    panneauSon.racine,
  );

  options.hote.append(racine);

  const contexte: ContexteEcran = {
    document: doc,
    client,
    horloge: options.horloge ?? horlogeNavigateur,
    sons,
    ouvrirAide: () => {
      aide.ouvrir();
    },
    ouvrirSon: () => {
      panneauSon.ouvrir();
    },
    recharger:
      options.recharger ??
      (() => {
        doc.defaultView?.location.reload();
      }),
  };

  /** Monte un ecran, l'installe dans la page, et lance sa musique. */
  const monter = (nom: Ecran): EcranAffiche => {
    const ecran = nom === 'jeu' ? options.monterLeJeu(contexte) : MONTEURS_DE_MENU[nom](contexte);

    scene.replaceChildren(ecran.racine);
    scene.scrollTop = 0;
    racine.dataset['ecran'] = nom;
    ecrireTexte(libelle, LIBELLES_ECRAN[nom]);
    sons?.demarrerLaMusique(musiqueDe(nom));

    return ecran;
  };

  let precedent = client.etat;
  let ecran = monter(ecranCourant);
  ecran.afficher(precedent);
  compte.afficher(precedent);

  const surChangement = (): void => {
    const etat = client.etat;

    if (etat.ecran !== ecranCourant) {
      // Demonter d'abord: l'ecran de jeu coupe tous les sons en partant, et la
      // musique du nouvel ecran doit partir apres cette coupure, pas avant.
      ecran.demonter();
      ecranCourant = etat.ecran;
      ecran = monter(ecranCourant);
    }

    ecran.afficher(etat);
    compte.afficher(etat);

    if (sons !== undefined && !(precedent.ecran === 'jeu' && etat.ecran === 'jeu')) {
      for (const nom of sonsDuChangement(precedent, etat)) {
        sons.jouer(nom);
      }
    }

    for (const annonce of annoncesDuChangement(precedent, etat)) {
      annonces.ajouter(annonce);
    }

    precedent = etat;
  };

  const desabonner = client.abonner(surChangement);

  // Le clic des boutons, comme dans les menus du jeu d'origine.
  const surClic = (evenement: MouseEvent): void => {
    if (evenement.target instanceof Element && evenement.target.closest('button') !== null) {
      sons?.jouer('clic');
    }
  };

  // Aucun navigateur ne laisse une page jouer du son avant un premier geste de
  // l'utilisateur. La musique demandee au montage a donc ete refusee: on la
  // redemande au premier geste, une seule fois.
  const deverrouillerLeSon = (): void => {
    sons?.demarrerLaMusique(musiqueDe(ecranCourant));
    doc.removeEventListener('pointerdown', deverrouillerLeSon);
    doc.removeEventListener('keydown', deverrouillerLeSon);
  };

  racine.addEventListener('click', surClic);
  doc.addEventListener('pointerdown', deverrouillerLeSon);
  doc.addEventListener('keydown', deverrouillerLeSon);

  return {
    demonter() {
      desabonner();
      racine.removeEventListener('click', surClic);
      doc.removeEventListener('pointerdown', deverrouillerLeSon);
      doc.removeEventListener('keydown', deverrouillerLeSon);
      ecran.demonter();
      compte.demonter();
      aide.demonter();
      panneauSon.demonter();
      annonces.demonter();
      racine.remove();
    },
  };
}
