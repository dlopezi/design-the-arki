# Topics with Subscriptions; the Worker is the consumer group; fan-out comes from the architecture

For the Events chapter the game adds one building, the **Topic**, modelled on Apache Kafka. A Topic keeps a Backlog for each **Subscription**, so every subscribing system gets its own copy of each Message (pub/sub), while a Message Queue (ADR-0006) still gives each Message to one Worker. We did not add a separate consumer group building: the existing **Worker** gets a setting, *Subscription*, chosen from the level's list, and each Worker building connected to a Topic is one consumer group. Its instances share the Messages as they already do on a queue, but only as many instances as the Topic has **Partitions** can work at once; the rest wait. This is the real Kafka rule and it needs no new building, so the lesson stays on the idea, not on new pieces.

Each Subscription has its own **Consumer Lag** (in seconds: how long its oldest unprocessed Message has waited) and its own maximum in the level, judged like the Queue Age. We use the Kafka name because it is the word used in interviews; Kafka often counts it in Messages, which the Manual explains. A Subscription with a loose maximum (analytics) can fall behind without slowing one with a tight maximum (notifications), which is the main reason teams use pub/sub.

The **Partition Key** spreads Messages over Partitions with the same skew rule as the Shard Key (ADR-0007), so a poor key makes a **Hot Partition**. We do not simulate ordering: in real systems the key exists mostly to keep one user's events in order, but out-of-order errors would be hard to show on the map; the Manual explains it. Partitions and the key change only in the Build Phase.

The news feed uses the same pieces. A **Feed** Subscription Worker writes each post once per follower into the Database (*fan-out on write*); with no Feed Worker, each `read feed` reads the posts of every followed account (*fan-out on read*). The player picks the strategy by building it or not, not with a switch. A **Celebrity Limit** on the Feed Worker skips fan-out for accounts above the limit and merges their posts at read time (the hybrid model Twitter uses).

## Consequences

- Levels of chapters 1 to 4 keep working unchanged: they have no Topic, and a Worker without a Subscription behaves as today.
- `post` is answered when it enters the Topic (as a job entering the Message Queue). Users reach a Topic only through an app server. A Topic cannot send to a Message Queue (the SNS + SQS pattern is in the Manual only), so there is one way to fan out.
- Work released by a Topic is not the users' any more: it does not count in p95, errors or money. Only the Feed Worker writes to the Database; the other Subscriptions end at their Worker, because their real destinations (push service, search index, data warehouse) are outside the system.
- The flow model gains one Backlog and one Consumer Lag per Subscription, kept between steps like the Backlog of ADR-0006. A level that allows a Topic must set a maximum Consumer Lag for each Subscription, so the Drain Phase ends; it runs until every Subscription is empty.
- When a Worker instance goes down, the other instances of its group take its Partitions after a short pause (a rebalance). No Message is lost.
- The glossary test that forbids "partition key" in code (it guarded the Shard Key) must allow the new Partition Key.
- Retention and replay, exactly-once, dead-letter topics, retries and adding Partitions during the wave are not modelled; the Manual mentions them.
