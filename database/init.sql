-- 1. Création du type d'utilisateur (Le menu déroulant des rôles)
CREATE TYPE user_type_enum AS ENUM ('patient', 'medecin', 'pharmacie', 'laboratoire', 'entreprise', 'admin');

-- 2. Table des UTILISATEURS (Le cœur de Bolamu)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) UNIQUE NOT NULL,
    user_type user_type_enum NOT NULL DEFAULT 'patient',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    statut_abonnement VARCHAR(20) DEFAULT 'expire', -- actif, expire, suspendu
    date_fin_abonnement TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Table des CODES OTP (La sécurité de connexion)
CREATE TABLE otp_codes (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) UNIQUE NOT NULL,
    hashed_otp VARCHAR(64) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0
);

-- 4. Table des MÉDECINS (Pour vérifier le statut 'actif' des pros)
CREATE TABLE doctors (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    full_name VARCHAR(100),
    speciality VARCHAR(100),
    status VARCHAR(20) DEFAULT 'en_attente' -- en_attente, active, suspendu
);

-- CRÉATION DE L'ADMIN PAR DÉFAUT (Pour tes tests)
INSERT INTO users (phone, user_type, statut_abonnement) 
VALUES ('+242000000000', 'admin', 'actif');

-- INDEX pour que la recherche par téléphone soit ultra-rapide
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_otp_phone ON otp_codes(phone);
