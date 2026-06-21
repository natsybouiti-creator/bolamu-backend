# Design System Bolamu — Stitch / Material You Afrique Centrale

Ce fichier documente le design system visuel de Bolamu utilisé dans toutes les interfaces HTML/CSS du projet (dossier `public/`).

---

## 1. Couleurs (tokens)

**Brand tokens (immuables)**
- `--brand-navy`: #0A2463 → titres, navbar, footer, fonds sombres
- `--brand-turquoise`: #00C9A7 → icônes check, badges validation, accents santé
- `--brand-orange`: #FF6B35 → Zora rewards, tags lifestyle uniquement
- `--primary`: #003FB1 → boutons CTA, liens actifs, highlights interactifs
- `--primary-fixed`: #DBE1FF → fond badges pill "disponibilité"

**Surface tokens**
- `--surface`: #FAF8FF → fond global de toutes les pages
- `--surface-container-low`: #F3F3FE → sections alternées (pricing, blog...)
- `--surface-container`: #EDEDF8 → fonds secondaires légers
- `--on-surface`: #191B23 → texte body principal
- `--on-surface-variant`: #434654 → texte secondaire, descriptions, labels
- `--outline-variant`: #C3C5D7 → bordures cartes, dividers, séparateurs

---

## 2. Typographie

- **Font family**: `'Plus Jakarta Sans', sans-serif` — utilisée partout, aucune exception
- **Weights autorisés**: 400 (body), 500 (semibold/nav), 600 (bold/subtitles), 700 (extrabold/H2), 800 (black/H1, badges)
- **H1**: `font-size: clamp(2.5rem, 5vw, 3.75rem)`, `font-weight: 800`, `line-height: 1.1`, `letter-spacing: -0.02em`, couleur `--brand-navy`
- **H2**: `font-size: clamp(1.75rem, 3vw, 2.25rem)`, `font-weight: 800`, `letter-spacing: -0.01em`, couleur `--brand-navy`
- **H3**: `font-size: 1.25rem`, `font-weight: 700`, couleur `--brand-navy`
- **Body large**: `font-size: 1.125rem`, `font-weight: 500`, `line-height: 1.6`, couleur `--on-surface-variant`
- **Body small**: `font-size: 0.875rem`, `font-weight: 500`, couleur `--on-surface-variant`
- **Overline / badge**: `font-size: 0.625rem (10px)`, `font-weight: 800`, `text-transform: uppercase`, `letter-spacing: 0.2em`

---

## 3. Border radius

- `--radius-xs`: 4px → éléments UI mineurs
- `--radius-sm`: 8px → boutons outline, inner cards
- `--radius-md`: 12px → cards standards
- `--radius-lg`: 24px (`rounded-3xl`) → soft-cards, sections imagées
- `--radius-xl`: 32px à 40px → hero cards, sections Elonga, images principales
- `--radius-full`: 9999px → boutons CTA pill, badges, avatars

---

## 4. Ombres

- **CTA primaire bleu**: `box-shadow: 0 8px 24px rgba(0, 63, 177, 0.25)`
- **CTA orange Zora**: `box-shadow: 0 8px 24px rgba(255, 107, 53, 0.20)`
- **Card hover**: `box-shadow: 0 12px 40px rgba(0, 63, 177, 0.08)`
- **Card élévée (hero, témoignage)**: `box-shadow: 0 24px 64px rgba(0, 0, 0, 0.12)`
- **Pas d'ombre** sur les éléments plats (nav, badges, dividers)

---

## 5. Composants

### soft-card (composant signature)
```css
.soft-card {
  background: #ffffff;
  border: 1px solid #C3C5D7;
  border-radius: 24px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.soft-card:hover {
  border-color: #003FB1;
  box-shadow: 0 12px 40px rgba(0, 63, 177, 0.08);
  transform: translateY(-4px);
}
```

