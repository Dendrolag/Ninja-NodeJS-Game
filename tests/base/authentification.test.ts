/**
 * Tests d'integration de l'authentification, contre une vraie base Neon.
 *
 * Ce sont les tests que la fiche de l'etape 3.2 exige: inscription, connexion,
 * acces reserve aux comptes, et connexion reseau. Tout passe par un vrai serveur
 * qui ecoute sur un vrai port: des requetes HTTP pour les comptes, de vrais
 * clients Socket.IO pour le jeu.
 *
 * Deux allegements, sans rien retirer a ce qui est verifie. Les limites de
 * tentatives sont larges, sauf dans les tests qui les verifient: tous les tests
 * viennent de la meme adresse. Et scrypt est allege, sauf dans le test qui
 * verifie l'empreinte ecrite en base.
 */

import type {
  EvenementsClientVersServeur,
  EvenementsServeurVersClient,
  InfosSalon,
  ReponseRefusee,
  ResultatValidation,
  SessionOuverte,
} from '@neon-ninja/shared';
import { LIMITES_COMPTES, ROUTES_COMPTES } from '@neon-ninja/shared';
import type {
  HorlogeManuelle,
  LimitesDesComptes,
  OptionsAuthentification,
  ServeurMonte,
} from '@neon-ninja/server';
import {
  Authentification,
  PARAMETRES_SCRYPT,
  creerCompte,
  creerHorlogeManuelle,
  demarrerServeur,
  ecrireProgression,
  empreinteDuJeton,
  fabriquerJeton,
  schema,
  trouverCompteParPseudo,
} from '@neon-ninja/server';
import { eq, sql } from 'drizzle-orm';
import type { Socket } from 'socket.io-client';
import { io } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';

import { accepte, baseDeTest, baseDisponible, pseudoNeuf } from './contexte.js';

/** Un client de jeu: les contrats vus a l'envers de ceux du serveur. */
type ClientDeJeu = Socket<EvenementsServeurVersClient, EvenementsClientVersServeur>;

/** Des limites que les tests ne peuvent pas atteindre sans le vouloir. */
const LIMITES_LARGES: LimitesDesComptes = {
  connexionParPseudo: { parSeconde: 100, rafale: 1000 },
  connexionParAdresse: { parSeconde: 100, rafale: 1000 },
  inscriptionParAdresse: { parSeconde: 100, rafale: 1000 },
};

/** Un scrypt allege, pour les tests qui ne portent pas sur l'empreinte. */
const SCRYPT_ALLEGE = { N: 2 ** 10, r: 8, p: 1 };

const MOT_DE_PASSE = 'correct cheval pile agrafe';

const DELAI_ATTENTE_MS = 5000;

/** Ce qu'une requete HTTP a rendu. */
interface Reponse {
  readonly statut: number;
  readonly corps: unknown;
  readonly entetes: Headers;
}

