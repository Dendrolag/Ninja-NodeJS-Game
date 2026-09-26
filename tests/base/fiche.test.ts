/**
 * Tests d'integration de la fiche joueur (etape 3.5), contre une vraie base Neon.
 *
 * Ce sont les tests que demande la fiche de l'etape: les agregats par mode et le
 * mode prefere sur un jeu de parties connu, le refus sans session et pour un pseudo
 * inconnu. S'y ajoutent ce que la fiche ne doit jamais dire, le pseudo retrouve
 * quelle que soit son ecriture, et la limite de lecture par compte.
 */

import type { LimitesDesComptes, NouveauResultat, ServeurMonte } from '@neon-ninja/server';
import {
  Authentification,
  JOUEUR_INCONNU,
  demarrerServeur,
  enregistrerPartie,
  trouverCompteParPseudo,
} from '@neon-ninja/server';
import type { FicheJoueur, Mode } from '@neon-ninja/shared';
import { adresseDeLaFiche } from '@neon-ninja/shared';
import { afterEach, describe, expect, it } from 'vitest';

import { baseDeTest, baseDisponible, pseudoNeuf } from './contexte.js';

/** Des limites que les tests ne peuvent pas atteindre sans le vouloir. */
const LIMITES_LARGES: LimitesDesComptes = {
  connexionParPseudo: { parSeconde: 100, rafale: 1000 },
  connexionParAdresse: { parSeconde: 100, rafale: 1000 },
  inscriptionParAdresse: { parSeconde: 100, rafale: 1000 },
  ficheParCompte: { parSeconde: 100, rafale: 1000 },
};

/** Un scrypt allege: ces tests ne portent pas sur l'empreinte. */
const SCRYPT_ALLEGE = { N: 2 ** 10, r: 8, p: 1 };

const MOT_DE_PASSE = 'correct cheval pile agrafe';

/** Un compte inscrit pour le test. */
interface CompteDeTest {
  readonly pseudo: string;
  readonly jeton: string;
  readonly compteId: string;
}

