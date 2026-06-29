-- AUDIT COMMUNAUTÉ - VÉRIFICATION SCHÉMA BASE DE DONNÉES
-- Exécuter sur Neon pour vérifier l'état réel

-- 1. Vérifier elonga_events
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'elonga_events'
ORDER BY ordinal_position;

-- 2. Vérifier clubs
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'clubs'
ORDER BY ordinal_position;

-- 3. Vérifier conversations
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'conversations'
ORDER BY ordinal_position;

-- 4. Vérifier conversation_participants
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'conversation_participants'
ORDER BY ordinal_position;

-- 5. Vérifier si la table messages existe
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'messages'
);

-- 6. Vérifier si la table club_activities existe
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'club_activities'
);

-- 7. Vérifier les contraintes CHECK sur elonga_events.status
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint 
WHERE conrelid = 'elonga_events'::regclass 
AND conname LIKE '%status%';

-- 8. Vérifier les contraintes CHECK sur clubs.status
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint 
WHERE conrelid = 'clubs'::regclass 
AND conname LIKE '%status%';

-- 9. Vérifier les contraintes CHECK sur conversations.type
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint 
WHERE conrelid = 'conversations'::regclass 
AND conname LIKE '%type%';
