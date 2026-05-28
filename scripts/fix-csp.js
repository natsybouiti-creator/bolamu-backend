/**
 * fix-csp.js — Bolamu
 * Supprime tous les handlers inline (onclick, onsubmit, etc.)
 * des fichiers HTML statiques et les remplace par
 * un délégateur d'événements universel.
 * 
 * Usage : node scripts/fix-csp.js
 */

const fs = require('fs');
const path = require('path');

const HTML_DIR = path.join(__dirname, '..', 'public');

const HTML_FILES = [
  'pharmacie/dashboard.html',
  'laboratoire/dashboard.html',
  'medecin/dashboard.html',
  'patient/dashboard.html',
  'admin/dashboard.html',
  'admin/login.html',
  'admin/content.html',
  'urgence.html',
  'index.html',
  'cgu.html',
  'confidentialite.html',
];

// Tous les handlers inline à détecter
const INLINE_HANDLERS = [
  'onclick', 'onsubmit', 'oninput', 'onchange',
  'onkeyup', 'onkeydown', 'onfocus', 'onblur',
  'onmouseenter', 'onmouseleave', 'ondblclick',
];

// Collecte tous les onclick="fn(args)" trouvés dans les attributs HTML
// (pas dans les strings JS)
function extractInlineHandlers(content) {
  const handlers = [];
  // Regex pour trouver les handlers inline dans les attributs HTML
  // On cherche les patterns comme onclick="fn()" dans du vrai HTML (pas dans des strings JS)
  const htmlAttrRegex = /\bon(\w+)=["']([^"']+)["']/g;
  let match;
  while ((match = htmlAttrRegex.exec(content)) !== null) {
    handlers.push({
      full: match[0],
      event: match[1],
      handler: match[2],
    });
  }
  return handlers;
}

