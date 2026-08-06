DROP INDEX IF EXISTS "bestiary_name_reservations_normalized_name_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "bestiary_name_reservations_active_name_unique"
  ON "bestiary_name_reservations" USING btree ("normalized_name")
  WHERE "status" IN (
    'reserved'::"public"."name_reservation_status",
    'approved'::"public"."name_reservation_status"
  );
