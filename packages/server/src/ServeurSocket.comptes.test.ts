/**
 * Tests d'integration de la couche reseau avec des comptes (etape 3.2).
 *
 * De vrais clients Socket.IO contre un vrai serveur, comme ServeurSocket.test.ts,
 * mais avec un annuaire des comptes EN MEMOIRE: ces tests verifient ce que la
 * couche reseau fait de ses reponses (qui entre, sous quel pseudo, quels refus),
 * pas la base. Le meme parcours contre une vraie base est dans
 * tests/base/authentification.test.ts.
 */

import type {
  EvenementsClientVersServeur,
  EvenementsServeurVersClient,
  InfosSalon,
  ResultatValidation,
} from '@neon-ninja/shared';
import { niveauDeXp, reperePseudo } from '@neon-ninja/shared';
import type { Socket as SocketClient } from 'socket.io-client';
import { io as connecter } from 'socket.io-client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { NouveauResultat, NouvellePartie } from './base/parties.js';
import type { IdentiteDeCompte, ServiceDeComptes } from './comptes/annuaire.js';
import { ATTENTE_ENTRE_DEUX_ENREGISTREMENTS_MS, ESSAIS_D_ENREGISTREMENT } from './finDePartie.js';
import type { HorlogeManuelle } from './horloge.js';
import { creerHorlogeManuelle } from './horloge.js';
import type { ServeurMonte } from './serveur.js';
import { demarrerServeur } from './serveur.js';

/** Un client de test: les contrats sont vus a l'envers de ceux du serveur. */
type ClientTypee = SocketClient<EvenementsServeurVersClient, EvenementsClientVersServeur>;

/** Delai au-dela duquel on considere qu'un message attendu ne viendra pas. */
const DELAI_ATTENTE_MS = 3000;

/** Le jeton de la session d'Alice, compte de niveau 7. */
const JETON_ALICE = 'A'.repeat(43);

/** Un jeton bien forme, qui n'ouvre aucune session. */
const JETON_INCONNU = 'Z'.repeat(43);

/** Un annuaire en memoire, que chaque test peut derегler. */
interface AnnuaireDEssai extends ServiceDeComptes {
  readonly comptes: Map<string, IdentiteDeCompte>;
  /** Les fins de partie enregistrees, dans l'ordre. */
  readonly finsEnregistrees: {
    readonly partie: NouvellePartie;
    readonly resultats: readonly NouveauResultat[];
  }[];
  /** Toute question leve une erreur, comme une base injoignable. */
  panne: boolean;
  /** Chaque question met ce temps a repondre, en millisecondes reelles. */
  delaiMs: number;
  /**
   * Un enregistrement de fin de partie n'aboutit qu'une fois cette promesse tenue.
   * Deja tenue par defaut; un test la remplace pour garder un enregistrement en cours.
   */
  verrouDEnregistrement: Promise<void>;
  /** Combien des prochains enregistrements de fin de partie echoueront, comme une base injoignable. */
  enregistrementsEnEchec: number;
  /** La partie de chaque essai d'enregistrement recu, qu'il ait abouti ou non. */
  readonly essaisDEnregistrement: NouvellePartie[];
  /** Les sessions ouvertes: jeton vers compte. */
  readonly sessions: Map<string, string>;
  /**
   * Ferme les sessions de ce compte, sauf celle de ce jeton, et previent les
   * ecouteurs, comme un changement de mot de passe (etape 3.4).
   */
  fermerLesSessions(compteId: string, sauf?: string): void;
  /** Le nombre d'ecouteurs des sessions fermees. */
  readonly nombreDEcouteurs: number;
}

