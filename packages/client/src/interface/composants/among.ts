/**
 * Les ecrans d'Among Ninjas, poses par-dessus la carte (etape 7.20): la revelation, la reunion
 * et son vote, l'ejection, et le chat des fantomes. Ce composant pose ce que le modele
 * (modeles/among.ts) decide, et rien d'autre.
 *
 * LA TABLE RONDE (rendu B de la planche, a ameliorer): les joueurs en cercle autour du gong.
 * Pendant le vote, un vivant touche un joueur vivant pour voter contre lui, ou « Passer ». A
 * l'ejection, chaque vote devient un trait courbe de la couleur du votant, qui part du bord de
 * sa place et finit par une fleche au bord de la place visee, ou de « Passer ». Sans votes
 * nommes (votes anonymes), seul le nombre de voix s'affiche.
 *
 * Les traits se calculent en pixels, sur la place reelle de chaque carte a l'ecran, et ne se
 * redessinent que si les votes ou la taille de la table changent: redessines a chaque image,
 * leur animation repartait de zero sans fin, et l'on n'en voyait que des bouts (retour
 * d'essai du porteur du projet, 9 octobre 2026).
 *
 * L'EGOUT (rendu B, a affiner): a l'ejection, l'ejecte s'enfonce dans une bouche d'egout
 * neon, sous la table.
 *
 * Le texte venu d'un joueur passe par textContent, jamais par du balisage.
 */

import type { Client } from '../../client.js';
import type { EtatClient } from '../../etat.js';
import { avatarDeNinja } from '../avatarNinja.js';
import { bouton, creer, ecrireTexte, montrer } from '../dom.js';
import type { EcranAmong, JoueurAmongVu, TraitDeVote } from '../modeles/among.js';
import { chatDesFantomes, ecranAmong } from '../modeles/among.js';
import type { MessageDuChat } from '../modeles/salon.js';
import { monterChat } from './chat.js';

/** Les ecrans du mode, montes. */
export interface EcransAmong {
  readonly racine: HTMLElement;
  afficher(etat: EtatClient): void;
  demonter(): void;
}

/** L'espace de noms des elements SVG. */
const SVG = 'http://www.w3.org/2000/svg';

/** La place d'un joueur autour de la table, en pour cent de la table. */
function placeAutourDeLaTable(rang: number, nombre: number): { x: number; y: number } {
  const angle = -Math.PI / 2 + (rang * 2 * Math.PI) / Math.max(nombre, 1);

  return { x: 50 + Math.cos(angle) * 40, y: 50 + Math.sin(angle) * 36 };
}

/** Un point, en pixels, dans le repere de la table. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Une carte a l'ecran: son centre et sa demi-largeur et demi-hauteur, en pixels. */
export interface Boite {
  readonly x: number;
  readonly y: number;
  readonly demiLargeur: number;
  readonly demiHauteur: number;
}

/** Le dessin d'un vote: la courbe, et le triangle de la fleche. */
export interface DessinDeVote {
  readonly chemin: string;
  readonly fleche: string;
}

/** L'espace laisse entre la pointe d'une fleche et la carte qu'elle vise, en pixels. */
const ECART_DE_LA_FLECHE = 4;
/** La longueur et la demi-largeur d'une fleche, en pixels. */
const LONGUEUR_DE_LA_FLECHE = 11;
const DEMI_LARGEUR_DE_LA_FLECHE = 6;

/** Le point du bord d'une boite dans la direction d'un autre point, plus un ecart. */
function bordVers(boite: Boite, vers: Point, ecart: number): Point {
  const dx = vers.x - boite.x;
  const dy = vers.y - boite.y;
  const longueur = Math.hypot(dx, dy);

  if (longueur === 0) {
    return { x: boite.x, y: boite.y };
  }

  // La demi-diagonale touchee la premiere, horizontale ou verticale.
  const echelle = Math.min(
    dx === 0 ? Infinity : boite.demiLargeur / Math.abs(dx),
    dy === 0 ? Infinity : boite.demiHauteur / Math.abs(dy),
  );

  return {
    x: boite.x + dx * echelle + (dx / longueur) * ecart,
    y: boite.y + dy * echelle + (dy / longueur) * ecart,
  };
}

