import type { Page } from '@playwright/test';
import { devices, expect, test } from '@playwright/test';
import type { Socket } from 'socket.io-client';
import { io } from 'socket.io-client';

import type {
  EvenementsClientVersServeur,
  EvenementsServeurVersClient,
  InstantanePartie,
  PasEntendu,
  Position,
  Vecteur,
} from '../../packages/shared/dist/index.js';
import { appliquerTrame, estUneTacheLongue } from '../../packages/shared/dist/index.js';
import type { GameRoom } from '../../packages/server/dist/index.js';
import type { EtatAmong } from '../../packages/sim/dist/index.js';
import { positionTenable } from '../../packages/sim/dist/index.js';
import { commandeAuClavier } from './harnais/commandes.js';
import { faireLeGesteAuClavier, jouerLaBatailleAuClavier } from './harnais/gestes.js';
import {
  attendreLaFin,
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
 * Le mode Among Ninjas des etapes 7.20 a 7.24, joue de bout en bout.
 *
 * Alice cree la partie sur un ordinateur, Bob la rejoint sur un autre. Il faut cinq joueurs:
 * Carole, David et Eve entrent par le reseau, comme de vrais clients Socket.IO, sans page.
 * Cinq pages qui dessinent la carte a la fois, sur les deux processeurs de l'integration
 * continue, s'y priveraient de processeur au point de perdre leur lien (configuration
 * Playwright); trois clients sans page ne coutent presque rien. Ils ne trichent pas plus que
 * le pilote: ils parlent au serveur par le meme reseau et les memes messages que la page, et
 * le scenario n'ecrit jamais dans le serveur.
 *
 * CE QUI EST VERIFIE, DANS L'ORDRE DU PARCOURS.
 *
 *   1. A quatre, le salon dit qu'il faut cinq joueurs; au cinquieme, « Lancer » apparait.
 *   2. En jeu, chaque page lit son role, celui que le serveur a tire.
 *   3. Une proie, dans sa page, va a une station de sa liste et appuie sur E: la fenetre de la
 *      tache s'ouvre, elle en fait le geste au clavier, la tache est faite, la fenetre se ferme
 *      et la liste le dit (etape 7.21).
 *   3 bis. La carte plein ecran s'ouvre par M, montre nos taches, et se ferme par M.
 *   3 bis bis. La meme proie joue sa tache longue, une bataille navale, au clavier, jusqu'a la
 *      tache faite (etape 7.24).
 *   3 ter. L'assassin de la page coupe les neons depuis sa carte; la proie de la page voit
 *      l'alerte, va au boitier de la rue et le repare en tenant E (etape 7.22).
 *   3 quater. Une proie du reseau s'eloigne de la proie de la page, qui recoit ses pas hors de
 *      vue, sans jamais la voir dans les trames qui les portent (etape 7.23).
 *   4. L'assassin va au contact d'une proie et la tue.
 *   5. La proie de la page trouve le cadavre et le signale par E: la reunion s'ouvre dans les
 *      deux pages, titree par ce signalement.
 *   6. Le vote: les deux pages votent contre l'assassin en touchant sa place, les clients
 *      aussi. L'ejection le dit, un trait par vote, sans dire son role.
 *   7. L'assassin ejecte, les proies l'emportent: l'ecran de fin le dit.
 *
 * QUI EST ASSASSIN se tire au lancement, a la graine: le scenario lit le role de chacun dans
 * le serveur et distribue les gestes en consequence. Un seul assassin a cinq. Depuis l'etape
 * 7.22, la graine est fixee (GRAINE), pour que l'assassin soit une page et sabote.
 *
 * UN SEUL CADRAGE, le bureau: la table de reunion sur telephone est verifiee par les tests de
 * la page; ce scenario verifie la partie.
 */