describe.runIf(baseDisponible())('authentification', () => {
  const db = baseDeTest();
  const serveurs: ServeurMonte[] = [];
  const clients: ClientDeJeu[] = [];

  afterEach(async () => {
    for (const client of clients.splice(0)) {
      client.disconnect();
    }

    for (const serveur of serveurs.splice(0)) {
      await serveur.fermer();
    }
  });

  /** Un serveur de jeu avec ses comptes, et ce qu'il faut pour le piloter. */
  interface ServeurDeTest {
    readonly url: string;
    readonly horloge: HorlogeManuelle;
    readonly serveur: ServeurMonte;
  }

  /** Monte un serveur avec comptes. Limites larges et scrypt allege par defaut. */
  async function monter(options: Partial<OptionsAuthentification> = {}): Promise<ServeurDeTest> {
    const horloge = creerHorlogeManuelle();
    const comptes = new Authentification({
      db: db(),
      horloge,
      limites: LIMITES_LARGES,
      parametresScrypt: SCRYPT_ALLEGE,
      ...options,
    });
    const serveur = await demarrerServeur(0, { horloge, comptes });
    serveurs.push(serveur);

    const adresse = serveur.http.address();
    if (typeof adresse !== 'object' || adresse === null) {
      throw new Error("Le serveur de test n'a pas d'adresse.");
    }

    return { url: `http://localhost:${String(adresse.port)}`, horloge, serveur };
  }

  /** Envoie une requete HTTP et lit sa reponse. */
  async function requete(
    url: string,
    chemin: string,
    options: { readonly corps?: unknown; readonly jeton?: string; readonly methode?: string } = {},
  ): Promise<Reponse> {
    const reponse = await fetch(`${url}${chemin}`, {
      method: options.methode ?? 'POST',
      headers: {
        ...(options.corps === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(options.jeton === undefined ? {} : { Authorization: `Bearer ${options.jeton}` }),
      },
      ...(options.corps === undefined ? {} : { body: JSON.stringify(options.corps) }),
    });
    const texte = await reponse.text();

    return {
      statut: reponse.status,
      corps: texte === '' ? undefined : (JSON.parse(texte) as unknown),
      entetes: reponse.headers,
    };
  }

  /** Inscrit un compte et rend sa session, ou fait echouer le test. */
  async function inscrire(url: string, pseudo: string): Promise<SessionOuverte> {
    const reponse = await requete(url, ROUTES_COMPTES.inscription, {
      corps: { pseudo, motDePasse: MOT_DE_PASSE },
    });

    if (reponse.statut !== 201) {
      throw new Error(
        `Inscription refusee (${String(reponse.statut)}): ${JSON.stringify(reponse.corps)}`,
      );
    }

    return reponse.corps as SessionOuverte;
  }

  /** Tente une connexion avec ce mot de passe. */
  async function seConnecter(url: string, pseudo: string, motDePasse: string): Promise<Reponse> {
    return requete(url, ROUTES_COMPTES.connexion, { corps: { pseudo, motDePasse } });
  }

  /** L'identifiant d'un compte, lu en base. */
  async function idDuCompte(pseudo: string): Promise<string> {
    const compte = await trouverCompteParPseudo(db(), pseudo);
    if (compte === undefined) {
      throw new Error(`Aucun compte ${pseudo}.`);
    }

    return compte.id;
  }

  /** Ouvre une connexion de jeu. Rejette avec l'erreur du serveur si elle est refusee. */
  async function connecterAuJeu(url: string, jeton?: string): Promise<ClientDeJeu> {
    const client: ClientDeJeu = io(url, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      ...(jeton === undefined ? {} : { auth: { jeton } }),
    });
    clients.push(client);

    await new Promise<void>((resoudre, rejeter) => {
      const minuterie = setTimeout(() => {
        rejeter(new Error("La connexion au jeu n'a pas abouti."));
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

  /** Demande a entrer dans une partie, et attend le verdict. */
  async function rejoindre(
    client: ClientDeJeu,
    demande: { readonly pseudo?: string; readonly idRoom?: string },
  ): Promise<ResultatValidation<InfosSalon>> {
    return new Promise((resoudre, rejeter) => {
      const minuterie = setTimeout(() => {
        rejeter(new Error("Le serveur n'a pas repondu a la demande d'entree."));
      }, DELAI_ATTENTE_MS);

      client.emit('rejoindre', demande, (reponse) => {
        clearTimeout(minuterie);
        resoudre(reponse);
      });
    });
  }

  describe('inscription', () => {
    it('cree un compte, hache son mot de passe et ouvre une session', async () => {
      const { url } = await monter({ parametresScrypt: PARAMETRES_SCRYPT });
      const pseudo = pseudoNeuf('Ines');

      const session = await inscrire(url, pseudo);

      expect(session.compte).toEqual({ pseudo, niveau: 1 });
      expect(session.jeton).toMatch(/^[A-Za-z0-9_-]{43}$/u);

      const [identifiant] = await db()
        .select({ empreinte: schema.motsDePasse.empreinte })
        .from(schema.motsDePasse)
        .where(eq(schema.motsDePasse.compteId, await idDuCompte(pseudo)));
      const { N, r, p } = PARAMETRES_SCRYPT;

      expect(
        identifiant?.empreinte.startsWith(`scrypt$${String(N)}$${String(r)}$${String(p)}$`),
      ).toBe(true);
      expect(identifiant?.empreinte).not.toContain(MOT_DE_PASSE);
    });

    it('ne garde en base que l empreinte du jeton, jamais le jeton', async () => {
      const { url } = await monter();
      const session = await inscrire(url, pseudoNeuf('Jules'));

      const parEmpreinte = await db()
        .select()
        .from(schema.sessions)
        .where(eq(schema.sessions.empreinteJeton, empreinteDuJeton(session.jeton)));
      const parJeton = await db()
        .select()
        .from(schema.sessions)
        .where(eq(schema.sessions.empreinteJeton, session.jeton));

      expect(parEmpreinte).toHaveLength(1);
      expect(parJeton).toHaveLength(0);
    });

    it('refuse un pseudo deja pris, meme ecrit autrement, sans creer de second compte', async () => {
      const { url } = await monter();
      const pseudo = pseudoNeuf('Karim');
      await inscrire(url, pseudo);

      const refus = await requete(url, ROUTES_COMPTES.inscription, {
        corps: { pseudo: pseudo.toUpperCase(), motDePasse: 'un autre secret' },
      });

      expect(refus.statut).toBe(409);
      expect((refus.corps as ReponseRefusee).erreurs[0]?.champ).toBe('pseudo');
      const memes = await db()
        .select()
        .from(schema.comptes)
        .where(eq(schema.comptes.pseudo, pseudo.toUpperCase()));
      expect(memes).toHaveLength(0);
    });

    it('refuse une demande invalide sans rien ecrire', async () => {
      const { url } = await monter();
      const pseudo = pseudoNeuf('Lea');

      const refus = await requete(url, ROUTES_COMPTES.inscription, {
        corps: { pseudo, motDePasse: 'court' },
      });

      expect(refus.statut).toBe(400);
      expect((refus.corps as ReponseRefusee).erreurs[0]?.champ).toBe('motDePasse');
      expect(await trouverCompteParPseudo(db(), pseudo)).toBeUndefined();
    });
  });

  describe('connexion', () => {
    it('accepte des identifiants valides et ouvre une nouvelle session', async () => {
      const { url } = await monter();
      const pseudo = pseudoNeuf('Marc');
      const inscription = await inscrire(url, pseudo);

      const reponse = await seConnecter(url, pseudo.toLowerCase(), MOT_DE_PASSE);
      const session = reponse.corps as SessionOuverte;

      expect(reponse.statut).toBe(200);
      expect(session.compte).toEqual({ pseudo, niveau: 1 });
      expect(session.jeton).not.toBe(inscription.jeton);
    });

    it('refuse un mauvais mot de passe et un pseudo inconnu, avec la meme reponse', async () => {
      const { url } = await monter();
      const pseudo = pseudoNeuf('Nina');
      await inscrire(url, pseudo);

      const mauvais = await seConnecter(url, pseudo, 'pas le bon mot de passe');
      const inconnu = await seConnecter(url, pseudoNeuf('Personne'), MOT_DE_PASSE);

      expect(mauvais.statut).toBe(401);
      expect(inconnu.statut).toBe(401);
      expect(mauvais.corps).toEqual(inconnu.corps);
      expect(mauvais.corps).toEqual({
        erreurs: [{ champ: 'connexion', motif: 'Pseudo ou mot de passe incorrect.' }],
      });
    });

    it('refuse la connexion a un compte qui n a pas de mot de passe', async () => {
      const { url } = await monter();
      const pseudo = pseudoNeuf('Oscar');
      accepte(await creerCompte(db(), pseudo));

      expect((await seConnecter(url, pseudo, MOT_DE_PASSE)).statut).toBe(401);
    });

    it('limite les tentatives repetees sur un compte, meme avec le bon mot de passe', async () => {
      const { url, horloge } = await monter({ limites: LIMITES_COMPTES });
      const pseudo = pseudoNeuf('Paul');
      await inscrire(url, pseudo);
      const { rafale } = LIMITES_COMPTES.connexionParPseudo;

      for (let essai = 0; essai < rafale; essai += 1) {
        expect((await seConnecter(url, pseudo, `essai ${String(essai)}`)).statut).toBe(401);
      }

      const bloquee = await seConnecter(url, pseudo, MOT_DE_PASSE);
      expect(bloquee.statut).toBe(429);
      expect(Number(bloquee.entetes.get('retry-after'))).toBeGreaterThanOrEqual(60);
      expect((bloquee.corps as ReponseRefusee).erreurs[0]?.champ).toBe('tentatives');

      horloge.avancerDe(61_000);
      expect((await seConnecter(url, pseudo, MOT_DE_PASSE)).statut).toBe(200);
    });

    it('limite les tentatives depuis une meme adresse, tous comptes confondus', async () => {
      const { url } = await monter({
        limites: { ...LIMITES_LARGES, connexionParAdresse: { parSeconde: 1 / 60, rafale: 2 } },
      });

      expect((await seConnecter(url, pseudoNeuf('Quentin'), MOT_DE_PASSE)).statut).toBe(401);
      expect((await seConnecter(url, pseudoNeuf('Rose'), MOT_DE_PASSE)).statut).toBe(401);
      expect((await seConnecter(url, pseudoNeuf('Sam'), MOT_DE_PASSE)).statut).toBe(429);
    });
  });

  describe('acces reserve aux comptes', () => {
    it('refuse la lecture de sa progression sans session valide', async () => {
      const { url } = await monter();

      const sansJeton = await requete(url, ROUTES_COMPTES.moi, { methode: 'GET' });
      const jetonInconnu = await requete(url, ROUTES_COMPTES.moi, {
        methode: 'GET',
        jeton: fabriquerJeton(),
      });

      expect(sansJeton.statut).toBe(401);
      expect(jetonInconnu.statut).toBe(401);
      expect(jetonInconnu.entetes.get('www-authenticate')).toBe('Bearer');
    });

    it('rend sa progression, et son niveau deduit, a qui presente sa session', async () => {
      const { url } = await monter();
      const pseudo = pseudoNeuf('Theo');
      const session = await inscrire(url, pseudo);
      await ecrireProgression(db(), await idDuCompte(pseudo), {
        xpTotale: 2500,
        pieces: 40,
        pointsLigue: 12,
      });

      const reponse = await requete(url, ROUTES_COMPTES.moi, {
        methode: 'GET',
        jeton: session.jeton,
      });

      expect(reponse.statut).toBe(200);
      expect(reponse.corps).toEqual({
        pseudo,
        niveau: 3,
        xpTotale: 2500,
        pieces: 40,
        pointsLigue: 12,
        inscritLe: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/u),
      });
    });

    it('ferme la session a la deconnexion', async () => {
      const { url } = await monter();
      const session = await inscrire(url, pseudoNeuf('Ugo'));

      const deconnexion = await requete(url, ROUTES_COMPTES.deconnexion, { jeton: session.jeton });
      const apres = await requete(url, ROUTES_COMPTES.moi, {
        methode: 'GET',
        jeton: session.jeton,
      });

      expect(deconnexion.statut).toBe(204);
      expect(apres.statut).toBe(401);
    });

    it('n ouvre plus rien avec une session expiree', async () => {
      const { url } = await monter();
      const session = await inscrire(url, pseudoNeuf('Vera'));

      await db()
        .update(schema.sessions)
        .set({ creeLe: sql`now() - interval '31 days'`, expireLe: sql`now() - interval '1 day'` })
        .where(eq(schema.sessions.empreinteJeton, empreinteDuJeton(session.jeton)));

      const reponse = await requete(url, ROUTES_COMPTES.moi, {
        methode: 'GET',
        jeton: session.jeton,
      });

      expect(reponse.statut).toBe(401);
    });
  });

  describe('connexion reseau', () => {
    it('fait entrer une connexion authentifiee sous le pseudo et le niveau de son compte', async () => {
      const { url } = await monter();
      const pseudo = pseudoNeuf('Wanda');
      const session = await inscrire(url, pseudo);
      await ecrireProgression(db(), await idDuCompte(pseudo), {
        xpTotale: 2500,
        pieces: 0,
        pointsLigue: 0,
      });

      const client = await connecterAuJeu(url, session.jeton);
      const reponse = await rejoindre(client, { pseudo: pseudoNeuf('Masque') });

      expect(reponse).toEqual({
        valide: true,
        valeur: expect.objectContaining({
          joueurs: [{ id: client.id, pseudo, hote: true, compte: { niveau: 3 } }],
        }),
      });
    });

    it('fait entrer une connexion sans jeton en invite, sous son pseudo, a cote d un compte', async () => {
      const { url } = await monter();
      const session = await inscrire(url, pseudoNeuf('Xavier'));
      const compte = await connecterAuJeu(url, session.jeton);
      const entree = await rejoindre(compte, {});
      const idRoom = entree.valide ? entree.valeur.idRoom : '';

      const invite = await connecterAuJeu(url);
      const pseudoInvite = pseudoNeuf('Invite');
      const reponse = await rejoindre(invite, { pseudo: pseudoInvite, idRoom });

      expect(reponse.valide).toBe(true);
      const joueurs = reponse.valide ? reponse.valeur.joueurs : [];
      expect(joueurs.map((joueur) => [joueur.pseudo, joueur.compte])).toEqual([
        [session.compte.pseudo, { niveau: 1 }],
        [pseudoInvite, undefined],
      ]);
    });

    it('refuse a un invite le pseudo d un compte, quelle que soit son ecriture', async () => {
      const { url, serveur } = await monter();
      const pseudo = pseudoNeuf('Yasmine');
      await inscrire(url, pseudo);

      const invite = await connecterAuJeu(url);
      const reponse = await rejoindre(invite, { pseudo: ` ${pseudo.toUpperCase()} ` });

      expect(reponse.valide).toBe(false);
      expect(reponse.valide ? undefined : reponse.erreurs[0]?.champ).toBe('pseudo');
      expect(serveur.jeu.rooms.nombreDeRooms).toBe(0);
    });

    it('refuse une connexion reseau dont la session est inconnue ou fermee', async () => {
      const { url } = await monter();
      const session = await inscrire(url, pseudoNeuf('Zoe'));
      await requete(url, ROUTES_COMPTES.deconnexion, { jeton: session.jeton });

      await expect(connecterAuJeu(url, fabriquerJeton())).rejects.toThrow('Session invalide');
      await expect(connecterAuJeu(url, session.jeton)).rejects.toThrow('Session invalide');
    });
  });
});
