/**
 * La charge du serveur complet: la repartition, l'assemblage des releves, et une
 * vraie charge courte, de bout en bout.
 *
 * La charge courte monte le vrai serveur compile et lance un processus de clients:
 * compiler avant (pnpm typecheck ou pnpm build), ce que la CI fait avant les tests.
 * Elle dure une dizaine de secondes, dont cinq de compte a rebours reel. Elle ne
 * juge pas si le serveur tient: les autres tests tournent en parallele, et la
 * machine de CI n'est pas celle du rapport. Elle verifie que le harnais mesure, et
 * que ce qu'il mesure sur le fil concorde avec le banc du battement.
 */

import { describe, expect, it } from 'vitest';

import { ChargeurDeTerrain } from '../../packages/server/dist/index.js';

import { mesurerLeBattement } from './battement.ts';
import type { OptionsChargeReseau } from './charge-reseau.ts';
import { assembler, mesurerLaCharge, repartir } from './charge-reseau.ts';
import { botsDeLaRoom } from './clients.ts';
import type { RapportDesClients } from './clients.ts';
import { resumer } from './statistiques.ts';

describe('repartir', () => {
  it('distribue les parties aux processus a tour de role', () => {
    expect(repartir(5, 2)).toEqual([
      [0, 2, 4],
      [1, 3],
    ]);
  });

  it('ne lance pas plus de processus que de parties', () => {
    expect(repartir(1, 7)).toEqual([[0]]);
    expect(repartir(3, 3)).toEqual([[0], [1], [2]]);
  });

  it('ne lance aucun processus sans partie', () => {
    expect(repartir(0, 4)).toEqual([]);
  });
});

describe('botsDeLaRoom', () => {
  it('attribue les nombres de bots aux parties a tour de role', () => {
    expect([0, 1, 2, 3].map((rang) => botsDeLaRoom([50, 150], rang))).toEqual([50, 150, 50, 150]);
    expect(botsDeLaRoom([150], 9)).toBe(150);
  });

  it('refuse une liste vide', () => {
    expect(() => botsDeLaRoom([], 0)).toThrow();
  });
});

describe('assembler', () => {
  const options: OptionsChargeReseau = {
    rooms: 2,
    joueursParRoom: 2,
    bots: [150],
    echauffementS: 0,
    dureeMesureS: 1,
    processusClients: 1,
    graine: 1,
  };

  const rapport: RapportDesClients = {
    clients: 4,
    dureeMs: 1000,
    messagesEtat: 80,
    octetsEtat: 1_600_000,
    octetsAutres: 400,
    intentions: 4,
    intervalleReceptionMs: resumer([50, 50, 51]),
    processeurPourCent: 12,
    deconnexions: 0,
  };

  it('tire frequences, ecarts, couts et debits des releves du serveur et des clients', () => {
    const regulier = { debuts: [0, 50, 100, 150], durees: [1, 2, 1, 2] };
    const lent = { debuts: [10, 110], durees: [40, 40] };

    const resultat = assembler(options, { boucles: [regulier, lent] }, [rapport], {
      dureeMs: 200,
      processeurMs: 20,
      retardBoucleMs: { p50: 1, p99: 2, maximum: 3 },
      utilisationBouclePourCent: 40,
      pausesRamasseMiettesMs: [2, 8],
      memoireRssMo: 100,
      tasUtiliseMo: 50,
    });

    expect(resultat.clients).toBe(4);
    expect(resultat.battementMs.nombre).toBe(6);
    expect(resultat.intervalleMs.maximum).toBe(100);
    expect(resultat.frequenceParPartieHz.minimum).toBe(10);
    expect(resultat.frequenceParPartieHz.maximum).toBe(20);
    expect(resultat.processeurServeurPourCent).toBe(10);
    expect(resultat.utilisationBouclePourCent).toBe(40);
    // 10 ms de pauses sur une fenetre de 200 ms.
    expect(resultat.ramasseMiettes).toEqual({ pauses: 2, partDuTempsPourCent: 5, plusLongueMs: 8 });
    expect(resultat.processeurParPartieMs).toBeCloseTo(20 / 6);
    expect(resultat.octetsParMessage).toBe(20_000);
    // 1 600 400 octets pour 4 clients en 0,2 seconde.
    expect(resultat.debitParClientKoS).toBeCloseTo(2000.5);
    expect(resultat.messagesParClientHz).toBe(100);
    expect(resultat.intentionsParSeconde).toBe(20);
    expect(resultat.processeurClientsPourCent).toEqual([12]);

    // La partie lente a battu a 10 Hz, et son ecart est de 100 ms: non tenu.
    expect(resultat.verdict.tenue).toBe(false);
    expect(resultat.verdict.motifs).toHaveLength(1);
  });

  it('rend des debits nuls quand aucun client n a rien recu', () => {
    const resultat = assembler(options, { boucles: [] }, [], {
      dureeMs: 1000,
      processeurMs: 0,
      retardBoucleMs: { p50: 0, p99: 0, maximum: 0 },
      utilisationBouclePourCent: 0,
      pausesRamasseMiettesMs: [],
      memoireRssMo: 0,
      tasUtiliseMo: 0,
    });

    expect(resultat.octetsParMessage).toBe(0);
    expect(resultat.debitParClientKoS).toBe(0);
    expect(resultat.processeurParPartieMs).toBe(0);
  });
});

describe('mesurerLaCharge', () => {
  it(
    'fait jouer une partie a de vrais clients, et mesure sur le fil ce que le banc calcule',
    { timeout: 90_000 },
    async () => {
      const resultat = await mesurerLaCharge({
        rooms: 1,
        joueursParRoom: 3,
        bots: [150],
        echauffementS: 1,
        dureeMesureS: 2,
        processusClients: 1,
        graine: 3,
      });

      expect(resultat.clients).toBe(3);
      expect(resultat.deconnexions).toBe(0);
      expect(resultat.processeurClientsPourCent).toHaveLength(1);

      // Deux secondes a vingt battements par seconde, avec une large marge pour une
      // machine chargee par les autres tests.
      expect(resultat.battementMs.nombre).toBeGreaterThan(10);
      expect(resultat.frequenceParPartieHz.maximum).toBeGreaterThan(5);
      expect(resultat.processeurParPartieMs).toBeGreaterThan(0);

      // Chaque battement part a chaque client: les clients recoivent ce que le
      // serveur a battu, a quelques messages pres en bord de fenetre.
      const battementsParSeconde = resultat.battementMs.nombre / resultat.dureeMesureS;
      expect(resultat.messagesParClientHz).toBeGreaterThan(battementsParSeconde * 0.8);
      expect(resultat.messagesParClientHz).toBeLessThan(battementsParSeconde * 1.2);

      // La taille relevee sur le fil concorde avec celle que le banc calcule pour la
      // meme population: c'est ce qui valide le calcul de l'enveloppe du banc.
      const banc = mesurerLeBattement({
        bots: 150,
        joueurs: 3,
        battements: 60,
        echauffement: 0,
        graine: 3,
        terrain: new ChargeurDeTerrain().charger({ carte: 'map1', modeMiroir: false }),
      });
      const rapport = resultat.octetsParMessage / banc.octetsParMessage.moyenne;
      expect(rapport).toBeGreaterThan(0.85);
      expect(rapport).toBeLessThan(1.15);
    },
  );
});
