/**
 * Les ecrans d'Among Ninjas, poses par-dessus la carte (etape 7.20): la revelation, la reunion
 * et son vote, l'ejection, et le chat des fantomes. Ce composant pose ce que le modele
 * (modeles/among.ts) decide, et rien d'autre.
 *
 * LA TABLE RONDE (rendu B de la planche, a ameliorer): les joueurs en cercle autour du gong.
 * Pendant le vote, un vivant touche un joueur vivant pour voter contre lui, ou « Passer ». A
 * l'ejection, chaque vote devient un trait courbe de la couleur du votant, qui finit par une
 * pointe sur le joueur vise; plusieurs traits vers le meme joueur s'y empilent. Sans votes
 * nommes (votes anonymes), seul le nombre de voix s'affiche.
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

/** La place de « Passer », sous la table. */
const PLACE_DE_PASSER = { x: 50, y: 97 };

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
  traits.setAttribute('viewBox', '0 0 100 100');
  traits.setAttribute('preserveAspectRatio', 'none');
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

    montrer(passer, peutVoter || monVote === null);
    passer.disabled = !peutVoter;
    passer.classList.toggle('choisi', monVote === null);
  };

  const dessinerLesTraits = (
    joueurs: readonly JoueurAmongVu[],
    liste: readonly TraitDeVote[],
  ): void => {
    traits.replaceChildren();
    const rangDe = new Map(joueurs.map((joueur, rang) => [joueur.id, rang]));
    const arrivees = new Map<string, number>();

    for (const trait of liste) {
      const depart = rangDe.get(trait.de);
      const votant = joueurs.find((joueur) => joueur.id === trait.de);

      if (depart === undefined || votant === undefined) {
        continue;
      }

      const de = placeAutourDeLaTable(depart, joueurs.length);
      const rangVise = trait.vers === null ? undefined : rangDe.get(trait.vers);
      const vers =
        rangVise === undefined ? PLACE_DE_PASSER : placeAutourDeLaTable(rangVise, joueurs.length);
      // Les traits vers un meme joueur arrivent un peu decales: on les compte.
      const cle = trait.vers ?? 'passer';
      const deja = arrivees.get(cle) ?? 0;
      arrivees.set(cle, deja + 1);
      const decalage = (deja - 1) * 1.6;
      const controle = {
        x: 50 + (de.x + vers.x - 100) * 0.15,
        y: 50 + (de.y + vers.y - 100) * 0.15,
      };
      const chemin = doc.createElementNS(SVG, 'path');
      chemin.setAttribute(
        'd',
        `M ${String(de.x)} ${String(de.y)} Q ${String(controle.x)} ${String(controle.y)} ${String(vers.x + decalage)} ${String(vers.y + decalage)}`,
      );
      chemin.setAttribute('class', 'among-trait');
      chemin.setAttribute('stroke', votant.couleur);
      const pointe = doc.createElementNS(SVG, 'circle');
      pointe.setAttribute('cx', String(vers.x + decalage));
      pointe.setAttribute('cy', String(vers.y + decalage));
      pointe.setAttribute('r', '1.4');
      pointe.setAttribute('fill', votant.couleur);
      pointe.setAttribute('class', 'among-trait-pointe');
      traits.append(chemin, pointe);
    }
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
        afficherLaTable(ecran.joueurs, ecran.peutVoter, ecran.monVote);
        dessinerLesTraits(ecran.joueurs, []);
        montrer(egout, false);
        montrer(chat.racine, true);
      }

      if (ecran.ecran === 'ejection') {
        ecrireTexte(titreReunion, 'Résultat du vote');
        ecrireTexte(phase, '');
        reunion.dataset['phase'] = 'ejection';
        afficherLaTable(ecran.joueurs, false, undefined);
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
