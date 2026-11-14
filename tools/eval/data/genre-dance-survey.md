# Genre and dance-style survey (2026-11-14)

What people play, what each genre's own dance vocabulary is, and what the app gives a
song of that genre today. Built to pick which genre sets to add or grow.

**Sources for the genre list.** Wikipedia "List of music genres and styles", "List of
dance styles", "List of line dances", "List of ethnic, regional and folk dances by
origin"; AllMusic / MusicBrainz / RateYourMusic top-level genres; Luminate 2024
year-end and 2025 reports (US); Spotify Wrapped 2024 Africa figures. Step names come from
the written breakdowns cited in the priority list and the notes column. Where a step name
or popularity figure comes from general knowledge and no page was found, the cell says
"(unsourced)".

**Popularity basis (US, Luminate 2024 on-demand audio streams):** R&B/hip-hop 341.6 bn,
rock 234.2 bn, pop 165.5 bn, country 117.6 bn, Latin 113.0 bn. Regional Mexican overtook
Latin pop as the largest US Latin sub-genre in 2024. Christian/gospel passed world music to
7th in US on-demand audio in mid-2025 and grew 18.5% in 2025
([Luminate 2024 YE](https://luminatedata.com/wp-content/uploads/2025/01/Luminate_Year-End_Report_2024.pdf),
[AP on 2024](https://abcnews.go.com/Entertainment/wireStory/music-streams-hit-5-trillion-2024-women-pop-117696554),
[Luminate on Christian/gospel](https://luminatedata.com/blog/the-new-wave-of-christian-and-gospel-music/),
[AP on 2025](https://religionnews.com/2026/01/16/music-streams-hit-5-trillion-in-2025-christian-rock-and-latin-lead-growth-in-the-us/)).
Africa (Spotify 2024): amapiano +59% global streams, highlife +54%, afrobeats +28-34%
([BusinessDay](https://businessday.ng/life-arts/article/here-are-african-music-genres-that-gained-global-attention-in-2024/),
[Guardian NG](https://guardian.ng/?p=2497125)). Other regions are rated by regional
dominance (e.g. dangdut in Indonesia, sertanejo in Brazil, schlager in German-speaking
countries).

**How "app today" was read.** `resolveSongStyle({genres:[name]})` → `styleLabel` |
`styleGenres`, one genre name per song, resolved against commit `3337ff4` (a clean export of
HEAD's `src/`, because a gospel set was being added in this worktree while the survey ran).
`-` = the song opens no genre set and gets only the global pop/aerobic/party pool (694
moves). "Mixed styles" = the name is not in the vocabulary. Set sizes in brackets (moves incl.
named recombinations): latin 22, salsa 6, cumbia 4, bachata 2, tango 1, flamenco 4,
mexican 2, brazil 17, reggaeton 9, discofunk 56, house 9, edm 10, bass 9, hiphop 42, trap 16,
drill 11, rnb 11, rock 44, metal 9, punk 11, kpop 52, country 23, swing 34, afro 17,
caribbean 14, amapiano 8, southasian 37, folk 31, bellydance 3, hula 6, capoeira 2,
lyrical 17.

**Verdict rule (from the brief).** **missing** = the dance vocabulary has no set, or the songs
open nothing of their own. **thin** = opens a set with fewer than about 8-10 moves for that
style, or a set that doesn't fit the style. **well served** = opens a fitting set of 14+
moves, or the music isn't danced in a recognisable way (the global pool is then the right
answer).

**Readability shorthand** (front-facing 2D figure): side-to-side travel, front-plane arm
shapes, level changes and clear weight shifts read. Motion toward/away from the viewer,
fine footwork and horizontal circles (hip circles) don't.

AUTHORING.md forbids reproducing routines (Macarena, YMCA, line-dance routines). Everything
below is listed as individual steps. Named line dances (Electric Slide, Cupid Shuffle, Cotton-Eyed
Joe, Tush Push, Payaso de Rodeo) are only mined for their component steps.

---

## 1. Pop, mainstream, children's, seasonal

| Genre / scene | How common | Own copyable vocabulary? + example steps | App today (label · sets · main set size) | Verdict | Notes |
|---|---|---|---|---|---|
| Pop / dance-pop / teen pop / Eurovision | High: largest share of global charts; US 165 bn streams | Partly: point, step-touch, body roll, TikTok dances (routines, not steps) | "Pop", "Dance-pop", "Teen pop" · - · global 694; "Eurovision" → Mixed styles | **well served** | The global pool is the pop vocabulary. |
| Synth-pop / new wave | Medium (80s revival) | Partly: Robot, pogo, shoulder-bop jumps | "Synth-pop" · -; "New wave" · rock (44) | **well served** | Rock's headbangs are a slight misfit for new wave; its pogo and air guitar fit. |
| Indie pop / indie rock / alternative / grunge / hyperpop | Medium | No: sway, head nod, pogo at gigs | "Indie rock", "Alternative rock", "Grunge" · rock (44); "Indie pop", "Hyperpop" · - | **well served** | Not danced in a recognisable way. |
| Musical theatre / Disney / soundtrack | Medium | Partly: jazz hands, kick line, step-ball-change, ta-da pose | "Musical theatre", "Disney", "Soundtrack" · - | **well served** | Global pool has Jazz Hands, Kickline, Ta-Da!, Curtain Call Bow. |
| Children's music / nursery rhymes | Medium-High (among the most-watched YouTube music) | Yes: action-song mimes (animal walks, head-shoulders, freeze), Hokey Pokey actions | "Children's music", "Nursery rhymes" · - | **well served** | The global pool has Penguin Waddle, Dinosaur Stomp, Bunny Ears Hop, etc. |
| Christmas / holiday | High in Q4 charts | No own vocabulary (Jingle Bell Rock dances as rock and roll) | "Christmas", "Holiday" · - | **well served** | |
| Ballad / singer-songwriter / soft / lo-fi / ambient / classical / opera / enka / kayokyoku | Medium (study and sleep playlists) | No | "Lo-fi", "Ambient", "Classical", "Opera" · lyrical (17); "Singer-songwriter", "Enka", "Kayokyoku" · - | **well served** | Calm songs reach lyrical through the audio either way. |
| Anime / Vocaloid / video-game music (otaku scene) | Medium-Low (anime themes chart in Japan, global niche) | Yes: wotagei (otagei) glow-stick routines: big two-arm overhead arcs and pumps; Para Para arm routines | "Anime", "Vocaloid", "Video game music" · -; "wotagei", "otaku", "Para Para" → Mixed styles | **missing** | Wotagei is all front-plane arm work, so it reads very well. Para Para Sweep sits in folk, but no name opens it. |
| J-pop / idol | Medium-High (Japan is the #2 recorded-music market) | Yes: idol furitsuke hand choreo, points, hearts | "J-pop", "idol" · kpop (52) | **well served** | |
| K-pop | High (global; dominant in Korea) | Yes: point step, big heart, wipers, aegyo | "K-pop" · kpop (52) | **well served** | |
| C-pop / Mandopop / Cantopop | Medium-High (large but mostly domestic) | Partly: idol choreo; square dancing (guangchang wu) is aerobic + yangge | "C-pop" · kpop (52) | **well served** | |
| V-pop / T-pop / P-pop | Medium (regional) | Partly: idol choreo | "V-pop", "T-pop", "P-pop", "Thai pop" · kpop (52); "Vietnamese" · - | **well served** | |
| Korean trot | Medium (Korea, older listeners; TV boom) | Partly: side step with fist pump / finger point (unsourced) | "trot" → Mixed styles | **well served** | Name gap only. The music fits the global party pool. |
| OPM / Pinoy pop / budots | Medium (Philippines) | Partly: budots (crouched, loose-limbed wiggle, a 2010s Davao dance craze; unsourced); tinikling hops (folk) | "OPM", "Pinoy pop" · -; "budots" → Mixed styles | **missing** | Budots is a viral, very visible arm-and-knee flail. OPM ballads are fine as they are. |

## 2. Hip-hop, R&B and club scenes

| Genre / scene | How common | Own copyable vocabulary? + example steps | App today | Verdict | Notes |
|---|---|---|---|---|---|
| Hip-hop / rap | High: largest US genre with R&B (341.6 bn) | Yes: Dougie, Cabbage Patch, Milly Rock, Bankhead Bounce, Wop | "Hip-hop" · hiphop (42) | **well served** | |
| Trap | High | Yes: Nae Nae, Whip, Shoot, Griddy | "Trap" · hiphop, trap (16) | **well served** | |
| Drill (US / UK / Brooklyn) | Medium-High | Yes: Shmoney, drill bounce, finger-gun hits | "Drill", "UK drill" · hiphop, drill (11) | **well served** | Own set is 11, but hip-hop's 42 sit with it. |
| Southern hip-hop / crunk / snap / Miami bass | Medium | Yes: Lean wit it rock wit it, Laffy Taffy, Stanky Leg, Walk It Out, booty shake | "Crunk", "Snap", "Miami bass", "Southern hip hop" · hiphop (42) | **well served** | |
| Memphis rap / phonk | Medium-High (phonk huge on TikTok and gym playlists) | Partly: Memphis jookin / gangsta walk (fine footwork), drift-arm sways | "Phonk", "Memphis rap" · hiphop, bass (9) | **well served** | |
| New Orleans bounce | Low-Medium (regional; Big Freedia, mainstream samples) | Yes: booty pops and twerk-style hip isolations, the wobble, hands-on-knees shake | "Bounce", "Bounce music" · hiphop (42); "twerk" → Mixed styles | **thin** | Hip-hop's party set stands in; the bounce vocabulary is hip isolation, which only the global Booty Shake covers. |
| Jersey club | Medium (TikTok; mainstream remixes 2022-25) | Yes: the Jersey club kick (hop-kick on the triplet kick), knee-drop bounce; lyrics name new dances ([RBMA](https://daily.redbullmusicacademy.com/2014/04/bounce-ballroom-feature)) | "Jersey club" · hiphop (42), 1 own move (Jersey Club Kick) | **thin** | Only one own move. |
| Baltimore club | Low | Yes: Crazy Legs (fierce leg shake with foot taps and shoulder shrugs), Heel Toe, Power Step, Sidekick, Spongebob, Cherry Hill ([Baltimore Sun "Keep the Beat"](https://data.baltimoresun.com/features/keep-the-beat)) | "Baltimore club" · hiphop (42) | **thin** | Crazy Legs and Sidekick read; the rest is fast footwork. |
| Chicago footwork / juke / ghettotech | Low | Yes, but micro-footwork: toe-heel taps, skates, "ghosts" | "Footwork", "Juke", "Ghettotech" · hiphop (42) | **thin** | Fast footwork won't read on a front-facing figure, so this is low priority. |
| Go-go (DC) | Low (regional) | Yes: Beat Ya Feet (fast footwork), bus-stop line steps | "Go-go" · discofunk (56) | **well served** | Funk fits; Beat Ya Feet won't read. |
| R&B / neo soul / quiet storm | High | Yes: body roll, R&B two-step, slow wind, shoulder roll | "R&B", "Neo soul" · discofunk, hiphop, rnb (11) | **well served** | Three sets open together. |
| New jack swing | Low | Yes: Running Man, Roger Rabbit, Kid 'n Play kick step, Humpty | "New jack swing" · discofunk, hiphop, rnb | **well served** | |
| Afroswing / UK rap / afro-trap | Medium (UK, France) | Partly | "Afroswing", "Afro-trap" · afro (17), hiphop | **well served** | |
| HBCU marching band / drumline / stepping / majorette | Low (US South, viral clips) | Yes: stepping (stomps, claps, thigh and chest slaps), majorette "J-Setting" (high kicks, sharp arm hits, level drops) | "marching band", "drumline", "stepping" → Mixed styles; "tap dance" · - | **missing** | Stepping and majorette dancing are front-plane, percussive and level-changing, so they read very well. |

## 3. Soul, funk, disco, swing, rock

| Genre / scene | How common | Own copyable vocabulary? + example steps | App today | Verdict | Notes |
|---|---|---|---|---|---|
| Soul / Motown / Northern soul / Southern soul | Medium (oldies, film, weddings) | Yes: Hitchhike, Pony, Mashed Potato, Swim, Monkey, Jerk; Northern soul spins and kicks | "Soul", "Motown", "Northern soul" · discofunk (56); "Southern soul" · discofunk, rnb | **well served** | |
| Funk | Medium | Yes: Good Foot, Funky Chicken, locking, Robot | "Funk" · discofunk (56) | **well served** | |
| Disco / nu-disco / Italo / city pop / disco polo | Medium-High (disco revival in pop) | Yes: hustle, bus stop, disco point, roll the dice | "Disco", "Nu-disco", "Italo disco", "City pop", "Disco polo" · discofunk (56) | **well served** | |
| Disco/party line dances: hustle, Electric Slide, Bus Stop, Cupid Shuffle, Cha Cha Slide, Wobble | High at weddings and parties | Yes, but each is a fixed routine (off limits). The parts (grapevine, back step, kick-ball-change, quarter turn) exist globally | "hustle", "line dance", "line dancing" → Mixed styles | **well served** | Name gap only. The parts are already global; the routines may not be reproduced. |
| Swing / big band / jazz / electro swing / jazz dance | Low-Medium | Yes: Lindy basics, Charleston, Suzy Q, Shorty George, Truckin' | "Swing", "Jazz", "Big band", "Electro swing" · swing (34), discofunk; "Jazz dance" · swing | **well served** | |
| Jive / boogie-woogie | Low | Yes: jive basic (rock step plus triples), kicks and flicks | "Boogie-woogie" · swing, discofunk; "jive" → Mixed styles | **well served** | Name gap: "jive". |
| Rock and roll / rockabilly / doo-wop / surf | Medium-Low | Yes: Twist, Stroll, Hand Jive, Swim, Mashed Potato | "Rock and roll", "Rockabilly", "Doo-wop", "Surf rock" · swing, rock | **well served** | |
| Blues | Low | Partly: blues slow drag, sway | "Blues" · discofunk, rnb | **well served** | |
| Ballroom standard (waltz, foxtrot, quickstep, Viennese waltz) | Low (TV ballroom shows) | Partly: box step, waltz balance, quickstep chassé (partner dances) | "ballroom" · latin, chacha; "waltz", "foxtrot", "quickstep", "Viennese waltz" → Mixed styles | **missing** | Swing has Waltz Balance, Waltz Turn and Quickstep Chassé, but no name opens them. Cheap fix in the resolver. |
| Rock (classic, hard, arena) | High: US 234 bn streams | Yes: headbang, air guitar, pogo, fist pump | "Rock" · rock (44) | **well served** | |
| Heavy metal / nu metal | Medium | Yes: windmill headbang, horns, mosh | "Heavy metal", "Nu metal" · rock, metal (9) | **well served** | |
| Punk / pop punk / emo / hardcore punk | Medium | Yes: pogo, hardcore two-step, skank, circle pit | "Punk rock", "Pop punk", "Emo", "Hardcore" · rock, punk (11) | **well served** | "Hardcore" also opens punk for hardcore techno (name collision). |
| Ska / rocksteady / ska punk | Low | Yes: skanking (knees up, alternating arm punches) | "Ska", "Rocksteady" · caribbean, rock, punk | **well served** | Punk has Ska Skank and Cross Skank. |
| J-rock / visual kei / Celtic rock and punk / Anatolian rock | Low | Partly: headbang, furitsuke; jig steps for Celtic punk | "J-rock", "Visual kei", "Anatolian rock" · rock; "Celtic rock", "Celtic punk" · folk, rock(, punk) | **well served** | |

## 4. Electronic

| Genre / scene | How common | Own copyable vocabulary? + example steps | App today | Verdict | Notes |
|---|---|---|---|---|---|
| EDM / big room / electro house | High (festival circuit, global) | Partly: hands up, fist pump, drop jumps, shuffle | "EDM", "Big room", "Electro house" · edm (10) | **thin** | 10 moves; a song uses 3-4 of them, so EDM songs look alike. |
| House (deep, tech, Chicago, soulful) | High (top club genre) | Yes: Jacking, Farmer, Skate, Heel-Toe, Loose Legs, Train, Sidewalk, Shuffle, Pas de bourrée, Swirl ([STEEZY](https://www.steezy.co/posts/what-is-house-dance)) | "House", "Deep house", "Tech house" · discofunk, house (9) | **thin** | House's own vocabulary is mostly lateral, so it reads well. |
| UK garage / 2-step / speed garage / bassline / UK funky | Medium (UK; global garage revival) | Partly: 2-step garage skank and shoulder bounce; UK funky craze dances (Migraine Skank, Head Top Skank; unsourced) | "UK garage", "2-step", "Speed garage", "Bassline", "UK funky" · house (9) | **thin** | |
| Techno / trance / Tecktonik electro | Medium-High (Europe) | Partly: techno stomp, trance arm sweeps, hands up; Tecktonik (2000s French electro dance: fast arm whips and wrist rolls framing the head) | "Techno", "Detroit techno", "Trance" · edm (10) | **thin** | Tecktonik arms are front-plane. |
| Hardstyle / jumpstyle / gabber / hardcore techno | Low-Medium (Netherlands, Australia, Eastern Europe) | Yes: jumpstyle kicks, hakken (gabber stomp-shuffle), hardstyle shuffle | "Hardstyle", "Jumpstyle", "Gabber" · edm (has Jumpstyle Kick and Hakken) | **thin** | "hardcore" routes to punk. |
| Melbourne shuffle / Melbourne bounce / "shuffle dance" | Medium (TikTok shuffle wave) | Yes: Running Man (light, heavy, reverse), T-Step, shuffle Charleston, criss-cross, kick-outs, spins ([Fuego](https://fuegodance.com/blogs/all/how-to-shuffle-dance)) | "Melbourne bounce" · edm (10) | **thin** | Running Man and T-Step are global, so they don't mark the style. |
| Dubstep / brostep / riddim | Medium | Partly: wobble bounce, headbang, robot / popping | "Dubstep", "Brostep" · bass (9) | **thin** | |
| Drum and bass / jungle | Medium-High (UK; global revival 2023-25) | Partly: DnB "step" / skank (fast foot-swap), jungle skank, rewind and gun-finger arms | "Drum and bass", "Jungle" · bass (9) | **thin** | Fast footwork won't read; the arm vocabulary will. |
| Afro house / Afro-tech | Medium (global club growth) | Partly | "Afro house", "Afro-tech" · afro (17), house | **well served** | |
| Electro / 3-step (SA) | Low | No / Partly | "Electro" · -; "3-step" → Mixed styles | **well served** | |

## 5. Country and roots

| Genre / scene | How common | Own copyable vocabulary? + example steps | App today | Verdict | Notes |
|---|---|---|---|---|---|
| Country (mainstream, country pop, bro-country) | High: US 117.6 bn streams; among the fastest-growing | Yes: coaster step, toe strut, jazz box, rocking chair, vine, heel switch, hip bumps, boot scoot ([glossary](https://roots-boots.net/ldance/definitions.html)) | "Country", "Country pop", "Bro-country" · country (23: 14 base + 9 recombinations) | **well served** (borderline) | The owner asked for more. Missing staples: coaster step, toe strut, rocking chair, jazz box, kick-ball-change, hip bumps, military pivot, paddle turn, heel grind, swivels. |
| Honky-tonk / outlaw / Texas country / Red Dirt / Nashville sound / western swing | Medium | Yes: two-step, honky-tonk line-dance steps, swing turns | "Honky-tonk", "Outlaw country", "Texas country", "Red Dirt", "Nashville sound", "Western swing" · country (23) | **well served** | |
| Line dance as a label / Texas two-step | High in US dance halls; line-dance revival on TikTok 2024-25 | Yes | "line dance", "line dancing", "Texas two-step" → Mixed styles | **missing** | Name gap: the country set would fit. The two-step's QQSS travels toward the viewer; a side two-step reads. |
| Bluegrass / old-time / Appalachian / clogging | Low-Medium | Yes: clogging double-toe, rock step, chug; flatfooting, buck dancing | "Bluegrass" · country (has Clogging Basic); "old-time", "Appalachian", "clogging", "mountain music" → Mixed styles | **well served** | Name gaps. Clogging footwork is fine detail; the chug and stomps read. |
| Cajun | Low | Partly: Cajun two-step, Cajun waltz, Cajun jitterbug (partner) | "Cajun" · country (23) | **thin** | Set misfit: line-dance steps for a waltz or jig. |
| Zydeco | Low | Yes: zydeco basic (syncopated rock step, slow-quick-quick), zydeco shuffle | "Zydeco" · country (23) | **thin** | Set misfit. |
| Americana / folk rock | Medium | No | "Americana" · country | **well served** | |
| Country rap / hick-hop | Medium (Shaboozey, Jelly Roll) | Partly | "Country rap" · country, hiphop | **well served** | |
| Square dance / contra / barn dance | Low | Yes, but partner/group figures: do-si-do, allemande, promenade, swing your partner | "square dance" → Mixed styles | **missing** | Partner and group figures read poorly solo. Low priority. |
| Scottish country dance / ceilidh | Low | Yes: pas de basque, skip change, setting steps | "Scottish country dance" · country (misroute); "ceilidh", "Scottish" → Mixed styles | **thin** | Should open folk (it has Highland Fling and Highland Pas de Basque). |

## 6. Gospel and Christian

| Genre / scene | How common | Own copyable vocabulary? + example steps | App today (at 3337ff4) | Verdict | Notes |
|---|---|---|---|---|---|
| Black gospel / contemporary gospel | Medium: Christian/gospel 7th in US on-demand audio by mid-2025, +18.5% in 2025 | Yes: praise break / shout (quick-feet stamping with arm and upper-body undulation), choir step-sway, backbeat church clap, raised hands, holy two-step ([Shout](https://en.wikipedia.org/wiki/Shout_band)) | "Gospel", "Contemporary gospel", "Gospel music" · - | **missing** | The owner asked for it. All of it is front-plane arms plus side sway, so it reads well. |
| Urban contemporary gospel | Medium | Same as above | "Urban contemporary gospel" · discofunk, rnb | **thin** | Soul and R&B moves stand in; no praise vocabulary. |
| Praise & worship / CCM / Christian pop | Medium-High in US churches (Elevation, Hillsong, Maverick City) | Partly: one-arm raise, both arms raised, sway, clap; flag/banner worship dance ([spotter's guide](https://www.christiantoday.com/news/lifting-holy-hands-a-spotters-guide-to-worshippers-arms)) | "Praise and worship", "CCM", "Worship", "Christian", "Christian pop", "Christian music" · -; "praise" → Mixed styles | **missing** | Mostly slow: calm worship songs get lyrical through the audio. Upbeat praise needs the gospel set. |
| Southern gospel / bluegrass gospel | Low | Partly: clapping, sway, gospel line-dance steps | "Southern gospel" · -; "Bluegrass gospel" · country | **missing** | |
| African gospel (Nigerian, Ghanaian, South African praise) | High in sub-Saharan Africa | Yes: praise-dance circles with Afro steps, SA choir (makwaya) stepping (unsourced) | "Nigerian gospel" · -; "African gospel", "South African gospel" · afro (17) | **thin** | |
| Christian rock / Christian hip-hop | Low-Medium | As rock / hip-hop | rock / hiphop | **well served** | |

## 7. Latin

| Genre / scene | How common | Own copyable vocabulary? + example steps | App today | Verdict | Notes |
|---|---|---|---|---|---|
| Reggaeton | High (Bad Bunny among the most-streamed globally) | Yes: perreo / sandungueo, dembow step, body waves, isolations | "Reggaeton" · reggaeton (9) | **thin** | Narrow vocabulary; written sources are weak. |
| Latin trap | Medium-High | Partly | "Latin trap" · hiphop, trap, reggaeton | **well served** | |
| Dembow (Dominican) / moombahton | Medium (DR, Latin TikTok) | Partly: Dominican dembow knee-pops and jerky footwork (unsourced) | "Dembow", "Moombahton" · reggaeton (9) | **thin** | |
| Latin pop | High | Partly | "Latin pop" · latin (22) | **well served** | |
| Salsa / timba / son / guaracha / mambo / boogaloo / Latin jazz | Medium (Caribbean, Colombia, global social dance) | Yes: shines: Suzy Q, cross steps, jazz square, back breaks, mambo taps, flares, Cuban motion ([shines list](https://libraryofdance.org/dances/salsa-shines)) | "Salsa", "Timba", "Son cubano", "Mambo", "Latin boogaloo", "Latin jazz" · latin (22), salsa (6); "boogaloo" → Mixed styles | **thin** | Shines are solo, mostly lateral and crossing, so they read well. |
| Bachata (traditional, urbana, sensual) | High (DR, US Latino, global social dance) | Yes: side basic with hip check, Dominican box, basic turn, triple on 4, body wave ([Wikipedia](https://en.wikipedia.org/wiki/Bachata_(dance))) | "Bachata", "Bachata urbana" · latin (22), bachata (2) | **thin** | Only 2 own moves. |
| Merengue | Medium | Yes: merengue march, side walk, turns | "Merengue" · latin (22), merengue named | **well served** | |
| Cumbia (Colombian, Mexican sonidera, Argentine villera, Peruvian chicha) | High across Latin America and US Latino | Yes: back-break basic, side basic, kick-and-step-back, circular rotation, processional slide with pollera/candles ([Salsa Vida](https://www.salsavida.com/dancepedia/cumbia/)) | "Cumbia", "Cumbia villera", "Cumbia sonidera" · latin (22), cumbia (4) | **thin** | |
| Technocumbia / cuarteto (Argentina) | Low-Medium | Partly: cumbia basics; cuarteto is a circling side step (unsourced) | "technocumbia", "cuarteto" → Mixed styles | **missing** | Name gaps: the cumbia set fits. |
| Vallenato | Medium (Colombia) | Partly: paseo side steps (partner) | "Vallenato" · latin, cumbia (4) | **thin** | |
| Champeta | Low-Medium (Colombian Caribbean coast) | Yes: Afro-Colombian hip and knee isolations, soukous-like footwork | "Champeta" · latin, cumbia (4) | **thin** | Set misfit: closer to afro/soukous than cumbia. |
| Cha-cha / rumba / danzón / bolero | Low | Yes: cha-cha chassé, cucaracha, slow box | "Cha-cha-chá", "Rumba" · latin, chacha; "Bolero" · latin | **well served** | |
| Tango / tango nuevo | Low (Argentina/Uruguay; global niche) | Yes: caminata (walk), ochos (pivots), boleos, sacadas, cortes | "Tango" · tango (1) | **thin** | Walks go toward the viewer; ochos and boleos partly read. |
| Flamenco / flamenco pop / rumba catalana / sevillanas / paso doble | Medium in Spain (Rosalía era), Low globally | Yes: braceo, floreo, palmas, marcaje, zapateado, vuelta, llamada ([glossary](https://en.wikipedia.org/wiki/Glossary_of_flamenco_terms)) | "Flamenco", "Sevillanas", "Paso doble" · flamenco (4); "rumba catalana" not tested | **thin** | Front-plane arms (braceo, floreo) read very well. |
| Banda / tecnobanda | High in Mexico and the US (regional Mexican is the largest US Latin sub-genre, 2024) | Yes: quebradita, caballito trot, zapateado, remates | "Banda" · mexican (2) | **thin** | |
| Norteño / sierreño / corridos / corridos tumbados / tejano | High (Peso Pluma, Fuerza Regida, Grupo Frontera) | Partly: norteño and tejano are danced as cumbia and polka two-step; tumbados mostly aren't danced | "Norteño", "Corridos", "Corridos tumbados", "Tejano" · mexican (2) | **thin** | |
| Mariachi / ranchera / son jalisciense | Medium | Yes: jarabe tapatío zapateado, hat dance, faldeo (skirt work), machete work ([Dance Spirit](https://dancespirit.com/baile-folklorico-world-dance/)) | "Mariachi", "Regional Mexican" · mexican (2) | **thin** | |
| Huapango / son huasteco / son jarocho | Low | Yes: campanas, deslizados, puntas, paso de tres, jaranas ([guide](https://www.mexicotravelandleisure.com/blog/huapango-dance/)) | "Huapango" · mexican (2) | **thin** | |
| Quebradita / duranguense | Low (90s / 2000s crazes, still at parties) | Yes: caballito / brinquito trotting steps; quebradita hops and the partner dip; pasito duranguense small hops ([Wikipedia](https://en.wikipedia.org/wiki/Quebradita)) | "quebradita" → Mixed styles; "Duranguense" · mexican (2) | **missing** | Name gap: "quebradita". |
| Bomba / plena (Puerto Rico) | Low | Yes: bomba piquetes (dancer's accents answered by the drum), skirt work | "bomba", "plena" → Mixed styles | **missing** | |
| Kizomba / semba / tarraxinha | Low-Medium (Angola, Lusophone; global social dance) | Yes, but a close-hold partner dance: walks, saídas, ginga hip sway | "Kizomba", "Semba" · afro (17), hiphop; "tarraxinha" → Mixed styles | **thin** | Set misfit: afro street dance and hip-hop for a smooth walking dance. The walks go toward the viewer. |
| Zouk / kompa (compas) | Low-Medium (Antilles, Haiti, diaspora) | Partly: slow side sway in close hold, hip roll | "Zouk", "Kompa", "Compas" · caribbean (14) | **thin** | Set misfit: dancehall moves for a slow couple sway. |

## 8. Brazil

| Genre / scene | How common | Own copyable vocabulary? + example steps | App today | Verdict | Notes |
|---|---|---|---|---|---|
| Samba / pagode / samba de roda / samba-reggae / axé / MPB / bossa nova | Medium (Brazil; carnival) | Yes: samba no pé, whisk, bota fogo, axé wave | "Samba", "Pagode", "Axé", "Samba de roda", "MPB", "Bossa nova" · brazil (17) | **well served** | |
| Funk carioca / baile funk / passinho / Brazilian phonk | High in Brazil; global TikTok | Yes: passinho, quadradinho, sarrada, descer rebolando | "Funk carioca", "Baile funk", "Brazilian phonk" · brazil (17) | **well served** | |
| Sertanejo (universitário) | High (Brazil's most-streamed genre) | Partly: sertanejo/vanera partner two-step, arrasta-pé | "Sertanejo" · brazil (17) | **thin** | Set misfit: samba, funk and frevo moves for country-like music. The country set would suit it better. |
| Forró / xote / baião / piseiro / arrocha | High in Northeast Brazil (piseiro dominated charts 2020-23) | Yes: forró basic "dois pra lá, dois pra cá" side steps, xote, piseiro solo steps | "Forró" · brazil (Forró Side Basic only); "piseiro", "xote", "arrocha" → Mixed styles | **thin** | Name gaps. |
| Frevo | Low | Yes: umbrella kicks, scissor (tesoura), knee swivels | "Frevo" · brazil (3 frevo moves) | **well served** | |
| Brega / tecnobrega / carimbó / lambada / maracatu / afoxé | Low-Medium (Pará, Pernambuco) | Yes: lambada hip sway, carimbó skirt circles, maracatu stamping | all → Mixed styles | **missing** | Name gaps. Lambada sways read. |
| Capoeira music | Low | Yes: ginga, esquiva, meia-lua kicks | "Capoeira" · capoeira (2), latin | **thin** | |

## 9. Caribbean

| Genre / scene | How common | Own copyable vocabulary? + example steps | App today | Verdict | Notes |
|---|---|---|---|---|---|
| Dancehall | Medium-High (Jamaica, UK; global influence) | Yes: Bogle, Willie Bounce, Signal di Plane, Gully Creepa, Pon di River; also Nuh Linga, Shankle, Rockaway (unsourced) | "Dancehall", "Ragga" · caribbean (14) | **well served** (borderline) | Dancehall has hundreds of named steps; a later grow candidate. |
| Reggae / roots / lovers rock / dub / reggae fusion / Pacific reggae / mento | Medium | Partly: reggae skank, rub-a-dub sway, wine | "Reggae", "Roots reggae", "Lovers rock", "Dub", "Reggae Pacific" · caribbean (14); "mento" → Mixed styles | **well served** | |
| Soca / calypso / bouyon / chutney soca | Medium (carnival season) | Yes: wine (waist roll), jump & wave, chip (shuffle-walk), rag wave | "Soca", "Calypso", "Bouyon", "Chutney soca" · caribbean (14); "chutney", "steelpan" → Mixed styles | **well served** (borderline) | Soca's own moves in the shared set: Wine & Wave, Jump & Wave, Palance, Bacchanal. |

## 10. Africa

| Genre / scene | How common | Own copyable vocabulary? + example steps | App today | Verdict | Notes |
|---|---|---|---|---|---|
| Afrobeats / afropop (Nigeria, Ghana) | High: +28-34% global streams 2024 | Yes: Zanku (legwork), Shaku Shaku, Azonto, Shoki, Soapy, Pilolo, Kupe, Buga, Etighi, Skelewu ([Rolling Stone Africa](https://rollingstoneafrica.com/?p=7178)) | "Afrobeats", "Afropop" · afro (17), hiphop; "azonto" → Mixed styles | **well served** | Name gap: "azonto" (Azonto Knee Twist exists). |
| Highlife / hiplife | Medium (Ghana; +54% 2024) | Partly: highlife side-step sway, hand waves | "Highlife" · afro (17); "hiplife" → Mixed styles | **well served** | |
| Afrobeat (Fela) / jùjú / fuji / alté | Low | Partly | afro (17), hiphop | **well served** | |
| Amapiano | High in Africa; fastest-growing African genre (+59% 2024) | Yes: Vosho, Pouncing Cat, Zekethe, Dakiwe, Umlando, Tshwala Bam groove, baleka glide ([Red Bull](https://www.redbull.com/za-en/sa-dance-styles)) | "Amapiano" · afro, amapiano (8), hiphop | **thin** | |
| Gqom / bhenga / kwaito / pantsula | Medium (South Africa) | Yes: bhenga wavy arms, toe taps and wobbly knees; gwara gwara; isiPantsula quick footwork | "Gqom", "Kwaito" · afro, amapiano, hiphop | **well served** | |
| Kuduro / batida (Angola) | Low-Medium | Yes: kuduro stomps, exaggerated broken knee/hip angles | "Kuduro" · afro (17); "batida" → Mixed styles | **well served** | |
| Coupé-décalé / zouglou / mapouka (Côte d'Ivoire) | Medium (Francophone Africa) | Yes: dance crazes named in the songs, e.g. "grippe aviaire" arm flaps (unsourced) | "Coupé-décalé" · afro (17); "zouglou", "mapouka" → Mixed styles | **thin** | The afro set has no Ivorian steps. |
| Ndombolo / soukous / Congolese rumba / kwassa kwassa | Medium (Central and East Africa) | Yes: ndombolo hip wind, soukous side step with hip roll, kwassa kwassa | "Ndombolo", "Soukous" · afro (has Ndombolo); "Congolese rumba" · latin, chacha (misroute); "kwassa kwassa" → Mixed styles | **thin** | Congolese rumba should open afro, not Latin cha-cha. |
| Bongo flava / gengetone / singeli / benga / mbalax / makossa / bikutsi | Medium (East and West Africa) | Partly: sabar high-knee kicks (mbalax), singeli fast footwork | "Bongo flava", "Gengetone", "Mbalax", "Makossa" · afro (17); "singeli", "benga", "bikutsi" → Mixed styles | **well served** | Name gaps. |
| Ethiopian (eskista) / Ethio-jazz | Low-Medium (Ethiopia, diaspora) | Yes: eskista, the shoulder dance: rapid shoulder bounces, neck slides, chest pops | "Ethiopian", "eskista" → Mixed styles; "Ethio-jazz" · swing, discofunk | **missing** | Shoulders move in the front plane, so it reads very well. |
| Maskandi / mbaqanga / isicathamiya / sega / salegy / maloya | Low | Yes: indlamu high kick-stomp (afro has Indlamu Stomp), isicathamiya tiptoe steps, sega hip sway | all → Mixed styles | **missing** | Name gaps. Low priority. |

## 11. Middle East, North Africa, Turkey, Iran, Central Asia

| Genre / scene | How common | Own copyable vocabulary? + example steps | App today | Verdict | Notes |
|---|---|---|---|---|---|
| Arabic pop (Egyptian, Levantine, Gulf) | High in the Middle East and North Africa | Yes: raqs sharqi hips, shimmies, snake arms | "Arabic pop", "Arabic" · bellydance (3) | **thin** | Only 3 moves. |
| Raqs sharqi / belly dance / baladi / saidi | Medium | Yes: hip drop, hip lift, maya, taxim, shimmy, camel, snake arms, saidi cane hop ([glossary](https://en.wikipedia.org/wiki/Glossary_of_belly_dance_terms)) | "Belly dance", "Raqs sharqi" · bellydance (3) | **thin** | Maya and hip drops are vertical, in the front plane, so they read. Hip circles don't. |
| Khaleeji | Medium (Gulf) | Yes: na'ashat hair toss, drop step with swaying hands, thobe-sleeve frame ([Wikipedia](https://en.wikipedia.org/wiki/Khaleegy_(dance))) | "Khaleeji" · bellydance (3) | **thin** | |
| Dabke (Levant) | Medium (weddings) | Yes: dabke stomp, cross & hop, line kicks | "Dabke" · folk (31, 2 dabke moves) | **well served** | |
| Raï / chaabi / gnawa (Maghreb) | Medium (Algeria, Morocco, France) | Partly: hip and shoulder shimmies; gnawa head swing | "Raï", "Chaabi" · bellydance (3); "gnawa", "Moroccan", "Algerian" → Mixed styles | **thin** | |
| Mahraganat / shaabi (Egypt) | Medium-High (tops Egyptian streaming) | Partly: street-wedding dance: arm swings, shoulder shakes, knife-hand jabs (unsourced) | "Mahraganat", "Shaabi" · bellydance (3) | **thin** | |
| Turkish pop / arabesk / halay / horon | Medium-High (Turkey) | Yes: halay (shoulder-linked step and dip), horon shimmy, göbek dansı | "Turkish pop" · bellydance (3); "Halay" · folk; "Arabesk" → Mixed styles | **thin** | Turkish pop routes to the 3-move belly set. |
| Persian pop / Bandari | Medium (Iran, large diaspora) | Yes: wrist circles, Persian arms (side waves led by the wrists), shoulder shimmy, step-shoulder, Bandari shakes ([Wikipedia](https://en.wikipedia.org/wiki/Iranian_dance)) | "Persian pop" · -; "Iranian", "Bandari" → Mixed styles | **missing** | All arms, so it reads well. |
| Mizrahi / Israeli folk / klezmer | Low-Medium | Yes: hora, Yemenite step, mayim | "Mizrahi" · bellydance; "Israeli folk", "Klezmer" · folk (31); "Jewish", "Yiddish" → Mixed styles | **well served** | |
| Kurdish / Armenian / Assyrian / Georgian / Azerbaijani / Afghan (attan) / Uyghur | Low | Yes: govend / halay line steps, kochari, Georgian toe steps, attan spins with arm swings, Uyghur neck slide | all → Mixed styles | **missing** | Folk has Halay and Lezginka, but no name opens them. Low priority. |

## 12. South Asia

| Genre / scene | How common | Own copyable vocabulary? + example steps | App today | Verdict | Notes |
|---|---|---|---|---|---|
| Bollywood / filmi / Hindi pop | High (film songs dominate Indian streaming) | Yes: thumka, light-bulb, naagin, hook steps | "Bollywood", "Filmi", "Hindi pop" · southasian (37) | **well served** | |
| Bhangra / Punjabi pop | High (Punjabi pop global) | Yes: bhangra shoulders, hop, luddi | "Bhangra", "Punjabi pop", "Punjabi" · southasian (37) | **well served** | |
| Garba / dandiya | Medium (Navratri season) | Yes: two- and three-clap garba, dandiya strike | "Garba", "Dandiya" · southasian (37) | **well served** | |
| Tamil / Telugu (Kollywood, Tollywood) | High (South India) | Yes: kuthu (Tamil street-folk dance on the thappu drum), "mass" hook steps | "Tamil" · southasian (37) | **well served** | Kuthu is not in the set (possible later grow). |
| Bhojpuri / Haryanvi / Marathi (lavani, koli) | High regionally (Bhojpuri is huge on YouTube) | Yes: lavani (hip accents, foot stamps), koli (rowing arms) | "Bhojpuri", "Haryanvi", "Marathi", "lavani" → Mixed styles | **missing** | Name gaps: the southasian set fits. |
| Qawwali / Sufi / bhajan / ghazal / Carnatic / Indian classical | Medium | Partly: dhamaal (Sufi), devotional clapping | "Sufi", "Qawwali" · southasian; "Bhajan", "Ghazal", "Carnatic", "Indian classical" · - | **well served** | Calm music. |
| Pakistani pop / Lollywood / Pashto / Nepali / Bengali | Medium | Partly | all → Mixed styles | **missing** | Name gaps. |

## 13. East and Southeast Asia (traditional and regional pop)

| Genre / scene | How common | Own copyable vocabulary? + example steps | App today | Verdict | Notes |
|---|---|---|---|---|---|
| Thai luk thung / mor lam; Lao lam; Khmer romvong / saravan | High in Thailand (national country-pop), Medium in Laos and Cambodia | Yes: ramwong / romvong hand gestures (folded palms, fingers at right angles, hands brought from behind to the face, fingers straighten and bend); jeeb and tang wong hand shapes; a springy mor lam side step (unsourced) ([Romvong](https://en.wikipedia.org/wiki/Romvong)) | "luk thung", "mor lam", "Lao", "Cambodian" → Mixed styles | **missing** | Hands and arms move in the front plane, so they read well. |
| Dangdut / koplo / joget | High (Indonesia's most popular music; also Malaysia) | Yes: joget sway, goyang gergaji (hands saw beside the hip), goyang itik / bebek (duck shake), goyang patah-patah (broken hip breaks), goyang dribble ([Malay Mail](https://www.malaymail.com/news/life/2018/03/13/from-drill-dance-to-the-dribble-dangdut-twerking-through-the-ages/1596827)) | "Dangdut", "Koplo", "Joget" · -; "Indonesian pop", "Malaysian pop" · - | **missing** | Goyang ngebor is a horizontal hip circle (won't read); the rest do. |
| Jaipongan / zapin / kuda lumping (Indonesia, Malaysia) | Low | Yes: jaipongan hip and arm accents; zapin steps | "jaipongan", "zapin" → Mixed styles | **missing** | Low priority. |
| Chinese folk / guoyue / square dancing | Medium (guangchang wu: very many daily dancers) | Yes: yangge, fan dance, ribbon | "Chinese folk" · folk (31); "guoyue" → Mixed styles | **well served** | |
| Japanese festival (bon odori, awa odori, yosakoi) | Low (seasonal) | Yes | (folk has Bon Odori Clap Step and Awa Odori Step) | **well served** | |

## 14. Europe

| Genre / scene | How common | Own copyable vocabulary? + example steps | App today | Verdict | Notes |
|---|---|---|---|---|---|
| Irish / Celtic traditional | Medium-Low (St Patrick's, Celtic niche) | Yes: Irish threes and sevens, cut, rock (fine footwork, arms still) | "Celtic", "Irish folk" · folk (31); "Irish traditional", "Irish" → Mixed styles | **well served** | Name gaps. Footwork is fine; hops and kicks read. |
| Polka / oompah | Low-Medium (Central Europe, US Midwest) | Yes: polka hop, heel-toe polka | "Polka" · folk (31) | **well served** | |
| Schlager / Volkstümliche Musik / Oktoberfest / levenslied / Après-ski | High in Germany, Austria, Switzerland and the Netherlands | Yes: Schunkeln (arm-linked side sway), Discofox, polka hops, toast raises, Chicken Dance figures ([Schunkeln](https://en.wikipedia.org/wiki/Schunkeln)) | "Schlager" · -; "Volkstümliche Musik", "Oktoberfest", "levenslied" → Mixed styles | **missing** | |
| Balkan / turbo-folk / chalga / manele | Medium (Balkans) | Yes: kolo / oro / hora line steps, čoček hips, shoulder shimmies | "Balkan", "Turbo-folk", "Chalga", "Manele" · folk (31); "Serbian", "Bulgarian", "Romanian", "Albanian" → Mixed styles | **well served** | |
| Greek (laïko, rebetiko, Greek pop, syrtaki, zeibekiko, tsifteteli) | Medium (Greece) | Yes: sirtaki, zeibekiko (solo improvised dips, slaps and turns), tsifteteli (belly-dance-like) | "Laïko", "Rebetiko" · folk; "Greek", "Greek pop", "syrtaki", "zeibekiko" → - / Mixed styles | **thin** | Folk has Sirtaki, but the common names open nothing. |
| Italian (tarantella, pizzica, Italian pop) | Medium | Yes: tarantella skip, pizzica tambourine | "tarantella", "pizzica" → Mixed styles; "Italian pop" · - | **missing** | Folk has Tarantella Skip, but no name opens it. |
| Russian / Ukrainian / Polish | Medium | Yes: prisyadka (squat kicks), kalinka heel-toe, hopak | "Russian pop" · -; "Ukrainian", "Polish" → Mixed styles | **well served** | Pop isn't danced in a special way; folk has Kalinka. |
| Western and Northern European folk-pop: chanson, musette, fest-noz, jota, sardana, fado, vira, humppa, csárdás, Nordic folk | Low | Partly: an dro (Breton), jota hops, vira circle, csárdás side steps and heel clicks | "Chanson", "Fado" · -; "Nordic folk" · folk; the rest → Mixed styles | **well served** | Mostly not danced to recordings; name gaps for jota and csárdás. |

## 15. Pacific

| Genre / scene | How common | Own copyable vocabulary? + example steps | App today | Verdict | Notes |
|---|---|---|---|---|---|
| Hawaiian / hula | Low-Medium | Yes: kaholo, hela, ʻuwehe, ʻami (hip circle) | "Hula", "Hawaiian", "Polynesian" · hula (6) | **thin** | |
| Tahitian ʻori / ʻōteʻa | Low | Yes: tamau (side sway), tairi tamau, faʻarapu (fast hip circle), varu (figure-eight), otamu, afata (box), paʻoti (men's knee scissor) | "Tahitian" → Mixed styles | **missing** | Hula has Tahitian Tamau, but the name doesn't open it. Faʻarapu is horizontal (won't read). |
| Māori haka / kapa haka / poi | Low-Medium (NZ; rugby; viral clips) | Yes: takahi (stomp), wiri (hand quiver), pūkana, pakia (body slaps), poi swings ([NZQA Te Ao Haka exemplar](https://www2.nzqa.govt.nz/assets/NCEA/Subject-pages/Te-Ao-Haka/Exemplars/91976/Te-Ao-Haka-1.1-Achieved-Exemplar-A.pdf)) | "haka", "kapa haka", "Māori" → Mixed styles | **missing** | Front-plane and percussive. Cultural care: haka are owned compositions, so use the actions, not a haka. |
| Samoan siva / sasa / faʻataupati; Tongan, Fijian meke | Low | Yes: sasa synchronised slaps and claps, siva hand flows, faʻataupati slap dance | "Samoan", "Samoan siva", "sasa", "Fijian", "Tongan" → Mixed styles | **missing** | Hula has Faʻataupati Slaps. |

---

## Headline count

Over **145 rows**: **well served 72** (including 3 borderline: country, dancehall, soca), **thin 46**, **missing 27**.

The well-served rows are mostly pop, rock, hip-hop, funk/soul, K-pop, South Asia,
samba/funk carioca and Afrobeats, plus music that isn't danced in a recognisable way. The
thin rows cluster in Latin (bachata, cumbia, salsa, tango, flamenco, the regional Mexican
styles), electronic (EDM, house, techno, bass) and the 3-move belly-dance set that all of
Arabic, Turkish and North African pop routes to. The missing rows are gospel/worship,
Southeast Asian pop (dangdut, luk thung), Persian, schlager, the Pacific, Ethiopian, otaku,
stepping, and a long tail of names the resolver doesn't know.

## Prioritised top 15 to add or grow

Rank = (how often it's played) x (how badly it's served) x (how readable its steps are from
the front). Each entry lists candidate steps (individual steps, never a routine) and a
reference to author from.

### 1. Gospel and praise/worship: new set (missing; the owner asked)
Medium-High play (US 7th genre and growing; church use is enormous) x missing x highly
readable (arms in the front plane, side sway, claps). Calm worship is already lyrical; this
set is for upbeat gospel and praise.
- **Choir step-sway**: step side, close, sway torso and low arms with the step; slow and wide on verses, faster and tighter as the tempo lifts ([Helping You Harmonise](https://www.helpingyouharmonise.com/movement_learning), [Alfred](https://www.alfred.com/blogs/alfred-music-blog/singers-move-enhancing-choral-performances-movement)).
- **Choir step-clap**: step-touch with the clap on 2 and 4 (the congregation's backbeat clap, [Shout](https://en.wikipedia.org/wiki/Shout_band)).
- **Overhead praise clap**: step diagonally, raise both hands above the head and clap to that side as the free foot touches in ([Church Choir step sheet](https://www.linedance.com/dance/150585/church-choir)).
- **One-arm raise**: one arm lifted straight, palm out, switching arms at the phrase ([spotter's guide](https://www.christiantoday.com/news/lifting-holy-hands-a-spotters-guide-to-worshippers-arms)).
- **Rapid switcher**: alternate arm raises at each line, with a foot tap and a little hip (same source).
- **Both hands lifted**: both arms up in a wide V, swaying (same; [Raising hands](https://en.wikipedia.org/wiki/Raising_hands)).
- **Halfway offering**: palms up at chest height, rising on the phrase (same spotter's guide).
- **Heavenward point / power fist**: one fist or index finger driven upward with a small head bow (same).
- **Praise break (shout)**: fast stamping in place, knees bent, arms pumping, upper body undulating; the climax move ([Shout](https://en.wikipedia.org/wiki/Shout_band)).
- **Ring-shout shuffle**: flat-footed shuffle with the heel marking the beat, feet never crossing, knees bent, shoulders working, claps on the accents ([Ring shout](https://en.wikipedia.org/wiki/Ring_shout)).
- **Holy two-step**: arm-swinging side-to-side two-step from the church shout (same).

### 2. Regional Mexican (banda, norteño, mariachi, huapango, quebradita): grow `mexican` (2)
High (largest US Latin sub-genre; huge in Mexico) x thin x good (stamps, side steps, skirt and hat arms, trotting bounce). Fix the "quebradita" name gap too.
- **Zapateado basic**: heel, ball and flat strikes in place, pressing with the heel ([Dance Spirit](https://dancespirit.com/baile-folklorico-world-dance/)).
- **Remate**: a stomp accent that closes a phrase (same).
- **Gatillo**: a heel accent between steps (same).
- **Sencillo**: a simple scuffing step (same).
- **Faldeo**: skirt-work arms; one hand lifts the skirt as the opposite foot steps (opposition), or both sweep with the feet (same). Folklórico Skirt exists, so add the alternating/opposition version.
- **Machete strikes**: the men's machete work from Jalisco/Nayarit dances, as front-plane arm strikes (same).
- **Campanas**: side-to-side weight shift with two heel strikes per side ([huapango guide](https://www.mexicotravelandleisure.com/blog/huapango-dance/)).
- **Puntas**: one foot taps while the other toe points, alternating (same).
- **Paso de tres**: a three-beat zapateado (same).
- **Jarana**: step, step, step, step, then five rapid strikes in one direction; the climax step (same; travel it sideways).
- **Caballito**: trotting, horse-riding bounce, from banda/tecnobanda dancing ([Quebradita](https://en.wikipedia.org/wiki/Quebradita)).
- **Quebradita hop**: side-to-side steps with a front-foot jump and return ([AAHPERD handout](https://aahperd.confex.com/aahperd/2015/webprogram/Handout/Session60578/STEPS-Dances%20from%20Mexico.pdf)).
- **Paseado**: the slower walking step of the sung sections ([SoCal folk dance](https://socalfolkdance.org/articles/jarabe_pill.htm)).

### 3. Bachata: grow `bachata` (2)
High x very thin x good (side basic with hip pop, bounce, waves).
- **Side basic with hip check**: 3 steps sideways plus a tap or hip pop on 4 and 8 ([Wikipedia](https://en.wikipedia.org/wiki/Bachata_(dance))).
- **Foot-lift basic**: the beginner tap done as a slight foot lift (same).
- **Dominican box**: side, side, forward, tap / side, side, back, tap (same). Partly toward the viewer: angle it.
- **Diagonal box**: the Dominican diagonal variant ([Dance With Me](https://dancewithmeusa.com/how-to-dance-bachata/)).
- **Stationary basic**: steps on the spot with the hip isolations in front ([Dance With Me](https://dancewithmeusa.com/how-to-dance-bachata/)).
- **Basic turn**: a full turn in 3 counts while travelling the side-basic distance (same).
- **Triple on 4 (Dominican cha-cha)**: the tap replaced by a quick triple (same).
- **Syncopated taps**: off-beat taps between the main beats ([Wikipedia](https://en.wikipedia.org/wiki/Bachata_(dance))).
- **Bachata bounce**: rise on the beats and lower between them (same).
- **Body wave**: the sensual-style wave, chest to hips (same).
- See also [Bachateros: traditional fundamentals](https://www.bachateros.com/about-bachata/styles/standard/bachata-traditional-fundamentals/).

### 4. Cumbia: grow `cumbia` (4); add "technocumbia" and "cuarteto" names
High (all of Latin America and US Latino) x thin x fair (the back-break needs angling; side and turning versions read).
- **Back-break basic**: break back on beats 1 and 5 with a rebounding feel ([Salsa Vida dancepedia](https://www.salsavida.com/dancepedia/cumbia/)).
- **Circular basic**: the back-rock basic rotating around a point, a quarter per bar (same).
- **Cumbia kick and tap**: kicks and taps added to the basic (same; ["leg kicks and breaking backwards"](https://www.salsavida.com/salsa-101/salsa-dance-terms/)).
- **Kick forward, step back**: the Colombian basic ([classpop](https://www.classpop.com/magazine/how-to-dance-cumbia)).
- **Cumbia side basic**: side, together, side ([classpop](https://www.classpop.com/magazine/how-to-dance-cumbia)).
- **Cumbia turn**: a spin built on the basic (same).
- **Processional slide step**: the traditional grounded, sliding step that marks the drums ([Salsa Vida](https://www.salsavida.com/dancepedia/cumbia/)).
- **Hat / scarf sway**: the men's traditional hat or scarf in hand, waving on the sway (same: men wear hats and scarves). Candle and skirt moves already exist.
- **Caleña kick-and-triple**: kicks and cha-cha triples between back-breaks, from salsa caleña (same).

### 5. Country: grow `country` (23; the owner asked); add the "line dance", "line dancing" and "Texas two-step" names
High (US 117.6 bn) x borderline x very readable (lateral vines, kicks, claps, hip bumps).
All from [roots-boots line-dance definitions](https://roots-boots.net/ldance/definitions.html) and
[53 line-dancing steps](https://www.countrydancingtonight.com/53-line-dancing-steps-you-need-to-know/):
- **Coaster step**: back, together, forward (1&2). Angle it on the diagonal.
- **Rocking chair**: rock forward, recover, rock back, recover. Do it on the diagonal, or as a side rock-step with a hip shift.
- **Jazz box**: cross, back, side, together, often with a quarter turn.
- **Toe strut** (a series of them travelling sideways): toe down, then drop the heel.
- **Kick-ball-change**: kick, step on the ball, change weight.
- **Hip bumps**: bump the hips to the side twice and switch, the same idea as the Achy Breaky / Tush Push hip section.
- **Heel grind**: heel forward and down, toe fans out.
- **Swivels / heel split**: heels or toes swivel out and back on both feet.
- **Military pivot**: two step-pivot half turns.
- **Paddle turn**: a quarter turn made with ball changes.
- **Rolling vine**: a vine with a full turn.
- **Scissor step**: side, together, cross.
- Applejacks already exists in `swing` as "Apple Jacks"; consider moving it to country.

### 6. Arabic pop / belly dance / khaleeji / Turkish pop: grow `bellydance` (3)
High in the Middle East and North Africa, and many names route here (Arabic pop, Turkish pop, raï, shaabi, mahraganat, khaleeji, mizrahi) x very thin x good (vertical hip accents, shimmies, arms, hair).
- **Hip drop**: one hip from up to down, accent on the drop, weight on the other foot ([glossary](https://en.wikipedia.org/wiki/Glossary_of_belly_dance_terms), [raqs.co.nz](https://raqs.co.nz/moves/glossary.html)).
- **Hip lift**: the reverse, a strong upward accent (same).
- **Hip slide**: lateral hip shift side to side (same glossary).
- **Maya**: a vertical figure-eight of the hips travelling outward; front plane, reads (same).
- **Taxim**: shift, drop the hip, slide, lift and roll in (same).
- **Egyptian shimmy**: alternating knee-driven hip shimmy (same).
- **Shoulder shimmy**: fast alternating shoulders (same).
- **Chest lift and drop**: vertical chest accents (same).
- **Chest camel**: rolling chest undulation; pair it with a side shift so it reads (same).
- **Saidi cane hop**: the hopping step of raqs assaya with the cane held overhead (unsourced).
- **Khaleeji hair toss**: hair and head swung side to side, the na'ashat signature ([Wikipedia](https://en.wikipedia.org/wiki/Khaleegy_(dance)), [Belly Dance Geek](https://www.bellydancegeek.com/2013/03/the-big-5-khaleegy/)).
- **Khaleeji drop step**: a simple drop step with swaying hand gestures ([World Belly Dance](https://www.worldbellydance.com/?p=6391)).
- **Thobe frame**: both hands lift the dress sleeves to frame head slides ([Atlanta Belly Dance](https://m.atlantabellydance.com/Overview/Saudi.html)).

### 7. Salsa: grow `salsa` (6)
Medium x thin x good (shines are solo and mostly lateral or crossing).
- **Suzy Q**: knees and feet swivel as they cross over each other, then step apart, travelling sideways ([mechanics](https://lurklurk.org/lindyhop/m_suzie_q.html), [Dance Dojo: 7 Suzie Q variations](https://thedancedojo.com/?p=135872)).
- **Suzy Q Plus**: go one way and back (same).
- **Suzy Q point / flare**: a flared foot on the fourth step (same).
- **Suzy Q kick / double kick** ([Library of Dance list](https://libraryofdance.org/dances/salsa-shines)).
- **Cross steps (SQQ)**: cross-step travelling shine (same list).
- **Jazz square**: listed under cross steps (same).
- **Back breaks**: alternating rocks back (same; angle them).
- **Double-time taps (mambo taps)**: quick taps in the basic (same).
- **Flares**: the foot flicks out to the side (same list).
- **Cuban motion**: a figure-eight of hips and torso as styling ([Salsa Vida terms](https://www.salsavida.com/salsa-101/salsa-dance-terms/)). Use the vertical/lateral components.
- **Spot turn / paddle turn**: turning shines (Library of Dance).

### 8. House and UK garage: grow `house` (9)
High (house) x thin x good (lateral footwork with a bounce; jacking).
From [STEEZY: what is house dance](https://www.steezy.co/posts/what-is-house-dance) and [Wikipedia House dance](https://en.wikipedia.org/wiki/House_dance):
- **Farmer**: bounce while stomping one foot, alternating.
- **Skate**: diagonal slide-out step like skating, side to side.
- **House shuffle**: square-footed hop, switching sides.
- **Heel-toe**: heel and toe swivels travelling sideways (borrowed from Jamaican skanking).
- **Train**: rhythmic side-to-side chugging footwork.
- **Sidewalk**: a lateral travelling glide.
- **Swivel**: heels and toes swivel to travel.
- **Pas de bourrée (PBR)**: behind, side, front, as a house rhythm.
- **Jack in the Box**: the illusion of jumping in place.
- **House salsa step / gallop**: listed in the house foundations.
- Existing: Jacking, Loose Legs, House Stomp, Box Frame, Scissor Step, Crossroads, Floor Sweep, Vogue Arms and Pose.

### 9. Amapiano: grow `amapiano` (8)
High in Africa and the fastest-growing African genre x thin x good (shoulders, bounce, glides). Written sources are thin; check Zekethe, Dakiwe and Umlando against videos before authoring.
- **Tshwala Bam groove**: loose shoulder roll side to side, bounce on the balls of the feet stepping L-R-L with a wrist twist on each step ([The Moveee](https://themoveee.com/2024/03/12/how-to-do-the-tshwala-bami-dance-like-a-real-south-african-amapiano-stepper/)).
- **Imaginary glass toast**: raise the drink on the phrase (same).
- **Shirt-shoulder pluck**: pluck the shirt at the shoulders on the beat (same).
- **Umlando (Mlando)**: forward bend with the hips in a figure-eight (search summary of [Afroconex](https://www.afroconex.online/amp/amapiano-the-music-and-dance-craze-moving-south-africa-and-the-world)). Make it lateral to read.
- **Zekethe** and **Dakiwe**: viral amapiano moves ([Red Bull](https://www.redbull.com/za-en/sa-dance-styles)); descriptions need video.
- **Baleka glide**: the moonwalk-like amapiano glide, reworked as a sideways glide ([Music In Africa](https://www.musicinafrica.net/node/385277)).
- **Bhenga wobble**: gqom's wavy arms, toe taps and wobbly knees ([Red Bull](https://www.redbull.com/za-en/sa-dance-styles)).
- **Pantsula quick step**: quick on-the-spot footwork with dice-roll gestures (same). Roll the Dice exists in discofunk.

### 10. Southeast Asian pop: dangdut / koplo and Thai luk thung / mor lam (new set; missing)
High (Indonesia ~280 M people; Thailand) x missing x very readable (hands, arms, hip-to-the-side).
- **Joget sway**: the everyday dangdut dance: small side steps with bent arms and soft alternating hand rolls and finger points ([Esplanade guide](https://www.esplanade.com/offstage/arts/dangdut-a-guide-to-indonesias-most-popular-music)).
- **Goyang gergaji**: hands saw back and forth beside the hip ([Malay Mail](https://www.malaymail.com/news/life/2018/03/13/from-drill-dance-to-the-dribble-dangdut-twerking-through-the-ages/1596827)).
- **Goyang itik / bebek**: duck-walk shake (same).
- **Goyang patah-patah**: "broken", jerky hip breaks (same; keep them lateral).
- **Goyang dribble**: hands bounce an imaginary basketball, up and down (same).
- **Ramwong hands**: palms folded with the fingers at right angles to the wrists, hands brought from behind the body to before the face, fingers straightening and bending, the two hands moving in opposition ([Romvong](https://en.wikipedia.org/wiki/Romvong)).
- **Jeeb hand flourish**: thumb and forefinger pinched, other fingers fanned, rotating at the wrist ([Dance in Thailand](https://en.wikipedia.org/wiki/Dance_in_Thailand)).
- **Ramwong circle step**: a slow travelling step around the circle, shown as side travel (same Romvong).
- Skip goyang ngebor (a horizontal "drill" hip circle that won't read).

### 11. EDM family: shuffle, hardstyle, techno/Tecktonik: grow `edm` (10)
High x thin x mixed (arms read; fast footwork needs bold, lateral versions).
- **Running Man variants**: light (heel landing), heavy (flat) and reverse ([Fuego](https://fuegodance.com/blogs/all/how-to-shuffle-dance), [VICE](https://www.vice.com/en/article/how-to-shuffle-like-a-pro/)). The base Running Man is global; genre-gate the variants.
- **T-Step**: heel-toe swivel driving lateral travel (same). Global today.
- **Shuffle Charleston / criss-cross**: the shuffle forms of the Charleston (same; [Melbourne shuffle](https://en.wikipedia.org/wiki/Melbourne_shuffle)).
- **Kick-out (T-step with air kick and cross)**: (same lists).
- **Shuffle spin**: a 360 on the running man (same).
- **Tecktonik arms**: fast arm whips and wrist rolls framing the head ([Tecktonik](https://en.wikipedia.org/wiki/Tecktonik)).
- **Hardstyle shuffle**: hardstyle's running-man/kick hybrid (unsourced; check video).
- Existing: Hands Up, Crouch & Drop, Cutting Shapes, Jumpstyle Kick, Hakken, Pound & Pump, Trance Arm Sweep, Techno Stomp, DJ Scratch, Build & Drop.

### 12. Reggaeton / dembow: grow `reggaeton` (9)
High x thin x good. Written step sources are weak (mostly content-farm pages); the reliable ones only name perreo, body waves and isolations.
- **Perreo stance pump**: low wide stance, rhythmic hip pump; pair it with a lateral shift so it reads ([Discover Puerto Rico](https://www.discoverpuertorico.com/article/guide-to-reggaeton-puerto-rico), [Perreo](https://en.wikipedia.org/wiki/Perreo)).
- **Reggaeton wine**: hip sway side to side, from Jamaican whining (same).
- **Body wave**: chest-to-hip wave ([Dance Gods](https://dancegods.netlify.app/en/dance-styles/reggaeton)).
- **Isolations**: chest and shoulder pops on the dembow (same).
- **Dembow side step with clap**: the dembow basic travelling (the existing Dembow Step covers the basic).
- Next step: find a dance-school breakdown of Dominican dembow steps before authoring more.

### 13. Flamenco: grow `flamenco` (4)
Medium in Spain, Low globally x thin x excellent (braceo and floreo are front-plane; stamps and calls read).
- **Braceo**: arms pass from position to position in semicircles: down and outward from the top, or up through the centre of the torso ([Flamenco Málaga](https://flamencomalaga.com/en/blog/what-is-flamenco-braceo/)).
- **Floreo**: wrist circles with the fingers opening and closing ([glossary](https://en.wikipedia.org/wiki/Glossary_of_flamenco_terms)).
- **Palmas claras**: loud claps, fingers into the palm ([Spain Traveller](https://www.spain-traveller.com/en/flamenco-glossary)). Flamenco Palmas exists.
- **Palmas sordas**: muted cupped claps (same).
- **Marcaje**: marking the rhythm with the heel and ball while the arms work (same).
- **Golpe / tacón / planta**: full-foot, heel and ball strikes ([Studio Flamenco terms PDF](https://www.studioflamenco.com/_files/ugd/1f456c_94f789a8f4494de499bd680343944fab.pdf)).
- **Vuelta (front, back)**: turn types (same).
- **Llamada**: the call: a stamp break into a held pose that signals a new section ([NY City Center](https://nycitycenter.org/education/study-guides/flamenco-festival-study-guide/glossary)).
- **Remate**: the closing accent of a phrase (same glossaries).
- **Sevillanas pasada**: the passing step with arms raised, crossing sideways (unsourced).
- Tango (1 move) is the other Iberian/Rioplatense gap, but it is Low play and its walks go toward the viewer. Ochos and boleos are the readable part ([learntodancetango](https://learntodancetango.com/resources/articles/24/key-concepts-for-tango/)).

### 14. Persian pop / Bandari: new set or a `bellydance` sibling (missing)
Medium (Iran plus a large diaspora; weddings) x missing x excellent (all wrists, arms and shoulders).
- **Wrist circles**: both hands circling at shoulder height, leading the arms ([Iranian dance](https://en.wikipedia.org/wiki/Iranian_dance), [Atlanta Belly Dance: Persian](https://atlantabellydance.com/Overview/Persian.html)).
- **Persian arms**: large side waves up to shoulder-level curves, shoulders down, elbows curved (same).
- **Hand undulations**: wave through the hands and fingers (same).
- **Shoulder shimmy**: twice one way, then switch (same).
- **Step-shoulder basic**: step with an alternating shoulder accent (same).
- **Persian triple step** (same).
- **Twirl**: a soft spin with arms overhead (same).
- **Bandari shakes**: group dance of shoulder and arm shakes with few hip movements ([Iranica: modern Persian dance](https://www.iranicaonline.org/articles/dance-raqs/dance-iii-modern-persian-dance/)).

### 15. Schlager / Oktoberfest / Discofox: new set (missing)
High in Germany, Austria, Switzerland and the Netherlands x missing x good (sway, toasts, claps, polka hops).
- **Schunkeln**: linked-arm side-to-side sway on the spot; solo version with arms crossed or hands on imaginary neighbours ([Schunkeln](https://en.wikipedia.org/wiki/Schunkeln)).
- **Discofox basic**: tap, step, step to the side ([Discofox](https://en.wikipedia.org/wiki/Discofox), [Wikibooks](https://de.wikibooks.org/wiki/Tanzen:_Discofox)).
- **Discofox side step and turn**: the basic travelling, with a spin (same).
- **Prosit toast**: raise the stein, sway, clap (unsourced; Oktoberfest "Ein Prosit").
- **Chicken Dance figures**: beak snaps, wing flaps, tail-wiggle down, done as separate moves, not the routine ([SFDH](https://sfdh.us/encyclopedia/chicken_dance.html)). Funky Chicken exists in discofunk.
- **Polka hop / Schuhplattler slaps**: already in folk; open folk for these names.

### Next five (just outside the top 15)
- **Pacific**: Tahitian (tamau, tairi tamau, varu, otamu, afata, paʻoti; [Ōteʻa](https://en.wikipedia.org/wiki/Otea)), haka actions (takahi, wiri, pakia; [NZQA](https://www2.nzqa.govt.nz/assets/NCEA/Subject-pages/Te-Ao-Haka/Exemplars/91976/Te-Ao-Haka-1.1-Achieved-Exemplar-A.pdf)), Samoan sasa slaps. Low play but very readable, and mostly a names fix: "Tahitian", "haka", "Samoan" should open hula.
- **Bass music** (`bass` 9): DnB/jungle skank arms, rewinds, dubstep robot hits.
- **Ethiopian eskista**: shoulder dance, very readable, missing.
- **Wotagei / otaku**: glow-stick arm routines, all front-plane, missing.
- **Stepping and HBCU majorette**: stomp-clap-slap body percussion, high kicks and level drops, missing.

## Resolver fixes (no new moves needed)

Names that resolve to "Mixed styles" (nothing) although a fitting set exists:
- country: line dance, line dancing, Texas two-step, old-time, Appalachian, clogging, mountain music, square dance
- swing: jive, hustle (or discofunk), waltz, foxtrot, quickstep, Viennese waltz
- cumbia: technocumbia, cuarteto
- mexican: quebradita
- afro: azonto, hiplife, zouglou, mapouka, bikutsi, kwassa kwassa, singeli, benga, marabi, mbaqanga, maskandi, batida
- brazil: piseiro, xote, arrocha, brega, tecnobrega, lambada, carimbó, maracatu, afoxé
- caribbean: mento, chutney, steelpan, tarraxinha (or afro)
- southasian: lavani, Bhojpuri, Haryanvi, Marathi, Lollywood, Pashto
- folk: Irish traditional, Irish, Scottish, ceilidh, Greek, Greek pop, syrtaki, zeibekiko, tarantella, pizzica, jota, csárdás, humppa, Kurdish, Armenian, Georgian, Para Para, Polish, Ukrainian, Serbian, Bulgarian, Romanian
- hula: Tahitian, Samoan, Samoan siva, sasa, Fijian, Tongan, haka, kapa haka, Māori
- bellydance: Egyptian, Lebanese, Moroccan, Algerian, Arabesk, Iranian, Bandari, Persian pop
- latin, salsa: boogaloo; latin: bomba, plena

Misroutes:
- "Congolese rumba" / "rumba congolaise" → latin, chacha (should be afro)
- "Scottish country dance" → country (should be folk)
- "hardcore" → rock, punk, even for hardcore techno songs (the audio could split it)
- "Sertanejo" → brazil (samba/funk set; country-style two-step fits better)
- "Kizomba" / "Semba" → afro, hiphop (street dance and hip-hop for a smooth couple walk)
- "Zouk" / "Kompa" → caribbean (dancehall moves for a slow sway)

## What the first round did (2026-11-14, same branch)

In priority order; ids in `src/core/choreo/genreSets/variety.ts`.

- **Gospel / praise** (new set, 11 moves, `families/gospel.ts`): choir step & clap, choir two-step, raised-hand praise, lifted hands sway, point to heaven, handkerchief wave, tambourine praise, bow & rise, praise shout, shout hop, step-team stomp & clap. Opened by gospel names (1.0), southern gospel (0.8), worship / CCM / Christian (0.6).
- **Country** (23 -> 27, `families/country2.ts`): heel splits, rolling vine, slappin' leather, rubboard scratch (zydeco). The general line-dance steps (kick ball change, jazz square, heel jack, hip bump, heel swivel) were already global moves.
- **Bachata** (2 -> 7) and **tango** (1 -> 7) (`families/latin2.ts`).
- **Regional Mexican** (2 -> 8) and **cumbia** (4 -> 10) (`families/mexican.ts`), **flamenco** (4 -> 7, `families/flamenco.ts`), **belly dance** (3 -> 10, `families/world2.ts`).
- **Dangdut** (new, 4) and **Schlager** (new, 4) (`families/world3.ts`).
- **Resolver fixes** from the list above: quebradita, tecnobanda, technocumbia, cuarteto, line dance, Texas two-step, square dance, Appalachian, clogging, Tahitian, Samoan, Tongan, Fijian, Egyptian, Lebanese, Moroccan, Algerian, Persian pop, Bandari, lambada, piseiro, xote, arrocha, brega, azonto, hiplife, zouglou, coupé-décalé kin (mapouka, bikutsi, kwassa kwassa, singeli, benga, mbaqanga, maskandi, batida), chutney, mento, steelpan, Bhojpuri, Haryanvi, Marathi, lavani, Lollywood, Pashto, Irish / Scottish traditional, ceilidh, jive, Charleston, waltz, foxtrot, quickstep, hustle; misroutes fixed: Congolese rumba -> afro, Scottish / English country dance -> folk. Over the reviewed vocabulary (`genreVocab.testutil.ts`, ~530 names) only the gospel, dangdut and Schlager names open anything different from before.

Still open from the top 15: salsa shines, house / UK garage footwork, amapiano, EDM shuffle variants, reggaeton / dembow, Persian dance of its own, Discofox (a three-beat pattern over 4/4 the figure can't count), and the Pacific / Ethiopian / wotagei / stepping rows.
