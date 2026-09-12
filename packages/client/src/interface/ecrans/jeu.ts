/**
 * L'ecran de jeu: l'assemblage du rendu, du HUD, des controles et du son.
 *
 * TOUT CE QUI EST ICI EXISTAIT DEJA. L'etape 4.2 a livre le rendu, la surcouche,
 * la saisie et le son comme des pieces separees et testees; cet ecran ne fait que
 * les monter dans l'ordre, les relier, et savoir tout demonter en partant. Il ne
 * contient aucune regle.
 *
 * LE MONTAGE EST ASYNCHRONE, ET PEUT ETRE INTERROMPU. Charger les images de la
 * carte prend un instant. Si la partie se termine ou si le joueur quitte pendant
 * ce temps, l'ecran est demonte avant d'etre pret: chaque etape verifie donc
 * qu'il est toujours vivant avant de poser quoi que ce soit, et tout ce qui a ete
 * pose est retenu pour etre retire.
 *
 * LE BOUTON « TERMINER » DE LA MAQUETTE N'EST PAS REPRIS TEL QUEL (tension 7 du
 * journal de conception, tranchee le 10 septembre 2026). Terminer la partie pour
 * tout le monde n'existe pas dans le contrat, et donnerait a un joueur un pouvoir
 * sur la partie des autres. L'ecran propose ce qui existe: quitter la partie pour
 * soi, apres confirmation, et la pause, reservee a l'hote comme au serveur.
 *
 * DANS UNE PARTIE TACTIQUE (etape 7.1), la barre d'espace tire, et la surcouche pose
 * le bouton de capture avec les charges. Le mode est lu dans le salon, fige depuis la
 * creation de la partie.
 *
 * CE FICHIER N'EST PAS COUVERT PAR LES TESTS UNITAIRES: il monte PixiJS, qui a
 * besoin d'un vrai navigateur. Il est joue par les scenarios de bout en bout: la
 * navigation (tests/e2e/navigation.spec.ts), et des parties entieres, au clavier
 * et au pouce, dans parcours-solo.spec.ts et multijoueur.spec.ts. L'application,
 * elle, est testee avec un ecran de jeu d'essai.
 */