/** Une partie qui ne s'arrete pas d'elle-meme pendant le scenario, et des reunions courtes. */
const PARTIE_AMONG = {
  'among.dureeDuTourS': '300',
  'among.discussionS': '15',
  'among.voteS': '30',
  'among.tachesParProie': '3',
  'among.foule': '0',
} as const;

/** Les joueurs sans page, entres par le reseau. */
const PSEUDOS_DU_RESEAU = ['Carole', 'David', 'Eve'] as const;

/** Un client du jeu sans page: les contrats vus a l'envers de ceux du serveur. */
type ClientDuReseau = Socket<EvenementsServeurVersClient, EvenementsClientVersServeur>;

/**
 * Ou s'arreter, en pixels: le pilote leve le pouce a la distance visee, et le joueur, qui glisse
 * encore le temps que la page et le serveur l'apprennent, doit etre arrete en deca de la
 * limite. Une station porte a 50 pixels, le signalement a 100.
 */
const STATION = { viseePx: 20, limitePx: 42 } as const;
const CADAVRE = { viseePx: 50, limitePx: 90 } as const;

/**
 * La distance d'affut de l'assassin, en pixels: il s'arrete face a sa victime, sans la
 * traverser, et frappe. Le meurtre porte a 32 pixels de centre a centre.
 */
const AFFUT_DU_MEURTRE_PX = 16;

/** Les places autour d'un but que le pilote vise, a ce rayon, en pixels. */
const RAYON_DES_PLACES_PX = 12;

/** Le temps laisse a chaque geste, en millisecondes: les pages dessinent lentement en CI. */
const DELAI_DU_GESTE_MS = 60_000;

/**
 * La graine des parties du scenario (etape 7.22). Le tirage des roles suit la graine et l'ordre
 * d'arrivee: avec celle-ci, Alice, la premiere arrivee, tire l'assassin, et c'est une page qui
 * sabote. Si le tirage change, le scenario le dit, et une autre graine se cherche.
 */
const GRAINE = 4;

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

/** L'etat du mode, lu dans le serveur. */
function among(partie: GameRoom): EtatAmong {
  const etat = partie.etat.among;

  if (etat === undefined) {
    throw new Error("La partie n'est pas une partie Among Ninjas.");
  }

  return etat;
}

/** Ce qu'une page a entendu dans une trame: les pas, et les entites qu'elle voyait alors. */
interface PasDUneTrame {
  readonly pas: readonly PasEntendu[];
  readonly vus: readonly string[];
}

/**
 * Relit les trames d'etat que recoit une page, comme elle (etape 7.23), et garde celles qui
 * portent des pas entendus. Seules les trames d'etat voyagent en binaire; une trame qui ne se
 * relit pas, faute de reference, attend l'image suivante.
 */
function ecouterLesPas(page: Page): PasDUneTrame[] {
  const entendus: PasDUneTrame[] = [];

  page.on('websocket', (ws) => {
    let detenue: InstantanePartie | undefined;

    ws.on('framereceived', (trame) => {
      if (typeof trame.payload === 'string') {
        return;
      }

      try {
        detenue = appliquerTrame(detenue, trame.payload) ?? detenue;
      } catch {
        detenue = undefined;
        return;
      }

      const pas = detenue?.among?.pas;

      if (pas !== undefined) {
        entendus.push({ pas, vus: detenue?.entites.map((entite) => entite.id) ?? [] });
      }
    });
  });

  return entendus;
}

/** La distance entre deux points. */
function distance(a: Position, b: Position): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Fait entrer un client sans page dans la partie publique, par son identifiant. */
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
    orienter: async (direction: Vecteur) => {
      client.emit('deplacer', { deplacement: direction, enMouvement: true });
      await Promise.resolve();
    },
    relacher: async () => {
      client.emit('deplacer', { deplacement: { x: 0, y: 0 }, enMouvement: false });
      await Promise.resolve();
    },
  };
}

/**
 * Les places ou un ninja tient, autour d'un but, tous les quatre pixels. Le pilote cherche son
 * chemin sur des mailles de huit pixels: un but colle a un mur, comme une station devant un
 * comptoir, peut tomber dans une maille impraticable, ou il ne trouverait aucun chemin.
 */
