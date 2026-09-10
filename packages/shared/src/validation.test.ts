/**
 * Tests des schemas de validation.
 *
 * Deux exigences guident ce fichier. La premiere est de verifier les BORNES, et
 * de les verifier des DEUX cotes: la valeur limite passe, celle qui la depasse
 * d'une unite est refusee. Une borne testee d'un seul cote ne dit pas ou elle se
 * trouve. La seconde est de verifier que rien n'est rogne en silence: une entree
 * hors bornes ressort refusee, jamais ramenee a la borne.
 *
 * S'y ajoutent les cas venus directement des failles de l'audit: le pseudo qui
 * porte du balisage (S1), le message de chat qui declare un autre auteur (S3), et
 * l'intention de deplacement qui declare un etat (S2).
 */

import { describe, expect, it } from 'vitest';

import {
  BORNES_CHAT,
  BORNES_CODE_INVITATION,
  BORNES_PSEUDO,
  BORNES_REGLAGES,
  BORNES_ROOM,
} from './bornes.js';
import type { SessionJoueur } from './entrees.js';
import { REGLAGES_PAR_DEFAUT } from './reglages.js';
import type { ResultatValidation } from './validation.js';
import {
  normaliserTexte,
  validerCodeInvitation,
  validerDemandeCreation,
  validerDemandeRejoindre,
  validerIntentionDeplacement,
  validerMessageChat,
  validerPseudo,
  validerReglages,
} from './validation.js';

/** La valeur acceptee, ou un echec de test explicite si elle a ete refusee. */
function valeurAcceptee<T>(resultat: ResultatValidation<T>): T {
  if (!resultat.valide) {
    throw new Error(
      `Attendu accepte, recu refuse: ${resultat.erreurs.map((e) => `${e.champ} ${e.motif}`).join(' | ')}`,
    );
  }
  return resultat.valeur;
}

/** Les chemins des champs fautifs, ou un echec de test si l'entree a ete acceptee. */
function champsRefuses<T>(resultat: ResultatValidation<T>): readonly string[] {
  if (resultat.valide) {
    throw new Error('Attendu refuse, recu accepte.');
  }
  return resultat.erreurs.map((erreur) => erreur.champ);
}

describe('normaliserTexte', () => {
  it('rogne les bords et ramene les suites d espaces a un seul', () => {
    expect(normaliserTexte('  Alice   la   rapide  ')).toBe('Alice la rapide');
  });

  it('compose les accents en une seule ecriture', () => {
    // « e » suivi d'un accent aigu combinant, contre « e accent aigu » direct.
    expect(normaliserTexte('Renné')).toBe('Renné');
  });

  it('retire les caracteres invisibles et ramene les retours a la ligne a un espace', () => {
    expect(normaliserTexte('Ali​ce')).toBe('Alice');
    expect(normaliserTexte('Alice\nBob')).toBe('Alice Bob');
    // Inversion du sens de lecture: invisible, mais elle retourne la ligne.
    expect(normaliserTexte('Ali‮ce')).toBe('Alice');
    // Espace insecable: il ne se voit pas comme un espace ordinaire.
    expect(normaliserTexte('Alice  Bob')).toBe('Alice Bob');
  });
});

