\set ON_ERROR_STOP on

DO $$
DECLARE
  department_count integer;
  cartagena_status text;
  mapping_count integer;
BEGIN
  SELECT COUNT(*) INTO department_count FROM territories WHERE level = 'department' AND parent_code = 'CO';
  IF department_count <> 33 THEN
    RAISE EXCEPTION 'NP-01 expected 33 department nodes, got %', department_count;
  END IF;

  SELECT activation_status INTO cartagena_status FROM territories WHERE code = 'CO-MP-13001';
  IF cartagena_status <> 'pilot_ready' THEN
    RAISE EXCEPTION 'NP-01 Cartagena must bootstrap as pilot_ready, got %', cartagena_status;
  END IF;

  SELECT COUNT(*) INTO mapping_count FROM legacy_locality_territories;
  IF mapping_count < 4 THEN
    RAISE EXCEPTION 'NP-01 expected four Cartagena legacy locality mappings, got %', mapping_count;
  END IF;
END $$;

-- Two identity-assured citizens with separately assured municipal residence.
INSERT INTO citizens (
  id, did, cedula_hash, email, verification_level, territory_code,
  territory_assurance_level, territory_assurance_source, territory_verified_at,
  is_active, last_active_at
) VALUES
  ('70000000-0000-4000-8000-000000000001', 'did:vertice:phase7a-medellin', 'phase7a-medellin-hash', 'phase7a-medellin@example.com', 2,
   'CO-MP-05001', 1, 'phase7a_test_assured', NOW(), TRUE, NOW()),
  ('70000000-0000-4000-8000-000000000002', 'did:vertice:phase7a-bogota', 'phase7a-bogota-hash', 'phase7a-bogota@example.com', 2,
   'CO-MP-11001', 1, 'phase7a_test_assured', NOW(), TRUE, NOW())
ON CONFLICT (id) DO NOTHING;

-- Proposal trigger must snapshot the author's municipality even when the
-- application insert does not explicitly pass territory_code.
INSERT INTO proposals (
  id, author_id, title, description, category, scope, status
) VALUES (
  '71000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000001',
  'Phase 7A Medellín city proposal',
  'Golden national territory isolation proposal.',
  'gobernanza', 'city', 'voting'
) ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE proposal_territory text;
BEGIN
  SELECT territory_code INTO proposal_territory FROM proposals WHERE id = '71000000-0000-4000-8000-000000000001';
  IF proposal_territory <> 'CO-MP-05001' THEN
    RAISE EXCEPTION 'NP-02 proposal territory snapshot failed: %', proposal_territory;
  END IF;
END $$;

-- Same-city assured resident enters the frozen roll.
INSERT INTO proposal_voter_roll (
  proposal_id, citizen_id, verification_level, eligibility_reason
) VALUES (
  '71000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000001',
  2, 'phase7a_same_city'
) ON CONFLICT DO NOTHING;

-- Cross-city assured resident is silently filtered by the DB interlock. This
-- protects both legacy and future application paths.
INSERT INTO proposal_voter_roll (
  proposal_id, citizen_id, verification_level, eligibility_reason
) VALUES (
  '71000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000002',
  2, 'phase7a_cross_city_should_not_enter'
) ON CONFLICT DO NOTHING;

DO $$
DECLARE
  voter_count integer;
  voter_territory text;
  voter_assurance integer;
BEGIN
  SELECT COUNT(*) INTO voter_count
  FROM proposal_voter_roll WHERE proposal_id = '71000000-0000-4000-8000-000000000001';
  IF voter_count <> 1 THEN
    RAISE EXCEPTION 'NP-03 city voter roll isolation failed; expected 1, got %', voter_count;
  END IF;

  SELECT territory_code, territory_assurance_level
    INTO voter_territory, voter_assurance
  FROM proposal_voter_roll
  WHERE proposal_id = '71000000-0000-4000-8000-000000000001'
    AND citizen_id = '70000000-0000-4000-8000-000000000001';
  IF voter_territory <> 'CO-MP-05001' OR voter_assurance <> 1 THEN
    RAISE EXCEPTION 'NP-03 frozen territorial assurance snapshot invalid: %, %', voter_territory, voter_assurance;
  END IF;
END $$;

-- Changing primary municipality through the generic profile path must drop
-- territorial assurance to self_asserted/0.
UPDATE citizens
SET territory_code = 'CO-MP-11001'
WHERE id = '70000000-0000-4000-8000-000000000001';

DO $$
DECLARE assurance integer; source text;
BEGIN
  SELECT territory_assurance_level, territory_assurance_source
    INTO assurance, source
  FROM citizens WHERE id = '70000000-0000-4000-8000-000000000001';
  IF assurance <> 0 OR source <> 'self_asserted' THEN
    RAISE EXCEPTION 'NP-04 city change did not fail closed; assurance %, source %', assurance, source;
  END IF;
END $$;

-- Civic objects snapshot the actor/citizen territory and therefore remain
-- attached to the city where they were created even if the profile changes later.
INSERT INTO civic_actions (
  id, actor_id, title, problem, objective, category, status
) VALUES (
  '72000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000002',
  'Phase 7A Bogotá civic action',
  'Necesidad comunitaria usada únicamente para el contrato de integración.',
  'Validar el snapshot territorial nacional.',
  'gobernanza', 'in_progress'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO territorial_reports (
  id, citizen_id, category, title, description, location, status
) VALUES (
  '73000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000002',
  'infraestructura',
  'Phase 7A Bogotá territorial report',
  'Reporte no destructivo para verificar snapshot territorial.',
  ST_SetSRID(ST_MakePoint(-74.0721, 4.7110), 4326)::geography,
  'open'
) ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE action_territory text; report_territory text;
BEGIN
  SELECT territory_code INTO action_territory FROM civic_actions WHERE id = '72000000-0000-4000-8000-000000000001';
  SELECT territory_code INTO report_territory FROM territorial_reports WHERE id = '73000000-0000-4000-8000-000000000001';
  IF action_territory <> 'CO-MP-11001' OR report_territory <> 'CO-MP-11001' THEN
    RAISE EXCEPTION 'NP-05 civic snapshots failed: action %, report %', action_territory, report_territory;
  END IF;
END $$;

-- National scope deliberately does not require a municipality: geographic
-- selection must never become a prerequisite for national civic participation.
INSERT INTO proposals (
  id, author_id, title, description, category, scope, status
) VALUES (
  '71000000-0000-4000-8000-000000000002',
  '70000000-0000-4000-8000-000000000002',
  'Phase 7A national proposal',
  'National voter-roll territory boundary contract.',
  'gobernanza', 'national', 'voting'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO proposal_voter_roll (
  proposal_id, citizen_id, verification_level, eligibility_reason
) VALUES (
  '71000000-0000-4000-8000-000000000002',
  '70000000-0000-4000-8000-000000000001',
  2, 'phase7a_national_not_geofenced'
) ON CONFLICT DO NOTHING;

DO $$
DECLARE national_count integer;
BEGIN
  SELECT COUNT(*) INTO national_count
  FROM proposal_voter_roll WHERE proposal_id = '71000000-0000-4000-8000-000000000002';
  IF national_count <> 1 THEN
    RAISE EXCEPTION 'NP-06 national scope was incorrectly blocked by municipality assurance';
  END IF;
END $$;

SELECT 'NATIONAL_PLATFORM_INTEGRATION=PASS' AS result;
