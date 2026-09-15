CREATE TABLE "codes_de_secours" (
	"compte_id" uuid PRIMARY KEY NOT NULL,
	"empreinte" text NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "codes_de_secours" ADD CONSTRAINT "codes_de_secours_compte_id_comptes_id_fk" FOREIGN KEY ("compte_id") REFERENCES "public"."comptes"("id") ON DELETE cascade ON UPDATE no action;