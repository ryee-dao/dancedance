# Authoring dance moves

The coach is a flat, front-facing 2D figure projected on a wall; the player
mirrors it. Every move must be **real, recognisable, copyable at tempo,
readable from the front, and distinct**. Quality beats quantity: do not pad.

## Where moves live

| File | Owns |
| --- | --- |
| `families/shared.ts` | neutral footwork (`bounce`, `plant`, `sway`, `groove`, `hipSway`), resting arms (`rest`, `hips`, `guard`), turns (`spin`, `spinSway`, `halfTurn`, `backShake`, `pivot`, `turnArms`, `turnUp`), torso/head accents, the idle groove. Maintainer only. |
| `families/aerobic.ts` | aerobics / dance-fitness staples |
| `families/cooldown.ts` | stretches (outro) |
| `families/latin.ts`, `disco.ts`, `funk.ts`, `hiphop.ts`, `pop.ts`, `rock.ts`, `kpop.ts`, `party.ts` | one style family each (`party` = mime, sports, novelty) |
| `families/afro.ts`, `retro.ts`, `world.ts` | traditions: afrobeats / dancehall / soca, swing / country / folk, Bollywood / hula / belly dance ... |
| `families/named.ts` | named variations: recombinations promoted to first-class moves with their own names |

## Two tiers: global and genre-exclusive

Every move is either GLOBAL (used on any song, where the level allows) or
exclusive to one GENRE set, listed by id in `genres.ts` (`GENRE_MOVES`) and
`genreSets/*.ts`: rock, hip-hop, Latin, disco & funk, K-pop, country, swing,
afro, Caribbean, South Asian, folk, belly dance, hula, capoeira, and the
sub-style sets metal, punk, trap, drill, R&B, house, EDM, bass music,
reggaeton, Brazilian, amapiano, lyrical (see "Genre sets" below). A genre-exclusive move is only
used on songs whose style opens that genre (`songGenres`: the style's
tradition themes, its leading families, its sub-style scores, gated by the
song's calm). When you add a move that only
makes sense with its music (a headbang, a salsa step, a line-dance step, a
K-pop point move), add its id to its genre set; otherwise it is global.
Variations share their move's tier; a recombination takes the genre of a
layer that belongs to one, and two genres are never mixed. A layer pattern
used by any global move counts as global, so don't give a global move the
arms of a genre move (that leaks the genre into every song's variations).

## Genre sets: groups and sub-styles

A song's style comes from the song (`songStyle.ts`): its genre names (the
song's own list, e.g. a Wikipedia infobox, then the iTunes tag as a
tie-breaker), its absolute audio traits from the beat map (`songTraits.ts`:
calm, drive, four-on-the-floor, half-time feel, sub-bass, hats, swing,
syncopation, heaviness), tempo and title words; never the artist's name.
The broad groups (rock, hip-hop, Latin, disco & funk, K-pop, the
traditions) open from the song's family weights and themes; the sub-styles
below open from the style's sub-style scores (genre words + traits,
`SUB_OPEN` 0.5). Each sub-style either ADDS to its group (a metal song
dances rock and metal) or REPLACES it (reggaeton never gets salsa). A set
with fewer than `MIN_GENRE_SET` (6) moves falls back: its parent opens too.
The song's calm closes showpiece sets (no headbangs on a ballad;
`CALM_TOLERANCE` in `genres.ts`) and opens `lyrical`.