describe('validerPseudo', () => {
  it('accepte un pseudo ordinaire, et le rend normalise', () => {
    expect(valeurAcceptee(validerPseudo('  Bogossdu74  '))).toBe('Bogossdu74');
  });

  it('accepte les lettres accentuees, le tiret, le tiret bas et le point', () => {
    expect(valeurAcceptee(validerPseudo('Jean-Eude_2.0'))).toBe('Jean-Eude_2.0');
    expect(valeurAcceptee(validerPseudo('Elodie'))).toBe('Elodie');
  });

  it('refuse ce qui n est pas du texte', () => {
    expect(champsRefuses(validerPseudo(42))).toEqual(['pseudo']);
    expect(champsRefuses(validerPseudo(undefined))).toEqual(['pseudo']);
    expect(champsRefuses(validerPseudo({ pseudo: 'Alice' }))).toEqual(['pseudo']);
  });

  it('refuse un pseudo vide, meme fait d espaces', () => {
    expect(champsRefuses(validerPseudo(''))).toEqual(['pseudo']);
    expect(champsRefuses(validerPseudo('     '))).toEqual(['pseudo']);
  });

  it('accepte la longueur maximale et refuse un caractere de plus', () => {
    const limite = 'a'.repeat(BORNES_PSEUDO.longueur.maximum);

    expect(valeurAcceptee(validerPseudo(limite))).toBe(limite);
    expect(champsRefuses(validerPseudo(`${limite}a`))).toEqual(['pseudo']);
  });

  // Faille S1 de l'audit: le pseudo etait injecte dans du HTML par innerHTML.
  it('refuse un pseudo qui porte du balisage, et ne le restitue jamais', () => {
    for (const balise of [
      '<script>alert(1)</script>',
      '<img src=x onerror=alert(1)>',
      'Alice<br>',
      '"><b>gras</b>',
    ]) {
      const resultat = validerPseudo(balise);

      expect(resultat.valide).toBe(false);
      expect(JSON.stringify(resultat)).not.toContain('<');
    }
  });

  it('refuse les caracteres hors de la liste blanche', () => {
    for (const refuse of ['Ali&ce', "Ali'ce", 'Ali"ce', 'Alice!', 'Alice\u{1F600}', 'a/b']) {
      expect(champsRefuses(validerPseudo(refuse))).toEqual(['pseudo']);
    }
  });
});

describe('validerMessageChat', () => {
  const session: SessionJoueur = { id: 'socket-1', pseudo: 'Alice' };

  it('accepte un message ordinaire et le signe avec la session', () => {
    expect(valeurAcceptee(validerMessageChat(session, { texte: 'Bien joue !' }))).toEqual({
      auteur: 'socket-1',
      pseudo: 'Alice',
      texte: 'Bien joue !',
    });
  });

  // Faille S3 de l'audit: le legacy rediffusait le nickname fourni par le client.
  it('signe avec l identite de la session, meme si le message en declare une autre', () => {
    const usurpe = valeurAcceptee(
      validerMessageChat(session, {
        texte: 'Je suis Bob',
        auteur: 'socket-de-bob',
        pseudo: 'Bob',
        nickname: 'Bob',
      }),
    );

    expect(usurpe.auteur).toBe('socket-1');
    expect(usurpe.pseudo).toBe('Alice');
  });

  it('refuse ce qui n est pas un message', () => {
    expect(champsRefuses(validerMessageChat(session, 'coucou'))).toEqual(['message']);
    expect(champsRefuses(validerMessageChat(session, undefined))).toEqual(['message']);
    expect(champsRefuses(validerMessageChat(session, { message: 'coucou' }))).toEqual([
      'message.texte',
    ]);
  });

  it('refuse un message vide et accepte du texte libre, ponctuation comprise', () => {
    expect(champsRefuses(validerMessageChat(session, { texte: '   ' }))).toEqual(['message.texte']);
    expect(
      valeurAcceptee(validerMessageChat(session, { texte: "C'est bon, j'arrive !" })).texte,
    ).toBe("C'est bon, j'arrive !");
  });

  it('accepte la longueur maximale et refuse un caractere de plus, sans tronquer', () => {
    const limite = 'a'.repeat(BORNES_CHAT.longueur.maximum);

    expect(valeurAcceptee(validerMessageChat(session, { texte: limite })).texte).toBe(limite);
    expect(champsRefuses(validerMessageChat(session, { texte: `${limite}a` }))).toEqual([
      'message.texte',
    ]);
  });
});

