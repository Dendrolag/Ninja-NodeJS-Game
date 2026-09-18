/**
 * Tests du mode Massacre dans la page (etape 7.4): le HUD du combo et du katana, les
 * annonces, les sons, les points qui s'envolent, le dessin du sang, les traces de pas, ce
 * que la scene montre des coups, et la preference de sang.
 *
 * Ce que ces tests protegent: le sang reproductible (tous les joueurs voient les memes
 * taches), le combo lu sans le flux d'etat, et une page qui ne montre rien du Massacre dans
 * les autres modes.
 */

import { COMBO, MASSACRE } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import { annonceDuFait } from './annonces.js';
import { fait } from './faits.js';
import { construireHud } from './hud/modele.js';
import { NIVEAU_DE_SANG_PAR_DEFAUT, lireNiveauDeSang } from './interface/preferences.js';
import { coup, etatDeMassacre, miseAMort } from './massacre.essais.js';
import { pointsDuChangement } from './pointsFlottants.js';
import { APPARENCE_KATANA } from './rendu/apparence.js';
import { imageDuMassacre, instantAffiche, suivreLeMicroArret } from './rendu/katana.js';
import { eclaboussure, empreinte, graineDe } from './rendu/sang.js';
import { AUCUN_PAS, TRACES, avancerLesPas } from './rendu/traces.js';
import { sonDuFait } from './sons/declencheurs.js';

describe('le HUD d une partie Massacre', () => {
  it('montre le katana pret, et les ninjas qui restent, sans combo', () => {
    const hud = construireHud(etatDeMassacre({ ninjas: 37 }), 0);

    expect(hud.arme).toBe('katana');
    expect(hud.charges).toEqual({ disponibles: 1, maximum: 1, recharge: 1 });
    expect(hud.combo).toEqual({
      multiplicateur: 1,
      compte: '',
      fenetre: 0,
      restants: '37 ninjas restants',
    });
  });

  it('montre le katana qui revient apres un coup', () => {
    const hud = construireHud(etatDeMassacre({ pret: false }), 0);

    expect(hud.charges).toEqual({
      disponibles: 0,
      maximum: 1,
      recharge: 1 - 100 / MASSACRE.DELAI_ENTRE_COUPS_MS,
    });
  });

  it('lit le combo dans notre dernier coup qui a tue, et sa fenetre qui s epuise', () => {
    const journal = [coup(1000, { combo: 7, multiplicateur: 2 }), coup(1200, { morts: [] })];
    const hud = construireHud(etatDeMassacre({ journal }), 1500);

    expect(hud.combo).toMatchObject({ multiplicateur: 2, compte: '7 morts', fenetre: 0.75 });
  });

  it('laisse tomber le combo apres sa fenetre, ou quand on se fait tuer', () => {
    const journal = [coup(1000, { combo: 7, multiplicateur: 2 })];

    expect(construireHud(etatDeMassacre({ journal }), 1000 + COMBO.FENETRE_MS).combo).toMatchObject(
      { multiplicateur: 1, compte: '' },
    );
    expect(
      construireHud(
        etatDeMassacre({ journal: [...journal, miseAMort(1100, { victime: 'alice' })] }),
        1200,
      ).combo,
    ).toMatchObject({ multiplicateur: 1 });
    expect(
      construireHud(
        etatDeMassacre({
          journal: [...journal, fait('captureParBotNoir', { botsPerdus: 0 }, 1100)],
        }),
        1200,
      ).combo,
    ).toMatchObject({ multiplicateur: 1 });
  });

  it('ignore les coups des autres, et accorde les ninjas restants', () => {
    const journal = [coup(1000, { frappeur: 'bob', combo: 9, multiplicateur: 2 })];

    expect(construireHud(etatDeMassacre({ journal, ninjas: 1 }), 1100).combo).toMatchObject({
      multiplicateur: 1,
      restants: '1 ninja restant',
    });
    expect(construireHud(etatDeMassacre({ ninjas: 0 }), 0).combo?.restants).toBe('Carte nettoyée');
  });

  it('ne montre rien du Massacre dans un autre mode', () => {
    const hud = construireHud(etatDeMassacre({ mode: 'tactique' }), 0);

    expect(hud.combo).toBeUndefined();
    expect(hud.arme).toBe('charges');
  });
});

