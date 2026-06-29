# RAPPORT S26 — MODÉRATION ADMIN

> Test exécuté le 2026-06-28T21:24:17.966Z
> Compte admin: +242060000099

## RÉSUMÉ

- **Étapes réussies:** 6 ✅
- **Étapes échouées:** 1 ❌
- **Étapes ignorées:** 0 ⏭️

## ÉTAPES DU TEST

⏭️ **ÉTAPE 1: Connexion admin**
   _2026-06-28T21:23:45.070Z_

✅ **ÉTAPE 1: Connexion admin**
   JWT reçu
   _2026-06-28T21:23:49.644Z_

⏭️ **ÉTAPE 2: Liste dossiers en attente**
   _2026-06-28T21:23:58.364Z_

✅ **ÉTAPE 2: Liste dossiers en attente**
   7 dossiers en attente
   _2026-06-28T21:23:59.076Z_

⏭️ **ÉTAPE 3: Valider un dossier**
   _2026-06-28T21:23:59.139Z_

✅ **ÉTAPE 3: Valider un dossier**
   Compte +242065413298 validé
   _2026-06-28T21:24:00.387Z_

⏭️ **ÉTAPE 4: Refuser un dossier**
   _2026-06-28T21:24:00.467Z_

❌ **ÉTAPE 4: Refuser un dossier**
   Compte introuvable.
   _2026-06-28T21:24:04.609Z_

⏭️ **ÉTAPE 5: Suspendre un compte partenaire**
   _2026-06-28T21:24:04.609Z_

✅ **ÉTAPE 5: Suspendre un compte partenaire**
   Compte +242060000001 suspendu
   _2026-06-28T21:24:06.524Z_

⏭️ **ÉTAPE 6: Consulter les logs BHP**
   _2026-06-28T21:24:10.708Z_

✅ **ÉTAPE 6: Consulter les logs BHP**
   10 logs récupérés
   _2026-06-28T21:24:17.284Z_

⏭️ **ÉTAPE 7: Statistiques globales plateforme**
   _2026-06-28T21:24:17.359Z_

✅ **ÉTAPE 7: Statistiques globales plateforme**
   Patients: 31, Médecins: 5, Pharmacies: 4, Labs: 4
   _2026-06-28T21:24:17.360Z_

## RÉPONSES API

### POST /auth/admin-login
```json
{
  "success": true,
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicGhvbmUiOiIrMjQyMDYwMDAwMDk5Iiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzgyNjgxODI4LCJleHAiOjE3ODI2ODI3Mjh9.JrL8KK3Mbb9IoB9peoOc0dGzkc2i6F3BQTrjFyVfEww",
  "refreshToken": "6a881aa43f37d20d8b5a803c951855624a4b1b970572f2d8f715c571cbd41959fcaf405445360d2cd3adc5c0d12e98121db4d8f565fd9bb55dcb8d39a1fb5ef8",
  "phone": "+242060000099",
  "role": "admin",
  "full_name": "Admin Bolamu",
  "redirectUrl": "/admin/dashboard.html"
}
```

