# punkgame — Game01

HTML5/Canvas гра «Панк-Місто» (зомбі-апокаліпсис, топ-даун). Колишній Flash/AS3-проєкт переписано на веб; старий AS3-мотлох (`src/`, `bin/`, `obj/`, `assets/`, `.as3proj`, `tilegrid.oep`) видалено.

## Що це
- Уся гра — у **`web/`**: `index.html` + `game.js` (рушій), `sprites.js`, `mapgen.js`, `audio.js`, `net.js` (кооп через MQTT), `manifest.json`.
- Кореневий `index.html` — лише редірект на `web/`.
- `.stamp-version.cjs` — стемпить «версія <хеш>» у титулку.

## Межі проєкту
Працювати ТІЛЬКИ в цій папці (`TEST\punkgame`). Інші проєкти в `TEST` не чіпати.

## Git / деплой
- Репозиторій: **vh-ss/Game01**, гілка `main`.
- Після кожної зміни — самостійно `commit` + `push`.
- **Перед пушем змін у грі** запускати `node .stamp-version.cjs` (оновлює «версія <хеш>» внизу титулки — видно, який білд на Pages).
- Push працює лише з `http.sslBackend=schannel` (виставлено глобально).
- Деплой: **GitHub Actions** (`.github/workflows/deploy.yml`, cancel-in-progress) + `.nojekyll`. Source у Settings→Pages має лишатися «GitHub Actions».
