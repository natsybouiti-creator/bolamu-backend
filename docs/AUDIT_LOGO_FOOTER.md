# AUDIT LOGO ET FOOTER — DASHBOARDS
**Date** : 21 juin 2026  
**Mission** : Harmoniser logo officiel et footer sur tous les dashboards  
**Statut** : ⏳ EN ATTENTE DE VALIDATION

---

## RÉSUMÉ EXÉCUTIF

L'audit révèle une **incohérence majeure** sur les logos des dashboards : 13 fichiers utilisent des SVG inline, icônes Material Symbols ou textes stylisés au lieu du logo officiel. Les footers sont également obsolètes (bloc gris isolé) et doivent être remplacés par le modèle landing/pages publiques.

**Logo officiel** : `/images/landing/bolamu-logo-final.png` (design_system.md §12)  
**Modèle footer** : `templates/page-base.html` (footer navy complet avec liens institutionnels)

---

## 1. LOGO OFFICIEL — RÉFÉRENCE

**Fichier** : `/images/landing/bolamu-logo-final.png`  
**Description** : Rond bleu (#003FB1) avec lettre B blanche et feuille turquoise (#00C9A7) en haut à droite  
**Usage navbar** : `<img src="/images/landing/bolamu-logo-final.png" class="h-12 w-12 object-contain rounded-full" alt="Bolamu">`  
**Usage footer** : idem, sans classe transition  
**Taille standard** : 48×48px (h-12 w-12) sur navbar et footer  
**Règle** : `rounded-full` obligatoire sur toutes les instances

---

## 2. ÉTAT ACTUEL DES LOGOS PAR DASHBOARD

| Dashboard | Fichier | Logo actuel | Statut | Action requise |
|-----------|---------|-------------|--------|----------------|
| **Patient** | `patient/dashboard.html` | SVG inline (cercle #2E86FF + B blanc + ellipse turquoise) | ❌ PAS LE BON LOGO | Remplacer par img officiel |
| **Patient** | `patient/dashboard-v3.html` | `https://bolamu.co/images/landing/bolamu-logo-512.png` | ✅ BON LOGO | Rien |
| **Patient** | `patient/dashboard-v3-extracted.html` | `https://bolamu.co/images/landing/01-logo-navbarronds.png` | ❌ FICHIER OBSOLÈTE | Remplacer par officiel |
| **Patient** | `patient/dashboard-v3-design.html` | `https://bolamu.co/images/landing/01-logo-navbarronds.png` | ❌ FICHIER OBSOLÈTE | Remplacer par officiel |
| **Médecin** | `medecin/dashboard.html` | SVG inline (cercle #0A2463 + B blanc + ellipse turquoise) | ❌ PAS LE BON LOGO | Remplacer par img officiel |
| **Pharmacie** | `pharmacie/dashboard.html` | Material Symbol `local_pharmacy` dans div turquoise | ❌ ICÔNE GÉNÉRIQUE | Remplacer par img officiel |
| **Laboratoire** | `laboratoire/dashboard.html` | Material Symbol `science` dans div orange | ❌ ICÔNE GÉNÉRIQUE | Remplacer par img officiel |
| **Secrétaire** | `secretaire/dashboard.html` | SVG inline (cercle #2E86FF + B blanc + ellipse turquoise) | ❌ PAS LE BON LOGO | Remplacer par img officiel |
| **Secrétaire** | `secretaire/dashboard_v2.html` | Non visible dans grep | ⚠️ À VÉRIFIER | À vérifier manuellement |
| **Secrétaire** | `secretaire/login.html` | `/images/landing/bolamu-logo-final.png` | ✅ BON LOGO | Rien |
| **RH** | `rh/dashboard.html` | Texte "B" dans div avec gradient | ❌ TEXTE STYLISÉ | Remplacer par img officiel |
| **RH** | `rh/login.html` | `/images/landing/bolamu-logo-final.png` | ✅ BON LOGO | Rien |
| **Admin** | `admin/dashboard.html` | Texte "B" dans div avec gradient | ❌ TEXTE STYLISÉ | Remplacer par img officiel |
| **Admin** | `admin/login.html` | `/images/landing/bolamu-logo-final.png` | ✅ BON LOGO | Rien |
| **Admin** | `admin/content.html` | SVG inline (cercle #2E86FF + B blanc + ellipse turquoise) | ❌ PAS LE BON LOGO | Remplacer par img officiel |
| **Admin** | `admin/events-checkin.html` | `/images/landing/bolamu-logo-final.png` | ✅ BON LOGO | Rien |
| **Agence** | `agence/dashboard.html` | SVG inline (cercle #7C3AED + B blanc + ellipse turquoise) | ❌ PAS LE BON LOGO | Remplacer par img officiel |
| **Agence** | `agence/login.html` | `/images/landing/bolamu-logo-final.png` | ✅ BON LOGO | Rien |

**Total** : 13 fichiers à corriger sur 18 analysés

---

## 3. ÉTAT ACTUEL DES FOOTERS PAR DASHBOARD

### 3.1 Modèle obsolète (bloc gris isolé)

**Structure actuelle** (utilisée par patient, médecin, pharmacie, laboratoire, admin) :
```html
<footer style="
  position: static;
  width: 100%;
  background: rgba(0,0,0,0.25);
  padding: 14px 0;
  text-align: center;
  margin-top: 40px;
  font-family: inherit;
">
  <p style="margin:0 0 3px 0; font-size:11px; color:rgba(255,255,255,0.55);">
    © 2025 Bolamu · Plateforme santé digitale · Brazzaville, Congo
  </p>
  <p style="margin:0; font-size:11px;">
    <a href="/cgu.html" style="color:rgba(255,255,255,0.55); text-decoration:none; margin-right:14px;">CGU</a>
    <a href="/confidentialite.html" style="color:rgba(255,255,255,0.55); text-decoration:none; margin-right:14px;">Confidentialité</a>
    <a href="mailto:contactbolamu@gmail.com" style="color:rgba(255,255,255,0.55); text-decoration:none;">contactbolamu@gmail.com</a>
  </p>
</footer>
```

**Problèmes** :
- Fond gris semi-transparent (`rgba(0,0,0,0.25)`) isolé, pas intégré visuellement
- Pas de logo Bolamu
- Copyright 2025 (obsolète, devrait être 2026)
- Pas de liens réseaux sociaux
- Pas de localisation villes (Brazzaville/Pointe-Noire)
- Style inline, pas réutilisable

**Dashboards concernés** :
- `patient/dashboard.html` ❌
- `medecin/dashboard.html` ❌
- `pharmacie/dashboard.html` ❌
- `laboratoire/dashboard.html` ❌
- `admin/dashboard.html` ❌

### 3.2 Modèle landing (footer navy complet)

**Source** : `templates/page-base.html` (aussi utilisé sur landing.html, zora/*, etc.)

```html
<footer class="bg-brand-navy pt-24 pb-12 px-container-margin text-white">
  <div class="max-w-7xl mx-auto">
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-xl mb-20">
      <div class="lg:col-span-4">
        <a class="flex items-center gap-3 mb-8" href="/landing.html">
          <img alt="Bolamu Logo" class="h-12 w-12 object-contain rounded-full" src="/images/landing/bolamu-logo-final.png">
          <div class="flex flex-col leading-none">
            <span class="text-xl font-extrabold text-white tracking-tight">Bolamu</span>
            <span class="text-[10px] font-bold text-brand-turquoise uppercase tracking-widest">la santé simple et accessible</span>
          </div>
        </a>
        <p class="text-white/70 text-sm font-medium leading-relaxed mb-8 max-w-sm">
          Bolamu réinvente l'accès aux soins au Congo grâce à une plateforme connectée et humaine. Nous rendons la santé de qualité accessible à tous, partout.
        </p>
        <div class="flex flex-wrap gap-4">
          <!-- Réseaux sociaux (WhatsApp, Facebook, Instagram, etc.) -->
        </div>
      </div>
      <div class="lg:col-span-8 grid grid-cols-2 md:grid-cols-3 gap-8">
        <!-- Liens institutionnels : CGU, Confidentialité, Contact, À propos, Blog, etc. -->
      </div>
    </div>
    <div class="pt-12 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-6">
      <p class="text-white/50 text-xs font-medium">© 2026 Bolamu. Tous droits réservés. La santé pour tous au Congo.</p>
      <div class="flex items-center gap-6">
        <span class="text-white/50 text-[10px] font-bold uppercase tracking-widest">Brazzaville</span>
        <span class="text-white/30">•</span>
        <span class="text-white/50 text-[10px] font-bold uppercase tracking-widest">Pointe-Noire</span>
      </div>
    </div>
  </div>
</footer>
```

**Avantages** :
- Fond navy (#0A2463) intégré avec le design system
- Logo officiel Bolamu
- Description de la mission
- Liens réseaux sociaux
- Navigation institutionnelle complète
- Copyright 2026 à jour
- Localisation villes
- Design cohérent avec landing/pages publiques

### 3.3 État par dashboard

| Dashboard | Footer actuel | Statut | Action requise |
|-----------|---------------|--------|----------------|
| **Patient** | `patient/dashboard.html` : Bloc gris isolé | ❌ OBSOLÈTE | Remplacer par modèle landing |
| **Patient** | `patient/dashboard-v2.html` : Footer avec logo obsolète (01-logo-navbarronds.png) | ❌ OBSOLÈTE | Remplacer par modèle landing |
| **Médecin** | `medecin/dashboard.html` : Bloc gris isolé | ❌ OBSOLÈTE | Remplacer par modèle landing |
| **Pharmacie** | `pharmacie/dashboard.html` : Bloc gris isolé | ❌ OBSOLÈTE | Remplacer par modèle landing |
| **Laboratoire** | `laboratoire/dashboard.html` : Bloc gris isolé | ❌ OBSOLÈTE | Remplacer par modèle landing |
| **Secrétaire** | `secretaire/dashboard.html` : Pas de footer visible | ⚠️ MANQUANT | Ajouter modèle landing |
| **Secrétaire** | `secretaire/dashboard_v2.html` : Pas de footer visible | ⚠️ MANQUANT | Ajouter modèle landing |
| **RH** | `rh/dashboard.html` : Pas de footer visible | ⚠️ MANQUANT | Ajouter modèle landing |
| **Admin** | `admin/dashboard.html` : Bloc gris isolé | ❌ OBSOLÈTE | Remplacer par modèle landing |
| **Admin** | `admin/content.html` : Pas de footer visible | ⚠️ MANQUANT | Ajouter modèle landing |
| **Agence** | `agence/dashboard.html` : Pas de footer visible | ⚠️ MANQUANT | Ajouter modèle landing |

**Total** : 5 footers obsolètes, 6 manquants

---

## 4. MODÈLE DE RÉFÉRENCE CHOISI

**Source** : `templates/page-base.html` (lignes 156-250)  
**Justification** : Ce modèle est déjà utilisé sur toutes les pages publiques (landing, zora, offres, blog) et respecte le design system complet. Il est plus complet, moderne et cohérent que le footer obsolète des dashboards.

**Extrait de code** :
```html
<!-- FOOTER -->
<footer class="bg-brand-navy pt-24 pb-12 px-container-margin text-white">
  <div class="max-w-7xl mx-auto">
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-xl mb-20">
      <div class="lg:col-span-4">
        <a class="flex items-center gap-3 mb-8" href="/landing.html">
          <img alt="Bolamu Logo" class="h-12 w-12 object-contain rounded-full" src="/images/landing/bolamu-logo-final.png">
          <div class="flex flex-col leading-none">
            <span class="text-xl font-extrabold text-white tracking-tight">Bolamu</span>
            <span class="text-[10px] font-bold text-brand-turquoise uppercase tracking-widest">la santé simple et accessible</span>
          </div>
        </a>
        <p class="text-white/70 text-sm font-medium leading-relaxed mb-8 max-w-sm">
          Bolamu réinvente l'accès aux soins au Congo grâce à une plateforme connectée et humaine. Nous rendons la santé de qualité accessible à tous, partout.
        </p>
        <div class="flex flex-wrap gap-4">
          <!-- Réseaux sociaux -->
        </div>
      </div>
      <div class="lg:col-span-8 grid grid-cols-2 md:grid-cols-3 gap-8">
        <!-- Navigation institutionnelle -->
      </div>
    </div>
    <div class="pt-12 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-6">
      <p class="text-white/50 text-xs font-medium">© 2026 Bolamu. Tous droits réservés. La santé pour tous au Congo.</p>
      <div class="flex items-center gap-6">
        <span class="text-white/50 text-[10px] font-bold uppercase tracking-widest">Brazzaville</span>
        <span class="text-white/30">•</span>
        <span class="text-white/50 text-[10px] font-bold uppercase tracking-widest">Pointe-Noire</span>
      </div>
    </div>
  </div>
</footer>
```

---

## 5. PROPOSITION DE CHANGEMENT PAR DASHBOARD

### 5.1 Patient

**Fichier** : `patient/dashboard.html`

**Logo actuel** (ligne 584) :
```html
<svg width="36" height="36" viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
  <circle cx="22" cy="22" r="22" fill="#2E86FF"/>
  <text x="22" y="30" text-anchor="middle" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-weight="800" font-size="26" fill="white">B</text>
  <ellipse cx="34" cy="9" rx="4.5" ry="6" fill="#00C9A7" transform="rotate(-20 34 9)"/>
</svg>
```

**Logo proposé** :
```html
<img src="/images/landing/bolamu-logo-final.png" class="h-12 w-12 object-contain rounded-full" alt="Bolamu">
```

**Footer actuel** (lignes 921-949) : Bloc gris isolé  
**Footer proposé** : Modèle landing avec couleur d'accent turquoise (`--brand-turquoise`)

---

### 5.2 Médecin

**Fichier** : `medecin/dashboard.html`

**Logo actuel** (ligne 254) : SVG inline (cercle #0A2463)  
**Logo proposé** : `<img src="/images/landing/bolamu-logo-final.png" class="h-12 w-12 object-contain rounded-full" alt="Bolamu">`

**Footer actuel** (lignes 662-690) : Bloc gris isolé  
**Footer proposé** : Modèle landing avec couleur d'accent bleu médecin (`--role-medecin: #2E86FF`)

---

### 5.3 Pharmacie

**Fichier** : `pharmacie/dashboard.html`

**Logo actuel** (ligne 185) :
```html
<div class="logo-icon">
  <span class="material-symbols-outlined" style="font-size:24px;color:white;">local_pharmacy</span>
</div>
```

**Logo proposé** :
```html
<img src="/images/landing/bolamu-logo-final.png" class="h-12 w-12 object-contain rounded-full" alt="Bolamu">
```

**Footer actuel** (lignes 465-493) : Bloc gris isolé  
**Footer proposé** : Modèle landing avec couleur d'accent turquoise (`--role-pharmacie: #10B981`)

---

### 5.4 Laboratoire

**Fichier** : `laboratoire/dashboard.html`

**Logo actuel** (ligne 151) :
```html
<div class="logo-icon">
  <span class="material-symbols-outlined" style="font-size:24px;color:white;">science</span>
</div>
```

**Logo proposé** :
```html
<img src="/images/landing/bolamu-logo-final.png" class="h-12 w-12 object-contain rounded-full" alt="Bolamu">
```

**Footer actuel** (lignes 344-372) : Bloc gris isolé  
**Footer proposé** : Modèle landing avec couleur d'accent orange (`--role-laboratoire: #F59E0B`)

---

### 5.5 Secrétaire

**Fichier** : `secretaire/dashboard.html`

**Logo actuel** (lignes 1184-1189) : SVG inline (cercle #2E86FF)  
**Logo proposé** : `<img src="/images/landing/bolamu-logo-final.png" class="h-12 w-12 object-contain rounded-full" alt="Bolamu">`

**Footer actuel** : Aucun  
**Footer proposé** : Modèle landing avec couleur d'accent violet (`--role-secretaire: #9333EA`)

---

### 5.6 RH

**Fichier** : `rh/dashboard.html`

**Logo actuel** (ligne 179) :
```html
<div class="logo-icon">B</div>
```

**Logo proposé** :
```html
<img src="/images/landing/bolamu-logo-final.png" class="h-12 w-12 object-contain rounded-full" alt="Bolamu">
```

**Footer actuel** : Aucun  
**Footer proposé** : Modèle landing avec couleur d'accent rose (`--role-rh: #EC4899`)

---

### 5.7 Admin

**Fichier** : `admin/dashboard.html`

**Logo actuel** (ligne 336) :
```html
<div class="logo-mark">B</div>
```

**Logo proposé** :
```html
<img src="/images/landing/bolamu-logo-final.png" class="h-12 w-12 object-contain rounded-full" alt="Bolamu">
```

**Footer actuel** (lignes 761-789) : Bloc gris isolé  
**Footer proposé** : Modèle landing avec couleur d'accent gris (`--role-admin: #6B7280`)

---

### 5.8 Agence

**Fichier** : `agence/dashboard.html`

**Logo actuel** (lignes 370-374) : SVG inline (cercle #7C3AED)  
**Logo proposé** : `<img src="/images/landing/bolamu-logo-final.png" class="h-12 w-12 object-contain rounded-full" alt="Bolamu">`

**Footer actuel** : Aucun  
**Footer proposé** : Modèle landing avec couleur d'accent violet (`--role-agence: #7C3AED`)

---

## 6. COULEURS D'ACCENT PAR RÔLE

| Rôle | Couleur accent | Token CSS |
|------|----------------|-----------|
| Patient | Turquoise | `--brand-turquoise: #00C9A7` |
| Médecin | Bleu | `--role-medecin: #2E86FF` |
| Pharmacie | Vert | `--role-pharmacie: #10B981` |
| Laboratoire | Orange | `--role-laboratoire: #F59E0B` |
| Secrétaire | Violet | `--role-secretaire: #9333EA` |
| RH | Rose | `--role-rh: #EC4899` |
| Admin | Gris | `--role-admin: #6B7280` |
| Agence | Violet clair | `--role-agence: #7C3AED` |

**Note** : Le footer landing utilise `--brand-turquoise` par défaut. Pour chaque dashboard, on adaptera les accents vers la couleur du rôle correspondante.

---

## 7. LISTE COMPLÈTE DES FICHIERS À CORRIGER

### 7.1 Logo (13 fichiers)

1. `public/patient/dashboard.html`
2. `public/patient/dashboard-v3-extracted.html`
3. `public/patient/dashboard-v3-design.html`
4. `public/medecin/dashboard.html`
5. `public/pharmacie/dashboard.html`
6. `public/laboratoire/dashboard.html`
7. `public/secretaire/dashboard.html`
8. `public/secretaire/dashboard_v2.html` (à vérifier)
9. `public/rh/dashboard.html`
10. `public/admin/dashboard.html`
11. `public/admin/content.html`
12. `public/agence/dashboard.html`

### 7.2 Footer (11 fichiers)

1. `public/patient/dashboard.html` (remplacer)
2. `public/patient/dashboard-v2.html` (remplacer)
3. `public/medecin/dashboard.html` (remplacer)
4. `public/pharmacie/dashboard.html` (remplacer)
5. `public/laboratoire/dashboard.html` (remplacer)
6. `public/secretaire/dashboard.html` (ajouter)
7. `public/secretaire/dashboard_v2.html` (ajouter)
8. `public/rh/dashboard.html` (ajouter)
9. `public/admin/dashboard.html` (remplacer)
10. `public/admin/content.html` (ajouter)
11. `public/agence/dashboard.html` (ajouter)

**Total** : 24 modifications sur 18 fichiers (certains fichiers nécessitent logo + footer)

---

## 8. PLAN D'ACTION PROPOSÉ

1. **Valider le rapport** : Attendre confirmation utilisateur
2. **Corriger les logos** : Remplacer SVG inline/icônes par `<img src="/images/landing/bolamu-logo-final.png" class="h-12 w-12 object-contain rounded-full" alt="Bolamu">`
3. **Remplacer les footers obsolètes** : Copier le modèle de `templates/page-base.html` avec adaptation couleur rôle
4. **Ajouter les footers manquants** : Même modèle pour dashboards sans footer
5. **Tester le rendu** : Vérifier l'affichage sur chaque dashboard
6. **Commit** : Message en français décrivant les changements
7. **Push** : Sur main après confirmation

---

**Audit réalisé par** : Cascade AI  
**Date** : 21 juin 2026  
**Version** : 1.0
