/**
 * La couche reseau du client, derriere une interface.
 *
 * C'EST L'EXIGENCE DE CONCEPTION DE L'ETAPE 4.1, et la raison d'etre de ce
 * fichier. Le reste du client ne connait que cette interface: il ne sait pas que
 * le transport est Socket.IO, ni que le flux d'etat arrive en JSON. Le jour ou
 * l'etape 2.3 remplacera ce flux par un delta binaire, elle touchera
 * l'implementation et reconstruction.ts, et rien d'autre. Le magasin, les ecrans
 * et le rendu ne s'en apercevront pas.
 *
 * ELLE EST TYPEE PAR LES CONTRATS PARTAGES, dans les deux sens. Emettre un
 * evenement qui n'existe pas, ou lui donner la mauvaise charge utile, ne compile
 * pas. Le client ne peut donc pas se desynchroniser du serveur en silence: la
 * divergence se voit a la compilation, dans les deux paquets a la fois, parce
 * que le contrat est le meme fichier.
 *
 * ELLE NE COMPREND RIEN A CE QU'ELLE TRANSPORTE. Elle ne connait ni partie, ni
 * salon, ni ecran: elle emet, elle recoit, elle previent. Ce que les messages
 * veulent dire est l'affaire du cablage de client.ts.
 *
 * DEUX IMPLEMENTATIONS. Celle de reseauSocketIo.ts, qui parle vraiment au
 * serveur, et le banc d'essai ci-dessous, que les tests pilotent a la main. Le
 * meme couple existe cote serveur pour l'horloge, et pour la meme raison: un
 * composant qui ne peut se tester qu'avec un vrai serveur en face ne se teste pas
 * souvent.
 */

import type { EvenementsClientVersServeur, EvenementsServeurVersClient } from '@neon-ninja/shared';

/** Le nom d'un message que le client peut envoyer. */
export type NomMontant = keyof EvenementsClientVersServeur;

/** Le nom d'un message que le client peut recevoir. */
export type NomDescendant = keyof EvenementsServeurVersClient;

/** Les arguments d'un message montant, tels que le contrat les decrit. */
export type ArgumentsMontants<Nom extends NomMontant> = Parameters<
  EvenementsClientVersServeur[Nom]
>;

/** Les arguments d'un message descendant, tels que le contrat les decrit. */
export type ArgumentsDescendants<Nom extends NomDescendant> = Parameters<
  EvenementsServeurVersClient[Nom]
>;

/** Ce que le client attend de son transport. */
export interface Reseau {
  /**
   * Notre identifiant de session, donne par le serveur a la connexion.
   *
   * C'est aussi l'identifiant de notre joueur dans la partie: le serveur fabrique
   * la session a partir de la connexion (voir SessionJoueur dans
   * @neon-ninja/shared). C'est ce qui permet de se reconnaitre parmi les entites.
   *
   * Absent tant que le lien n'est pas etabli. Il change a chaque nouvelle
   * connexion: retrouver sa place apres une coupure suppose une session qui
   * survive au transport, ce qui appartient a l'etape 3.2.
   */
  readonly identifiant: string | undefined;

  /** Le lien est-il etabli. */
  readonly connecte: boolean;

  /** Envoie un message au serveur. */
  emettre<Nom extends NomMontant>(nom: Nom, ...arguments_: ArgumentsMontants<Nom>): void;

  /** Ecoute un message du serveur. Rend la fonction qui arrete d'ecouter. */
  sur<Nom extends NomDescendant>(
    nom: Nom,
    gestionnaire: EvenementsServeurVersClient[Nom],
  ): () => void;

  /** Previent quand le lien est etabli. Rend la fonction qui arrete d'ecouter. */
  surConnexion(gestionnaire: () => void): () => void;

  /** Previent quand le lien est perdu. Rend la fonction qui arrete d'ecouter. */
  surDeconnexion(gestionnaire: () => void): () => void;

  /** Coupe le lien et oublie tous les abonnements. */
  fermer(): void;
}

