// ============================================================
// BOLAMU — Service Triage Feu Tricolore (Sprint 9)
// ============================================================
const logger = require('../config/logger');

// Symptômes critiques (ROUGE)
const SYMPTOMES_ROUGE = [
    'douleur thoracique',
    'difficulté respiratoire',
    'perte de conscience',
    'paralysie',
    'convulsions',
    'saignement abondant',
    'traumatisme crânien',
    'douleur abdominale sévère',
    'fièvre > 40°C'
];

// Symptômes modérés (ORANGE)
const SYMPTOMES_ORANGE = [
    'fièvre 38-40°C',
    'douleur modérée',
    'vomissements',
    'diarrhée persistante',
    'infection visible',
    'symptômes depuis > 3 jours'
];

// Antécédents à risque
const ANTECEDENTS_RISQUE = [
    'cardiaque',
    'diabète',
    'hta',
    'hypertension'
];

// Calculer le triage feu tricolore
function calculerTriage(symptomes = [], intensite, duree_symptomes, antecedents) {
    let score = 0;
    const symptomesCritiquesDetectes = [];

    // Normaliser les symptômes en minuscules
    const symptomesNormalises = symptomes.map(s => s.toLowerCase());

    // Chaque symptôme rouge présent : +3 points
    SYMPTOMES_ROUGE.forEach(symptome => {
        if (symptomesNormalises.some(s => s.includes(symptome.toLowerCase()))) {
            score += 3;
            symptomesCritiquesDetectes.push(symptome);
        }
    });

    // Chaque symptôme orange présent : +2 points
    SYMPTOMES_ORANGE.forEach(symptome => {
        if (symptomesNormalises.some(s => s.includes(symptome.toLowerCase()))) {
            score += 2;
        }
    });

    // Intensite >= 8 : +2 points
    if (intensite >= 8) {
        score += 2;
    }

    // Durée > 7 jours : +1 point
    if (duree_symptomes && duree_symptomes.includes('> 7')) {
        score += 1;
    }

    // Antécédents cardiaques/diabète/HTA : +1 point
    if (antecedents) {
        const antecedentsLower = antecedents.toLowerCase();
        ANTECEDENTS_RISQUE.forEach(antecedent => {
            if (antecedentsLower.includes(antecedent)) {
                score += 1;
            }
        });
    }

    // Déterminer la couleur
    let couleur = 'vert';
    let recommandation = 'Consultation de routine possible';

    if (score >= 7) {
        couleur = 'rouge';
        recommandation = 'Consultez les urgences immédiatement';
    } else if (score >= 4) {
        couleur = 'orange';
        recommandation = 'Consultez un médecin dans les 24-48h';
    }

    logger.info('[Triage] Calcul triage', { score, couleur, symptomesCritiquesDetectes });

    return {
        couleur,
        score,
        recommandation,
        symptomes_critiques_detectes: symptomesCritiquesDetectes
    };
}

module.exports = {
    calculerTriage
};