describe.runIf(baseDisponible())('fiche joueur', () => {
  const db = baseDeTest();
  const serveurs: ServeurMonte[] = [];

  afterEach(async () => {
    for (const serveur of serveurs.splice(0)) {
      await serveur.fermer();
    }
  });

  /** L'authentification sur la base de test. */
  function authentification(limites: LimitesDesComptes = LIMITES_LARGES): Authentification {
    return new Authentification({ db: db(), limites, parametresScrypt: SCRYPT_ALLEGE });
  }

  /** Inscrit un compte neuf sous un pseudo tire de ce prefixe. */
  async function inscrire(auth: Authentification, prefixe = 'Fiche'): Promise<CompteDeTest> {
    const pseudo = pseudoNeuf(prefixe);
    const reponse = await auth.inscrire({ pseudo, motDePasse: MOT_DE_PASSE }, '127.0.0.1');

    if (!reponse.acceptee) {
      throw new Error(`Inscription refusee: ${JSON.stringify(reponse.erreurs)}`);
    }

    const compte = await trouverCompteParPseudo(db(), pseudo);

    if (compte === undefined) {
      throw new Error("Le compte inscrit n'est pas en base.");
    }

    return { pseudo, jeton: reponse.valeur.jeton, compteId: compte.id };
  }

  /** Enregistre une partie de ce mode, terminee a cette date, avec ce resultat pour le compte. */
  async function jouer(
    compteId: string,
    mode: Mode,
    termineeLe: string,
    nombreJoueurs: number,
    resultat: Partial<NouveauResultat>,
  ): Promise<void> {
    await enregistrerPartie(
      db(),
      {
        mode,
        carte: 'map1',
        modeMiroir: false,
        dureeS: 180,
        nombreJoueurs,
        termineeLe: new Date(termineeLe),
      },
      [
        {
          compteId,
          placement: 2,
          points: 10,
          captures: 0,
          botsNoirsDetruits: 0,
          xpGagnee: 30,
          piecesGagnees: 3,
          variationPointsLigue: 0,
          ...resultat,
        },
      ],
    );
  }

  /** La fiche, ou un echec de test explicite. */
  async function ficheDe(
    auth: Authentification,
    jeton: string,
    pseudo: string,
  ): Promise<FicheJoueur> {
    const reponse = await auth.ficheJoueur(jeton, pseudo);

    if (!reponse.acceptee) {
      throw new Error(`Fiche refusee: ${JSON.stringify(reponse.erreurs)}`);
    }

    return reponse.valeur;
  }

  it('rend la fiche d un autre compte, mode par mode, et rien de ce qui est prive', async () => {
    const auth = authentification();
    const lecteur = await inscrire(auth);
    const bob = await inscrire(auth);

    // Deux parties de Horde, dont une seul; deux de Chasse, plus recentes: le mode
    // prefere se departage par la partie la plus recente.
    await jouer(bob.compteId, 'classique', '2026-04-01T12:00:00.000Z', 4, {
      placement: 1,
      points: 120,
      xpGagnee: 150,
      variationPointsLigue: 60,
    });
    await jouer(bob.compteId, 'classique', '2026-04-02T12:00:00.000Z', 1, {
      placement: 1,
      points: 300,
      xpGagnee: 40,
    });
    await jouer(bob.compteId, 'chasse', '2026-04-03T12:00:00.000Z', 6, {
      placement: 3,
      points: 80,
      xpGagnee: 60,
      variationPointsLigue: 60,
    });
    await jouer(bob.compteId, 'chasse', '2026-04-04T12:00:00.000Z', 6, {
      placement: 1,
      points: 200,
      xpGagnee: 60,
      variationPointsLigue: 20,
    });

    const fiche = await ficheDe(auth, lecteur.jeton, bob.pseudo);

    // 310 XP: le niveau 3 s'atteint a 300. 140 points de ligue: l'Argent, a 100.
    expect(fiche).toEqual({
      pseudo: bob.pseudo,
      inscritLe: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      niveau: 3,
      palier: 'argent',
      statistiques: {
        partiesJouees: 4,
        partiesAPlusieurs: 3,
        victoires: 2,
        modePrefere: 'chasse',
        parMode: [
          {
            mode: 'classique',
            partiesJouees: 2,
            partiesAPlusieurs: 1,
            victoires: 1,
            meilleurScore: 300,
            meilleurScoreSeul: 300,
          },
          {
            mode: 'chasse',
            partiesJouees: 2,
            partiesAPlusieurs: 2,
            victoires: 1,
            meilleurScore: 200,
          },
        ],
      },
      // Etape 3.6: ce que Bob est pour le lecteur. Pas un ami: pas de face-a-face.
      relation: 'aucune',
    });
  });

  it('prefere le mode le plus joue, meme plus ancien', async () => {
    const auth = authentification();
    const lecteur = await inscrire(auth);
    const bob = await inscrire(auth);

    await jouer(bob.compteId, 'tactique', '2026-05-01T12:00:00.000Z', 3, {});
    await jouer(bob.compteId, 'tactique', '2026-05-02T12:00:00.000Z', 3, {});
    await jouer(bob.compteId, 'massacre', '2026-05-20T12:00:00.000Z', 1, {
      placement: 1,
      points: 700,
    });

    const { statistiques } = await ficheDe(auth, lecteur.jeton, bob.pseudo);

    expect(statistiques.modePrefere).toBe('tactique');
    expect(statistiques.parMode.map((ligne) => ligne.mode)).toEqual(['tactique', 'massacre']);
  });

  it('rend une fiche sans partie a un compte qui n a jamais joue', async () => {
    const auth = authentification();
    const lecteur = await inscrire(auth);
    const bob = await inscrire(auth);

    expect((await ficheDe(auth, lecteur.jeton, bob.pseudo)).statistiques).toEqual({
      partiesJouees: 0,
      partiesAPlusieurs: 0,
      victoires: 0,
      parMode: [],
    });
  });

  it('retrouve le compte quelle que soit l ecriture du pseudo, et rend la sienne', async () => {
    const auth = authentification();
    const lecteur = await inscrire(auth);
    const bob = await inscrire(auth, 'Écho');

    const fiche = await ficheDe(auth, lecteur.jeton, `  ${bob.pseudo.toLocaleLowerCase('fr')}  `);

    expect(fiche.pseudo).toBe(bob.pseudo);
  });

  it('refuse sans session valable, un pseudo mal forme, et un pseudo sans compte', async () => {
    const auth = authentification();
    const lecteur = await inscrire(auth);
    const bob = await inscrire(auth);

    const sansSession = await auth.ficheJoueur('x'.repeat(43), bob.pseudo);
    const malForme = await auth.ficheJoueur(lecteur.jeton, '<b>');
    const pasDuTexte = await auth.ficheJoueur(lecteur.jeton, ['a', 'b']);
    const inconnu = await auth.ficheJoueur(lecteur.jeton, pseudoNeuf('Personne'));

    expect(sansSession).toMatchObject({ acceptee: false, motif: 'sessionAbsente' });
    expect(malForme).toMatchObject({ acceptee: false, motif: 'demandeInvalide' });
    expect(pasDuTexte).toMatchObject({ acceptee: false, motif: 'demandeInvalide' });
    expect(inconnu).toEqual({
      acceptee: false,
      motif: 'joueurInconnu',
      erreurs: [{ champ: 'pseudo', motif: JOUEUR_INCONNU }],
    });
  });

  it('limite les lectures d un meme compte, sans gener les autres', async () => {
    const auth = authentification({
      ...LIMITES_LARGES,
      ficheParCompte: { parSeconde: 1 / 3600, rafale: 2 },
    });
    const lecteur = await inscrire(auth);
    const autre = await inscrire(auth);
    const bob = await inscrire(auth);

    await ficheDe(auth, lecteur.jeton, bob.pseudo);
    await ficheDe(auth, lecteur.jeton, bob.pseudo);

    expect(await auth.ficheJoueur(lecteur.jeton, bob.pseudo)).toMatchObject({
      acceptee: false,
      motif: 'tropDeTentatives',
    });
    expect((await ficheDe(auth, autre.jeton, bob.pseudo)).pseudo).toBe(bob.pseudo);
  });

  it('rend la fiche par sa route, pseudo avec espace et point compris, et la refuse sans session', async () => {
    const auth = authentification();
    const lecteur = await inscrire(auth);
    const bob = await inscrire(auth, 'Léa B.');
    const serveur = await demarrerServeur(0, { comptes: auth });
    serveurs.push(serveur);

    const adresse = serveur.http.address();
    if (typeof adresse !== 'object' || adresse === null) {
      throw new Error("Le serveur de test n'a pas d'adresse.");
    }

    const racine = `http://127.0.0.1:${String(adresse.port)}`;
    const avecSession = await fetch(`${racine}${adresseDeLaFiche(bob.pseudo)}`, {
      headers: { Authorization: `Bearer ${lecteur.jeton}` },
    });
    const sansSession = await fetch(`${racine}${adresseDeLaFiche(bob.pseudo)}`);
    const inconnu = await fetch(`${racine}${adresseDeLaFiche(pseudoNeuf('Personne'))}`, {
      headers: { Authorization: `Bearer ${lecteur.jeton}` },
    });

    expect(avecSession.status).toBe(200);
    expect(((await avecSession.json()) as FicheJoueur).pseudo).toBe(bob.pseudo);
    expect(sansSession.status).toBe(401);
    expect(inconnu.status).toBe(404);
  });
});