/** Un annuaire qui connait Alice, et la session JETON_ALICE. */
function annuaireDEssai(): AnnuaireDEssai {
  const sessions = new Map([[JETON_ALICE, 'compte-alice']]);
  const ecouteurs = new Set<(compteId: string) => void>();
  const nonUtilise = async (): Promise<never> => {
    throw new Error('Les routes HTTP ne sont pas utilisees par ces tests.');
  };

  const annuaire: AnnuaireDEssai = {
    sessions,
    get nombreDEcouteurs() {
      return ecouteurs.size;
    },
    fermerLesSessions: (compteId, sauf) => {
      for (const [jeton, compte] of sessions) {
        if (compte === compteId && jeton !== sauf) {
          sessions.delete(jeton);
        }
      }

      for (const ecouteur of ecouteurs) {
        ecouteur(compteId);
      }
    },
    surSessionsFermees: (ecouteur) => {
      ecouteurs.add(ecouteur);

      return () => {
        ecouteurs.delete(ecouteur);
      };
    },
    comptes: new Map([['compte-alice', { pseudo: 'Alice', niveau: 7 }]]),
    finsEnregistrees: [],
    panne: false,
    delaiMs: 0,
    verrouDEnregistrement: Promise.resolve(),
    enregistrementsEnEchec: 0,
    essaisDEnregistrement: [],
    // Chaque compte part d'une progression vide, et une perte de points de ligue
    // est ramenee a zero, comme en base.
    enregistrerFinDePartie: async (partie, resultats) => {
      annuaire.essaisDEnregistrement.push(partie);
      await repondre();

      if (annuaire.enregistrementsEnEchec > 0) {
        annuaire.enregistrementsEnEchec -= 1;
        throw new Error('base injoignable');
      }

      await annuaire.verrouDEnregistrement;
      annuaire.finsEnregistrees.push({ partie, resultats });

      return resultats.map((resultat) => ({
        compteId: resultat.compteId,
        avant: { xpTotale: 0, pieces: 0, pointsLigue: 0 },
        apres: {
          xpTotale: resultat.xpGagnee,
          pieces: resultat.piecesGagnees,
          pointsLigue: Math.max(resultat.variationPointsLigue, 0),
        },
      }));
    },
    compteDeSession: async (jeton) => {
      await repondre();
      return sessions.get(jeton);
    },
    identiteDe: async (compteId) => {
      await repondre();
      return annuaire.comptes.get(compteId);
    },
    pseudoDeCompte: async (pseudo) => {
      await repondre();
      return [...annuaire.comptes.values()].some(
        (compte) => reperePseudo(compte.pseudo) === reperePseudo(pseudo),
      );
    },
    inscrire: nonUtilise,
    connecter: nonUtilise,
    deconnecter: nonUtilise,
    maProgression: nonUtilise,
    profil: nonUtilise,
    ficheJoueur: nonUtilise,
    amis: nonUtilise,
    gesteDAmitie: nonUtilise,
    changerMotDePasse: nonUtilise,
    nouveauCodeDeSecours: nonUtilise,
    reinitialiser: nonUtilise,
  };

  async function repondre(): Promise<void> {
    if (annuaire.delaiMs > 0) {
      await new Promise((resoudre) => setTimeout(resoudre, annuaire.delaiMs));
    }

    if (annuaire.panne) {
      throw new Error('base injoignable');
    }
  }

  return annuaire;
}

let serveur: ServeurMonte | undefined;
let horloge: HorlogeManuelle = creerHorlogeManuelle();
let url = '';
const clients: ClientTypee[] = [];

afterEach(async () => {
  for (const client of clients.splice(0)) {
    client.disconnect();
  }

  await serveur?.fermer();
  serveur = undefined;
  vi.restoreAllMocks();
});

/** Monte un serveur, avec cet annuaire ou sans comptes. */
async function monter(annuaire?: AnnuaireDEssai): Promise<ServeurMonte> {
  horloge = creerHorlogeManuelle();
  serveur = await demarrerServeur(0, {
    horloge,
    ...(annuaire === undefined ? {} : { comptes: annuaire }),
  });

  const adresse = serveur.http.address();
  if (typeof adresse !== 'object' || adresse === null) {
    throw new Error("Le serveur de test n'a pas d'adresse.");
  }

  url = `http://localhost:${String(adresse.port)}`;
  return serveur;
}

/**
 * Ouvre une connexion, avec ce qu'elle presente a l'ouverture.
 *
 * Rejette avec l'erreur du serveur si la connexion est refusee.
 */
async function connecterUnClient(authentification?: Record<string, unknown>): Promise<ClientTypee> {
  const client: ClientTypee = connecter(url, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
    ...(authentification === undefined ? {} : { auth: authentification }),
  });

  clients.push(client);

  await new Promise<void>((resoudre, rejeter) => {
    const minuterie = setTimeout(() => {
      rejeter(new Error('La connexion du client n a pas abouti.'));
    }, DELAI_ATTENTE_MS);

    client.on('connect', () => {
      clearTimeout(minuterie);
      resoudre();
    });
    client.on('connect_error', (erreur) => {
      clearTimeout(minuterie);
      rejeter(erreur);
    });
  });

  return client;
}

/** Demande a entrer, et attend le verdict. */
async function rejoindre(
  client: ClientTypee,
  demande: Record<string, unknown>,
): Promise<ResultatValidation<InfosSalon>> {
  return new Promise((resoudre, rejeter) => {
    const minuterie = setTimeout(() => {
      rejeter(new Error("Le serveur n'a pas repondu a la demande d'entree."));
    }, DELAI_ATTENTE_MS);

    client.emit('rejoindre', demande as never, (reponse: ResultatValidation<InfosSalon>) => {
      clearTimeout(minuterie);
      resoudre(reponse);
    });
  });
}

