-- Phase 7A — National voter-roll territorial interlock.
-- Central DB enforcement prevents legacy/new application code from accidentally
-- freezing a city/regional electorate from every citizen in Colombia.

CREATE OR REPLACE FUNCTION enforce_voter_roll_territory() RETURNS TRIGGER AS $$
DECLARE
  p_scope TEXT;
  p_territory VARCHAR(32);
  p_locality INTEGER;
  p_neighborhood TEXT;
  c_territory VARCHAR(32);
  c_assurance SMALLINT;
  c_locality INTEGER;
  c_neighborhood TEXT;
  proposal_department VARCHAR(32);
  citizen_department VARCHAR(32);
BEGIN
  SELECT scope, territory_code, locality_id, neighborhood
    INTO p_scope, p_territory, p_locality, p_neighborhood
  FROM proposals WHERE id = NEW.proposal_id;

  SELECT territory_code, territory_assurance_level, locality_id, neighborhood
    INTO c_territory, c_assurance, c_locality, c_neighborhood
  FROM citizens WHERE id = NEW.citizen_id;

  -- National participation remains identity-assurance based; municipality
  -- selection is not required to participate in a national proposal.
  IF p_scope = 'national' THEN
    NEW.territory_code := c_territory;
    NEW.territory_assurance_level := c_assurance;
    RETURN NEW;
  END IF;

  -- Every subnational electorate requires an assured territorial binding.
  IF p_territory IS NULL OR c_territory IS NULL OR c_assurance < 1 THEN
    RETURN NULL;
  END IF;

  IF p_scope = 'city' THEN
    IF c_territory <> p_territory THEN RETURN NULL; END IF;

  ELSIF p_scope = 'regional' THEN
    SELECT parent_code INTO proposal_department FROM territories WHERE code = p_territory;
    SELECT parent_code INTO citizen_department FROM territories WHERE code = c_territory;
    IF proposal_department IS NULL OR citizen_department IS NULL OR proposal_department <> citizen_department THEN
      RETURN NULL;
    END IF;

  ELSIF p_scope = 'locality' THEN
    IF c_territory <> p_territory OR p_locality IS NULL OR c_locality IS DISTINCT FROM p_locality THEN
      RETURN NULL;
    END IF;

  ELSIF p_scope = 'neighborhood' THEN
    IF c_territory <> p_territory OR p_neighborhood IS NULL OR c_neighborhood IS DISTINCT FROM p_neighborhood THEN
      RETURN NULL;
    END IF;

  ELSE
    RETURN NULL;
  END IF;

  NEW.territory_code := c_territory;
  NEW.territory_assurance_level := c_assurance;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS proposal_voter_roll_territory_interlock ON proposal_voter_roll;
CREATE TRIGGER proposal_voter_roll_territory_interlock
BEFORE INSERT ON proposal_voter_roll
FOR EACH ROW EXECUTE FUNCTION enforce_voter_roll_territory();
