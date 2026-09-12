/**
 * Tests d'integration de la GameRoom.
 *
 * Integration et non unitaire: ces tests font vraiment tourner le moteur pur de
 * @neon-ninja/sim a travers la room, avec une horloge injectee. Ils verifient
 * l'assemblage, pas les regles du jeu, qui sont deja couvertes dans packages/sim.
 *
 * Trois choses y sont regardees de pres:
 *
 *   1. Le cycle de vie: salon, lancement, fin, et la succession de l'hote.
 *   2. Le fait que la distance parcourue depend du temps ecoule et de rien
 *      d'autre, en particulier pas du nombre de messages recus (faille S2).
 *   3. Le fait qu'aucune boucle ne survit a la partie qui l'a demarree
 *      (defaut X1).
 */

import type { Mode, ReglagesPartiels, SessionJoueur } from '@neon-ninja/shared';
import { APPARITION, DUREES, VITESSES } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { DT_MAXIMUM_MS, GameRoom } from './GameRoom.js';
import type { Horloge, HorlogeManuelle } from './horloge.js';
import { creerHorlogeManuelle } from './horloge.js';

/** Une partie courte et peu peuplee: les tests n'ont pas besoin de trois minutes. */
const REGLAGES: ReglagesPartiels = { dureePartieS: 1, nombreBotsInitial: 3 };

/** Cadence utilisee par les tests, celle du serveur. */
const BATTEMENT_MS = 50;

/** Une session de joueur, telle que la connexion l'etablit. */
function session(id: string, pseudo: string): SessionJoueur {
  return { id, pseudo };
}

/** Ce qu'un test manipule: une room, et l'horloge qui la fait battre. */
interface CadreDeTest {
  readonly room: GameRoom;
  readonly horloge: HorlogeManuelle;
}

/** Une room prete a l'emploi, avec une horloge que le test fait avancer. */
function roomDeTest(mode: Mode = 'classique'): CadreDeTest {
  const horloge = creerHorlogeManuelle();
  const room = new GameRoom({
    id: 'room-test',
    graine: 42,
    mode,
    reglages: REGLAGES,
    cadenceMs: BATTEMENT_MS,
    horloge,
  });

  return { room, horloge };
}

/** Une room lancee, avec les joueurs demandes deja en place. */
function partieLancee(
  pseudos: readonly string[] = ['Alice'],
  mode: Mode = 'classique',
): CadreDeTest {
  const cadre = roomDeTest(mode);

  for (const pseudo of pseudos) {
    cadre.room.accueillir(session(pseudo.toLowerCase(), pseudo));
  }
  cadre.room.lancer();

  return cadre;
}

describe('GameRoom, cycle de vie du salon', () => {
  it('nait vide, dans son salon, sans hote et sans bot', () => {
    const { room } = roomDeTest();

    expect(room.statut).toBe('salon');
    expect(room.joueurs).toEqual([]);
    expect(room.hote).toBeUndefined();
    expect(room.estVide).toBe(true);
    expect(Object.keys(room.etat.bots)).toHaveLength(0);
    expect(room.enMarche).toBe(false);
  });

  it('applique les reglages demandes et complete le reste par defaut', () => {
    const { room } = roomDeTest();

    expect(room.reglages.dureePartieS).toBe(1);
    expect(room.reglages.nombreBotsInitial).toBe(3);
    expect(room.reglages.carte).toBe('map1');
  });

  it('accueille un joueur et le place sur la carte', () => {
    const { room } = roomDeTest();

    const resultat = room.accueillir(session('alice', 'Alice'));

    expect(resultat.valide).toBe(true);
    expect(room.joueurs).toEqual([{ id: 'alice', pseudo: 'Alice', hote: true }]);
    expect(room.etat.joueurs['alice']?.protectionSpawnRestanteMs).toBe(DUREES.PROTECTION_SPAWN_MS);
  });

  it('donne des couleurs differentes a deux joueurs', () => {
    const { room } = roomDeTest();

    room.accueillir(session('alice', 'Alice'));
    room.accueillir(session('bob', 'Bob'));

    expect(room.etat.joueurs['alice']?.couleur).not.toBe(room.etat.joueurs['bob']?.couleur);
  });

  it('refuse deux fois la meme connexion', () => {
    const { room } = roomDeTest();

    room.accueillir(session('alice', 'Alice'));
    const second = room.accueillir(session('alice', 'Autre'));

    expect(second.valide).toBe(false);
    expect(room.joueurs).toHaveLength(1);
  });

  it('refuse un pseudo deja pris, meme ecrit autrement', () => {
    const { room } = roomDeTest();

    room.accueillir(session('alice', 'Alice'));
    const imposteur = room.accueillir(session('bob', '  ALICE '));

    if (imposteur.valide) {
      throw new Error('Le pseudo aurait du etre refuse.');
    }
    expect(imposteur.erreurs[0]?.champ).toBe('pseudo');
    expect(room.joueurs).toHaveLength(1);
  });

  it('libere le pseudo quand son porteur part', () => {
    const { room } = roomDeTest();

    room.accueillir(session('alice', 'Alice'));
    room.faireSortir('alice');

    expect(room.accueillir(session('bob', 'Alice')).valide).toBe(true);
  });

  it('fait sortir un joueur et le retire de la carte', () => {
    const { room } = roomDeTest();

    room.accueillir(session('alice', 'Alice'));
    const sorti = room.faireSortir('alice');

    expect(sorti).toBe(true);
    expect(room.etat.joueurs['alice']).toBeUndefined();
    expect(room.estVide).toBe(true);
  });

  it('ignore la sortie de quelqu un qui n etait pas la', () => {
    const { room } = roomDeTest();

    expect(room.faireSortir('fantome')).toBe(false);
  });
});