/** Un message envoye par le client, tel que le banc d'essai le retient. */
export interface MessageEmis {
  readonly nom: NomMontant;
  readonly arguments_: readonly unknown[];
}

/**
 * Un transport que le test pilote a la main. Pour les tests, et pour eux seuls.
 *
 * Il ne simule pas un serveur: il n'a aucune idee de ce qu'une demande devrait
 * declencher. Il retient ce que le client envoie et delivre ce que le test lui
 * dit de delivrer. C'est ce qui permet de verifier le cablage du client, y
 * compris dans des situations qu'un vrai serveur ne produirait qu'au prix d'une
 * mise en scene compliquee: un instantane perime, une deconnexion en pleine
 * partie, un message qui arrive apres la fin.
 */
export interface ReseauFactice extends Reseau {
  /** Tout ce que le client a envoye, dans l'ordre. */
  readonly emis: readonly MessageEmis[];
  /** Etablit le lien, avec l'identifiant que le serveur aurait donne. */
  simulerConnexion(identifiant?: string): void;
  /** Coupe le lien, comme le ferait une perte de reseau. */
  simulerDeconnexion(): void;
  /** Delivre un message descendant, comme le ferait le serveur. */
  recevoir<Nom extends NomDescendant>(nom: Nom, ...arguments_: ArgumentsDescendants<Nom>): void;
  /** Les arguments du dernier message de ce nom, s'il y en a eu un. */
  dernier<Nom extends NomMontant>(nom: Nom): ArgumentsMontants<Nom> | undefined;
}

/** Cree un transport pilote a la main. */
export function creerReseauFactice(): ReseauFactice {
  let identifiant: string | undefined;
  let connecte = false;

  const emis: MessageEmis[] = [];
  const gestionnaires = new Map<NomDescendant, Set<(...arguments_: never[]) => void>>();
  const surConnexion = new Set<() => void>();
  const surDeconnexion = new Set<() => void>();

  return {
    get identifiant() {
      return identifiant;
    },

    get connecte() {
      return connecte;
    },

    get emis() {
      return emis;
    },

    emettre: (nom, ...arguments_) => {
      emis.push({ nom, arguments_ });
    },

    sur: (nom, gestionnaire) => {
      const pourCeNom = gestionnaires.get(nom) ?? new Set();
      pourCeNom.add(gestionnaire as (...arguments_: never[]) => void);
      gestionnaires.set(nom, pourCeNom);

      return () => {
        pourCeNom.delete(gestionnaire as (...arguments_: never[]) => void);
      };
    },

    surConnexion: (gestionnaire) => {
      surConnexion.add(gestionnaire);

      return () => {
        surConnexion.delete(gestionnaire);
      };
    },

    surDeconnexion: (gestionnaire) => {
      surDeconnexion.add(gestionnaire);

      return () => {
        surDeconnexion.delete(gestionnaire);
      };
    },

    fermer: () => {
      connecte = false;
      identifiant = undefined;
      gestionnaires.clear();
      surConnexion.clear();
      surDeconnexion.clear();
    },

    simulerConnexion: (nouvelIdentifiant = 'session-de-test') => {
      identifiant = nouvelIdentifiant;
      connecte = true;

      for (const gestionnaire of [...surConnexion]) {
        gestionnaire();
      }
    },

    simulerDeconnexion: () => {
      connecte = false;
      identifiant = undefined;

      for (const gestionnaire of [...surDeconnexion]) {
        gestionnaire();
      }
    },

    recevoir: (nom, ...arguments_) => {
      for (const gestionnaire of [...(gestionnaires.get(nom) ?? [])]) {
        (gestionnaire as (...tout: unknown[]) => void)(...arguments_);
      }
    },

    dernier: (nom) => {
      const trouve = [...emis].reverse().find((message) => message.nom === nom);

      return trouve?.arguments_ as ArgumentsMontants<typeof nom> | undefined;
    },
  };
}