### Bouton CTA primaire
```css
.btn-primary {
  background: #003FB1;
  color: #ffffff;
  padding: 14px 32px;
  border-radius: 9999px;
  font-weight: 700;
  font-size: 1rem;
  box-shadow: 0 8px 24px rgba(0, 63, 177, 0.25);
  transition: all 0.2s ease;
}
.btn-primary:hover {
  background: #0A2463;
  transform: translateY(-2px);
}
.btn-primary:active { transform: scale(0.95); }
```

### Bouton outline secondaire
```css
.btn-outline {
  background: transparent;
  border: 2px solid #C3C5D7;
  color: #0A2463;
  padding: 14px 32px;
  border-radius: 9999px;
  font-weight: 700;
}
.btn-outline:hover { background: #ffffff; }
```

### Badge pill disponibilité
```css
.badge-availability {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #DBE1FF;
  color: #003DAB;
  padding: 6px 16px;
  border-radius: 9999px;
  font-weight: 800;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
}
```

### Badge Zora / tag lifestyle
```css
.badge-zora {
  background: rgba(255, 107, 53, 0.1);
  color: #FF6B35;
  padding: 4px 12px;
  border-radius: 9999px;
  font-size: 0.625rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
```

### Navbar sticky
```css
.navbar {
  position: sticky;
  top: 0;
  z-index: 50;
  background: rgba(250, 248, 255, 0.80);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(195, 197, 215, 0.30);
  padding: 16px 20px;
}
```

---

## 6. Spacing

Utiliser ces valeurs exclusivement pour les paddings/margins de sections et layouts :

| Token | Valeur | Usage |
|-------|--------|-------|
| `--space-xs` | 4px | Gaps micro |
| `--space-sm` | 12px | Gaps internes composants |
| `--space-base` | 8px | Grille de base |
| `--space-gutter` | 16px | Gouttières colonnes |
| `--space-md` | 24px | Padding cards |
| `--space-container` | 20px | Marges latérales page |
| `--space-lg` | 40px | Espacement entre sections moyennes |
| `--space-xl` | 64px | `padding-top/bottom` des grandes sections |

Max-width global : `1280px` centré avec `margin: 0 auto`.

---

## 7. Alternance des fonds de sections

Suivre strictement cet ordre dans toutes les pages multi-sections :
1. `background: #ffffff` (blanc)
2. `background: #F3F3FE` (surface-container-low)
3. `background: #0A2463` (brand-navy — sections spéciales : stats bar, témoignages, CTA final)

Les sections navy utilisent : texte `#ffffff`, accents `#00C9A7`, texte secondaire `rgba(255,255,255,0.7)`.

---

## 8. Icônes

- **Librairie**: Material Symbols Outlined (variable font Google)
- **Import**: `https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1`
- **Usage HTML**: `<span class="material-symbols-outlined">nom_icone</span>`
- **FILL=1** (icône pleine) : `font-variation-settings: 'FILL' 1` — uniquement pour les icônes decoratives (étoiles Zora, etc.)
- **Tailles courantes**: 18px (inline texte), 24px (standard), 32px (cards), 48px (hero sections)
- **Couleurs**: `--brand-turquoise` pour check/validation, `--primary` pour actions, `--brand-orange` pour Zora

---

## 9. Règles d'application par dashboard

Ces règles s'appliquent à TOUS les dashboards du projet (`public/patient/`, `public/medecin/`, `public/rh/`, `public/admin/`, etc.) :

- Fond global : toujours `#FAF8FF`
- Widgets/cards de données : toujours `soft-card` (blanc + border outline-variant)
- Titres de page : H2 brand-navy, font-weight 800
- Métriques/KPIs : nombre en H1/display brand-navy, label en overline on-surface-variant
- Tableaux : fond blanc, header `#F3F3FE`, bordures `1px solid #C3C5D7`, hover row `rgba(0,63,177,0.03)`
- Statuts : succès `#00C9A7`, erreur `#BA1A1A`, warning `#FF6B35`, info `#003FB1`
- Bouton d'action principal de chaque page : `.btn-primary` (jamais un autre style pour l'action primaire)