/** Demande a creer une partie, et attend le verdict. */
async function creer(
  client: ClientTypee,
  demande: Record<string, unknown>,
): Promise<ResultatValidation<InfosSalon>> {
  return new Promise((resoudre, rejeter) => {
    const minuterie = setTimeout(() => {
      rejeter(new Error("Le serveur n'a pas repondu a la demande de creation."));
    }, DELAI_ATTENTE_MS);

    client.emit('creerPartie', demande as never, (reponse: ResultatValidation<InfosSalon>) => {
      clearTimeout(minuterie);
      resoudre(reponse);
    });
  });
}

/** Le salon d'une entree acceptee, ou un echec de test explicite. */
function salonAccepte(reponse: ResultatValidation<InfosSalon>): InfosSalon {
  if (!reponse.valide) {
    throw new Error(`Entree refusee: ${reponse.erreurs.map((e) => e.motif).join(', ')}`);
  }

  return reponse.valeur;
}

/** Le champ du premier motif d'un refus, ou un echec de test si c'etait accepte. */
function champRefuse(reponse: ResultatValidation<InfosSalon>): string | undefined {
  if (reponse.valide) {
    throw new Error('Attendu un refus, recu une entree acceptee.');
  }

  return reponse.erreurs[0]?.champ;
}

/** Attend le prochain message de ce nom. */
async function prochain<Nom extends keyof EvenementsServeurVersClient>(
  client: ClientTypee,
  nom: Nom,
): Promise<Parameters<EvenementsServeurVersClient[Nom]>[0]> {
  return new Promise((resoudre, rejeter) => {
    const minuterie = setTimeout(() => {
      rejeter(new Error(`Aucun message « ${String(nom)} » n est arrive.`));
    }, DELAI_ATTENTE_MS);

    client.once(nom, ((charge: Parameters<EvenementsServeurVersClient[Nom]>[0]) => {
      clearTimeout(minuterie);
      resoudre(charge);
    }) as never);
  });
}

/** Collecte tous les messages de ce nom recus a partir de maintenant. */
function collecter<Nom extends keyof EvenementsServeurVersClient>(
  client: ClientTypee,
  nom: Nom,
): Parameters<EvenementsServeurVersClient[Nom]>[0][] {
  const recus: Parameters<EvenementsServeurVersClient[Nom]>[0][] = [];

  client.on(nom, ((charge: Parameters<EvenementsServeurVersClient[Nom]>[0]) => {
    recus.push(charge);
  }) as never);

  return recus;
}

/** Laisse le reseau acheminer ce qui est deja parti. */
async function laisserPasserLesMessages(): Promise<void> {
  await new Promise((resoudre) => setTimeout(resoudre, 30));
}

/**
 * Attend un etat du salon qui remplit cette condition.
 *
 * Attendre simplement le prochain message du salon ne suffit pas: celui qui suit
 * une entree peut encore etre en route, et arriver avant celui qu'on attend.
 */
async function salonQui(
  client: ClientTypee,
  condition: (salon: InfosSalon) => boolean,
): Promise<InfosSalon> {
  return new Promise((resoudre, rejeter) => {
    const minuterie = setTimeout(() => {
      rejeter(new Error('Le salon attendu n est pas arrive.'));
    }, DELAI_ATTENTE_MS);

    const ecouter = (salon: InfosSalon): void => {
      if (condition(salon)) {
        clearTimeout(minuterie);
        client.off('salon', ecouter);
        resoudre(salon);
      }
    };

    client.on('salon', ecouter);
  });
}

/**
 * L'hote regle une partie courte et peu peuplee, puis la lance: decompte complet,
 * jusqu'au premier battement.
 *
 * CHAQUE ETAPE ATTEND SA PREUVE, JAMAIS UN DELAI. L'horloge du jeu est manuelle,
 * celle du reseau non: faire avancer le jeu avant que le serveur ait traite les
 * reglages, ou la demande de demarrage, jouerait une autre partie que celle voulue.
 * Sur une machine chargee, un delai fixe ne le garantit pas.
 */
async function lancerUnePartieCourte(hote: ClientTypee): Promise<void> {
  const reglee = salonQui(hote, (salon) => salon.reglages.dureePartieS === 30);
  hote.emit('reglages', { dureePartieS: 30, nombreBotsInitial: 10 });
  await reglee;

  // Le decompte annonce sa premiere seconde des que la demande est traitee.
  const decompte = prochain(hote, 'compteARebours');
  const lancee = prochain(hote, 'partieLancee');
  hote.emit('demarrer');
  await decompte;
  horloge.avancerDe(5000);
  await lancee;
}

