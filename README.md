# JOE MASTER UNIVERSE

A PS2-style party wrestling game for up to 4 players, with phones as the controllers.

There is a multiverse of Joe Masters, and they fight each other. Only one of them is **THE ORIGINAL**: the Podfather himself, the world's most famous podcast host. Everyone else is "*Your-Name* MASTER" from some other universe, in whatever outfit that universe dressed them in.

## Put it online (GitHub Pages, free)

The game is a plain website, so GitHub can host it for free. Phones connect straight to the game screen over the internet. PeerJS's free connection service only introduces them, then the button presses go device-to-device.

1. **Make a GitHub account** at github.com/signup. The username becomes the web address, so pick something like `joemasteruniverse` to get **https://joemasteruniverse.github.io**.
2. **Create a repository** (the **+** at the top right → *New repository*) named exactly `YOUR-USERNAME.github.io`, for example `joemasteruniverse.github.io`. Leave it **Public**.
3. **Upload the game:** on the new repo's page click *uploading an existing file*. Drag in **everything inside** this folder: `index.html`, `play.html`, the `js`, `img`, `vendor`, `music`, `server` and `tools` folders, plus `.github` and `.nojekyll` if Windows shows them. Click *Commit changes*.
4. **Turn on Pages:** go to *Settings → Pages*, set **Source** to *Deploy from a branch*, choose **main** and **/ (root)**, then *Save*.
5. Wait a minute or two, then open **https://YOUR-USERNAME.github.io** on the TV or laptop. Phones scan the QR, or go to the same address and type the **room code** shown on screen.

To update the game later, upload the changed files the same way; GitHub republishes automatically.

**Adding music later:** upload songs into `music/background` (or `music/intro` for a separate entrance song). A built-in GitHub Action updates the music list (`music/music.json`) for you. If the music doesn't show up, check *Settings → Actions → General → Workflow permissions* is set to *Read and write*. Or run `node tools/update-music.js` on your PC and upload the new `music/music.json`.

**Your own domain (optional):** buy one (e.g. joemaster.com.au), then put it in *Settings → Pages → Custom domain* and follow GitHub's instructions for your domain seller.

**Good to know**
- The repository is public, so anyone who finds it can download the files, including Joe's theme.
- It needs internet on the TV and the phones. The phones don't have to be on the same Wi-Fi, though phones on the same Wi-Fi connect most reliably.
- The room code stays the same when you refresh the game screen, and phones reconnect by themselves.

## Play without internet (optional)