function placesAutour(partie: GameRoom, but: Position): readonly Position[] {
  const places: Position[] = [];

  for (let dy = -RAYON_DES_PLACES_PX; dy <= RAYON_DES_PLACES_PX; dy += 4) {
    for (let dx = -RAYON_DES_PLACES_PX; dx <= RAYON_DES_PLACES_PX; dx += 4) {
      const place = { x: but.x + dx, y: but.y + dy };

      if (
        Math.hypot(dx, dy) <= RAYON_DES_PLACES_PX &&
        positionTenable(partie.etat.terrain, place)
      ) {
        places.push(place);
      }
    }
  }

  return places.length === 0 ? [but] : places;
}

/**
 * Pilote ce joueur jusqu'a ce but, et l'y arrete a sa portee. C'est l'affut du pilote, sans
 * rien a guetter: le joueur s'arrete face au but, a la distance visee, en levant le pouce
 * d'autant plus tot qu'il a glisse a l'arret precedent, puis repart s'il s'est arrete trop
 * loin. Viser simplement le but le faisait passer au-dela quand la machine est chargee.
 */
async function allerEtSArreter(
  partie: GameRoom,
  pseudo: string,
  commande: Commande,
  but: () => Position,
  portee: { readonly viseePx: number; readonly limitePx: number },
): Promise<void> {
  const ici = () => joueurNomme(partie, pseudo).position;
  let avant = ici();

  await accomplir({
    nom: `${pseudo} va a ${JSON.stringify(but())}`,
    commande,
    delaiMs: DELAI_DU_GESTE_MS,
    situation: () => ({
      terrain: partie.etat.terrain,
      position: ici(),
      cibles: placesAutour(partie, but()),
    }),
    // Arrete, et a portee: le pilote relit la situation tous les dixiemes de seconde.
    accomplie: () => {
      const maintenant = ici();
      const arrete = distance(maintenant, avant) < 0.5;
      avant = maintenant;

      return arrete && distance(maintenant, but()) <= portee.limitePx;
    },
    affut: { distancePx: portee.viseePx, guetter: async () => Promise.resolve() },
  });
}

/** Le role que la page affiche dans son HUD. */
async function roleAffiche(page: Page): Promise<string> {
  const role = page.locator('.hud-among-role');
  await expect(role).toHaveText(/^(Assassin|Proie)$/iu);

  return ((await role.textContent()) ?? '').toLowerCase();
}

/**
 * Attend qu'une condition lue dans le serveur soit vraie. En cas d'echec, ce qui est attendu
 * peut se decrire a cet instant, avec ce que le serveur sait alors.
 */
async function attendreQue(
  condition: () => boolean,
  quoi: string | (() => string),
  delaiMs = 15_000,
): Promise<void> {
  try {
    await expect.poll(condition, { timeout: delaiMs }).toBe(true);
  } catch (erreur) {
    throw new Error(typeof quoi === 'string' ? quoi : quoi(), { cause: erreur });
  }
}

