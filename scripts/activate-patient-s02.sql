-- Activer le compte patient +242069735418
UPDATE users SET is_active = TRUE WHERE phone = '+242069735418';

-- Vérifier le statut après activation
SELECT phone, full_name, role, is_active, banned FROM users WHERE phone = '+242069735418';
