# Regions, DNS failover and per-client limits, without geography

For the Edge chapter the game adds a **Region**: a complete copy of the base. The player builds a warm standby Region (always on, with maintenance charged, holding a Read Replica from ADR-0007) and a **DNS** building that sends users to it when the main Region fails. A new Failure Event, *Region down*, takes down every building of the main Region at a set time; the DNS switches users after a delay set by its TTL, and until then requests to the dead Region fail. At the switch the standby Read Replica becomes the primary database. We chose active-passive over two active Regions because active-active needs a map with geography and data in two places, which is much more work and teaches a second idea; it can come in a later chapter. Loss of the last writes at failover (RPO) and cold standby are left to the Manual so each mission keeps one lesson.

The **CDN** reuses the shortcut primitive of the cache (ADR-0004): a hit share that grows with TTL is answered at the edge, the rest goes to the origin. There is no distance in the game, so the CDN only matters if the origin has a limit: **Object Storage** gets a fixed output capacity, hidden from players, that a viral *download a video file* Request Type exceeds. Levels of chapters 2 and 3 stay under it.

The **API Gateway** is the entry for API requests. An *invalid* Request Type (no token, junk) is rejected there at low cost, so app servers never see it. A **Client Limit** setting rejects what one client sends above the limit; a level declares an *abusive* Request Type, a few clients that send most of the requests. A limit set too low also rejects normal clients, which counts as an error (a false positive), so the player must pick a number, not just the lowest one. We kept the limit inside the gateway, as Kong or AWS API Gateway do, instead of a separate rate limiter building.

## Consequences

- Levels of chapters 1 to 3 keep working unchanged: they have one Region, no CDN and no gateway.
- The flow model gains the idea of a client (a count of clients per Request Type, so a limit per client can be applied) and of a Region (a group of buildings that can fail together). The catalogue stays technology-agnostic: the CDN is a station with a shortcut, the gateway a station with a rejection rule.
- Failover is a state that lasts over time (waiting for the TTL, then switched), judged by the same real-time loop as ADR-0005.
- Users may connect to the CDN and the API Gateway; the connection rules must send each Request Type to its own entry.
- Level tests prove each Reference Design wins and each starting design, left unchanged, loses (ADR-0005), including a design with a TTL too long for the outage.
- Geography, active-active Regions, cache purge and WAF are not modelled; the Manual mentions them.