describe('validerIntentionDeplacement', () => {
  it('accepte une intention ordinaire', () => {
    expect(
      valeurAcceptee(
        validerIntentionDeplacement({ deplacement: { x: 1, y: 0 }, enMouvement: true }),
      ),
    ).toEqual({ deplacement: { x: 1, y: 0 }, enMouvement: true });
  });

  it('accepte un vecteur de longueur quelconque: seule l orientation compte', () => {
    // La longueur n'est pas bornee ici, parce que le moteur ne la lit pas: il
    // fixe lui-meme la distance a partir de dt et de la vitesse du joueur.
    expect(
      valeurAcceptee(
        validerIntentionDeplacement({ deplacement: { x: 10_000, y: 0 }, enMouvement: true }),
      ).deplacement,
    ).toEqual({ x: 10_000, y: 0 });
  });

  it('refuse une coordonnee qui n est pas un nombre fini', () => {
    for (const absurde of [Number.NaN, Number.POSITIVE_INFINITY, '1', null, undefined]) {
      expect(
        champsRefuses(
          validerIntentionDeplacement({ deplacement: { x: absurde, y: 0 }, enMouvement: true }),
        ),
      ).toEqual(['intention.deplacement.x']);
    }
  });

  it('signale les deux coordonnees fautives d un coup', () => {
    expect(
      champsRefuses(
        validerIntentionDeplacement({
          deplacement: { x: Number.NaN, y: 'nord' },
          enMouvement: true,
        }),
      ),
    ).toEqual(['intention.deplacement.x', 'intention.deplacement.y']);
  });

  it('refuse une intention mal formee', () => {
    expect(champsRefuses(validerIntentionDeplacement(undefined))).toEqual(['intention']);
    expect(champsRefuses(validerIntentionDeplacement([1, 0]))).toEqual(['intention']);
    expect(champsRefuses(validerIntentionDeplacement({ enMouvement: true }))).toEqual([
      'intention.deplacement',
    ]);
    expect(
      champsRefuses(
        validerIntentionDeplacement({ deplacement: { x: 1, y: 0 }, enMouvement: 'oui' }),
      ),
    ).toEqual(['intention.enMouvement']);
  });

  // Faille S2 de l'audit: le legacy lisait speedBoostActive et isMobile.
  it('ignore tout champ d etat que le client ajouterait', () => {
    expect(
      valeurAcceptee(
        validerIntentionDeplacement({
          deplacement: { x: 1, y: 0 },
          enMouvement: true,
          speedBoostActive: true,
          isMobile: true,
        }),
      ),
    ).toEqual({ deplacement: { x: 1, y: 0 }, enMouvement: true });
  });
});