describe('une connexion authentifiee', () => {
  it('entre sous le pseudo et le niveau de son compte, sans lire le pseudo demande', async () => {
    await monter(annuaireDEssai());
    const alice = await connecterUnClient({ jeton: JETON_ALICE });

    const salon = salonAccepte(await rejoindre(alice, { pseudo: 'Mallory' }));

    expect(salon.joueurs).toEqual([
      { id: alice.id, pseudo: 'Alice', hote: true, compte: { niveau: 7 } },
    ]);
  });

  it('peut entrer et creer une partie sans fournir de pseudo', async () => {
    await monter(annuaireDEssai());
    const alice = await connecterUnClient({ jeton: JETON_ALICE });

    const salon = salonAccepte(
      await creer(alice, { configuration: { mode: 'classique', visibilite: 'privee' } }),
    );

    expect(salon.joueurs[0]?.pseudo).toBe('Alice');
    expect(salon.visibilite).toBe('privee');
  });

  it('se montre aux autres membres avec son niveau, et un invite sans', async () => {
    await monter(annuaireDEssai());
    const bob = await connecterUnClient();
    const idRoom = salonAccepte(await rejoindre(bob, { pseudo: 'Bob' })).idRoom;

    const arrivee = prochain(bob, 'joueurArrive');
    const alice = await connecterUnClient({ jeton: JETON_ALICE });
    const salon = salonAccepte(await rejoindre(alice, { idRoom }));

    expect(await arrivee).toEqual({
      id: alice.id,
      pseudo: 'Alice',
      hote: false,
      compte: { niveau: 7 },
    });
    const invite = salon.joueurs.find((joueur) => joueur.pseudo === 'Bob');
    expect(invite).toEqual({ id: bob.id, pseudo: 'Bob', hote: true });
    expect(invite !== undefined && 'compte' in invite).toBe(false);
  });

  it('part en disant qu elle etait un compte', async () => {
    await monter(annuaireDEssai());
    const bob = await connecterUnClient();
    const idRoom = salonAccepte(await rejoindre(bob, { pseudo: 'Bob' })).idRoom;
    const alice = await connecterUnClient({ jeton: JETON_ALICE });
    salonAccepte(await rejoindre(alice, { idRoom }));

    const depart = prochain(bob, 'joueurParti');
    alice.emit('quitter');

    expect(await depart).toEqual({
      id: alice.id,
      pseudo: 'Alice',
      hote: false,
      compte: { niveau: 7 },
    });
  });

  it('est refusee a l entree si son compte n existe plus', async () => {
    const annuaire = annuaireDEssai();
    await monter(annuaire);
    const alice = await connecterUnClient({ jeton: JETON_ALICE });

    annuaire.comptes.delete('compte-alice');

    expect(champRefuse(await rejoindre(alice, {}))).toBe('session');
    expect(serveur?.jeu.rooms.nombreDeRooms).toBe(0);
  });
});

describe('une connexion invitee', () => {
  it('entre sous le pseudo qu elle demande, sans compte', async () => {
    await monter(annuaireDEssai());
    const bob = await connecterUnClient();

    const salon = salonAccepte(await rejoindre(bob, { pseudo: 'Bob' }));

    expect(salon.joueurs).toEqual([{ id: bob.id, pseudo: 'Bob', hote: true }]);
  });

  it('doit choisir un pseudo', async () => {
    await monter(annuaireDEssai());
    const bob = await connecterUnClient();

    expect(champRefuse(await rejoindre(bob, {}))).toBe('pseudo');
    expect(
      champRefuse(
        await creer(bob, { configuration: { mode: 'classique', visibilite: 'publique' } }),
      ),
    ).toBe('pseudo');
    expect(serveur?.jeu.rooms.nombreDeRooms).toBe(0);
  });

  it('ne peut pas prendre le pseudo d un compte, quelle que soit son ecriture', async () => {
    await monter(annuaireDEssai());
    const usurpateur = await connecterUnClient();

    const refus = await rejoindre(usurpateur, { pseudo: '  aLICE ' });
    const creation = await creer(usurpateur, {
      pseudo: 'ALICE',
      configuration: { mode: 'classique', visibilite: 'publique' },
    });

    expect(champRefuse(refus)).toBe('pseudo');
    expect(champRefuse(creation)).toBe('pseudo');
    expect(serveur?.jeu.rooms.nombreDeRooms).toBe(0);
  });

  it('entre sans verification de pseudo sur un serveur sans comptes', async () => {
    await monter();
    const alice = await connecterUnClient();

    const salon = salonAccepte(await rejoindre(alice, { pseudo: 'Alice' }));

    expect(salon.joueurs[0]).toEqual({ id: alice.id, pseudo: 'Alice', hote: true });
  });
});

