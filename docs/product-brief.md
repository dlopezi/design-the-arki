# Product brief

Decisions settled in the initial design grilling session (2026-11-04).

## What it is

- **Concept**: level-based puzzles where the player designs a software architecture that must meet a level's requirements under simulated traffic.
- **Audience**: developers preparing for system-design interviews.
- **Goal**: a publishable product, not just a learning exercise.
- **Platform**: web browser, single player, no backend.
- **Language**: English at launch; all player-facing strings externalised for i18n (Spanish later).
- **Monetisation**: free at launch; decide later. Build no payment or account features yet.
- **License**: closed source for now.

## Gameplay

Real-time strategy play, chosen 2026-11-11 after a playable prototype (`prototypes/rts-loop.prototype.html`; ADR-0005):

- **Build phase** (30 s): the player builds components with money; each one takes seconds to build and connects itself the usual way (load balancer in front of the app servers, cache in front of the database). The player can change any connection by dragging from one building to another, or select a line and press Delete. "Bring them now!" starts the wave early and pays a bonus.
- **One wave per level**: users arrive from the Internet at a fixed rate for a set time; each level teaches one idea, so one wave is enough. The player keeps building during the wave.
- **Money** grows by itself (+$2/s) and with each answered visit ($1 per 100), and each building costs maintenance (its monthly cost ÷ 100 per second). **Reputation** falls while errors (−6/s) or latency (−4/s) break the level's requirements, and rises slowly otherwise; at 0 the base is lost.
- **Scoring**: lasting the wave passes the level; the money left decides the extra stars.
- **Feedback on failure**: the end dialog names the component that dropped the most requests with a short **Hint** (not in God mode); during play, a red badge marks each building that loses requests.
- **Progression**: linear **Chapters** by topic; each level unlocks the next and each chapter introduces new components.

## Chapter roadmap (planned 2026-11-13)

A learning order: each chapter builds on the ones before it, so no concept appears before its base. Not final; each chapter gets its own grilling session.

| # | Chapter | What the player learns | Why here |
|---|---|---|---|
| 1 | Core (done) | Capacity, load balancer, cache, database | The base of everything |
| 2 | Async | Message Queue, Worker, Backlog, Queue Age, idempotency | Slow work, the first interview topic after scaling |
| 3 | Data scale | Read replicas and replication lag, sharding and hot shards, object storage | The database is the next limit; object storage finishes the video story |
| 4 | Edge | CDN, API gateway, rate limiter, DNS and multi-region failover | A CDN is a cache in front of object storage (1 + 3); multi-region needs replicas (3) |
| 5 | Events and pub/sub | Fan-out, topics, partitions, consumer groups, news feed (fan-out on write or on read) | Builds on the queue (2); partitions are sharding (3) |
| 6 | Resilience | Timeouts, retries with backoff and retry storms, circuit breaker, graceful degradation | Needs a base with many parts that can fail (2–5) |
| 7 | Observability | Metrics, logs, tracing, SLOs, error budgets, alerts; as a mechanic, the map is in fog until the player builds monitoring | Watching a system only makes sense once it is big |
| 8 | Consistency and payments | Transactions, double booking, Saga, outbox, idempotency keys | The hardest topic; uses replication lag (3), events (5) and idempotency (2) |
| 9 | Interview classics | URL shortener, chat, news feed, ticket sale, rate limiter | The final exam: everything together, as in a real interview |

Rules for every chapter:
- One new concept per mission.
- The last mission of each chapter also uses buildings from earlier chapters, as a review.
- Stories continue: the video app grows in chapters 2–4, a social network in 5–6, a ticket app in 7–8.

## Chapter 2: Async (planned 2026-11-13)

Settled in a grilling session; engine rules in ADR-0006. Rule for every choice: the game shows a real problem with the real solution and the real names, so players can use them in an interview.

