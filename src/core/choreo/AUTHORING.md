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
| `families/gospel.ts`, `country2.ts`, `latin2.ts`, `mexican.ts`, `flamenco.ts`, `world2.ts`, `world3.ts`, `club.ts` | the genre survey's additions (Nov 2026): gospel; more country; bachata, tango, salsa shines; regional Mexican and cumbia; flamenco; belly dance; dangdut and Schlager; house farmer, amapiano groove (ids in `genreSets/variety.ts`) |
| `families/synthpop.ts`, `indie.ts` | round three (Nov 2026): the synth-pop / new wave floor and the indie gig / indie-disco floor (ids in `genreSets/variety.ts`) |
| `families/basicsLatin.ts`, `basicsIbero.ts`, `basicsRetro.ts`, `basicsIsland.ts`, `basicsFolk.ts`, `basicsClub.ts` | the simple basics (Nov 2026): difficulty-1, low-impact steps as each style is taught to beginners, so every genre set has at least 6 Easy-eligible moves (capoeira 4); sources in each file's header, ids in `genreSets/basics.ts` |

## Two tiers: global and genre-exclusive

Every move is either GLOBAL (used on any song, where the level allows) or
exclusive to one GENRE set, listed by id in `genres.ts` (`GENRE_MOVES`) and
`genreSets/*.ts`: rock, hip-hop, Latin, disco & funk, K-pop, country, swing,
afro, Caribbean, South Asian, folk, belly dance, hula, capoeira, and the
sub-style sets metal, punk, trap, drill, R&B, house, EDM, bass music,
reggaeton, Brazilian, amapiano, lyrical, the Latin dances salsa,
merengue, cumbia, bachata, cha-cha, flamenco, tango, regional Mexican, and
gospel, dangdut, Schlager, synth-pop and indie (see "Genre sets" below; the sets added or grown in the genre survey,
`tools/eval/data/genre-dance-survey.md`, list their ids in
`genreSets/variety.ts`). A genre-exclusive move is only
used on songs whose style opens that genre (`songGenres`: the style's
tradition themes, its leading families, its sub-style scores, gated by the
song's calm). When you add a move that only
makes sense with its music (a headbang, a salsa step, a line-dance step, a
K-pop point move), add its id to its genre set; otherwise it is global.
Variations share their move's tier; a recombination takes the genre of a
layer that belongs to one, and two genres are never mixed. A layer pattern
used by any global move counts as global, so don't give a global move the
arms of a genre move (that leaks the genre into every song's variations).
Strongly toned footwork (a jump, a stomp, a kick or high knee: a foot lifted
to 0.15) joins a genre set's arms only when one of that set's own moves
dances it (`variations.ts tonedFoot`, `footNative`): giving a set a kick
move lets its arms recombine onto that kick; plain bases pair with any set.
A tradition theme opens its set by its name's place in the song's list
(`SongStyle.themeW`, `songStyle.ts THEME_FADE`): a trailing name gives a
flavour, and when only flavour themes open sets the genre time shrinks with
them (`genres.ts genreDepth`).

## Genre sets: groups and sub-styles

A song's style comes from the song (`songStyle.ts`): its genre names (the
song's own list, e.g. a Wikipedia infobox, then the iTunes tag as a
tie-breaker: with a list, the tag's sub-style evidence counts at most
`ITUNES_SUB` 0.4, below `SUB_OPEN`, and a list name's falls with its
position to 0.4 from the fifth name on), its absolute audio traits from the
beat map (`songTraits.ts`: calm, intensity, drive, four-on-the-floor,
half-time feel, sub-bass, hats, swing, syncopation, heaviness, the tempo
octave candidates), tempo and title words; never the artist's name. A
scene name (K-pop, J-pop, C-pop ...) anywhere in the song's list leads the
dancing (`SCENE_LEAD`). Trap and drill never open on a half-time feel alone
(any song counted at double tempo shows one): they need a trap / drill
name.

The label the owner sees is the MUSIC's name, from the genre names
(`styleLabel`: "Eurodance", "Blues", "K-pop", "Nu metal", "Classical"),
with a sub-style the name doesn't say ("Hip-hop · Drill") or " · Ballad"
when the audio says calm; families only when there are no genre names, as
music words ("Dance", never "Aerobics"). Music that isn't dance music
(classical, ambient, new age, spoken word: `still` in the lexicon) gets a
neutral smooth mix under its own name. The reviewed vocabulary and what
each name maps to: `genreVocab.testutil.ts`, `songStyle.vocab.test.ts`,
`tools/eval/data/genre-vocabulary.md` (`npx tsx tools/eval/genreTable.ts`).
The broad groups (rock, hip-hop, Latin, disco & funk, K-pop, the
traditions) open from the song's family weights and themes; the sub-styles
below open from the style's sub-style scores (genre words + traits,
`SUB_OPEN` 0.5). Each sub-style either ADDS to its group (a metal song
dances rock and metal: `SUB_INFO` `withParent`, metal / punk / trap /
drill) or REPLACES it (reggaeton never gets salsa). A set with fewer than
`MIN_GENRE_SET` (6) moves falls back: its parent opens too. The song's calm
closes showpiece sets (no headbangs on a ballad; `CALM_TOLERANCE` in
`genres.ts`) and opens `lyrical` (from calm ~0.74 with analyser 1.4.0,
`LYRICAL_CALM`; a loud, intense song never). A soft-but-steady song
(`soft`: low audio intensity on a beat, or genre names like romantic
bachata or soft rock) closes the showpiece sets the same way (`gateCalm`)
but never opens lyrical: a smooth groove, not a ballad.

