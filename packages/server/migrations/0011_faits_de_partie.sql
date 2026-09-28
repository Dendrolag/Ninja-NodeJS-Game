CREATE TABLE "faits_de_partie" (
	"partie_id" uuid NOT NULL,
	"compte_id" uuid NOT NULL,
	"fait" text NOT NULL,
	"valeur" integer NOT NULL,
	CONSTRAINT "faits_de_partie_partie_compte_fait" PRIMARY KEY("partie_id","compte_id","fait"),
	CONSTRAINT "faits_de_partie_identifiant" CHECK ("faits_de_partie"."fait" ~ '^[a-z][a-zA-Z0-9]*$'),
	CONSTRAINT "faits_de_partie_longueur" CHECK (char_length("faits_de_partie"."fait") <= 40),
	CONSTRAINT "faits_de_partie_valeur_positive" CHECK ("faits_de_partie"."valeur" > 0)
);
--> statement-breakpoint
ALTER TABLE "faits_de_partie" ADD CONSTRAINT "faits_de_partie_resultat" FOREIGN KEY ("partie_id","compte_id") REFERENCES "public"."resultats"("partie_id","compte_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "faits_de_partie_par_compte" ON "faits_de_partie" USING btree ("compte_id");