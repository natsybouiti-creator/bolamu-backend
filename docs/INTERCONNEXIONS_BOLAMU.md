# INTERCONNEXIONS_BOLAMU.md — Système nerveux Bolamu

## Les 13 nerfs

N1 — NOTIFICATIONS (hub central)
Toute action persistante inter-rôles doit créer une entrée notifications
Table : notifications (user_phone, type, message, read, created_at)

N2 — RDV (patient ↔ secrétaire ↔ médecin)
Tables : appointments, agenda_blocks
Flux : patient demande → secrétaire confirme → médecin consulte

N3 — PRESCRIPTION (médecin → patient → pharmacie)
Tables : prescriptions, prescription_items
Flux : médecin écrit → patient notifié → pharmacie délivre

N4 — ANALYSES LABO (médecin → labo → patient)
Tables : lab_prescriptions, lab_results
Flux : médecin prescrit → labo dépose résultats → patient consulte

N5 — DOSSIER MÉDICAL (BHP v1.2)
Tables : health_records, consentements, dossier_access_log
Règle : toute lecture par rôle non-patient → vérifier consentement + écrire access_log

N6 — TIERS PAYANT QR (patient ↔ pharmacie/labo)
Tables : qr_tokens, conventions, partner_payouts
Flux : patient scan QR → remise 15% pharmacie / 10% labo → clearing CDR

N7 — ZORA POINTS (transversal)
Tables : zora_ledger, zora_tiers, zora_marketplace
Flux : action validée → awardZora() → mise à jour palier → marketplace

N8 — ÉVÉNEMENTS ELONGA (patient ↔ événements ↔ Zora)
Tables : elonga_events, elonga_registrations, elonga_checkin_tokens
Flux : patient s'inscrit → check-in QR sur place → Zora crédités

N9 — CLUBS SPORT (adhérents ↔ adhérents)
Tables : sport_groups, sport_group_members
Flux : créer club → rejoindre → activités communes → Zora collectif

N10 — SMARTFLOW RH (médecin/pharmacie/labo → RH anonymisé)
Tables : hors_catalogue_transactions, export_paie_mensuel
Règle absolue : RH ne voit QUE des agrégats anonymisés — jamais nominatif

N11 — MESSAGERIE (adhérent ↔ adhérent / patient ↔ soignant)
Tables : chat_messages, chat_reactions
Flux : message envoyé → notification destinataire → réaction possible

N12 — PAIEMENT & CLEARING (patient → Bolamu → partenaires)
Tables : payments, subscriptions, partner_payouts
Flux : patient paie → admin valide → clearing 25 du mois

N13 — ADMIN SUPERVISION (transversal)
Périmètre : audit_log, toutes tables, validation partenaires, templates WhatsApp
Règle : lecture globale, jamais de donnée de soin directe

## Invariants à vérifier sur tout nouveau code
1. Invariant notification : toute action persistante inter-rôles notifie le bon utilisateur
2. Invariant consentement : toute lecture health_records vérifie consentement + écrit access_log
3. Invariant anonymisation RH : aucun endpoint RH ne renvoie un individu nommé avec données santé/Zora
