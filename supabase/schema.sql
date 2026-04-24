-- BVDW Foundation Models Atlas — Schema
-- Supabase Projekt: "Query" (oidtbnhyyydvpkuqzgbs)
-- Idempotent: kann beliebig oft ausgeführt werden.

-- Haupttabelle: ein Zeile pro Modell, alle Daten in data JSONB
CREATE TABLE IF NOT EXISTS models (
  atlas TEXT NOT NULL CHECK (atlas IN ('conversational', 'specialized')),
  id TEXT NOT NULL,
  data JSONB NOT NULL,
  current_version INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  PRIMARY KEY (atlas, id)
);

-- Versionshistorie: bei jedem Edit wird ein Snapshot abgelegt
CREATE TABLE IF NOT EXISTS model_versions (
  id BIGSERIAL PRIMARY KEY,
  atlas TEXT NOT NULL,
  model_id TEXT NOT NULL,
  version INT NOT NULL,
  data JSONB NOT NULL,
  edited_by TEXT,
  edit_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_versions_model ON model_versions (atlas, model_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_versions_time ON model_versions (created_at DESC);

-- Lizenzen (pro atlas getrennt, weil Überschneidungen minimal)
CREATE TABLE IF NOT EXISTS licenses (
  atlas TEXT NOT NULL,
  id TEXT NOT NULL,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (atlas, id)
);

-- Atlas-Metadaten (Title, Version, Methodik, Filter-Definitionen)
CREATE TABLE IF NOT EXISTS atlas_meta (
  atlas TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row Level Security aktivieren
ALTER TABLE models ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE atlas_meta ENABLE ROW LEVEL SECURITY;

-- Lese-Policies für anon + authenticated
-- (Frontend spricht mit /api/*, aber wir erlauben SELECT auch direkt für ggf. spätere Supabase-JS-Direktzugriffe)
DROP POLICY IF EXISTS models_read ON models;
DROP POLICY IF EXISTS versions_read ON model_versions;
DROP POLICY IF EXISTS licenses_read ON licenses;
DROP POLICY IF EXISTS meta_read ON atlas_meta;

CREATE POLICY models_read   ON models          FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY versions_read ON model_versions  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY licenses_read ON licenses        FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY meta_read     ON atlas_meta      FOR SELECT TO anon, authenticated USING (true);

-- Schreibrechte: NUR über Service-Role-Key (umgeht RLS by default).
-- Damit können Writes ausschließlich über /api/edit und /api/revert passieren,
-- die serverseitig das EDIT_PASSWORD prüfen.

-- Hilfreiche View: aktuelle Modelle mit Version-Count (optional, für History-Flyout)
CREATE OR REPLACE VIEW v_model_summary AS
SELECT
  m.atlas,
  m.id,
  m.data->>'name' AS name,
  m.data->>'vendor' AS vendor,
  m.current_version,
  m.updated_at,
  m.updated_by,
  (SELECT COUNT(*) FROM model_versions v WHERE v.atlas = m.atlas AND v.model_id = m.id) AS version_count
FROM models m;

-- ─── Vendors-Tabelle ────────────────────────────────────────────────────────
-- Zentraler Ort für Hersteller-Infos: ein Logo pro Vendor, nicht pro Modell.
CREATE TABLE IF NOT EXISTS vendors (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT,
  website TEXT,
  logo_url TEXT,                -- endgültige URL (entweder extern oder Supabase Storage)
  logo_source TEXT,             -- wo das Logo herkommt: 'lobe'|'simpleicons'|'clearbit'|'upload'|...
  brand_color TEXT,             -- hex, extrahiert oder manuell gesetzt
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vendors_read ON vendors;
CREATE POLICY vendors_read ON vendors FOR SELECT TO anon, authenticated USING (true);
