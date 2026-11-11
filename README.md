# DanceDance

A personal follow-along dance game. Pick a song and an animated coach dances to it on the beat, so you can copy the moves. There's no camera and no scoring.

It comes in two forms that share the same code:

- a **website**: <https://ryee-dao.github.io/dancedance/> (hosted free on GitHub Pages, repository [ryee-dao/dancedance](https://github.com/ryee-dao/dancedance));
- an **Android TV app**, made for an Epson projector and a remote control.

Contents:

1. [Playing](#playing)
2. [How the beat is found](#how-the-beat-is-found)
3. [Helper app for computers](#helper-app-for-computers)
4. [Android TV app](#android-tv-app)
5. [Owner's guide](#owners-guide)
6. [How the dances are made](#how-the-dances-are-made)
7. [Development](#development)
8. [Limits and a note on YouTube's terms](#limits-and-a-note-on-youtubes-terms)

## Playing

### Quick start

1. Open <https://ryee-dao.github.io/dancedance/>.
2. Pick a song. The **Starter pack** has 97 songs ready to go, or press **Shuffle**.
3. In **Choose your level**, pick **1 Player** or **2 Players**, then a level:
   - **Chill**: gentle steps, no jumps.
   - **Cardio**: keeps you moving.
   - **Sweaty**: big moves, full out.
4. Dance along. The app remembers your last level and number of players.

Keyboard and remote: arrows move, Enter or OK chooses, Back or Escape goes back.

### Link your YouTube playlist

1. Press **Link playlist** on the home screen.
2. Paste the playlist's link. It looks like `https://www.youtube.com/playlist?list=…`.
3. The playlist must be **Public** or **Unlisted**. A Private playlist can't be read without signing in. To change it in YouTube, open the playlist, tap the privacy setting and choose **Unlisted**.

The link is saved in your browser. The playlist is read again every time you open the app, so songs you add to it on your phone show up next time, straight away. Its songs appear under **My playlist**.

### Add a single song

1. Press **Add a song** on the home screen (website only; on the TV, use your phone, see [below](#find-a-song-from-your-phone)).
2. Type a song or artist, pick the right one from the list and press **Add song**.
3. The song shows as "Being added… usually 3–5 minutes", then appears under **My added songs**. The TV app sees it too.

A GitHub job finds the right YouTube video and lists the song as soon as it has found it. You can play it right away, even if it has no beat map yet: the tile then says **Learning the beat** instead of a tempo, and the beat is found as described in [How the beat is found](#how-the-beat-is-found).

How the video is picked, with no human or AI in the loop: the job searches YouTube for "artist title lyrics" and "artist title official audio", keeps only uploads between 1 second shorter and 6 seconds longer than the song's official length, and drops live versions, remixes, covers, sped-up or slowed versions, karaoke, instrumentals, "1 hour" loops, extended or radio edits, reactions and other artists' songs. It prefers an official lyric video or official audio from the artist's own channel, then the most-watched lyric video (at least 300,000 views), then the artist's official "Topic" track. It skips videos that can't be embedded. If nothing fits, it uses the official music video. If there's no usable video at all, the app says so.

Good to know:

- Songs must be in Apple's music catalogue (the search uses it for the official title and length), be on YouTube, and be at most 15 minutes long.
- If you add several songs quickly, GitHub may drop some waiting requests. The app re-sends the ones it is still waiting for, and after 15 minutes offers **Send again**.
- **Removing** an added song (choose it, then **Remove from My added songs**) hides it on that device only.
- The site is cached for a few minutes, so a song can take a little longer than the job itself to appear.

On this site you don't need to set anything up to add songs: the address of the "relay" that starts the job is built in. (Copies of this project without a relay ask you to connect to GitHub first; see [Relay or token](#the-cloudflare-relay).)

### Your own MP3s

Drag an MP3 or M4A file onto the page. It's analysed on your device in a few seconds and played directly, with no YouTube involved.

### Options

The **Options** button on the home screen has:

| Section | What it does |
| --- | --- |
| **Coach** | The coach's look: **Classic**, **Human** or **Sticker**, each with a moving preview. Every look has a **Female** and a **Male** version: pick which one dances in single player (Female, the original figures, is the default). |
| **Routine** | **Same every time** (the default) gives a song the same routine on every play, so you can learn it. **New every time** makes a different routine each play; the chorus combo stays the same. |
| **Audio offset** | Moves the coach earlier or later (see below). |
| **Songs without a beat map** | Website only. **Ask first** (explain, then ask), **Microphone** (listen straight away) or **Off** (no live listening). See [How the beat is found](#how-the-beat-is-found). |
| **Helper app** | Website on a computer. Shows whether the [helper app](#helper-app-for-computers) is running, with **Get the helper** and **Check again**. |
| **Songs** | **Link playlist** or **Change playlist**. On the website, also how songs are added (on this site: "Songs are added through your relay"). |

Everything applies as soon as you choose it.

### Audio offset

If the coach looks early or late, adjust the audio offset. This is common with Bluetooth speakers, which add a delay. Press Left or Right during a song (10 ms per step, up to ±500 ms), or use **−10 ms**, **+10 ms** and **Reset** under **Options → Audio offset**. A positive offset makes the coach move later. The setting is remembered.

### Two players

Choose **2 Players** in **Choose your level**. Two coaches dance side by side, as a pair: the female and the male version of the look chosen in **Options** (player 1 is the version chosen there, player 2 the other). Sometimes they do the same move, sometimes mirrored, one after the other, call and answer, or partner moves such as high fives, pat-a-cake, a do-si-do or an elbow swing (turned toward each other, right elbows hooked, skipping round the shared centre). The level rules still apply (Chill has no jumps or crossing over). The choice is remembered until you switch back to **1 Player**.

## How the beat is found

The coach needs to know where the beats are in each song. That information is a small file called a **beat map**. Songs with a beat map are in sync from the first second.

The 97 starter songs already have beat maps, stored with the site. For other songs, a beat map is normally made by a GitHub job that downloads the song and analyses it. **However, YouTube blocks GitHub's servers** ("Sign in to confirm you're not a bot"), so for now the cloud job usually can't download new songs. DanceDance works around this in several layers:

1. **Songs are listed straight away.** Finding the right video doesn't need a download, so added songs and playlist songs can be played before they have a beat map. The tile says **Learning the beat**.
2. **Listening while you play.** For a song without a beat map, the app listens while the song plays. The coach grooves gently for about 10 seconds until it locks onto the tempo, then dances. What it learns is saved on that device, so the next play is in sync from the start.
   - **Share this tab** (Chrome and Edge on a computer, offered first when **Songs without a beat map** is set to **Ask first**): the browser lets the app hear the tab's own audio. When the browser asks what to share, pick this tab and keep "Also share tab audio" on. This is as accurate as a cloud beat map.
   - **Microphone** (any browser): the app hears the song through your mic. A noisy room makes it less accurate. The sound is analysed on your device and never recorded or sent anywhere.
3. **The first full listen in Chrome or Edge saves the beat for everyone.** If a song plays to the end with tab audio (covering at least 85% of it, in practice from the start without skipping) and the beat stayed locked, the app sends the finished beat map (about 10 KB of timings, no sound) to the relay and says "Saved this song's beat for everyone." A short GitHub job checks it and publishes it, usually within a few minutes. Microphone results are never sent. If sending fails, the app tries again next time it opens. On Safari, Firefox, phones and tablets the app explains that the song will sync perfectly once someone has played it in Chrome or Edge on a computer, and offers the microphone.
4. **The helper app** (optional, Mac or Windows): downloads the song on your own computer, whose home connection usually isn't blocked, and finds the beat before the song starts. That map is shared for everyone too. See [Helper app](#helper-app-for-computers).
5. **The Android TV app** downloads the song on the projector and finds the beat there. See [Android TV app](#android-tv-app). (These maps stay on the TV.)
6. **The owner's Mac** can make all pending beat maps in one go with `npm run beatmaps:local`. See [Making beat maps on your own computer](#making-beat-maps-on-your-own-computer).
7. **Optional: cookies from a spare YouTube account** let the cloud job download again. See [When a job goes red](#when-a-job-goes-red).

Rules for shared maps: the song must be in the starter pack, the added songs or the playlist; the map must look like a real song's beat map (one steady tempo between 60 and 220 BPM that matches the beats, covering the song). A map made by the cloud job from a download is never replaced. A map made by listening is replaced by one made from a downloaded copy (helper or local tool), and a later listening map only replaces an earlier one if it covers clearly more of the song. If a shared map is ever wrong, delete `public/beatmaps/<videoId>.json` in the repository; the song goes back to listening.

How good are listening maps? Starter songs played start to end with tab sharing gave the same tempo as the cloud map, with 94–98% of beats within 35 ms of it and no systematic offset. Recordings joined part-way or interrupted were noticeably worse, which is why those are never shared.

## Helper app for computers

The **DanceDance helper** is a small free app for a Mac or Windows computer. While it runs, DanceDance uses your computer to download a song's audio and find its beat before the song starts. You don't need the microphone or tab sharing, and the beat map is shared so everyone else gets the song in sync too. It's optional.

> **Not published yet.** The helper's download links below start working once the owner publishes the first helper release (see [Publishing the helper](#publishing-the-helper)). Until then they give "Not Found".

### Download

- Mac with an Apple chip (M1 or newer): [dancedance-helper-macos-arm64.zip](https://github.com/ryee-dao/dancedance/releases/download/helper/dancedance-helper-macos-arm64.zip). To check your chip, open the Apple menu → **About This Mac**.
- Mac with an Intel chip: [dancedance-helper-macos-x64.zip](https://github.com/ryee-dao/dancedance/releases/download/helper/dancedance-helper-macos-x64.zip)
- Windows (64-bit): [dancedance-helper-windows-x64.exe](https://github.com/ryee-dao/dancedance/releases/download/helper/dancedance-helper-windows-x64.exe)
- Linux (x86-64): [dancedance-helper-linux-x64.tar.gz](https://github.com/ryee-dao/dancedance/releases/download/helper/dancedance-helper-linux-x64.tar.gz). Unpack it and run `./dancedance-helper`.

All downloads, with their checksums, are on the [helper release page](https://github.com/ryee-dao/dancedance/releases/tag/helper). **Options → Helper app → Get the helper** links there too.

### First run on a Mac

The app isn't signed by Apple, so macOS warns you the first time. This is expected.

1. Open the downloaded zip. You get a file called **DanceDance Helper**. Move it somewhere permanent, for example your Applications folder.
2. Double-click it. macOS says it "cannot be opened" or "could not verify" it. Click **Done** (not Move to Trash).
3. Open **System Settings → Privacy & Security**. Scroll down to the message about "DanceDance Helper", click **Open Anyway** and enter your password. On older macOS you can instead right-click the file, choose **Open**, then **Open**.
4. Double-click it again and choose **Open**. A Terminal window opens. That window *is* the helper.

This allows only this one app. Don't turn off Gatekeeper or run commands that remove protections for everything.

### First run on Windows

Double-click the `.exe`. If Windows says "Windows protected your PC", click **More info → Run anyway**. Your browser may also warn that the file "isn't commonly downloaded": choose **Keep**. A black console window opens. That window is the helper.

### Using it

1. Start the helper. The first start takes a few seconds longer while it downloads the YouTube downloader it uses (yt-dlp, about 37 MB, checked against its published checksum).
2. A page opens in your browser saying **DanceDance helper is running**. Click **Open DanceDance**.
3. The first time, Chrome and Edge ask whether DanceDance may connect to "apps on this device" (or "your local network"). Choose **Allow**. That's how the page talks to the helper.
4. Leave the helper window open while you dance.

When a song has no beat map, the "Starting soon" screen shows *Getting the song…* then *Finding the beat…*, and the song starts in sync. While DanceDance is open and no song is playing, the helper also quietly finds the beat of songs that have no map yet: about one song every 25 seconds, at most 20 each time you open the app, pausing while you dance. **Options → Helper app** shows whether it's running and how far it has got.

**Stopping it.** Close its window, press Ctrl+C in it, or click **Stop the helper** on its page.

**Starting it automatically (optional).** You set this up yourself; the helper never changes these settings.

- Mac: **System Settings → General → Login Items → Open at Login → +**, then choose DanceDance Helper.
- Windows: press Win+R, type `shell:startup`, press Enter, and put a shortcut to the `.exe` in the folder that opens.

**Which browsers.** Chrome and Edge work, and Firefox once you allow its one-time question about connecting to apps on this device. Safari doesn't let secure websites talk to apps on the same computer, so the helper isn't expected to work in Safari. On a Mac, use Chrome, Edge or Firefox with it.

**Privacy.** The helper only talks to YouTube (to download songs), to GitHub (for yt-dlp updates) and to the DanceDance page on the same computer. Other websites are refused. The song's audio goes into a private temporary folder and is deleted as soon as the page has it. The page keeps only the small beat map, which is the only thing uploaded. The helper keeps only yt-dlp and a small log in its own folder (Mac: `~/Library/Application Support/DanceDance Helper`, Windows: `%LOCALAPPDATA%\DanceDance Helper`). Delete that folder and the app to remove it completely.

**If it says YouTube blocked it.** YouTube sometimes asks a home connection to "prove it's not a bot". Wait an hour or so. If it says YouTube changed something, the helper updates yt-dlp by itself (at most once a day, or sooner after a failure). If that doesn't help within a few days, download the helper again.

## Android TV app

The TV app is the same DanceDance inside a small Android shell, for a projector or TV you control with a remote. It differs from the website in a few ways:

- **Audio only.** There's no YouTube player on the TV. The app downloads just the song's audio and plays that. It prefers Opus/WebM, the same stream the cloud maps are made from, so beats line up with what you hear; it uses M4A only if the projector can't play Opus, and then removes the format's 36 ms of silent lead-in. Up to 300 MB of songs (roughly 70) are kept so they start instantly next time; the songs you haven't played for longest are deleted first.
- **It finds the beat on the projector.** If a song has a beat map, the TV uses it. Otherwise the projector analyses the downloaded song while the "Starting soon" screen is up, usually in a few seconds. If that takes longer than 15 seconds, it analyses the first 30 seconds, starts the song and finishes the rest in the background. It never uses a microphone.
- **You use your phone, not typing.** The TV shows a QR code; your phone does the rest.
- **Remote control.** Arrows move, OK chooses. Back goes back one screen; Back on the song list closes the app. During a song, Left and Right change the audio offset.

### Install on the Epson projector

You do this once. The projector needs to be on Wi-Fi.

1. On the projector, open the **Google Play Store**, search for **Downloader** (by AFTVnews) and install it.
2. Let Downloader install apps: **Settings → Apps → Security & restrictions → Unknown sources**, then turn on **Downloader**. On some models the path is **Settings → Device Preferences → Security & restrictions → Unknown sources**.
3. Open **Downloader**. If it asks for access to files, allow it.
4. In the address box, type this and choose **Go**:
   `https://github.com/ryee-dao/dancedance/releases/latest/download/dancedance.apk`
5. When the download finishes, choose **Install**, then **Done**. Downloader offers to delete the downloaded file: choose **Delete**, the app is already installed.
6. Press **Home**, open the **Apps** row and start **DanceDance**. To pin it to your favourites, highlight it, hold OK and choose **Add to favourites**.

### Link your playlist with the QR code

1. The first time it starts, DanceDance shows a QR code. Later, choose **Add songs from your phone** at the top of the song list to get it back.
2. Make sure your phone is on the same Wi-Fi as the projector, then scan the code.
3. On the page that opens (**DanceDance on your TV**), choose **Link your playlist** and paste your YouTube playlist link. Optionally paste a GitHub token (see [TV token](#optional-a-github-token-for-the-tv)).
4. Press **Send to TV**. The phone says whether the playlist could be read, and the TV loads it straight away.

The TV reads your playlist again every time the app opens, so songs you add on your phone show up by themselves.

### Find a song from your phone

No GitHub token needed.

1. On the phone page, choose **Find a song** and search for a song and artist.
2. Tap the right match. Its length comes from Apple's iTunes catalogue.
3. The TV searches YouTube itself and suggests the best video, using the same rules as the cloud job (official lyric video or official audio first, then a popular lyric video, then the artist's own audio track; no live versions, remixes, covers, sped-up versions or wrong lengths).
4. Press **Add to my TV**, or **Add this one instead** under one of the other suggestions.

The song appears in **My added songs** on the TV right away. Songs added this way are stored on the TV only; remove them from **Songs you added** at the bottom of the phone page. Songs added on the website also show up on the TV.

### Diagnostics

If the projector feels slow or the coach looks choppy, go to **Add songs from your phone → Diagnostics**. Play a song first, then read:

- **Frame time**: how long the projector takes to draw each frame. Under 20 ms (50+ fps) is smooth, 20–33 ms is fine, over 33 ms (under 30 fps) looks choppy. "Long frames" counts frames over 50 ms, which show as hitches.
- **Last beat analysis**: how long the projector took to find the beats in the last new song. The target is under 15 seconds.
- **Song cache**: how much downloaded audio is stored.
- **Cloud trigger** and **Last trigger**: whether the TV can start the beat-map job and what GitHub answered last time. "Rejected the token" means the token needs replacing: re-link from your phone with a new one.

If the frame time is consistently over 33 ms, note the numbers: drawing the coach natively on Android is the planned fallback.

### Updating the TV app

1. The owner makes a new release (see [TV releases](#tv-app-releases)).
2. On the projector, open **Downloader**, enter the same address again (it's in Downloader's history) and install.

With the signing key set up, the update installs over the old version and keeps your playlist and settings. If the projector says **App not installed**, the old and new versions have different signing keys (a release was built without the signing secrets). Uninstall DanceDance (**Settings → Apps → DanceDance → Uninstall**), install again and re-link your playlist.

### TV troubleshooting

- **"YouTube changed something. Update the app (NewPipe Extractor v0.x.y)."** The TV reads YouTube with a library called NewPipe Extractor, which needs an update when YouTube changes. The owner bumps it (see [Updating NewPipe Extractor](#updating-newpipe-extractor-for-the-tv)). Songs already downloaded keep playing meanwhile.
- **"YouTube is asking this projector to prove it isn't a bot."** YouTube is temporarily limiting your home connection. Wait an hour or so. Downloaded songs still play.
- **The phone can't open the QR page.** Phone and projector must be on the same Wi-Fi, with the phone's mobile data off or Wi-Fi preferred. Guest networks and networks with "AP/client isolation" block devices from talking to each other; use your main Wi-Fi. The page only works while the QR screen is open on the TV.
- **A song is skipped as "Unavailable" or "Can't play here".** The video was removed, made private, is age-restricted or is blocked in your country. Replace it in your playlist.

## Owner's guide

### At a glance: things only the owner can do

- [ ] **Redeploy the relay** (`npx wrangler deploy` in `cloudflare/add-song-worker`). On 2026-11-11 the live relay's `/health` did not yet report `mapDailyLimit`, which the current code does, so it looks older than the code and may not accept shared beat maps (`POST /map`). After deploying, check `https://dancedance-add-song.ryee.workers.dev/health?probe=1`.
- [ ] **Publish the first helper release** (tag `helper-v0.1.0`). Until then the helper download links don't work.
- [ ] **Keep the repository settings and variables below in place**, especially `ADD_SONG_URL`.
- [ ] **Run `npm run beatmaps:local -- --push`** on your Mac now and then, to turn pending songs into proper beat maps while GitHub's runners are blocked.
- [ ] Optional: add `YT_COOKIES` from a **spare** Google account so the cloud job can download again.
- [ ] Optional: set up the TV signing key (needed before updates can install over the current app without an uninstall).
- [ ] Every 60 days of no activity: re-enable the hourly **Beat maps** workflow if GitHub paused it.

### Repository settings

In [ryee-dao/dancedance](https://github.com/ryee-dao/dancedance) (or your fork):

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. **Settings → Actions → General → Workflow permissions → Read and write permissions → Save.** This lets the beat-map job commit beat maps.
3. Add the variables and secrets below under **Settings → Secrets and variables → Actions** (Variables tab or Secrets tab).

The repository must be public for free GitHub Pages and unlimited Actions minutes.

| Name | Kind | Used by | What it's for |
| --- | --- | --- | --- |
| `PLAYLIST_URL` | variable | Beat maps | Your playlist link. Without it the job only handles the starter pack and added songs. |
| `ADD_SONG_URL` | variable | Deploy site | The relay address, built into the site, e.g. `https://dancedance-add-song.ryee.workers.dev`. Keep it set: when it's empty, the deploy job builds with an empty value, which overrides the address in `.env`. |
| `YTDLP_VERSION` | variable | Beat maps | Optional. Pins yt-dlp to a release, e.g. `2026.10.26`. Delete it to go back to the latest. |
| `YT_COOKIES` | secret | Beat maps | Optional. YouTube cookies from a spare account, if runners are bot-blocked. |
| `COOKIE_REFRESH_TOKEN` | secret | Beat maps | Optional. Token with only "Secrets: read and write" on this repo; lets the job keep `YT_COOKIES` fresh. |
| `ANDROID_KEYSTORE_B64` | secret | Android TV app | Signing key, base64. |
| `ANDROID_KEYSTORE_PASSWORD` | secret | Android TV app | Keystore password. |
| `ANDROID_KEY_ALIAS` | secret | Android TV app | `dancedance`. |
| `ANDROID_KEY_PASSWORD` | secret | Android TV app | Key password (the same as the keystore password with the command below). |

The relay's GitHub token is **not** stored in GitHub; it lives in the Cloudflare Worker.

### The workflows

| Workflow | Runs when | What it does |
| --- | --- | --- |
| **Deploy site** (`deploy.yml`) | Every push to `main`, by hand, or after **Beat maps** commits | Type-checks, tests, builds and publishes to GitHub Pages. |
| **Beat maps** (`beatmaps.yml`) | Every hour (at :23), by hand, from the relay | Makes beat maps for songs without one, adds songs by search, publishes shared maps ("Contributed beat map" runs), then redeploys. |
| **Android TV app** (`android.yml`) | A pushed `v*` tag, or by hand | Builds `dancedance.apk` and publishes a release. |
| **Helper app** (`helper.yml`) | A pushed `helper-v*` tag, or by hand | Tests and builds the four helper downloads and updates the `helper` release. |

**Beat maps → Run workflow** has optional fields: **video_id** processes one video (the 11 characters after `v=`); **force** redoes songs that already have a map; **add_artist**, **add_title** and **add_duration** add a song by search (length in seconds, looked up when empty). Leave **add_queue** (filled in by the app) and **map_json** (filled in by the relay) empty. A normal run handles up to 25 songs.

### The Cloudflare relay

A tiny Cloudflare Worker (free plan) holds a GitHub token so that browsers don't need one. This repository's relay is `https://dancedance-add-song.ryee.workers.dev`, configured in `cloudflare/add-song-worker/wrangler.toml` (`GITHUB_REPO = "ryee-dao/dancedance"`, `ALLOWED_ORIGINS = "https://ryee-dao.github.io,http://localhost:5173"`).

What it accepts:

- `POST /add`: add a song. The app sends the song's Apple track ID (plus artist, title and length); the Worker looks it up with Apple itself and starts **Beat maps**, using the app's details only if Apple's lookup fails. Soft limit `DAILY_LIMIT`, default 30 a day (it counts manual runs of the job in the last 24 hours).
- `POST /map`: a shared beat map. It checks the map and starts a short "Contributed beat map" run. Soft limit `MAP_DAILY_LIMIT`, default 60 a day, counted separately.
- `GET /health`: shows it's running. `GET /health?probe=1` also looks up one well-known song with Apple and shows `"apple": "ok"` or what went wrong (`apple-403` if Apple refuses the Worker, `apple-timeout`, `apple-bad-json`). Either way it still adds songs using the details the app sends.

It only accepts requests from `ALLOWED_ORIGINS`. If you set the optional `ADD_PASSPHRASE` secret, the app asks for it once per browser (**Options → Relay passphrase**), for adding songs and sharing maps.

**Set it up or redeploy it.** The Worker doesn't update itself: after any change in `cloudflare/add-song-worker`, deploy again.

1. Make a fine-grained GitHub token: profile picture → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**. **Repository access:** *Only select repositories* → this repository. **Repository permissions → Actions:** *Read and write*. Nothing else.
2. From the project folder:
   ```sh
   cd cloudflare/add-song-worker
   npx wrangler login
   npx wrangler secret put GITHUB_TOKEN      # paste the token (first time, or when it expires)
   npx wrangler secret put ADD_PASSPHRASE    # optional
   npx wrangler deploy
   ```
   `deploy` prints the Worker's address.
3. Set the repository variable `ADD_SONG_URL` to that address and run **Actions → Deploy site → Run workflow**. For local builds, `.env` holds the same address (`VITE_ADD_SONG_URL`).
4. Check `https://<worker address>/health?probe=1`.

**For a fork:** change `GITHUB_REPO` and `ALLOWED_ORIGINS` in `wrangler.toml` to your own. Without a relay, the site shows **Connect to GitHub** under **Options → Songs**, where each browser can paste either a relay address or a GitHub token (made as in step 1). The token is stored only in that browser and only ever sent to GitHub; **Disconnect** forgets it. The worst someone with the token could do is start or cancel the repository's jobs. Without a relay, listening maps aren't shared.

### TV app releases

Release `v0.1.0` exists. The TV always installs from `https://github.com/ryee-dao/dancedance/releases/latest/download/dancedance.apk`, which points at the newest release marked "Latest".

To make a newer build:

1. Push a higher version tag from the project folder, for example:
   ```sh
   git tag v0.2.0 && git push origin v0.2.0
   ```
   Or use **Actions → Android TV app → Run workflow**, which publishes a release named `tv-build-<run number>`.
2. After a few minutes `dancedance.apk` is on the **Releases** page. Then update the TV.

The build bakes in the Pages address (where beat maps live) and the repository name (for the TV's trigger), so there's nothing to configure in the app.

#### Signing key (one-time, strongly recommended)

Android only installs an update over an existing app if both are signed with the same key. Without your own key, each release gets a throwaway key, so every update needs an uninstall and a re-link. Without the secrets the build still works but shows a yellow warning that the APK is debug-signed.

1. On your computer, in a folder **outside** this project:
   ```sh
   keytool -genkeypair -v -keystore dancedance-release.jks -alias dancedance \
     -keyalg RSA -keysize 4096 -validity 10000
   ```
   Choose a strong password and keep it. Any name values are fine. `keytool` comes with Java; if you don't have it, `brew install openjdk@17` and run `$(brew --prefix openjdk@17)/bin/keytool`.
2. Turn the file into text: `base64 -i dancedance-release.jks | pbcopy` (Mac, copies it) or `base64 -w0 dancedance-release.jks` (Linux, prints it).
3. Add the four `ANDROID_*` secrets from the table above.
4. Keep `dancedance-release.jks` and its password safe, for example in a password manager. If you lose them, the next update needs an uninstall. Never commit the file (`.gitignore` already ignores `*.jks` and `*.keystore`).

#### Optional: a GitHub token for the TV

With a token, the TV can ask GitHub to run **Beat maps** right away for playlist songs without a map, instead of waiting for the hourly run. While GitHub's runners are blocked by YouTube this helps little, because the TV makes its own beat maps anyway.

1. Make a fine-grained token: **Token name** `DanceDance TV`, **Expiration** up to a year, **Repository access** *Only select repositories* → this repository, **Repository permissions → Actions:** *Read and write*. GitHub adds "Metadata: Read-only" by itself.
2. Copy it (it starts with `github_pat_`) and paste it into the phone page when you link the TV. It's stored encrypted on the TV and never shown again. Don't store it in GitHub.

When it expires, **Diagnostics** says so; re-link with a new one.

#### Updating NewPipe Extractor for the TV

1. Check <https://github.com/TeamNewPipe/NewPipeExtractor/releases> for a release newer than the one in the error message.
2. In `android/gradle/libs.versions.toml`, change the one line marked "bump this": `newpipeExtractor = "v0.27.1"` (current) to the new version.
3. Commit, push, and push a new `v…` tag. Then update the TV.

If there's no newer release yet, wait a few days and check again.

### Publishing the helper

The helper's code is in `helper/` (TypeScript for Deno, built into single files with `deno compile`, no installer). No helper release exists yet. To publish one:

1. Set `"version"` in `helper/deno.json` (it is `0.1.0` now; raise it for later releases) and commit.
2. Push a matching tag:
   ```sh
   git tag helper-v0.1.0 && git push origin helper-v0.1.0
   ```
   Or use **Actions → Helper app → Run workflow**.
3. The job tests, builds the four downloads and creates (later: updates in place) the release tagged **`helper`**, so the download links never change. That release is never marked "Latest", so the TV's `releases/latest/download/dancedance.apk` keeps pointing at the TV app. TV tags start with `v`, helper tags with `helper-v`.

Notes for maintenance:

- The site the helper trusts and opens is baked in from the repository name (`https://ryee-dao.github.io` and `https://ryee-dao.github.io/dancedance/`). For a custom domain, put a file named `dancedance-helper.json` next to the helper:
  ```json
  { "allowedOrigins": ["https://dance.example.com"], "siteUrl": "https://dance.example.com/", "allowLocalhost": true }
  ```
  `allowLocalhost` (default `true`) lets `http://localhost:*` dev servers use it.
- It listens on `127.0.0.1` only, port 47800 (or 47801, 47802 if taken). `GET /health` returns `{ ok, app, version, ytdlp, platform, ready, state }`; `GET /status` adds current downloads and recent results; `POST /audio` with `{"videoId":"<11 characters>"}` returns the audio, with error codes `blocked`, `outdated`, `unavailable`, `network`, `error`, `not-ready`, `busy` and `rate-limited`; `GET /` is its status page.
- Security: every request must carry `Host: 127.0.0.1:<port>` (blocks DNS rebinding). A request with an `Origin` must come from an allowed site; `POST /audio` requires one plus JSON, so it always gets a CORS preflight, which answers `Access-Control-Allow-Private-Network`. Only the video ID comes from the page; yt-dlp runs with a fixed argument list and no shell. At most 2 downloads at once and 8 a minute; audio is limited to 40 MB and 15 minutes, no live streams.
- yt-dlp is the official release binary (`yt-dlp_macos`, `yt-dlp.exe`, `yt-dlp_linux`), verified against the release's `SHA2-256SUMS` when downloaded and at every start, and updated when a newer release exists (checked at most daily).
- yt-dlp needs a JavaScript runtime for YouTube. The helper is built on Deno, so it acts as that runtime (`--js-runtimes deno:<helper>`), running YouTube's challenge script in a worker with no permissions. If a future yt-dlp changes how it calls Deno, songs fail as `outdated` until the helper is rebuilt.
- It downloads audio-only Opus/WebM (or M4A if that's all there is), which the browser decodes, so no ffmpeg is needed. Beats found from Opus match the cloud maps; AAC came out about 30 ms late in Chrome.
- Local checks: `cd helper && deno task test`, `deno task build` (all targets into `helper/dist/`, git-ignored) or `deno task build --target aarch64-apple-darwin`, and `deno task start` to run from source.

### Making beat maps on your own computer

Your home connection usually isn't blocked by YouTube, so your Mac can do what the cloud job can't. You need Node.js 22+, **yt-dlp**, **ffmpeg** and **Deno** (yt-dlp uses it for YouTube). On a Mac with Homebrew: `brew install yt-dlp ffmpeg deno`.

The all-in-one command, from the project folder:

```sh
npm run beatmaps:local            # pull, make every pending beat map, show what changed
npm run beatmaps:local -- --push  # ... then commit only the beat-map files and push them
```

It handles songs the cloud couldn't download (ignoring the usual waiting time), listed songs without a map and songs whose only map came from listening (up to 50 per run; change with `--limit <n>`; `--playlist <url>` overrides the playlist). It refuses to run if you have other uncommitted changes (`--allow-dirty` runs anyway and still commits only beat-map files). Without `--push` it stops before committing and lists what it would commit. Pushing starts the site deploy as usual.

Optional, to run it every 10 minutes while your Mac is on: save the following as `~/Library/LaunchAgents/app.dancedance.localsync.plist` (change the path), then run `launchctl load ~/Library/LaunchAgents/app.dancedance.localsync.plist`. Remove it with `launchctl unload` on the same file and delete the file. This is only an example; nothing installs it for you.

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

The lower-level tool, for one-off jobs:

```sh
npm run beatmaps -- --only <videoId>                     # one video
npm run beatmaps -- --limit 5                            # at most 5 songs this run (default 25)
npm run beatmaps -- --force                              # redo songs that already have a map
npm run beatmaps -- --retry-blocked                      # retry songs YouTube blocked, right away
npm run beatmaps -- --dry-run                            # list what would be processed; downloads nothing
npm run beatmaps -- --add "a-ha - Take On Me"            # add a song by search (length looked up on iTunes)
npm run beatmaps -- --add "a-ha - Take On Me" --dry-run  # just show which video it would pick
PLAYLIST_URL='https://www.youtube.com/playlist?list=…' npm run beatmaps
```

(`--contributed-map` is used only by the cloud job to check and publish a shared map.)

Where things are written: beat maps in `public/beatmaps/`; songs added by search in `public/songs.json` (fields: `videoId`, `title`, `artist`, `addedAt`, `durationSec`, `hasMap` — `false` until the map exists — then `note`, e.g. `"music-video"`, and `genre`, the iTunes genre, when known; `public/beatmaps/index.json` repeats the genre for songs with a map); songs that couldn't be added, and `map-pending` notes for listed songs still waiting for a map, in `public/songs-status.json`. Audio goes to a temporary folder and is deleted as soon as each song is analysed. To remove an added song for everyone, delete its entry in `public/songs.json`.

### When a job goes red

A failed run shows a red ✗ under **Actions**. Open it: the summary at the top says what went wrong. One song failing (private, removed or region-locked) doesn't turn the run red; something affecting every song does.

**"YouTube is bot-blocking this runner".** This is the current, expected state: YouTube refuses GitHub's servers. Songs still get listed and play (see [How the beat is found](#how-the-beat-is-found)). Either run `npm run beatmaps:local -- --push` on your Mac, or give the cloud job cookies:

> **Use a spare Google account, never your main one.** Google can flag or suspend accounts whose cookies are used by download tools. Create a new, throwaway account and use it for nothing else.

1. Install a browser extension that exports cookies in "Netscape" / `cookies.txt` format (for example "Get cookies.txt LOCALLY" for Chrome or "cookies.txt" for Firefox).
2. Open a **private/incognito window**. Allow the extension in private windows if asked.
3. In that window, sign in to YouTube with the **spare** account and play any video for a few seconds.
4. Still on youtube.com, export cookies for `youtube.com` and save the file.
5. **Close the private window without signing out.** Signing out cancels the cookies.
6. In GitHub: **Settings → Secrets and variables → Actions → Secrets → New repository secret**. Name `YT_COOKIES`, value: the whole file. Then delete the file from your computer.
7. Run **Beat maps** again by hand.

Cookies expire after weeks to months. If the error returns, repeat and update the secret. The job never prints the cookies.

**Optional: keep the session fresh automatically.** Add a second secret, `COOKIE_REFRESH_TOKEN`: a fine-grained GitHub token limited to this repository with only **Secrets: read and write** (github.com → Settings → Developer settings → Fine-grained tokens). With it, the job saves the cookies YouTube refreshes during each run back into `YT_COOKIES`, and once a day asks YouTube for the details of one published song (no download) so the session stays in use. This only stretches the life of a session: it cannot sign in again, so when YouTube ends the session you still export fresh cookies by hand. The token can overwrite this repository's secrets but cannot read them; it expires on the date you choose, and the job warns when saving fails.

**"yt-dlp is out of date".** YouTube changed something and yt-dlp needs an update, which usually appears within days. The job installs the newest yt-dlp on every run, so it usually fixes itself; wait a day or two and run it again. If a new yt-dlp release is itself broken, pin an older one with the `YTDLP_VERSION` variable.

**"Could not read the playlist".** Check that `PLAYLIST_URL` is the full playlist link and the playlist is Public or Unlisted.

**The hourly job stopped running.** GitHub pauses scheduled workflows in a public repository after **60 days with no activity**, and emails you first. Go to **Actions → Beat maps** and click **Enable workflow**.

## How the dances are made

### The move library

The coach picks from **657 base moves** in nine families (Latin, disco, funk, hip-hop, pop, rock, K-pop, party and aerobics), defined in `src/core/choreo/families/*.ts`, plus about 1,100 variations of them that are generated and checked automatically. Two-player mode adds 24 partner-only moves.

### Levels

| Level | What changes |
| --- | --- |
| **Chill** | Easiest moves only, each repeated for longer, no jumps, almost no variations. |
| **Cardio** | Easy and medium moves, shorter repeats, some variations and flourishes. |
| **Sweaty** | All moves, more high-impact ones, the most variations. |

Each move repeats long enough to pick up, and every chorus opens with the song's signature combo.

### Song styles

Each song gets a style, shown on the coach's NOW label (for example "Latin groove"): which move families it leans toward, which body parts to favour, and a few themes. Most of the moves (roughly 60–70%) then come from the song's families. The style is decided in this order, first match wins:

1. The song's own `style` in `src/data/starter.json` (starter songs).
2. The artist, from a built-in table in `src/core/choreo/songStyle.ts` (any credited artist counts).
3. The iTunes genre recorded when the song was added.
4. Otherwise a balanced pop mix.

Words in the title add themes ("Hips", "Jump", "Spin", "Clap" …), and the tempo nudges the mix a little.

**To override a song's style**, add or edit its `style` in `src/data/starter.json`, for example:

```json
"style": { "families": { "latin": 1, "pop": 0.3 }, "themes": ["hips"], "focus": { "hips": 1.5 }, "signature": ["hip-sway", "hip-shake"] }
```

`signature` names one or two move ids (from `src/core/choreo/families/*.ts`) that open every chorus.

### Signature nods

A few famous songs open each chorus with the move everyone knows, for example Gangnam Style (gallop and lasso), Hips Don't Lie (hip sway and shake), The Twist, Stayin' Alive (disco point), U Can't Touch This, Party Rock Anthem (running-man shuffle) and Watch Me (whip and nae nae). The list is `SONG_SIGNATURES` in `src/core/choreo/songStyle.ts`.

### Same routine or new

Routines are worked out from the song, level and style, so with **Options → Routine → Same every time** a song always gets the same routine. **New every time** mixes in the play number; the chorus combo stays the same.

## Development

You need [Node.js](https://nodejs.org) 22 or newer.

```sh
npm install
npm run dev        # starts the app at http://localhost:5173
npm test           # runs the tests
npm run typecheck  # type-checks
npm run build      # production build into dist/
```

Demo benches, with the dev server running:

- `http://localhost:5173/coach-demo.html`: the single coach. For example `?mode=gallery&move=<id>` loops one move, `?mode=sheet&family=rock` shows a contact sheet, `?style=classic|human|sticker` picks the look, `?build=female|male` the version, `?compare=1` shows all three looks.
- `http://localhost:5173/duo-demo.html`: two-player mode (`?style=`, `?build=` for player 1; `?mode=sheet&moves=duo-elbow-swing&beats=0,1.5,3` shows partner moves at chosen beats).

To add or change dance moves, read `src/core/choreo/AUTHORING.md` (where moves live, coordinates, checks with `tools/moves/check.ts`, and the quality bar).

### Building the TV app on your own computer

You need Node.js 22+, JDK 17 and the Android SDK (platform 35, build-tools 35.0.0).

```sh
npm ci && npm run build            # the web app, bundled into the APK
cd android
./gradlew assembleDebug            # app/build/outputs/apk/debug/app-debug.apk
```

Builds made this way don't know the Pages address, so they have no cloud beat maps and no TV trigger; everything else works, including on-device analysis. To include them, add `-Pdancedance.pagesBaseUrl=https://ryee-dao.github.io/dancedance/ -Pdancedance.githubRepo=ryee-dao/dancedance` (or your fork's).

### Setting up a fork

1. Create a public repository on GitHub. Don't add a README or licence.
2. Push this project: `git remote add origin https://github.com/<your-username>/<your-repo>.git` then `git push -u origin main`.
3. Follow [Repository settings](#repository-settings), then run **Actions → Beat maps → Run workflow** once (leave the fields empty). It redeploys the site when it finishes; if not, run **Actions → Deploy site**.
4. Your site is at `https://<your-username>.github.io/<your-repo>/`. Set up your own relay (see [The Cloudflare relay](#the-cloudflare-relay)), set `ADD_SONG_URL` to it and replace the address in `.env` (used for local builds). If you leave `ADD_SONG_URL` unset, the deployed site has no relay and offers **Connect to GitHub** instead.

## Limits and a note on YouTube's terms

- Downloading audio from YouTube, as the beat-map job, the helper, the local tool and the TV app do, is against YouTube's Terms of Service. So is playing videos in a near-invisible player. This project is for **personal use only**: don't run it as a public service.
- No audio is stored or uploaded anywhere: downloads go to temporary folders (or the TV's own song cache) and only beat maps, which are timings, are kept and shared.
- In practice the risks are that things break when YouTube changes, and that the account whose cookies you use (if any) gets flagged. That's why it must be a spare one.
- YouTube currently blocks GitHub's servers, so new songs rely on the other layers in [How the beat is found](#how-the-beat-is-found).