- **Story**: a new product, a video app. Watching a video is synchronous (cache or database); processing an uploaded video is an async job. The file itself goes to object storage, which the Manual explains and the Data scale chapter adds.
- **New buildings**: **Message Queue** (no settings, fixed price, like a managed queue) and **Worker** (instances and sizes; several Workers share one queue without a load balancer: competing consumers). Workers write the result to the database, so the queue protects it from spikes (load leveling). Users reach the queue only through an app server. Pub/sub waits for a later chapter.
- **Rules**: a job is answered when it enters the queue (like `202 Accepted`). The **Backlog** is kept, also when a Worker goes down (at-least-once delivery). Reputation falls while the **Queue Age** is over the level's maximum. After the wave a **Drain Phase** runs until the Backlog is empty, with maintenance still charged.
- **Names**: the per-instance "workers" become **Concurrency** and "Queue size" becomes **Waiting line**, so the new Worker and Message Queue are not confused with them.
- **Unlock**: after the last level of chapter 1.
- **Six levels**, each with one lesson:
  1. *Slow processing*: processing a video in the request makes p95 huge; a queue and a Worker answer at once.
  2. *Watch and upload*: mixed traffic; only the slow work goes async, watches stay synchronous.
  3. *Upload rush*: a burst of uploads; the queue absorbs the spike and protects the database. The brief also shows the limit: a queue absorbs peaks, not a load that stays above Worker capacity, where the Backlog grows without end.
  4. *A Worker goes down*: the job goes back to the queue and nothing is lost; the hint explains at-least-once and why Workers must be idempotent (a job may run twice).
  5. *Fresh videos*: a tight maximum Queue Age; more Workers against cost (the Manual mentions autoscaling Workers on queue age).
  6. *Launch day*: everything together, with a burst and a Worker outage. As the chapter's review, it also needs chapter 1 buildings: a load balancer in front of several app servers and a cache for watches.
- **Manual**: Buildings entries for Message Queue and Worker with *In real life* (Amazon SQS, RabbitMQ, Kafka, Celery or Sidekiq workers); Concepts for async processing, backlog, queue age and consumer lag, at-least-once and idempotency, load leveling, dead-letter queue (explained, not simulated).
- **Backlog and Queue Age look (decided 2026-11-13, without a prototype session)**: the owner asked for chapter 2 to be finished without human intervention, so the choice was made by real practice: queue dashboards graph the age of the oldest message against an alert line. Options weighed: a count on the queue, a bar that turns red near the maximum, Messages piling up on the map, a Backlog chart. Chosen: the bar and the chart together, because they answer "are my Workers keeping up?" at a glance (map) and over time (console).
  ```
  top bar:   $287 +0.5/s   ⏱ Drain · 47 left  [⏸ 1× 2× 4×]   ⏳ 12 s / max 30 s   ❤ 100%
  map:       [Message queue]  Backlog: 47      gauge ▓▓▓░░░░░░  (fills to the maximum Queue Age; amber at 70%, red at 90%)
  console:   Queue Age  ~~~~~ line with a red dashed limit ~~~~~  12 s   (replaces the RPS chart in levels with a queue)
             P95 / Errors as before; "Backlog: 47 Messages" under the money rows; the inspector of the queue shows both numbers
  ```
  If the owner prefers another look (for example Messages piling up on the map), change `PlayScreen.tsx` only: the game keeps `backlog`, `queueAge` and their per-second history.
- **Status (2026-11-13)**: the six missions (`09`–`14`), the Message Queue and Worker, the Drain Phase and the Manual entries are built, in English and Spanish.

## Chapter 3: Data scale (planned 2026-11-13, built as levels 15 to 20)

Settled in a grilling session; engine rules in ADR-0007. Same rule as chapter 2: a real problem with the real solution and the real names, so players can use them in an interview. Built after chapter 2 was merged (it uses Request Types and the stateful rules from ADR-0006). What was built, and where it differs from the plan, is in ADR-0007.

