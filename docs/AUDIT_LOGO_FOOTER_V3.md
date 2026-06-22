# AUDIT LOGO ET FOOTER V3 — DASHBOARDS
**Date** : 21 juin 2026  
**Mission** : Harmoniser logo officiel et créer footer allégé avec couleurs d'identité par rôle  
**Statut** : ⏳ EN ATTENTE DE VALIDATION

---

## RÉSUMÉ EXÉCUTIF

Nouvelle approche : footer allégé pour dashboards avec couleur de hover dynamique basée sur le token CSS de chaque rôle (`var(--role-X)`). Les tokens sont définis dans `public/css/bolamu-ds.css` (fichier partagé).

**Logo officiel** : `/images/landing/bolamu-logo-final.png`  
**Footer allégé** : Version simplifiée avec hover couleur rôle

---

## 1. TOKENS CSS --role-X TROUVÉS

### Source : `public/css/bolamu-ds.css` (lignes 28-35)

```css
/* Couleurs de rôles */
--role-patient: #00C9A7;
--role-medecin: #2E86FF;
--role-secretaire: #9333EA;
--role-pharmacie: #10B981;
--role-labo: #F59E0B;
--role-admin: #6B7280;
--role-rh: #EC4899;
```

### Tableau des tokens définis

| Token | Valeur hex | Rôle concerné |
|-------|-----------|---------------|
| `--role-patient` | #00C9A7 | Patient |
| `--role-medecin` | #2E86FF | Médecin |
| `--role-secretaire` | #9333EA | Secrétaire |
| `--role-pharmacie` | #10B981 | Pharmacie |
| `--role-labo` | #F59E0B | Laboratoire |
| `--role-admin` | #6B7280 | Admin |
| `--role-rh` | #EC4899 | RH |

---

## 2. TOKENS UTILISÉS DANS LES DASHBOARDS

### Analyse par dashboard