describe('GameRoom, attribution de l hote', () => {
  it('fait du premier arrive l hote', () => {
    const { room } = roomDeTest();

    room.accueillir(session('alice', 'Alice'));
    room.accueillir(session('bob', 'Bob'));

    expect(room.hote).toBe('alice');
    expect(room.joueurs.map((joueur) => joueur.hote)).toEqual([true, false]);
  });

  it('transmet le salon au plus ancien des restants quand l hote part', () => {
    const { room } = roomDeTest();

    room.accueillir(session('alice', 'Alice'));
    room.accueillir(session('bob', 'Bob'));
    room.accueillir(session('chloe', 'Chloe'));
    room.faireSortir('alice');

    expect(room.hote).toBe('bob');
  });

  it("ne change pas d hote quand c'est quelqu un d autre qui part", () => {
    const { room } = roomDeTest();

    room.accueillir(session('alice', 'Alice'));
    room.accueillir(session('bob', 'Bob'));
    room.faireSortir('bob');

    expect(room.hote).toBe('alice');
  });

  it('suit l ordre d arrivee meme avec des identifiants qui ressemblent a des nombres', () => {
    const { room } = roomDeTest();

    // Une table JavaScript reordonne ses cles entieres: sans ordre d'arrivee
    // explicite, « 2 » passerait avant « 10 » et l'hote changerait de personne.
    room.accueillir(session('10', 'Dix'));
    room.accueillir(session('2', 'Deux'));
    room.faireSortir('10');

    expect(room.hote).toBe('2');
  });

  it('n a plus d hote quand la room se vide', () => {
    const { room } = roomDeTest();

    room.accueillir(session('alice', 'Alice'));
    room.faireSortir('alice');

    expect(room.hote).toBeUndefined();
  });
});

describe('GameRoom, lancement de la partie', () => {
  it('peuple la carte de bots et met la boucle en marche', () => {
    const { room } = partieLancee();

    expect(room.statut).toBe('enCours');
    expect(Object.keys(room.etat.bots)).toHaveLength(3);
    expect(room.enMarche).toBe(true);

    room.arreter();
  });

  it('pose les bots a l ecart des joueurs deja places', () => {
    // L'ordre compte: le lancement peuple la carte APRES avoir accueilli les
    // joueurs, donc les bots evitent leurs positions. L'inverse laisserait un
    // joueur apparaitre au milieu d'un troupeau.
    const { room } = partieLancee(['Alice']);
    const joueur = room.etat.joueurs['alice'];

    for (const bot of Object.values(room.etat.bots)) {
      const distance = Math.hypot(
        bot.position.x - (joueur?.position.x ?? 0),
        bot.position.y - (joueur?.position.y ?? 0),
      );

      expect(distance).toBeGreaterThanOrEqual(APPARITION.DISTANCE_DE_SECURITE);
    }

    room.arreter();
  });

  it('refuse d etre lancee deux fois', () => {
    const { room } = partieLancee();

    expect(() => {
      room.lancer();
    }).toThrow();

    room.arreter();
  });

  it('accepte un joueur en cours de partie', () => {
    const { room } = partieLancee(['Alice']);

    const resultat = room.accueillir(session('bob', 'Bob'));

    expect(resultat.valide).toBe(true);
    expect(room.etat.joueurs['bob']?.protectionSpawnRestanteMs).toBe(DUREES.PROTECTION_SPAWN_MS);

    room.arreter();
  });
});

