CREATE TABLE "amities" (
	"compte_a" uuid NOT NULL,
	"compte_b" uuid NOT NULL,
	"creee_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "amities_paire" PRIMARY KEY("compte_a","compte_b"),
	CONSTRAINT "amities_dans_l_ordre" CHECK ("amities"."compte_a" < "amities"."compte_b")
);
--> statement-breakpoint
CREATE TABLE "blocages" (
	"bloqueur" uuid NOT NULL,
	"bloque" uuid NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blocages_paire" PRIMARY KEY("bloqueur","bloque"),
	CONSTRAINT "blocages_pas_de_soi" CHECK ("blocages"."bloqueur" <> "blocages"."bloque")
);
--> statement-breakpoint
CREATE TABLE "demandes_d_ami" (
	"de" uuid NOT NULL,
	"pour" uuid NOT NULL,
	"creee_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "demandes_d_ami_paire" PRIMARY KEY("de","pour"),
	CONSTRAINT "demandes_d_ami_pas_a_soi" CHECK ("demandes_d_ami"."de" <> "demandes_d_ami"."pour")
);
--> statement-breakpoint
ALTER TABLE "amities" ADD CONSTRAINT "amities_compte_a_comptes_id_fk" FOREIGN KEY ("compte_a") REFERENCES "public"."comptes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amities" ADD CONSTRAINT "amities_compte_b_comptes_id_fk" FOREIGN KEY ("compte_b") REFERENCES "public"."comptes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocages" ADD CONSTRAINT "blocages_bloqueur_comptes_id_fk" FOREIGN KEY ("bloqueur") REFERENCES "public"."comptes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocages" ADD CONSTRAINT "blocages_bloque_comptes_id_fk" FOREIGN KEY ("bloque") REFERENCES "public"."comptes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demandes_d_ami" ADD CONSTRAINT "demandes_d_ami_de_comptes_id_fk" FOREIGN KEY ("de") REFERENCES "public"."comptes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demandes_d_ami" ADD CONSTRAINT "demandes_d_ami_pour_comptes_id_fk" FOREIGN KEY ("pour") REFERENCES "public"."comptes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "amities_par_compte_b" ON "amities" USING btree ("compte_b");--> statement-breakpoint
CREATE INDEX "demandes_d_ami_par_destinataire" ON "demandes_d_ami" USING btree ("pour");