| Dashboard | Token utilisé dans le fichier | Token défini dans bolamu-ds.css | Statut |
|-----------|----------------------------|-------------------------------|--------|
| **Patient** | Aucun --role-patient utilisé (utilise var(--bleu-vif), var(--vert)) | ✅ Défini | ⚠️ Non utilisé |
| **Médecin** | `var(--role-medecin)` | ✅ Défini | ✅ OK |
| **Pharmacie** | `var(--role-pharmacie)` | ✅ Défini | ✅ OK |
| **Laboratoire** | `var(--role-laboratoire)` | ❌ NON défini (c'est --role-labo) | ⚠️ Incohérence |
| **Secrétaire** | `var(--role-secretaire)` | ✅ Défini | ✅ OK |
| **RH** | Aucun --role-rh utilisé (utilise var(--navy), var(--turquoise)) | ✅ Défini | ⚠️ Non utilisé |
| **Admin** | Aucun --role-admin utilisé (utilise ses propres variables) | ✅ Défini | ⚠️ Non utilisé |
| **Agence** | Aucun --role-agence défini dans bolamu-ds.css | ❌ NON défini | ❌ Manquant |

---

## 3. PROBLÈMES IDENTIFIÉS

### 3.1 Laboratoire : Incohérence de nommage

**Problème** : Le fichier `laboratoire/dashboard.html` utilise `var(--role-laboratoire)` mais le token dans `bolamu-ds.css` est `--role-labo`.

**Solution recommandée** : 
- Option A : Renommer le token dans `laboratoire/dashboard.html` de `--role-laboratoire` vers `--role-labo` (cohérence avec bolamu-ds.css)
- Option B : Ajouter un alias `--role-laboratoire: var(--role-labo)` dans `bolamu-ds.css`

**Recommandation** : Option A (plus simple, cohérence directe)

### 3.2 Agence : Token manquant

**Problème** : Aucun token `--role-agence` défini dans `bolamu-ds.css`. Le dashboard utilise `var(--accent) = #7C3AED` (défini localement).

**Solution recommandée** : Ajouter `--role-agence: #7C3AED` dans `bolamu-ds.css` pour cohérence.

### 3.3 Patient, RH, Admin : Tokens non utilisés

**Problème** : Les tokens existent dans `bolamu-ds.css` mais ne sont pas utilisés dans les dashboards correspondants.

**Solution recommandée** : Commencer à utiliser ces tokens pour le footer hover (cohérence identité visuelle).

---

## 4. FOOTER ALLÉGÉ PAR RÔLE

### Structure commune

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
      <a href="/cgu.html" class="text-white/60 hover:text-[ROLE_VAR] transition-colors font-medium">CGU</a>
      <a href="/confidentialite.html" class="text-white/60 hover:text-[ROLE_VAR] transition-colors font-medium">Confidentialité</a>
      <a href="mailto:contactbolamu@gmail.com" class="text-white/60 hover:text-[ROLE_VAR] transition-colors font-medium">Contact</a>
    </div>
    
    <!-- Copyright -->
    <p class="text-white/50 text-xs font-medium">© 2026 Bolamu. Tous droits réservés.</p>
  </div>
</footer>
```

**Note** : Remplacer `[ROLE_VAR]` par le token CSS approprié pour chaque rôle.

---

## 5. FOOTER PAR RÔLE (CODE EXACT)

### 5.1 Patient

```html
<footer class="bg-brand-navy py-8 px-container-margin text-white">
  <div class="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
    <div class="flex items-center gap-3">
      <img src="/images/landing/bolamu-logo-final.png" class="h-10 w-10 object-contain rounded-full" alt="Bolamu">
      <span class="text-base font-bold text-white tracking-tight">Bolamu</span>
    </div>
    <div class="flex items-center gap-6 text-sm">
      <a href="/cgu.html" class="text-white/60 hover:text-[var(--role-patient)] transition-colors font-medium">CGU</a>
      <a href="/confidentialite.html" class="text-white/60 hover:text-[var(--role-patient)] transition-colors font-medium">Confidentialité</a>
      <a href="mailto:contactbolamu@gmail.com" class="text-white/60 hover:text-[var(--role-patient)] transition-colors font-medium">Contact</a>
    </div>
    <p class="text-white/50 text-xs font-medium">© 2026 Bolamu. Tous droits réservés.</p>
  </div>
</footer>
```

**Couleur hover** : `var(--role-patient)` = #00C9A7 (turquoise)

---

### 5.2 Médecin

```html
<footer class="bg-brand-navy py-8 px-container-margin text-white">
  <div class="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
    <div class="flex items-center gap-3">
      <img src="/images/landing/bolamu-logo-final.png" class="h-10 w-10 object-contain rounded-full" alt="Bolamu">
      <span class="text-base font-bold text-white tracking-tight">Bolamu</span>
    </div>
    <div class="flex items-center gap-6 text-sm">
      <a href="/cgu.html" class="text-white/60 hover:text-[var(--role-medecin)] transition-colors font-medium">CGU</a>
      <a href="/confidentialite.html" class="text-white/60 hover:text-[var(--role-medecin)] transition-colors font-medium">Confidentialité</a>
      <a href="mailto:contactbolamu@gmail.com" class="text-white/60 hover:text-[var(--role-medecin)] transition-colors font-medium">Contact</a>
    </div>
    <p class="text-white/50 text-xs font-medium">© 2026 Bolamu. Tous droits réservés.</p>
  </div>
</footer>
```

**Couleur hover** : `var(--role-medecin)` = #2E86FF (bleu)

---

### 5.3 Pharmacie

```html
<footer class="bg-brand-navy py-8 px-container-margin text-white">
  <div class="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
    <div class="flex items-center gap-3">
      <img src="/images/landing/bolamu-logo-final.png" class="h-10 w-10 object-contain rounded-full" alt="Bolamu">
      <span class="text-base font-bold text-white tracking-tight">Bolamu</span>
    </div>
    <div class="flex items-center gap-6 text-sm">
      <a href="/cgu.html" class="text-white/60 hover:text-[var(--role-pharmacie)] transition-colors font-medium">CGU</a>
      <a href="/confidentialite.html" class="text-white/60 hover:text-[var(--role-pharmacie)] transition-colors font-medium">Confidentialité</a>
      <a href="mailto:contactbolamu@gmail.com" class="text-white/60 hover:text-[var(--role-pharmacie)] transition-colors font-medium">Contact</a>
    </div>
    <p class="text-white/50 text-xs font-medium">© 2026 Bolamu. Tous droits réservés.</p>
  </div>
</footer>
```

**Couleur hover** : `var(--role-pharmacie)` = #10B981 (vert)

---

### 5.4 Laboratoire

```html
<footer class="bg-brand-navy py-8 px-container-margin text-white">
  <div class="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
    <div class="flex items-center gap-3">
      <img src="/images/landing/bolamu-logo-final.png" class="h-10 w-10 object-contain rounded-full" alt="Bolamu">
      <span class="text-base font-bold text-white tracking-tight">Bolamu</span>
    </div>
    <div class="flex items-center gap-6 text-sm">
      <a href="/cgu.html" class="text-white/60 hover:text-[var(--role-labo)] transition-colors font-medium">CGU</a>
      <a href="/confidentialite.html" class="text-white/60 hover:text-[var(--role-labo)] transition-colors font-medium">Confidentialité</a>
      <a href="mailto:contactbolamu@gmail.com" class="text-white/60 hover:text-[var(--role-labo)] transition-colors font-medium">Contact</a>
    </div>
    <p class="text-white/50 text-xs font-medium">© 2026 Bolamu. Tous droits réservés.</p>
  </div>
</footer>
```

**Couleur hover** : `var(--role-labo)` = #F59E0B (orange)

**Note** : Le fichier `laboratoire/dashboard.html` utilise actuellement `var(--role-laboratoire)`. Il faut le remplacer par `var(--role-labo)` pour cohérence avec `bolamu-ds.css`.

---

### 5.5 Secrétaire

```html
<footer class="bg-brand-navy py-8 px-container-margin text-white">
  <div class="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
    <div class="flex items-center gap-3">
      <img src="/images/landing/bolamu-logo-final.png" class="h-10 w-10 object-contain rounded-full" alt="Bolamu">
      <span class="text-base font-bold text-white tracking-tight">Bolamu</span>
    </div>
    <div class="flex items-center gap-6 text-sm">
      <a href="/cgu.html" class="text-white/60 hover:text-[var(--role-secretaire)] transition-colors font-medium">CGU</a>
      <a href="/confidentialite.html" class="text-white/60 hover:text-[var(--role-secretaire)] transition-colors font-medium">Confidentialité</a>
      <a href="mailto:contactbolamu@gmail.com" class="text-white/60 hover:text-[var(--role-secretaire)] transition-colors font-medium">Contact</a>
    </div>
    <p class="text-white/50 text-xs font-medium">© 2026 Bolamu. Tous droits réservés.</p>
  </div>
</footer>
```

**Couleur hover** : `var(--role-secretaire)` = #9333EA (violet)

---

### 5.6 RH

```html
<footer class="bg-brand-navy py-8 px-container-margin text-white">
  <div class="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
    <div class="flex items-center gap-3">
      <img src="/images/landing/bolamu-logo-final.png" class="h-10 w-10 object-contain rounded-full" alt="Bolamu">
      <span class="text-base font-bold text-white tracking-tight">Bolamu</span>
    </div>
    <div class="flex items-center gap-6 text-sm">
      <a href="/cgu.html" class="text-white/60 hover:text-[var(--role-rh)] transition-colors font-medium">CGU</a>
      <a href="/confidentialite.html" class="text-white/60 hover:text-[var(--role-rh)] transition-colors font-medium">Confidentialité</a>
      <a href="mailto:contactbolamu@gmail.com" class="text-white/60 hover:text-[var(--role-rh)] transition-colors font-medium">Contact</a>
    </div>
    <p class="text-white/50 text-xs font-medium">© 2026 Bolamu. Tous droits réservés.</p>
  </div>
</footer>
```

**Couleur hover** : `var(--role-rh)` = #EC4899 (rose)

---

### 5.7 Admin

```html
<footer class="bg-brand-navy py-8 px-container-margin text-white">
  <div class="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
    <div class="flex items-center gap-3">
      <img src="/images/landing/bolamu-logo-final.png" class="h-10 w-10 object-contain rounded-full" alt="Bolamu">
      <span class="text-base font-bold text-white tracking-tight">Bolamu</span>
    </div>
    <div class="flex items-center gap-6 text-sm">
      <a href="/cgu.html" class="text-white/60 hover:text-[var(--role-admin)] transition-colors font-medium">CGU</a>
      <a href="/confidentialite.html" class="text-white/60 hover:text-[var(--role-admin)] transition-colors font-medium">Confidentialité</a>
      <a href="mailto:contactbolamu@gmail.com" class="text-white/60 hover:text-[var(--role-admin)] transition-colors font-medium">Contact</a>
    </div>
    <p class="text-white/50 text-xs font-medium">© 2026 Bolamu. Tous droits réservés.</p>
  </div>
</footer>
```

**Couleur hover** : `var(--role-admin)` = #6B7280 (gris)

---

### 5.8 Agence

```html
<footer class="bg-brand-navy py-8 px-container-margin text-white">
  <div class="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
    <div class="flex items-center gap-3">
      <img src="/images/landing/bolamu-logo-final.png" class="h-10 w-10 object-contain rounded-full" alt="Bolamu">
      <span class="text-base font-bold text-white tracking-tight">Bolamu</span>
    </div>
    <div class="flex items-center gap-6 text-sm">
      <a href="/cgu.html" class="text-white/60 hover:text-[var(--accent)] transition-colors font-medium">CGU</a>
      <a href="/confidentialite.html" class="text-white/60 hover:text-[var(--accent)] transition-colors font-medium">Confidentialité</a>
      <a href="mailto:contactbolamu@gmail.com" class="text-white/60 hover:text-[var(--accent)] transition-colors font-medium">Contact</a>
    </div>
    <p class="text-white/50 text-xs font-medium">© 2026 Bolamu. Tous droits réservés.</p>
  </div>
</footer>
```

**Couleur hover** : `var(--accent)` = #7C3AED (violet clair) - défini localement dans `agence/dashboard.html`

**Recommandation** : Ajouter `--role-agence: #7C3AED` dans `bolamu-ds.css` et remplacer `var(--accent)` par `var(--role-agence)` dans le footer.

---

## 6. RECOMMANDATIONS PRÉALABLES

### 6.1 Corrections dans `public/css/bolamu-ds.css`

Ajouter le token manquant pour Agence :

```css
/* Couleurs de rôles */
--role-patient: #00C9A7;
--role-medecin: #2E86FF;
--role-secretaire: #9333EA;
--role-pharmacie: #10B981;
--role-labo: #F59E0B;
--role-admin: #6B7280;
--role-rh: #EC4899;
--role-agence: #7C3AED;  /* AJOUTER */
```

### 6.2 Corrections dans `public/laboratoire/dashboard.html`

Remplacer toutes les occurrences de `var(--role-laboratoire)` par `var(--role-labo)` pour cohérence avec `bolamu-ds.css`.

### 6.3 Corrections dans `public/agence/dashboard.html`

Remplacer `var(--accent)` par `var(--role-agence)` dans le footer après ajout du token dans `bolamu-ds.css`.

---

## 7. FICHIERS À MODIFIER

### 7.1 Logo (12 fichiers)

| # | Dashboard | Fichier | Logo actuel | Action |
|---|-----------|---------|-------------|--------|
| 1 | Patient | `patient/dashboard.html` | SVG inline | Remplacer |
| 2 | Patient | `patient/dashboard-v3-extracted.html` | `01-logo-navbarronds.png` | Remplacer |
| 3 | Patient | `patient/dashboard-v3-design.html` | `01-logo-navbarronds.png` | Remplacer |
| 4 | Médecin | `medecin/dashboard.html` | SVG inline | Remplacer |
| 5 | Pharmacie | `pharmacie/dashboard.html` | Material Symbol | Remplacer |
| 6 | Laboratoire | `laboratoire/dashboard.html` | Material Symbol | Remplacer |
| 7 | Secrétaire | `secretaire/dashboard.html` | SVG inline | Remplacer |
| 8 | Secrétaire | `secretaire/dashboard_v2.html` | À vérifier | À vérifier |
| 9 | RH | `rh/dashboard.html` | Texte "B" | Remplacer |
| 10 | Admin | `admin/dashboard.html` | Texte "B" | Remplacer |
| 11 | Admin | `admin/content.html` | SVG inline | Remplacer |
| 12 | Agence | `agence/dashboard.html` | SVG inline | Remplacer |

### 7.2 Footer (11 fichiers)

| # | Dashboard | Fichier | Footer actuel | Action |
|---|-----------|---------|---------------|--------|
| 1 | Patient | `patient/dashboard.html` | Bloc gris | Remplacer (var(--role-patient)) |
| 2 | Patient | `patient/dashboard-v2.html` | Footer obsolète | Remplacer (var(--role-patient)) |
| 3 | Médecin | `medecin/dashboard.html` | Bloc gris | Remplacer (var(--role-medecin)) |
| 4 | Pharmacie | `pharmacie/dashboard.html` | Bloc gris | Remplacer (var(--role-pharmacie)) |
| 5 | Laboratoire | `laboratoire/dashboard.html` | Bloc gris | Remplacer (var(--role-labo)) |
| 6 | Secrétaire | `secretaire/dashboard.html` | Aucun | Ajouter (var(--role-secretaire)) |
| 7 | Secrétaire | `secretaire/dashboard_v2.html` | Aucun | Ajouter (var(--role-secretaire)) |
| 8 | RH | `rh/dashboard.html` | Aucun | Ajouter (var(--role-rh)) |
| 9 | Admin | `admin/dashboard.html` | Bloc gris | Remplacer (var(--role-admin)) |
| 10 | Admin | `admin/content.html` | Aucun | Ajouter (var(--role-admin)) |
| 11 | Agence | `agence/dashboard.html` | Aucun | Ajouter (var(--role-agence)) |

### 7.3 Corrections CSS (3 fichiers)

| # | Fichier | Correction |
|---|---------|-----------|
| 1 | `public/css/bolamu-ds.css` | Ajouter `--role-agence: #7C3AED` |
| 2 | `public/laboratoire/dashboard.html` | Remplacer `var(--role-laboratoire)` par `var(--role-labo)` |
| 3 | `public/agence/dashboard.html` | Remplacer `var(--accent)` par `var(--role-agence)` dans footer |

**Total** : 26 modifications sur 21 fichiers

---

## 8. PLAN D'ACTION

1. **Valider le rapport** : Attendre confirmation utilisateur
2. **Corriger CSS partagé** : Ajouter `--role-agence` dans `bolamu-ds.css`
3. **Corriger laboratoire** : Remplacer `--role-laboratoire` par `--role-labo`
4. **Corriger agence** : Remplacer `var(--accent)` par `var(--role-agence)` (après étape 2)
5. **Corriger les logos** : Remplacer SVG inline/icônes par logo officiel
6. **Remplacer les footers obsolètes** : Insérer footer allégé avec couleur rôle
7. **Ajouter les footers manquants** : Insérer footer allégé avec couleur rôle
8. **Tester le rendu** : Vérifier l'affichage sur chaque dashboard
9. **Commit** : Message en français décrivant les changements
10. **Push** : Sur main après confirmation

---

## 9. RÈGLES RESPECTÉES

- ✅ Logo officiel : `/images/landing/bolamu-logo-final.png`
- ✅ Classes standard : `h-12 w-12 rounded-full object-contain`
- ✅ Design system : tokens navy (#0A2463) et couleurs rôle
- ✅ Couleurs hover : `var(--role-X)` pour chaque rôle
- ✅ Footer allégé adapté aux dashboards (sans marketing/réseaux sociaux)
- ✅ Copyright 2026 à jour
- ✅ Liens institutionnels : CGU, Confidentialité, Contact
- ✅ Responsive : flex row desktop, colonne mobile
- ✅ Utilisation des tokens existants dans `bolamu-ds.css`

---

**Audit réalisé par** : Cascade AI  
**Date** : 21 juin 2026  
**Version** : 3.0 (footer avec couleurs rôle dynamiques)
