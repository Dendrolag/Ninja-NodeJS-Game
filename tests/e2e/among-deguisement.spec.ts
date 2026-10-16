import type { Page } from '@playwright/test';
import { devices, expect, test } from '@playwright/test';
import type { Socket } from 'socket.io-client';
import { io } from 'socket.io-client';

import type {
  EvenementsClientVersServeur,
  EvenementsServeurVersClient,
  InstantanePartie,
  Position,
} from '../../packages/shared/dist/index.js';
import { COULEUR_DE_LA_FOULE, appliquerTrame } from '../../packages/shared/dist/index.js';
import type { GameRoom } from '../../packages/server/dist/index.js';
import { commandeAuClavier } from './harnais/commandes.js';
import {
  attendreLaPartie,
  entrer,
  joueurNomme,
  lancer,
  regler,
  releverLesErreurs,
} from './harnais/parcours.js';
import type { Commande } from './harnais/pilote.js';
import { accomplir } from './harnais/pilote.js';
import type { ServeurDeJeu } from './harnais/serveur-de-jeu.js';
import { demarrerLeJeu } from './harnais/serveur-de-jeu.js';

/**
 * Le deguisement en PNJ d'Among Ninjas (etape 7.28), joue de bout en bout: l'assassin d'une page
 * tue un PNJ et en prend l'apparence, et l'autre page, une proie, ne le voit plus que comme un PNJ
 * gris, sous un alias, sans que ses trames le nomment.
 *
 * Alice cree la partie, Bob la rejoint, trois clients sans page completent les cinq. L'assassin
 * se tire au lancement, foule comprise: page ou client du reseau, il agit, et une page proie
 * temoigne. Le scenario lit dans le serveur ou sont les PNJ, et n'y ecrit jamais.
 */

/** La graine du scenario: une partie reproductible. */
const GRAINE = 4;

/** Une foule assez nombreuse pour qu'un PNJ passe pres du point de reunion. */
const PARTIE = {
  'among.dureeDuTourS': '300',
  'among.tachesParProie': '3',
  'among.foule': '40',
} as const;

type ClientDuReseau = Socket<EvenementsServeurVersClient, EvenementsClientVersServeur>;

let jeu: ServeurDeJeu;
const clients: ClientDuReseau[] = [];

test.beforeEach(async () => {
  jeu = await demarrerLeJeu({ graine: GRAINE });
});

test.afterEach(async () => {
  for (const client of clients.splice(0)) {
    client.disconnect();
  }

  await jeu.arreter();
});

/** Fait entrer un client sans page dans la partie, par son identifiant. */
async function entrerParLeReseau(pseudo: string, idRoom: string): Promise<ClientDuReseau> {
  const client: ClientDuReseau = io(jeu.url, { transports: ['websocket'], forceNew: true });
  clients.push(client);

  await new Promise<void>((resoudre, rejeter) => {
    client.on('connect', () => {
      client.emit('rejoindre', { pseudo, idRoom }, (reponse) => {
        if (reponse.valide) {
          resoudre();
        } else {
          rejeter(new Error(`${pseudo} refuse: ${JSON.stringify(reponse.erreurs)}`));
        }
      });
    });
  });

  return client;
}

/** La commande d'un client sans page: la meme intention que celle qu'envoie la page. */
function commandeDuReseau(client: ClientDuReseau): Commande {
  return {
    orienter: async (direction) => {
      client.emit('deplacer', { deplacement: direction, enMouvement: true });
      await Promise.resolve();
    },
    relacher: async () => {
      client.emit('deplacer', { deplacement: { x: 0, y: 0 }, enMouvement: false });
      await Promise.resolve();
    },
  };
}

/** Relit les trames d'etat que recoit une page, comme elle, et garde la derniere. */
function suivreLesTrames(page: Page): { derniere: InstantanePartie | undefined } {
  const suivi: { derniere: InstantanePartie | undefined } = { derniere: undefined };

  page.on('websocket', (ws) => {
    ws.on('framereceived', (trame) => {
      if (typeof trame.payload === 'string') {
        return;
      }

      try {
        suivi.derniere = appliquerTrame(suivi.derniere, trame.payload) ?? suivi.derniere;
      } catch {
        suivi.derniere = undefined;
      }
    });
  });

  return suivi;
}

/** Le PNJ le plus proche de cette place, lu dans le serveur. */
function pnjLePlusProche(partie: GameRoom, ici: Position): Position | undefined {
  let retenu: Position | undefined;
  let distance = Number.POSITIVE_INFINITY;

  for (const bot of Object.values(partie.etat.bots)) {
    const d = Math.hypot(bot.position.x - ici.x, bot.position.y - ici.y);

    if (bot.type === 'bot' && d < distance) {
      retenu = bot.position;
      distance = d;
    }
  }

  return retenu;
}

