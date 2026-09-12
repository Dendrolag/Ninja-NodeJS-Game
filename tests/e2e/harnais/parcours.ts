/**
 * Les gestes communs aux parcours de bout en bout, et ce qu'on lit dans le serveur.
 *
 * Deux familles, separees a dessein:
 *
 *   - LES GESTES D'UN JOUEUR dans la page: entrer, regler la partie, la lancer,
 *     attendre la partie et sa fin, lire le classement affiche. Ils ne passent que
 *     par ce qu'une personne voit et touche: des roles, des libelles, des champs.
 *   - LES LECTURES DU SERVEUR, l'arbitre: ou est tel joueur, que vaut le
 *     classement, et les missions du pilote qui en decoulent. Elles ne changent
 *     jamais rien a la partie.
 */

import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

import type { GameRoom } from '../../../packages/server/dist/index.js';
import type { Joueur } from '../../../packages/sim/dist/index.js';
import type { Commande, Mission } from './pilote.js';

/** Des reglages a saisir dans le panneau, par chemin: un nombre en texte, ou un interrupteur. */
export type SaisieDeReglages = Readonly<Record<string, string | boolean>>;

/**
 * Temps laisse a un joueur pour capturer un faux ninja, en millisecondes.
 *
 * Avec cent faux ninjas sur la carte, il en faut en general une a deux secondes.
 * La marge couvre une machine d'integration continue lente.
 */
const DELAI_CAPTURE_DE_BOT_MS = 12_000;

/**
 * Temps laisse a un joueur pour en rejoindre un autre, d'un bout a l'autre de la carte.
 *
 * Quarante secondes, pour une partie d'une minute: en integration continue, les
 * pages dessinent a quelques images par seconde et chaque commande part en retard.
 */
const DELAI_CONTACT_MS = 40_000;

// ---------------------------------------------------------------------------
// Les gestes d'un joueur
// ---------------------------------------------------------------------------

/**
 * Releve les erreurs de la console et de la page, a verifier en fin de parcours.
 *
 * Le tableau rendu se remplit au fil du parcours. Une erreur de console signale
 * aussi toute ressource refusee par la politique de securite du contenu.
 */
export function releverLesErreurs(page: Page): readonly string[] {
  const erreurs: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      erreurs.push(message.text());
    }
  });
  page.on('pageerror', (erreur) => {
    erreurs.push(erreur.message);
  });

  return erreurs;
}

/**
 * Releve les annonces montrees au joueur, au moment ou elles apparaissent.
 *
 * UNE ANNONCE NE RESTE QUE TROIS SECONDES A L'ECRAN, puis s'efface. La chercher
 * dans la page apres coup ferait dependre le scenario de sa propre lenteur: sur une
 * machine chargee, le temps de constater une capture dans le serveur et de relacher
 * les commandes peut depasser la vie de l'annonce. Ce releve les note des qu'elles
 * entrent dans le document, comme un lecteur d'ecran les entend: leur zone est une
 * region vivante.
 *
 * A appeler avant d'ouvrir l'adresse du jeu: l'observateur est pose a chaque
 * chargement de la page. Il ne fait qu'observer, il ne change rien a la page.
 */
export async function releverLesAnnonces(page: Page): Promise<readonly string[]> {
  const annonces: string[] = [];

  await page.exposeFunction('noterUneAnnonce', (texte: string) => {
    annonces.push(texte);
  });

  await page.addInitScript(() => {
    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const noeud of Array.from(mutation.addedNodes)) {
          if (noeud instanceof HTMLElement && noeud.classList.contains('annonce')) {
            const releve = window as unknown as { noterUneAnnonce(texte: string): Promise<void> };
            void releve.noterUneAnnonce(noeud.textContent ?? '');
          }
        }
      }
    }).observe(document, { childList: true, subtree: true });
  });

  return annonces;
}

/** Ce qu'une page dit d'elle-meme a un instant, en une phrase lisible. */
export type SignesVitaux = () => Promise<string>;

/** Combien d'avertissements et d'erreurs de la page un bilan retient, les plus recents. */
const MESSAGES_RETENUS = 8;

/** Au-dela de ce delai, une page qui ne repond plus est declaree comme telle. */
const DELAI_DE_LECTURE_MS = 3_000;

