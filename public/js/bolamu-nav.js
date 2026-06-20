// ============================================================
// BOLAMU — Navigation Partagée
// ============================================================

/**
 * Bascule entre les panels (desktop)
 * @param {string} panelId - ID du panel à afficher
 */
function showPanel(panelId) {
  // Masquer tous les panels
  document.querySelectorAll('.panel').forEach(panel => {
    panel.classList.remove('active');
  });
  
  // Afficher le panel demandé
  const targetPanel = document.getElementById(panelId);
  if (targetPanel) {
    targetPanel.classList.add('active');
  }
  
  // Mettre à jour les onglets desktop
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.remove('active');
    if (tab.getAttribute('data-panel') === panelId) {
      tab.classList.add('active');
    }
  });
  
  // Mettre à jour la bottom-nav mobile
  document.querySelectorAll('.bnav-item').forEach(item => {
    item.classList.remove('active');
    if (item.getAttribute('data-panel') === panelId) {
      item.classList.add('active');
    }
  });
}

/**
 * Initialiser la navigation
 * Lie les événements aux onglets et bottom-nav
 */
function initNavigation() {
  // Onglets desktop
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const panelId = tab.getAttribute('data-panel');
      if (panelId) {
        showPanel(panelId);
      }
    });
  });
  
  // Bottom-nav mobile
  document.querySelectorAll('.bnav-item').forEach(item => {
    item.addEventListener('click', () => {
      const panelId = item.getAttribute('data-panel');
      if (panelId) {
        showPanel(panelId);
      }
    });
  });
}

/**
 * Définir le panel actif au chargement
 * @param {string} panelId - ID du panel par défaut
 */
function setDefaultPanel(panelId) {
  showPanel(panelId);
}

// Exporter les fonctions pour utilisation dans les dashboards
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { showPanel, initNavigation, setDefaultPanel };
}

// Auto-initialisation si chargé directement
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
  });
}
