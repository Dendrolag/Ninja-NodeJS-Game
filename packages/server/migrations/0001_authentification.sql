CREATE TABLE "mots_de_passe" (
	"compte_id" uuid PRIMARY KEY NOT NULL,
	"empreinte" text NOT NULL,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"empreinte_jeton" text PRIMARY KEY NOT NULL,
	"compte_id" uuid NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"expire_le" timestamp with time zone NOT NULL,
	CONSTRAINT "sessions_expire_apres_creation" CHECK ("sessions"."expire_le" > "sessions"."cree_le")
);
--> statement-breakpoint
ALTER TABLE "mots_de_passe" ADD CONSTRAINT "mots_de_passe_compte_id_comptes_id_fk" FOREIGN KEY ("compte_id") REFERENCES "public"."comptes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_compte_id_comptes_id_fk" FOREIGN KEY ("compte_id") REFERENCES "public"."comptes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sessions_par_compte" ON "sessions" USING btree ("compte_id");--> statement-breakpoint
CREATE INDEX "sessions_par_expiration" ON "sessions" USING btree ("expire_le");