describe('GameRoom, un battement', () => {
  it('appelle le moteur avec le dt fourni', () => {
    const { room } = partieLancee();

    room.avancer(50);

    expect(room.etat.tick).toBe(1);
    expect(room.etat.tempsEcouleMs).toBe(50);

    room.arreter();
  });

  it('deplace le joueur de la distance que son entree et le temps autorisent', () => {
    const { room } = partieLancee();
    const depart = room.etat.joueurs['alice']?.position.x ?? 0;

    room.enregistrerIntention('alice', { deplacement: { x: 1, y: 0 }, enMouvement: true });
    room.avancer(50);

    const attendu = (VITESSES.JOUEUR_PX_PAR_SECONDE * 50) / 1000;
    expect(room.etat.joueurs['alice']?.position.x).toBeCloseTo(depart + attendu, 6);

    room.arreter();
  });

  it('ne deplace personne sans intention', () => {
    const { room } = partieLancee();
    const depart = room.etat.joueurs['alice']?.position;

    room.avancer(50);

    expect(room.etat.joueurs['alice']?.position).toEqual(depart);

    room.arreter();
  });

  it('ne retient que la derniere intention: dix messages ne valent pas dix pas', () => {
    const bavard = partieLancee();
    const discret = partieLancee();
    const depart = bavard.room.etat.joueurs['alice']?.position.x ?? 0;

    for (let envoi = 0; envoi < 10; envoi += 1) {
      bavard.room.enregistrerIntention('alice', { deplacement: { x: 1, y: 0 }, enMouvement: true });
    }
    bavard.room.avancer(50);

    discret.room.enregistrerIntention('alice', { deplacement: { x: 1, y: 0 }, enMouvement: true });
    discret.room.avancer(50);

    expect(bavard.room.etat.joueurs['alice']?.position.x).toBe(
      discret.room.etat.joueurs['alice']?.position.x,
    );
    expect(bavard.room.etat.joueurs['alice']?.position.x).toBeGreaterThan(depart);

    bavard.room.arreter();
    discret.room.arreter();
  });

  it('garde l intention d un battement au suivant', () => {
    const { room } = partieLancee();
    const depart = room.etat.joueurs['alice']?.position.x ?? 0;

    room.enregistrerIntention('alice', { deplacement: { x: 1, y: 0 }, enMouvement: true });
    room.avancer(50);
    room.avancer(50);

    const attendu = (VITESSES.JOUEUR_PX_PAR_SECONDE * 100) / 1000;
    expect(room.etat.joueurs['alice']?.position.x).toBeCloseTo(depart + attendu, 6);

    room.arreter();
  });

  it('oublie l intention d un joueur qui part', () => {
    const { room } = partieLancee(['Alice', 'Bob']);

    room.enregistrerIntention('bob', { deplacement: { x: 1, y: 0 }, enMouvement: true });
    room.faireSortir('bob');
    room.accueillir(session('bob', 'Bob'));
    const depart = room.etat.joueurs['bob']?.position;

    room.avancer(50);

    expect(room.etat.joueurs['bob']?.position).toEqual(depart);

    room.arreter();
  });

  it('ignore l intention d un joueur absent', () => {
    const { room } = partieLancee();

    room.enregistrerIntention('fantome', { deplacement: { x: 1, y: 0 }, enMouvement: true });

    expect(() => {
      room.avancer(50);
    }).not.toThrow();

    room.arreter();
  });

  /** Les joueurs qui ont tire pendant le dernier battement. */
  function tirsDuBattement(room: GameRoom): readonly string[] {
    return room.etat.evenements.flatMap((evenement) =>
      evenement.type === 'tirDeCapture' ? [evenement.joueur] : [],
    );
  }

  it('joue une demande de tir au battement suivant, et une seule fois', () => {
    const { room } = partieLancee(['Alice'], 'tactique');

    room.demanderUnTir('alice');
    room.demanderUnTir('alice');
    room.avancer(50);

    expect(tirsDuBattement(room)).toEqual(['alice']);

    // Aucun nouveau message: le battement suivant ne rejoue pas la demande.
    room.avancer(50);

    expect(tirsDuBattement(room)).toEqual([]);

    room.arreter();
  });

  it('garde l intention de deplacement de qui tire', () => {
    const { room } = partieLancee(['Alice'], 'tactique');
    const depart = room.etat.joueurs['alice']?.position.x ?? 0;

    room.enregistrerIntention('alice', { deplacement: { x: 1, y: 0 }, enMouvement: true });
    room.demanderUnTir('alice');
    room.avancer(50);
    room.avancer(50);

    const attendu = (VITESSES.JOUEUR_PX_PAR_SECONDE * 100) / 1000;
    expect(room.etat.joueurs['alice']?.position.x).toBeCloseTo(depart + attendu, 6);

    room.arreter();
  });

  it('ignore une demande de tir faite dans le salon, qui ne part pas au lancement', () => {
    const { room } = roomDeTest('tactique');
    room.accueillir(session('alice', 'Alice'));

    room.demanderUnTir('alice');
    room.lancer();
    room.avancer(50);

    expect(tirsDuBattement(room)).toEqual([]);

    room.arreter();
  });

  it('ignore la demande de tir d un joueur absent, et oublie celle d un joueur qui part', () => {
    const { room } = partieLancee(['Alice', 'Bob'], 'tactique');

    room.demanderUnTir('fantome');
    room.demanderUnTir('bob');
    room.faireSortir('bob');
    room.accueillir(session('bob', 'Bob'));
    room.avancer(50);

    expect(tirsDuBattement(room)).toEqual([]);

    room.arreter();
  });

  it('transmet la demande au moteur, qui l ignore dans une partie Classique', () => {
    const { room } = partieLancee();

    room.demanderUnTir('alice');
    room.avancer(50);

    expect(tirsDuBattement(room)).toEqual([]);
    expect(room.etat.tactique).toBeUndefined();

    room.arreter();
  });

  it('refuse d avancer une partie qui n a pas commence', () => {
    const { room } = roomDeTest();

    expect(() => {
      room.avancer(50);
    }).toThrow();
  });
});