### The Latin dances

Latin is split by dance. `latin` keeps what the variation pool ties
together (merengue, cha-cha and mambo share layers through named
recombinations such as Merengue Side Cha-Cha Arm) and the percussion moves;
`salsa`, `cumbia`, `bachata`, `flamenco` (with paso doble), `tango` and
`mexican` (folklórico, hat dance) have their own sets, the samba steps are
in `brazil`, and merengue and cha-cha are sub-styles without a set of their
own. Genre names open them (salsa / mambo / timba -> salsa, bachata,
cumbia / vallenato, cha-cha / danzón / rumba, flamenco / paso doble, tango,
banda / norteño / mariachi / corridos -> mexican). Salsa, cumbia and bachata
lean on Latin (a salsa song's families open it; the small sets open it
outright), flamenco, tango and regional Mexican close it. A move NAMED for
the song's leading Latin dance (`danceOf`) is favoured x `NAMED_DANCE`
wherever it lives, which is how a merengue gets merengue first from the
Latin set; the related dances fill in through the neighbours below.

### Thin sets borrow from their neighbours

A song uses about 3-4 moves of its genre part, so a set with few moves makes
every song of its style look alike. A set the song can dance fewer than
`SUB_STANDALONE` (16) moves of (at its level and tempo) has some of its
accent slots filled with moves BORROWED from neighbouring sets
(`NEIGHBOURS` in `genres.ts`, weighted, one-directional, chosen by how the
styles are danced; a sub-style's parent that it doesn't open is its nearest
neighbour). One rule replaces the old "keep the parent open until 16":

- How much (`borrowShare`): half of the set's slots while it has at most
  `MIN_GENRE_SET` usable moves, falling linearly to none at
  `SUB_STANDALONE`, and never more than k / (own + k) for k fitting
  moves (a borrowed move is used no more than an own move on average).
  All borrowed beats stay within half of the song's genre time, so a song
  whose only genre slot is the thin set's keeps its own move. The genre
  share (40-60 %) doesn't change: borrowing only decides what fills the
  set's slots (and a thin set out of fitting moves at a slot borrows one
  rather than lose it to a global move, within the same half).
