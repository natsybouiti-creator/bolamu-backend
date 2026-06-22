# AUDIT LOGO ET FOOTER V2 — DASHBOARDS
**Date** : 21 juin 2026  
**Mission** : Harmoniser logo officiel et créer footer allégé pour tous les dashboards métier  
**Statut** : ⏳ EN ATTENTE DE VALIDATION

---

## RÉSUMÉ EXÉCUTIF

Nouvelle approche : footer allégé pour dashboards (sans marketing/réseaux sociaux) pour les utilisateurs déjà connectés. Les logos incorrects (SVG inline, icônes Material Symbols, textes stylisés) doivent être remplacés par le logo officiel.

**Logo officiel** : `/images/landing/bolamu-logo-final.png`  
**Footer allégé** : Version simplifiée du footer landing, adaptée aux dashboards

---

## 1. FOOTER ALLÉGÉ — CODE HTML EXACT

```html
<!-- FOOTER ALLÉGÉ DASHBOARDS -->
<footer class="bg-brand-navy py-8 px-container-margin text-white">
  <div class="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
    <!-- Logo + Nom -->
    <div class="flex items-center gap-3">
      <img src="/images/landing/bolamu-logo-final.png" class="h-10 w-10 object-contain rounded-full" alt="Bolamu">
      <span class="text-base font-bold text-white tracking-tight">Bolamu</span>
    </div>
    
    <!-- Liens institutionnels -->
    <div class="flex items-center gap-6 text-sm">
      <a href="/cgu.html" class="text-white/60 hover:text-brand-turquoise transition-colors font-medium">CGU</a>
      <a href="/confidentialite.html" class="text-white/60 hover:text-brand-turquoise transition-colors font-medium">Confidentialité</a>
      <a href="mailto:contactbolamu@gmail.com" class="text-white/60 hover:text-brand-turquoise transition-colors font-medium">Contact</a>
    </div>
    
    <!-- Copyright -->
    <p class="text-white/50 text-xs font-medium">© 2026 Bolamu. Tous droits réservés.</p>
  </div>
</footer>
```

### Spécifications du footer allégé :

