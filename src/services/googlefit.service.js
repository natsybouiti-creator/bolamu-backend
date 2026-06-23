// ============================================================
// BOLAMU — Sprint 2 : Google Fit Service
// ============================================================
const { google } = require('googleapis');
const pool = require('../config/db');
const { normalizePhone } = require('../utils/phone');
const logger = require('../config/logger');

// Scopes Google Fit requis
const FITNESS_SCOPES = [
  'https://www.googleapis.com/auth/fitness.activity.read',
  'https://www.googleapis.com/auth/fitness.sleep.read',
  'https://www.googleapis.com/auth/fitness.heart_rate.read',
  'https://www.googleapis.com/auth/fitness.body.read'
];

/**
 * Initialiser le client OAuth2
 */
function initOAuthClient() {
  const clientId = process.env.GOOGLE_FIT_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_FIT_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_FIT_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('GOOGLE_FIT_CLIENT_ID, GOOGLE_FIT_CLIENT_SECRET et GOOGLE_FIT_REDIRECT_URI requis dans .env');
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Générer l'URL d'authentification OAuth Google
 * @param {string} patientPhone - Numéro du patient
 * @returns {string} URL OAuth
 */
function getAuthUrl(patientPhone) {
  const normalizedPhone = normalizePhone(patientPhone);
  const oauth2Client = initOAuthClient();

  const state = Buffer.from(normalizedPhone).toString('base64');

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: FITNESS_SCOPES,
    state: state,
    prompt: 'consent'
  });

  return authUrl;
}

/**
 * Échanger le code OAuth contre des tokens
 * @param {string} code - Code OAuth retourné par Google
 * @param {string} state - State décodé (patient_phone en base64)
 * @returns {Promise<Object>} Tokens
 */