describe('les annonces, les sons et les points du Massacre', () => {
  it('annonce un nouveau palier de combo, a celui qui frappe seulement', () => {
    const palier = coup(0, {
      combo: 5,
      multiplicateur: 2,
      morts: [{ id: 'b1', x: 0, y: 0, noir: false, points: 20, couleur: '#FFFFFF' }],
    });

    expect(annonceDuFait(palier, 'massacre', 'alice')).toEqual({
      texte: 'Combo x2 !',
      ton: 'succes',
    });
    expect(annonceDuFait(palier, 'massacre', 'bob')).toBeUndefined();
    expect(annonceDuFait(coup(0, { combo: 6, multiplicateur: 2 }), 'massacre', 'alice')).toBe(
      undefined,
    );
  });

  it('annonce un joueur tue a son tueur et a sa victime, et la carte videe a tous', () => {
    expect(annonceDuFait(miseAMort(0), 'massacre', 'alice')).toEqual({
      texte: 'Vous avez tranché Bob : +10 points',
      ton: 'succes',
    });
    expect(annonceDuFait(miseAMort(0), 'massacre', 'bob')).toEqual({
      texte: 'Tranché par Alice : -10 points',
      ton: 'alerte',
    });
    expect(annonceDuFait(miseAMort(0), 'massacre', 'carl')).toBeUndefined();
    expect(
      annonceDuFait(fait('carteVidee', { bonus: 300, tempsRestantMs: 60_000 }, 0), 'massacre'),
    ).toEqual({ texte: 'Carte nettoyée : +300 points de temps', ton: 'succes' });
    expect(annonceDuFait(fait('captureParBotNoir', { botsPerdus: 0 }, 0), 'massacre')?.texte).toBe(
      'Un Black Ninja vous a eu : points perdus, combo brisé',
    );
  });

  it('fait entendre notre coup, qui fend l air ou tranche, et pas celui des autres', () => {
    expect(sonDuFait(coup(0), 'alice')).toBe('katanaImpact');
    expect(sonDuFait(coup(0, { morts: [] }), 'alice')).toBe('katana');
    expect(sonDuFait(coup(0), 'bob')).toBeUndefined();
    expect(sonDuFait(miseAMort(0), 'alice')).toBe('joueurCapture');
    expect(sonDuFait(miseAMort(0), 'bob')).toBe('joueurCaptureSubi');
    expect(sonDuFait(miseAMort(0), 'carl')).toBeUndefined();
    expect(sonDuFait(fait('carteVidee', { bonus: 0, tempsRestantMs: 0 }, 0))).toBeUndefined();
  });

  it('fait s envoler les points de nos morts, a leur niveau de combo, et des points voles', () => {
    const avant = etatDeMassacre();
    const apres = etatDeMassacre({
      journal: [
        coup(0, {
          morts: [
            { id: 'b1', x: 10, y: 20, noir: false, points: 20, couleur: '#FFFFFF' },
            { id: 'n1', x: 30, y: 40, noir: true, points: 30, couleur: '#000000' },
          ],
        }),
        coup(0, { frappeur: 'bob' }),
        miseAMort(0),
      ],
    });

    expect(pointsDuChangement(avant, apres)).toEqual([
      { valeur: 20, genre: 'bot', niveau: 2, x: 10, y: 20 },
      { valeur: 30, genre: 'botNoir', niveau: 2, x: 30, y: 40 },
      { valeur: 10, genre: 'joueur', niveau: 1, x: 400, y: 400 },
    ]);
  });
});