/** Un nombre en pixels, arrondi au dixieme, pour un attribut SVG. */
function px(valeur: number): string {
  return String(Math.round(valeur * 10) / 10);
}

/** Le triangle d'une fleche dont la pointe est en `pointe`, venue de la direction `depuis`. */
function triangle(pointe: Point, depuis: Point): { base: Point; points: string } {
  const dx = pointe.x - depuis.x;
  const dy = pointe.y - depuis.y;
  const longueur = Math.hypot(dx, dy) || 1;
  const ux = dx / longueur;
  const uy = dy / longueur;
  const base = {
    x: pointe.x - ux * LONGUEUR_DE_LA_FLECHE,
    y: pointe.y - uy * LONGUEUR_DE_LA_FLECHE,
  };
  const gauche = {
    x: base.x - uy * DEMI_LARGEUR_DE_LA_FLECHE,
    y: base.y + ux * DEMI_LARGEUR_DE_LA_FLECHE,
  };
  const droite = {
    x: base.x + uy * DEMI_LARGEUR_DE_LA_FLECHE,
    y: base.y - ux * DEMI_LARGEUR_DE_LA_FLECHE,
  };

  return {
    base,
    points: [pointe, gauche, droite].map((point) => `${px(point.x)},${px(point.y)}`).join(' '),
  };
}

/**
 * Le dessin d'un vote, de la carte du votant a celle qu'il vise, en pixels. La courbe se
 * creuse vers le centre de la table, pour que les traits ne passent pas tous par le meme
 * chemin droit; elle part du bord du votant et s'arrete avant le bord vise, ou la fleche la
 * termine, hors de la carte qui la cacherait. Un vote contre soi-meme fait une boucle
 * au-dessus de sa carte.
 */
export function dessinDeVote(de: Boite, vers: Boite, centre: Point): DessinDeVote {
  if (de.x === vers.x && de.y === vers.y) {
    const haut = de.y - de.demiHauteur;
    const depart = { x: de.x + de.demiLargeur * 0.4, y: haut };
    const pointe = { x: de.x - de.demiLargeur * 0.4, y: haut - ECART_DE_LA_FLECHE };
    const controleA = { x: de.x + de.demiLargeur, y: haut - 44 };
    const controleB = { x: de.x - de.demiLargeur, y: haut - 44 };
    const fleche = triangle(pointe, controleB);

    return {
      chemin: `M ${px(depart.x)} ${px(depart.y)} C ${px(controleA.x)} ${px(controleA.y)} ${px(controleB.x)} ${px(controleB.y)} ${px(fleche.base.x)} ${px(fleche.base.y)}`,
      fleche: fleche.points,
    };
  }

  const milieu = { x: (de.x + vers.x) / 2, y: (de.y + vers.y) / 2 };
  const controle = {
    x: centre.x + (milieu.x - centre.x) * 0.3,
    y: centre.y + (milieu.y - centre.y) * 0.3,
  };
  const depart = bordVers(de, controle, 0);
  const pointe = bordVers(vers, controle, ECART_DE_LA_FLECHE);
  const fleche = triangle(pointe, controle);

  return {
    chemin: `M ${px(depart.x)} ${px(depart.y)} Q ${px(controle.x)} ${px(controle.y)} ${px(fleche.base.x)} ${px(fleche.base.y)}`,
    fleche: fleche.points,
  };
}

/** La boite d'un element a l'ecran, dans le repere d'une origine. */
function boiteDans(element: Element, origine: DOMRect): Boite {
  const rect = element.getBoundingClientRect();

  return {
    x: rect.left - origine.left + rect.width / 2,
    y: rect.top - origine.top + rect.height / 2,
    demiLargeur: rect.width / 2,
    demiHauteur: rect.height / 2,
  };
}

