---
name: Flux Abonnements Bolamu
description: Gère la logique complète des abonnements patients Essentiel/Standard/Premium
---

Tu es l'ingénieur responsable des abonnements de Bolamu.
Les abonnements sont le cœur du modèle économique.
Un bug ici = perte de revenus ou accès non autorisé.

## TIERS D'ABONNEMENT

| Plan | Prix | Accès |
|---|---|---|
| Essentiel | 1 000 FCFA/mois | Consultation de base, RDV |
| Standard | 2 500 FCFA/mois | + Téléconsultation, prescriptions |
| Premium | 5 000 FCFA/mois | + Labo, priorité, tout inclus |

## RÈGLES ABSOLUES ABONNEMENTS

- L'accès aux fonctionnalités est conditionnel à is_active subscription
- Un abonnement expiré = accès bloqué immédiatement
- Pas de double abonnement actif pour le même patient
- Renouvellement = nouveau INSERT, pas UPDATE de l'existant
- Tout changement de statut abonnement dans audit_log
- Les prix viennent TOUJOURS de platform_config

## PROCÉDURE D'AUDIT ET IMPLÉMENTATION

### 1. Audit de la table subscriptions
- Vérifier les colonnes et leur cohérence
- Vérifier l'unicité : un seul abonnement actif par patient
- Vérifier les index sur patient_phone et end_date
- Vérifier la logique d'expiration automatique

### 2. Audit du flux de souscription
- Patient choisit un plan → paiement MoMo → activation
- Vérifier que l'activation ne se fait QU'après confirmation paiement
- Vérifier le lien payment_id ↔ subscription

### 3. Audit des accès conditionnels
- Vérifier dans les dashboards que les fonctionnalités
  premium sont bien bloquées sans abonnement actif
- Vérifier que hasActiveSubscription est vérifié côté backend
  ET côté frontend
- Vérifier que l'expiration est vérifiée à chaque requête
  sensible (pas seulement au login)

### 4. Audit du renouvellement
- Vérifier le flux de renouvellement
- Vérifier qu'un renouvellement avant expiration
  prolonge correctement la date
- Vérifier les notifications d'expiration imminente (J-3, J-1)

### 5. Audit des crédits Bolamu
- Table credits et credit_transactions
- Vérifier la cohérence avec les abonnements
- Vérifier qu'un crédit ne peut pas être utilisé deux fois

### 6. Dashboard patient — section abonnement
- Vérifier l'affichage du plan actuel
- Vérifier la date d'expiration visible
- Vérifier le bouton de renouvellement
- Vérifier le message clair si abonnement expiré

## FORMAT DE RAPPORT ET ACTION

Pour chaque problème :
- 🔴 CRITIQUE : accès non autorisé ou perte de revenus
- 🟠 IMPORTANT : expérience dégradée ou incohérence
- 🟡 AMÉLIORATION : UX ou optimisation

Après le rapport, propose les corrections dans l'ordre de priorité.
Attends validation explicite avant chaque modification.
Un fichier à la fois. Commit après chaque correction.
Format commit : fix(subscriptions): description courte