describe('le dessin du sang', () => {
  it('est le meme pour un meme mort, chez tous les joueurs', () => {
    expect(eclaboussure('bot-12', 500, 500, 0)).toEqual(eclaboussure('bot-12', 500, 500, 0));
    expect(graineDe('bot-12')).not.toBe(graineDe('bot-13'));
    expect(eclaboussure('bot-12', 500, 500, 0)).not.toEqual(eclaboussure('bot-13', 500, 500, 0));
  });

  it('projette ses gouttes et ses trainees du cote du coup', () => {
    const formes = eclaboussure('bot-4', 500, 500, 0);
    const loin = formes.filter((forme) => Math.hypot(forme.x - 500, forme.y - 500) > 14);

    expect(formes.length).toBeGreaterThan(10);
    expect(loin.length).toBeGreaterThan(0);
    expect(loin.every((forme) => forme.x > 500)).toBe(true);
    expect(formes.every((forme) => forme.alpha > 0 && forme.alpha <= 1)).toBe(true);
  });

  it('est plus petit a une echelle discrete', () => {
    const taille = (echelle: number): number =>
      Math.max(...eclaboussure('bot-4', 0, 0, 0, echelle).map((forme) => forme.rayonX));

    expect(taille(0.5)).toBeCloseTo(taille(1) / 2);
  });

  it('dessine une empreinte tournee dans le sens de la marche', () => {
    const [semelle, talon] = empreinte(100, 100, Math.PI / 2, 0.5);

    expect(semelle).toMatchObject({ rotation: Math.PI / 2, alpha: 0.5 });
    expect(semelle?.y).toBeGreaterThan(100);
    expect(talon?.y).toBeLessThan(100);
  });
});

describe('les traces de pas', () => {
  const TACHE = { x: 100, y: 100, instant: 0 };

  it('charge les pieds de qui marche dans le sang frais, et imprime un pas par foulee', () => {
    let suivi = avancerLesPas(AUCUN_PAS, [{ id: 'alice', x: 100, y: 100 }], [TACHE], 10).suivi;
    const tous = [];

    for (let x = 102; x <= 400; x += 2) {
      const avance = avancerLesPas(suivi, [{ id: 'alice', x, y: 100 }], [TACHE], 10 + x);
      suivi = avance.suivi;
      tous.push(...avance.pas);
    }

    // Tant qu'il marche dans la tache, ses pieds se rechargent: on compte les pas d'apres.
    const pas = tous.filter((un) => un.x > TACHE.x + TRACES.rayonDeLaTachePx);

    expect(pas).toHaveLength(TRACES.pasParPassage);
    expect(pas[0]?.opacite).toBeCloseTo(TRACES.opaciteDuPremier);
    expect(pas.at(-1)?.opacite).toBeCloseTo(TRACES.opaciteDuDernier);
    // Un pied puis l'autre, de chaque cote de la marche.
    expect(Math.sign((pas[0]?.y ?? 100) - 100)).toBe(-Math.sign((pas[1]?.y ?? 100) - 100));
    expect(new Set(pas.map((un) => un.id)).size).toBe(pas.length);
  });

  it('ne laisse rien hors du sang, ni dans un sang seche', () => {
    const loin = avancerLesPas(AUCUN_PAS, [{ id: 'alice', x: 800, y: 800 }], [TACHE], 10);
    const seche = avancerLesPas(
      AUCUN_PAS,
      [{ id: 'alice', x: 100, y: 100 }],
      [TACHE],
      TRACES.fraicheurMs + 1,
    );
    const apres = avancerLesPas(seche.suivi, [{ id: 'alice', x: 150, y: 100 }], [TACHE], 40_000);

    expect(loin.pas).toEqual([]);
    expect(apres.pas).toEqual([]);
  });

  it('oublie un joueur qui n est plus affiche', () => {
    const suivi = avancerLesPas(AUCUN_PAS, [{ id: 'alice', x: 100, y: 100 }], [TACHE], 0).suivi;

    expect(avancerLesPas(suivi, [], [TACHE], 10).suivi.size).toBe(0);
  });
});

