-- Any change of primary municipality through the generic citizen record is
-- self-asserted by default. A future residence-assurance flow must verify the
-- already-selected territory in a separate, auditable operation.
CREATE OR REPLACE FUNCTION reset_territory_assurance_on_selection() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.territory_code IS DISTINCT FROM NEW.territory_code THEN
    NEW.territory_assurance_level := 0;
    NEW.territory_assurance_source := 'self_asserted';
    NEW.territory_verified_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS citizens_reset_territory_assurance ON citizens;
CREATE TRIGGER citizens_reset_territory_assurance
BEFORE UPDATE OF territory_code ON citizens
FOR EACH ROW EXECUTE FUNCTION reset_territory_assurance_on_selection();
