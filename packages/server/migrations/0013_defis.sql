CREATE TABLE "defis_releves" (
	"compte_id" uuid NOT NULL,
	"semaine" date NOT NULL,
	"defi" text NOT NULL,
	"xp" integer NOT NULL,
	"releve_le" timestamp with time zone NOT NULL,
	"partie_id" uuid,
	CONSTRAINT "defis_releves_compte_semaine_defi" PRIMARY KEY("compte_id","semaine","defi"),
	CONSTRAINT "defis_releves_identifiant" CHECK ("defis_releves"."defi" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "defis_releves_longueur" CHECK (char_length("defis_releves"."defi") <= 40),
	CONSTRAINT "defis_releves_xp_positive" CHECK ("defis_releves"."xp" >= 0),
	CONSTRAINT "defis_releves_un_lundi" CHECK (extract(isodow from "defis_releves"."semaine") = 1)
);
--> statement-breakpoint
ALTER TABLE "defis_releves" ADD CONSTRAINT "defis_releves_compte_id_comptes_id_fk" FOREIGN KEY ("compte_id") REFERENCES "public"."comptes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "defis_releves" ADD CONSTRAINT "defis_releves_partie_id_parties_id_fk" FOREIGN KEY ("partie_id") REFERENCES "public"."parties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "defis_releves_par_partie" ON "defis_releves" USING btree ("partie_id");