test('jouer une partie Among Ninjas a cinq, du salon a la victoire des proies', async ({
  browser,
}) => {
  // Deux chargements de carte, une tache et son geste, deux traversees de Tokyo, une reunion.
  test.setTimeout(300_000);

  // Des fenetres plus petites que celles d'un ordinateur ordinaire, mais au-dela du dernier seuil
  // de mise en page (960 pixels): Among Ninjas montre la meme part de la carte a toutes les
  // tailles, et deux pages qui dessinent sans carte graphique, comme en CI, y passent tout leur
  // temps a peindre des pixels. A 1280 sur 720, la page du temoin n'y dessinait qu'une image par
  // seconde, et chaque touche mettait deux secondes a passer (etape 5.15, premiere CI du mode).
  const ordinateur = { ...devices['Desktop Chrome'], viewport: { width: 1000, height: 560 } };
  const ordinateurA = await browser.newContext(ordinateur);
  const ordinateurB = await browser.newContext(ordinateur);
  const alice = await ordinateurA.newPage();
  const bob = await ordinateurB.newPage();
  const erreursDAlice = releverLesErreurs(alice);
  const erreursDeBob = releverLesErreurs(bob);
  const pages: Readonly<Record<string, Page>> = { Alice: alice, Bob: bob };
  const pasEntendus = new Map<Page, PasDUneTrame[]>([
    [alice, ecouterLesPas(alice)],
    [bob, ecouterLesPas(bob)],
  ]);
  // Les demandes de capture que chaque page envoie vraiment: un meurtre qui echoue le dit.
  const capturesEnvoyees = new Map<Page, number>();
  for (const page of [alice, bob]) {
    page.on('websocket', (ws) => {
      ws.on('framesent', (trame) => {
        if (typeof trame.payload === 'string' && trame.payload.includes('"capturer"')) {
          capturesEnvoyees.set(page, (capturesEnvoyees.get(page) ?? 0) + 1);
        }
      });
    });
  }

  try {
    // -- Le salon: Alice cree, Bob et trois clients arrivent ----------------------
    await alice.goto(jeu.url);
    await alice.getByPlaceholder('Votre pseudo').fill('Alice');
    await alice.getByRole('button', { name: 'Créer une partie' }).click();
    await alice.locator('label.tuile-choix[data-mode="among"]').click();
    await expect(alice.locator('.creation-recapitulatif h2')).toHaveText(/^Among Ninjas · /u);
    await alice.getByRole('button', { name: 'Créer le salon' }).click();
    await expect(alice.getByRole('heading', { name: 'Salon de Alice' })).toBeVisible();

    await entrer(bob, jeu.url, 'Bob');
    const partie = jeu.partie();
    const carole = await entrerParLeReseau('Carole', partie.id);
    const david = await entrerParLeReseau('David', partie.id);
    await expect(alice.getByRole('button', { name: 'Lancer la partie' })).toBeHidden();
    await expect(alice.locator('.salon-consigne')).toHaveText(
      'Il faut au moins 5 joueurs pour lancer une partie Among Ninjas.',
    );

    const eve = await entrerParLeReseau('Eve', partie.id);
    const reseau: Readonly<Record<string, ClientDuReseau>> = {
      Carole: carole,
      David: david,
      Eve: eve,
    };
    await expect(alice.getByRole('button', { name: 'Lancer la partie' })).toBeVisible();

    // -- Le lancement, et le role de chacun ---------------------------------------
    await regler(alice, PARTIE_AMONG);
    await lancer(alice);
    // Les clients sans page disent avoir charge la carte, comme une page le fait des que la
    // sienne s'affiche: la revelation attend tout le monde. Une fois la partie lancee, apres
    // le compte a rebours: avant, le serveur ignore le signal.
    await expect.poll(() => partie.etat.among?.phase, { timeout: 15_000 }).toBe('chargement');
    for (const client of Object.values(reseau)) {
      client.emit('carteChargee');
    }
    await Promise.all([attendreLaPartie(alice), attendreLaPartie(bob)]);
    expect(partie.mode).toBe('among');

    const roleDe = (pseudo: string) => among(partie).joueurs[joueurNomme(partie, pseudo).id]?.role;
    const tous = ['Alice', 'Bob', ...PSEUDOS_DU_RESEAU];
    const assassins = tous.filter((pseudo) => roleDe(pseudo) === 'tueur');
    expect(assassins).toHaveLength(1);
    const assassin = assassins[0] as string;

    for (const [pseudo, page] of Object.entries(pages)) {
      expect(await roleAffiche(page)).toBe(roleDe(pseudo) === 'tueur' ? 'assassin' : 'proie');
    }

    // La proie d'une page fera la tache et le signalement; la victime est un client.
    const temoin = roleDe('Alice') === 'proie' ? 'Alice' : 'Bob';
    const pageDuTemoin = pages[temoin] as Page;
    const victime = PSEUDOS_DU_RESEAU.find((pseudo) => roleDe(pseudo) === 'proie') as string;
    await attendreQue(() => among(partie).phase === 'jeu', 'la revelation se termine');

    // -- Une tache, faite dans la page ----------------------------------------------
    const idTemoin = joueurNomme(partie, temoin).id;
    // Sa premiere tache courte: la tache longue de sa liste vient ensuite (etape 7.24).
    const rangDeLaCourte = (among(partie).joueurs[idTemoin]?.taches ?? []).findIndex(
      (tache) => !estUneTacheLongue(tache.nature),
    );
    const premiere = () => among(partie).joueurs[idTemoin]?.taches[rangDeLaCourte];
    const station = among(partie).stations[premiere()?.station ?? -1] as Position;
    await allerEtSArreter(partie, temoin, commandeAuClavier(pageDuTemoin), () => station, STATION);
    await pageDuTemoin.keyboard.press('e');
    await attendreQue(
      () => among(partie).joueurs[idTemoin]?.tacheEnCours !== undefined,
      () =>
        `${temoin} ouvre sa tache: a ${JSON.stringify(joueurNomme(partie, temoin).position)}, station ${JSON.stringify(station)}, ${JSON.stringify(among(partie).joueurs[idTemoin])}`,
    );
    await expect(pageDuTemoin.locator('.tache-titre')).toBeVisible();
    await faireLeGesteAuClavier(pageDuTemoin);
    await attendreQue(
      () => premiere()?.faite === true,
      () => `${temoin} fait sa tache: ${JSON.stringify(among(partie).joueurs[idTemoin])}`,
    );
    await expect(pageDuTemoin.locator('.tache-fenetre')).toBeHidden();
    await expect(pageDuTemoin.locator('.hud-among-mes-taches')).toContainText('1 sur 3');
    await expect(pageDuTemoin.locator('.hud-among-ligne.faite')).toHaveCount(1);

    // -- La carte plein ecran, par M -------------------------------------------------
    await pageDuTemoin.keyboard.press('m');
    await expect(pageDuTemoin.locator('.carte-among')).toBeVisible();
    await expect(pageDuTemoin.locator('.carte-among-repere')).toHaveCount(3);
    await expect(pageDuTemoin.locator('.carte-among-ligne.faite')).toHaveCount(1);
    await pageDuTemoin.keyboard.press('m');
    await expect(pageDuTemoin.locator('.carte-among')).toBeHidden();

    // -- Un mini-jeu, la tache longue de la liste, joue au clavier (7.24) ----------------
    const rangDuMiniJeu = (among(partie).joueurs[idTemoin]?.taches ?? []).findIndex((tache) =>
      estUneTacheLongue(tache.nature),
    );
    const miniJeu = () => among(partie).joueurs[idTemoin]?.taches[rangDuMiniJeu];
    expect(miniJeu()?.nature, `la graine ${String(GRAINE)} donne la bataille navale`).toBe(
      'bataille',
    );
    const borne = among(partie).stations[miniJeu()?.station ?? -1] as Position;
    await allerEtSArreter(partie, temoin, commandeAuClavier(pageDuTemoin), () => borne, STATION);
    await pageDuTemoin.keyboard.press('e');
    await attendreQue(
      () => among(partie).joueurs[idTemoin]?.tacheEnCours?.indice === rangDuMiniJeu,
      `${temoin} ouvre son mini-jeu`,
    );
    await expect(pageDuTemoin.locator('.tache-titre')).toHaveText('Bataille navale');
    await jouerLaBatailleAuClavier(pageDuTemoin, idTemoin);
    // Coulee sans un rate: si c'est avant la duree minimale, l'ecran gagne attend (tests de la
    // page); la tache est faite au plus tard a la duree minimale, et la fenetre se ferme.
    await attendreQue(
      () => miniJeu()?.faite === true,
      () => `${temoin} finit son mini-jeu: ${JSON.stringify(among(partie).joueurs[idTemoin])}`,
      30_000,
    );
    await expect(pageDuTemoin.locator('.tache-fenetre')).toBeHidden();
    await expect(pageDuTemoin.locator('.hud-among-mes-taches')).toContainText('2 sur 3');

    // -- La panne de neons: l'assassin sabote depuis sa carte, la proie repare (7.22) ------
    expect(assassin, `la graine ${String(GRAINE)} donne l assassin a Alice`).toBe('Alice');
    await alice.keyboard.press('m');
    const panne = alice.locator('.carte-among-sabotage[data-nature="panne"]');
    // La recharge commune des sabotages court quinze secondes au debut du tour.
    await expect(panne).toBeEnabled({ timeout: 30_000 });
    await panne.click();
    await alice.keyboard.press('m');
    await attendreQue(() => among(partie).sabotage?.nature === 'panne', 'Alice coupe les neons');
    await expect(pageDuTemoin.locator('.hud-among-alerte[data-genre="panne"]')).toBeVisible();
    await allerEtSArreter(
      partie,
      temoin,
      commandeAuClavier(pageDuTemoin),
      () => among(partie).boitier,
      STATION,
    );
    await expect(pageDuTemoin.locator('.hud-action')).toHaveAttribute('data-geste', 'reparer');
    await pageDuTemoin.keyboard.down('e');
    await attendreQue(
      () => among(partie).sabotage === undefined,
      `${temoin} repare le boitier`,
      10_000,
    );
    await pageDuTemoin.keyboard.up('e');
    await expect(pageDuTemoin.locator('.hud-among-alerte')).toBeHidden();

    // -- Les pas entendus: une proie du reseau s'eloigne du temoin, au boitier (7.23) ------
    // Elle part du point de reunion, en vue du temoin, vers une station a 700 pixels de lui a
    // peu pres: elle traverse l'anneau ou on l'entend sans la voir, de 260 a 500 pixels.
    const marcheur = PSEUDOS_DU_RESEAU.find(
      (pseudo) => pseudo !== victime && roleDe(pseudo) === 'proie',
    ) as string;
    const idMarcheur = joueurNomme(partie, marcheur).id;
    const ecoute = joueurNomme(partie, temoin).position;
    const auLoin = [...among(partie).stations].sort(
      (une, autre) =>
        Math.abs(distance(une, ecoute) - 700) - Math.abs(distance(autre, ecoute) - 700),
    )[0] as Position;
    const entendusParLeTemoin = pasEntendus.get(pageDuTemoin) ?? [];
    const dejaEntendus = entendusParLeTemoin.length;
    await allerEtSArreter(
      partie,
      marcheur,
      commandeDuReseau(reseau[marcheur] as ClientDuReseau),
      () => auLoin,
      STATION,
    );
    const pendantLaMarche = entendusParLeTemoin.slice(dejaEntendus);
    expect(pendantLaMarche.length, `${temoin} entend ${marcheur} s eloigner`).toBeGreaterThan(0);
    for (const trame of pendantLaMarche) {
      expect(trame.vus).not.toContain(idMarcheur);
    }

    // -- Le meurtre ---------------------------------------------------------------------
    const idVictime = joueurNomme(partie, victime).id;
    const commandeDeLAssassin =
      assassin in pages
        ? commandeAuClavier(pages[assassin] as Page)
        : commandeDuReseau(reseau[assassin] as ClientDuReseau);
    const frapper = async (): Promise<void> => {
      if (assassin in pages) {
        await (pages[assassin] as Page).keyboard.press(' ');
      } else {
        (reseau[assassin] as ClientDuReseau).emit('capturer');
      }
    };
    // L'affut du pilote: l'assassin s'arrete face a sa victime et frappe a chaque instant. Le
    // katana se recharge dix secondes au debut du tour: il frappe jusqu'a ce qu'il porte.
    const idAssassin = joueurNomme(partie, assassin).id;
    const pageDeLAssassin = pages[assassin];
    const etatDeLAssassin = async (): Promise<string> =>
      `${JSON.stringify(among(partie).joueurs[idAssassin])}, captures envoyees ${String(pageDeLAssassin === undefined ? '-' : (capturesEnvoyees.get(pageDeLAssassin) ?? 0))}, focus ${
        pageDeLAssassin === undefined
          ? 'sans page'
          : await pageDeLAssassin.evaluate(
              () =>
                `${document.activeElement?.tagName ?? ''}.${document.activeElement?.className ?? ''}`,
            )
      }`;
    await accomplir({
      nom: `${assassin} tue ${victime}`,
      commande: commandeDeLAssassin,
      delaiMs: DELAI_DU_GESTE_MS,
      situation: () => ({
        terrain: partie.etat.terrain,
        position: joueurNomme(partie, assassin).position,
        cibles: [joueurNomme(partie, victime).position],
      }),
      accomplie: () => among(partie).joueurs[idVictime]?.fantome === true,
      affut: { distancePx: AFFUT_DU_MEURTRE_PX, guetter: frapper },
    }).catch(async (erreur: unknown) => {
      throw new Error(`Le meurtre echoue. Assassin: ${await etatDeLAssassin()}`, { cause: erreur });
    });
    // Un cadavre est range sous son propre identifiant, et nomme sa victime.
    const cadavre = () =>
      Object.values(among(partie).cadavres).find((corps) => corps.victime === idVictime)
        ?.position as Position;

    // -- Le signalement, et la reunion dans les deux pages -----------------------------
    await allerEtSArreter(partie, temoin, commandeAuClavier(pageDuTemoin), cadavre, CADAVRE);
    await pageDuTemoin.keyboard.press('e');
    await attendreQue(() => among(partie).phase === 'discussion', `${temoin} signale le corps`);

    for (const page of [alice, bob]) {
      await expect(page.locator('.among-reunion')).toBeVisible();
      await expect(page.locator('.among-reunion-titre')).toHaveText(
        `${temoin} a trouvé le corps de ${victime}`,
      );
    }

    // -- Le vote contre l'assassin -----------------------------------------------------
    await attendreQue(() => among(partie).phase === 'vote', 'le vote s ouvre', 30_000);

    for (const [pseudo, page] of Object.entries(pages)) {
      if (pseudo === assassin) {
        await page.getByRole('button', { name: 'Passer' }).click();
      } else {
        await page.locator(`.among-place[aria-label="${assassin}"]`).click();
      }
    }

    for (const [pseudo, client] of Object.entries(reseau)) {
      if (pseudo !== victime) {
        client.emit('voter', { cible: pseudo === assassin ? null : idAssassin });
      }
    }

    // -- L'ejection, puis la fin ---------------------------------------------------------
    for (const page of [alice, bob]) {
      await expect(page.locator('.among-egout-texte')).toHaveText(
        new RegExp(`^${assassin} \\(.+\\) a été exécuté\\.$`, 'u'),
      );
      // Quatre vivants ont vote: quatre traits, dont celui de l'assassin vers « Passer ».
      const votes = JSON.stringify(among(partie).ejection?.votes);
      await expect(page.locator('.among-trait'), `votes retenus: ${votes}`).toHaveCount(4);
      await expect(page.locator('.among-reunion')).not.toContainText(/assassin/iu);
    }

    await Promise.all([attendreLaFin(alice), attendreLaFin(bob)]);

    for (const page of [alice, bob]) {
      await expect(page.locator('.fin-titre')).toContainText('Les proies l’emportent');
    }

    expect(erreursDAlice).toEqual([]);
    expect(erreursDeBob).toEqual([]);
  } finally {
    await ordinateurA.close();
    await ordinateurB.close();
  }
});