### GET /admin/pending?limit=50
```json
{
  "success": true,
  "data": [
    {
      "phone": "+24268500021",
      "role": "patient",
      "full_name": "Patient Test",
      "first_name": "Patient",
      "last_name": "Test",
      "rccm_number": null,
      "agrement_number": null,
      "registration_number": null,
      "created_at": "2026-06-28T18:39:43.249Z",
      "is_active": false,
      "documents_file_ids": {
        "id_card": "bolamu/documents/hqvbtdvipxedyxxoudvv"
      },
      "specialty": "",
      "pro_status": "pending",
      "member_code": null,
      "business_name": null,
      "documents": [
        {
          "id": 92,
          "document_type": "identite",
          "storage_path": "https://res.cloudinary.com/dpxefz80w/image/authenticated/s--K5C0iqVA--/v1782679173/bolamu/documents/mvg5vidnnbmpdn0j7qf6.png"
        },
        {
          "id": 107,
          "document_type": "identite",
          "storage_path": "https://res.cloudinary.com/dpxefz80w/image/authenticated/s--VXsh6uV4--/v1782681686/bolamu/documents/kpp1ss5xv7ibykz38vgl.png"
        },
        {
          "id": 106,
          "document_type": "identite",
          "storage_path": "https://res.cloudinary.com/dpxefz80w/image/authenticated/s--sc6Lsdl---/v1782681685/bolamu/documents/bqe4mrgklqjtf3u0sfnf.png"
        },
        {
          "id": 105,
          "document_type": "identite",
          "storage_path": "https://res.cloudinary.com/dpxefz80w/image/authenticated/s--oAb1zmTR--/v1782681476/bolamu/documents/szkc8issqeyvzck7hyut.png"
        },
        {
          "id": 104,
          "document_type": "identite",
          "storage_path": "https://res.cloudinary.com/dpxefz80w/image/authenticated/s---rnHpcPz--/v1782681476/bolamu/documents/hruqo8rzqp4eoipzzp6w.png"
        },
        {
          "id": 101,
          "document_type": "identite",
          "storage_path": "https://res.cloudinary.com/dpxefz80w/image/authenticated/s--eZmcYwbm--/v1782681046/bolamu/documents/kk84f4n95qd0d02egicr.png"
        },
        {
          "id": 100,
          "document_type": "identite",
          "storage_path": "https://res.cloudinary.com/dpxefz80w/image/authenticated/s--AFcOcpJj--/v1782681046/bolamu/documents/mmjlfbsk046yuxhzfspc.png"
        },
        {
          "id": 99,
          "document_type": "identite",
          "storage_path": "https://res.cloudinary.com/dpxefz80w/image/authenticated/s--8NJhRcl1--/v1782681035/bolamu/documents/uoby9mdqrig2dfvfoy8n.png"
        },
        {
          "id": 98,
          "document_type": "identite",
          "storage_path": "https://res.cloudinary.com/dpxefz80w/image/authenticated/s--4Xd8s8bm--/v1782681035/bolamu/documents/htfribhzq706slcidsvs.png"
        },
        {
          "id": 97,
          "document_type": "identite",
          "storage_path": "https://res.cloudinary.com/dpxefz80w/image/authenticated/s--14LRdY7i--/v1782680358/bolamu/documents/zi4j8cy5k5joz5nwkr9k.png"
        },
        {
          "id": 96,
          "document_type": "identite",
          "storage_path": "https://res.cloudinary.com/dpxefz80w/image/authenticated/s--xoMtO7_V--/v1782680358/bolamu/documents/gznrvtnizzboocfhoc2w.png"
        },
        {
          "id": 95,
          "document_type": "identite",
          "storage_path": "https://res.cloudinary.com/dpxefz80w/image/authenticated/s--NuhbDBFJ--/v1782679363/bolamu/documents/xumdbjwk7qlo5xy2nky2.png"
        },
        {
          "id": 94,
          "document_type": "identite",
          "storage_path": "https://res.cloudinary.com/dpxefz80w/image/authenticated/s--pxg57WkM--/v1782679363/bolamu/documents/fz0umrtbh9bm9hfctjgr.png"
        },
        {
          "id": 93,
          "document_type": "identite",
          "storage_path": "https://res.cloudinary.com/dpxefz80w/image/authenticated/s--NNW1MSCz--/v1782679174/bolamu/documents/hqvbtdvipxedyxxoudvv.png"
        }
      ]
    },
    {
      "phone": "+242065413298",
      "role": "doctor",
      "full_name": "Dr. Erci Malabou",
      "first_name": null,
      "last_name": null,
      "rccm_number": null,
      "agrement_number": null,
      "registration_number": "fdfsqdfqs25003",
      "created_at": "2026-05-30T15:16:07.149Z",
      "is_active": false,
      "documents_file_ids": {
        "ordre": "bolamu/documents/zcglxghqq73yczeyem4v",
        "diploma": "bolamu/documents/dbqpvhyqmhqx5q8b7b1x"
      },
      "specialty": "Cardiologie",
      "pro_status": "verified",
      "member_code": "MED-00006",
      "business_name": null,
      "documents": [
        {
          "id": 52,
          "document_type": "identite",
          "storage_path": "https://res.cloudinary.com/dpxefz80w/image/authenticated/s--_2RUG0PO--/v1780161360/bolamu/documents/wbwm2ybe1qoxzjwdvzy6.jpg"
        },
        {
          "id": 50,
          "document_type": "identite",
          "storage_path": "https://res.cloudinary.com/dpxefz80w/image/authenticated/s--6jo91VJM--/v1780161352/bolamu/documents/y7sbzhkv0ymjrbnqp97k.png"
        },
        {
          "id": 51,
          "document_type": "identite",
          "storage_path": "https://res.cloudinary.com/dpxefz80w/image/authenticated/s--EjEXdXmK--/v1780161352/bolamu/documents/dbqpvhyqmhqx5q8b7b1x.png"
        },
        {
          "id": 53,
          "document_type": "identite",
          "storage_path": "https://res.cloudinary.com/dpxefz80w/image/authenticated/s--uwyRte-m--/v1780161360/bolamu/documents/zcglxghqq73yczeyem4v.jpg"
        }
      ]
    },
    {
      "phone": "+242052314569",
      "role": "patient",
      "full_name": "Stephanie Mabiakana",
      "first_name": "Stephanie",
      "last_name": "Mabiakana",
      "rccm_number": null,
      "agrement_number": null,
      "registration_number": null,
      "created_at": "2026-05-30T14:08:49.406Z",
      "is_active": false,
      "documents_file_ids": {
        "id_card": "bolamu/documents/uldc5wnkjm4ymmyhelaz"
      },
      "specialty": "",
      "pro_status": "pending",
      "member_code": null,
      "business_name": null,
      "documents": [
        {
          "id": 48,
          "document_type": "identite",
          "storage_path": "https://res.cloudinary.com/dpxefz80w/image/authenticated/s--iKGtGznv--/v1780157324/bolamu/documents/stejbhdvu7gjk6zgb6v1.jpg"
        },
        {
          "id": 49,
          "document_type": "identite",
          "storage_path": "https://res.cloudinary.com/dpxefz80w/image/authenticated/s--KgAQqbJC--/v1780157323/bolamu/documents/uldc5wnkjm4ymmyhelaz.jpg"
        }
      ]
    },
    {
      "phone": "+2420556547898",
      "role": "patient",
      "full_name": "Marcus Bilandou",
      "first_name": "Marcus",
      "last_name": "Bilandou",
      "rccm_number": null,
      "agrement_number": null,
      "registration_number": null,
      "created_at": "2026-05-30T13:37:53.164Z",
      "is_active": false,
      "documents_file_ids": {
        "id_card": 44
      },
      "specialty": "",
      "pro_status": "pending",
      "member_code": null,
      "business_name": null,
      "documents": [
        {
          "id": 44,
          "document_type": "identite",
          "storage_path": "/var/data/uploads/1780155465488-67765fe5-a73e-4a08-b970-ef94044e0b82.jpg"
        }
      ]
    },
    {
      "phone": "+242060000123",
      "role": "doctor",
      "full_name": "Dr. Test Bolamu",
      "first_name": "Test",
      "last_name": "Bolamu",
      "rccm_number": null,
      "agrement_number": null,
      "registration_number": "CMCB-TEST-001",
      "created_at": "2026-05-30T00:07:48.081Z",
      "is_active": false,
      "documents_file_ids": {
        "ordre": null,
        "diploma": null
      },
      "specialty": "Médecine générale",
      "pro_status": "pending",
      "member_code": "MED-00005",
      "business_name": null,
      "documents": []
    },
    {
      "phone": "+242068523696",
      "role": "laboratoire",
      "full_name": "Bio ",
      "first_name": null,
      "last_name": null,
      "rccm_number": "RCCM CG BZV 44556",
      "agrement_number": "AGR SMEPOB",
      "registration_number": null,
      "created_at": "2026-04-17T00:08:23.879Z",
      "is_active": false,
      "documents_file_ids": {},
      "specialty": "",
      "pro_status": "pending",
      "member_code": null,
      "business_name": null,
      "documents": []
    },
    {
      "phone": "+242068529636",
      "role": "laboratoire",
      "full_name": "Labo bio ",
      "first_name": null,
      "last_name": null,
      "rccm_number": "RCCM 455667",
      "agrement_number": "AGR MIMI",
      "registration_number": null,
      "created_at": "2026-04-17T00:04:09.658Z",
      "is_active": false,
      "documents_file_ids": {},
      "specialty": "",
      "pro_status": "pending",
      "member_code": null,
      "business_name": null,
      "documents": []
    }
  ],
  "message": "",
  "timestamp": "2026-06-28T21:23:59.070Z"
}
```

