/**
 * Les deux facons de faire bouger un joueur dans la page: le clavier et le pouce.
 *
 * CE SONT DE VRAIES SAISIES. Le clavier envoie des evenements de touche au
 * navigateur, le pouce des evenements tactiles par le protocole de Chromium. Ils
 * traversent donc tout ce qu'un joueur traverse: les ecoutes du document, les
 * controles, le calcul de l'intention, le client, le reseau, et le moteur. Aucun
 * raccourci n'est pris, et c'est ce qui permet a un scenario de dire que le
 * clavier et la manette virtuelle marchent.
 */

import type { Page } from '@playwright/test';

import type { Vecteur } from '../../../packages/shared/dist/index.js';
import type { Commande } from './pilote.js';

/**
 * De combien le pouce s'ecarte du centre de la manette, en pixels d'ecran.
 *
 * Au-dela de la zone morte (un cinquieme du rayon de soixante pixels), et en deca
 * du bord, comme un pouce qui pousse franchement sans sortir du cercle.
 */
const COURSE_DU_POUCE_PX = 45;

/**
 * En deca de cet ecart d'angle, cinq degres, le pouce ne bouge pas.
 *
 * Chaque contact envoye attend l'accuse de reception de la page. Le pilote corrige
 * sa direction dix fois par seconde, d'un angle souvent infime: en integration
 * continue, ou une page dessine a quelques images par seconde, ces envois
 * etouffaient le pilote, qui ne relisait plus la situation qu'une fois en deux
 * secondes (signes vitaux du run 34522355452). Cinq degres de moins ne changent
 * rien au chemin, le pilote corrigeant de toute facon a l'instant suivant.
 */
const COSINUS_ECART_MINIMUM = Math.cos((5 * Math.PI) / 180);

/** Les fleches, une par direction. */
const FLECHES = {
  droite: 'ArrowRight',
  gauche: 'ArrowLeft',
  bas: 'ArrowDown',
  haut: 'ArrowUp',
} as const;

/**
 * Le clavier: les fleches enfoncees et relachees comme par un joueur.
 *
 * Un clavier ne donne que huit directions. La direction demandee est ramenee a la
 * plus proche d'entre elles, et le pilote corrige a chaque instant: le joueur
 * avance en zigzag leger, comme au clavier.
 *
 * Seules les touches qui changent sont enfoncees ou relachees: maintenir une
 * direction ne produit aucun evenement, comme un doigt qui reste sur la touche.
 */
export function commandeAuClavier(page: Page): Commande {
  const enfoncees = new Set<string>();

  const tenir = async (voulues: ReadonlySet<string>): Promise<void> => {
    for (const touche of [...enfoncees]) {
      if (!voulues.has(touche)) {
        await page.keyboard.up(touche);
        enfoncees.delete(touche);
      }
    }

    for (const touche of voulues) {
      if (!enfoncees.has(touche)) {
        await page.keyboard.down(touche);
        enfoncees.add(touche);
      }
    }
  };

  return {
    orienter: async (direction) => tenir(flechesVers(direction)),
    relacher: async () => tenir(new Set()),
  };
}

/**
 * Le pouce: la manette virtuelle, tenue au milieu du terrain.
 *
 * Le pouce se pose au centre du terrain, la ou la manette plante son centre, puis
 * glisse dans la direction demandee et y reste. Le relacher leve le doigt.
 *
 * Il faut une page emulee avec le tactile, comme celle du projet mobile: sans
 * cela, Chromium ignore les contacts.
 */
export async function commandeAuPouce(page: Page): Promise<Commande> {
  const terrain = await page.locator('.terrain').boundingBox();

  if (terrain === null) {
    throw new Error("Le terrain n'est pas affiche: aucun endroit ou poser le pouce.");
  }

  const centre = { x: terrain.x + terrain.width / 2, y: terrain.y + terrain.height / 2 };
  const protocole = await page.context().newCDPSession(page);
  /** Le doigt est-il pose. */
  let pose = false;
  /** La derniere direction reellement envoyee a la page, doigt pose. */
  let envoyee: Vecteur | undefined;

  const toucher = async (
    type: 'touchStart' | 'touchMove' | 'touchEnd',
    point?: { x: number; y: number },
  ): Promise<void> => {
    await protocole.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: point === undefined ? [] : [{ x: point.x, y: point.y }],
    });
  };

  return {
    async orienter(direction) {
      if (!pose) {
        pose = true;
        envoyee = undefined;
        await toucher('touchStart', centre);
      }

      if (envoyee !== undefined && produitScalaire(direction, envoyee) > COSINUS_ECART_MINIMUM) {
        return;
      }

      envoyee = direction;
      await toucher('touchMove', {
        x: Math.round(centre.x + direction.x * COURSE_DU_POUCE_PX),
        y: Math.round(centre.y + direction.y * COURSE_DU_POUCE_PX),
      });
    },

    async relacher() {
      if (pose) {
        pose = false;
        envoyee = undefined;
        await toucher('touchEnd');
      }
    },
  };
}

/** Le produit scalaire de deux vecteurs: le cosinus de leur ecart s'ils sont unitaires. */
function produitScalaire(un: Vecteur, autre: Vecteur): number {
  return un.x * autre.x + un.y * autre.y;
}

/** Les fleches de la direction de clavier la plus proche de celle demandee. */
function flechesVers(direction: Vecteur): ReadonlySet<string> {
  const huitieme = Math.PI / 4;
  const angle = Math.round(Math.atan2(direction.y, direction.x) / huitieme) * huitieme;
  const x = Math.round(Math.cos(angle));
  const y = Math.round(Math.sin(angle));
  const fleches = new Set<string>();

  if (x > 0) fleches.add(FLECHES.droite);
  if (x < 0) fleches.add(FLECHES.gauche);
  if (y > 0) fleches.add(FLECHES.bas);
  if (y < 0) fleches.add(FLECHES.haut);

  return fleches;
}