- **Story**: the video app is a hit. Many people watch (reads), the data grows (writes and size), and uploads are big files. This also closes the open point of ADR-0006: the file goes to object storage and only the job goes to the queue.
- **New buildings**: **Read Replica** (own building, connected to the database; answers reads only) and **Object Storage** (fixed price, no settings, like the Message Queue). **Sharding** is not a building: the database gets two settings, number of **Shards** and the **Shard Key**; each Shard is drawn as its own building with its own load.
- **Rules**:
  - Reads and writes are separate Request Types. An app server sends reads to Read Replicas and writes to the primary database.
  - **Read-your-writes** is a Request Type that must go to the primary database; if it reaches a Read Replica it counts as an error (a stale read).
  - **Replication Lag** is a number that grows when writes are high; a level may set a maximum, and reputation falls while it is over (same idea as Queue Age). Used in the review mission only.
  - Each level says how traffic spreads over Shard Key values (for example user id: even; country: one country has most users; date: all writes hit the newest shard). A poor key makes a **Hot Shard**.
  - The Shard Key can be changed only in the Build Phase; during the wave it is locked (re-sharding needs downtime in real life).
  - An **upload** Request Type keeps an app server busy for a long time. If users connect straight to Object Storage (the pre-signed URL pattern) the app servers stay free.
- **Unlock**: after the last level of chapter 2.
- **Six levels**, each with one lesson:
  1. *Too many reads*: the cache cannot help (data must be fresh), the primary database is full of reads; Read Replicas scale reads, not writes.
  2. *Just saved, not there*: replicas are behind, so a user may not see their own change; read-your-writes goes to the primary.
  3. *Too much to write*: one database cannot take the writes or the data; add Shards and choose the Shard Key.
  4. *Hot shard*: a skewed key sends most traffic to one Shard; pick a better key in the Build Phase.
  5. *Big uploads*: files through the app server block it; connect users to Object Storage.
  6. *Release day*: the review. Everything together, plus a maximum Replication Lag, and chapter 1 and 2 buildings (load balancer, cache, queue and Workers; the processing job points to the stored file).
- **Manual**: Buildings entries for Read Replica and Object Storage with *In real life* (PostgreSQL or MySQL read replicas, Amazon RDS, Amazon S3, Google Cloud Storage); Concepts for replication lag, read-your-writes, sharding, shard key, hot shard, pre-signed URL, and failover (explained, not simulated).
- **Look (decided with a prototype, `prototypes/shard-lag-look.prototype.html`, 2026-11-13)**: three variants were compared: bars under each building (A), heat tiles with a ghost copy for the lag (B), and a console with per-Shard bars and a lag chart (C). Chosen: **A on the map plus the lag chart of C in the console**, the same grammar as the Queue Age (a gauge on the building, a chart in the console). Each Shard has its own load bar, the Hot Shard gets a "Hot Shard" mark on the map and a row in the inspector, and the Replication Lag shows next to its maximum in the top bar, the Read Replica inspector and a chart with the maximum as a red line. B was left out: it replaces the building art and the idea of an instance, which is too big a change for one value.
- **Out of scope**: failover and promotion of a replica (taught in chapter 4), resharding during the wave, consistent hashing, cross-shard transactions (chapter 8), CDN (chapter 4), object storage settings and cost per GB.

## Chapter 4: Edge (planned 2026-11-13)

Settled in a grilling session; engine rules in ADR-0008. Same rule as chapters 2 and 3: a real problem with the real solution and the real names. Built after chapters 2 and 3 are merged (it uses Request Types, Read Replicas and the stateful rules of ADR-0006 and ADR-0007).