| Set | Real dance vocabulary | Opened by | Parent / fallback | Ids go in |
| --- | --- | --- | --- | --- |
| `metal` | headbanging (incl. hair windmill), horns, chug squats, wall-of-death crouch, slow heavy sway with fist | metal names (nu / heavy / death / gothic metal, metalcore ...), "hard rock" partly; heavy + driving audio on a rock song | adds to rock | `genreSets/mood.ts` |
| `punk` | pogo, ska skank, hardcore two-step, circle-pit running, slam dancing | punk / hardcore / pop punk / ska / emo names; fast (150+), driving, rough rock | adds to rock | `genreSets/mood.ts` |
| `trap` | the whip, nae nae, shoot, woah, griddy; quick poses on hi-hat rolls, bounce on the half-time snare | trap, crunk, snap, rage, cloud rap names; half-time feel + hat rolls / heavy 808 | adds to hip-hop | `genreSets/urban.ts` |
| `drill` | drill bounce, arm swings, shoulder rocks, shmoney, the strut | drill (UK / NY / Chicago ...), grime partly; half-time feel + syncopated hats and sliding bass | adds to hip-hop | `genreSets/urban.ts` |
| `rnb` | body rolls, smooth two-steps, shoulder / hip isolations, slow grind grooves | R&B, neo soul, new jack swing, quiet storm; a swung, unhurried groove | none: the family mix opens what it leads | `genreSets/urban.ts` |
| `house` | jacking, lofting, heel-toe footwork, skate / train / farmer, loose legs, voguing hands and frames | house names (deep / tech / Chicago / French, nu-disco, UK garage); four-on-the-floor at ~115-127 BPM | disco & funk (when small) | `genreSets/electronic.ts` |
| `edm` | fist pumping, shuffle (cutting shapes), the jump on the drop, hands-up builds | EDM, big room, electro / progressive house, trance, techno, hardstyle; four-on-the-floor at 124+ | none (global aerobic moves) | `genreSets/electronic.ts` |
| `bass` | DnB skank, rail / wobble bounce, liquid and popping hits, phonk drift arms | dubstep, drum and bass, phonk, future bass; heavy sub-bass with half-time feel, or dense hats at ~170 | none | `genreSets/electronic.ts` |
| `reggaeton` | perreo, dembow step, reggaeton bounce, hip rolls | reggaeton, dembow, urbano, Latin trap; dembow syncopation around 88-100 BPM | dancehall (caribbean); replaces Latin | `genreSets/urban.ts` |
| `brazil` | samba no pé, axé, frevo, passinho / quadradinho (funk carioca), forró | samba, axé, baile funk, sertanejo, forró, MPB, bossa nova | Latin (when small); replaces Latin once big enough | `genreSets/mood.ts` |
| `amapiano` | vosho, pouncing cat, tshwala bam, slow knee bounces on the log drum | amapiano, gqom, kwaito, South African house; log-drum bass at ~108-116 BPM | afro (when small) | `genreSets/mood.ts` |
| `lyrical` | reaches, arm sweeps, port de bras, slow turns, arcing lunges, balances, contractions / releases, body waves | a calm song (`calm` trait ~0.55+), ballads, soft / piano rock, ambient, singer-songwriter, any family | none (smooth global moves) | `genreSets/mood.ts` |

Country is one set: its moves are line-dance / hoedown steps, which serve
country-pop at tempo as well; a country ballad closes it by its calm (and
waltz steps live in `swing`). A two-step is a travelling partner dance that
doesn't read as a solo front-facing move beyond a step-touch.

The files in `genreSets/` are plain id lists with no imports; `genres.ts`
merges them after its own `RAW` lists. Two constraints when moving or adding
ids:
- a move is in at most one set (the tier test checks);
- a recombined variation takes the genre of its layer patterns, and two
  sets never mix (`variations.ts`). A LAYERED move may only change set
  together with every move sharing its genre-specific foot / arm patterns
  (the layered headbangs share the power stance with air guitar, so they
  stay in rock; the layered samba steps recombine with salsa layers in
  `pool.json`, so they stay in Latin). Full-body moves move freely. Moving
  layered moves means regenerating `pool.json` (`npx tsx tools/moves/pool.ts`).

## Tempo: every move's speed limit

`speed.ts` derives a speed limit (BPM) for every move from its keyframes:
how far each joint travels between keys against how fast that joint can move
(hands fastest, the pelvis slowest; a leg lifted while the other carries the
body, or a pelvis that drops or rises, is slower), whole-body turn speed, and
the shortest gap between keys. On a song above a move's limit the move is
danced at half time on its own; if even that is too fast, or a jump would
hang in the air too long at half time, it is not used. Big leg raises,
kicks, high jumps and busy footwork get low limits; bounces, pumps and
step-touches high ones. A new move needs nothing extra. If it looks right
at 120 BPM but its limit (`moveSpeed` in `speed.ts`) comes out well below
that, it is doing more per beat than it should. The tempo weights
(`weights.ts`) apply at the tempo the move is actually danced at.