describe('ouverture d une connexion', () => {
  it('refuse un jeton qui n ouvre aucune session', async () => {
    await monter(annuaireDEssai());

    await expect(connecterUnClient({ jeton: JETON_INCONNU })).rejects.toThrow(
      'Session invalide ou expirée',
    );
  });

  it('refuse un jeton mal forme, sans interroger l annuaire', async () => {
    const annuaire = annuaireDEssai();
    const question = vi.spyOn(annuaire, 'compteDeSession');
    await monter(annuaire);

    await expect(connecterUnClient({ jeton: 'trop-court' })).rejects.toThrow('Session invalide');
    await expect(connecterUnClient({ jeton: 42 })).rejects.toThrow('Session invalide');
    expect(question).not.toHaveBeenCalled();
  });

  it('refuse un jeton sur un serveur sans comptes, plutot que d en faire un invite', async () => {
    await monter();

    await expect(connecterUnClient({ jeton: JETON_ALICE })).rejects.toThrow(
      'Les comptes sont indisponibles',
    );
  });

  it('refuse la connexion si la session ne peut pas etre verifiee, et le journalise', async () => {
    const journal = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const annuaire = annuaireDEssai();
    annuaire.panne = true;
    await monter(annuaire);

    await expect(connecterUnClient({ jeton: JETON_ALICE })).rejects.toThrow(
      "n'a pas pu être vérifiée",
    );
    expect(journal).toHaveBeenCalled();
  });
});

describe('entree pendant l identification', () => {
  it('refuse l entree d un invite si le pseudo ne peut pas etre verifie', async () => {
    const journal = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const annuaire = annuaireDEssai();
    await monter(annuaire);
    const bob = await connecterUnClient();

    annuaire.panne = true;

    expect(champRefuse(await rejoindre(bob, { pseudo: 'Bob' }))).toBe('serveur');
    expect(serveur?.jeu.rooms.nombreDeRooms).toBe(0);
    expect(journal).toHaveBeenCalled();
  });

  it('ne fait entrer qu une fois une connexion qui envoie deux demandes coup sur coup', async () => {
    const annuaire = annuaireDEssai();
    await monter(annuaire);
    const bob = await connecterUnClient();

    annuaire.delaiMs = 40;
    const reponses = await Promise.all([
      rejoindre(bob, { pseudo: 'Bob' }),
      creer(bob, { pseudo: 'Bob', configuration: { mode: 'classique', visibilite: 'privee' } }),
    ]);

    expect(reponses.filter((reponse) => reponse.valide)).toHaveLength(1);
    expect(reponses.map((reponse) => (reponse.valide ? 'entree' : champRefuse(reponse)))).toContain(
      'session',
    );
    expect(serveur?.jeu.rooms.nombreDeRooms).toBe(1);
  });

  it('ne fait rien entrer d une connexion fermee pendant la verification', async () => {
    const annuaire = annuaireDEssai();
    await monter(annuaire);
    const bob = await connecterUnClient();

    annuaire.delaiMs = 60;
    bob.emit('rejoindre', { pseudo: 'Bob' }, () => undefined);
    await new Promise((resoudre) => setTimeout(resoudre, 10));
    bob.disconnect();
    await new Promise((resoudre) => setTimeout(resoudre, 120));

    expect(serveur?.jeu.rooms.nombreDeRooms).toBe(0);
  });
});

