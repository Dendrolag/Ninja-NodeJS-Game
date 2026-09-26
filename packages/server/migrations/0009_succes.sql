CREATE TABLE "succes_debloques" (
	"compte_id" uuid NOT NULL,
	"succes" text NOT NULL,
	"debloque_le" timestamp with time zone NOT NULL,
	"partie_id" uuid,
	CONSTRAINT "succes_debloques_compte_succes" PRIMARY KEY("compte_id","succes"),
	CONSTRAINT "succes_debloques_identifiant" CHECK ("succes_debloques"."succes" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "succes_debloques_longueur" CHECK (char_length("succes_debloques"."succes") <= 40)
);
--> statement-breakpoint
ALTER TABLE "succes_debloques" ADD CONSTRAINT "succes_debloques_compte_id_comptes_id_fk" FOREIGN KEY ("compte_id") REFERENCES "public"."comptes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "succes_debloques" ADD CONSTRAINT "succes_debloques_partie_id_parties_id_fk" FOREIGN KEY ("partie_id") REFERENCES "public"."parties"("id") ON DELETE set null ON UPDATE no action;