describe('GameRoom, la boucle de battement', () => {
  it('bat au rythme de l horloge', () => {
    const { room, horloge } = partieLancee();

    horloge.avancerDe(200);

    expect(room.etat.tick).toBe(4);
    expect(room.etat.tempsEcouleMs).toBe(200);

    room.arreter();
  });

  it('ne bat pas tant que la partie n est pas lancee', () => {
    const { room, horloge } = roomDeTest();

    room.accueillir(session('alice', 'Alice'));
    horloge.avancerDe(1000);

    expect(room.etat.tick).toBe(0);
  });

  it('s arrete d elle-meme quand le temps de jeu est ecoule', () => {
    const { room, horloge } = partieLancee();

    horloge.avancerDe(5000);

    expect(room.statut).toBe('terminee');
    expect(room.etat.tempsEcouleMs).toBe(1000);
    expect(room.enMarche).toBe(false);
  });

  it('previent une fois de la fin de la partie', () => {
    const horloge = creerHorlogeManuelle();
    let fins = 0;
    const room = new GameRoom({
      id: 'room-fin',
      graine: 42,
      reglages: REGLAGES,
      cadenceMs: BATTEMENT_MS,
      horloge,
      surFinDePartie: () => {
        fins += 1;
      },
    });

    room.accueillir(session('alice', 'Alice'));
    room.lancer();
    horloge.avancerDe(5000);

    expect(fins).toBe(1);
  });

  it('ne bat plus une fois arretee', () => {
    const { room, horloge } = partieLancee();

    horloge.avancerDe(100);
    room.arreter();
    horloge.avancerDe(1000);

    expect(room.etat.tick).toBe(2);
  });

  it('arreter deux fois ne fait rien de plus', () => {
    const { room } = partieLancee();

    room.arreter();

    expect(() => {
      room.arreter();
    }).not.toThrow();
  });

  it('borne le temps rattrape apres un serveur fige', () => {
    let instant = 0;
    let battement: (() => void) | undefined;
    const horloge: Horloge = {
      maintenant: () => instant,
      repeter: (rappel) => {
        battement = rappel;

        return () => {
          battement = undefined;
        };
      },
    };
    const room = new GameRoom({
      id: 'room-figee',
      graine: 42,
      reglages: { dureePartieS: 60, nombreBotsInitial: 1 },
      horloge,
    });

    room.accueillir(session('alice', 'Alice'));
    room.lancer();
    instant = 10_000;
    battement?.();

    expect(room.etat.tempsEcouleMs).toBe(DT_MAXIMUM_MS);

    room.arreter();
  });

  it('refuse un nouveau joueur une fois la partie terminee', () => {
    const { room, horloge } = partieLancee();

    horloge.avancerDe(5000);

    expect(room.accueillir(session('bob', 'Bob')).valide).toBe(false);
  });
});