describe('retour en partie d un compte (etape 2.5)', () => {
  /** Demande a revenir avec ce jeton, et attend le verdict. */
  async function revenir(
    client: ClientTypee,
    jeton: string,
  ): Promise<ResultatValidation<InfosSalon>> {
    return new Promise((resoudre, rejeter) => {
      const minuterie = setTimeout(() => {
        rejeter(new Error("Le serveur n'a pas repondu a la demande de retour."));
      }, DELAI_ATTENTE_MS);

      client.emit('revenir', { jeton }, (reponse) => {
        clearTimeout(minuterie);
        resoudre(reponse);
      });
    });
  }

  /** Coupe la connexion de ce client, et attend que le serveur l'ait constate. */
  async function couper(client: ClientTypee): Promise<void> {
    const avant = serveur?.jeu.nombreDeConnexions ?? 0;
    client.disconnect();

    const limite = Date.now() + DELAI_ATTENTE_MS;
    while ((serveur?.jeu.nombreDeConnexions ?? 0) >= avant) {
      if (Date.now() > limite) {
        throw new Error("Le serveur n'a pas constate la coupure.");
      }

      await new Promise((resoudre) => setTimeout(resoudre, 5));
    }
  }

  it('une place de compte ne se reprend que depuis une connexion de ce meme compte', async () => {
    await monter(annuaireDEssai());
    const alice = await connecterUnClient({ jeton: JETON_ALICE });
    const place = prochain(alice, 'placeAttribuee');
    const idRoom = salonAccepte(await rejoindre(alice, {})).idRoom;
    const { jetonDeRetour, joueur } = await place;
    const bob = await connecterUnClient();
    salonAccepte(await rejoindre(bob, { pseudo: 'Bob', idRoom }));
    await lancerUnePartieCourte(alice);

    await couper(alice);

    const invite = await connecterUnClient();
    expect(champRefuse(await revenir(invite, jetonDeRetour))).toBe('retour');

    const aliceRevenue = await connecterUnClient({ jeton: JETON_ALICE });
    const nouvellePlace = prochain(aliceRevenue, 'placeAttribuee');
    expect(salonAccepte(await revenir(aliceRevenue, jetonDeRetour)).idRoom).toBe(idRoom);
    expect((await nouvellePlace).joueur).toBe(joueur);
  });

  it('une place d invite ne se reprend pas depuis une connexion de compte', async () => {
    await monter(annuaireDEssai());
    const bob = await connecterUnClient();
    const place = prochain(bob, 'placeAttribuee');
    salonAccepte(await rejoindre(bob, { pseudo: 'Bob' }));
    const { jetonDeRetour } = await place;
    const alice = await connecterUnClient({ jeton: JETON_ALICE });
    salonAccepte(await rejoindre(alice, { idRoom: 'room-1' }));
    await lancerUnePartieCourte(bob);

    await couper(bob);

    const compte = await connecterUnClient({ jeton: JETON_ALICE });
    expect(champRefuse(await revenir(compte, jetonDeRetour))).toBe('retour');
  });

  it('un compte revenu est classe comme present, et recoit sa progression de fin', async () => {
    const annuaire = annuaireDEssai();
    await monter(annuaire);
    const alice = await connecterUnClient({ jeton: JETON_ALICE });
    const place = prochain(alice, 'placeAttribuee');
    salonAccepte(await rejoindre(alice, {}));
    const { jetonDeRetour } = await place;
    await lancerUnePartieCourte(alice);

    horloge.avancerDe(10_000);
    await couper(alice);

    const aliceRevenue = await connecterUnClient({ jeton: JETON_ALICE });
    salonAccepte(await revenir(aliceRevenue, jetonDeRetour));

    const progression = prochain(aliceRevenue, 'progressionDeFin');
    horloge.avancerDe(21_000);
    const recue = await progression;

    expect(recue.enregistree).toBe(true);
    expect(annuaire.finsEnregistrees[0]?.resultats).toEqual([
      expect.objectContaining({ compteId: 'compte-alice', placement: 1 }),
    ]);
  });
});

describe('sessions fermees par un changement de mot de passe (etape 3.4)', () => {
  /** Une seconde session d'Alice, ouverte sur un autre appareil. */
  const JETON_ALICE_BIS = 'B'.repeat(43);

  /** Attend que le serveur coupe ce client, et rend la raison donnee par Socket.IO. */
  async function coupure(client: ClientTypee): Promise<string> {
    return new Promise((resoudre, rejeter) => {
      const minuterie = setTimeout(() => {
        rejeter(new Error("Le client n'a pas ete coupe."));
      }, DELAI_ATTENTE_MS);

      client.once('disconnect', (raison) => {
        clearTimeout(minuterie);
        resoudre(raison);
      });
    });
  }

  it('coupe la connexion d une session fermee, et garde la session restante et les invites', async () => {
    const annuaire = annuaireDEssai();
    annuaire.sessions.set(JETON_ALICE_BIS, 'compte-alice');
    const { jeu } = await monter(annuaire);

    const gardee = await connecterUnClient({ jeton: JETON_ALICE });
    const fermee = await connecterUnClient({ jeton: JETON_ALICE_BIS });
    const invite = await connecterUnClient();
    const coupee = coupure(fermee);

    annuaire.fermerLesSessions('compte-alice', JETON_ALICE);

    expect(await coupee).toBe('io server disconnect');
    await laisserPasserLesMessages();
    expect(gardee.connected).toBe(true);
    expect(invite.connected).toBe(true);
    expect(jeu.nombreDeConnexions).toBe(2);
  });

  it('ne coupe aucune connexion d un autre compte', async () => {
    const annuaire = annuaireDEssai();
    annuaire.comptes.set('compte-bob', { pseudo: 'Bob', niveau: 1 });
    annuaire.sessions.set('C'.repeat(43), 'compte-bob');
    await monter(annuaire);

    const alice = await connecterUnClient({ jeton: JETON_ALICE });
    const bob = await connecterUnClient({ jeton: 'C'.repeat(43) });
    const coupee = coupure(alice);

    annuaire.fermerLesSessions('compte-alice');

    await coupee;
    await laisserPasserLesMessages();
    expect(bob.connected).toBe(true);
  });

  it('fait sortir de son salon une connexion coupee, et les autres le voient', async () => {
    const annuaire = annuaireDEssai();
    await monter(annuaire);

    const invite = await connecterUnClient();
    const salon = salonAccepte(await rejoindre(invite, { pseudo: 'Invite' }));
    const alice = await connecterUnClient({ jeton: JETON_ALICE });
    salonAccepte(await rejoindre(alice, { idRoom: salon.idRoom }));
    // Le salon part avec le depart: on l'attend avant de declencher la coupure.
    const depart = prochain(invite, 'joueurParti');
    const salonSansAlice = salonQui(invite, (etat) => etat.joueurs.length === 1);

    annuaire.fermerLesSessions('compte-alice');

    expect((await depart).pseudo).toBe('Alice');
    expect((await salonSansAlice).joueurs.map((joueur) => joueur.pseudo)).toEqual(['Invite']);
  });

  it('garde la connexion si sa session ne peut pas etre revue, et le journalise', async () => {
    const journal = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const annuaire = annuaireDEssai();
    await monter(annuaire);

    const alice = await connecterUnClient({ jeton: JETON_ALICE });
    annuaire.panne = true;

    annuaire.fermerLesSessions('compte-alice');

    await vi.waitFor(() => {
      expect(journal).toHaveBeenCalled();
    });
    expect(alice.connected).toBe(true);
  });

  it('retire son ecoute des sessions fermees quand le serveur se ferme', async () => {
    const annuaire = annuaireDEssai();
    const monte = await monter(annuaire);

    expect(annuaire.nombreDEcouteurs).toBe(1);

    await monte.fermer();
    serveur = undefined;

    expect(annuaire.nombreDEcouteurs).toBe(0);
  });
});