/** Les messages du chat, tels que le composant de chat les montre; un fantome est marque. */
function messagesDuChat(etat: EtatClient): readonly MessageDuChat[] {
  return etat.messages.map((message, rang) => ({
    cle: `${String(message.recuA)}:${String(rang)}`,
    pseudo: message.canal === 'fantomes' ? `${message.pseudo} · fantôme` : message.pseudo,
    texte: message.texte,
    moi: message.auteur === etat.moi,
  }));
}

/** Monte les ecrans du mode, caches. */
export function monterEcransAmong(doc: Document, client: Client): EcransAmong {
  const racine = creer(doc, 'div', { classe: 'among-ecrans' });

  // La revelation: la rangee de tous les joueurs.
  const revelation = creer(doc, 'section', {
    classe: 'among-revelation',
    attributs: { role: 'status' },
  });
  const titreRevelation = creer(doc, 'h2', { classe: 'among-titre' });
  const consigne = creer(doc, 'p', { classe: 'among-consigne' });
  const rangee = creer(doc, 'ul', { classe: 'among-rangee' });
  revelation.append(titreRevelation, consigne, rangee);
  revelation.hidden = true;

  // La reunion: la table ronde, son titre, son temps, « Passer », et le chat.
  const reunion = creer(doc, 'section', { classe: 'among-reunion', attributs: { role: 'dialog' } });
  const entete = creer(doc, 'header', { classe: 'among-reunion-entete' });
  const titreReunion = creer(doc, 'h2', { classe: 'among-reunion-titre' });
  const phase = creer(doc, 'span', { classe: 'among-reunion-phase' });
  entete.append(titreReunion, phase);
  const table = creer(doc, 'div', { classe: 'among-table' });
  const traits = doc.createElementNS(SVG, 'svg');
  traits.setAttribute('class', 'among-traits');
  traits.setAttribute('aria-hidden', 'true');
  const gong = creer(doc, 'div', { classe: 'among-gong', texte: 'GONG' });
  table.append(traits, gong);
  const passer = bouton(
    doc,
    { classe: 'bouton bouton-secondaire among-passer', texte: 'Passer' },
    () => {
      client.voter(null);
    },
  );
  const voixPasser = creer(doc, 'span', { classe: 'among-place-voix' });
  passer.append(voixPasser);
  const chat = monterChat(doc, client, 'Réunion');
  chat.racine.classList.add('among-chat');

  // L'ejection: la bouche d'egout, l'ejecte qui s'y enfonce, le texte.
  const egout = creer(doc, 'div', { classe: 'among-egout' });
  const bouche = creer(doc, 'div', { classe: 'among-egout-bouche' });
  const chute = creer(doc, 'div', { classe: 'among-egout-chute' });
  bouche.append(chute);
  const texteEjection = creer(doc, 'p', {
    classe: 'among-egout-texte',
    attributs: { role: 'status' },
  });
  const detailEjection = creer(doc, 'p', { classe: 'among-egout-detail' });
  egout.append(bouche, texteEjection, detailEjection);

  reunion.append(entete, table, passer, egout, chat.racine);
  reunion.hidden = true;

  // Le chat des fantomes, pendant le jeu.
  const chatFantomes = monterChat(doc, client, 'Chat des fantômes');
  chatFantomes.racine.classList.add('among-chat-fantomes');
  chatFantomes.racine.hidden = true;

  racine.append(revelation, reunion, chatFantomes.racine);

  /** Les places deja posees autour de la table, par joueur. */
  const places = new Map<string, { element: HTMLButtonElement; voix: HTMLElement }>();
  /** L'ejecte deja pose dans l'egout. */
  let ejectePose: string | undefined;
  /** Ce qui est affiche, pour ne refaire la rangee qu'a son changement. */
  let rangeeAffichee = '';
  /** Les traits dessines et la taille de la table, pour ne les refaire qu'a leur changement. */
  let traitsDessines = '';

  const afficherLaRangee = (ecran: Extract<EcranAmong, { ecran: 'revelation' }>): void => {
    ecrireTexte(titreRevelation, ecran.titre);
    ecrireTexte(consigne, ecran.consigne);
    revelation.classList.toggle('assassin', ecran.assassin);
    const cle = ecran.joueurs
      .map((joueur) => `${joueur.id}:${joueur.couleur}:${String(joueur.complice)}`)
      .join('|');

    if (cle === rangeeAffichee) {
      return;
    }

    rangeeAffichee = cle;
    rangee.replaceChildren(
      ...ecran.joueurs.map((joueur) =>
        creer(
          doc,
          'li',
          { classe: joueur.complice ? 'among-joueur complice' : 'among-joueur' },
          avatarDeNinja(doc, joueur.couleur),
          creer(doc, 'span', { classe: 'among-joueur-pseudo', texte: joueur.pseudo }),
          couleurNommee(doc, joueur),
        ),
      ),
    );
  };

  const afficherLaTable = (
    joueurs: readonly JoueurAmongVu[],
    peutVoter: boolean,
    monVote: string | null | undefined,
    voixPourPasser: number,
  ): void => {
    const presents = new Set<string>();

    joueurs.forEach((joueur, rang) => {
      presents.add(joueur.id);
      let place = places.get(joueur.id);

      if (place === undefined) {
        const element = bouton(
          doc,
          { classe: 'among-place', etiquette: joueur.pseudo, texte: '' },
          () => {
            client.voter(joueur.id);
          },
        );
        const voix = creer(doc, 'span', { classe: 'among-place-voix' });
        element.append(
          avatarDeNinja(doc, joueur.couleur),
          creer(doc, 'span', { classe: 'among-place-pseudo', texte: joueur.pseudo }),
          creer(doc, 'span', { classe: 'among-place-vote', texte: 'a voté' }),
          voix,
        );
        table.append(element);
        place = { element, voix };
        places.set(joueur.id, place);
      }

      const { x, y } = placeAutourDeLaTable(rang, joueurs.length);
      place.element.style.left = `${String(x)}%`;
      place.element.style.top = `${String(y)}%`;
      place.element.style.setProperty('--couleur-joueur', joueur.couleur);
      place.element.classList.toggle('mort', joueur.mort);
      place.element.classList.toggle('moi', joueur.moi);
      place.element.classList.toggle('a-vote', joueur.aVote);
      place.element.classList.toggle('choisi', monVote === joueur.id);
      place.element.disabled = !peutVoter || joueur.mort;
      ecrireTexte(place.voix, joueur.voix > 0 ? String(joueur.voix) : '');
      montrer(place.voix, joueur.voix > 0);
    });

    for (const [id, place] of places) {
      if (!presents.has(id)) {
        place.element.remove();
        places.delete(id);
      }
    }

    // A l'ejection, « Passer » reste en place s'il a recu des voix: les traits y arrivent.
    montrer(passer, peutVoter || monVote === null || voixPourPasser > 0);
    passer.disabled = !peutVoter;
    passer.classList.toggle('choisi', monVote === null);
    ecrireTexte(voixPasser, voixPourPasser > 0 ? String(voixPourPasser) : '');
    montrer(voixPasser, voixPourPasser > 0);
  };

  const dessinerLesTraits = (
    joueurs: readonly JoueurAmongVu[],
    liste: readonly TraitDeVote[],
  ): void => {
    const origine = table.getBoundingClientRect();
    const cle = [
      `${px(origine.width)}x${px(origine.height)}`,
      ...joueurs.map((joueur) => joueur.id),
      ...liste.map((trait) => `${trait.de}>${trait.vers ?? ''}`),
    ].join('|');

    // Redessiner a chaque image relancerait l'animation des traits sans fin.
    if (cle === traitsDessines) {
      return;
    }

    traitsDessines = cle;
    traits.replaceChildren();
    traits.setAttribute('viewBox', `0 0 ${px(origine.width)} ${px(origine.height)}`);
    const centre = { x: origine.width / 2, y: origine.height / 2 };

    liste.forEach((trait, rang) => {
      const votant = joueurs.find((joueur) => joueur.id === trait.de);
      const depart = places.get(trait.de)?.element;
      const arrivee = trait.vers === null ? passer : places.get(trait.vers)?.element;

      if (votant === undefined || depart === undefined || arrivee?.hidden !== false) {
        return;
      }

      const dessin = dessinDeVote(boiteDans(depart, origine), boiteDans(arrivee, origine), centre);
      // Les traits partent l'un apres l'autre, pour qu'on les suive des yeux; la fleche se
      // montre quand son trait l'atteint (0,6 s apres son depart, comme le dit jeu.css).
      const retard = rang * 0.12;
      const chemin = doc.createElementNS(SVG, 'path');
      chemin.setAttribute('d', dessin.chemin);
      chemin.setAttribute('pathLength', '1');
      chemin.setAttribute('class', 'among-trait');
      chemin.setAttribute('stroke', votant.couleur);
      chemin.style.animationDelay = `${String(retard)}s`;
      const fleche = doc.createElementNS(SVG, 'polygon');
      fleche.setAttribute('points', dessin.fleche);
      fleche.setAttribute('class', 'among-trait-fleche');
      fleche.setAttribute('fill', votant.couleur);
      fleche.style.animationDelay = `${String(retard + 0.6)}s`;
      traits.append(chemin, fleche);
    });
  };

  const afficherLEgout = (ecran: Extract<EcranAmong, { ecran: 'ejection' }>): void => {
    ecrireTexte(texteEjection, ecran.texte);
    ecrireTexte(detailEjection, ecran.detail);
    const id = ecran.ejecte?.id;

    if (id !== ejectePose) {
      ejectePose = id;
      chute.replaceChildren(
        ...(ecran.ejecte === undefined ? [] : [avatarDeNinja(doc, ecran.ejecte.couleur)]),
      );
      // Relance l'animation de la chute.
      chute.classList.remove('tombe');
      void chute.offsetWidth;
      chute.classList.toggle('tombe', ecran.ejecte !== undefined);
    }
  };

  return {
    racine,

    afficher(etat) {
      const ecran = ecranAmong(etat);

      montrer(revelation, ecran.ecran === 'revelation');
      montrer(reunion, ecran.ecran === 'reunion' || ecran.ecran === 'ejection');
      montrer(chatFantomes.racine, chatDesFantomes(etat));

      if (ecran.ecran === 'revelation') {
        afficherLaRangee(ecran);
      }

      if (ecran.ecran === 'reunion') {
        ecrireTexte(titreReunion, ecran.titre);
        ecrireTexte(phase, `${ecran.phase === 'vote' ? 'Vote' : 'Discussion'} · ${ecran.temps}`);
        reunion.dataset['phase'] = ecran.phase;
        afficherLaTable(ecran.joueurs, ecran.peutVoter, ecran.monVote, 0);
        dessinerLesTraits(ecran.joueurs, []);
        montrer(egout, false);
        montrer(chat.racine, true);
      }

      if (ecran.ecran === 'ejection') {
        ecrireTexte(titreReunion, 'Résultat du vote');
        ecrireTexte(phase, '');
        reunion.dataset['phase'] = 'ejection';
        afficherLaTable(ecran.joueurs, false, undefined, ecran.voixPourPasser);
        dessinerLesTraits(ecran.joueurs, ecran.traits);
        montrer(egout, true);
        montrer(chat.racine, false);
        afficherLEgout(ecran);
      } else {
        ejectePose = undefined;
      }

      const messages = messagesDuChat(etat);
      const refus = etat.refus?.action === 'chat' ? etat.refus : undefined;
      chat.afficher(messages, refus);
      chatFantomes.afficher(messages, refus);
    },

    demonter() {
      chat.demonter();
      chatFantomes.demonter();
      places.clear();
      racine.remove();
    },
  };
}

/**
 * Le nom de la couleur d'un joueur, ecrit a sa couleur. Par le style de l'element, pas par un
 * attribut style: la politique de contenu de la page refuse les styles en ligne.
 */
function couleurNommee(doc: Document, joueur: JoueurAmongVu): HTMLElement {
  const nom = creer(doc, 'span', { classe: 'among-joueur-couleur', texte: joueur.nomCouleur });
  nom.style.color = joueur.couleur;

  return nom;
}
