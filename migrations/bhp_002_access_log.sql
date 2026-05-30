CREATE TABLE IF NOT EXISTS health_record_access_log (
  id              SERIAL PRIMARY KEY,
  record_id       INTEGER NOT NULL REFERENCES health_records(id),
  accessed_by     INTEGER NOT NULL REFERENCES users(id),
  role_at_access  VARCHAR(50) NOT NULL,
  access_reason   VARCHAR(255),
  ip_address      INET NOT NULL,
  accessed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table immuable : personne ne peut modifier ni supprimer
REVOKE UPDATE ON health_record_access_log FROM bolamu_app;
REVOKE DELETE ON health_record_access_log FROM bolamu_app;
REVOKE TRUNCATE ON health_record_access_log FROM bolamu_app;
