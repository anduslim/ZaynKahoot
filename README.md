# Zayn's Kahoot

Party quiz for up to ~20 phones. The projector shows the stage and the phones are the controllers.

## Run it

```bash
npm install
WIFI_SSID="YourWifi" WIFI_PASSWORD="secret" ADMIN_PASSWORD="1234" npm start
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

## Admin panel (edit questions)
Open `/admin` (or **⚙ Admin** in the host controls) and log in with the admin password:
`ADMIN_PASSWORD` if you set it, otherwise a 6-digit code printed in the server log at start-up.

- **Question sets:** *Zayn's birthday* and *Christmas* are separate sets. Tabs at the top of the Questions page switch which set you edit; **▶ Play this set** picks the one the game uses. You can also add, duplicate, rename or delete sets. The built-in Christmas set lives in `question-sets/christmas.js`.
- **Questions:** edit the text, hint, fun fact, time limit, answers and the correct answer. Each question type has its own fields (pictures, emoji, colours, sounds, flags…).
- **Reorder:** drag the ⠿ handle, or use the ↑ ↓ buttons (works on phones).
- **Switch questions on/off** without deleting them, duplicate them, or add new ones. The *Picture answers* type is good for photo questions; upload photos from the picture picker.
- **Settings:** finale game, race laps, tower and catch time limits, bonus points, height photo.
- The **Run order** panel shows the whole show: questions, mini games, finale and podium.

Saving in the lobby goes live straight away. Saving during a game waits for the next game (or press **Restart the game now**; players are kept).
Edits and uploaded photos are saved in `data/` (`DATA_DIR`). On Olares, mount persistent storage at `/app/data`, or edits are lost when the container is rebuilt.
**Restore the original questions** (Settings) goes back to `content.js`.

## Files
`content.js` holds the original questions; the admin panel never changes it.
- Zayn photos: `public/assets/zayn/`
- Pokémon images: `public/assets/pokemon/` (see the txt file there for file names)
- Optional real sounds or music: `public/assets/sounds/`