### POST /admin/validate-user
```json
{
  "success": true,
  "message": "Compte validé avec succès."
}
```

### POST /admin/validate-user
```json
{
  "success": false,
  "message": "Compte introuvable."
}
```

### POST /admin/reject-user
```json
{
  "success": false,
  "message": "Compte introuvable."
}
```

### POST /admin/suspend-user
```json
{
  "success": true,
  "message": "Compte suspendu avec succès."
}
```

### PATCH /admin/users/%2B242060000001/unban
```json
{
  "success": true,
  "message": "Compte +242060000001 réactivé ✅",
  "data": {
    "id": 3,
    "phone": "+242060000001",
    "full_name": "Dr. Mbemba Jean",
    "role": "doctor"
  }
}
```

### GET /admin/stats
```json
{
  "success": true,
  "data": {
    "users": {
      "patients": 31,
      "doctors": 5,
      "pharmacies": 4,
      "laboratories": 4,
      "active_subscriptions": 28,
      "banned": 1,
      "new_today": 2
    },
    "activity": {
      "appointments_total": 23,
      "appointments_today": 0,
      "appointments_month": 7,
      "appointments_done": 6,
      "appointments_confirmed": 15,
      "appointments_cancelled": 0,
      "prescriptions": 22
    },
    "logs": [
      {
        "event_type": "account.unbanned",
        "actor_phone": "admin",
        "created_at": "2026-06-28T19:24:10.524Z"
      },
      {
        "event_type": "admin.login_success",
        "actor_phone": "+242060000099",
        "created_at": "2026-06-28T19:23:49.456Z"
      },
      {
        "event_type": "admin.login_success",
        "actor_phone": "+242060000099",
        "created_at": "2026-06-28T19:20:41.751Z"
      },
      {
        "event_type": "admin.login_success",
        "actor_phone": "+242060000099",
        "created_at": "2026-06-28T19:17:39.470Z"
      },
      {
        "event_type": "admin.login_success",
        "actor_phone": "+242060000099",
        "created_at": "2026-06-28T19:16:48.914Z"
      },
      {
        "event_type": "prescription_delivered",
        "actor_phone": "+242069000058",
        "created_at": "2026-06-28T19:12:40.115Z"
      },
      {
        "event_type": "admin.login_success",
        "actor_phone": "+242060000099",
        "created_at": "2026-06-28T19:11:52.432Z"
      },
      {
        "event_type": "admin.login_success",
        "actor_phone": "+242060000099",
        "created_at": "2026-06-28T19:10:22.238Z"
      },
      {
        "event_type": "register.patient",
        "actor_phone": "+2420680993514",
        "created_at": "2026-06-28T19:10:05.688Z"
      },
      {
        "event_type": "admin.login_success",
        "actor_phone": "+242060000099",
        "created_at": "2026-06-28T19:04:45.890Z"
      }
    ],
    "pending": {
      "doctors": 1,
      "pharmacies": 0,
      "laboratories": 2,
      "total": 3
    },
    "fraud": {
      "high_severity": 0,
      "total": 0
    },
    "revenue": {
      "today": 0,
      "month": 0,
      "total": 0
    }
  }
}
```

## VIOLATIONS CONTRAT API

- ❌ POST /auth/admin-login: missing 'data' field on success
- ❌ POST /admin/validate-user: missing 'data' field on success
- ❌ POST /admin/suspend-user: missing 'data' field on success

## BUGS IDENTIFIÉS

- 🐛 Rejet dossier échoué

## CORRECTIONS À FAIRE

- [ ] Corriger: Rejet dossier échoué