Each file exports `patterns: PatternSet` and `moves: MoveDef[]`.
`families/index.ts` collects every file (never edit it): it registers all
patterns first, then builds every move, so a file may use any pattern id from
any file (e.g. latin moves use `stepTouch` from aerobic). Pattern ids are
unique per kind (foot / arms / accent) across all files; move ids are unique
across all files. A broken definition is skipped and reported in
`CATALOGUE_ERRORS` instead of breaking the other files.

## Coordinates and channels (figure units: 1.0 = standing height)

- x: screen right (+). The coach is a MIRROR: `r` / `rf` / `handR` / `kneeR`
  are the USER's right, drawn on the screen-right side.
- y: up, floor at 0. z: toward the viewer (+).
- `pose()` specs (see `coach/poses.ts` `PoseSpec`) start from the neutral
  stance and override only what you give:
  - `x` root sway / travel; `y` root height (< 0 knee bend, > 0 airborne; -0.26..0.15)
  - `lean` side bend (deg, + = top toward screen right), `twist` chest yaw,
    `bend` forward bend (+ = toward the viewer)
  - `hips` lateral pelvis shift (units, |..| <= 0.09; the hip goes UP on the
    side it shifts to), `tilt` extra pelvis roll (deg, + = user's right hip up,
    |..| <= 14), `hipTwist` pelvis yaw
  - `chestX` rib-cage slide over the pelvis (units, |..| <= 0.07)
  - `head` roll, `nod` (+ = chin down), `turn` (look right); keep the head
    gentle: |nod| <= 22, |roll| <= 30, |turn| <= 40 (a nod-level headbang, never whiplash)
  - `shR` / `shL` shoulder shrug 0..1.3
  - `r` / `l` arms as `[upperElev, upperPlane, foreElev, forePlane]` (deg):
    elevation 0 = hanging, 90 = horizontal, 180 = straight up; plane 0 = out
    to the side, 90 = toward the viewer, > 90 = across the body, < 0 = behind.
    Easier: `at(side, x, y, z, elbowHint?)` from `poseKit.ts` puts a hand at a
    WORLD position (x = screen x, so the LEFT hand's own side is NEGATIVE x;
    shoulders at (+-0.125, 0.78, 0); chest ~ y 0.7; head centre ~ y 0.93).
    `ARM.*` in `coach/poses.ts` has common shapes (rest, out, up, v, goal,
    hip, guard, jab, sky, cross, clap, clapHigh, swingFwd/Back).
  - `rf` / `lf` foot targets `[x (absolute), lift, forward]`; neutral feet at
    x = +-0.09 (`W`), wide = +-0.13 (`WIDE`). Planted feet stay put while the
    hips move; a foot that changes spot steps on an arc automatically.
  - `kneeR` / `kneeL` knee / toe turn-out (+ out, - in): knee pops, heel swivels.
  - `spin` whole-body turn (deg): see Turns.
  - `slideR` / `slideL: true` on a key: that foot GLIDES to the key's spot
    (no step arc) - slides, swivels, glides.
  - `pitchR` / `pitchL` foot pitch (deg): + = up on the ball of the foot (the
    heel rises automatically, toes stay on the floor), - = heel dig (toes up).
    Reads best in quarter profile; head-on it is a subtle cue.
  - `formR` / `formL: 'point' | 'horns'`: a pointing index finger or rock
    horns (drawn in all three looks; otherwise `handR` 0 = fist, 1 = open).
  - Reach: a hand is at most 0.315 from its shoulder (upper arm 0.165 +
    forearm 0.15); `at()` / `hand()` clamp targets beyond that onto the sphere,
    so a far target silently becomes a straight arm.
  - `handR` / `handL` 0 = fist, 1 = open hand.
- `mir(spec)` mirrors a spec (left/right swapped). `wide(y, extra)` = wide stance.

## Patterns (layers)

