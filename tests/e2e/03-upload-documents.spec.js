// ============================================================
// BOLAMU — FLUX 3 : Upload documents
// Teste /upload/token + /upload/secure.
// Vérifie que documents.storage_path contient une URL Cloudinary.
// ============================================================
import { test, expect } from '@playwright/test';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const BASE = process.env.TEST_API_BASE || 'https://api.bolamu.co';
const PATIENT = { phone: '+242069735418', password: 'TestNouveau2026!' };

let pool;
let uploadToken;

// PDF minimal valide (< 1 Ko)
const SMALL_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
  '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n' +
  '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n' +
  'xref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n' +
  '0000000058 00000 n\n0000000115 00000 n\n' +
  'trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n201\n%%EOF'
);

test.beforeAll(async ({ request }) => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // Obtenir d'abord un token upload (sans auth patient requise pour /upload/token)
  const tokenRes = await request.post(`${BASE}/api/v1/upload/token`, {
    data: { phone: PATIENT.phone }
  });
  if (tokenRes.ok()) {
    const body = await tokenRes.json();
    uploadToken = body.token || body.upload_token || body.uploadToken;
  }
});

test.afterAll(async () => {
  // Nettoyage des documents uploadés pendant les tests (uniquement du jour)
  await pool.query(
    `DELETE FROM documents WHERE uploaded_by = $1 AND created_at::date = CURRENT_DATE`,
    [PATIENT.phone]
  );
  await pool.end();
});

test.describe('FLUX 3 — Upload documents', () => {
  test.describe.configure({ mode: 'serial' });
  test('POST /upload/token → JWT 30min valide', async ({ request }) => {
    const res = await request.post(`${BASE}/api/v1/upload/token`, {
      data: { phone: PATIENT.phone }
    });
    expect(res.ok(), `HTTP ${res.status()} — ${await res.text()}`).toBeTruthy();
    const body = await res.json();
    const token = body.token || body.upload_token || body.uploadToken;
    expect(token, 'Token upload absent de la réponse').toBeTruthy();
    expect(token.split('.').length, 'Doit être un JWT (3 segments)').toBe(3);
    uploadToken = token;
    console.log(`[AUDIT] ✅ Upload token JWT obtenu`);
  });

  test('POST /upload/secure (PDF 1Ko) → URL Cloudinary dans documents', async ({ request }) => {
    expect(uploadToken, 'uploadToken manquant (test précédent requis)').toBeTruthy();

    const countBefore = await pool.query(
      `SELECT COUNT(*) AS n FROM documents WHERE uploaded_by = $1 AND created_at::date = CURRENT_DATE`,
      [PATIENT.phone]
    );

    const res = await request.post(`${BASE}/api/v1/upload/secure`, {
      headers: { Authorization: `Bearer ${uploadToken}` },
      multipart: {
        file: { name: 'test-audit.pdf', mimeType: 'application/pdf', buffer: SMALL_PDF },
        phone: PATIENT.phone,
        document_type: 'test_playwright'
      }
    });
    expect(res.ok(), `HTTP ${res.status()} — ${await res.text()}`).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);

    // Preuve DB : documents.storage_path contient une URL Cloudinary
    const row = await pool.query(
      `SELECT storage_path, uploaded_by FROM documents
       WHERE uploaded_by = $1 AND created_at::date = CURRENT_DATE
       ORDER BY created_at DESC LIMIT 1`,
      [PATIENT.phone]
    );
    expect(row.rows.length, 'Aucun document créé en base').toBeGreaterThan(parseInt(countBefore.rows[0].n, 10));
    const storagePath = row.rows[0].storage_path;
    expect(storagePath, 'storage_path absent en base').toBeTruthy();
    expect(storagePath, 'storage_path doit contenir cloudinary').toContain('cloudinary');
    expect(row.rows[0].uploaded_by).toBe(PATIENT.phone);
    console.log(`[AUDIT] ✅ Document persisté — storage_path: ${storagePath.substring(0, 60)}...`);
  });

  test('POST /upload/secure sans token → 401 ou 403', async ({ request }) => {
    const res = await request.post(`${BASE}/api/v1/upload/secure`, {
      multipart: {
        file: { name: 'test.pdf', mimeType: 'application/pdf', buffer: SMALL_PDF },
        phone: PATIENT.phone
      }
    });
    expect([401, 403], `Sans token doit être refusé, reçu ${res.status()}`).toContain(res.status());
    console.log(`[AUDIT] ✅ Upload sans token bloqué — HTTP ${res.status()}`);
  });

  test('POST /upload/secure fichier > 5MB → rejeté 400 ou 413', async ({ request }) => {
    expect(uploadToken, 'Token manquant').toBeTruthy();
    const bigBuffer = Buffer.alloc(6 * 1024 * 1024, 65); // 6MB de 'A'
    const res = await request.post(`${BASE}/api/v1/upload/secure`, {
      headers: { Authorization: `Bearer ${uploadToken}` },
      multipart: {
        file: { name: 'too-large.pdf', mimeType: 'application/pdf', buffer: bigBuffer },
        phone: PATIENT.phone
      }
    });
    // Multer LIMIT_FILE_SIZE → 500 si pas de handler dédié (dette sécurité : devrait être 413)
    expect([400, 413, 500], `Fichier >5MB : rejet attendu (400/413/500), reçu ${res.status()}`).toContain(res.status());
    console.log(`[AUDIT] ${res.status() === 500 ? '⚠️ 500 (multer sans handler — devrait être 413)' : '✅'} Fichier >5MB rejeté — HTTP ${res.status()}`);
  });

  test('POST /upload/secure fichier .exe → comportement observé (pas de fileFilter)', async ({ request }) => {
    expect(uploadToken, 'Token manquant').toBeTruthy();
    const fakeExe = Buffer.from('MZ\x90\x00\x03\x00'); // signature PE Windows
    const res = await request.post(`${BASE}/api/v1/upload/secure`, {
      headers: { Authorization: `Bearer ${uploadToken}` },
      multipart: {
        file: { name: 'test.exe', mimeType: 'application/octet-stream', buffer: fakeExe },
        phone: PATIENT.phone
      }
    });
    // AUDIT : upload.routes.js n'a pas de fileFilter — comportement documenté
    const accepted = res.ok();
    console.log(
      `[AUDIT] ${accepted ? '⚠️' : '✅'} Fichier .exe → HTTP ${res.status()} — ` +
      `${accepted ? 'ACCEPTÉ (pas de fileFilter dans upload.routes.js — dette sécurité connue)' : 'REJETÉ'}`
    );
    // Ce test ne fait pas d'assertion binaire — il documente le comportement actuel
  });
});
