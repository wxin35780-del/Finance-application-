const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_KEY;

const headers = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
};

export const db = {
  async getEntries() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/entries?select=*&order=date.desc`, { headers });
    return res.json();
  },
  async addEntry(entry) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/entries`, {
      method: 'POST', headers: { ...headers, 'Prefer': 'return=representation' },
      body: JSON.stringify(entry),
    });
    return res.json();
  },
  async updateEntry(id, entry) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/entries?id=eq.${id}`, {
      method: 'PATCH', headers: { ...headers, 'Prefer': 'return=representation' },
      body: JSON.stringify(entry),
    });
    return res.json();
  },
  async deleteEntry(id) {
    await fetch(`${SUPABASE_URL}/rest/v1/entries?id=eq.${id}`, { method: 'DELETE', headers });
  },
  async getTargets() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/targets?select=*`, { headers });
    return res.json();
  },
  async setTarget(date, done) {
    await fetch(`${SUPABASE_URL}/rest/v1/targets`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify({ date, done }),
    });
  },
  async getSetting(key) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/settings?key=eq.${key}&select=value`, { headers });
    const data = await res.json();
    return data[0]?.value;
  },
  async setSetting(key, value) {
    await fetch(`${SUPABASE_URL}/rest/v1/settings`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify({ key, value }),
    });
  },
};