- From where (`borrowSources`): a neighbour the song doesn't open itself
  (open sets are its own vocabulary), never one it closes: calm-closed, or
  replaced by its sub-style (a replaced PARENT lends only moves named for
  the borrower: Brazilian takes Latin's samba steps, not its salsa).
- Which moves (`borrowFit` in `generator.ts`, all from measurements the code
  already has): danceable here (speed limit / reads at half time, tempo
  weight >= 0.6); the level (below Hard no difficulty 3; Easy: no jumps or
  fast turns, nothing high-intensity, impact <= 0.45); the song's character
  (a calm song: no jumps, only moves its calm favours); it dances like the
  borrower (smoothness and impact within the borrower's own range, +- 0.15);
  and from a neighbour below `BORROW_CLOSE` (0.75): no showpiece (a song's
  signature nod, a `party`-family move, a move named for its own style,
  "Salsa Basic", "Disco Dip", "Drill Bounce", read with the song-genre
  lexicon) and families that suit the song at least half as well as the
  borrower's own moves do (`styleFactor`). R&B has no hip-hop neighbour at
  all: the hip-hop set is its named party dances (a "Billie Jean" with R&B
  in its genre list must not get them), and hip-hop's smooth grooves are
  global moves anyway.

### How a song's genre slots are chosen and shared

The kit's genre moves are whole kit slots (`assignGenres` in
`generator.ts`), aiming at half of the danced time (`GENRE_TARGET` 0.5,
`GENRE_MIN`..`GENRE_MAX` 40-60 %; before Nov 2026 it was 20-40 %, and the
routines read as a gym class with a few genre accents). These rules keep
one song's genre part from being one move:

- No slot carries more than `GENRE_SLOT_CAP` (0.35) of the genre time aimed
  at (`GENRE_TARGET`), so it spreads over several moves:
  `GENRE_PRIORITY` first, then the other slots that fit, smallest first,
  never the verse motif's A or the hook's H1. When a song's kit is too small
  for that to reach `GENRE_MIN` (short songs on Easy), the uncapped choice
  of before applies, and a slot too big to be a genre slot whole (a short
  song's verse motif A) may give the set its odd runs only (`Slot.odd`:
  verse 2 dances a genre move where verse 1 had a global one).
- A verse, build or break genre slot that is still above that cap
  alternates two moves of its set, run by run (`Slot.odd`, '~b').
- A genre slot's pick weights are flattened (`GENRE_FLAT`), so songs of
  one style don't all cast a set's same few favourites (the song's own
  Latin dance keeps its full `NAMED_DANCE` lead).
- Easy keeps to simple moves (`EASY_HARD_CAP`: moves above difficulty 1 at
  most 8 % of its danced time, 14 % with genre slots'): a set with few
  simple moves gets less genre time on Easy rather than harder moves; a
  thin set (one that borrows) keeps what it has. So every set needs simple
  moves of its own: at least 6 that Easy accepts (difficulty 1, no jump or
  fast turn, not high intensity, impact <= 0.45; Latin had 2 of its 21
  until the basics files, and a Latin song on Easy danced 10 % genre).
  A new set gets its simple basics with it.
  The kit itself doesn't grow: only which of its slots are genre slots
  changes, so routines stay as learnable.
- With a sub-style open next to broader sets (R&B with disco & funk and
  hip-hop, metal with rock), the most open sub-style (`leadSubStyle`; never
  `lyrical`) takes `LEAD_SHARE` (0.65) of the genre beats, the other sets
  fill the rest by openness, slot by slot by the beats each is still owed.

Large sets have no neighbours and never borrow: their songs come out exactly
as without borrowing (`borrow.test.ts`). When you grow a thin set, its songs
borrow less on their own; nothing needs retuning. A new set that should
borrow needs a `NEIGHBOURS` entry with the dance reason next to it.

| Set | Real dance vocabulary | Opened by | Parent / fallback | Ids go in |
| --- | --- | --- | --- | --- |
| `metal` | headbanging (incl. hair windmill), horns, chug squats, wall-of-death crouch, slow heavy sway with fist | metal names (nu / heavy / death / gothic metal, metalcore ...), "hard rock" partly; heavy + driving audio on a rock song | adds to rock; borrows punk | `genreSets/mood.ts` |
| `punk` | pogo, ska skank, hardcore two-step, circle-pit running, slam dancing | punk / hardcore / pop punk / ska / emo names; fast (150+), driving, rough rock | adds to rock; borrows metal | `genreSets/mood.ts` |
| `trap` | the whip, nae nae, shoot, woah, griddy; quick poses on hi-hat rolls, bounce on the half-time snare | trap, crunk, snap, rage, cloud rap names; half-time feel + hat rolls / heavy 808 | adds to hip-hop; borrows drill, bass | `genreSets/urban.ts` |
| `drill` | drill bounce, arm swings, shoulder rocks, shmoney, the strut | drill (UK / NY / Chicago ...), grime partly; half-time feel + syncopated hats and sliding bass | adds to hip-hop; borrows trap | `genreSets/urban.ts` |
| `rnb` | body rolls, smooth two-steps, shoulder / hip isolations, slow grind grooves | R&B, neo soul, new jack swing, quiet storm; a swung, unhurried groove | none: the family mix opens what it leads; borrows soul / funk grooves, lyrical (calm); never the hip-hop set (its party dances) | `genreSets/urban.ts` |
| `house` | jacking, lofting, heel-toe footwork, skate / train / farmer (the farmer in `families/club.ts`), loose legs, voguing hands and frames | house names (deep / tech / Chicago / French, nu-disco, UK garage); four-on-the-floor at ~115-127 BPM | borrows disco & funk (parent), EDM | `genreSets/electronic.ts` |
| `edm` | fist pumping, shuffle (cutting shapes), the jump on the drop, hands-up builds | EDM, big room, electro / progressive house, trance, techno, hardstyle; four-on-the-floor at 124+ | borrows house, bass | `genreSets/electronic.ts` |
| `bass` | DnB skank, rail / wobble bounce, liquid and popping hits, phonk drift arms | dubstep, drum and bass, phonk, future bass; heavy sub-bass with half-time feel, or dense hats at ~170 | borrows trap, EDM, drill | `genreSets/electronic.ts` |
| `reggaeton` | perreo, dembow step, reggaeton bounce, hip rolls | reggaeton, dembow, urbano, Latin trap; dembow syncopation around 88-100 BPM | dancehall (caribbean: opens below 6 moves, then lends); Brazilian lends; replaces Latin | `genreSets/urban.ts` |
| `brazil` | samba no pé, axé, frevo, passinho / quadradinho (funk carioca), forró | samba, axé, baile funk, sertanejo, forró, MPB, bossa nova | replaces Latin, which lends its samba-named steps; reggaeton lends | `genreSets/mood.ts` |
| `amapiano` | vosho, pouncing cat, tshwala bam (the shoulder-roll groove, `families/club.ts`), slow knee bounces on the log drum | amapiano, gqom, kwaito, South African house; log-drum bass at ~108-116 BPM | borrows afro (parent; usually open by the theme) | `genreSets/mood.ts` |
| `lyrical` | reaches, arm sweeps, port de bras, slow turns, arcing lunges, balances, contractions / releases, body waves | a calm song (`calm` ~0.74+ with analyser 1.4.0, and not intense), ballads, ambient, classical; any family | none (smooth global moves) | `genreSets/mood.ts` |
| `salsa` | salsa basic, back basic, side salsa, right turn, New Yorker, the cross-step and flare shines | salsa, mambo, timba, son cubano | Latin lends (mambo, cha-cha); cumbia | `genres.ts` RAW |
| `bachata` | bachata side and forward basics (+ their own variations), the turn, body wave, hair comb, Dominican cross step, double tap | bachata | Latin lends (opened it outright while below 6 moves) | `genres.ts` RAW, `genreSets/variety.ts` |
| `cumbia` | cumbia step, machete, sau, candle, side basic, kick & back, circle basic, turn, hat sway, pollera wave | cumbia, vallenato, champeta, technocumbia, cuarteto | Latin lends (opened it outright while below 6 moves); regional Mexican | `genres.ts` RAW, `genreSets/variety.ts` |
| `flamenco` | flamenco arms, palmas, turn, paso doble cape, braceo, marcaje, llamada | flamenco, rumba flamenca, paso doble, sevillanas | closes Latin; borrows tango | `genres.ts` RAW, `genreSets/variety.ts` |
| `tango` | tango walk, forward ochos, boleo, cruzada, lunge (corté), caricia, molinete, in a solo embrace | tango, nuevo tango, electrotango | closes Latin; borrows flamenco, lyrical (calm) | `genres.ts` RAW, `genreSets/variety.ts` |
| `mexican` | folklórico skirt, hat dance heels, zapateado, huapango campanas, puntas, remate, the banda caballito, quebradita hop | regional Mexican, banda, norteño, mariachi, corridos, Tejano, quebradita, tecnobanda | closes Latin; borrows cumbia, folk (polka), country | `genres.ts` RAW, `genreSets/variety.ts` |
| `merengue`, `chacha` | (their steps are Latin's) | merengue; cha-cha, danzón, rumba, ballroom | open Latin; NAMED_DANCE favours their moves | - |
| `gospel` | choir step and clap, choir two-step, raised-hand praise, lifted hands, point to heaven, handkerchief wave, tambourine, bow and rise, the praise-break shout and shout hops, step-team stomps | gospel (traditional, urban contemporary, southern), worship, CCM, contemporary Christian, the iTunes "Christian & Gospel" tag; "Christian rock / metal / hip hop" read as their second word | none; borrows R&B, soul / funk grooves, lyrical (calm) | `genreSets/variety.ts` |
| `dangdut` | joget sway (soft hand rolls, pointing fingers), goyang gergaji (the saw), dribble shake, broken hip hits (patah-patah) | dangdut, koplo, joget; Thai luk thung / mor lam at 0.6 | none; borrows belly dance, Bollywood | `genreSets/variety.ts` |
| `schlager` | schunkeln (arm-in-arm sway), the stein toast, bird-dance beak snaps and wing flaps (figures, never the routine) | Schlager, party Schlager, Oktoberfest, apres-ski, Stimmungsmusik, Discofox | none; borrows folk (the polka), country | `genreSets/variety.ts` |
| `synthpop` | the new wave side step with the arms swinging across, robot ticks, New Romantic poses, keytar, shoulder pops, the stiff bounce, finger-snap glide, kick shuffle, mannequin hits, skip & swing, the romantic arm sweep, pogo point, the post-punk flail stomp | new wave, New Romantic, new pop, synthwave / retrowave (0.6: from the first two places of a list), post-punk (0.4); synth-pop, technopop (0.95) only as the song's leading name (or an artist's leading name refining a bare "Pop"), trailing ones corroborating each other (`songStyle.ts` `Lex.lead`); never electropop | none; borrows disco & funk, indie | `genreSets/variety.ts` |
| `indie` | hands-in-pockets nod, shoegaze sway, the indie head shake (side to side, not a headbang), loose arm swing, twee handclap, tambourine, fringe sweep, the gig two-step with the fist, baggy (Madchester) shuffle, jangle strum, festival arms, the arms-round front-row jump, the indie-disco stomp | post-punk (0.6, any of the first two places); indie (1.0), indie pop, twee, jangle pop, bedroom pop (0.95), dream pop, shoegaze, indie rock, Britpop, Madchester (0.9), post-punk revival, dance-punk, indie disco (0.85), indie folk (0.7), chamber / baroque pop (0.6) only as the leading name (`Lex.lead`: elsewhere 0.4 of the score, two trailing indie names together may open it); an "Alternative" tag refined by the artist's leading indie rock / shoegaze | none (rock stays open by the families on indie rock); borrows rock, synth-pop, lyrical (calm) | `genreSets/variety.ts` |

Belly dance (the tradition set every Arabic, Turkish, raï, shaabi,
khaleeji and mizrahi name opens) grew in the genre survey from 3 to 10:
hip lifts, hip slides, the maya, the hip shimmy, the khaleeji hair toss
and drop step, the saidi cane hop (`families/world2.ts`).

Country is one set: its moves are line-dance / hoedown steps (grown in the
genre survey with heel splits, the rolling vine, slappin' leather and the
zydeco rubboard scratch, `families/country2.ts`), which serve
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
  stay in rock; merengue, cha-cha and mambo share layers through named
  recombinations, so they stay in Latin together). Full-body moves move
  freely. Moving layered moves means regenerating `pool.json` (`npx tsx
  tools/moves/pool.ts`), and checking that no layer pattern ends up used by
  two sets (it would count as global and leak into every song).

## Character, jumps, tempo feel, free time

- Character (`weights.ts calmFactor`): a calm song favours smooth moves and
  quiets percussive, jumping and novelty moves (the party file / family and
  the fad and cheer moves, `isNovelty`) at every level; Hard on a calm song
  leans to big, smooth, controlled moves. A soft song loses jumps, kicks,
  percussive and novelty moves without the ballad lean; a hard-hitting one
  (`hard`, audio intensity) welcomes sharp hits.
- Jumps (`generator.ts jumpCap`): a budget of the danced time, `JUMP_CAP`
  (Easy 0, Medium 0.14, Hard 0.3) x the song's character (none from calm
  0.65, a fifth on a soft song) x its felt tempo (45 % at 92 BPM and below,
  full from 118). The kit casts a jump only while its slot's planned time
  fits in the budget; the combo jumps in one of its two blocks at most.