describe('GameRoom, classement', () => {
  it('rend une ligne par joueur, score compris', () => {
    const { room } = partieLancee(['Alice', 'Bob']);

    const classement = room.classement();

    expect(classement).toHaveLength(2);
    expect(classement.map((ligne) => ligne.pseudo).sort()).toEqual(['Alice', 'Bob']);
    expect(classement.every((ligne) => ligne.points >= 0)).toBe(true);

    room.arreter();
  });
});

describe('GameRoom, changement des reglages dans le salon', () => {
  it('applique les nouveaux reglages', () => {
    const { room } = roomDeTest();

    room.changerReglages({ dureePartieS: 120, nombreBotsInitial: 42 });

    expect(room.reglages.dureePartieS).toBe(120);
    expect(room.reglages.nombreBotsInitial).toBe(42);
  });

  it('garde les joueurs presents, dans leur ordre d arrivee, avec leur hote', () => {
    const { room } = roomDeTest();
    room.accueillir(session('un', 'Alice'));
    room.accueillir(session('deux', 'Bob'));

    room.changerReglages({ carte: 'map3' });

    expect(room.joueurs).toEqual([
      { id: 'un', pseudo: 'Alice', hote: true },
      { id: 'deux', pseudo: 'Bob', hote: false },
    ]);
  });

  it('replace les joueurs sur la nouvelle carte, jamais hors de ses bords', () => {
    const { room } = roomDeTest();
    room.accueillir(session('un', 'Alice'));

    room.changerReglages({ carte: 'map3' });

    const position = room.etat.joueurs['un']?.position;

    expect(room.etat.carte).toEqual({ largeur: 3000, hauteur: 2000 });
    expect(position?.x).toBeGreaterThanOrEqual(0);
    expect(position?.x).toBeLessThanOrEqual(3000);
    expect(position?.y).toBeGreaterThanOrEqual(0);
    expect(position?.y).toBeLessThanOrEqual(2000);
  });

  it('donne le meme resultat qu une room creee d emblee avec ces reglages', () => {
    const modifiee = new GameRoom({ id: 'room-a', graine: 42, reglages: REGLAGES });
    modifiee.changerReglages({ dureePartieS: 120, nombreBotsInitial: 20 });

    const dEmblee = new GameRoom({
      id: 'room-b',
      graine: 42,
      reglages: { dureePartieS: 120, nombreBotsInitial: 20 },
    });

    expect(modifiee.reglages).toEqual(dEmblee.reglages);
    expect(modifiee.etat.dureeMs).toBe(dEmblee.etat.dureeMs);
    expect(modifiee.etat.carte).toEqual(dEmblee.etat.carte);
  });

  it('refuse de changer les reglages d une partie commencee', () => {
    const { room } = partieLancee();

    expect(() => {
      room.changerReglages({ dureePartieS: 120 });
    }).toThrow(/n'est plus dans son salon|ne changent plus/);
  });

  it('remet le temps de jeu a zero: on n a pas encore commence', () => {
    const { room } = roomDeTest();

    room.changerReglages({ dureePartieS: 120 });

    expect(room.etat.tempsEcouleMs).toBe(0);
    expect(room.etat.tick).toBe(0);
  });
});

describe('GameRoom, rappel de battement', () => {
  it('previent apres chaque battement, avec l etat deja avance', () => {
    const horloge = creerHorlogeManuelle();
    const ticksVus: number[] = [];
    const room = new GameRoom({
      id: 'room-battement',
      graine: 42,
      reglages: REGLAGES,
      cadenceMs: BATTEMENT_MS,
      horloge,
      surBattement: (observee) => {
        ticksVus.push(observee.etat.tick);
      },
    });

    room.accueillir(session('un', 'Alice'));
    room.lancer();
    horloge.avancerDe(BATTEMENT_MS * 3);

    expect(ticksVus).toEqual([1, 2, 3]);
  });

  it('previent aussi au dernier battement, avant d annoncer la fin', () => {
    const horloge = creerHorlogeManuelle();
    const ordre: string[] = [];
    const room = new GameRoom({
      id: 'room-fin',
      graine: 42,
      reglages: { dureePartieS: 1, nombreBotsInitial: 3 },
      cadenceMs: BATTEMENT_MS,
      horloge,
      surBattement: () => {
        ordre.push('battement');
      },
      surFinDePartie: () => {
        ordre.push('fin');
      },
    });

    room.accueillir(session('un', 'Alice'));
    room.lancer();
    horloge.avancerDe(2000);

    // Le dernier fait de la partie doit partir avant l'annonce de la fin.
    expect(ordre[ordre.length - 2]).toBe('battement');
    expect(ordre[ordre.length - 1]).toBe('fin');
    expect(ordre.filter((etape) => etape === 'fin')).toHaveLength(1);
  });

  it('cesse de prevenir une fois la partie terminee', () => {
    const horloge = creerHorlogeManuelle();
    let battements = 0;
    const room = new GameRoom({
      id: 'room-apres',
      graine: 42,
      reglages: { dureePartieS: 1, nombreBotsInitial: 3 },
      cadenceMs: BATTEMENT_MS,
      horloge,
      surBattement: () => {
        battements += 1;
      },
    });

    room.accueillir(session('un', 'Alice'));
    room.lancer();
    horloge.avancerDe(2000);

    const apresLaFin = battements;
    horloge.avancerDe(5000);

    expect(battements).toBe(apresLaFin);
  });
});

describe('GameRoom, pause de la partie', () => {
  it('nait sans pause et suspend le temps de jeu a la demande', () => {
    const { room, horloge } = partieLancee();

    expect(room.enPause).toBe(false);

    room.mettreEnPause();
    horloge.avancerDe(BATTEMENT_MS * 5);

    expect(room.enPause).toBe(true);
    expect(room.etat.tempsEcouleMs).toBe(0);
  });

  it('continue de faire battre sa boucle pendant la pause', () => {
    // La pause arrete le temps de jeu, pas le battement. Arreter la boucle
    // rendrait la room sourde, et il faudrait penser a la relancer.
    const { room, horloge } = partieLancee();

    room.mettreEnPause();
    horloge.avancerDe(BATTEMENT_MS * 4);

    expect(room.enMarche).toBe(true);
    expect(room.etat.tick).toBeGreaterThan(0);
  });

  it('rend son temps a la partie a la reprise', () => {
    const { room, horloge } = partieLancee();

    horloge.avancerDe(BATTEMENT_MS * 2);
    const avant = room.etat.tempsEcouleMs;

    room.mettreEnPause();
    horloge.avancerDe(BATTEMENT_MS * 20);
    room.reprendre();
    horloge.avancerDe(BATTEMENT_MS * 2);

    expect(room.enPause).toBe(false);
    expect(avant).toBeGreaterThan(0);
    expect(room.etat.tempsEcouleMs).toBeCloseTo(avant * 2, 0);
  });

  it('empeche une partie suspendue de se terminer', () => {
    // La partie dure une seconde: sans pause, elle serait finie depuis
    // longtemps au bout de cinq.
    const { room, horloge } = partieLancee();

    room.mettreEnPause();
    horloge.avancerDe(5000);

    expect(room.statut).toBe('enCours');

    room.reprendre();
    horloge.avancerDe(1100);

    expect(room.statut).toBe('terminee');
  });

  it('accepte une demande qui ne change rien', () => {
    const { room } = partieLancee();

    room.reprendre();
    room.mettreEnPause();
    room.mettreEnPause();

    expect(room.enPause).toBe(true);
  });

  it('refuse de suspendre une partie qui n est pas en cours', () => {
    // Faute d'appelant et non refus de joueur: la couche reseau verifie le
    // statut avant d'appeler.
    const { room } = roomDeTest();

    expect(() => {
      room.mettreEnPause();
    }).toThrow(/statut salon/);
    expect(() => {
      room.reprendre();
    }).toThrow(/statut salon/);
  });
});