describe('validerReglages', () => {
  it('accepte l absence de reglages et rend les valeurs par defaut', () => {
    expect(valeurAcceptee(validerReglages(undefined))).toEqual(REGLAGES_PAR_DEFAUT);
    expect(valeurAcceptee(validerReglages({}))).toEqual(REGLAGES_PAR_DEFAUT);
  });

  it('ne complete que ce que l hote a change', () => {
    const reglages = valeurAcceptee(validerReglages({ dureePartieS: 300, carte: 'map3' }));

    expect(reglages.dureePartieS).toBe(300);
    expect(reglages.carte).toBe('map3');
    expect(reglages.nombreBotsInitial).toBe(REGLAGES_PAR_DEFAUT.nombreBotsInitial);
  });

  it('accepte les deux bornes de chaque reglage numerique', () => {
    const bornes = BORNES_REGLAGES;

    expect(
      valeurAcceptee(validerReglages({ dureePartieS: bornes.dureePartieS.minimum })).dureePartieS,
    ).toBe(bornes.dureePartieS.minimum);
    expect(
      valeurAcceptee(validerReglages({ dureePartieS: bornes.dureePartieS.maximum })).dureePartieS,
    ).toBe(bornes.dureePartieS.maximum);
    expect(
      valeurAcceptee(validerReglages({ nombreBotsInitial: bornes.nombreBotsInitial.minimum }))
        .nombreBotsInitial,
    ).toBe(bornes.nombreBotsInitial.minimum);
    expect(
      valeurAcceptee(validerReglages({ botsNoirs: { nombre: bornes.botsNoirs.nombre.maximum } }))
        .botsNoirs.nombre,
    ).toBe(bornes.botsNoirs.nombre.maximum);
  });

  it('refuse un reglage juste en dessous ou juste au-dessus des bornes', () => {
    expect(
      champsRefuses(validerReglages({ dureePartieS: BORNES_REGLAGES.dureePartieS.minimum - 1 })),
    ).toEqual(['dureePartieS']);
    expect(
      champsRefuses(validerReglages({ dureePartieS: BORNES_REGLAGES.dureePartieS.maximum + 1 })),
    ).toEqual(['dureePartieS']);
    expect(
      champsRefuses(
        validerReglages({ nombreBotsInitial: BORNES_REGLAGES.nombreBotsInitial.maximum + 1 }),
      ),
    ).toEqual(['nombreBotsInitial']);
  });

  it('refuse au lieu de rogner en silence', () => {
    const resultat = validerReglages({ dureePartieS: 7200 });

    expect(resultat.valide).toBe(false);
    expect(valeurAcceptee(validerReglages({})).dureePartieS).toBe(REGLAGES_PAR_DEFAUT.dureePartieS);
  });

  it('refuse un nombre qui n est pas entier ou qui n est pas un nombre', () => {
    expect(champsRefuses(validerReglages({ dureePartieS: 180.5 }))).toEqual(['dureePartieS']);
    expect(champsRefuses(validerReglages({ dureePartieS: Number.NaN }))).toEqual(['dureePartieS']);
    expect(champsRefuses(validerReglages({ dureePartieS: '180' }))).toEqual(['dureePartieS']);
  });

  it('refuse une carte inconnue et accepte celles qui existent', () => {
    expect(champsRefuses(validerReglages({ carte: 'tokyo' }))).toEqual(['carte']);
    expect(valeurAcceptee(validerReglages({ carte: 'map2' })).carte).toBe('map2');
  });

  it('refuse un interrupteur qui n est pas un booleen', () => {
    expect(champsRefuses(validerReglages({ modeMiroir: 'oui' }))).toEqual(['modeMiroir']);
    expect(champsRefuses(validerReglages({ botsNoirs: { actifs: 1 } }))).toEqual([
      'botsNoirs.actifs',
    ]);
    expect(champsRefuses(validerReglages({ zones: { types: { chaos: 'oui' } } }))).toEqual([
      'zones.types.chaos',
    ]);
  });

  it('valide les reglages imbriques des bonus et des malus', () => {
    const bornes = BORNES_REGLAGES;
    const reglages = valeurAcceptee(
      validerReglages({
        bonus: { types: { vitesse: { dureeS: bornes.bonus.dureeS.maximum, actif: false } } },
        malus: { types: { flou: { dureeS: bornes.malus.dureeS.minimum } } },
      }),
    );

    expect(reglages.bonus.types.vitesse).toEqual({
      actif: false,
      dureeS: bornes.bonus.dureeS.maximum,
      tauxApparitionPourCent: REGLAGES_PAR_DEFAUT.bonus.types.vitesse.tauxApparitionPourCent,
    });
    expect(reglages.malus.types.flou.dureeS).toBe(bornes.malus.dureeS.minimum);
    expect(reglages.malus.types.negatif).toEqual(REGLAGES_PAR_DEFAUT.malus.types.negatif);
  });

  it('signale toutes les erreurs d un coup, avec leur chemin complet', () => {
    expect(
      champsRefuses(
        validerReglages({
          dureePartieS: 1,
          bonus: { types: { vitesse: { dureeS: 999 } } },
          botsNoirs: { rayonDetectionPx: 0 },
        }),
      ),
    ).toEqual(['dureePartieS', 'bonus.types.vitesse.dureeS', 'botsNoirs.rayonDetectionPx']);
  });

  it('refuse une duree de zone minimale superieure a la maximale', () => {
    expect(
      champsRefuses(validerReglages({ zones: { dureeMinimumS: 100, dureeMaximumS: 20 } })),
    ).toEqual(['zones.dureeMinimumS']);
    expect(
      valeurAcceptee(validerReglages({ zones: { dureeMinimumS: 20, dureeMaximumS: 20 } })).zones
        .dureeMinimumS,
    ).toBe(20);
  });

  it('refuse un groupe de reglages qui n est pas un objet', () => {
    expect(champsRefuses(validerReglages({ bonus: 'tout' }))).toEqual(['bonus']);
    expect(champsRefuses(validerReglages({ malus: 'tout' }))).toEqual(['malus']);
    expect(champsRefuses(validerReglages({ zones: [] }))).toEqual(['zones']);
    expect(champsRefuses(validerReglages({ botsNoirs: 3 }))).toEqual(['botsNoirs']);
    expect(champsRefuses(validerReglages('tout'))).toEqual(['reglages']);
  });

  it('refuse une table de natures qui n est pas un objet, sans chercher plus loin', () => {
    expect(champsRefuses(validerReglages({ bonus: { types: 'tous' } }))).toEqual(['bonus.types']);
    expect(champsRefuses(validerReglages({ malus: { types: 'tous' } }))).toEqual(['malus.types']);
    expect(champsRefuses(validerReglages({ zones: { types: 'toutes' } }))).toEqual(['zones.types']);
  });

  it('refuse le reglage d une nature de bonus ou de malus qui n est pas un objet', () => {
    expect(champsRefuses(validerReglages({ bonus: { types: { vitesse: 'oui' } } }))).toEqual([
      'bonus.types.vitesse',
    ]);
    expect(champsRefuses(validerReglages({ malus: { types: { flou: 12 } } }))).toEqual([
      'malus.types.flou',
    ]);
  });

  it('ignore les champs inconnus au lieu de les recopier', () => {
    // Recopier a l aveugle un objet fourni par un client permettrait d y glisser
    // une cle speciale du langage et de modifier des objets sans rapport.
    const reglages = valeurAcceptee(
      validerReglages(
        JSON.parse('{"dureePartieS": 300, "__proto__": {"pollue": true}}') as unknown,
      ),
    );

    expect(reglages.dureePartieS).toBe(300);
    expect(Object.hasOwn(reglages, 'pollue')).toBe(false);
    expect(({} as Record<string, unknown>)['pollue']).toBeUndefined();
  });
});