---

## 10. Ce qu'il ne faut JAMAIS faire

- ❌ Utiliser une autre police que Plus Jakarta Sans
- ❌ Créer une couleur primaire différente de #003FB1 pour les interactions
- ❌ Mettre du `border-radius` inférieur à 8px sur les cartes
- ❌ Utiliser des gradients décoratifs (sauf très rarement pour des images de fond non-critiques)
- ❌ Mélanger des icônes de librairies différentes (pas de FontAwesome, pas de Heroicons)
- ❌ Utiliser `font-weight: 900` (non supporté par Plus Jakarta Sans)
- ❌ Des ombres noires brutes (`box-shadow: 0 4px 8px rgba(0,0,0,0.3)`) — toujours teinter avec la couleur du contexte
- ❌ Border-radius < 9999px sur les boutons CTA principaux

---

## 11. Composants de gamification — Système Zora

Le système Zora est le moteur de récompense santé de Bolamu. Ses composants visuels ont
une identité distincte : couleur orange brand (#FF6B35), ton chaleureux et motivant,
jamais froid ni clinique. Ces composants apparaissent dans les dashboards patient,
les pages de prévention Elonga, et les interfaces B2B Bolamu Wellness.

### Palette Zora (tokens dédiés)

```css
--zora-primary:    #FF6B35;   /* orange principal */
--zora-light:      rgba(255, 107, 53, 0.10);  /* fond badge / pill */
--zora-glow:       rgba(255, 107, 53, 0.20);  /* ombre bouton */
--zora-gold:       #F5A623;   /* jaune-or pour étoiles et rangs élevés */
--zora-navy-bg:    #0A2463;   /* fond carte sombre Zora (contraste fort) */
```

### Composant : Zora Balance Card

Carte principale affichant le solde de points Zora d'un utilisateur.

```html
<div class="zora-balance-card">
  <div class="zora-balance-card__header">
    <span class="material-symbols-outlined" style="font-variation-settings:'FILL' 1; color:#FF6B35; font-size:28px;">stars</span>
    <span class="zora-balance-card__label">Vos Zora</span>
  </div>
  <div class="zora-balance-card__amount">
    <span class="zora-balance-card__number">1 250</span>
    <span class="zora-balance-card__unit">pts</span>
  </div>
  <div class="zora-balance-card__sub">≈ 1 250 FCFA échangeables</div>
  <div class="zora-balance-card__bar-wrap">
    <div class="zora-balance-card__bar" style="--progress: 62%"></div>
  </div>
  <div class="zora-balance-card__bar-labels">
    <span>0</span>
    <span>Prochain niveau : 2 000 pts</span>
  </div>
</div>
```

```css
.zora-balance-card {
  background: #0A2463;
  border-radius: 24px;
  padding: 24px;
  color: #ffffff;
  position: relative;
  overflow: hidden;
}
.zora-balance-card::before {
  content: '';
  position: absolute;
  top: -40px; right: -40px;
  width: 160px; height: 160px;
  background: rgba(255, 107, 53, 0.12);
  border-radius: 50%;
  pointer-events: none;
}
.zora-balance-card__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}
.zora-balance-card__label {
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: rgba(255,255,255,0.6);
}
.zora-balance-card__amount {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 4px;
}
.zora-balance-card__number {
  font-size: 2.5rem;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: -0.02em;
}
.zora-balance-card__unit {
  font-size: 1rem;
  font-weight: 600;
  color: rgba(255,255,255,0.5);
}
.zora-balance-card__sub {
  font-size: 0.75rem;
  color: #00C9A7;
  font-weight: 600;
  margin-bottom: 20px;
}
.zora-balance-card__bar-wrap {
  background: rgba(255,255,255,0.10);
  border-radius: 9999px;
  height: 6px;
  margin-bottom: 8px;
}
.zora-balance-card__bar {
  height: 100%;
  width: var(--progress, 0%);
  background: #FF6B35;
  border-radius: 9999px;
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}
.zora-balance-card__bar-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.625rem;
  font-weight: 700;
  color: rgba(255,255,255,0.4);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
```

### Composant : Zora Activity Item

Ligne d'historique d'une action récompensée (check-up, marche, dépistage...).

```html
<div class="zora-activity">
  <div class="zora-activity__icon">
    <span class="material-symbols-outlined">directions_walk</span>
  </div>
  <div class="zora-activity__info">
    <span class="zora-activity__title">10 000 pas atteints</span>
    <span class="zora-activity__date">Aujourd'hui, 07h32</span>
  </div>
  <div class="zora-activity__points">+25 pts</div>
</div>
```

```css
.zora-activity {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
  border-radius: 16px;
  background: #ffffff;
  border: 1px solid #C3C5D7;
  transition: border-color 0.2s ease;
}
.zora-activity:hover { border-color: #FF6B35; }
.zora-activity__icon {
  width: 40px; height: 40px;
  border-radius: 12px;
  background: rgba(255, 107, 53, 0.10);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  color: #FF6B35;
}
.zora-activity__icon .material-symbols-outlined { font-size: 20px; }
.zora-activity__info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.zora-activity__title {
  font-size: 0.875rem;
  font-weight: 700;
  color: #191B23;
}
.zora-activity__date {
  font-size: 0.75rem;
  color: #434654;
  font-weight: 500;
}
.zora-activity__points {
  font-size: 0.875rem;
  font-weight: 800;
  color: #FF6B35;
  white-space: nowrap;
}
```

### Composant : Zora Challenge Card

Carte défi avec progression et récompense promise.

```html
<div class="zora-challenge">
  <div class="zora-challenge__top">
    <div class="zora-challenge__badge">Défi semaine</div>
    <div class="zora-challenge__reward">
      <span class="material-symbols-outlined" style="font-variation-settings:'FILL' 1; font-size:14px; color:#F5A623;">star</span>
      +150 pts
    </div>
  </div>
  <h4 class="zora-challenge__title">Marcher 70 000 pas cette semaine</h4>
  <div class="zora-challenge__progress-wrap">
    <div class="zora-challenge__progress-bar" style="--prog: 45%"></div>
  </div>
  <div class="zora-challenge__progress-labels">
    <span>31 500 / 70 000 pas</span>
    <span>45%</span>
  </div>
</div>
```

```css
.zora-challenge {
  background: #ffffff;
  border: 1px solid #C3C5D7;
  border-radius: 20px;
  padding: 20px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.zora-challenge:hover {
  border-color: #FF6B35;
  box-shadow: 0 8px 24px rgba(255, 107, 53, 0.10);
  transform: translateY(-2px);
}
.zora-challenge__top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.zora-challenge__badge {
  background: rgba(255, 107, 53, 0.10);
  color: #FF6B35;
  font-size: 0.625rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 3px 10px;
  border-radius: 9999px;
}
.zora-challenge__reward {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  font-weight: 800;
  color: #F5A623;
}
.zora-challenge__title {
  font-size: 0.9375rem;
  font-weight: 700;
  color: #0A2463;
  margin-bottom: 16px;
  line-height: 1.4;
}
.zora-challenge__progress-wrap {
  background: #EDEDF8;
  border-radius: 9999px;
  height: 8px;
  margin-bottom: 8px;
  overflow: hidden;
}
.zora-challenge__progress-bar {
  height: 100%;
  width: var(--prog, 0%);
  background: linear-gradient(90deg, #FF6B35, #F5A623);
  border-radius: 9999px;
  transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}
.zora-challenge__progress-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  font-weight: 600;
  color: #434654;
}
```

### Composant : Niveau / Rang Elonga

Badge de rang affiché sur le profil patient et le dashboard Wellness B2B.

```html
<div class="elonga-rank">
  <div class="elonga-rank__icon">
    <span class="material-symbols-outlined" style="font-variation-settings:'FILL' 1;">workspace_premium</span>
  </div>
  <div>
    <div class="elonga-rank__name">Rang Or</div>
    <div class="elonga-rank__sub">Top 15% des membres actifs</div>
  </div>
</div>
```

```css
.elonga-rank {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background: rgba(245, 166, 35, 0.10);
  border: 1px solid rgba(245, 166, 35, 0.30);
  border-radius: 14px;
  padding: 10px 16px;
}
.elonga-rank__icon {
  color: #F5A623;
  font-size: 24px;
  display: flex;
}
.elonga-rank__name {
  font-size: 0.875rem;
  font-weight: 800;
  color: #0A2463;
}
.elonga-rank__sub {
  font-size: 0.6875rem;
  font-weight: 600;
  color: #434654;
}
```

### Règles d'usage des composants Zora

- La Zora Balance Card apparaît **toujours en haut** du dashboard patient, avant les autres widgets
- Les Activity Items sont listés du plus récent au plus ancien, max 5 visibles sans scroll
- Les Challenge Cards s'affichent par groupes de 2 (grille 2 colonnes sur desktop, 1 sur mobile)
- Le rang Elonga s'affiche sur le profil utilisateur et dans le résumé Wellness RH (agrégé équipe)
- Le gradient `linear-gradient(90deg, #FF6B35, #F5A623)` est autorisé **uniquement** sur les barres de progression Zora — c'est la seule exception à la règle no-gradient du design system
- Les points s'affichent toujours avec un espace comme séparateur de milliers : `1 250 pts` (jamais `1250pts`)
- Sur fond navy (#0A2463), les accents Zora restent orange (#FF6B35) et turquoise (#00C9A7) — jamais blanc pur pour les highlights

## 12. Couleurs d'identité par rôle

Ces tokens CSS sont définis dans `public/css/bolamu-ds.css` et réservés à l'identité visuelle de chaque dashboard métier (cartes principales, accents, hover footer). Elles ne remplacent PAS les couleurs de marque globales (navy/turquoise/primary/rouge/amber/zora-gold) utilisées pour les éléments transverses (boutons d'action, alertes, Zora).

```css
/* Couleurs de rôles — public/css/bolamu-ds.css */
--role-patient: #00C9A7;    /* turquoise — identité patient */
--role-medecin: #2E86FF;   /* bleu — identité médecin */
--role-secretaire: #9333EA; /* violet — identité secrétaire */
--role-pharmacie: #10B981;  /* vert — identité pharmacie */
--role-labo: #F59E0B;      /* orange — identité laboratoire */
--role-admin: #6B7280;     /* gris — identité admin */
--role-rh: #EC4899;        /* rose — identité RH */
--role-agence: #7C3AED;    /* violet clair — identité agence */
```

**Usage autorisé** :
- Cartes principales du dashboard (fond, bordure hover)
- Accents visuels spécifiques au rôle (badges, pills)
- Hover des liens dans le footer allégé

**Usage interdit** :
- Boutons d'action principaux (utiliser `--primary` ou `.btn-primary`)
- Alertes et notifications (utiliser `--rouge`, `--amber`, `--turquoise`)
- Composants Zora (utiliser palette dédiée `--zora-*`)
- Éléments transverses multi-rôles (utiliser couleurs marque globales)

---

## 13. Logo officiel

- **Fichier** : `/images/landing/bolamu-logo-final.png`
- **Description** : Rond bleu (#003FB1) avec lettre B blanche et feuille turquoise (#00C9A7) en haut à droite
- **Usage navbar** : `<img src="/images/landing/bolamu-logo-final.png" class="h-12 w-12 object-contain rounded-full" alt="Bolamu">`
- **Usage footer** : idem, sans classe transition
- **Taille standard** : 48×48px (h-12 w-12) sur navbar et footer
- **Ne jamais** utiliser `01-logo-navbar.png` ou `23-logo-footer.png` — ces fichiers sont obsolètes
- **rounded-full** obligatoire sur toutes les instances pour respecter la forme circulaire du logo
