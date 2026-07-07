-- Resynchronisation séquence partner_bons_zora après insertion avec id explicite
SELECT setval('partner_bons_zora_id_seq', COALESCE((SELECT MAX(id) FROM partner_bons_zora), 1));
