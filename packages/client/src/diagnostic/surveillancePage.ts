/**
 * La surveillance d'une partie dans la page: la sonde branchée sur la boucle, PixiJS, le
 * réseau et le document, et le bulletin envoyé toutes les dix secondes (étape 5.15).
 *
 * TOUTES LES PARTIES, CHEZ TOUS LES JOUEURS. À la différence du relevé `?diagnostic=1`, qui
 * n'existe que sur demande, la surveillance accompagne chaque partie: c'est ce qui fait voir
 * une saccade sur un appareil que personne n'a sous la main. Elle reste discrète: ni panneau,
 * ni écriture dans le document, ni stockage, ni cookie, ni script tiers. Ce qu'elle mesure
 * part au serveur de jeu, sur le lien que la page a déjà, et nulle part ailleurs.
 *
 * Toutes les cinq secondes, un accusé de réception du serveur mesure l'aller et retour, et le
 * nombre de personnages dessinés est relevé; toutes les dix secondes, le bulletin part. Rien
 * à chaque image que ce que fait la sonde: quelques additions.
 *
 * L'APPAREIL SE DÉCRIT AU DÉBUT, PUIS UNE FOIS PAR MINUTE: le serveur oublie une connexion
 * coupée, et la page revenue après une coupure en ouvre une autre.
 *
 * CE FICHIER N'EST PAS COUVERT PAR LES TESTS UNITAIRES: il branche PixiJS et le document. La
 * sonde l'est (surveillance.test.ts), et le scénario de bout en bout
 * tests/e2e/surveillance.spec.ts vérifie qu'une partie jouée envoie ses bulletins.
 */

import { INTERVALLE_DE_LA_SONDE_MS, INTERVALLE_DU_BULLETIN_MS } from '@neon-ninja/shared';
import type { Application } from 'pixi.js';

import type { Client } from '../client.js';
import type { SondeDImage } from '../rendu/boucle.js';
import { compterLesVisibles } from './diagnostic.js';
import { SondeDeSurveillance, decrireLAppareil } from './surveillance.js';

/** Tous les combien de bulletins l'appareil se redécrit: une fois par minute. */
const BULLETINS_PAR_DESCRIPTION = 6;

/** Ce que la surveillance doit savoir d'une partie. */
export interface PartieSurveillee {
  readonly application: Application;
  readonly client: Client;
  readonly fenetre: Window;
  /** Le son joue-t-il en ce moment. */
  readonly son: () => boolean;
}

/** Une partie surveillée. */
export interface SurveillanceDePartie {
  /** À donner à la boucle de rendu. */
  readonly sonde: SondeDImage;
  /** L'écran de préparation vient de se lever: le joueur voit la partie. */
  leverLeRideau(): void;
  /** La partie est finie, ou quittée: plus rien ne part. */
  arreter(): void;
}

/** Surveille une partie, de son montage à son démontage. */
export function surveillerLaPartie(partie: PartieSurveillee): SurveillanceDePartie {
  const { application, client, fenetre } = partie;
  const doc = fenetre.document;
  const horloge = fenetre.performance;
  const sonde = new SondeDeSurveillance();
  const aRetirer: (() => void)[] = [];

  // PixiJS dessine par renderer.render, appelé depuis son propre minuteur: on le chronomètre
  // sans rien changer à ce qu'il fait, comme le relevé de l'étape 8.5.
  const renderer = application.renderer;
  const rendre = renderer.render.bind(renderer);
  renderer.render = ((...parametres: Parameters<typeof rendre>) => {
    const avant = horloge.now();
    rendre(...parametres);
    sonde.ajouterPixi(horloge.now() - avant);
  }) as typeof renderer.render;

  // Un instantané arrive quand le battement de la partie change.
  let battement = client.etat.partie?.tick;
  aRetirer.push(
    client.abonner((etat) => {
      const tick = etat.partie?.tick;

      if (tick !== undefined && tick !== battement) {
        battement = tick;
        sonde.instantane(horloge.now());
      }
    }),
  );

  const surVisibilite = (): void => {
    sonde.visibilite(doc.visibilityState !== 'hidden');
  };
  doc.addEventListener('visibilitychange', surVisibilite);
  aRetirer.push(() => {
    doc.removeEventListener('visibilitychange', surVisibilite);
  });
  surVisibilite();

  const surErreur = (): void => {
    sonde.erreur('script');
  };
  const surRejet = (): void => {
    sonde.erreur('promesse');
  };
  fenetre.addEventListener('error', surErreur);
  fenetre.addEventListener('unhandledrejection', surRejet);
  aRetirer.push(() => {
    fenetre.removeEventListener('error', surErreur);
    fenetre.removeEventListener('unhandledrejection', surRejet);
  });

  const personnages = application.stage.getChildByLabel('personnages', true);
  const decrire = (): void => {
    const navigateur = fenetre.navigator as Navigator & { readonly deviceMemory?: number };
    client.decrireLAppareil(
      decrireLAppareil({
        agent: navigateur.userAgent,
        tactile: fenetre.matchMedia('(pointer: coarse)').matches,
        largeur: fenetre.screen.width,
        hauteur: fenetre.screen.height,
        densite: fenetre.devicePixelRatio,
        ...(navigateur.hardwareConcurrency > 0 ? { coeurs: navigateur.hardwareConcurrency } : {}),
        ...(navigateur.deviceMemory === undefined ? {} : { memoireGo: navigateur.deviceMemory }),
        rendu: renderer.name,
      }),
    );
  };
  decrire();

  const sonder = fenetre.setInterval(() => {
    sonde.personnages(compterLesVisibles(personnages));
    const depart = horloge.now();
    client.sonder(() => {
      sonde.allerRetour(horloge.now() - depart);
    });
  }, INTERVALLE_DE_LA_SONDE_MS);

  let bulletins = 0;
  const envoyer = fenetre.setInterval(() => {
    if (!sonde.aDuNouveau) {
      return;
    }

    sonde.personnages(compterLesVisibles(personnages));
    client.envoyerUnBulletin(sonde.bulletin(partie.son()));
    bulletins += 1;

    if (bulletins % BULLETINS_PAR_DESCRIPTION === 0) {
      decrire();
    }
  }, INTERVALLE_DU_BULLETIN_MS);

  aRetirer.push(() => {
    fenetre.clearInterval(sonder);
    fenetre.clearInterval(envoyer);
  });

  return {
    sonde,

    leverLeRideau() {
      sonde.leverLeRideau();
    },

    arreter() {
      for (const retirer of aRetirer.splice(0).reverse()) {
        retirer();
      }
    },
  };
}
