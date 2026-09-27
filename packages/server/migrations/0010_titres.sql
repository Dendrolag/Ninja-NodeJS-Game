CREATE TABLE "titres" (
	"compte_id" uuid PRIMARY KEY NOT NULL,
	"succes" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "titres" ADD CONSTRAINT "titres_succes_obtenu" FOREIGN KEY ("compte_id","succes") REFERENCES "public"."succes_debloques"("compte_id","succes") ON DELETE cascade ON UPDATE no action;