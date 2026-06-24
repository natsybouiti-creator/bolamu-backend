-- FIX 1: qr_token trop petite dans event_registrations
-- JWT tokens peuvent dépasser 255 caractères
ALTER TABLE event_registrations 
ALTER COLUMN qr_token TYPE TEXT;
