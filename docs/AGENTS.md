# AGENTS.md — Cadre commun Bolamu

## RÈGLE #1 — LA PLUS IMPORTANTE
Appel API réel AVANT toute mise à jour visuelle.
Jamais de faux toast de succès. Jamais de mock en prod.

## WORKFLOW OBLIGATOIRE
1. Lire CONTEXT.md + METHODE_BOLAMU.md + ENDPOINTS.md avant toute action
2. Mapper chaque donnée mock vers le vrai endpoint (src/routes/)
3. Si endpoint manquant → documenter dans docs/BACKEND_MANQUANT.md, ne pas deviner
4. data-testid sur chaque élément interactif
5. Commit local uniquement — jamais git push sans accord explicite de Natsy
6. Rapport récapitulatif à la fin, pas à chaque fichier

## RÈGLES MÉTIER TRANSVERSES
- normalizePhone() sur tout numéro téléphone
- accessToken (jamais token brut) depuis localStorage
- api() préfixe /api/v1 — ne jamais répéter l'URL complète
- Soft delete uniquement — jamais DELETE sur users
- audit_log payload → toujours ::jsonb
- WhatsApp direct — jamais via BullMQ
- Données médicales → BHP v1.2 obligatoire
- RH → agrégats anonymisés uniquement, jamais nominatif
- Secrétaire → jamais comptes rendus/ordonnances/résultats labo

## BOUCLE DE CORRECTION (looping)
Si un test échoue → corriger → relancer → max 5 essais
Au-delà de 5 essais → documenter dans docs/BLOCAGE_[ROLE].md et continuer
Ne jamais boucler à l'infini sur un endpoint manquant côté backend