import { CARTES, REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';

import { brancherClavier } from '../../controles/clavier.js';
import { Controles } from '../../controles/controles.js';
import { brancherTactile } from '../../controles/tactile.js';
import { monterSurcouche } from '../../hud/surcouche.js';
import { lancerLaBoucle } from '../../rendu/boucle.js';
import { monterRendu, prechargerLesSprites } from '../../rendu/pixi.js';
import { jeSuisHote } from '../../selecteurs.js';
import { monterFenetre } from '../composants/fenetre.js';
import { bouton, creer, ecrireTexte, montrer } from '../dom.js';
import type { ContexteEcran, EcranAffiche } from './types.js';

/** Monte l'ecran de jeu. Le terrain apparait des que la carte est chargee. */
export function monterJeu(contexte: ContexteEcran): EcranAffiche {
  const doc = contexte.document;
  const navigateur = doc.defaultView;
  const client = contexte.client;

  // Les reglages sont figes au lancement: ceux du salon sont ceux de la partie.
  const reglages = client.etat.salon?.reglages ?? REGLAGES_PAR_DEFAUT;
  const carte = CARTES[reglages.carte];
  const tactique = client.etat.salon?.mode === 'tactique';

  const controles = new Controles();
  controles.reinitialiser();

  const terrain = creer(doc, 'div', { classe: 'terrain' });
  const zoneHud = creer(doc, 'div', { classe: 'zone-hud' });
  const chargement = creer(doc, 'p', {
    classe: 'jeu-chargement',
    texte: 'Chargement de la carte…',
    attributs: { role: 'status' },
  });

  const pause = bouton(
    doc,
    { classe: 'bouton bouton-secondaire', texte: 'Pause', icone: 'pause' },
    () => {
      client.mettreEnPause();
    },
  );
  const reprendre = bouton(
    doc,
    { classe: 'bouton bouton-primaire', texte: 'Reprendre', icone: 'play' },
    () => {
      client.reprendre();
    },
  );
  pause.hidden = true;
  reprendre.hidden = true;

  const confirmation = monterFenetre({
    document: doc,
    titre: 'Quitter la partie ?',
    classe: 'fenetre-confirmation',
  });
  confirmation.corps.append(
    creer(doc, 'p', {
      texte:
        'Vous quitterez la partie en cours et reviendrez à l’accueil. Vous ne pourrez pas la rejoindre de nouveau.',
    }),
  );
  confirmation.pied.append(
    bouton(doc, { classe: 'bouton bouton-secondaire', texte: 'Rester' }, () => {
      confirmation.fermer();
    }),
    bouton(doc, { classe: 'bouton bouton-danger', texte: 'Quitter', icone: 'stop' }, () => {
      confirmation.fermer();
      client.quitter();
    }),
  );

  const actions = creer(
    doc,
    'div',
    { classe: 'jeu-actions' },
    creer(doc, 'span', {
      classe: 'jeu-rappel',
      texte: tactique
        ? 'ZQSD ou flèches · Espace pour capturer · F pour vous localiser'
        : 'ZQSD ou flèches · F pour vous localiser',
    }),
    bouton(
      doc,
      { classe: 'bouton-icone jeu-localiser', icone: 'target', etiquette: 'Localiser mon ninja' },
      () => {
        controles.demanderLaLocalisation();
      },
    ),
    bouton(doc, { classe: 'bouton-icone', icone: 'son', etiquette: 'Son' }, contexte.ouvrirSon),
    pause,
    reprendre,
    bouton(doc, { classe: 'bouton bouton-danger', texte: 'Quitter', icone: 'stop' }, () => {
      confirmation.ouvrir();
    }),
  );

  const racine = creer(
    doc,
    'section',
    { classe: 'ecran ecran-jeu' },
    terrain,
    zoneHud,
    chargement,
    actions,
    confirmation.racine,
  );

  /** Ce qu'il faudra retirer en partant, dans l'ordre inverse de la pose. */
  const aRetirer: (() => void)[] = [];
  let vivant = true;

  const assembler = async (): Promise<void> => {
    // PixiJS mesure un texte a sa creation: la police des libelles de zone doit
    // etre chargee avant, sans quoi ils resteraient dans la police de secours.
    try {
      await doc.fonts.load('600 20px "Chakra Petch"');
    } catch {
      // Sans la police, les libelles prennent celle de secours. Rien de bloquant.
    }

    await prechargerLesSprites();

    if (!vivant) {
      return;
    }

    const rendu = await monterRendu({
      hote: terrain,
      carte,
      identifiantCarte: reglages.carte,
      modeMiroir: reglages.modeMiroir,
    });

    if (!vivant) {
      rendu.detruire();
      return;
    }

    aRetirer.push(() => {
      rendu.detruire();
    });

    await rendu.chargerLeDecor();

    if (!vivant) {
      return;
    }

    const surcouche = monterSurcouche({
      hote: zoneHud,
      carte,
      document: doc,
      ...(tactique
        ? {
            capturer: () => {
              controles.demanderUnTir();
            },
          }
        : {}),
    });
    aRetirer.push(() => {
      surcouche.demonter();
    });

    aRetirer.push(
      brancherClavier(controles, { cible: doc, fenetre: navigateur ?? doc, capture: tactique }),
    );
    aRetirer.push(
      brancherTactile(terrain, controles, {
        surChangement: (manette) => {
          surcouche.afficherLaManette(manette);
        },
      }),
    );

    const boucle = lancerLaBoucle({
      client,
      rendu,
      controles,
      horloge: contexte.horloge,
      carte,
      surcouche,
      ...(contexte.sons === undefined ? {} : { sons: contexte.sons }),
      mobile: navigateur?.matchMedia('(pointer: coarse)').matches ?? false,
      taille: () => ({ largeur: terrain.clientWidth, hauteur: terrain.clientHeight }),
    });
    aRetirer.push(() => {
      boucle.arreter();
    });

    const redimensionner = (): void => {
      rendu.redimensionner(terrain.clientWidth, terrain.clientHeight);
    };

    navigateur?.addEventListener('resize', redimensionner);
    aRetirer.push(() => {
      navigateur?.removeEventListener('resize', redimensionner);
    });

    montrer(chargement, false);
  };

  assembler().catch((erreur: unknown) => {
    // Une erreur apres le depart du joueur est la consequence du demontage, pas
    // un incident: les images arrivees trop tard tombent sur un rendu detruit.
    if (!vivant) {
      return;
    }

    ecrireTexte(chargement, 'Impossible d’afficher la partie. Rechargez la page.');
    console.error('Le montage de la partie a echoue.', erreur);
  });

  return {
    racine,

    afficher(etat) {
      const hote = jeSuisHote(etat);
      const enPause = etat.partie?.enPause === true;

      montrer(pause, hote && !enPause);
      montrer(reprendre, hote && enPause);
    },

    demonter() {
      vivant = false;

      for (const retirer of aRetirer.splice(0).reverse()) {
        retirer();
      }

      confirmation.demonter();
      racine.remove();
    },
  };
}
