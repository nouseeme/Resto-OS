import {initialState as emptyState} from '../server/store.js';

// Synthetic catalog for isolated tests; never loaded by the application.
export function initialState(){return {...emptyState(),
    menu: [
      ['m1', 'Nasi goreng kampung', 'Hidangan utama', 38000, 'Nasi goreng bumbu rumah, telur mata sapi, dan acar segar.', 'nasi'],
      ['m2', 'Ayam panggang rempah', 'Hidangan utama', 48000, 'Ayam panggang dengan rempah pilihan dan sayuran segar.', 'ayam'],
      ['m3', 'Nasi goreng seafood', 'Hidangan utama', 36000, 'Nasi goreng udang, sayuran, dan perasan jeruk segar.', 'mie'],
      ['m4', 'Salad kebun', 'Pendamping', 24000, 'Sayuran segar berwarna, alpukat, dan dressing rumah.', 'tahu'],
      ['m5', 'Pangsit goreng', 'Pendamping', 26000, 'Enam pangsit renyah dengan saus cocol racikan dapur.', 'pangsit'],
      ['m6', 'Es teh melati', 'Minuman', 12000, 'Teh melati yang diseduh segar, disajikan dingin.', 'teh'],
      ['m7', 'Jeruk peras', 'Minuman', 18000, 'Jeruk segar, sedikit es. Manis alami tanpa tambahan gula.', 'jeruk'],
      ['m8', 'Yogurt buah', 'Penutup', 22000, 'Yogurt lembut dengan buah beri segar.', 'puding'],
    ].map(([id, name, category, price, description, photo]) => ({ id, name, category, price, description, photo: 'test-photo', available: true })),
};}
