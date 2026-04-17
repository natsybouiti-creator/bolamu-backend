-- ============================================================
-- BOLAMU — Migration 002 : Table Commandes
-- ============================================================

-- Création de la table commands pour gérer les commandes clients
CREATE TABLE IF NOT EXISTS commands (
    id SERIAL PRIMARY KEY,
    customer_phone VARCHAR(20) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT,
    tracking_number VARCHAR(100),
    shipping_address TEXT,
    payment_method VARCHAR(50),
    payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded'))
);

-- Index pour optimiser les recherches
CREATE INDEX IF NOT EXISTS idx_commands_customer_phone ON commands(customer_phone);
CREATE INDEX IF NOT EXISTS idx_commands_status ON commands(status);
CREATE INDEX IF NOT EXISTS idx_commands_created_at ON commands(created_at);

-- Insertion de données de test (optionnel)
INSERT INTO commands (customer_phone, product_name, amount, status, notes) VALUES
('+242060000001', 'Test Produit 1', 5000.00, 'pending', 'Commande de test pour vérification'),
('+242060000002', 'Test Produit 2', 7500.00, 'confirmed', 'Commande confirmée de test'),
('+242060000003', 'Test Produit 3', 12000.00, 'shipped', 'Commande expédiée de test');
