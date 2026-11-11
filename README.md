# DanceDance

A personal follow-along dance game. Pick a song from your YouTube playlist and an animated coach dances to it on the beat, so you can copy the moves. There's no camera and no scoring.

It runs as a website (hosted free on GitHub Pages) and as an Android TV app. Both use the same code.

## Using the web app

**Link your playlist.** Open the site, choose to link a playlist and paste its YouTube link (it looks like `https://www.youtube.com/playlist?list=…`). The playlist must be **Public** or **Unlisted**, because a Private playlist can't be read without signing in. To change this in YouTube, open the playlist, tap the privacy setting and choose Unlisted. The link is saved in your browser, and the playlist is re-read every time you open the app, so songs you add on your phone show up next time.

**How beat sync works.** The coach needs to know where the beats are in each song. It gets them in one of these ways, best first:

1. **Cloud beat map.** Once an hour, a GitHub job downloads each new song in your playlist, finds its beats and publishes a small beat-map file with the site. Songs with a beat map are in sync from the first second and need nothing from you. A song you've just added gets its map within about an hour.
2. **Live listening, for songs without a beat map yet.** The app listens while the song plays. The coach grooves gently for about 10 seconds until it locks onto the tempo, then starts dancing. What it learns is saved, so the next time you play that song it's in sync from the start.
   - **Share this tab** (offered first in Chrome and Edge on a computer): the browser lets the app hear the tab's own audio directly, which is as accurate as a cloud beat map. When the browser asks what to share, pick this tab and keep "Also share tab audio" on. If the song plays through to the end this way, the app sends its beat timings (never any sound) to your relay, and the song gets a beat map for everyone. See "If YouTube blocks GitHub's servers" below.
   - **Microphone**: the app hears the song through your mic. It works anywhere, but a noisy room makes it less accurate. Your browser will ask for mic permission. The sound is analysed on your device and never recorded or sent anywhere, and mic results are never shared.

**Audio offset.** If the coach looks early or late, which is common with Bluetooth speakers because they add a delay, adjust the audio offset. Press Left or Right during a song (10 ms per step, up to ±500 ms), or set it under **Options**. The setting is remembered.

**Options.** The **Options** button at the top of the song list is where you choose the coach's look (each style has a moving preview), set the audio offset, choose how songs without a beat map find the beat (web only), change your playlist and, on the web, connect to GitHub for adding songs.

**How a song's dance style is decided.** Each song gets a style (shown on the coach's NOW label, e.g. "Latin groove"): which move families it leans toward (Latin, disco, funk, hip-hop, pop, rock, K-pop, party, aerobics), which body parts to favour and a few themes. The first match wins: the song's own `style` in `src/data/starter.json`, then the artist (a built-in table in `src/core/choreo/songStyle.ts`), then the iTunes genre recorded when the song was added, and otherwise a balanced pop mix. Words in the title add themes ("Hips", "Jump", "Spin", "Clap", ...), and the tempo nudges the mix a little. About two thirds of the moves then come from the song's families. To override a song, add or edit its `style` in `starter.json`, e.g. `"style": { "families": { "latin": 1, "pop": 0.3 }, "themes": ["hips"], "focus": { "hips": 1.5 }, "signature": ["hip-sway", "hip-shake"] }`. `signature` names one or two moves (ids from `src/core/choreo/families/*.ts`) that open every chorus.

**Same routine or a new one.** Under **Options → Routine**, "Same every time" (the default) gives a song the same routine on every play, so you can learn it. "New every time" changes the routine on each play; the chorus combo stays the same.

**Your own MP3s.** Drag an MP3 or M4A file onto the page. It's analysed on your device in a few seconds and played directly, with no YouTube involved.

## Helper app (optional, for computers)

New songs often have no beat map yet, because YouTube blocks the cloud job. The **DanceDance helper** is a small free app you run on your Mac or Windows computer. While it is running, DanceDance uses your computer to download a song's audio and finds the beat right there, before the song starts. You don't need the microphone or tab sharing, and the map is shared so everyone else gets it too. It's optional: without it, DanceDance works as before.

**Download** the one for your computer:

