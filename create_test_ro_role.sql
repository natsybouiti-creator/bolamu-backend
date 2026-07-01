-- BOLAMU — Rôle Postgres lecture seule dédié au harnais de test
-- À exécuter par Cascade sur la base Neon (Frankfurt), via le rôle admin existant.
-- Objectif : que verify_scenario.js puisse lire la DB sans jamais pouvoir écrire.

-- 1. Créer le rôle avec mot de passe (Cascade génère un mot de passe fort,
--    ne JAMAIS le coller en clair dans le chat ou dans un fichier commité)
CREATE ROLE bolamu_test_ro WITH LOGIN PASSWORD :'test_ro_password' NOSUPERUSER NOCREATEDB NOCREATEROLE;

-- 2. Droits : connexion + lecture seule sur le schéma public
GRANT CONNECT ON DATABASE bolamu TO bolamu_test_ro;
GRANT USAGE ON SCHEMA public TO bolamu_test_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO bolamu_test_ro;

-- 3. S'assurer que les futures tables restent aussi en lecture seule pour ce rôle
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO bolamu_test_ro;

-- 4. Vérification explicite : ce rôle ne doit PAS pouvoir écrire
--    (Cascade doit exécuter ceci et confirmer l'échec attendu)
-- Test à faire séparément avec ce rôle connecté :
--   INSERT INTO subscriptions (id) VALUES (999999);
--   -> doit échouer avec "permission denied for table subscriptions"

-- 5. La connection string résultante (postgres://bolamu_test_ro:***@...neon.tech/bolamu)
--    doit être stockée dans une variable d'environnement locale, jamais commitée :
--    BOLAMU_TEST_RO_DATABASE_URL=postgres://bolamu_test_ro:<password>@<host>/bolamu?sslmode=require