async function exchangeCode(code, state) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const patientPhone = normalizePhone(Buffer.from(state, 'base64').toString('utf8'));

    const oauth2Client = initOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);

    const tokenExpiry = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600 * 1000);

    await client.query(
      `INSERT INTO google_fit_tokens (patient_phone, access_token, refresh_token, token_expiry, scope, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (patient_phone) DO UPDATE SET
         access_token = EXCLUDED.access_token,
         refresh_token = COALESCE(EXCLUDED.refresh_token, google_fit_tokens.refresh_token),
         token_expiry = EXCLUDED.token_expiry,
         scope = EXCLUDED.scope,
         updated_at = NOW()`,
      [patientPhone, tokens.access_token, tokens.refresh_token, tokenExpiry, tokens.scope]
    );

    await client.query(
      `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
       VALUES ('google_fit_connected', $1, 'google_fit_tokens', NULL, $2::jsonb)`,
      [patientPhone, JSON.stringify({ scope: tokens.scope })]
    );

    await client.query('COMMIT');

    logger.info(`[GOOGLE FIT] Patient ${patientPhone} connecte`);

    return { success: true, patient_phone: patientPhone };
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('[GOOGLE FIT] Erreur exchangeCode:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Rafraîchir le token si nécessaire (expiré dans moins de 5 minutes)
 * @param {string} patientPhone - Numéro du patient
 * @returns {Promise<Object>} OAuth2Client avec token valide
 */
async function refreshTokenIfNeeded(patientPhone) {
  const normalizedPhone = normalizePhone(patientPhone);

  const result = await pool.query(
    'SELECT access_token, refresh_token, token_expiry FROM google_fit_tokens WHERE patient_phone = $1',
    [normalizedPhone]
  );

  if (result.rows.length === 0) {
    throw new Error('Google Fit non connecte pour ce patient');
  }

  const tokenData = result.rows[0];
  const now = new Date();
  const expiry = new Date(tokenData.token_expiry);
  const fiveMinutes = 5 * 60 * 1000;

  if (expiry.getTime() - now.getTime() > fiveMinutes) {
    const oauth2Client = initOAuthClient();
    oauth2Client.setCredentials({ access_token: tokenData.access_token });
    return oauth2Client;
  }

  const oauth2Client = initOAuthClient();
  oauth2Client.setCredentials({
    refresh_token: tokenData.refresh_token
  });

  const { credentials } = await oauth2Client.refreshAccessToken();

  const newExpiry = credentials.expiry_date
    ? new Date(credentials.expiry_date)
    : new Date(Date.now() + 3600 * 1000);

  await pool.query(
    `UPDATE google_fit_tokens
     SET access_token = $1, token_expiry = $2, updated_at = NOW()
     WHERE patient_phone = $3`,
    [credentials.access_token, newExpiry, normalizedPhone]
  );

  logger.info(`[GOOGLE FIT] Token rafraichi pour ${normalizedPhone}`);

  return oauth2Client;
}

/**
 * Synchroniser les données Google Fit d'un patient (6 dernières heures)
 * @param {string} patientPhone - Numéro du patient
 * @returns {Promise<Object>} Résultat de la sync
 */
async function syncPatientData(patientPhone) {
  const normalizedPhone = normalizePhone(patientPhone);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const oauth2Client = await refreshTokenIfNeeded(normalizedPhone);
    const fitness = google.fitness({ version: 'v1', auth: oauth2Client });

    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    const stepsDataSourceId = 'derived:com.google.step_count.delta:com.google.android.gms:estimated_steps';
    const distanceDataSourceId = 'derived:com.google.distance.delta:com.google.android.gms:merge_distance_delta';
    const caloriesDataSourceId = 'derived:com.google.calories.expended:com.google.android.gms:merge_calories_expended';

    const stepsResponse = await fitness.users.dataset.aggregate({
      userId: 'me',
      requestBody: {
        aggregateBy: [{ dataTypeName: 'com.google.step_count.delta', dataSourceId: stepsDataSourceId }],
        startTimeMillis: new Date(sixHoursAgo).getTime(),
        endTimeMillis: new Date(now).getTime()
      }
    });

    const distanceResponse = await fitness.users.dataset.aggregate({
      userId: 'me',
      requestBody: {
        aggregateBy: [{ dataTypeName: 'com.google.distance.delta', dataSourceId: distanceDataSourceId }],
        startTimeMillis: new Date(sixHoursAgo).getTime(),
        endTimeMillis: new Date(now).getTime()
      }
    });

    const caloriesResponse = await fitness.users.dataset.aggregate({
      userId: 'me',
      requestBody: {
        aggregateBy: [{ dataTypeName: 'com.google.calories.expended', dataSourceId: caloriesDataSourceId }],
        startTimeMillis: new Date(sixHoursAgo).getTime(),
        endTimeMillis: new Date(now).getTime()
      }
    });

    let stepsInserted = 0;
    let distanceInserted = 0;
    let caloriesInserted = 0;

    // Steps
    if (stepsResponse.data.bucket && stepsResponse.data.bucket.length > 0) {
      for (const bucket of stepsResponse.data.bucket) {
        if (bucket.dataset && bucket.dataset[0] && bucket.dataset[0].point) {
          for (const point of bucket.dataset[0].point) {
            if (point.value && point.value[0] && point.value[0].intVal) {
              const steps = point.value[0].intVal;
              const startTime = new Date(point.startTimeNanos / 1e6).toISOString();

              await client.query(
                `INSERT INTO wellness_logs (patient_phone, source, metric, value, unit, recorded_at, synced_at)
                 VALUES ($1, 'google_fit', 'steps', $2, 'steps', $3, NOW())
                 ON CONFLICT DO NOTHING`,
                [normalizedPhone, steps, startTime]
              );

              stepsInserted++;
            }
          }
        }
      }
    }

    // Distance
    if (distanceResponse.data.bucket && distanceResponse.data.bucket.length > 0) {
      for (const bucket of distanceResponse.data.bucket) {
        if (bucket.dataset && bucket.dataset[0] && bucket.dataset[0].point) {
          for (const point of bucket.dataset[0].point) {
            if (point.value && point.value[0] && point.value[0].fpVal) {
              const distance = point.value[0].fpVal;
              const startTime = new Date(point.startTimeNanos / 1e6).toISOString();

              await client.query(
                `INSERT INTO wellness_logs (patient_phone, source, metric, value, unit, recorded_at, synced_at)
                 VALUES ($1, 'google_fit', 'distance', $2, 'm', $3, NOW())
                 ON CONFLICT DO NOTHING`,
                [normalizedPhone, distance, startTime]
              );

              distanceInserted++;
            }
          }
        }
      }
    }

    // Calories
    if (caloriesResponse.data.bucket && caloriesResponse.data.bucket.length > 0) {
      for (const bucket of caloriesResponse.data.bucket) {
        if (bucket.dataset && bucket.dataset[0] && bucket.dataset[0].point) {
          for (const point of bucket.dataset[0].point) {
            if (point.value && point.value[0] && point.value[0].fpVal) {
              const calories = point.value[0].fpVal;
              const startTime = new Date(point.startTimeNanos / 1e6).toISOString();

              await client.query(
                `INSERT INTO wellness_logs (patient_phone, source, metric, value, unit, recorded_at, synced_at)
                 VALUES ($1, 'google_fit', 'calories', $2, 'kcal', $3, NOW())
                 ON CONFLICT DO NOTHING`,
                [normalizedPhone, calories, startTime]
              );

              caloriesInserted++;
            }
          }
        }
      }
    }

    await client.query(
      `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
       VALUES ('google_fit_sync', $1, 'wellness_logs', NULL, $2::jsonb)`,
      [normalizedPhone, JSON.stringify({
        steps_inserted: stepsInserted,
        distance_inserted: distanceInserted,
        calories_inserted: caloriesInserted,
        sync_range: `${sixHoursAgo} / ${now}`
      })]
    );

    await client.query('COMMIT');

    logger.info(`[GOOGLE FIT] Sync ${normalizedPhone} : ${stepsInserted} steps, ${distanceInserted} distance, ${caloriesInserted} calories insérés`);

    return { success: true, steps_inserted: stepsInserted, distance_inserted: distanceInserted, calories_inserted: caloriesInserted };
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('[GOOGLE FIT] Erreur syncPatientData:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  initOAuthClient,
  getAuthUrl,
  exchangeCode,
  refreshTokenIfNeeded,
  syncPatientData
};