/**
 * Releve les signes vitaux d'une page, pour qu'un echec se comprenne sans rejouer.
 *
 * UNE PAGE LENTE ET UNE PAGE ARRETEE NE SE DISTINGUENT PAS DEPUIS LE SERVEUR: dans
 * les deux cas, le joueur ne bouge pas. Or le client n'emet la direction demandee
 * qu'a chaque image dessinee. Le bilan dit donc combien d'images la page a dessinees
 * pendant les deux dernieres secondes, depuis quand elle n'en a plus dessine, quels
 * contacts tactiles elle a recus, si la manette se croit tenue, quel ecran elle
 * montre, et ses derniers avertissements et erreurs.
 *
 * A appeler avant d'ouvrir l'adresse du jeu: l'observateur est pose a chaque
 * chargement. Il ne fait qu'observer, il ne change rien a la page.
 */
export async function releverLesSignesVitaux(page: Page): Promise<SignesVitaux> {
  const messages: string[] = [];
  const retenir = (message: string): void => {
    messages.push(message);
    messages.splice(0, Math.max(messages.length - MESSAGES_RETENUS, 0));
  };

  page.on('console', (message) => {
    if (message.type() === 'warning' || message.type() === 'error') {
      retenir(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (erreur) => {
    retenir(`exception: ${erreur.message}`);
  });

  await page.addInitScript(() => {
    const vitaux = {
      images: [] as number[],
      contacts: { debut: 0, deplacement: 0, fin: 0, annulation: 0 },
    };
    (window as unknown as { signesVitaux: typeof vitaux }).signesVitaux = vitaux;

    const compter = (instant: number): void => {
      vitaux.images.push(instant);
      while ((vitaux.images[0] ?? instant) < instant - 2000) {
        vitaux.images.shift();
      }
      requestAnimationFrame(compter);
    };
    requestAnimationFrame(compter);

    const natures = {
      touchstart: 'debut',
      touchmove: 'deplacement',
      touchend: 'fin',
      touchcancel: 'annulation',
    } as const;
    for (const [evenement, nature] of Object.entries(natures)) {
      addEventListener(
        evenement,
        () => {
          vitaux.contacts[nature] += 1;
        },
        true,
      );
    }
  });

  return async () => {
    const lecture = page.evaluate(() => {
      const vitaux = (
        window as unknown as {
          signesVitaux: { images: number[]; contacts: Record<string, number> };
        }
      ).signesVitaux;
      const maintenant = performance.now();
      const manette = document.querySelector<HTMLElement>('.hud-manette');

      return {
        images: vitaux.images.filter((instant) => instant >= maintenant - 2000).length,
        depuisLaDerniereMs: Math.round(maintenant - (vitaux.images.at(-1) ?? 0)),
        contacts: vitaux.contacts,
        manette: manette === null ? 'absente' : manette.hidden ? 'au repos' : 'tenue',
        ecran: document.querySelector('.application')?.getAttribute('data-ecran') ?? 'inconnu',
      };
    });

    const delai = new Promise<undefined>((resoudre) => {
      setTimeout(resoudre, DELAI_DE_LECTURE_MS);
    });
    const etat = await Promise.race([lecture.catch(() => undefined), delai]);
    const derniers = messages.length === 0 ? 'aucun' : messages.join(' | ');

    if (etat === undefined) {
      return `la page ne repond pas en ${String(DELAI_DE_LECTURE_MS)} ms; derniers messages: ${derniers}.`;
    }

    const { debut, deplacement, fin, annulation } = etat.contacts;

    return (
      `ecran ${etat.ecran}, ${String(etat.images)} images en 2 s, ` +
      `derniere image il y a ${String(etat.depuisLaDerniereMs)} ms, ` +
      `contacts recus ${String(debut)} debuts, ${String(deplacement)} deplacements, ` +
      `${String(fin)} fins, ${String(annulation)} annulations, manette ${etat.manette}; ` +
      `derniers messages: ${derniers}.`
    );
  };
}

/**
 * Joue une action, et si elle echoue, ajoute a l'erreur l'etat de chaque page.
 *
 * @param pages Les signes vitaux de chaque page, par nom de joueur.
 */
export async function expliquerLEchec(
  pages: Readonly<Record<string, SignesVitaux>>,
  action: () => Promise<void>,
): Promise<void> {
  try {
    await action();
  } catch (erreur) {
    const etats = await Promise.all(
      Object.entries(pages).map(async ([nom, signes]) => `Page de ${nom}: ${await signes()}`),
    );
    const message = erreur instanceof Error ? erreur.message : String(erreur);

    throw new Error([message, ...etats].join('\n'), { cause: erreur });
  }
}

/**
 * Ouvre la page, choisit un pseudo, et entre par la partie rapide: la premiere
 * partie publique en attente, ou une nouvelle.
 */
export async function entrer(page: Page, url: string, pseudo: string): Promise<void> {
  await page.goto(url);
  await page.getByPlaceholder('Votre pseudo').fill(pseudo);
  await page.getByRole('button', { name: 'Partie rapide' }).click();
  await expect(page.locator('.application')).toHaveAttribute('data-ecran', 'salon');
}

/**
 * Regle la partie par le panneau de l'hote, puis enregistre.
 *
 * Les interrupteurs sont bascules en cliquant leur libelle, comme le ferait un
 * joueur: la case elle-meme est cachee sous son dessin.
 */
export async function regler(page: Page, saisie: SaisieDeReglages): Promise<void> {
  await page.getByRole('button', { name: 'Réglages', exact: true }).click();
  const panneau = page.getByRole('dialog', { name: 'Réglages de la partie' });

  for (const [chemin, valeur] of Object.entries(saisie)) {
    const selecteur = `[data-chemin="${chemin}"]`;
    const champ = panneau.locator(selecteur);

    if (typeof valeur === 'string') {
      await champ.fill(valeur);
      continue;
    }

    if ((await champ.isChecked()) !== valeur) {
      // Le localisateur passe a « has » est cherche A L'INTERIEUR du libelle: il
      // ne doit pas reprendre le chemin du panneau, qui n'est pas dans le libelle.
      await panneau.locator('label.interrupteur', { has: page.locator(selecteur) }).click();
    }

    await expect(champ).toBeChecked({ checked: valeur });
  }

  await panneau.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(panneau).toBeHidden();
}

/** L'hote lance la partie. */
export async function lancer(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Lancer la partie' }).click();
}

/**
 * Attend que la partie soit jouable dans la page.
 *
 * Il ne suffit pas que l'ecran de jeu soit monte: le clavier et la manette ne sont
 * branches qu'une fois le decor de la carte charge, au moment ou le message de
 * chargement disparait. Une touche enfoncee avant serait perdue.
 */
export async function attendreLaPartie(page: Page): Promise<void> {
  await expect(page.locator('.application')).toHaveAttribute('data-ecran', 'jeu', {
    timeout: 15_000,
  });
  await expect(page.locator('.terrain canvas')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.jeu-chargement')).toBeHidden({ timeout: 20_000 });
  await expect(page.locator('.hud-temps')).toHaveText(/\d:\d\d/u);
}

/** Attend l'ecran de fin. Une partie courte dure trente secondes. */
export async function attendreLaFin(page: Page): Promise<void> {
  await expect(page.locator('.application')).toHaveAttribute('data-ecran', 'fin', {
    timeout: 60_000,
  });
}

/**
 * Le classement final tel que la page l'affiche, cellule par cellule.
 *
 * Rang, joueur, points, ninjas portes, captures, Black Ninjas detruits.
 */
export async function classementAffiche(page: Page): Promise<readonly (readonly string[])[]> {
  const rangees = page.locator('.fin-classement tbody tr');
  await expect(rangees).not.toHaveCount(0);

  return rangees.evaluateAll((elements) =>
    elements.map((rangee) =>
      Array.from((rangee as HTMLTableRowElement).cells, (cellule) =>
        (cellule.textContent ?? '').trim(),
      ),
    ),
  );
}

// ---------------------------------------------------------------------------
// Les lectures du serveur
// ---------------------------------------------------------------------------

/** Le joueur qui porte ce pseudo, tel que le serveur le connait. */
export function joueurNomme(partie: GameRoom, pseudo: string): Joueur {
  const joueur = Object.values(partie.etat.joueurs).find((candidat) => candidat.pseudo === pseudo);

  if (joueur === undefined) {
    throw new Error(`Aucun joueur ${pseudo} dans la partie ${partie.id}.`);
  }

  return joueur;
}

/**
 * Le classement du serveur, dans la forme ou la page l'affiche.
 *
 * A lire une fois la partie terminee: la boucle est arretee, l'etat ne bouge plus,
 * et c'est de cet etat que le classement final envoye aux joueurs a ete tire.
 */
export function classementDuServeur(partie: GameRoom): readonly (readonly string[])[] {
  return partie
    .classement()
    .map((ligne, index) => [
      String(index + 1),
      ligne.pseudo,
      String(ligne.points),
      String(ligne.botsPortes),
      String(ligne.captures),
      String(ligne.botsNoirsDetruits),
    ]);
}

/**
 * Mission: ce joueur capture au moins un faux ninja.
 *
 * Il vise les faux ninjas qui ne sont pas deja a sa couleur, et la mission est
 * accomplie quand le serveur lui en compte un.
 */
export function capturerUnFauxNinja(partie: GameRoom, pseudo: string, commande: Commande): Mission {
  return {
    nom: `${pseudo} capture un faux ninja`,
    commande,
    delaiMs: DELAI_CAPTURE_DE_BOT_MS,
    situation: () => {
      const joueur = joueurNomme(partie, pseudo);

      return {
        terrain: partie.etat.terrain,
        position: joueur.position,
        cibles: fauxNinjasAPrendre(partie, joueur),
      };
    },
    accomplie: () =>
      partie.classement().some((ligne) => ligne.pseudo === pseudo && ligne.botsPortes > 0),
  };
}

/**
 * Mission, dans le mode Tactique: ce joueur s'approche d'un faux ninja, a portee de tir.
 *
 * Elle est accomplie des qu'un faux ninja qui n'est pas a sa couleur est plus pres que
 * la distance donnee. Le pilote relache alors les commandes: le joueur s'arrete, et
 * regarde dans la direction de son dernier pas, c'est-a-dire vers sa cible. Le
 * toucher en route ne l'aurait pas capturee.
 */
export function approcherUnFauxNinja(
  partie: GameRoom,
  pseudo: string,
  commande: Commande,
  distancePx: number,
): Mission {
  return {
    nom: `${pseudo} s'approche d'un faux ninja`,
    commande,
    delaiMs: DELAI_CAPTURE_DE_BOT_MS,
    situation: () => {
      const joueur = joueurNomme(partie, pseudo);

      return {
        terrain: partie.etat.terrain,
        position: joueur.position,
        cibles: fauxNinjasAPrendre(partie, joueur),
      };
    },
    accomplie: () => {
      const joueur = joueurNomme(partie, pseudo);

      return fauxNinjasAPrendre(partie, joueur).some(
        (position) =>
          Math.hypot(position.x - joueur.position.x, position.y - joueur.position.y) < distancePx,
      );
    },
  };
}

/** Ou sont les faux ninjas que ce joueur peut encore prendre: ceux qui ne portent pas sa couleur. */
function fauxNinjasAPrendre(partie: GameRoom, joueur: Joueur): readonly Joueur['position'][] {
  return Object.values(partie.etat.bots)
    .filter((bot) => bot.type === 'bot' && bot.couleur !== joueur.couleur)
    .map((bot) => bot.position);
}

/**
 * Mission: ce joueur va au contact d'un autre, jusqu'a ce que l'objectif soit atteint.
 *
 * Qui capture qui n'est pas decide ici: quand les deux en ont le droit, le moteur
 * tire au sort. L'objectif est donc fourni par le scenario, qui lira ensuite le
 * resultat dans le serveur.
 */
export function allerAuContact(
  partie: GameRoom,
  pseudo: string,
  autre: string,
  commande: Commande,
  accomplie: () => boolean,
): Mission {
  return {
    nom: `${pseudo} va au contact de ${autre}`,
    commande,
    delaiMs: DELAI_CONTACT_MS,
    situation: () => ({
      terrain: partie.etat.terrain,
      position: joueurNomme(partie, pseudo).position,
      cibles: [joueurNomme(partie, autre).position],
    }),
    accomplie,
  };
}
