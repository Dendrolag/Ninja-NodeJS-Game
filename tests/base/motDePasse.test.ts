/**
 * Tests d'integration de la gestion du mot de passe, contre une vraie base Neon
 * (etape 3.4).
 *
 * Ce sont les tests que la fiche de l'etape exige: changement accepte avec l'ancien
 * mot de passe et refuse sans, autres sessions fermees, code de secours qui
 * reinitialise un mot de passe oublie, une seule fois, et connexions de jeu coupees
 * avec leur session. Tout passe par un vrai serveur: des requetes HTTP pour les
 * comptes, de vrais clients Socket.IO pour le jeu.
 *
 * Memes allegements que tests/base/authentification.test.ts: limites de tentatives
 * larges, sauf dans le test qui les verifie, et scrypt allege.
 */

import type {
  CodeDeSecoursEmis,
  EvenementsClientVersServeur,
  EvenementsServeurVersClient,
  ProfilDuCompte,
  ReponseRefusee,
  SessionInscrite,
} from '@neon-ninja/shared';
import {
  BORNES_CODE_DE_SECOURS,
  LIMITES_COMPTES,
  ROUTES_COMPTES,
  validerCodeDeSecours,
} from '@neon-ninja/shared';
import type { LimitesDesComptes, OptionsAuthentification, ServeurMonte } from '@neon-ninja/server';
import {
  Authentification,
  PARAMETRES_SCRYPT,
  creerCompte,
  creerHorlogeManuelle,
  demarrerServeur,
  empreinteDuCode,
  hacherMotDePasse,
  schema,
  trouverCompteParPseudo,
} from '@neon-ninja/server';
import { eq } from 'drizzle-orm';
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

/** Un scrypt allege: ces tests ne portent pas sur l'empreinte. */
const SCRYPT_ALLEGE = { N: 2 ** 10, r: 8, p: 1 };

const MOT_DE_PASSE = 'correct cheval pile agrafe';
const NOUVEAU = 'batterie agrafe cheval correct';

const DELAI_ATTENTE_MS = 5000;

/** Ce qu'une requete HTTP a rendu. */
interface Reponse {
  readonly statut: number;
  readonly corps: unknown;
}

