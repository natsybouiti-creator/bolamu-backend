// ============================================================
// Seed — 8 événements démo réels Brazzaville + Pointe-Noire
// Créés via le flux animateur normal (POST /api/v1/animateur/events)
// puis publiés via l'admin (PATCH /api/v1/events/:id/publish) —
// aucun INSERT SQL direct dans elonga_events.
// Script à titre de trace historique — événements déjà créés en
// prod le 15/07/2026 (IDs 68-75). Le relancer créerait des doublons.
// ============================================================
require('dotenv').config();
const jwt = require('jsonwebtoken');

const BASE_URL = 'https://www.bolamu.co';

const animateurToken = jwt.sign(
  { phone: '+242000000088', role: 'animateur', is_active: true, banned: false },
  process.env.JWT_SECRET,
  { expiresIn: '24h' }
);
const adminToken = jwt.sign(
  { phone: '+242060000099', role: 'admin', is_active: true, banned: false },
  process.env.JWT_SECRET,
  { expiresIn: '24h' }
);

const events = [
  {
    title: 'Marche sportive matinale',
    description: 'Marche collective matinale en bord de fleuve, ouverte à tous les niveaux.',
    pillar: 'activite',
    location_name: 'Côte du Djoué, Brazzaville',
    city: 'Brazzaville',
    latitude: -4.2830,
    longitude: 15.2730,
    starts_at: '2026-07-18T07:00:00',
    ends_at: '2026-07-18T09:00:00',
    zora_reward: 50,
    max_participants: 40,
    cover_image_path: '/images/landing/marche sport.png'
  },
  {
    title: 'Atelier nutrition et alimentation saine',
    description: "Conseils pratiques pour composer des repas équilibrés à partir de produits locaux.",
    pillar: 'nutrition',
    location_name: 'Centre Culturel, Poto-Poto, Brazzaville',
    city: 'Brazzaville',
    latitude: -4.2660,
    longitude: 15.2750,
    starts_at: '2026-07-19T15:00:00',
    ends_at: '2026-07-19T17:00:00',
    zora_reward: 40,
    max_participants: 25,
    cover_image_path: '/images/landing/plan-alimentaire.png'
  },
  {
    title: 'Séance de yoga et respiration',
    description: 'Séance collective de yoga doux et exercices de respiration guidée.',
    pillar: 'activite',
    location_name: 'Jardin de la Présidence, Brazzaville',
    city: 'Brazzaville',
    latitude: -4.2694,
    longitude: 15.2792,
    starts_at: '2026-07-22T18:00:00',
    ends_at: '2026-07-22T19:30:00',
    zora_reward: 30,
    max_participants: 20,
    cover_image_path: '/images/landing/sessions-sportives-collectives.png'
  },
  {
    title: 'Dépistage tension artérielle et glycémie',
    description: 'Campagne de dépistage gratuite : mesure de tension artérielle et glycémie.',
    pillar: 'anti_infectieux',
    location_name: 'Clinique El Rapha, Brazzaville',
    city: 'Brazzaville',
    latitude: -4.2710,
    longitude: 15.2620,
    starts_at: '2026-07-23T09:00:00',
    ends_at: '2026-07-23T13:00:00',
    zora_reward: 30,
    max_participants: 60,
    cover_image_path: '/images/landing/depistage.png'
  },
  {
    title: 'Jogging collectif Côte Sauvage',
    description: 'Jogging collectif matinal le long de la Côte Sauvage, tous niveaux bienvenus.',
    pillar: 'activite',
    location_name: 'Côte Sauvage, Pointe-Noire',
    city: 'Pointe-Noire',
    latitude: -4.7960,
    longitude: 11.8270,
    starts_at: '2026-07-18T06:30:00',
    ends_at: '2026-07-18T08:30:00',
    zora_reward: 50,
    max_participants: 40,
    cover_image_path: '/images/landing/defis-sportif.png'
  },
  {
    title: 'Atelier cuisine équilibrée',
    description: 'Atelier pratique de cuisine saine avec des ingrédients de saison.',
    pillar: 'nutrition',
    location_name: 'Centre Social Tchikobo, Pointe-Noire',
    city: 'Pointe-Noire',
    latitude: -4.8090,
    longitude: 11.8500,
    starts_at: '2026-07-19T14:00:00',
    ends_at: '2026-07-19T16:00:00',
    zora_reward: 40,
    max_participants: 25,
    cover_image_path: '/images/landing/atelier-cuisine.png'
  },
  {
    title: 'Méditation guidée et gestion du stress',
    description: 'Séance de méditation guidée en plein air pour apprendre à gérer le stress.',
    pillar: 'activite',
    location_name: 'Plage de Pointe-Noire',
    city: 'Pointe-Noire',
    latitude: -4.7850,
    longitude: 11.8390,
    starts_at: '2026-07-21T17:30:00',
    ends_at: '2026-07-21T18:30:00',
    zora_reward: 25,
    max_participants: 20,
    cover_image_path: '/images/landing/sessions-sportives-collectives.png'
  },
  {
    title: 'Campagne de dépistage VIH/paludisme',
    description: 'Campagne de dépistage gratuite et confidentielle VIH et paludisme.',
    pillar: 'anti_infectieux',
    location_name: 'Hôpital Adolphe Cissé, Pointe-Noire',
    city: 'Pointe-Noire',
    latitude: -4.7820,
    longitude: 11.8630,
    starts_at: '2026-07-24T08:00:00',
    ends_at: '2026-07-24T13:00:00',
    zora_reward: 30,
    max_participants: 80,
    cover_image_path: '/images/landing/depistage.png'
  }
];

async function createEvent(ev) {
  const form = new FormData();
  Object.entries(ev).forEach(([k, v]) => form.append(k, String(v)));

  const res = await fetch(BASE_URL + '/api/v1/animateur/events', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + animateurToken },
    body: form
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function publishEvent(id) {
  const res = await fetch(BASE_URL + '/api/v1/events/' + id + '/publish', {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + adminToken }
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

(async () => {
  for (const ev of events) {
    const createRes = await createEvent(ev);
    const eventId = createRes.data && createRes.data.event_id;
    let publishRes = null;
    if (eventId) publishRes = await publishEvent(eventId);
    console.log(ev.title, '-> create:', createRes.status, JSON.stringify(createRes.data), publishRes ? ('| publish: ' + publishRes.status) : '');
  }
})();
