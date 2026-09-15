/**
 * Tests d'integration de la progression branchee sur la fin de partie (etape 3.3),
 * contre une vraie base Neon.
 *
 * Ce sont les tests que la fiche de l'etape exige. Tout est reel: un serveur qui
 * ecoute sur un port, des clients Socket.IO, l'authentification et la base. Seul le
 * temps du jeu est manuel, pour qu'une partie de trois minutes passe en quelques
 * secondes.
 *
 * LE CLASSEMENT D'UNE PARTIE DEPEND DU HASARD: les bots errent au gre de la graine,
 * tiree au hasard, et touchent qui ils croisent. Les attentes se deduisent donc du
 * bilan de la room, lu a la fin, et des regles de @neon-ninja/shared, dont les
 * valeurs sont figees par leurs propres tests. Ce qui est verifie ici: que la base
 * et le recapitulatif refletent exactement ces regles appliquees a cette partie.
 *
 * LE PASSAGE DE NIVEAU ET DE PALIER EST GARANTI QUEL QUE SOIT LE CLASSEMENT. Les
 * deux comptes partent de 99 XP (le niveau 2 est a 100) et de 95 points de ligue
 * (Argent est a 100). Une partie de trois minutes rapporte au moins 30 XP; et a
 * trois joueurs, seul le dernier perd des points: au moins un des deux comptes
 * passe Argent.
 */

import type {
  EvenementsClientVersServeur,
  EvenementsServeurVersClient,
  InfosSalon,
  ProgressionDeFin,
  ResultatValidation,
} from '@neon-ninja/shared';
import { niveauDeXp, palierDePoints, recompensesDePartie } from '@neon-ninja/shared';
import type {
  BilanDePartie,
  HorlogeManuelle,
  ServeurMonte,
  ValeursProgression,
} from '@neon-ninja/server';
import {
  Authentification,
  DUREE_SESSION_MS,
  creerCompte,
  creerHorlogeManuelle,
  demarrerServeur,
  ecrireProgression,
  empreinteDuJeton,
  fabriquerJeton,
  lireHistorique,
  lireProgression,
  ouvrirSession,
} from '@neon-ninja/server';
import type { Socket } from 'socket.io-client';
import { io } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { accepte, baseDeTest, baseDisponible, pseudoNeuf } from './contexte.js';

/** Un client de jeu: les contrats vus a l'envers de ceux du serveur. */
type ClientDeJeu = Socket<EvenementsServeurVersClient, EvenementsClientVersServeur>;

/**
 * Delai d'attente d'un message. Large: une partie de trois minutes pousse des
 * milliers d'instantanes avant la fin, et l'enregistrement passe par Neon.
 */
const DELAI_ATTENTE_MS = 20_000;

/** Des reglages de partie de trois minutes, peu peuplee et sans bot noir. */
const REGLAGES_LEGERS = { dureePartieS: 180, nombreBotsInitial: 10, botsNoirs: { actifs: false } };

/** Un compte cree pour le test, avec la session qui le connecte. */
interface CompteDeTest {
  readonly id: string;
  readonly pseudo: string;
  readonly jeton: string;
}

