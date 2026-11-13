# Request types routed by destination; async requests end at the Message Queue

For the Async chapter a wave is a mix of **Request Types** (in the video app: watching a video and processing an uploaded one), and each type knows which component it needs: a watch looks for a cache or database, a processing job looks for a Message Queue and then a Worker. A component connected to both sends each type down its own path instead of splitting traffic evenly over its connections. We chose this over a per-connection filter set by the player because it needs no new UI and keeps the puzzle about architecture, not configuration. The player still decides: an app server connected straight to a Worker makes the job synchronous and slow.

A job counts as answered (for p95, errors and money) when it enters the Message Queue, as an API that replies `202 Accepted`. The flow model (ADR-0005) gains its first state that lasts from one tick to the next: the **Backlog**, which grows when jobs arrive faster than the Workers serve them and is never dropped, not even when a Worker goes down (at-least-once delivery). The **Queue Age** (how long the oldest Message has waited, the metric real queues alert on) is judged against the level's maximum: over it, reputation falls as for a slow base. After the wave a **Drain Phase** runs until the Backlog is empty, with maintenance still charged, so few Workers are cheap per second but slow to finish. Measuring p95 to the end of the Worker's job was rejected because it would hide the whole point of a queue.

The async request is the processing job, not the video file. In real systems the client uploads the file to object storage and the API only queues a job that points at it; sending large files through the app server is a known anti-pattern. Object storage arrives in the Data scale chapter, so until then the Manual says where the file really goes.

## Consequences

- Chapter 1 levels have one implicit request type and no queue, so they keep working unchanged.
- Users cannot connect to a Message Queue directly; jobs reach it through an app server.
- The game does not simulate duplicate deliveries, but the Worker-failure level and the Manual explain that at-least-once means a job can run twice, so Workers must be idempotent.
- Pub/sub (one message to many destinations) is left for a later chapter; it needs a fan-out rule.