- Mac with an Apple chip (M1 or newer): [dancedance-helper-macos-arm64.zip](https://github.com/ryee-dao/dancedance/releases/download/helper/dancedance-helper-macos-arm64.zip). To check your chip, open  → About This Mac.
- Mac with an Intel chip: [dancedance-helper-macos-x64.zip](https://github.com/ryee-dao/dancedance/releases/download/helper/dancedance-helper-macos-x64.zip)
- Windows (64-bit): [dancedance-helper-windows-x64.exe](https://github.com/ryee-dao/dancedance/releases/download/helper/dancedance-helper-windows-x64.exe)
- Linux (x86-64): [dancedance-helper-linux-x64.tar.gz](https://github.com/ryee-dao/dancedance/releases/download/helper/dancedance-helper-linux-x64.tar.gz). Unpack it and run `./dancedance-helper`.

All downloads, with their checksums, are on the [helper release page](https://github.com/ryee-dao/dancedance/releases/tag/helper).

**First run on a Mac.** The app isn't signed by Apple, so macOS warns you the first time. This is expected.

1. Open the downloaded zip. You get a file called **DanceDance Helper**. Move it somewhere permanent, for example your Applications folder.
2. Double-click it. macOS says it "cannot be opened" or "could not verify" it. Click **Done** (not Move to Trash).
3. Open **System Settings → Privacy & Security**. Scroll down to the message about "DanceDance Helper" and click **Open Anyway**, then enter your password. On older macOS you can instead right-click the file, choose **Open**, then **Open**.
4. Double-click it again and choose **Open**. A Terminal window opens. That window *is* the helper.

This allows only this one app. Don't turn off Gatekeeper or run commands that remove protections for everything.

**First run on Windows.** Double-click the `.exe`. If Windows says "Windows protected your PC", click **More info → Run anyway**. Your browser may also warn that the file "isn't commonly downloaded": choose **Keep**. A black console window opens. That window is the helper.

**Using it.** The first start takes a few seconds longer while the helper downloads the YouTube downloader it uses (yt-dlp, about 37 MB, checked against its published checksum). Then a page opens in your browser saying **DanceDance helper is running**. Click **Open DanceDance** there. The first time, Chrome and Edge ask whether DanceDance may connect to "apps on this device" (or "your local network"). Choose **Allow**, because that's how the page talks to the helper. Leave the helper window open while you dance. When a song has no beat map, "Starting soon" shows *Getting the song…* then *Finding the beat…*, and the song starts in sync. While DanceDance is open and no song is playing, the helper also quietly finds the beat of songs that have no map yet. It does one song about every 25 seconds, at most 20 each time you open the app, and pauses while you dance. **Options → Helper app** shows whether it's running and how far it has got.

**Stopping it.** Close its window, press Ctrl+C in it, or click **Stop the helper** on its page.

**Starting it automatically (optional).** You can do this yourself. The helper never changes these settings.
- Mac: **System Settings → General → Login Items → Open at Login → +**, then choose DanceDance Helper.
- Windows: press Win+R, type `shell:startup`, press Enter, and put a shortcut to the `.exe` in the folder that opens.

**Which browsers.** It works in Chrome and Edge, and in Firefox, after you allow the browser's one-time question about connecting to apps on this device. Safari doesn't let secure websites talk to apps on the same computer, so the helper isn't expected to work in Safari. On a Mac, use Chrome, Edge or Firefox with it, or use the microphone and tab-sharing options in Safari.

**Privacy.** The helper only talks to YouTube (to download songs and its downloader updates from GitHub) and to the DanceDance page on the same computer. Other websites are refused. The song's audio goes into a private temporary folder and is deleted as soon as the page has it. The page analyses it and keeps only the small beat map. Nothing is uploaded except that beat map, which is shared so others get the song in sync. The helper keeps only yt-dlp and a small log in its own folder (Mac: `~/Library/Application Support/DanceDance Helper`, Windows: `%LOCALAPPDATA%\DanceDance Helper`). Delete that folder and the app to remove it completely.

**If it says YouTube blocked it.** YouTube sometimes asks a home connection to "prove it's not a bot". Wait an hour or so. If it says YouTube changed something, the helper updates yt-dlp by itself, at most once a day or sooner after a failure. If that doesn't help within a few days, download the helper again.

### For the owner: publishing the helper

The helper's code is in `helper/` (TypeScript for Deno, built into single files with `deno compile`, no installer). To publish a new version, raise `"version"` in `helper/deno.json`, commit, then:

```sh
git tag helper-v0.1.0 && git push origin helper-v0.1.0
```

Or use **Actions → Helper app → Run workflow**. The job tests, builds all four downloads and updates the release tagged **`helper`** in place, so the download links above never change. That release is never marked "Latest", so `releases/latest/download/dancedance.apk` keeps pointing at the TV app. TV tags start with `v`, helper tags with `helper-v`.

The site address the helper trusts and opens is baked in from the repository name (`https://<owner>.github.io` and `https://<owner>.github.io/<repo>/`). For a custom domain or a fork, put a file named `dancedance-helper.json` next to the helper:

```json
{ "allowedOrigins": ["https://dance.example.com"], "siteUrl": "https://dance.example.com/", "allowLocalhost": true }
```

`allowLocalhost` (default `true`) lets `http://localhost:*` dev servers use it.

How it works, for maintenance:

- It listens on `127.0.0.1` only, on port 47800 (or 47801, 47802 if taken). `GET /health` returns `{ ok, app, version, ytdlp, platform, ready, state }`. `GET /status` adds current downloads and recent results. `POST /audio` with `{"videoId":"<11 characters>"}` returns the audio, with error codes `blocked`, `outdated`, `unavailable`, `network` and `error` (plus `not-ready`, `busy` and `rate-limited`). `GET /` is its status page.
- Security:
  - Every request must carry `Host: 127.0.0.1:<port>`, which blocks DNS rebinding.
  - A request with an `Origin` must come from an allowed site. `POST /audio` requires one, plus JSON, so it always gets a CORS preflight. The preflight answers `Access-Control-Allow-Private-Network`.
  - Only the video ID comes from the page. yt-dlp runs with a fixed argument list and no shell.
  - At most 2 downloads run at once, 8 a minute. Audio is limited to 40 MB, 15 minutes, no live streams.
- yt-dlp is the official release binary (`yt-dlp_macos`, `yt-dlp.exe`, `yt-dlp_linux`). It is verified against the release's `SHA2-256SUMS` when downloaded and again at every start, and updated when a newer release exists, checking at most daily.
- yt-dlp needs a JavaScript runtime for YouTube. The helper is itself built on Deno, so it acts as that runtime (`--js-runtimes deno:<helper>`). It runs YouTube's challenge script in a worker with no permissions, so nothing else is downloaded. If a future yt-dlp changes how it calls Deno, songs fail as `outdated` until the helper is rebuilt.
- It downloads audio-only Opus/WebM (or M4A if that's all there is), which the browser decodes, so no ffmpeg is needed. Beats found from Opus match the cloud maps. AAC came out about 30 ms late in Chrome.
- Local checks: `cd helper && deno task test`, `deno task build` (all targets into `helper/dist/`, git-ignored) or `deno task build --target aarch64-apple-darwin`, and `deno task start` to run from source.

## One-time GitHub setup

You need a free GitHub account. You do this once.

1. **Create a public repository** on GitHub (for example `dancedance`). Don't add a README or licence, because this project already has them. It must be public for free GitHub Pages and unlimited Actions minutes.
2. **Push this project** to it from the project folder:
   ```sh
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main
   ```
3. **Turn on Pages.** In the repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. **Allow the job to save beat maps.** **Settings → Actions → General → Workflow permissions → Read and write permissions → Save**.
5. **Tell the job your playlist.** **Settings → Secrets and variables → Actions → Variables tab → New repository variable**. Name: `PLAYLIST_URL`. Value: your playlist link. Without it, the job only makes beat maps for the built-in starter songs.
6. **Run the beat-map job once by hand.** **Actions → Beat maps → Run workflow**. Leave the boxes empty and click Run. The first run handles up to 25 songs, and later hourly runs pick up the rest. When it finishes, it redeploys the site automatically.
7. If the deploy hasn't run yet, start it with **Actions → Deploy site → Run workflow**. Your site will be at `https://<your-username>.github.io/<your-repo>/`.

The "Run workflow" button on **Beat maps** has a few optional fields. **video_id** processes just one video (the 11 characters after `v=` in its link). **force** redoes songs that already have a beat map. **add_artist**, **add_title** and **add_duration** add a song by search (see below); **add_queue** is filled in by the app and **map_json** by the relay, so leave them empty.

## Adding a song by search

On the website, choose **Add a song**, type a song or artist, pick the right song from the list and press **Add song**. A GitHub job then finds the song on YouTube, works out its beats and publishes it with the site. It shows up under **My added songs** on the home screen, usually within 3 to 5 minutes, and the TV app sees it too. While you wait, the song is shown as "Being added…".

How the job picks the video, with no human or AI in the loop: it searches YouTube for "artist title lyrics" and "artist title official audio", keeps only uploads within 1 second shorter to 6 seconds longer than the song's official length, and drops live versions, remixes, covers, sped-up or slowed versions, karaoke, instrumentals, "1 hour" loops, extended or radio edits, reactions and other artists' songs. It prefers an official lyric video or official audio from the artist's own channel, then the most-watched lyric video (at least 300,000 views), then the artist's official "Topic" track. It skips videos that can't be embedded. If nothing fits, it falls back to the official music video (marked `"note": "music-video"` in `songs.json`). If there's no usable video at all, the app says it couldn't find one.

The first time you add a song, the app asks how to reach your GitHub repository. You can paste a **relay address** (see "Optional: Cloudflare relay" below) or a **GitHub token**:

1. On GitHub, click your profile picture, then **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. **Repository access:** *Only select repositories*, then pick your DanceDance repository.
3. **Repository permissions → Actions:** *Read and write*. Leave everything else as it is.
4. Generate it, copy it (it starts with `github_pat_`) and paste it into the app.

The token is stored only in that browser, and the app only ever sends it to GitHub. You can remove it under **Options → Disconnect** (and delete it on GitHub). The worst someone with the token could do is start or cancel this repository's jobs.

Limits:

- Songs must be in Apple's music catalogue (the search uses it to find the official title and length) and on YouTube, and at most 15 minutes long.
- If you send several songs quickly while a job is running, GitHub keeps only the newest waiting job. The app re-sends songs it is still waiting for with each new request, and after 15 minutes offers **Send again**.
- If YouTube blocks GitHub's servers, the song is still added: it shows up with "Learning the beat" instead of a tempo and plays straight away, finding the beat by listening. The hourly job keeps trying to make its beat map. See "If YouTube blocks GitHub's servers" below.
- **Removing** an added song (choose it, then **Remove from My added songs**) hides it on that device only. It stays in `public/songs.json` in the repository; delete its entry there to remove it everywhere.
- The site is cached for a few minutes, so a new song can take a little longer than the job itself to appear.

### Optional: Cloudflare relay

If you'd rather not paste a GitHub token into each browser, a tiny Cloudflare Worker (free plan is fine) can hold the token instead. The app sends it the song's Apple track ID (plus the artist, title and length from its own search); the Worker looks the song up with Apple itself and starts the job, and only uses the app's details if Apple's lookup fails.

1. Make a fine-grained token as above (this repository only, **Actions: Read and write**).
2. In `cloudflare/add-song-worker/wrangler.toml`, set `GITHUB_REPO` to `your-username/your-repo` and `ALLOWED_ORIGINS` to your Pages address without a path (for example `https://your-username.github.io`), plus `http://localhost:5173` if you use the dev server. Optionally change `DAILY_LIMIT` (default 30 songs a day).
3. From the project folder:
   ```sh
   cd cloudflare/add-song-worker
   npx wrangler login
   npx wrangler secret put GITHUB_TOKEN      # paste the token
   npx wrangler secret put ADD_PASSPHRASE    # optional: a passphrase the app asks for once per browser
   npx wrangler deploy
   ```
   `deploy` prints the Worker's address, like `https://dancedance-add-song.your-name.workers.dev`.
4. Either paste that address into the app (**Options → Connect to GitHub → Relay address**), or set it for everyone: **Settings → Secrets and variables → Actions → Variables → New repository variable**, name `ADD_SONG_URL`, then run **Actions → Deploy site**. With the variable set, the app never asks for a token.

The Worker only accepts requests from the addresses in `ALLOWED_ORIGINS`. The daily limit is a soft one: before starting a job, the Worker asks GitHub how many manual runs of the Beat maps job started in the last 24 hours. Check it's running with `https://<worker address>/health`.

The same Worker also accepts **shared beat maps** (`POST /map`, see the next section) and starts a short "Contributed beat map" run for each. These have their own soft limit, `MAP_DAILY_LIMIT` (default 60 a day), and don't count against `DAILY_LIMIT`. If you set `ADD_PASSPHRASE`, only browsers that know the passphrase can share maps too.

The Worker doesn't update itself: after pulling an update that changes anything in `cloudflare/add-song-worker`, run `npx wrangler deploy` again from that folder. If adding a song fails with a message about Apple's music catalogue, open `https://<worker address>/health?probe=1`: it looks up one well-known song with Apple and shows `"apple": "ok"`, or what went wrong (for example `apple-403` if Apple refuses the Worker, `apple-timeout` or `apple-bad-json`). Either way the Worker still adds songs using the details the app sends.

## If YouTube blocks GitHub's servers

YouTube sometimes refuses to let GitHub's servers download songs ("Sign in to confirm you're not a bot"). DanceDance keeps working anyway, in three layers:

1. **Songs appear straight away and sync by listening.** When you add a song, the job finds the right YouTube video without downloading anything, so the song is listed at once, even if the download is then refused. Its tile says "Learning the beat" instead of a tempo. Playing it works like any song without a beat map: the coach listens (tab audio or microphone) and is on the beat within about 10 seconds. The hourly job keeps trying to make a proper beat map, with growing pauses between attempts. In `public/songs.json` such a song has `"hasMap": false`, and `public/songs-status.json` has a `"map-pending"` note for it (not an error).
2. **Anyone's first full listen in Chrome or Edge fixes it for everyone.** For a song without a beat map, Chrome and Edge on a computer first offer "Share this tab so the coach can hear the song. You only need to do this the first time anyone plays it." If the song then plays to its end with tab audio covering at least 85% of it (in practice: from the start, without skipping) and the beat locked for most of it, the app quietly sends the finished beat map (about 10 KB of timings, no sound) to your relay and says "Saved this song's beat for everyone." The relay checks it and starts a quick "Contributed beat map" run, which checks it again and publishes it like a cloud map, usually within a few minutes. Microphone results are never sent, and nothing is sent without a relay. If sending fails (offline, limit reached), the app tries again next time it opens. On Safari, Firefox, phones and tablets the app explains that the song will sync perfectly once someone has played it in Chrome or Edge on a computer, and offers the microphone.
   - Rules the job applies: the song must be in the starter pack, `songs.json` or your playlist; the map must look like a real song's beat map (one tempo between 60 and 220 BPM that matches the beats, beats covering most of the song, sections covering all of it, nothing extra). A song that already has a map from the cloud job is never touched; for the same song a later shared map only replaces an earlier one if it covers clearly more of the song. A map from the optional helper app (made from a downloaded copy) replaces one made by listening.
   - If a shared map is ever wrong, delete `public/beatmaps/<videoId>.json` in the repository (the song goes back to listening), or run the local sync below, which replaces maps made by listening with real analyses. The cloud job does the same by itself whenever YouTube lets it download the song again.
   - How good are these maps? Starter songs played start to end with real tab capture (in a test browser) gave the same tempo as the cloud map, with 94-98% of beats within 35 ms of it and no systematic offset. Recordings joined part-way through or interrupted were noticeably worse, which is why those are never shared.
3. **The owner's computer can do the downloads.** Your home connection usually isn't blocked. From the project folder, with yt-dlp, ffmpeg and Deno installed (see "Local development"):
   ```sh
   npm run beatmaps:local            # pull, make every pending beat map, show what changed
   npm run beatmaps:local -- --push  # ... and commit only the beat-map files and push them
   ```
   It handles songs added while YouTube was blocking (ignoring the usual waiting time), songs without a map and songs whose map came from listening. It refuses to run if you have other uncommitted changes (`--allow-dirty` runs anyway and still commits only beat-map files). Without `--push` it stops before committing and lists what it would commit. Pushing starts the site deploy as usual. Alternatively, give the cloud job cookies from a spare account (next section).

   Optional, if you want your Mac to do this every 10 minutes while it's on: save the following as `~/Library/LaunchAgents/app.dancedance.localsync.plist` (change both paths), then run `launchctl load ~/Library/LaunchAgents/app.dancedance.localsync.plist`. Remove it with `launchctl unload` on the same file and deleting it. This is only an example; nothing installs it for you.
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
   <plist version="1.0">
   <dict>
     <key>Label</key><string>app.dancedance.localsync</string>
     <key>ProgramArguments</key>
     <array>
       <string>/bin/zsh</string><string>-lc</string>
       <string>cd "$HOME/path/to/dancedance" &amp;&amp; npm run --silent beatmaps:local -- --push</string>
     </array>
     <key>StartInterval</key><integer>600</integer>
     <key>StandardOutPath</key><string>/tmp/dancedance-localsync.log</string>
     <key>StandardErrorPath</key><string>/tmp/dancedance-localsync.log</string>
   </dict>
   </plist>
   ```

## When the beat-map job goes red

A failed run shows a red ✗ under **Actions**. Open the run: the summary at the top says what went wrong. One song failing (private, removed or region-locked) doesn't turn the run red. The run goes red when something affects every song:

### "YouTube is bot-blocking this runner"

YouTube sometimes refuses requests from GitHub's servers and asks them to "sign in to confirm you're not a bot". Songs still get added and play (see "If YouTube blocks GitHub's servers" above). To let the cloud job download again, give it cookies from a signed-in YouTube session, or use the local sync.

> **Warning: use a spare Google account, never your main one.** Google can flag or suspend accounts whose cookies are used by download tools. Create a new, throwaway Google account for this and use it for nothing else.

1. Install a browser extension that exports cookies in "Netscape" / `cookies.txt` format (for example "Get cookies.txt LOCALLY" for Chrome or "cookies.txt" for Firefox).
2. Open a **private/incognito window**. Allow the extension in private windows if your browser asks.
3. In that window, sign in to YouTube with the **spare** account. Play any video for a few seconds.
4. Still on youtube.com, use the extension to export cookies for `youtube.com` and save the file.
5. **Close the private window without signing out.** Signing out cancels the cookies you just exported.
6. In GitHub: **Settings → Secrets and variables → Actions → Secrets tab → New repository secret**. Name: `YT_COOKIES`. Value: paste the whole contents of the cookies file. Then delete the file from your computer.
7. Run **Beat maps** again by hand.

Cookies expire after a while (weeks to months). If the error comes back, repeat these steps and update the secret. The job never prints the cookies.

### "yt-dlp is out of date"

The job uses a tool called yt-dlp to read YouTube. When YouTube changes its site, yt-dlp needs an update, which usually appears within a few days. The job installs the newest yt-dlp on every run, so it usually fixes itself. Wait a day or two and run it again.

If a new yt-dlp release itself is broken, you can pin an older one. Add a repository **variable** named `YTDLP_VERSION` set to a release name from <https://github.com/yt-dlp/yt-dlp/releases>, for example `2026.10.26`. Delete the variable later to go back to the latest version.

### The hourly job stopped running

GitHub turns off scheduled jobs in a public repository after **60 days with no activity**, and emails you before it does. To restart it, go to **Actions → Beat maps** and click **Enable workflow**.

### "Could not read the playlist"

Check that `PLAYLIST_URL` is the full playlist link and that the playlist is Public or Unlisted.

## Local development

You need [Node.js](https://nodejs.org) 22 or newer.

```sh
npm install
npm run dev        # starts the app at http://localhost:5173
npm test           # runs the tests
npm run build      # production build into dist/
```

To make beat maps on your own computer, you also need **yt-dlp** and **ffmpeg**, plus **Deno** (yt-dlp uses it for YouTube). On a Mac with Homebrew:

```sh
brew install yt-dlp ffmpeg deno
npm run beatmaps -- --only <videoId>       # one video
npm run beatmaps -- --limit 5              # the next 5 songs without a map
npm run beatmaps -- --dry-run              # list what would be processed; downloads nothing
npm run beatmaps -- --add "a-ha - Take On Me"   # add a song by search (length looked up on iTunes)
npm run beatmaps -- --add "a-ha - Take On Me" --dry-run   # just show which video it would pick
PLAYLIST_URL='https://www.youtube.com/playlist?list=…' npm run beatmaps
```

Beat maps are written to `public/beatmaps/`; songs added by search are listed in `public/songs.json` (fields in this order: `videoId`, `title`, `artist`, `addedAt`, `durationSec`, `hasMap` — `false` until their map exists — then `note` and `genre`, the iTunes genre, only when known; `public/beatmaps/index.json` repeats the genre for songs that have a map), and ones that couldn't be added in `public/songs-status.json`. `npm run beatmaps:local` is the safe all-in-one version for your own computer (see "If YouTube blocks GitHub's servers"). Audio goes to a temporary folder and is deleted as soon as each song is analysed. `--force` redoes songs that already have a map.

## A note on YouTube's terms

Downloading audio from YouTube, as the beat-map job does, is against YouTube's Terms of Service. So is playing videos in a near-invisible player. This project is for personal use only: don't run it as a public service. In practice, the risks are that things break when YouTube changes, and that the account whose cookies you use (if you use any) gets flagged. That's why it must be a spare one.

## Android TV

The TV app is the same DanceDance inside a small Android shell, made for a projector or TV that you control with a remote. It works differently from the website in a few ways:

- **Audio only.** There's no YouTube player on the TV. The app downloads just the song's audio into its own storage and plays that. Up to 300 MB of songs (roughly 70) are kept so they start instantly next time. When that fills up, the songs you haven't played for longest are deleted first.
- **It finds the beat on the projector.** If a song has a cloud beat map, the TV uses it. Otherwise the projector analyses the downloaded song itself while the "Starting soon" screen is up, which usually takes a few seconds. If that takes longer than 15 seconds, the TV analyses the first 30 seconds, starts the song, and finishes the rest in the background. It never uses a microphone.
- **You use your phone, not by typing.** The TV shows a QR code. Scan it to link your playlist or to find and add single songs.
- **Remote control.** Use the arrows to move and OK to choose. Back goes back one screen, and pressing Back on the song list closes the app. During a song, Left and Right change the audio offset, as on the website.

### One-time setup for TV releases

GitHub builds the TV app for you. Two things make it work properly, and you only need to set them up once.

**1. A signing key (strongly recommended).** Android only installs an update over an existing app if both are signed with the same key. Without your own key, every release has a different throwaway key, so you'd have to uninstall the app before each update and link your playlist again.

On your computer, in any folder **outside** this project:

```sh
keytool -genkeypair -v -keystore dancedance-release.jks -alias dancedance \
  -keyalg RSA -keysize 4096 -validity 10000
```

It asks for a password (choose a strong one and keep it) and for your name. Any values are fine. `keytool` comes with Java. If you don't have Java, install it with `brew install openjdk@17` and run it as `$(brew --prefix openjdk@17)/bin/keytool`.

Then turn the file into text you can paste:

```sh
base64 -i dancedance-release.jks | pbcopy        # Mac: copies it to the clipboard
base64 -w0 dancedance-release.jks                # Linux: prints it
```

In the repository go to **Settings → Secrets and variables → Actions → Secrets tab → New repository secret** and add four secrets:

| Name | Value |
| --- | --- |
| `ANDROID_KEYSTORE_B64` | the base64 text you just copied |
| `ANDROID_KEYSTORE_PASSWORD` | the password you chose |
| `ANDROID_KEY_ALIAS` | `dancedance` |
| `ANDROID_KEY_PASSWORD` | the same password (keytool uses one password for both) |

Keep `dancedance-release.jks` and its password somewhere safe, such as a password manager. If you lose them, the next update will need an uninstall. Never commit the file. `.gitignore` already ignores `*.jks` and `*.keystore`.

If these secrets are missing, the build still works, but it shows a yellow warning that the APK is debug-signed.

**2. A GitHub token for the TV (optional).** When your playlist has songs without a cloud beat map, the TV can ask GitHub to run the **Beat maps** job right away instead of waiting for the hourly run. To allow that, the TV needs a token that can do exactly one thing: start workflows in this one repository.

1. On GitHub, click your profile picture, then **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. **Token name:** `DanceDance TV`. **Expiration:** up to a year. When it expires, the TV's Diagnostics screen says so, and you make a new one.
3. **Repository access:** *Only select repositories*, then pick your DanceDance repository.
4. **Permissions → Repository permissions → Actions:** *Read and write*. Leave everything else as it is. GitHub adds "Metadata: Read-only" by itself.
5. Click **Generate token** and copy it. It starts with `github_pat_`.
6. You don't store this token in GitHub. You type it into the phone page when you link the TV (see below). It stays encrypted on the TV and is never shown again.

The worst someone could do with this token is start or cancel this repository's workflows. You can leave the field blank, and everything else still works.

### Making a release

Either:

- push a version tag from the project folder: `git tag v1.0.0 && git push origin v1.0.0` (use a higher number each time), or
- go to **Actions → Android TV app → Run workflow**.

After a few minutes the APK is on the repository's **Releases** page. It is always called `dancedance.apk`, so this address always gives you the newest one:

```
https://github.com/<your-username>/<your-repo>/releases/latest/download/dancedance.apk
```

The build bakes in your GitHub Pages address (where cloud beat maps live) and your repository name (for the TV's trigger), so there's nothing to configure in the app itself.

### Installing on an Epson Android TV projector

You do this once. The projector needs to be on Wi-Fi.

1. On the projector, open the **Google Play Store**, search for **Downloader** (by AFTVnews) and install it.
2. Let Downloader install apps: **Settings → Apps → Security & restrictions → Unknown sources**, then turn on **Downloader**. On some models the path is **Settings → Device Preferences → Security & restrictions → Unknown sources**.
3. Open **Downloader**. If it asks for access to files, allow it.
4. In the address box, type the release address from above (`https://github.com/<your-username>/<your-repo>/releases/latest/download/dancedance.apk`) and choose **Go**.
5. When the download finishes, choose **Install**, then **Done**. Downloader offers to delete the downloaded file. Choose **Delete**, because the app is already installed.
6. Press **Home**, open the **Apps** row and start **DanceDance**. To pin it to your favourites, highlight it, hold OK and choose **Add to favourites**.

**Linking your playlist.** The first time it starts, DanceDance shows a QR code. Make sure your phone is on the same Wi-Fi as the projector, then scan the code. On the page that opens, paste your YouTube playlist link. Optionally, paste the GitHub token from above too. Press **Send**. The phone tells you whether the playlist could be read, and the TV loads it straight away. To get back to the phone page later, choose **Add songs from your phone** at the top of the song list.

The TV re-reads your playlist every time the app opens, so songs you add on your phone show up by themselves.

**Adding single songs (no GitHub token needed).** On the phone page, use **Find a song**: search for a song, tap the right match (the length comes from Apple's iTunes catalogue), and the TV searches YouTube itself and suggests the best video, using the same rules as the cloud job. That means an official lyric video or official audio first, then a popular lyric video, then the artist's own audio track. Live versions, remixes, covers, sped-up versions and videos of the wrong length are left out. Press **Add** (or pick one of the other suggestions). The song appears in **My added songs** on the TV right away and plays like any other song. Added songs are stored on the TV only. Remove them from the list at the bottom of the phone page.

### Updating

Make a new release (above). On the projector, open **Downloader**, enter the same address again (it's in Downloader's history) and install. If you set up the signing key, the update installs over the old version and keeps your playlist and settings.

If the projector says **App not installed**, the old and new versions have different signing keys. This happens when a release was built without the signing secrets. Uninstall DanceDance (**Settings → Apps → DanceDance → Uninstall**), install again and re-link your playlist.

### Troubleshooting the TV app

**"YouTube changed something. Update the app (NewPipe Extractor v0.x.y)."** The TV reads YouTube with a library called NewPipe Extractor. When YouTube changes its site, the library needs an update, which usually comes out within days. To update:

1. Check <https://github.com/TeamNewPipe/NewPipeExtractor/releases> for a release newer than the version in the message.
2. In this project, open `android/gradle/libs.versions.toml` and change the one line marked "bump this", for example `newpipeExtractor = "v0.27.2"`.
3. Commit, push, and make a new release (push a new `v…` tag). Then update the TV.

If there's no newer release yet, wait a few days and check again. Songs that are already downloaded keep playing in the meantime.

**"YouTube is asking this projector to prove it isn't a bot."** YouTube is temporarily limiting your home connection. Wait an hour or so. Downloaded songs still play.

**The phone can't open the QR page.** The phone and the projector must be on the same Wi-Fi network, with the phone's mobile data off or Wi-Fi preferred. Guest networks and networks with "AP/client isolation" block devices from talking to each other. Use your main Wi-Fi. The page only works while the QR screen is open on the TV.

**A song is skipped as "Unavailable" or "Can't play here".** The video was removed, made private, is age-restricted or is blocked in your country. Replace it in your playlist.

**The projector feels slow or the coach looks choppy.** Go to **Add songs from your phone → Diagnostics**. Play a song first, then read these lines:

- **Frame time** is how long the projector takes to draw each frame of the coach. Under 20 ms (50+ fps) is smooth, and 20–33 ms is fine. Over 33 ms (under 30 fps) looks choppy. "Long frames" counts frames that took over 50 ms, which show as visible hitches.
- **Last beat analysis** is how long the projector took to find the beats in the last new song. The target is under 15 seconds. If it takes longer, the TV starts with the first 30 seconds and finishes in the background, so the song still starts promptly. Cloud beat maps (the GitHub job, plus the optional token) mean the TV rarely has to analyse at all.
- **Song cache** is how much downloaded audio is stored. **Cloud trigger** and **Last trigger** show whether the TV can start the beat-map job and what GitHub answered last time. "Rejected the token" means the token needs replacing. Re-link from your phone with a new one.

If the frame time is consistently over 33 ms, write down the numbers: drawing the coach natively on Android is the planned fallback.

### Building the TV app on your own computer

You need Node.js 22+, JDK 17 and the Android SDK (platform 35, build-tools 35.0.0).

```sh
npm ci && npm run build            # the web app, bundled into the APK
cd android
./gradlew assembleDebug            # app/build/outputs/apk/debug/app-debug.apk
```

Builds made this way have no cloud beat maps and no TV trigger, because they don't know your GitHub Pages address. Everything else works, including on-device analysis. To include them, add `-Pdancedance.pagesBaseUrl=https://<your-username>.github.io/<your-repo>/ -Pdancedance.githubRepo=<your-username>/<your-repo>`.
