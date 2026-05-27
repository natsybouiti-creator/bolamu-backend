const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authMiddleware = require('../middleware/auth.middleware');
const cloudinary = require('../utils/cloudinary');
const PDFDocument = require('pdfkit');
const { normalizePhone } = require('../utils/phone');

// ================================================
// CANAL 1 — OVP BANCAIRE
// ================================================

// POST /api/v1/collecte/ovp/initier
// L'adhérent saisit ses coordonnées bancaires
// Le système génère le PDF OVP et le stocke sur Cloudinary
router.post('/ovp/initier', authMiddleware, async (req, res) => {
  try {
    const { nom_titulaire, numero_compte } = req.body;
    const phone = req.user.phone;

    if (!nom_titulaire || !numero_compte) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nom du titulaire et numéro de compte obligatoires.' 
      });
    }

    // Récupérer le plan actif de l'adhérent
    const subRes = await db.query(
      `SELECT plan, canal_paiement FROM subscriptions 
       WHERE patient_phone = $1 AND is_active = TRUE 
       ORDER BY created_at DESC LIMIT 1`,
      [phone]
    );

    if (!subRes.rows.length) {
      return res.status(400).json({ 
        success: false, 
        message: 'Aucun abonnement actif trouvé.' 
      });
    }

    const plan = subRes.rows[0].plan;

    // Récupérer le nombre de bénéficiaires existants
    const benRes = await db.query(
      `SELECT COUNT(*) as count FROM beneficiaires_familiaux 
       WHERE payeur_phone = $1 AND actif = TRUE`,
      [phone]
    );
    const nbBeneficiaires = parseInt(benRes.rows[0].count);

    // Calculer le montant total (2000 FCFA × personnes couvertes)
    const prixRes = await db.query(
      `SELECT config_value FROM platform_config 
       WHERE config_key = 'price_par_personne'`
    );
    const prixParPersonne = parseInt(prixRes.rows[0].config_value);
    const personnesRes = await db.query(
      `SELECT config_value FROM platform_config 
       WHERE config_key = $1`,
      [`plan_${plan}_personnes`]
    );
    const nbPersonnesPlan = parseInt(personnesRes.rows[0].config_value);
    const totalPersonnes = nbPersonnesPlan + nbBeneficiaires;
    const montantMensuel = totalPersonnes * prixParPersonne;

    // Générer le PDF OVP
    const pdfBuffer = await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // En-tête
      doc.fontSize(20).font('Helvetica-Bold')
         .text('ORDRE DE VIREMENT PERMANENT', { align: 'center' });
      doc.fontSize(12).font('Helvetica')
         .text('Bolamu — Plateforme de Santé Numérique', { align: 'center' });
      doc.moveDown(2);

      // Informations du donneur d'ordre
      doc.fontSize(14).font('Helvetica-Bold').text('DONNEUR D\'ORDRE');
      doc.fontSize(11).font('Helvetica');
      doc.text(`Nom et Prénom : ${nom_titulaire}`);
      doc.text(`Numéro de compte Ecobank : ${numero_compte}`);
      doc.text(`Téléphone : ${phone}`);
      doc.moveDown();

      // Informations du bénéficiaire (Bolamu)
      doc.fontSize(14).font('Helvetica-Bold').text('BÉNÉFICIAIRE');
      doc.fontSize(11).font('Helvetica');
      doc.text('Nom : NBA Gestion SARLU — Bolamu');
      doc.text('Banque : Ecobank Congo');
      doc.text('Objet : Cotisation mensuelle Bolamu');
      doc.moveDown();

      // Montant et fréquence
      doc.fontSize(14).font('Helvetica-Bold').text('DÉTAILS DU VIREMENT');
      doc.fontSize(11).font('Helvetica');
      doc.text(`Plan : ${plan.toUpperCase()}`);
      doc.text(`Personnes couvertes : ${totalPersonnes}`);
      doc.text(`Montant mensuel : ${montantMensuel.toLocaleString()} FCFA`);
      doc.text('Fréquence : Mensuelle — le 1er de chaque mois');
      doc.text('Durée : Jusqu\'à révocation');
      doc.moveDown(2);

      // Zone de signature
      doc.fontSize(14).font('Helvetica-Bold').text('AUTORISATION');
      doc.fontSize(11).font('Helvetica');
      doc.text('Je soussigné(e) autorise Ecobank Congo à débiter mon compte ' +
               'du montant ci-dessus au profit de NBA Gestion SARLU — Bolamu, ' +
               'le 1er de chaque mois jusqu\'à révocation écrite.');
      doc.moveDown(2);
      doc.text('Fait à Brazzaville, le : _______________');
      doc.moveDown();
      doc.text('Signature : _______________');

      doc.end();
    });

    // Upload sur Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { 
          resource_type: 'raw',
          folder: 'bolamu/ovp',
          public_id: `ovp_${phone}_${Date.now()}`,
          format: 'pdf'
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(pdfBuffer);
    });

    // Sauvegarder dans ovp_documents
    await db.query(
      `INSERT INTO ovp_documents 
       (user_phone, nom_titulaire, numero_compte, montant_mensuel, 
        nombre_beneficiaires, montant_total, pdf_url, pdf_public_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT DO NOTHING`,
      [phone, nom_titulaire, numero_compte, montantMensuel,
       nbBeneficiaires, montantMensuel, 
       uploadResult.secure_url, uploadResult.public_id]
    );

    // Mettre à jour le statut collecte dans subscriptions
    await db.query(
      `UPDATE subscriptions 
       SET canal_paiement = 'ovp_bancaire', 
           statut_collecte = 'en_attente_ovp',
           updated_at = NOW()
       WHERE patient_phone = $1 AND is_active = TRUE`,
      [phone]
    );

    // Log audit
    await db.query(
      `INSERT INTO audit_log 
       (event_type, actor_phone, target_table, target_id, payload)
       VALUES ('ovp_initie', $1, 'ovp_documents', $1, $2)`,
      [phone, JSON.stringify({ montant: montantMensuel, plan })]
    );

    return res.json({
      success: true,
      message: 'Formulaire OVP généré avec succès.',
      pdf_url: uploadResult.secure_url,
      montant_mensuel: montantMensuel,
      personnes_couvertes: totalPersonnes
    });

  } catch (err) {
    console.error('[OVP INITIER]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// GET /api/v1/collecte/ovp/statut
// Statut OVP de l'adhérent connecté
router.get('/ovp/statut', authMiddleware, async (req, res) => {
  try {
    const phone = req.user.phone;
    const result = await db.query(
      `SELECT statut, pdf_url, montant_total, created_at, validated_at
       FROM ovp_documents WHERE user_phone = $1 
       ORDER BY created_at DESC LIMIT 1`,
      [phone]
    );
    if (!result.rows.length) {
      return res.json({ success: true, ovp: null });
    }
    return res.json({ success: true, ovp: result.rows[0] });
  } catch (err) {
    console.error('[OVP STATUT]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// ================================================
// CANAL 2 — MOMO ANNUEL
// ================================================

// POST /api/v1/collecte/momo/initier
// Déclenche un paiement MoMo annuel
router.post('/momo/initier', authMiddleware, async (req, res) => {
  try {
    const { plan } = req.body;
    const phone = req.user.phone;

    if (!plan || !['essentiel', 'standard', 'premium'].includes(plan)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Plan invalide.' 
      });
    }

    // Lire le montant annuel depuis platform_config
    const configRes = await db.query(
      `SELECT config_value FROM platform_config 
       WHERE config_key = $1`,
      [`price_${plan}_annual`]
    );
    if (!configRes.rows.length) {
      return res.status(400).json({ 
        success: false, 
        message: 'Configuration plan introuvable.' 
      });
    }
    const montant = parseInt(configRes.rows[0].config_value);

    // Créer la transaction en attente
    const ref = `BOL-MOMO-${phone}-${Date.now()}`;
    await db.query(
      `INSERT INTO payments 
       (patient_phone, amount_fcfa, payment_method, status, reference, notes)
       VALUES ($1, $2, 'mtn_momo', 'pending', $3, $4)`,
      [phone, montant, ref, `Abonnement annuel ${plan}`]
    );

    return res.json({
      success: true,
      message: 'Transaction initiée. Procédez au paiement MoMo.',
      reference: ref,
      montant,
      plan,
      instructions: `Envoyez ${montant.toLocaleString()} FCFA via MTN MoMo avec la référence : ${ref}` 
    });

  } catch (err) {
    console.error('[MOMO ANNUEL INITIER]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// ================================================
// CANAL 3 — TIERS PAYANT FAMILIAL
// ================================================

// POST /api/v1/collecte/familial/ajouter
// Ajouter un bénéficiaire familial
router.post('/familial/ajouter', authMiddleware, async (req, res) => {
  try {
    const { beneficiaire_phone } = req.body;
    const payeur_phone = req.user.phone;
    const benPhone = normalizePhone(beneficiaire_phone);

    if (!benPhone) {
      return res.status(400).json({ 
        success: false, 
        message: 'Numéro de téléphone invalide.' 
      });
    }

    if (benPhone === payeur_phone) {
      return res.status(400).json({ 
        success: false, 
        message: 'Vous ne pouvez pas vous ajouter comme bénéficiaire.' 
      });
    }

    // Vérifier que le bénéficiaire existe dans users
    const userRes = await db.query(
      `SELECT phone, full_name FROM users WHERE phone = $1`,
      [benPhone]
    );
    if (!userRes.rows.length) {
      return res.status(404).json({ 
        success: false, 
        message: 'Bénéficiaire introuvable. Il doit d\'abord créer un compte Bolamu.' 
      });
    }

    // Vérifier que le payeur a un OVP actif ou en attente
    const ovpRes = await db.query(
      `SELECT statut FROM ovp_documents 
       WHERE user_phone = $1 
       ORDER BY created_at DESC LIMIT 1`,
      [payeur_phone]
    );
    if (!ovpRes.rows.length || 
        !['genere','envoye','signe','valide'].includes(ovpRes.rows[0].statut)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Vous devez d\'abord initier votre OVP bancaire.' 
      });
    }

    // Ajouter le bénéficiaire
    await db.query(
      `INSERT INTO beneficiaires_familiaux (payeur_phone, beneficiaire_phone)
       VALUES ($1, $2)
       ON CONFLICT (payeur_phone, beneficiaire_phone) 
       DO UPDATE SET actif = TRUE`,
      [payeur_phone, benPhone]
    );

    // Lier le bénéficiaire au payeur dans users
    await db.query(
      `UPDATE users SET payeur_principal_id = 
       (SELECT id FROM users WHERE phone = $1)
       WHERE phone = $2`,
      [payeur_phone, benPhone]
    );

    // Log audit
    await db.query(
      `INSERT INTO audit_log 
       (event_type, actor_phone, target_table, target_id, payload)
       VALUES ('beneficiaire_ajoute', $1, 'beneficiaires_familiaux', $2, $3)`,
      [payeur_phone, benPhone, 
       JSON.stringify({ beneficiaire: benPhone })]
    );

    return res.json({
      success: true,
      message: `${userRes.rows[0].full_name} ajouté(e) comme bénéficiaire.`,
      beneficiaire: {
        phone: benPhone,
        nom: userRes.rows[0].full_name
      }
    });

  } catch (err) {
    console.error('[FAMILIAL AJOUTER]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// DELETE /api/v1/collecte/familial/retirer/:beneficiaire_phone
router.delete('/familial/retirer/:beneficiaire_phone', 
  authMiddleware, async (req, res) => {
  try {
    const payeur_phone = req.user.phone;
    const benPhone = normalizePhone(req.params.beneficiaire_phone);

    await db.query(
      `UPDATE beneficiaires_familiaux SET actif = FALSE
       WHERE payeur_phone = $1 AND beneficiaire_phone = $2`,
      [payeur_phone, benPhone]
    );

    await db.query(
      `UPDATE users SET payeur_principal_id = NULL WHERE phone = $1`,
      [benPhone]
    );

    return res.json({ 
      success: true, 
      message: 'Bénéficiaire retiré.' 
    });
  } catch (err) {
    console.error('[FAMILIAL RETIRER]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// GET /api/v1/collecte/familial/mes-beneficiaires
router.get('/familial/mes-beneficiaires', authMiddleware, async (req, res) => {
  try {
    const phone = req.user.phone;
    const result = await db.query(
      `SELECT bf.beneficiaire_phone, bf.actif, bf.created_at,
              u.full_name, u.is_active
       FROM beneficiaires_familiaux bf
       JOIN users u ON u.phone = bf.beneficiaire_phone
       WHERE bf.payeur_phone = $1
       ORDER BY bf.created_at ASC`,
      [phone]
    );
    return res.json({ 
      success: true, 
      beneficiaires: result.rows,
      total: result.rows.length
    });
  } catch (err) {
    console.error('[FAMILIAL LISTE]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// ================================================
// CANAL 4 — SEPA DIASPORA
// ================================================

// POST /api/v1/collecte/sepa/initier
router.post('/sepa/initier', authMiddleware, async (req, res) => {
  try {
    const { frequence, beneficiaires_phones, plan } = req.body;
    const phone = req.user.phone;

    if (!frequence || !['mensuel', 'annuel'].includes(frequence)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Fréquence invalide (mensuel ou annuel).' 
      });
    }

    if (!plan || !['essentiel', 'standard', 'premium'].includes(plan)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Plan invalide.' 
      });
    }

    // Lire le RIB France depuis platform_config
    const ribRes = await db.query(
      `SELECT config_value FROM platform_config 
       WHERE config_key = 'rib_france_qonto'`
    );
    const ribFrance = ribRes.rows[0]?.config_value || 'A_RENSEIGNER';

    // Calculer le montant selon fréquence
    const configKey = frequence === 'annuel' 
      ? `price_${plan}_annual` 
      : `price_${plan}`;
    const montantRes = await db.query(
      `SELECT config_value FROM platform_config WHERE config_key = $1`,
      [configKey]
    );
    const montantFcfa = parseInt(montantRes.rows[0].config_value);

    // Taux de change approximatif FCFA → EUR (1 EUR ≈ 655 FCFA)
    const tauxRes = await db.query(
      `SELECT config_value FROM platform_config 
       WHERE config_key = 'taux_change_eur_fcfa'`
    );
    const taux = tauxRes.rows?.length 
      ? parseFloat(tauxRes.rows[0].config_value) 
      : 655.957;
    const montantEur = (montantFcfa / taux).toFixed(2);

    // Normaliser les bénéficiaires
    const bens = (beneficiaires_phones || [])
      .map(p => normalizePhone(p))
      .filter(Boolean);

    // Créer la demande dans bank_transfer_requests
    const ref = `BOL-SEPA-${phone}-${Date.now()}`;
    await db.query(
      `INSERT INTO bank_transfer_requests 
       (reference, patient_phone, amount_fcfa, plan, status, 
        canal_type, frequence, beneficiaires_phones,
        destination_account_id)
       VALUES ($1, $2, $3, $4, 'pending', 
               'sepa_diaspora', $5, $6,
               'COMPTE_FRANCE_NBA')`,
      [ref, phone, montantFcfa, plan, frequence, bens]
    );

    // Mettre à jour statut collecte
    await db.query(
      `UPDATE subscriptions 
       SET canal_paiement = 'sepa_diaspora',
           statut_collecte = 'en_attente_sepa',
           updated_at = NOW()
       WHERE patient_phone = $1 AND is_active = TRUE`,
      [phone]
    );

    // Log audit
    await db.query(
      `INSERT INTO audit_log 
       (event_type, actor_phone, target_table, target_id, payload)
       VALUES ('sepa_initie', $1, 'bank_transfer_requests', $1, $2)`,
      [phone, JSON.stringify({ ref, montantFcfa, montantEur, frequence })]
    );

    return res.json({
      success: true,
      message: 'Dossier SEPA créé. Effectuez votre virement vers le compte ci-dessous.',
      reference: ref,
      rib_france: ribFrance,
      montant_fcfa: montantFcfa,
      montant_eur: parseFloat(montantEur),
      frequence,
      instructions: `Virement SEPA ${frequence} de ${montantEur}€ — Référence obligatoire : ${ref}` 
    });

  } catch (err) {
    console.error('[SEPA INITIER]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// ================================================
// ROUTES ADMIN
// ================================================

// GET /api/v1/collecte/admin/dashboard
router.get('/admin/dashboard', authMiddleware.requireAdmin, async (req, res) => {
  try {
    const [ovpPending, sepaPending, momoActifs, totalActifs] = 
      await Promise.all([
        db.query(
          `SELECT COUNT(*) as count FROM ovp_documents 
           WHERE statut = 'genere' OR statut = 'envoye'`
        ),
        db.query(
          `SELECT COUNT(*) as count FROM bank_transfer_requests 
           WHERE status = 'pending' AND canal_type = 'sepa_diaspora'`
        ),
        db.query(
          `SELECT COUNT(*) as count FROM subscriptions 
           WHERE canal_paiement = 'momo_annuel' 
           AND statut_collecte = 'actif'`
        ),
        db.query(
          `SELECT COUNT(*) as count FROM subscriptions 
           WHERE statut_collecte = 'actif'`
        )
      ]);

    return res.json({
      success: true,
      dashboard: {
        ovp_en_attente: parseInt(ovpPending.rows[0].count),
        sepa_en_attente: parseInt(sepaPending.rows[0].count),
        momo_actifs: parseInt(momoActifs.rows[0].count),
        total_actifs: parseInt(totalActifs.rows[0].count)
      }
    });
  } catch (err) {
    console.error('[ADMIN DASHBOARD]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// Alias historique: GET /api/v1/collecte/dashboard
router.get('/dashboard', authMiddleware.requireAdmin, async (req, res) => {
  try {
    const [ovpPending, sepaPending, momoActifs, totalActifs] =
      await Promise.all([
        db.query(
          `SELECT COUNT(*) as count FROM ovp_documents
           WHERE statut = 'genere' OR statut = 'envoye'`
        ),
        db.query(
          `SELECT COUNT(*) as count FROM bank_transfer_requests
           WHERE status = 'pending' AND canal_type = 'sepa_diaspora'`
        ),
        db.query(
          `SELECT COUNT(*) as count FROM subscriptions
           WHERE canal_paiement = 'momo_annuel'
           AND statut_collecte = 'actif'`
        ),
        db.query(
          `SELECT COUNT(*) as count FROM subscriptions
           WHERE statut_collecte = 'actif'`
        )
      ]);

    return res.json({
      success: true,
      dashboard: {
        ovp_en_attente: parseInt(ovpPending.rows[0].count),
        sepa_en_attente: parseInt(sepaPending.rows[0].count),
        momo_actifs: parseInt(momoActifs.rows[0].count),
        total_actifs: parseInt(totalActifs.rows[0].count)
      }
    });
  } catch (err) {
    console.error('[COLLECTE DASHBOARD]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// GET /api/v1/collecte/admin/ovp/pending
router.get('/admin/ovp/pending', authMiddleware.requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT
          o.user_phone as phone,
          s.plan,
          o.montant_total,
          o.created_at
       FROM ovp_documents o
       LEFT JOIN subscriptions s ON s.patient_phone = o.user_phone AND s.is_active = TRUE
       WHERE o.statut IN ('genere', 'envoye')
       ORDER BY o.created_at DESC`
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[OVP PENDING]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// GET /api/v1/collecte/admin/sepa/pending
router.get('/admin/sepa/pending', authMiddleware.requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT
          b.patient_phone as phone,
          b.plan,
          b.amount_fcfa,
          b.created_at
       FROM bank_transfer_requests b
       WHERE b.status = 'pending' AND b.canal_type = 'sepa_diaspora'
       ORDER BY b.created_at DESC`
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[SEPA PENDING]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// PATCH /api/v1/collecte/admin/ovp/valider/:user_phone
router.patch('/admin/ovp/valider/:user_phone', 
  authMiddleware.requireAdmin, async (req, res) => {
  try {
    const { user_phone } = req.params;
    const admin_phone = req.user.phone;

    // Valider l'OVP
    await db.query(
      `UPDATE ovp_documents SET statut = 'valide', 
       validated_at = NOW(), validated_by = $1
       WHERE user_phone = $2`,
      [admin_phone, user_phone]
    );

    // Activer l'adhérent
    await db.query(
      `UPDATE users SET is_active = TRUE WHERE phone = $1`,
      [user_phone]
    );

    // Activer tous ses bénéficiaires
    await db.query(
      `UPDATE users SET is_active = TRUE 
       WHERE phone IN (
         SELECT beneficiaire_phone FROM beneficiaires_familiaux 
         WHERE payeur_phone = $1 AND actif = TRUE
       )`,
      [user_phone]
    );

    // Mettre à jour statut collecte
    await db.query(
      `UPDATE subscriptions SET statut_collecte = 'actif', updated_at = NOW()
       WHERE patient_phone = $1`,
      [user_phone]
    );

    // Log audit
    await db.query(
      `INSERT INTO audit_log 
       (event_type, actor_phone, target_table, target_id, payload)
       VALUES ('ovp_valide', $1, 'ovp_documents', $2, $3)`,
      [admin_phone, user_phone, 
       JSON.stringify({ action: 'validation_ovp' })]
    );

    return res.json({ 
      success: true, 
      message: 'OVP validé. Adhérent et bénéficiaires activés.' 
    });
  } catch (err) {
    console.error('[OVP VALIDER]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// PATCH /api/v1/collecte/admin/sepa/valider/:user_phone
router.patch('/admin/sepa/valider/:user_phone', 
  authMiddleware.requireAdmin, async (req, res) => {
  try {
    const { user_phone } = req.params;
    const admin_phone = req.user.phone;

    // Valider la demande SEPA
    await db.query(
      `UPDATE bank_transfer_requests 
       SET status = 'reconciled', validated_by = $1, validated_at = NOW()
       WHERE patient_phone = $2 AND canal_type = 'sepa_diaspora' 
       AND status = 'pending'`,
      [admin_phone, user_phone]
    );

    // Activer l'adhérent et ses bénéficiaires
    await db.query(
      `UPDATE users SET is_active = TRUE WHERE phone = $1`,
      [user_phone]
    );
    await db.query(
      `UPDATE users SET is_active = TRUE 
       WHERE phone IN (
         SELECT beneficiaire_phone FROM beneficiaires_familiaux 
         WHERE payeur_phone = $1 AND actif = TRUE
       )`,
      [user_phone]
    );

    // Mettre à jour statut collecte
    await db.query(
      `UPDATE subscriptions SET statut_collecte = 'actif', updated_at = NOW()
       WHERE patient_phone = $1`,
      [user_phone]
    );

    // Log audit
    await db.query(
      `INSERT INTO audit_log 
       (event_type, actor_phone, target_table, target_id, payload)
       VALUES ('sepa_valide', $1, 'ovp_documents', $2, $3)`,
      [admin_phone, user_phone, 
       JSON.stringify({ action: 'validation_sepa' })]
    );

    return res.json({ 
      success: true, 
      message: 'Virement SEPA validé. Adhérent et bénéficiaires activés.' 
    });
  } catch (err) {
    console.error('[SEPA VALIDER]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// GET /api/v1/collecte/admin/ovp/fichier-mensuel
// Génère le fichier CSV pour remise à Ecobank Congo
router.get('/admin/ovp/fichier-mensuel', authMiddleware.requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT o.user_phone, o.nom_titulaire, o.numero_compte, 
              o.montant_total, u.full_name
       FROM ovp_documents o
       JOIN users u ON u.phone = o.user_phone
       WHERE o.statut = 'valide'
       ORDER BY o.user_phone`
    );

    if (!result.rows.length) {
      return res.json({ 
        success: true, 
        message: 'Aucun OVP validé ce mois.', 
        csv: '' 
      });
    }

    const csvLines = [
      'TELEPHONE;NOM_TITULAIRE;NUMERO_COMPTE;MONTANT_FCFA;DATE',
      ...result.rows.map(r => 
        `${r.user_phone};${r.nom_titulaire};${r.numero_compte};` +
        `${r.montant_total};${new Date().toISOString().split('T')[0]}` 
      )
    ];

    const csv = csvLines.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 
      `attachment; filename=ovp_mensuel_${new Date().toISOString().split('T')[0]}.csv` 
    );
    return res.send(csv);

  } catch (err) {
    console.error('[OVP FICHIER MENSUEL]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

module.exports = router;