Run it from your own PC on your Wi-Fi instead. You need [Node.js](https://nodejs.org), and nothing else to install.

- **Windows:** double-click `start.bat`
- **Anywhere:** `node server/server.js`

Then open **http://localhost:3000** on the PC and scan the QR with phones on the same Wi-Fi. Windows may ask whether Node can use the network the first time; allow it on **private networks**.

## Music

Joe's theme (`music/background/Joe Master Theme.mp3`) is the only music included. It loops in the lobby and during matches. At the start of every match it jumps back to the top and turns up for the entrance, then drops back under the action after the bell. It does the same again for the winner.

To add more music later, put files in `music/background/` (shuffled loop). If you want a separate entrance song, put it in `music/intro/`. Supported formats are mp3, m4a, ogg, wav, flac, aac, opus and webm, and no restart is needed. Press **N** or the ♪ button to turn music on or off.

## Players

On the phone, people choose one of two options:

- **THE ORIGINAL:** play as JOE MASTER. Only one person can be him; if he's taken, you become a variant. When no human picks him, he plays as a CPU, so he's always on the card (bring him back with **+ ORIGINAL JOE** if you remove him).
- **BECOME A MASTER:** type your name and "MASTER" is added to the end ("Jayden" becomes **JAYDEN MASTER**). You get a random outfit from a random universe. 🎲 *Different universe* rerolls it. No two wrestlers in a match share an outfit.

Everyone has Joe's face, beard and shades by default. Under "Use my own face" on the phone you can take a selfie instead. You can also drag a photo onto a wrestler's card in the lobby.

### The outfits

| Universe | Outfit | CPU name |
|---|---|---|
| EARTH-1 | **The Original**: JOE MASTER tank top, white long shorts, purple accents | JOE MASTER |
| EARTH-POD | **The Podfather**: eggplant-print shirt, jeans, headphones round the neck | POD MASTER |
| EARTH-1984 | **Sparkle Motion**: glitter singlet, pink fringe, shutter shades, headband, face and eggplant kneepads | GLITTER MASTER |
| EARTH-52 | **El Maestro**: sombrero, tank top, jeans, red shades | SOMBRERO MASTER |
| EARTH-1977 | **Disco Inferno**: shaggy wig, tank top, floral leggings, fringe everything | DISCO MASTER |
| EARTH-831 | **School Days**: Japanese sailor uniform, red bow, knee socks | SENPAI MASTER |
| EARTH-1600 | **The Last Samurai**: red lacquered armour, kabuto, hakama | SHOGUN MASTER |
| EARTH-619 | **Lucha Libre**: purple-and-gold mask, cape, tights | MASKED MASTER |
| EARTH-$$$ | **CEO of Podcasting**: suit and purple tie | BOARDROOM MASTER |
| EARTH-69 | **The Aubergine**: full eggplant mascot suit | EGGPLANT MASTER |
| EARTH-2001 | **One Giant Slam**: space suit and bubble helmet | SPACE MASTER |
| EARTH-7-SEAS | **Captain Podbeard**: tricorn, eye patch, puffy shirt | CAPTAIN MASTER |

All outfits are defined in `js/characters.js`. To add another, copy an entry in `COSTUMES` and add its id, title and universe to the list near the top of the script in `play.html`.

## The legend (as Joe tells it)

The game believes everything Joe believes about himself:

- **Tale of the tape:** whenever the Original is in a match, he gets a full entrance with pyro and this on screen: 6'0", 84 kg, *The Podfather*, signature move *Small Package*, debut 2025.
- **Ticker and titantron:** the lobby ticker scrolls his career highlights, and the titantron cycles them during matches. That includes pinning Einar the Strange "totally clean and with no help at all", his undefeated record… against Layla Paige, and being Party Guy Ty's stunt double.
- **Signature move, the SMALL PACKAGE:** with a full meter, grab someone and press grab again. It's a roll-up straight into a pin, and it's very hard to kick out of. Pull the stick back instead for **THE MIC DROP**.
- **Totally clean:** the referee counts the Original's pins noticeably faster. Totally clean, with no help at all.
- **Taunt:** every Joe Master's taunt is the signature pose. The Original's gets a "JOE! JOE! JOE!" chant.

## Controls (phone)

| Button | What it does |
|---|---|
| □ STRIKE | jab → hook → kick combo. On someone who's down: stomp |
| ○ GRAB | grab. Grab again to body slam. **Pull the stick away from them + grab** for a suplex. On a downed opponent: **pin** |
| ✕ RUN | hold to run and bounce off the ropes. Strike while running = clothesline |
| △ BLOCK | stops strikes (grabs beat blocks) |
| TAUNT | signature pose, fills your meter |

- **Mash any button** to escape grabs, get up faster, and kick out of pins.
- Free-for-all: pin someone for a 3-count and they're out. The last Master standing wins.

Keyboard player on the PC: `WASD` move, `J` strike, `K` grab, `Shift` run, `L` block, `I` taunt.
Other keys: `Enter` start, `C` add a CPU, `P` cycle the retro filter, `M` announcer voice, `N` music, `Esc` back to the lobby.

## Files

- `index.html` + `js/host.js` is the game screen (lobby, roster, match flow, camera, HUD, music).
- `play.html` is the phone controller.
- `js/net.js` handles phone connections (peer-to-peer on GitHub Pages, or the local server), and `js/qr.js` draws the join QR.
- `server/server.js` is the optional local Wi-Fi server. `tools/update-music.js` and `.github/workflows/music.yml` keep `music/music.json` up to date.
- `js/characters.js` holds every outfit, Joe's bio and the "___ MASTER" naming. `rig.js` builds the models from those outfits, and `poses.js` has the animations, including the signature pose (`joeSignature`).
- `js/game.js` holds the match rules, the Small Package and the "totally clean" count. `arena.js` builds the ring, crowd, billboards and titantron. `audio.js` has the sound effects and music player. `ps2.js` is the low-res PS2 filter, and `ai.js` drives the CPUs.
- `img/icon.jpg` is Joe's icon, used on the billboards, mat, apron and barricades. `img/costumes/` holds the outfit previews.