describe('validerCodeInvitation', () => {
  it('ramene un code saisi a sa forme canonique', () => {
    expect(valeurAcceptee(validerCodeInvitation('  nx7k2p '))).toBe('NX7K2P');
  });

  it('accepte chaque caractere de l alphabet des codes', () => {
    const { alphabet, longueur } = BORNES_CODE_INVITATION;

    for (let debut = 0; debut < alphabet.length; debut += longueur) {
      const code = alphabet.slice(debut, debut + longueur).padEnd(longueur, 'A');

      expect(valeurAcceptee(validerCodeInvitation(code))).toBe(code);
    }
  });

  it('refuse les caracteres qui se confondent, et toute autre longueur', () => {
    for (const faux of ['NX7K2O', 'NX7K20', 'NX7K2I', 'NX7K21', 'NX7K2', 'NX7K2PP', 'NX-K2P', '']) {
      expect(champsRefuses(validerCodeInvitation(faux))).toEqual(['code']);
    }
  });

  it('refuse ce qui n est pas du texte', () => {
    expect(champsRefuses(validerCodeInvitation(123456))).toEqual(['code']);
  });
});

describe('validerDemandeCreation', () => {
  it('accepte une partie privee et complete ses reglages', () => {
    const demande = valeurAcceptee(
      validerDemandeCreation({
        pseudo: ' Alice ',
        configuration: { mode: 'classique', visibilite: 'privee' },
      }),
    );

    expect(demande).toEqual({
      pseudo: 'Alice',
      configuration: { mode: 'classique', visibilite: 'privee', reglages: REGLAGES_PAR_DEFAUT },
    });
  });

  it('garde les reglages de depart demandes', () => {
    const demande = valeurAcceptee(
      validerDemandeCreation({
        pseudo: 'Alice',
        configuration: {
          mode: 'classique',
          visibilite: 'publique',
          reglages: { carte: 'map3', dureePartieS: 60 },
        },
      }),
    );

    expect(demande.configuration.reglages).toMatchObject({ carte: 'map3', dureePartieS: 60 });
  });

  it('refuse un mode ou une visibilite inconnus, sans les remplacer par un defaut', () => {
    expect(
      champsRefuses(
        validerDemandeCreation({
          pseudo: 'Alice',
          configuration: { mode: 'chasse', visibilite: 'publique' },
        }),
      ),
    ).toEqual(['configuration.mode']);
    expect(
      champsRefuses(
        validerDemandeCreation({ pseudo: 'Alice', configuration: { mode: 'classique' } }),
      ),
    ).toEqual(['configuration.visibilite']);
  });

  it('refuse des reglages aberrants avec le motif meme du salon', () => {
    const verdict = validerDemandeCreation({
      pseudo: 'Alice',
      configuration: {
        mode: 'classique',
        visibilite: 'publique',
        reglages: { dureePartieS: 5000 },
      },
    });

    expect(champsRefuses(verdict)).toEqual(champsRefuses(validerReglages({ dureePartieS: 5000 })));
    expect(champsRefuses(verdict)).toEqual(['dureePartieS']);
  });

  it('refuse une demande, une configuration ou un pseudo mal formes', () => {
    expect(champsRefuses(validerDemandeCreation(undefined))).toEqual(['creerPartie']);
    expect(champsRefuses(validerDemandeCreation({ pseudo: 'Alice' }))).toEqual(['configuration']);
    expect(
      champsRefuses(
        validerDemandeCreation({
          pseudo: '',
          configuration: { mode: 'classique', visibilite: 'publique' },
        }),
      ),
    ).toEqual(['pseudo']);
  });
});