- Tempo feel (`danceFeel`): the whole song is danced at half / twice the
  counted tempo when that octave lies closer to the tempo the song's genre
  names are stepped to (lexicon `bpm`; a calm song's lower) by more than a
  margin the evidence sets. Half: a half candidate from the analysis
  (traits halfTempo >= 0.5) lowers the margin until, from 0.85, half wins
  unless the count is clearly the genre's (a half-time backbeat counts less
  on trap, drill and bass music: that is their count). Outside the genres
  that span fast dancing (punk, metal, bass music, EDM, trap, drill; country
  and swing themes; any of them unless the song is calm) the genre and the
  sound decide alone too: a count past 150 that only those genres step at,
  or a soft-sounding song (low audio intensity, or soft genre names) counted
  at 125-150 and up (a busy rhythm, drive 0.75-0.95, is energetic whatever
  the timbre). Twice: the analysis must offer it (doubleTempo >= 0.5); a
  strong candidate lowers the margin as for half, on an energetic song only
  (the tracker counts many fast pop songs at half: Shake It Off, Footloose). The routine then runs on the felt grid
  (`Routine.times`, `feel`).
- Free time (`hasFreeTime`, `freeTimeMap`): a finished map with no beat
  grid gets a slow flow on a nominal grid (56-96 BPM from the genre's tempo
  and the calm), danced calm with the lyrical set open, marked
  `Routine.freeTime` (the conductor plays it on `Routine.times`). A driving
  song (`freeTimeDriving`: audio intensity hard, or calm 0.3 or less) gets a
  steady nominal grid at its genre's tempo instead (100-150 BPM), danced
  with its own style: never the lyrical flow.

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
  - `formR` / `formL: 'point' | 'horns' | 'fingers'`: a pointing index
    finger, rock horns, or an open hand with the four fingers spread apart
    (`'fingers'`: jazz hands, piano keys, wiggling fingers); drawn in all
    three looks; otherwise `handR` 0 = fist, 1 = open.
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

