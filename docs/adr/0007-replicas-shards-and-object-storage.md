# Replicas and shards as buildings the traffic is routed through; the Shard Key is a locked setting

For the Data scale chapter the database stops being one building. A **Read Replica** is its own building: an app server sends reads to replicas and writes to the primary database, by **Request Type** (ADR-0006), with no filter for the player to set. A **Read-your-writes** request must reach the primary; if it reaches a replica it counts as an error, a stale read. **Replication Lag** is the second stateful value in the flow model (after the Backlog): it grows while writes are higher than a replica can apply, and a level may set a maximum, judged like the Queue Age. We chose to use it in the review mission only, so the first missions teach one idea each.

**Sharding** is two settings on the database, the number of **Shards** and the **Shard Key**, not a building to place. Each Shard is drawn as its own building with its own load, like every Instance. Each level declares how traffic spreads over the values of each key, so a poor key (all users in one country, all writes on today's date) overloads one **Hot Shard** while the others sit idle. The key is locked during the wave: in real life re-sharding means moving data and downtime, and a free switch would teach that it is cheap.

**Object Storage** is a building with a fixed price and no settings. An upload Request Type keeps an app server busy for a long time; users that connect straight to Object Storage (the pre-signed URL pattern) leave the app servers free. Failover (promoting a replica when the primary dies) is not simulated; it belongs to the multi-region chapter.

## Consequences

- Chapter 1 and 2 levels keep working unchanged: they have no replicas, one shard and no uploads.
- The flow model needs two things it does not have: a key distribution per level, and a second per-tick state (lag). The catalogue stays technology-agnostic (ADR-0004); a Read Replica is a station that accepts reads only.
- Users may connect to Object Storage (unlike the Message Queue); the connection rules must allow it for upload traffic only.
- Level tests prove each Reference Design wins and each starting design, left unchanged, loses (ADR-0005), including a Hot Shard design.
- Cross-shard transactions and consistent hashing are not modelled; the Manual mentions them.

## As built (levels 15 to 20)

- **Shards are instances of the database**, only in a level that offers Shard Keys (`play.shardKeys`). Each value of a key lives on shard `value mod shards`, so a key with few values or uneven weights makes a Hot Shard. A Shard that is down or still being built loses its slice. The Shard Key is locked after the build phase.
- **Replication Lag** is the pile of writes a Read Replica has not applied, divided by its apply rate. A Read Replica applies `applyShare` (a quarter) of one instance's capacity in writes per second, so a bigger size applies faster and more instances do not help. The pile stays as it was while the replica is not serving.
- **Read-your-writes** and plain reads need no filter: only the primary database accepts Read-your-writes, and a Read Replica gets the reads before the primary does (`prefers`).
- **Upload** is a Request Type with an `effort` of 10 on an app server. Object Storage takes uploads only and may be a second, direct entrance for the users, but only in a level that has uploads. Connecting the users to it is the player's move; the default wiring sends files through the app servers.
- **Not done**: the Concepts tab is not locked by progress (as in chapters 1 and 2), and a Read Replica applying writes does not reduce its read capacity.