```ts
foot: { myStep: { beats: 2, parts: ['legs'], mirror: true, travel: 0.16, keys: [[0, {...}], [1, {...}]] } }
```
- `beats`: 1, 2 or 4. Keys on a quarter-beat grid in `[0, beats)` (whole and
  half beats normally; 0.25 / 0.75 for skips and swung rhythms); each key is
  HIT exactly on its beat (the motion settles after a hit, anticipates, then
  travels). The loop wraps: after the last key comes the first.
- `mirror: true` = written for the user's RIGHT side; repeats alternate sides.
  `travel` = net x per execution (needs `mirror`; the generator always pairs
  it with the mirror so the coach comes back).
- `jump: true` (feet leave the floor; never on Easy), `impact: true` (squats,
  stomps), `torso: true` (this layer's lean / twist / head values drive the
  torso when the move has no accent layer).
- `parts`: which body parts it works (`arms legs torso hips jump turn`); the
  generator varies parts between consecutive moves.
- `label` (optional): short lowercase name of the action ('rolling hands',
  'step touch'), used to name variations ("Grapevine · rolling hands").
- Foot patterns may key only body channels (x, y, hips, tilt, hipTwist, feet,
  knees, spin); arm patterns only arms / hands / shrugs; accents only torso /
  head. Values for other channels in a key are ignored unless the pattern
  leads the torso (`torso: true`) — then lean / twist / bend / head / chestX
  are used.

## Moves

```ts
combo('salsa-basic', 'Salsa Basic', 'salsa', 'salsaArms', 'mid', 2, 'latin | legs hips | walk', { desc: '...' })
full({ id, name, tags, beats, level, d, parts, mirror?, travel?, jump?, impact?, keys: [[0, spec], ...] })
```
- `combo(id, name, footPattern, armPattern, level, difficulty, tags, extra?)`
  layers a footwork and an arm pattern (+ optional `accent`, `shift` = shift
  the arm pattern by N beats). The move lasts the longest pattern's beats;
  shorter ones tile.
- `full({...})` is a hand-authored full-body move (all channels keyed
  together) for what layering can't express.
- `level` = intensity (`low` / `mid` / `high`: how hard it works you).
  `d` = difficulty 1..3 (1 = one body part / very simple; 3 = coordinated,
  travelling or fast changes). Easy (chill) never jumps or turns fast (hard
  rule) and strongly prefers difficulty 1; Medium rarely uses difficulty 3;
  Hard leans toward hard and high-impact moves (soft weights, `weights.ts`).
- Soft weights (`weights.ts`) are derived from the keyframes: impact (jumps,
  squat depth, bounce, the `impact` flag), difficulty (`d`, off-beat keys,
  changes per beat, travel, turns) and tempo suitability (slow / mid / fast:
  jumps and percussive moves lean fast, smooth / flowing ones slow). If the
  formula gets a move wrong, correct it in `OVERRIDES` there.
- `tags`: `'families | focus | themes'`:
  - families (1+): `latin disco funk hiphop pop rock kpop party aerobic`
    (first = strongest; add others only where the move genuinely belongs)
  - focus (1+): `hips arms legs full turn`
  - themes (0+): `hips shake jump clap hands twist spin walk stomp point punch wave kick`
    (a song title mentioning these boosts the move)
- `desc`: one sentence on how to do it (required for new moves).
- Names: the move's ordinary name ("Salsa Basic", "Running Man", "Air
  Guitar"). A move popularised by an artist or video is fine under its
  ordinary name. Ids: kebab-case, stable.

## Turns

`spin` is a whole-body turn in degrees; + = the front (face, chest) turns
toward screen right; mirroring a move negates it. It is interpolated
LINEARLY and the SHORT way round, so consecutive keys must be < 180 deg apart (a 360 = 0, 60, 165,
270, then back to 0 at the next key; see `spinKeys` in shared.ts). Keep the
feet close (`rf: [0.055,0,0], lf: [-0.055,0,0]`) and on the balls of the
feet. Fast turns (>= 180 deg per beat) are flagged `fastTurn` and kept off
Easy. The back view is drawn (hair, no face, colours swap sides truthfully);
side-on frames are narrow, so don't hold a pose at 90 deg unless that's the
point (quarter-profile moves like the Running Man hold ~55 deg).

## Variations (automatic, not authored)