// Vérifie si un handler est dans un attribut HTML réel
// (pas dans une string JavaScript comme innerHTML = `...onclick="..."...`)
function isInHTMLContext(content, index) {
  // Cherche le contexte autour de l'index
  const before = content.substring(Math.max(0, index - 200), index);
  
  // Si on est dans un template literal JS (backtick), c'est du JS
  const backtickCount = (before.match(/`/g) || []).length;
  if (backtickCount % 2 !== 0) return false;
  
  // Si on est dans une string JS avec des quotes, c'est du JS
  const inJSString = /(?:innerHTML|outerHTML|insertAdjacentHTML)\s*[+]?=\s*[`'"]/.test(before);
  if (inJSString) return false;
  
  return true;
}

function processFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`  ⏭  Ignoré (absent) : ${path.basename(filePath)}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  // Collecte tous les handlers dans les vrais attributs HTML
  // (on exclut ceux dans les template strings JS)
  const collected = new Map(); // eventType -> Set of function calls
  
  // Pattern pour trouver les éléments HTML avec handlers inline
  // On cherche uniquement dans le HTML statique, pas dans les strings JS
  
  // Stratégie : on analyse ligne par ligne
  const lines = content.split('\n');
  const handlerMap = new Map();
  
  lines.forEach((line, lineIdx) => {
    // Détecter si on est dans un bloc JS (simplifié)
    // Les vraies lignes HTML contiennent < et >
    const isLikelyHTML = line.trim().startsWith('<') || 
                          line.includes('onclick=') && !line.trim().startsWith('//') &&
                          !line.includes('innerHTML') && !line.includes('outerHTML');
    
    INLINE_HANDLERS.forEach(handler => {
      const regex = new RegExp(`\\b${handler}="([^"]+)"`, 'g');
      let match;
      while ((match = regex.exec(line)) !== null) {
        const fnCall = match[1];
        if (!handlerMap.has(handler)) handlerMap.set(handler, new Set());
        handlerMap.get(handler).add(fnCall);
      }
    });
  });

  // Compter les occurrences de handlers dans les vrais attributs HTML
  let totalFound = 0;
  INLINE_HANDLERS.forEach(h => {
    const regex = new RegExp(`\\b${h}="[^"]+"`, 'g');
    const matches = content.match(regex) || [];
    // Filtrer les faux positifs dans innerHTML/template strings
    const realMatches = matches.filter(m => {
      const idx = content.indexOf(m);
      return isInHTMLContext(content, idx);
    });
    totalFound += realMatches.length;
  });

  if (totalFound === 0) {
    console.log(`  ✅ Déjà propre : ${path.relative(HTML_DIR, filePath)}`);
    return;
  }

  // Remplacer les handlers inline dans les vrais attributs HTML
  // en les convertissant en data-attributes
  
  // 1. Pour les éléments simples sans arguments
  INLINE_HANDLERS.forEach(handler => {
    // Pattern : handler="nomFonction()" sans arguments
    const simpleRegex = new RegExp(`\\b${handler}="(\\w+)\\(\\)"`, 'g');
    content = content.replace(simpleRegex, (match, fn, offset) => {
      if (!isInHTMLContext(content, offset)) return match;
      return `data-on${handler}="${fn}"`;
    });
    
    // Pattern : handler="nomFonction(this)"
    const thisRegex = new RegExp(`\\b${handler}="(\\w+)\\(this\\)"`, 'g');
    content = content.replace(thisRegex, (match, fn, offset) => {
      if (!isInHTMLContext(content, offset)) return match;
      return `data-on${handler}="${fn}" data-self="true"`;
    });
  });

  // 2. Pour les onclick avec un seul argument string
  content = content.replace(/\bonclick="(\w+)\('([^']+)'\)"/g, (match, fn, arg, offset) => {
    if (!isInHTMLContext(content, offset)) return match;
    return `data-onclick="${fn}" data-arg="${arg}"`;
  });

  // 3. Pour les onclick avec un seul argument numérique ou variable
  content = content.replace(/\bonclick="(\w+)\(([^'"][^)]*)\)"/g, (match, fn, arg, offset) => {
    if (!isInHTMLContext(content, offset)) return match;
    return `data-onclick="${fn}" data-arg="${arg.trim()}"`;
  });

  // 4. Pour les onchange/oninput simples
  content = content.replace(/\bonchange="(\w+)\(\)"/g, (match, fn, offset) => {
    if (!isInHTMLContext(content, offset)) return match;
    return `data-onchange="${fn}"`;
  });
  
  content = content.replace(/\boninput="(\w+)\(\)"/g, (match, fn, offset) => {
    if (!isInHTMLContext(content, offset)) return match;
    return `data-oninput="${fn}"`;
  });

  // 5. Handlers restants non convertis → les laisser mais logger
  let remaining = 0;
  INLINE_HANDLERS.forEach(h => {
    const regex = new RegExp(`\\b${h}="[^"]+"`, 'g');
    const matches = content.match(regex) || [];
    remaining += matches.length;
  });

  // Ajouter le délégateur universel avant </body>
  const delegator = `
<script>
(function() {
  document.addEventListener('DOMContentLoaded', function() {
    document.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-onclick]');
      if (!btn) return;
      var fn = btn.getAttribute('data-onclick');
      var arg = btn.getAttribute('data-arg');
      if (typeof window[fn] === 'function') {
        if (arg !== null) {
          window[fn](arg);
        } else {
          window[fn]();
        }
      }
    });

    document.addEventListener('change', function(e) {
      var el = e.target.closest('[data-onchange]');
      if (!el) return;
      var fn = el.getAttribute('data-onchange');
      if (typeof window[fn] === 'function') window[fn]();
    });

    document.addEventListener('input', function(e) {
      var el = e.target.closest('[data-oninput]');
      if (!el) return;
      var fn = el.getAttribute('data-oninput');
      if (typeof window[fn] === 'function') window[fn]();
    });

    document.addEventListener('submit', function(e) {
      var form = e.target.closest('[data-onsubmit]');
      if (!form) return;
      e.preventDefault();
      var fn = form.getAttribute('data-onsubmit');
      if (typeof window[fn] === 'function') window[fn](e);
    });

    // Attacher les data-on* directs aux éléments
    document.querySelectorAll('[data-onclick]').forEach(function(el) {
      if (el.tagName !== 'BUTTON' && el.tagName !== 'A') return;
    });
  });
})();
</script>
`;

  // Insérer le délégateur avant </body>
  if (content.includes('</body>')) {
    content = content.replace('</body>', delegator + '\n</body>');
  } else {
    content += delegator;
  }

  // Sauvegarder
  fs.writeFileSync(filePath, content, 'utf8');
  
  const changed = content !== originalContent;
  console.log(`  ${changed ? '🔧' : '✅'} ${path.relative(HTML_DIR, filePath)} — ${totalFound} handlers trouvés, ${remaining} restants`);
}

// Main
console.log('\n🔍 Bolamu CSP Fix — Suppression handlers inline\n');

HTML_FILES.forEach(file => {
  const filePath = path.join(HTML_DIR, file);
  processFile(filePath);
});

console.log('\n✅ Terminé. Vérifiez les fichiers puis :\n');
console.log('  git add public/');
console.log('  git commit -m "fix: CSP - supprimer handlers inline tous fichiers HTML"');
console.log('  git push origin main\n');