describe('validerDemandeRejoindre, par code d invitation', () => {
  it('accepte un code et le ramene a sa forme canonique', () => {
    expect(valeurAcceptee(validerDemandeRejoindre({ pseudo: 'Alice', code: 'nx7k2p' }))).toEqual({
      pseudo: 'Alice',
      code: 'NX7K2P',
    });
  });

  it('refuse un code mal forme en nommant le code', () => {
    expect(champsRefuses(validerDemandeRejoindre({ pseudo: 'Alice', code: 'NX7K2O' }))).toEqual([
      'code',
    ]);
    expect(champsRefuses(validerDemandeRejoindre({ pseudo: 'Alice', code: 42 }))).toEqual(['code']);
  });

  it('refuse un identifiant et un code ensemble: la demande serait ambigue', () => {
    expect(
      champsRefuses(validerDemandeRejoindre({ pseudo: 'Alice', idRoom: 'room-1', code: 'NX7K2P' })),
    ).toEqual(['rejoindre']);
  });
});

describe('validerDemandeRejoindre', () => {
  it('accepte un pseudo seul: sans partie visee, c est la partie rapide', () => {
    const demande = valeurAcceptee(validerDemandeRejoindre({ pseudo: 'Alice' }));

    expect(demande).toEqual({ pseudo: 'Alice' });
  });

  it('normalise le pseudo comme partout ailleurs', () => {
    const demande = valeurAcceptee(validerDemandeRejoindre({ pseudo: '  Alice   B  ' }));

    expect(demande.pseudo).toBe('Alice B');
  });

  it('accepte un identifiant de partie bien forme', () => {
    const demande = valeurAcceptee(validerDemandeRejoindre({ pseudo: 'Alice', idRoom: 'room-12' }));

    expect(demande).toEqual({ pseudo: 'Alice', idRoom: 'room-12' });
  });

  it('refuse ce qui n est pas un objet', () => {
    expect(champsRefuses(validerDemandeRejoindre(undefined))).toEqual(['rejoindre']);
    expect(champsRefuses(validerDemandeRejoindre('Alice'))).toEqual(['rejoindre']);
    expect(champsRefuses(validerDemandeRejoindre(['Alice']))).toEqual(['rejoindre']);
  });

  it('refuse un pseudo invalide en nommant le pseudo, pas la demande', () => {
    expect(champsRefuses(validerDemandeRejoindre({ pseudo: '' }))).toEqual(['pseudo']);
    expect(champsRefuses(validerDemandeRejoindre({ pseudo: 42 }))).toEqual(['pseudo']);
    expect(champsRefuses(validerDemandeRejoindre({}))).toEqual(['pseudo']);
  });

  it('refuse un identifiant de partie qui n est pas du texte', () => {
    expect(champsRefuses(validerDemandeRejoindre({ pseudo: 'Alice', idRoom: 7 }))).toEqual([
      'idRoom',
    ]);
  });

  it('accepte la longueur maximale et refuse celle qui la depasse d un caractere', () => {
    const maximum = 'a'.repeat(BORNES_ROOM.longueur.maximum);

    expect(
      valeurAcceptee(validerDemandeRejoindre({ pseudo: 'Alice', idRoom: maximum })).idRoom,
    ).toBe(maximum);
    expect(
      champsRefuses(validerDemandeRejoindre({ pseudo: 'Alice', idRoom: `${maximum}a` })),
    ).toEqual(['idRoom']);
    expect(champsRefuses(validerDemandeRejoindre({ pseudo: 'Alice', idRoom: '' }))).toEqual([
      'idRoom',
    ]);
  });

  it('refuse un identifiant de partie hors de la liste blanche', () => {
    // Cet identifiant sert de cle de recherche et de nom de salle Socket.IO: on
    // n y laisse entrer que ce dont il a besoin.
    for (const suspect of ['room 1', 'room/1', 'room.1', '../room', '__proto__ ']) {
      expect(champsRefuses(validerDemandeRejoindre({ pseudo: 'Alice', idRoom: suspect }))).toEqual([
        'idRoom',
      ]);
    }
  });

  it('ignore les champs que la demande ajoute d elle-meme', () => {
    const demande = valeurAcceptee(
      validerDemandeRejoindre({ pseudo: 'Alice', hote: true, score: 9999 }),
    );

    expect(demande).toEqual({ pseudo: 'Alice' });
  });
});