describe('ce que la scene montre d un coup de katana', () => {
  it('montre la trainee, l eclat, le cadavre et le sang a imprimer, au niveau normal', () => {
    const image = imageDuMassacre(etatDeMassacre({ journal: [coup(1000)] }), 1050, 'normal');

    expect(image.cones.map((cone) => cone.id)).toEqual(['coup:alice:0:arc', 'coup:alice:0:lame']);
    expect(image.disques.map((disque) => disque.id)).toEqual(['b9:eclat']);
    expect(image.cadavres).toMatchObject([{ id: 'b9:cadavre', x: 130, y: 100 }]);
    expect(image.sang).toMatchObject([{ id: 'b9', x: 130, y: 100, instant: 1000 }]);
    expect(image.sang[0]?.formes).toEqual(eclaboussure('b9', 130, 100, 0));
    expect(Math.hypot(image.secousse.x, image.secousse.y)).toBeGreaterThan(0);
  });

  it('couche le cadavre dans la couleur du mort, assombrie (etape 5.5)', () => {
    // La couleur du mort n'etait pas transmise: tous les cadavres avaient la meme teinte.
    const image = imageDuMassacre(etatDeMassacre({ journal: [coup(1000)] }), 1050, 'normal');

    // #FF8000, assombri de 40 pour cent.
    expect(image.cadavres[0]?.teinte).toBe(0x994d00);
  });

  it('laisse la trainee et l eclat s effacer, et ne propose plus le sang, une fois imprime', () => {
    const image = imageDuMassacre(etatDeMassacre({ journal: [coup(0)] }), 1500, 'normal');

    expect(image.cones).toEqual([]);
    expect(image.disques).toEqual([]);
    expect(image.sang).toEqual([]);
    expect(image.cadavres).toHaveLength(1);
    expect(image.secousse).toEqual({ x: 0, y: 0 });
  });

  it('dessine un sang discret qui s efface, sans rien imprimer', () => {
    const tot = imageDuMassacre(etatDeMassacre({ journal: [coup(0)] }), 1000, 'discret');
    const tard = imageDuMassacre(
      etatDeMassacre({ journal: [coup(0)] }),
      APPARENCE_KATANA.sangDiscret.dureeMs,
      'discret',
    );

    expect(tot.sang).toEqual([]);
    expect(tot.disques.some((disque) => disque.id.startsWith('b9:sang:'))).toBe(true);
    expect(tard.disques).toEqual([]);
  });

  it('ne garde qu un eclat quand le sang est desactive', () => {
    const image = imageDuMassacre(etatDeMassacre({ journal: [coup(0)] }), 50, 'desactive');

    expect(image.sang).toEqual([]);
    expect(image.cadavres).toEqual([]);
    expect(image.disques.map((disque) => disque.id)).toEqual(['b9:eclat']);
  });

  it('fait couler le sang d un joueur tue, et ne secoue pas pour le coup d un autre', () => {
    const image = imageDuMassacre(
      etatDeMassacre({ journal: [miseAMort(0), coup(0, { frappeur: 'bob' })] }),
      50,
      'normal',
    );

    expect(image.sang.map((tache) => tache.id)).toEqual(['tranche:bob:400:400', 'b9']);
    expect(image.secousse).toEqual({ x: 0, y: 0 });
  });

  it('ne montre rien dans un autre mode', () => {
    const image = imageDuMassacre(
      etatDeMassacre({ journal: [coup(0)], mode: 'classique' }),
      50,
      'normal',
    );

    expect(image).toMatchObject({ cones: [], disques: [], cadavres: [], sang: [] });
  });
});

describe('le micro-arret de l impact', () => {
  it('fige le mouvement affiche quand notre coup tranche, puis le relache', () => {
    const arret = suivreLeMicroArret(undefined, [coup(1000)], 'alice', 1000);

    expect(arret).toEqual({ depuis: 1000, jusqua: 1000 + APPARENCE_KATANA.microArretMs });
    expect(instantAffiche(arret, 1020)).toBe(1000);
    expect(suivreLeMicroArret(arret, [], 'alice', 1020)).toBe(arret);
    expect(suivreLeMicroArret(arret, [], 'alice', 1000 + APPARENCE_KATANA.microArretMs)).toBe(
      undefined,
    );
    expect(instantAffiche(undefined, 1100)).toBe(1100);
  });

  it('ne fige rien pour un coup dans le vide, ni pour le coup d un autre', () => {
    expect(suivreLeMicroArret(undefined, [coup(0, { morts: [] })], 'alice', 0)).toBeUndefined();
    expect(suivreLeMicroArret(undefined, [coup(0, { frappeur: 'bob' })], 'alice', 0)).toBe(
      undefined,
    );
  });
});

describe('la preference de sang', () => {
  it('lit un niveau enregistre, et remplace tout le reste par le niveau normal', () => {
    expect(lireNiveauDeSang('discret')).toBe('discret');
    expect(lireNiveauDeSang('desactive')).toBe('desactive');
    expect(lireNiveauDeSang('rouge')).toBe(NIVEAU_DE_SANG_PAR_DEFAUT);
    expect(lireNiveauDeSang(null)).toBe('normal');
    expect(lireNiveauDeSang(undefined)).toBe('normal');
  });
});