describe('fin de partie (etape 3.3)', () => {
  it('enregistre le resultat du compte et lui envoie ce qui a ete applique, rien a l invite', async () => {
    const annuaire = annuaireDEssai();
    await monter(annuaire);
    const alice = await connecterUnClient({ jeton: JETON_ALICE });
    const idRoom = salonAccepte(await rejoindre(alice, {})).idRoom;
    const bob = await connecterUnClient();
    salonAccepte(await rejoindre(bob, { pseudo: 'Bob', idRoom }));
    await lancerUnePartieCourte(alice);

    const progression = prochain(alice, 'progressionDeFin');
    const pourBob = collecter(bob, 'progressionDeFin');
    horloge.avancerDe(31_000);
    const recue = await progression;
    await laisserPasserLesMessages();

    const [fin] = annuaire.finsEnregistrees;
    const resultat = fin?.resultats[0];

    expect(annuaire.finsEnregistrees).toHaveLength(1);
    expect(fin?.partie).toEqual({
      id: expect.any(String) as string,
      mode: 'classique',
      carte: 'map1',
      modeMiroir: false,
      dureeS: 30,
      nombreJoueurs: 2,
    });
    expect(fin?.resultats).toHaveLength(1);
    expect(resultat?.compteId).toBe('compte-alice');
    expect(recue).toEqual({
      enregistree: true,
      placement: resultat?.placement,
      nombreJoueurs: 2,
      xpGagnee: resultat?.xpGagnee,
      piecesGagnees: resultat?.piecesGagnees,
      variationPointsLigue: 0,
      avant: { xpTotale: 0, niveau: 1, pieces: 0, pointsLigue: 0, palier: 'bronze' },
      apres: {
        xpTotale: resultat?.xpGagnee,
        niveau: niveauDeXp(resultat?.xpGagnee ?? 0),
        pieces: resultat?.piecesGagnees,
        pointsLigue: 0,
        palier: 'bronze',
      },
    });
    expect(resultat?.xpGagnee).toBeGreaterThan(0);
    expect(pourBob).toEqual([]);
  });

  it('n enregistre rien pour une partie jouee par des invites', async () => {
    const annuaire = annuaireDEssai();
    const enregistrer = vi.spyOn(annuaire, 'enregistrerFinDePartie');
    await monter(annuaire);
    const bob = await connecterUnClient();
    salonAccepte(await rejoindre(bob, { pseudo: 'Bob' }));
    await lancerUnePartieCourte(bob);

    const fin = prochain(bob, 'partieTerminee');
    horloge.avancerDe(31_000);
    await fin;
    await laisserPasserLesMessages();

    expect(enregistrer).not.toHaveBeenCalled();
  });

  it('dit au compte que sa partie ne compte pas si tous les essais echouent, et le journalise', async () => {
    const journal = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const annuaire = annuaireDEssai();
    await monter(annuaire);
    const alice = await connecterUnClient({ jeton: JETON_ALICE });
    salonAccepte(await rejoindre(alice, {}));
    await lancerUnePartieCourte(alice);

    annuaire.panne = true;
    const recues = collecter(alice, 'progressionDeFin');
    horloge.avancerDe(31_000);

    // Recette de l'etape 5.4: un enregistrement qui echoue est retente, et l'echec
    // ne se dit qu'une fois le dernier essai tombe.
    for (let essai = 1; essai < ESSAIS_D_ENREGISTREMENT; essai += 1) {
      await laisserPasserLesMessages();
      expect(recues).toEqual([]);
      horloge.avancerDe(ATTENTE_ENTRE_DEUX_ENREGISTREMENTS_MS);
    }

    await laisserPasserLesMessages();

    expect(annuaire.essaisDEnregistrement).toHaveLength(ESSAIS_D_ENREGISTREMENT);
    expect(recues).toEqual([
      { enregistree: false, motif: expect.stringContaining('ne compte pas') as string },
    ]);
    expect(journal).toHaveBeenCalled();
  });

  it('retente un enregistrement qui echoue, sous le meme identifiant, et envoie la progression une fois enregistree', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const annuaire = annuaireDEssai();
    await monter(annuaire);
    const alice = await connecterUnClient({ jeton: JETON_ALICE });
    salonAccepte(await rejoindre(alice, {}));
    await lancerUnePartieCourte(alice);

    annuaire.enregistrementsEnEchec = 1;
    const recues = collecter(alice, 'progressionDeFin');
    horloge.avancerDe(31_000);
    await laisserPasserLesMessages();

    expect(recues).toEqual([]);

    horloge.avancerDe(ATTENTE_ENTRE_DEUX_ENREGISTREMENTS_MS);
    await laisserPasserLesMessages();

    const [premier, second] = annuaire.essaisDEnregistrement;

    expect(annuaire.essaisDEnregistrement).toHaveLength(2);
    expect(second?.id).toBe(premier?.id);
    expect(annuaire.finsEnregistrees).toHaveLength(1);
    expect(recues).toHaveLength(1);
    expect(recues[0]?.enregistree).toBe(true);
  });

  it('enregistre l abandon d un compte parti avant la fin, sans lui envoyer de progression', async () => {
    const annuaire = annuaireDEssai();
    await monter(annuaire);
    const bob = await connecterUnClient();
    const idRoom = salonAccepte(await rejoindre(bob, { pseudo: 'Bob' })).idRoom;
    const alice = await connecterUnClient({ jeton: JETON_ALICE });
    salonAccepte(await rejoindre(alice, { idRoom }));
    await lancerUnePartieCourte(bob);

    horloge.avancerDe(10_000);
    // Le depart doit etre traite AVANT que l'horloge n'amene la fin: on attend que
    // Bob l'apprenne, plutot qu'un delai qui ne suffit plus sur une machine chargee.
    const depart = prochain(bob, 'joueurParti');
    alice.emit('quitter');
    await depart;

    const pourAlice = collecter(alice, 'progressionDeFin');
    const fin = prochain(bob, 'partieTerminee');
    horloge.avancerDe(21_000);
    await fin;
    await laisserPasserLesMessages();

    expect(annuaire.finsEnregistrees.map((enregistree) => enregistree.resultats)).toEqual([
      [
        expect.objectContaining({
          compteId: 'compte-alice',
          placement: 2,
          points: 0,
          xpGagnee: 0,
          piecesGagnees: 0,
          variationPointsLigue: 0,
        }),
      ],
    ]);
    expect(annuaire.finsEnregistrees[0]?.partie.nombreJoueurs).toBe(2);
    expect(pourAlice).toEqual([]);
  });

  it('attend, pour s eteindre, la fin d un enregistrement en cours', async () => {
    const annuaire = annuaireDEssai();
    const monte = await monter(annuaire);
    const alice = await connecterUnClient({ jeton: JETON_ALICE });
    salonAccepte(await rejoindre(alice, {}));
    await lancerUnePartieCourte(alice);

    // L'enregistrement reste en cours tant que le test ne le libere pas: aucun
    // pari sur un delai.
    let liberer: () => void = () => undefined;
    annuaire.verrouDEnregistrement = new Promise((resoudre) => {
      liberer = resoudre;
    });
    const fin = prochain(alice, 'partieTerminee');
    horloge.avancerDe(31_000);
    await fin;

    let eteint = false;
    const extinction = monte.fermer().then(() => {
      eteint = true;
    });
    serveur = undefined;
    await laisserPasserLesMessages();

    expect(eteint).toBe(false);
    expect(annuaire.finsEnregistrees).toHaveLength(0);

    liberer();
    await extinction;

    expect(annuaire.finsEnregistrees).toHaveLength(1);
  });
});