Headless, to PNG (no browser of your own; scratch output, never commit it):
```sh
npx tsx tools/moves/sheet.ts --moves id1,id2            # sheet, one row per look
npx tsx tools/moves/sheet.ts --genre trap --styles human --views 0,90 --trail
npx tsx tools/moves/sheet.ts --strip <id>               # one move big: 3 looks, front + side view, paths
npx tsx tools/moves/sheet.ts --at HEAD~1 --moves <id> --name before   # the same at an older revision
npx tsx tools/moves/sheet.ts --duo duo-palm-press       # partner moves
npx tsx tools/moves/reference.ts search "<dance> dance tutorial"      # how the real dance is done
npx tsx tools/moves/reference.ts frames <video id> --from 1:19 --to 1:25 --fps 4 --crop 0.35,0,0.65,1
npx tsx tools/moves/jumps.ts <id> --bpm 140             # where a "joint jumps at 60 fps" failure happens
npx tsx tools/moves/bench.ts --moves id1,id2 --sprites  # drawing cost per figure (compare runs on one machine)
```
- `sheet.ts`: headless PNGs of what the coach really draws (contact sheets,
  `--strip` for one move big, `--gallery` on the real stage, `--duo`,
  `--views` / `--trail`, `--at <rev>` for before / after).
- `reference.ts`: find a reference clip (`search`, `info`) and cut a frame
  strip from it (`frames`, `--with` a sheet render under it) to study the
  steps; never trace it.
