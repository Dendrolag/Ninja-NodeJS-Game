CREATE TYPE "public"."carte" AS ENUM('map1', 'map2', 'map3');--> statement-breakpoint
CREATE TYPE "public"."mode_de_jeu" AS ENUM('classique');--> statement-breakpoint
CREATE TABLE "comptes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pseudo" text NOT NULL,
	"repere_pseudo" text NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comptes_repere_pseudo_unique" UNIQUE("repere_pseudo")
);
--> statement-breakpoint
CREATE TABLE "parties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mode" "mode_de_jeu" NOT NULL,
	"carte" "carte" NOT NULL,
	"mode_miroir" boolean NOT NULL,
	"duree_s" integer NOT NULL,
	"nombre_joueurs" integer NOT NULL,
	"terminee_le" timestamp with time zone NOT NULL,
	CONSTRAINT "parties_duree_positive" CHECK ("parties"."duree_s" > 0),
	CONSTRAINT "parties_au_moins_un_joueur" CHECK ("parties"."nombre_joueurs" >= 1)
);
--> statement-breakpoint
CREATE TABLE "progressions" (
	"compte_id" uuid PRIMARY KEY NOT NULL,
	"xp_totale" integer DEFAULT 0 NOT NULL,
	"pieces" integer DEFAULT 0 NOT NULL,
	"points_ligue" integer DEFAULT 0 NOT NULL,
	"mis_a_jour_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "progressions_xp_positive" CHECK ("progressions"."xp_totale" >= 0),
	CONSTRAINT "progressions_pieces_positives" CHECK ("progressions"."pieces" >= 0),
	CONSTRAINT "progressions_points_ligue_positifs" CHECK ("progressions"."points_ligue" >= 0)
);
--> statement-breakpoint
CREATE TABLE "resultats" (
	"partie_id" uuid NOT NULL,
	"compte_id" uuid NOT NULL,
	"placement" integer NOT NULL,
	"points" integer NOT NULL,
	"captures" integer NOT NULL,
	"bots_noirs_detruits" integer NOT NULL,
	"xp_gagnee" integer NOT NULL,
	"pieces_gagnees" integer NOT NULL,
	"variation_points_ligue" integer NOT NULL,
	CONSTRAINT "resultats_partie_compte" PRIMARY KEY("partie_id","compte_id"),
	CONSTRAINT "resultats_placement_positif" CHECK ("resultats"."placement" >= 1),
	CONSTRAINT "resultats_points_positifs" CHECK ("resultats"."points" >= 0),
	CONSTRAINT "resultats_captures_positives" CHECK ("resultats"."captures" >= 0),
	CONSTRAINT "resultats_bots_noirs_positifs" CHECK ("resultats"."bots_noirs_detruits" >= 0),
	CONSTRAINT "resultats_xp_positive" CHECK ("resultats"."xp_gagnee" >= 0),
	CONSTRAINT "resultats_pieces_positives" CHECK ("resultats"."pieces_gagnees" >= 0)
);
--> statement-breakpoint
ALTER TABLE "progressions" ADD CONSTRAINT "progressions_compte_id_comptes_id_fk" FOREIGN KEY ("compte_id") REFERENCES "public"."comptes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resultats" ADD CONSTRAINT "resultats_partie_id_parties_id_fk" FOREIGN KEY ("partie_id") REFERENCES "public"."parties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resultats" ADD CONSTRAINT "resultats_compte_id_comptes_id_fk" FOREIGN KEY ("compte_id") REFERENCES "public"."comptes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "resultats_par_compte" ON "resultats" USING btree ("compte_id");