// ── TURN-сервери для кооперативу через мобільний інтернет (LTE) ──
//
// На спільному Wi-Fi кооп працює і без цього файлу (досить STUN).
// Для гри через мобільні дані потрібен TURN-ретранслятор.
//
// Безкоштовний варіант (Metered, ~20 ГБ/міс безкоштовно):
//   1. Зареєструйся: https://dashboard.metered.ca/  (хвилина, безкоштовно)
//   2. Створи застосунок → скопіюй TURN-сервери з вкладки "TURN Server"
//   3. Встав їх нижче у window.COOP_TURN замість прикладу й розкоментуй.
//
// Формат кожного запису: { urls: '...', username: '...', credential: '...' }

window.COOP_TURN = [
  // Приклад (заміни на свої дані з Metered):
  // { urls: 'turn:standard.relay.metered.ca:80',  username: 'ТВІЙ_USERNAME', credential: 'ТВІЙ_CREDENTIAL' },
  // { urls: 'turn:standard.relay.metered.ca:443', username: 'ТВІЙ_USERNAME', credential: 'ТВІЙ_CREDENTIAL' },
  // { urls: 'turns:standard.relay.metered.ca:443?transport=tcp', username: 'ТВІЙ_USERNAME', credential: 'ТВІЙ_CREDENTIAL' },
];