`variations.ts` derives variations from the layered base moves: other arms
over a move's footwork (and vice versa) when the families match, low / wide
stance, double- and half-time arms, alternating single arm; plus ornaments
(hip sway on idle hips, clap / pose hit on beat 4, diagonal facing, spin-out
flourish). `npx tsx tools/moves/pool.ts` validates every candidate and keeps a
counted variation only when it is at least `VARIATION_THRESHOLD` (0.085) from
every other move, writing `pool.json` (the app builds that list, never
validates at runtime). Re-run it after changing the catalogue (a test checks
the catalogue hash).

## Checking and previewing

```sh
npx tsx tools/moves/check.ts --family rock            # validity + uniqueness for your file vs ALL moves
npx tsx tools/moves/check.ts --family rock --near 5   # each move's 5 nearest moves (distance)
npx tsx tools/moves/check.ts --pairs 0.03,0.07        # pairs in a distance band (threshold tuning)
npx vitest run src/core/choreo/moves.test.ts          # the catalogue tests
```
Validity (`validate.ts`): format, joint limits above, elbow bend <= 165,
feet never below the floor, joints in frame, knees never bend backward,
hands / elbows never through the torso or head, and no joint jumps at 60 fps
on both sides at 100 and 140 BPM.

Uniqueness (`similarity.ts`): pose distance over 8 sampled beats (best of
mirrored / beat-shifted alignments; max over arms / legs+pelvis / chest+head
of the mean joint distance) + rhythm (speed profile), + a gap when only one of
the pair jumps or turns. Below `UNIQUE_THRESHOLD` (0.045) = the same move: fix
it (make it clearly different) or drop it. Near-duplicates against another
family's move are reported too; tell the maintainer rather than editing their file.

Contact sheet (rows of moves x 10 frames) in the coach bench, with the dev
server running (`npx vite --port <port>`):
`/coach-demo.html?mode=sheet&family=rock&style=human` (`style=classic|human|sticker`,
`&page=1&per=8`, `&moves=id1,id2`, `&tag=latin` for moves tagged with a family,
`&bpm=120`). Gallery of one move looping: `/coach-demo.html?mode=gallery&move=<id>`;
all three looks side by side: `&compare=1`. **Look at every new move in all
three looks** (classic, human, sticker) before keeping it.

## Quality bar (dos and don'ts)

Do:
- Use real dance vocabulary under its ordinary name; individual moves only.
- Make the move's identity visible from the front: big, clear shapes; the
  feature that names the move must be the thing that moves most.
- Keep hips readable: lateral shift + tilt reads; pure forward/back hip
  motion (z) barely reads from the front, so pair it with a visible shift.
- Keep it copyable at 100-140 BPM: one idea per beat or half beat.
- Give big-arm moves a stable base, and fast feet calm arms.
- Mirror asymmetric moves (`mirror: true`) so both sides get worked.

Don't:
- Reproduce a SEQUENCE: an artist's or game's choreographed routine or a
  recognisable multi-move phrase in order (no Macarena / YMCA letter
  sequences, line-dance routines, game emotes, music-video phrases). The
  generator composes all sequences.
- Copy any game's pictograms, characters or UI.
- Add a move that differs from an existing one only by a slightly different
  arm height, an added accent or a tiny tweak: that is ornamentation, not a
  new move (the uniqueness check will flag most of these).
- Whiplash heads, hyper-extended joints, hands through the body, feet
  sliding through the floor, deep held squats on Easy.
- Moves that need the side view to make sense (true moonwalk glide, body
  roll in profile) unless reworked to read from the front (quarter profile).

Examples:
- Good: Salsa Basic (forward/back break with hip shift, reads from the front),
  Hip Sway (big lateral shift + tilt), Gallop (wide bouncing stance, crossed
  wrists holding reins, side-to-side shuffle), Air Guitar (strumming hand +
  fretting arm out to the side, power stance).
- Rejected / flagged so far: a straight moonwalk glide (reads as standing
  still from the front); Hip Bump vs Hip Pop and Disco Point vs Bump & Point
  (flagged as near-duplicates: same shape at tempo); a steering wheel with the
  hands at face height (read as crossed arms; lowered to the chest).