- `jumps.ts`: the fastest joint steps of a move at 60 fps with their beat,
  to find what breaks the "no joint jumps" validity rule.
- `bench.ts`: headless figure drawing cost (ms per figure, paths or
  `--sprites`), `--param cam=..,piv=..,feet=0` to compare camera settings.
`--views 0,90` adds a camera from the side: motion that only shows there
(forward kicks, forward / back steps, rolls, reaches at the camera,
horizontal circles) is invisible on the wall. `--trail` draws the hands',
toes' and head's paths: a move whose paths are tiny dots reads as standing
still. Remedies the figure supports: turn the body to a diagonal / quarter
profile (`spin` 25-45) for the part that needs depth (running man, mambo
rock, whip); exaggerate the visible component (knees pointing to the side in
a twist or swivel, hip shift + tilt); restage a circle into the front plane;
arms that swing against a twist. Reference footage is for understanding the
steps only: author from scratch.

What the front camera shows of depth (`VIEW` in `coach/styles.ts`, shared by
every look, the duo stage and the thumbnails):
- The eye is at head height (`piv` 0.95) and close (`cam` 2.6 figure units;
  it was 4.2 / 0.55). A point toward the viewer scales up about eye height,
  so below it it drops on the screen: a foot stepped 0.15 toward the viewer
  lands about 0.06 LOWER on screen, a step back about 0.06 HIGHER, while a
  hand at chest height moves under a third of that. Forward / back steps,
  mambo and salsa breaks now read on the floor; arms you placed do not move.
  Everything at z = 0 (the neutral stance, side-to-side moves) draws exactly
  where it did.
- Each foot has a contact shadow on the floor at the foot's depth, shrinking
  and fading as the foot lifts: a foot stepped back (higher, shadow under it)
  reads differently from a lifted foot (shadow left on the floor below).
- A hand whose forearm points at the camera with `formR` / `formL: 'point'`
  (or another form) draws the fingers foreshortened in front of the fist (a
  short stub with a round fingertip, thicker the more it faces the viewer)
  in every look: "pointing at you" reads. `'fingers'` is the open hand with
  spread fingers.
- Partner moves (`duoMoves.ts`): truly back to back is each player turned a
  full quarter AWAY from the partner, `spin` about -90 (P2 mirrored), with
  the roots about 0.40 apart (`x` 0.3 from each home spot) so the backs
  nearly touch; at -60 they read as two people facing the front, at -105 the
  backs of the heads show. Orbits (`orbitKeys`) take a radius or `[rx, rz]`
  (an ellipse wider across the screen than in depth; the move's `orbit` is
  then rz) and a `warp` (0..0.5) that hurries the pair through the moments
  one stands straight in front of the other and lingers where they are side
  by side.

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
