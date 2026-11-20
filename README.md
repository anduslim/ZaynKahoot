# Zayn's Kahoot

Party quiz for up to ~20 phones. The projector shows the stage and the phones are the controllers.

## Run it

```bash
npm install
WIFI_SSID="YourWifi" WIFI_PASSWORD="secret" npm start
```

- **Projector:** open `https://<your-address>/host` in Chrome, click **Start hosting**, and press F for fullscreen.
- **Players:** scan the QR code on screen, or go to `/play`.
- **Wi-Fi QR:** if `WIFI_SSID` is set, the lobby also shows a "join the Wi-Fi" QR code.

### HTTPS (needed for tilt controls on iPhone)
iOS only gives websites the motion sensors over HTTPS. Pick one:

- **Olares One:** build the image from the `Dockerfile` (port 3000), install it as a custom app, and open it through its Olares HTTPS address. The proxy must allow websockets.
- **Any laptop:** run `cloudflared tunnel --url http://localhost:3000` and use the `https://….trycloudflare.com` address it prints. Optionally set `PUBLIC_URL` to that address so the QR code points to it.

If tilt isn't available on a phone, the steering screen also has big ◀ ▶ buttons.

## Host controls
| Key | Action |
|---|---|
| Space / Enter / → | Next |
| P | Pause the answer timer |
| B | Add 5 bots (rehearsal) |
| M | Mute |
| F | Fullscreen |

Click a player in the lobby to remove them. **Reset** keeps players and zeroes scores.
Questions read themselves aloud and option showcases play automatically. Press Space to move past reveals and leaderboards.

## Edit content
Everything is in `content.js`: question text, options, correct answers, time limits and the fun-fact lines.
- Zayn photos: `public/assets/zayn/`
- Pokémon images: `public/assets/pokemon/` (see the txt file there for file names)
- Optional real sounds or music: `public/assets/sounds/`

## Scoring
- **Normal questions:** a correct answer scores 500–1000 points; faster answers score more.
- **Questions followed by a mini game:** a correct answer scores a flat 1000.
- **Mini game bonus by finishing place:** 600, 500, 400, 320, … with 100 for taking part.
- **Final race:** bonuses are multiplied by 1.5.