- **Fond** : `bg-brand-navy` (#0A2463) — token officiel design system
- **Padding** : `py-8` (réduit vs landing `pt-24 pb-12`) — adapté aux dashboards
- **Logo** : `/images/landing/bolamu-logo-final.png` avec `h-10 w-10 rounded-full` (taille réduite vs navbar)
- **Texte** : `text-white` pour le nom, `text-white/60` pour les liens
- **Hover** : `hover:text-brand-turquoise` (#00C9A7) — MÊME couleur pour tous les rôles
- **Layout** : Flex row sur desktop, colonne sur mobile
- **Liens** : CGU, Confidentialité, Contact (mailto)
- **Copyright** : 2026 à jour

### Tokens CSS utilisés (design system officiel) :

- `bg-brand-navy` : #0A2463
- `text-brand-turquoise` : #00C9A7 (hover uniquement)
- `px-container-margin` : 20px (défini dans Tailwind config)

**REJET EXPLICITE** : Aucune couleur custom par rôle (pas de bleu médecin, violet secrétaire, etc.) — uniquement les tokens officiels navy/turquoise.

---

## 2. LOGO OFFICIEL — SPÉCIFICATIONS

**Fichier** : `/images/landing/bolamu-logo-final.png`  
**Description** : Rond bleu avec lettre B blanche et feuille turquoise en haut à droite

**Code standard à utiliser** :
```html
<img src="/images/landing/bolamu-logo-final.png" class="h-12 w-12 object-contain rounded-full" alt="Bolamu">
```

**Classes** :
- `h-12 w-12` : 48×48px (taille standard navbar)
- `object-contain` : maintient le ratio
- `rounded-full` : cercle obligatoire (design system §12)

**Note** : Garder la cohérence avec le header existant de chaque dashboard (ne pas casser l'alignement avec le nom "Bolamu").

---

## 3. FICHIERS À MODIFIER

### 3.1 Logo (12 fichiers)

| # | Dashboard | Fichier | Logo actuel | Ligne approx. | Action |
|---|-----------|---------|-------------|--------------|--------|
| 1 | Patient | `patient/dashboard.html` | SVG inline (cercle #2E86FF) | ~584 | Remplacer |
| 2 | Patient | `patient/dashboard-v3-extracted.html` | `01-logo-navbarronds.png` | ~2212 | Remplacer |
| 3 | Patient | `patient/dashboard-v3-design.html` | `01-logo-navbarronds.png` | ~2855 | Remplacer |
| 4 | Médecin | `medecin/dashboard.html` | SVG inline (cercle #0A2463) | ~254 | Remplacer |
| 5 | Pharmacie | `pharmacie/dashboard.html` | Material Symbol `local_pharmacy` | ~185 | Remplacer |
| 6 | Laboratoire | `laboratoire/dashboard.html` | Material Symbol `science` | ~151 | Remplacer |
| 7 | Secrétaire | `secretaire/dashboard.html` | SVG inline (cercle #2E86FF) | ~1184 | Remplacer |
| 8 | Secrétaire | `secretaire/dashboard_v2.html` | À vérifier | - | À vérifier |
| 9 | RH | `rh/dashboard.html` | Texte "B" dans div gradient | ~179 | Remplacer |
| 10 | Admin | `admin/dashboard.html` | Texte "B" dans div gradient | ~336 | Remplacer |
| 11 | Admin | `admin/content.html` | SVG inline (cercle #2E86FF) | ~199 | Remplacer |
| 12 | Agence | `agence/dashboard.html` | SVG inline (cercle #7C3AED) | ~370 | Remplacer |

**Note** : Les fichiers login.html de chaque rôle utilisent déjà le bon logo (vérifié dans AUDIT_LOGO_FOOTER.md).

### 3.2 Footer (11 fichiers)

| # | Dashboard | Fichier | Footer actuel | Ligne approx. | Action |
|---|-----------|---------|---------------|--------------|--------|
| 1 | Patient | `patient/dashboard.html` | Bloc gris isolé (rgba(0,0,0,0.25)) | ~921-949 | Remplacer |
| 2 | Patient | `patient/dashboard-v2.html` | Footer avec logo obsolète | ~1055-1068 | Remplacer |
| 3 | Médecin | `medecin/dashboard.html` | Bloc gris isolé (rgba(10,36,99,0.25)) | ~662-690 | Remplacer |
| 4 | Pharmacie | `pharmacie/dashboard.html` | Bloc gris isolé (rgba(0,0,0,0.25)) | ~465-493 | Remplacer |
| 5 | Laboratoire | `laboratoire/dashboard.html` | Bloc gris isolé (rgba(0,0,0,0.25)) | ~344-372 | Remplacer |
| 6 | Secrétaire | `secretaire/dashboard.html` | Aucun footer | - | Ajouter |
| 7 | Secrétaire | `secretaire/dashboard_v2.html` | Aucun footer | - | Ajouter |
| 8 | RH | `rh/dashboard.html` | Aucun footer | - | Ajouter |
| 9 | Admin | `admin/dashboard.html` | Bloc gris isolé (rgba(0,0,0,0.25)) | ~761-789 | Remplacer |
| 10 | Admin | `admin/content.html` | Aucun footer | - | Ajouter |
| 11 | Agence | `agence/dashboard.html` | Aucun footer | - | Ajouter |

**Total** : 23 modifications sur 18 fichiers (certains fichiers nécessitent logo + footer)

---

## 4. DÉTAIL DES MODIFICATIONS PAR FICHIER

### 4.1 Patient — dashboard.html

**Logo** (ligne ~584) :
```html
<!-- AVANT -->
<svg width="36" height="36" viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
  <circle cx="22" cy="22" r="22" fill="#2E86FF"/>
  <text x="22" y="30" text-anchor="middle" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-weight="800" font-size="26" fill="white">B</text>
  <ellipse cx="34" cy="9" rx="4.5" ry="6" fill="#00C9A7" transform="rotate(-20 34 9)"/>
</svg>

<!-- APRÈS -->
<img src="/images/landing/bolamu-logo-final.png" class="h-12 w-12 object-contain rounded-full" alt="Bolamu">
```

**Footer** (lignes ~921-949) :
```html
<!-- AVANT -->
<footer style="position: static; width: 100%; background: rgba(0,0,0,0.25); padding: 14px 0; text-align: center; margin-top: 40px; font-family: inherit;">
  <p style="margin:0 0 3px 0; font-size:11px; color:rgba(255,255,255,0.55);">© 2025 Bolamu · Plateforme santé digitale · Brazzaville, Congo</p>
  <p style="margin:0; font-size:11px;">
    <a href="/cgu.html" style="color:rgba(255,255,255,0.55); text-decoration:none; margin-right:14px;">CGU</a>
    <a href="/confidentialite.html" style="color:rgba(255,255,255,0.55); text-decoration:none; margin-right:14px;">Confidentialité</a>
    <a href="mailto:contactbolamu@gmail.com" style="color:rgba(255,255,255,0.55); text-decoration:none;">contactbolamu@gmail.com</a>
  </p>
</footer>

<!-- APRÈS -->
<footer class="bg-brand-navy py-8 px-container-margin text-white">
  <div class="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
    <div class="flex items-center gap-3">
      <img src="/images/landing/bolamu-logo-final.png" class="h-10 w-10 object-contain rounded-full" alt="Bolamu">
      <span class="text-base font-bold text-white tracking-tight">Bolamu</span>
    </div>
    <div class="flex items-center gap-6 text-sm">
      <a href="/cgu.html" class="text-white/60 hover:text-brand-turquoise transition-colors font-medium">CGU</a>
      <a href="/confidentialite.html" class="text-white/60 hover:text-brand-turquoise transition-colors font-medium">Confidentialité</a>
      <a href="mailto:contactbolamu@gmail.com" class="text-white/60 hover:text-brand-turquoise transition-colors font-medium">Contact</a>
    </div>
    <p class="text-white/50 text-xs font-medium">© 2026 Bolamu. Tous droits réservés.</p>
  </div>
</footer>
```

---

### 4.2 Médecin — dashboard.html

**Logo** (ligne ~254) : SVG inline → img officiel  
**Footer** (lignes ~662-690) : Bloc gris → footer allégé

---

### 4.3 Pharmacie — dashboard.html

**Logo** (ligne ~185) :
```html
<!-- AVANT -->
<div class="logo-icon">
  <span class="material-symbols-outlined" style="font-size:24px;color:white;">local_pharmacy</span>
</div>

<!-- APRÈS -->
<img src="/images/landing/bolamu-logo-final.png" class="h-12 w-12 object-contain rounded-full" alt="Bolamu">
```

**Footer** (lignes ~465-493) : Bloc gris → footer allégé

---

### 4.4 Laboratoire — dashboard.html

**Logo** (ligne ~151) :
```html
<!-- AVANT -->
<div class="logo-icon">
  <span class="material-symbols-outlined" style="font-size:24px;color:white;">science</span>
</div>

<!-- APRÈS -->
<img src="/images/landing/bolamu-logo-final.png" class="h-12 w-12 object-contain rounded-full" alt="Bolamu">
```

**Footer** (lignes ~344-372) : Bloc gris → footer allégé

---

### 4.5 Secrétaire — dashboard.html

**Logo** (lignes ~1184-1189) : SVG inline → img officiel  
**Footer** : Ajouter footer allégé avant `</div>` de fermeture du main

---

### 4.6 Secrétaire — dashboard_v2.html

**Logo** : À vérifier manuellement  
**Footer** : Ajouter footer allégé

---

### 4.7 RH — dashboard.html

**Logo** (ligne ~179) :
```html
<!-- AVANT -->
<div class="logo-icon">B</div>

<!-- APRÈS -->
<img src="/images/landing/bolamu-logo-final.png" class="h-12 w-12 object-contain rounded-full" alt="Bolamu">
```

**Footer** : Ajouter footer allégé

---

### 4.8 Admin — dashboard.html

**Logo** (ligne ~336) :
```html
<!-- AVANT -->
<div class="logo-mark">B</div>

<!-- APRÈS -->
<img src="/images/landing/bolamu-logo-final.png" class="h-12 w-12 object-contain rounded-full" alt="Bolamu">
```

**Footer** (lignes ~761-789) : Bloc gris → footer allégé

---

### 4.9 Admin — content.html

**Logo** (ligne ~199) : SVG inline → img officiel  
**Footer** : Ajouter footer allégé

---

### 4.10 Agence — dashboard.html

**Logo** (lignes ~370-374) : SVG inline → img officiel  
**Footer** : Ajouter footer allégé

---

### 4.11 Patient — dashboard-v3-extracted.html / dashboard-v3-design.html

**Logo** : `01-logo-navbarronds.png` → `bolamu-logo-final.png`  
**Footer** : Ces fichiers semblent être des versions de travail, vérifier s'ils sont encore utilisés

---

### 4.12 Patient — dashboard-v2.html

**Footer** (lignes ~1055-1068) : Footer avec logo obsolète → footer allégé

---

## 5. PLAN D'ACTION

1. **Valider le rapport** : Attendre confirmation utilisateur
2. **Corriger les logos** : Remplacer SVG inline/icônes/textes par `<img src="/images/landing/bolamu-logo-final.png" class="h-12 w-12 object-contain rounded-full" alt="Bolamu">`
3. **Remplacer les footers obsolètes** : Remplacer le bloc gris par le footer allégé
4. **Ajouter les footers manquants** : Insérer le footer allégé avant la fermeture du main
5. **Vérifier secretaire/dashboard_v2.html** : Logo à vérifier manuellement
6. **Tester le rendu** : Vérifier l'affichage sur chaque dashboard
7. **Commit** : Message en français décrivant les changements
8. **Push** : Sur main après confirmation

---

## 6. RÈGLES RESPECTÉES

- ✅ Logo officiel : `/images/landing/bolamu-logo-final.png`
- ✅ Classes standard : `h-12 w-12 rounded-full object-contain`
- ✅ Design system : tokens navy (#0A2463) et turquoise (#00C9A7) uniquement
- ✅ Pas de couleurs custom par rôle (rejet explicite)
- ✅ Footer allégé adapté aux dashboards (sans marketing/réseaux sociaux)
- ✅ Copyright 2026 à jour
- ✅ Liens institutionnels : CGU, Confidentialité, Contact
- ✅ Responsive : flex row desktop, colonne mobile

---

**Audit réalisé par** : Cascade AI  
**Date** : 21 juin 2026  
**Version** : 2.0 (footer allégé)