test('un assassin tue un PNJ et devient un PNJ gris pour une autre page', async ({ browser }) => {
  test.setTimeout(240_000);

  const ordinateur = { ...devices['Desktop Chrome'], viewport: { width: 1000, height: 560 } };
  const alice = await (await browser.newContext(ordinateur)).newPage();
  const bob = await (await browser.newContext(ordinateur)).newPage();
  const erreurs = [...[alice, bob].map((page) => releverLesErreurs(page))];
  const trames = new Map([
    [alice, suivreLesTrames(alice)],
    [bob, suivreLesTrames(bob)],
  ]);

  await alice.goto(jeu.url);
  await alice.getByPlaceholder('Votre pseudo').fill('Alice');
  await alice.getByRole('button', { name: 'Créer une partie' }).click();
  await alice.locator('label.tuile-choix[data-mode="among"]').click();
  await alice.getByRole('button', { name: 'Créer le salon' }).click();
  await expect(alice.getByRole('heading', { name: 'Salon de Alice' })).toBeVisible();
  await entrer(bob, jeu.url, 'Bob');
  const partie = jeu.partie();
  for (const pseudo of ['Carole', 'David', 'Eve']) {
    await entrerParLeReseau(pseudo, partie.id);
  }

  await regler(alice, PARTIE);
  await lancer(alice);
  await expect.poll(() => partie.etat.among?.phase, { timeout: 15_000 }).toBe('chargement');
  for (const client of clients) {
    client.emit('carteChargee');
  }
  await Promise.all([attendreLaPartie(alice), attendreLaPartie(bob)]);
  await expect.poll(() => partie.etat.among?.phase, { timeout: 15_000 }).toBe('jeu');

  // Qui est assassin se tire au lancement, foule comprise: il agit, page ou client du reseau, et
  // une page proie temoigne.
  const pages: Readonly<Record<string, Page>> = { Alice: alice, Bob: bob };
  const reseau: Readonly<Record<string, ClientDuReseau>> = {
    Carole: clients[0] as ClientDuReseau,
    David: clients[1] as ClientDuReseau,
    Eve: clients[2] as ClientDuReseau,
  };
  const roleDe = (pseudo: string) =>
    partie.etat.among?.joueurs[joueurNomme(partie, pseudo).id]?.role;
  const assassin = [...Object.keys(pages), ...Object.keys(reseau)].find(
    (pseudo) => roleDe(pseudo) === 'tueur',
  ) as string;
  const temoin = Object.keys(pages).find((pseudo) => roleDe(pseudo) === 'proie') as string;
  const pageDuTemoin = pages[temoin] as Page;
  const tramesDuTemoin = trames.get(pageDuTemoin) as { derniere: InstantanePartie | undefined };
  const idAssassin = joueurNomme(partie, assassin).id;
  const deguise = () => partie.etat.among?.joueurs[idAssassin]?.deguisementMs !== undefined;
  const pageDeLAssassin = pages[assassin];
  const clientDeLAssassin = reseau[assassin];
  const commande =
    pageDeLAssassin === undefined
      ? commandeDuReseau(clientDeLAssassin as ClientDuReseau)
      : commandeAuClavier(pageDeLAssassin);
  const frapper = async (): Promise<void> => {
    if (pageDeLAssassin === undefined) {
      clientDeLAssassin?.emit('capturer');
    } else {
      await pageDeLAssassin.keyboard.press(' ');
    }
  };

  // La recharge du debut de tour passee, l'assassin va au contact du PNJ le plus proche et frappe.
  await expect
    .poll(() => partie.etat.among?.joueurs[idAssassin]?.rechargeMs, { timeout: 15_000 })
    .toBe(0);
  const ici = () => joueurNomme(partie, assassin).position;

  await accomplir({
    nom: `${assassin} tue un PNJ`,
    commande,
    delaiMs: 90_000,
    situation: () => ({
      terrain: partie.etat.terrain,
      position: ici(),
      cibles: [pnjLePlusProche(partie, ici()) ?? ici()],
    }),
    accomplie: deguise,
    affut: {
      distancePx: 14,
      guetter: async () => {
        const cible = pnjLePlusProche(partie, ici());

        if (cible !== undefined && Math.hypot(cible.x - ici().x, cible.y - ici().y) <= 26) {
          await frapper();
        }
      },
    },
  });
  await commande.relacher();

  // L'assassin d'une page lit son temps dans le bouton Habit.
  if (pageDeLAssassin !== undefined) {
    await expect(pageDeLAssassin.locator('.hud-habit')).toBeVisible();
    await expect(pageDeLAssassin.locator('.hud-habit')).toContainText(/\d+ s/u);
  }

  // Le temoin: ses trames ne nomment plus l'assassin, tant qu'il est deguise, et s'il le voit,
  // un PNJ gris se tient a sa place.
  await expect
    .poll(
      () => {
        const vue = tramesDuTemoin.derniere;

        if (vue === undefined || !deguise()) {
          return 'attente';
        }

        return vue.entites.some((entite) => entite.id === idAssassin) ? 'nomme' : 'cache';
      },
      { timeout: 10_000 },
    )
    .toBe('cache');
  const vue = tramesDuTemoin.derniere as InstantanePartie;
  expect(JSON.stringify(vue.among ?? {})).not.toContain(idAssassin);
  const lui = ici();
  const aSaPlace = vue.entites.filter(
    (entite) => Math.hypot(entite.x - lui.x, entite.y - lui.y) <= 12,
  );
  const temoinIci = joueurNomme(partie, temoin).position;

  if (Math.hypot(temoinIci.x - lui.x, temoinIci.y - lui.y) < 200) {
    expect(aSaPlace.map((entite) => [entite.type, entite.couleur])).toContainEqual([
      'bot',
      COULEUR_DE_LA_FOULE,
    ]);
  }
  // Et le cadavre gris du PNJ est au sol, pour qui passe.
  expect(
    Object.values(partie.etat.among?.cadavres ?? {}).some((cadavre) => cadavre.pnj === true),
  ).toBe(true);

  for (const releve of erreurs) {
    expect(releve).toEqual([]);
  }
});
