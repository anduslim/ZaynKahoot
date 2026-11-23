# Party quiz (Zayn's Kahoot)

Party quiz for up to ~20 phones (one per player or per group). The projector shows the stage and the phones are the controllers.
Questions come in **question sets** (Zayn's birthday, Christmas, Advent & Christmas 2026…); pick which one is played in the admin panel.

## Run it

```bash
npm install
WIFI_SSID="YourWifi" WIFI_PASSWORD="secret" ADMIN_PASSWORD="1234" npm start
```

- **Projector:** open `https://<your-address>/host` in Chrome, click **Start hosting**, and press F for fullscreen.
- **Players:** scan the QR code on screen, or go to `/play`.
- **Wi-Fi QR:** if `WIFI_SSID` is set, the lobby also shows a "join the Wi-Fi" QR code. Use a different value for `ADMIN_PASSWORD` than `WIFI_PASSWORD`, since the Wi-Fi password is shown to everyone.
- **Preview:** each set has a link name (slug, set in Admin) and its own page at `/<slug>/preview`, e.g. `/advent/preview`; `/preview` lists all sets. Co-organisers see every question with its answers, and **▶ Simulate the game** plays the set start to finish (big screen + phone side by side, same scoring, typed answers go to the real judge). No joining or QR code. Set `PREVIEW_KEY` to lock these pages (`?key=…`); without it they are open to anyone with the link.

### AI judge for typed answers (optional)
*Typed answer* questions let each group type its answer. Short answers are matched by keyword (spelling slips allowed), and if an OpenAI-compatible endpoint is set, a model judges every answer. Set it in **Admin → Settings → AI judge**: paste the address (e.g. `http://192.168.1.20:8080`, `/v1` is added for you), optionally the model name and API key, then *Save* (it tests the connection straight away). It is saved in `DATA_DIR/ai.json` and wins over these environment variables, which also work:

```bash
LLM_BASE_URL="http://localhost:11434/v1"   # Ollama; LM Studio is http://localhost:1234/v1
LLM_MODEL="qwen2.5:7b-instruct"            # any chat model the server has
LLM_API_KEY=""                             # optional
LLM_TIMEOUT_MS=20000                       # optional
```

The AI gets the question, the accepted answers and the question's **marking guide** (Admin → the question → *Marking guide for the AI judge*), and replies point / no point with a one-line reason, which the host sees under each answer. It runs automatically whenever an AI address is set (the model name is optional for llama.cpp).

**On Olares:** use the model app's **Shared entrance** address. The normal entrance (Internal) shows an Olares sign-in page, which the quiz server can't get past; the Test button says so if that happens.

After time is up, the projector shows every group's answer with a ✓ or ✕. **Click an answer to flip it**, then press Space to reveal. If the model can't be reached, the screen says so (with *Try again*) and unmatched answers wait for the host's tap. Clicking during the reveal corrects the score too. **Admin → Settings → Test the AI judge** checks the connection.

### Question animations
Each *Multiple choice* or *Typed answer* question can have an **animation on the big screen** (Admin → the question → *Animation on the big screen*). On the host it is a 3D scene (three.js, with glowing candles and stars); the preview simulator shows a lighter drawn version. It plays while groups answer without giving the answer away, then shows the answer at the reveal. The Advent set has one per question: the wreath, the rose candle, Gaudete, Hope/Peace/Joy/Love, the purple vestment, a heart getting ready, Jesus' two comings, the Visitation, Bethlehem, the manger, the Wise Men and their gifts. Scenes live in `public/js/scenes3d.js` (3D) and `public/js/scenes.js` (drawn).

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
| R | Rankings on/off (scoreboard after each question) |
| B | Add 5 bots (rehearsal) |
| M | Mute |
| F | Fullscreen |

Click a player in the lobby to remove them. **Reset** keeps players and zeroes scores.
Questions read themselves aloud and option showcases play automatically. Press Space to move past reveals and leaderboards.

## Admin panel (edit questions)
Open `/admin` (or **⚙ Admin** in the host controls) and log in with the admin password:
`ADMIN_PASSWORD` if you set it, otherwise a 6-digit code printed in the server log at start-up.

- **Question sets:** tabs at the top of the Questions page switch which set you edit; **▶ Play this set** picks the one the game uses. Each set has its own title on screen, points per right answer and finale. You can also add, duplicate, rename or delete sets.
  Every file in `question-sets/` (`.js` or `.json`) is a built-in set and is added once; `.json` sets dropped into `DATA_DIR/question-sets/` are picked up too. See `question-sets/advent.js` for the format.
- **Scoring:** a right answer gives the set's points. Speed doesn't matter.
- **Timer:** per set. With the timer off, a question stays open until every phone has answered or the host presses Space. Sets marked *Quiz only* (no mini games, no finale, no Wi-Fi QR) start with the timer off.
- **Question types:** *Multiple choice* has up to 6 answers and one or more right ones. With several, set how many the groups pick ("name any two" = 4 right, pick 2); it counts when every pick is right. *Typed answer* has accepted answers (one per line, `/` between words that mean the same), how many items are needed, and notes for the AI judge.
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