describe.runIf(baseDisponible())('gestion du mot de passe', () => {
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

  /** Monte un serveur avec comptes, et rend son adresse. */
  async function monter(options: Partial<OptionsAuthentification> = {}): Promise<string> {
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

    return `http://localhost:${String(adresse.port)}`;
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
    };
  }

  /** Inscrit un compte et rend sa session et son code, ou fait echouer le test. */
  async function inscrire(url: string, pseudo: string): Promise<SessionInscrite> {
    const reponse = await requete(url, ROUTES_COMPTES.inscription, {
      corps: { pseudo, motDePasse: MOT_DE_PASSE },
    });
    expect(reponse.statut).toBe(201);

    return reponse.corps as SessionInscrite;
  }

  /** Ouvre une autre session du compte, comme depuis un autre appareil. */
  async function seConnecter(url: string, pseudo: string, motDePasse: string): Promise<Reponse> {
    return requete(url, ROUTES_COMPTES.connexion, { corps: { pseudo, motDePasse } });
  }

  /** Le jeton d'une connexion acceptee, ou un echec de test. */
  async function jetonDeConnexion(
    url: string,
    pseudo: string,
    motDePasse: string,
  ): Promise<string> {
    const reponse = await seConnecter(url, pseudo, motDePasse);
    expect(reponse.statut).toBe(200);

    return (reponse.corps as SessionInscrite).jeton;
  }

  /** Le statut de la lecture de sa progression avec ce jeton: 200 si la session est ouverte. */
  async function statutDeLaSession(url: string, jeton: string): Promise<number> {
    return (await requete(url, ROUTES_COMPTES.moi, { methode: 'GET', jeton })).statut;
  }

  /** Change le mot de passe avec cette session. */
  async function changer(
    url: string,
    jeton: string,
    motDePasse: unknown,
    nouveauMotDePasse: unknown = NOUVEAU,
  ): Promise<Reponse> {
    return requete(url, ROUTES_COMPTES.motDePasse, {
      jeton,
      corps: { motDePasse, nouveauMotDePasse },
    });
  }

  /** Reinitialise le mot de passe avec ce code. */
  async function reinitialiser(
    url: string,
    pseudo: string,
    codeDeSecours: string,
  ): Promise<Reponse> {
    return requete(url, ROUTES_COMPTES.reinitialisation, {
      corps: { pseudo, codeDeSecours, nouveauMotDePasse: NOUVEAU },
    });
  }

  /** L'empreinte du code de secours d'un compte, lue en base. */
  async function empreinteEnBase(pseudo: string): Promise<string | undefined> {
    const compte = await trouverCompteParPseudo(db(), pseudo);
    const [ligne] = await db()
      .select({ empreinte: schema.codesDeSecours.empreinte })
      .from(schema.codesDeSecours)
      .where(eq(schema.codesDeSecours.compteId, compte?.id ?? ''));

    return ligne?.empreinte;
  }

  /** L'empreinte d'un code affiche, telle que la base doit la garder. */
  function empreinteAffichee(code: string): string {
    return empreinteDuCode(accepte(validerCodeDeSecours(code)));
  }

  /** Ouvre une connexion de jeu avec cette session. */
  async function connecterAuJeu(url: string, jeton: string): Promise<ClientDeJeu> {
    const client: ClientDeJeu = io(url, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      auth: { jeton },
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

  describe('changement du mot de passe', () => {
    it('accepte l ancien mot de passe, ferme les autres sessions et garde la courante', async () => {
      const url = await monter();
      const pseudo = pseudoNeuf('Chloe');
      const inscription = await inscrire(url, pseudo);
      const autre = await jetonDeConnexion(url, pseudo, MOT_DE_PASSE);

      const reponse = await changer(url, inscription.jeton, MOT_DE_PASSE);

      expect(reponse.statut).toBe(200);
      expect(await statutDeLaSession(url, inscription.jeton)).toBe(200);
      expect(await statutDeLaSession(url, autre)).toBe(401);
      expect((await seConnecter(url, pseudo, MOT_DE_PASSE)).statut).toBe(401);
      expect((await seConnecter(url, pseudo, NOUVEAU)).statut).toBe(200);
    });

    it('renouvelle le code de secours: l ancien ne vaut plus rien, le nouveau reinitialise', async () => {
      const url = await monter();
      const pseudo = pseudoNeuf('Diane');
      const inscription = await inscrire(url, pseudo);

      const { codeDeSecours } = (await changer(url, inscription.jeton, MOT_DE_PASSE))
        .corps as CodeDeSecoursEmis;

      expect(codeDeSecours).not.toBe(inscription.codeDeSecours);
      expect(await empreinteEnBase(pseudo)).toBe(empreinteAffichee(codeDeSecours));
      expect((await reinitialiser(url, pseudo, inscription.codeDeSecours)).statut).toBe(401);
      expect((await reinitialiser(url, pseudo, codeDeSecours)).statut).toBe(200);
    });

    it('refuse un mot de passe actuel faux en 403, sans rien changer ni fermer', async () => {
      const url = await monter();
      const pseudo = pseudoNeuf('Emile');
      const inscription = await inscrire(url, pseudo);
      const autre = await jetonDeConnexion(url, pseudo, MOT_DE_PASSE);

      const faux = await changer(url, inscription.jeton, 'pas le bon mot de passe');

      expect(faux.statut).toBe(403);
      expect(faux.corps).toEqual({
        erreurs: [{ champ: 'motDePasse', motif: 'Mot de passe incorrect.' }],
      });
      expect(await statutDeLaSession(url, inscription.jeton)).toBe(200);
      expect(await statutDeLaSession(url, autre)).toBe(200);
      expect((await seConnecter(url, pseudo, MOT_DE_PASSE)).statut).toBe(200);
      expect(await empreinteEnBase(pseudo)).toBe(empreinteAffichee(inscription.codeDeSecours));
    });

    it('refuse sans l ancien mot de passe, sans session, ou avec un nouveau trop court', async () => {
      const url = await monter();
      const pseudo = pseudoNeuf('Fanny');
      const inscription = await inscrire(url, pseudo);

      const sansAncien = await requete(url, ROUTES_COMPTES.motDePasse, {
        jeton: inscription.jeton,
        corps: { nouveauMotDePasse: NOUVEAU },
      });
      const sansSession = await requete(url, ROUTES_COMPTES.motDePasse, {
        corps: { motDePasse: MOT_DE_PASSE, nouveauMotDePasse: NOUVEAU },
      });
      const tropCourt = await changer(url, inscription.jeton, MOT_DE_PASSE, 'court');

      expect(sansAncien.statut).toBe(400);
      expect((sansAncien.corps as ReponseRefusee).erreurs[0]?.champ).toBe('motDePasse');
      expect(sansSession.statut).toBe(401);
      expect(tropCourt.statut).toBe(400);
      expect((tropCourt.corps as ReponseRefusee).erreurs[0]?.champ).toBe('nouveauMotDePasse');
      expect((await seConnecter(url, pseudo, MOT_DE_PASSE)).statut).toBe(200);
    });

    it('compte ses essais avec ceux de la connexion', async () => {
      const url = await monter({
        limites: { ...LIMITES_LARGES, connexionParPseudo: LIMITES_COMPTES.connexionParPseudo },
      });
      const pseudo = pseudoNeuf('Gael');
      const inscription = await inscrire(url, pseudo);
      const { rafale } = LIMITES_COMPTES.connexionParPseudo;

      for (let essai = 0; essai < rafale; essai += 1) {
        expect((await changer(url, inscription.jeton, `essai ${String(essai)}`)).statut).toBe(403);
      }

      expect((await changer(url, inscription.jeton, MOT_DE_PASSE)).statut).toBe(429);
      expect((await seConnecter(url, pseudo, MOT_DE_PASSE)).statut).toBe(429);
    });

    it('coupe la connexion de jeu d une session fermee, et garde celle de la session courante', async () => {
      const url = await monter();
      const pseudo = pseudoNeuf('Hugo');
      const inscription = await inscrire(url, pseudo);
      const autre = await jetonDeConnexion(url, pseudo, MOT_DE_PASSE);

      const courante = await connecterAuJeu(url, inscription.jeton);
      const fermee = await connecterAuJeu(url, autre);
      const coupure = new Promise<string>((resoudre) => {
        fermee.once('disconnect', resoudre);
      });

      expect((await changer(url, inscription.jeton, MOT_DE_PASSE)).statut).toBe(200);

      expect(await coupure).toBe('io server disconnect');
      expect(courante.connected).toBe(true);
      await expect(connecterAuJeu(url, autre)).rejects.toThrow('Session invalide');
    });
  });

  describe('code de secours', () => {
    it('le code remis a l inscription reinitialise le mot de passe, ferme toutes les sessions et connecte', async () => {
      const url = await monter();
      const pseudo = pseudoNeuf('Irene');
      const inscription = await inscrire(url, pseudo);
      const autre = await jetonDeConnexion(url, pseudo, MOT_DE_PASSE);

      expect(inscription.codeDeSecours).toMatch(/^[0-9A-Z]{4}(-[0-9A-Z]{4}){3}$/u);
      expect(await empreinteEnBase(pseudo)).toBe(empreinteAffichee(inscription.codeDeSecours));

      // Recopie a la main: en minuscules, sans tirets, pseudo dans une autre casse.
      const recopie = inscription.codeDeSecours.toLowerCase().replaceAll('-', ' ');
      const reponse = await reinitialiser(url, pseudo.toUpperCase(), recopie);
      const session = reponse.corps as SessionInscrite;

      expect(reponse.statut).toBe(200);
      expect(session.compte).toEqual({ pseudo, niveau: 1 });
      expect(session.codeDeSecours).not.toBe(inscription.codeDeSecours);
      expect(await statutDeLaSession(url, inscription.jeton)).toBe(401);
      expect(await statutDeLaSession(url, autre)).toBe(401);
      expect(await statutDeLaSession(url, session.jeton)).toBe(200);
      expect((await seConnecter(url, pseudo, MOT_DE_PASSE)).statut).toBe(401);
      expect((await seConnecter(url, pseudo, NOUVEAU)).statut).toBe(200);
    });

    it('ne sert qu une fois', async () => {
      const url = await monter();
      const pseudo = pseudoNeuf('Jade');
      const { codeDeSecours } = await inscrire(url, pseudo);

      expect((await reinitialiser(url, pseudo, codeDeSecours)).statut).toBe(200);
      expect((await reinitialiser(url, pseudo, codeDeSecours)).statut).toBe(401);
    });

    it('refuse un code faux, un pseudo inconnu et un compte sans code, avec la meme reponse', async () => {
      const url = await monter();
      const pseudo = pseudoNeuf('Kevin');
      const { codeDeSecours } = await inscrire(url, pseudo);
      const sansCode = pseudoNeuf('Lina');
      accepte(
        await creerCompte(db(), sansCode, {
          empreinteMotDePasse: await hacherMotDePasse(MOT_DE_PASSE, SCRYPT_ALLEGE),
        }),
      );
      const autreCode = BORNES_CODE_DE_SECOURS.alphabet.slice(0, 16);

      const faux = await reinitialiser(url, pseudo, autreCode);
      const inconnu = await reinitialiser(url, pseudoNeuf('Personne'), codeDeSecours);
      const sans = await reinitialiser(url, sansCode, codeDeSecours);

      for (const reponse of [faux, inconnu, sans]) {
        expect(reponse.statut).toBe(401);
        expect(reponse.corps).toEqual({
          erreurs: [{ champ: 'reinitialisation', motif: 'Pseudo ou code de secours incorrect.' }],
        });
      }
      expect((await reinitialiser(url, pseudo, codeDeSecours)).statut).toBe(200);
    });

    it('se renouvelle depuis le profil contre le mot de passe, et l ancien ne vaut plus rien', async () => {
      const url = await monter();
      const pseudo = pseudoNeuf('Malo');
      const inscription = await inscrire(url, pseudo);
      const autre = await jetonDeConnexion(url, pseudo, MOT_DE_PASSE);

      const faux = await requete(url, ROUTES_COMPTES.codeDeSecours, {
        jeton: inscription.jeton,
        corps: { motDePasse: 'pas le bon' },
      });
      const nouveau = await requete(url, ROUTES_COMPTES.codeDeSecours, {
        jeton: inscription.jeton,
        corps: { motDePasse: MOT_DE_PASSE },
      });
      const { codeDeSecours } = nouveau.corps as CodeDeSecoursEmis;

      expect(faux.statut).toBe(403);
      expect(nouveau.statut).toBe(200);
      // Un nouveau code ne ferme aucune session.
      expect(await statutDeLaSession(url, autre)).toBe(200);
      expect((await reinitialiser(url, pseudo, inscription.codeDeSecours)).statut).toBe(401);
      expect((await reinitialiser(url, pseudo, codeDeSecours)).statut).toBe(200);
    });

    it('donne un code a un compte cree avant l etape 3.4, qui n en avait pas', async () => {
      const url = await monter();
      const pseudo = pseudoNeuf('Nadia');
      accepte(
        await creerCompte(db(), pseudo, {
          empreinteMotDePasse: await hacherMotDePasse(MOT_DE_PASSE, PARAMETRES_SCRYPT),
        }),
      );
      expect(await empreinteEnBase(pseudo)).toBeUndefined();

      const jeton = await jetonDeConnexion(url, pseudo, MOT_DE_PASSE);
      /** Ce que le profil dit du code de secours. */
      const profilDitUnCode = async (): Promise<unknown> =>
        (
          (await requete(url, ROUTES_COMPTES.profil, { methode: 'GET', jeton }))
            .corps as ProfilDuCompte
        ).codeDeSecours;

      expect(await profilDitUnCode()).toBe(false);

      const reponse = await requete(url, ROUTES_COMPTES.codeDeSecours, {
        jeton,
        corps: { motDePasse: MOT_DE_PASSE },
      });
      const { codeDeSecours } = reponse.corps as CodeDeSecoursEmis;

      expect(reponse.statut).toBe(200);
      expect(await profilDitUnCode()).toBe(true);
      expect(await empreinteEnBase(pseudo)).toBe(empreinteAffichee(codeDeSecours));
      expect((await reinitialiser(url, pseudo, codeDeSecours)).statut).toBe(200);
    });
  });
});