- **Story**: the video app goes global. A viral video, a client that abuses the API, and a whole Region that fails. It closes the video story (chapters 2–4); chapter 5 starts a social network.
- **New buildings**: **CDN**, **API Gateway** (with the setting **Client Limit**), **DNS** (with the setting TTL). A second **Region** is a copy of the base (a standby, always on and paid for, with a Read Replica) that the player builds like any other building group.
- **Rules**:
  - A new Request Type, *download a video file*, goes to the CDN, which answers a share of requests at the edge (hit share grows with TTL, like the cache) and sends the rest to Object Storage. Users connect straight to the CDN. Object Storage now has a fixed output capacity (not shown to the player) that a viral video exceeds; chapter 2 and 3 levels stay under it.
  - The API Gateway is the entry for API requests. A new Request Type, *invalid* (no token, or junk), is rejected at the gateway at low cost, so app servers see only valid requests.
  - A level can have an *abusive* Request Type: a few clients that send many requests. The Client Limit rejects what one client sends above the limit. A limit that is too low also rejects normal clients, which counts as an error (a false positive).
  - A new Failure Event, *Region down*, takes down every building of the main Region at a set time. The DNS detects it and sends users to the standby Region after a delay set by its TTL (5 s, 10 s or 30 s in the game's fast clock: reputation falls 6 % a second while requests fail, so a real 30 to 300 s wait could never be survived); until then requests to the dead Region fail. At that moment the standby Region's Read Replica becomes the primary database. A short TTL switches faster and costs a little more.
  - Only a warm standby is modelled. Cold standby and the loss of the last writes at failover (RPO) are in the Manual only.
- **Unlock**: after the last level of chapter 3.
- **Six levels**, each with one lesson:
  1. *Far away videos*: a viral video overloads Object Storage; a CDN in front protects it.
  2. *Old content*: a video was edited; the CDN TTL trades speed against freshness (purging is in the Manual).
  3. *One door*: invalid requests flood the app servers; the API Gateway rejects them first.
  4. *Abusive client*: a few clients send most requests; set the Client Limit to stop them and let normal clients pass.
  5. *The Region falls*: build a standby Region and a DNS; choose the TTL; the Read Replica is promoted.
  6. *Worldwide launch*: the review, one wave with three problems in order (viral video, abusive client, main Region down near the end). It also needs chapter 1–3 buildings (load balancer, several app servers, cache, Read Replica) and the upload route through Object Storage, queue and Workers.
- **Manual**: Buildings entries for CDN, API Gateway and DNS with *In real life* (Cloudflare, Amazon CloudFront, Kong, AWS API Gateway, Nginx, Amazon Route 53); Concepts for CDN and cache purge, TTL, token bucket and rate limiting, authentication at the gateway, active-passive and active-active, warm and cold standby, RPO and RTO.
- **Look (decided 2026-11-14, without a human session)**: the owner asked for chapter 4 to be built without human intervention, so the choice was made by real practice, as for chapter 2 and chapter 3, with a prototype (`prototypes/region-look.prototype.html`, ticket #78). Cloud diagrams draw Regions as boxes side by side with the DNS in front, a dimmed standby, and a line that moves when a Failover happens. Three variants were compared: **A** two plots side by side with the DNS between the users and both, **B** one Region at a time with tabs, **C** the standby only in a console table. Chosen: **A**. It shows the failure and where the traffic goes at once, in the same map grammar as the C4 zones; B hides the standby, so a player who watches the main Region never sees the traffic move; C breaks the idea that the map is the system.
  ```
  top bar:  $287 +0.5/s   🧭 Failover in 42 s  [⏸ 1× 2× 4×]   ❤ 72%        (the DNS gauge shows only in a level with a DNS)
  map:      🌍 Users ── 🧭 DNS (TTL 60 s, ring: countdown, then ✔) ──┬── Region 1 · main    LIVE / DOWN (grey, smoke, red line)
                                                                  └── Region 2 · standby  STANDBY (dim, dashed) → LIVE · promoted
  build:    the build card has a Region switch (Main | Standby); a new building goes into the Region shown selected
  ```
  The DNS ring counts down the TTL after the Region fails; the line to the main Region turns red and the line to the standby turns green at the switch; the standby Read Replica is renamed "Primary (was replica)". The Region ticket (#79) builds this; nothing else in the game screen changes. As built, the two Regions are stacked one above the other (not side by side) because each Region is already wide, and the DNS stands between the Internet and them.
- **Status (2026-11-14)**: the six missions (levels `21` to `26`), the CDN, API Gateway (with its Client Limit), DNS and standby Region, the freshness limit, the Manual entries and concepts are built, in English and Spanish. What was built, and where it differs from the plan (DNS TTLs of 5, 10 and 30 s, the review without a queue and Workers, the buildings that stand outside the Regions), is in ADR-0008.
- **Out of scope**: geography and latency by distance, active-active Regions, loss of writes at failover, cold standby, WAF and DDoS protection, edge computing, routing by path to several services, cache purge.

## Chapter 5: Events and pub/sub (planned 2026-11-14)

Settled in a grilling session with the owner; engine rules in ADR-0009. Same rule as chapters 2 to 4: a real problem with the real solution and the real names. The owner asked that every choice be based on how real systems work; the review problems, where the results of subscribers go, the Topic-to-queue question and the Drain Phase were left to Claude on that rule. Built after chapter 4 is merged (it uses Request Types, the Backlog, Shard Key skew and the Worker outage).

- **Story**: a new product, a social network. People post and read their feed. One post must reach many systems (notifications, search, analytics, feeds), and one famous account can have millions of followers. Chapters 5 and 6 follow this story.
- **Request Types**: `post` (a user publishes; it goes through an app server to the Topic and is answered when it enters it, like a job entering the Message Queue) and `read feed` (synchronous, like a watch in chapter 2).
- **New building**: only the **Topic** (the Kafka model). Fixed base price plus a small cost per **Partition**. Settings: **Partitions** and **Partition Key**, both changed only in the Build Phase (in Kafka, adding Partitions moves keys; the key is chosen like the Shard Key). Users reach the Topic only through an app server.
- **Worker as consumer group**: the existing Worker gets a setting, **Subscription**, chosen from the level's list (for example Notifications, Search, Analytics, Feed). Each Worker building connected to the Topic is one consumer group: it gets **every** Message (pub/sub), and its instances share them (competing consumers, as in chapter 2). Only `min(instances, Partitions)` instances work; the others wait.
- **Rules**:
  - The Topic keeps a **Backlog for each Subscription**. Each Subscription has its own **Consumer Lag** (seconds the oldest unprocessed Message has waited) and the level sets a maximum for each one (for example Notifications 5 s, Analytics 60 s). Reputation falls while any Subscription is over its maximum. A slow Subscription does not slow the others.
  - Notifications, Search and Analytics Workers end their work at the Worker: their real destination is outside the system (a push service, a search index, a data warehouse), which the map shows as an exit label. Only the **Feed** Worker writes to the Database.
  - **Fan-out on write**: with a Feed Worker, each post becomes one write per follower in the Database (the level sets the average followers); reading the feed is one read (the usual Cache can sit in front). **Fan-out on read**: with no Feed Worker, each `read feed` reads the posts of every followed account (the level sets how many). The architecture decides; there is no strategy switch.
  - **Celebrity Limit** (a setting of the Feed Worker, used from mission 6): posts of accounts with more followers than the limit are not fanned out; their posts are merged when a feed is read (a few extra reads). This is the hybrid model Twitter uses.
  - A poor Partition Key makes a **Hot Partition**: the level says how traffic spreads over each key value, as for the Shard Key in chapter 3.
  - When a Worker instance goes down, the other instances of its consumer group take its Partitions (a **rebalance**), with a short pause for that group.
  - After the wave the Drain Phase runs until **every** Subscription is empty, with maintenance charged.
- **Unlock**: after the last level of chapter 4.
- **Six levels** (`27` to `32`), each with one lesson:
  1. *One post, many reactions*: a post must reach notifications, search and analytics. A Message Queue gives each Message to one Worker only; a Topic gives every Subscription its own copy.
  2. *A slow subscriber*: analytics is slow and has a loose maximum, notifications must be fast. Each Subscription has its own lag and its own Workers; the slow one does not hold the others.
  3. *Too much for one Worker*: the posts outgrow one consumer. Add Partitions and Worker instances; instances beyond the number of Partitions do nothing.
  4. *Hot partition*: a poor Partition Key sends most posts to one Partition; pick a better key in the Build Phase.
  5. *Your feed*: reading feeds by gathering every followed account (fan-out on read) overloads the Database; a Feed Worker that writes each post into every follower's feed (fan-out on write) makes reads cheap.
  6. *The celebrity joins*: the review. A celebrity with millions of followers posts in the middle of the wave and fan-out on write explodes; set the Celebrity Limit (hybrid). Later a Worker instance goes down and its group rebalances. It also needs chapter 1 to 4 buildings: load balancer, several app servers, Cache and API Gateway.
- **Manual**: a Buildings entry for the Topic with *In real life* (Apache Kafka, Amazon Kinesis, Google Pub/Sub, Amazon SNS, Redpanda); Concepts for pub/sub against a queue, consumer groups, Partitions and ordering by key, consumer lag, rebalance, fan-out on write and on read, the celebrity problem and the hybrid feed, retention and replay, at-least-once and exactly-once, the SNS + SQS fan-out pattern.
- **Look**: decided by real practice with a prototype (ticket of the spec), as for chapters 2 to 4: a text sketch first, then the choice written here.
- **Out of scope** (Manual only): ordering of events inside a Partition (the Partition Key only spreads load), retention and replay, exactly-once, dead-letter topics and retries (chapter 6), connecting a Topic to a Message Queue (SNS + SQS), adding Partitions during the wave.

## Game screen

Computer and tablet only (the phone layout was dropped on 2026-11-11). Chosen from the prototype:

- **Resource bar** on top: back to the levels, level name, money (with its rate per second), the phase timer with pause and speed (1×, 2×, 4×), reputation, and **☰ Menu** (pauses the game: Resume, Mission, Manual, Send feedback, Restart level, Change mode, Level map; Esc opens it too). Chosen 2026-11-12 from map-control prototype C (branch `prototype/map-controls`).
- **Map** in the middle: the Internet globe on the left and your base on the right, drawn in **C4 layers** (1 Context, 2 Containers, 3 Components; layer 3 by default), switched in the **C4 view** panel at the bottom-left, with the layer names always shown. It starts as an empty construction zone; zones appear with their first building. Drag the ground to pan, use the wheel to zoom. Icon tools at the bottom-right: 🔗 auto-connect, ⟲ reconnect all, ? (controls help and the latest events), then +, − and ⌖ center. Big announcements show once and fade, like a fighting game: "Build!", a 3-2-1 count, "🚀 Live!" when the wave starts, and "⚡ A server is down!".
- **Connections** are thin curved lines from a building's right side to the next one's left side, bending around other buildings; their colour shows health (teal fine, yellow busy, red losing requests, grey not used) and the req/s appear on hover or selection. **Requests** travel along them and come back (round trip): green when answered, red with "503" from the building that failed.
- A selected building lights its own base in neon, in its type's colour. Buildings warn "no way in" or "no way out" when a connection is missing.
- **Console** at the bottom: live results (req/s, p95, errors, income and maintenance), the inspector (state, instances, where it sends requests, load, capacity, size or tier, cache TTL, add or remove instances), and the build card: the building cards and, at the bottom, "🚀 Release to production", which starts the wave early for a bonus.
- The **mission** (mode, guided hint, brief, wave, incident, objectives) opens as a briefing card at the start and from ☰ Menu → Mission; there is no mission panel on the map since 2026-11-12.

## Home screen (level map)

A **campaign map**, chosen 2026-11-09 from three HTML mockups (campaign map, tech tree, mission board; `prototypes/level-map.prototype.html`), replacing the winding road of round buttons:

- Each chapter is a **sector** of terrain with its missions joined by a route; passed parts of the route are green. A mission that brings a new building shows that building as its marker; the ring colour shows the hardest mode passed (Guided blue, Normal gold, Hard orange, God purple) and the next mission glows with a "Play!" bubble.
- Clicking a mission selects it and opens its **briefing** on the right: state, brief, objectives (with a link to what p95 means), how to earn stars, the badge, the new building, the buildings in the mission, and one **Play mission** button. Clicking the selected mission again, its "Play!" bubble or Enter also plays it; arrow keys move between missions. Locked missions show their briefing without the button. A mission opened since the last visit pops in with a "New mission open!" bubble and its route draws itself.
- **One mode for every mission** (changed 2026-11-11, replacing four mode buttons per mission): the player picks the difficulty once on the difficulty screen (`#mode`), the first time they play after the tutorial; it is changed from the top bar, Options or the game's mission panel. Before the tutorial is done every mission opens in Guided.
- The top bar has "← Home", the current mode, the Field Manual, the stars collected, Send feedback and ⚙ Options. "Your base" was removed on 2026-11-11. On a phone the map becomes a list, with the briefing below it.

## Title screen

The landing page at the site root (`#`) looks like a game's title screen (chosen 2026-11-07, replacing the scrolling landing page): a player bar (stars collected, current chapter with levels passed), a big glowing logo with the tagline (the one-line pitch was removed on 2026-11-11), a **main menu** in two columns (Play level 1 / Continue: level N, Level map, Manual, Options, Feedback; the Training demo was removed on 2026-11-09), over a moving backdrop (a small network with travelling requests and a grid floor; still when the player prefers reduced motion). The menu works like a game menu: ↑ / ↓ move the selection and Enter starts it ("Press Enter to start", shown only with a keyboard and mouse). On a computer everything fits without scrolling.

## Look and feel

Strategy-game (RTS) look, chosen 2026-11-09 and replacing the System Defense look chosen the same day: the player builds and runs a base. Original art and names, inspired by the genre, not by any one game.

- **Palette**: dark steel panels with a bevel and cut corners, a teal accent, green for selection and good, red / yellow for bad / warning, gold for money. Monospace, uppercase labels for titles and numbers; system sans-serif for body text. Tokens live in `:root` in `src/ui/styles.css`.
- **Components are buildings**: each type is a small isometric building in its colour, on a pad (`src/ui/componentArt.tsx`), always called by its real name (load balancer, app server, cache, database). A failed instance is grey with smoke. Every new component type needs a colour and a building.
- **The game screen** is described under *Game screen*: a resource bar, the map of the base in C4 layers on a grid floor (the system boundary is the base wall, zones are plots of land, load bars are segmented like health bars), and the console.

## Field Manual, briefing and options

Set up like the Guide and How to play screens of System Defense ("Defend the Arki"), 2026-11-11:

- The **Field Manual** (`#manual`, `#manual/<tab>`; the old `#archive` opens its Buildings tab) has three tabs. **How to play**: the goal, four steps (Build, Connect, Bring the users, Read the results) each with a small looping picture, the modes, the star rule and the keys. **Buildings**: each component as a building, with what it does, when to build it, its cost, the level that first uses it, and *In real life* (real tools, how the game is like it and not like it, a link to read more). Buildings of levels the player cannot reach yet are locked. **Concepts**: p95, throughput, error rate, bottleneck, scaling, redundancy, cache hit rate and TTL, cost, C4.
- It opens from the title screen, the campaign top bar, and over the game (📖 Manual), where it stops the clock.
- A new player's "Play level 1" opens the Buildings tab as a **briefing** (`#briefing`) with "Start level 1".
- **Mission briefing in the game**: every mission opens with a card (story, objectives, new buildings, star rule) and the build clock waits until **Start building**. 📋 Mission opens it again and stops the clock.
- **Options** (`#options`): language, sound on/off (short menu sounds made with Web Audio), difficulty, and Reset progress (moved here from the campaign top bar).

## Release

- **Early access** with the 8 levels of chapter 1 (Core), then grow to 20+ in updates; chapter 2 (Async) is the first update.
- **Modes**: the player picks Guided, Normal, Hard (fix a broken design) or God (empty canvas) once for every mission; stars depend only on cost, and a badge shows the hardest mode passed.
- Static hosting on Firebase Hosting (Google Cloud), set up like System Defense ("Defend the Arki"): CI deploys every push to `main` after the tests pass (`docs/deployment.md`). Own domain later.
- Privacy-first, cookieless analytics (Plausible or Umami: levels started/completed, drop-off) plus a feedback form link.

## Engineering

- TypeScript + React; the design editor uses React Flow (SVG).
- Simulation engine is pure TypeScript, deterministic, independent of the UI (ADR-0001).
- Levels are JSON data validated by a schema (ADR-0002).
- Progress is stored in `localStorage`; no backend (ADR-0003).
- Testing: TDD on the engine; every level has a test proving a **Reference Design** passes it; a few E2E tests for the UI.