describe.runIf(baseDisponible())('progression branchee sur la fin de partie', () => {
  const db = baseDeTest();

  let serveur: ServeurMonte | undefined;
  let horloge: HorlogeManuelle = creerHorlogeManuelle();
  let url = '';
  const clients: ClientDeJeu[] = [];

  beforeAll(async () => {
    horloge = creerHorlogeManuelle();
    serveur = await demarrerServeur(0, {
      horloge,
      comptes: new Authentification({ db: db(), horloge }),
    });

    const adresse = serveur.http.address();
    if (typeof adresse !== 'object' || adresse === null) {
      throw new Error("Le serveur de test n'a pas d'adresse.");
    }

    url = `http://localhost:${String(adresse.port)}`;
  });

  afterAll(async () => {
    for (const client of clients.splice(0)) {
      client.disconnect();
    }

    await serveur?.fermer();
  });

  /** Cree un compte avec cette progression, et lui ouvre une session. */
  async function compteAvec(
    prefixe: string,
    progression: ValeursProgression,
  ): Promise<CompteDeTest> {
    const pseudo = pseudoNeuf(prefixe);
    const compte = accepte(await creerCompte(db(), pseudo));
    const jeton = fabriquerJeton();

    await ecrireProgression(db(), compte.id, progression);
    await ouvrirSession(db(), compte.id, empreinteDuJeton(jeton), DUREE_SESSION_MS);

    return { id: compte.id, pseudo, jeton };
  }

  /** Ouvre une connexion de jeu, avec ou sans session. */
  async function connecterAuJeu(jeton?: string): Promise<ClientDeJeu> {
    const client: ClientDeJeu = io(url, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      ...(jeton === undefined ? {} : { auth: { jeton } }),
    });
    clients.push(client);

    await new Promise<void>((resoudre, rejeter) => {
      client.on('connect', () => {
        resoudre();
      });
      client.on('connect_error', rejeter);
    });

    return client;
  }

  /** Entre dans une partie, et rend son identifiant. */
  async function entrer(
    client: ClientDeJeu,
    demande: { readonly pseudo?: string; readonly idRoom?: string },
  ): Promise<string> {
    const reponse = await new Promise<ResultatValidation<InfosSalon>>((resoudre) => {
      client.emit('rejoindre', demande, resoudre);
    });

    if (!reponse.valide) {
      throw new Error(`Entree refusee: ${reponse.erreurs.map((e) => e.motif).join(', ')}`);
    }

    return reponse.valeur.idRoom;
  }

  /** Attend le prochain message de ce nom. */
  async function prochain<Nom extends keyof EvenementsServeurVersClient>(
    client: ClientDeJeu,
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

  /** Laisse le reseau acheminer ce qui est deja parti. */
  async function laisserPasser(): Promise<void> {
    await new Promise((resoudre) => setTimeout(resoudre, 50));
  }

  /**
   * Attend un etat du salon qui remplit cette condition.
   *
   * Pas simplement le prochain: celui qui suit une entree peut encore etre en route.
   */
  async function salonQui(
    client: ClientDeJeu,
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
   * L'hote regle la partie et la lance: decompte complet, jusqu'au premier battement.
   *
   * Chaque etape attend la preuve que le serveur l'a traitee avant de faire avancer
   * l'horloge du jeu: un delai fixe ne le garantit pas sur une machine chargee.
   */
  async function lancer(hote: ClientDeJeu): Promise<void> {
    const reglee = salonQui(
      hote,
      (salon) => salon.reglages.nombreBotsInitial === REGLAGES_LEGERS.nombreBotsInitial,
    );
    hote.emit('reglages', REGLAGES_LEGERS);
    await reglee;

    // Le decompte annonce sa premiere seconde des que la demande est traitee.
    const decompte = prochain(hote, 'compteARebours');
    const lancee = prochain(hote, 'partieLancee');
    hote.emit('demarrer');
    await decompte;
    horloge.avancerDe(5000);
    await lancee;
  }

  /** Le bilan d'une partie, lu dans sa room. */
  function bilanDe(idRoom: string): BilanDePartie {
    const room = serveur?.jeu.rooms.room(idRoom);
    if (room === undefined) {
      throw new Error(`La partie ${idRoom} n'existe plus.`);
    }

    return room.bilan();
  }

  /** Relit une valeur jusqu'a ce qu'elle convienne, ou echoue au bout du delai. */
  async function attendre<T>(lire: () => Promise<T>, convient: (valeur: T) => boolean): Promise<T> {
    const limite = Date.now() + DELAI_ATTENTE_MS;

    for (;;) {
      const valeur = await lire();
      if (convient(valeur) || Date.now() > limite) {
        return valeur;
      }

      await new Promise((resoudre) => setTimeout(resoudre, 100));
    }
  }

  describe('une partie de trois minutes, deux comptes et un invite', () => {
    const DEPART: ValeursProgression = { xpTotale: 99, pieces: 7, pointsLigue: 95 };

    let alice: CompteDeTest;
    let bruno: CompteDeTest;
    let bilan: BilanDePartie;
    const recus = new Map<string, ProgressionDeFin>();
    let recuParLInvite: ProgressionDeFin | undefined;

    beforeAll(async () => {
      alice = await compteAvec('Alice', DEPART);
      bruno = await compteAvec('Bruno', DEPART);

      const clientAlice = await connecterAuJeu(alice.jeton);
      const clientBruno = await connecterAuJeu(bruno.jeton);
      const clientChloe = await connecterAuJeu();

      const idRoom = await entrer(clientAlice, {});
      await entrer(clientBruno, { idRoom });
      await entrer(clientChloe, { pseudo: pseudoNeuf('Chloe'), idRoom });
      await lancer(clientAlice);

      clientChloe.on('progressionDeFin', (progression) => {
        recuParLInvite = progression;
      });
      const pourAlice = prochain(clientAlice, 'progressionDeFin');
      const pourBruno = prochain(clientBruno, 'progressionDeFin');

      horloge.avancerDe(180_050);

      recus.set(alice.id, await pourAlice);
      recus.set(bruno.id, await pourBruno);
      bilan = bilanDe(idRoom);
      await laisserPasser();
    });

    /** La place d'un compte dans le bilan, et ce que les regles lui donnent. */
    function attenduPour(compte: CompteDeTest) {
      const joueur = bilan.joueurs.find((candidat) => candidat.compte?.id === compte.id);
      if (joueur === undefined) {
        throw new Error(`${compte.pseudo} n'est pas dans le bilan.`);
      }

      const gains = recompensesDePartie({
        placement: joueur.placement,
        nombreJoueurs: bilan.nombreJoueurs,
        tempsJoueMs: joueur.tempsJoueMs,
        dureePartieMs: bilan.dureePartieMs,
        abandon: joueur.abandon,
      });

      return {
        joueur,
        gains,
        apres: {
          xpTotale: DEPART.xpTotale + gains.xp,
          pieces: DEPART.pieces + gains.pieces,
          pointsLigue: Math.max(DEPART.pointsLigue + gains.variationPointsLigue, 0),
        },
      };
    }

    it('fait refleter a la progression de chaque compte les recompenses de sa place', async () => {
      expect(bilan.nombreJoueurs).toBe(3);

      for (const compte of [alice, bruno]) {
        const { joueur, apres } = attenduPour(compte);

        expect(joueur.tempsJoueMs).toBe(180_000);
        expect(await lireProgression(db(), compte.id)).toMatchObject(apres);
      }

      const paliers = [alice, bruno].map((compte) =>
        palierDePoints(attenduPour(compte).apres.pointsLigue),
      );
      expect(paliers).toContain('argent');
    });

    it('fait monter de niveau un compte dont l XP franchit le seuil', async () => {
      expect(niveauDeXp(DEPART.xpTotale)).toBe(1);

      for (const compte of [alice, bruno]) {
        const progression = await lireProgression(db(), compte.id);
        expect(niveauDeXp(progression?.xpTotale ?? 0)).toBe(2);
      }
    });

    it('enregistre le resultat de la partie, rattache au bon compte', async () => {
      for (const compte of [alice, bruno]) {
        const { joueur, gains } = attenduPour(compte);

        expect(await lireHistorique(db(), compte.id)).toEqual([
          {
            partieId: expect.any(String) as string,
            mode: 'classique',
            carte: 'map1',
            modeMiroir: false,
            dureeS: 180,
            nombreJoueurs: 3,
            termineeLe: expect.any(Date) as Date,
            placement: joueur.placement,
            points: joueur.points,
            captures: joueur.captures,
            botsNoirsDetruits: joueur.botsNoirsDetruits,
            xpGagnee: gains.xp,
            piecesGagnees: gains.pieces,
            variationPointsLigue: gains.variationPointsLigue,
          },
        ]);
      }

      const [deAlice] = await lireHistorique(db(), alice.id);
      const [deBruno] = await lireHistorique(db(), bruno.id);
      expect(deAlice?.partieId).toBe(deBruno?.partieId);
      expect(deAlice?.placement).not.toBe(deBruno?.placement);
    });

    it('envoie a chaque compte un recapitulatif egal a l evolution enregistree, et rien a l invite', async () => {
      for (const compte of [alice, bruno]) {
        const progression = await lireProgression(db(), compte.id);
        const [resultat] = await lireHistorique(db(), compte.id);
        const apres = {
          xpTotale: progression?.xpTotale ?? -1,
          pieces: progression?.pieces ?? -1,
          pointsLigue: progression?.pointsLigue ?? -1,
        };

        expect(recus.get(compte.id)).toEqual({
          enregistree: true,
          placement: resultat?.placement,
          nombreJoueurs: 3,
          xpGagnee: resultat?.xpGagnee,
          piecesGagnees: resultat?.piecesGagnees,
          variationPointsLigue: resultat?.variationPointsLigue,
          avant: {
            ...DEPART,
            niveau: niveauDeXp(DEPART.xpTotale),
            palier: palierDePoints(DEPART.pointsLigue),
          },
          apres: {
            ...apres,
            niveau: niveauDeXp(apres.xpTotale),
            palier: palierDePoints(apres.pointsLigue),
          },
        });
        expect(apres.xpTotale - DEPART.xpTotale).toBe(resultat?.xpGagnee);
      }

      expect(recuParLInvite).toBeUndefined();
    });
  });

  describe('un compte qui abandonne la partie', () => {
    it('est enregistre dernier, sans XP, et ses points de ligue s arretent a zero', async () => {
      const dana = await compteAvec('Dana', { xpTotale: 40, pieces: 4, pointsLigue: 3 });
      const clientDana = await connecterAuJeu(dana.jeton);
      const clientEmile = await connecterAuJeu();

      const idRoom = await entrer(clientDana, {});
      await entrer(clientEmile, { pseudo: pseudoNeuf('Emile'), idRoom });
      await lancer(clientDana);

      horloge.avancerDe(60_000);
      // Le depart doit etre traite avant que l'horloge n'amene la fin.
      const depart = prochain(clientEmile, 'joueurParti');
      clientDana.emit('quitter');
      await depart;

      const fin = prochain(clientEmile, 'partieTerminee');
      horloge.avancerDe(120_050);
      await fin;

      const [resultat] = await attendre(
        async () => lireHistorique(db(), dana.id),
        (historique) => historique.length > 0,
      );

      expect(resultat).toMatchObject({
        nombreJoueurs: 2,
        placement: 2,
        points: 0,
        xpGagnee: 0,
        piecesGagnees: 0,
        variationPointsLigue: -3,
      });
      expect(await lireProgression(db(), dana.id)).toMatchObject({
        xpTotale: 40,
        pieces: 4,
        pointsLigue: 0,
      });
    });
  });
});
