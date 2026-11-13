import { describe, expect, it } from 'vitest';
import { catalog } from '../catalog/catalog';
import { en } from './en';
import { es } from './es';

describe.each([['English', en], ['Spanish', es]] as const)('%s Manual', (_name, strings) => {
  it('has a Buildings entry for every building, with what it is in real life', () => {
    for (const type of Object.keys(catalog)) {
      const entry = strings.archive.buildings[type];
      expect(entry, `no entry for ${type}`).toBeDefined();
      expect(entry!.tools.length, type).toBeGreaterThan(0);
      expect(entry!.read.url, type).toMatch(/^https:\/\//);
    }
  });

  it('names the real tools of the Message Queue and the Worker, and says the video file goes to object storage', () => {
    expect(strings.archive.buildings.messageQueue!.tools.join(' ')).toMatch(/SQS/);
    expect(strings.archive.buildings.messageQueue!.tools.join(' ')).toMatch(/RabbitMQ/);
    expect(strings.archive.buildings.messageQueue!.tools.join(' ')).toMatch(/Kafka/);
    expect(strings.archive.buildings.worker!.tools.join(' ')).toMatch(/Celery/);
    expect(strings.archive.buildings.worker!.tools.join(' ')).toMatch(/Sidekiq/);
    expect(strings.archive.buildings.messageQueue!.diff).toMatch(/object storage|almacenamiento de objetos/);
  });

  it('explains the concepts of chapter 2', () => {
    const ids = strings.manual.concepts.map(c => c.id);
    for (const id of ['async', 'backlog', 'queueAge', 'loadLeveling', 'competing', 'atLeastOnce', 'deadLetter', 'autoscaling']) expect(ids).toContain(id);
    expect(strings.manual.concepts.every(c => c.title && c.text && c.game)).toBe(true);
  });

  it('explains the concepts of chapter 3', () => {
    const ids = strings.manual.concepts.map(c => c.id);
    for (const id of ['replicationLag', 'readYourWrites', 'sharding', 'shardKey', 'hotShard', 'presignedUrl', 'failover']) expect(ids).toContain(id);
  });

  it('names the real tools of the Read Replica and Object Storage', () => {
    const replica = strings.archive.buildings.readReplica!.tools.join(' '), storage = strings.archive.buildings.objectStorage!.tools.join(' ');
    expect(replica).toMatch(/PostgreSQL/);
    expect(replica).toMatch(/RDS/);
    expect(storage).toMatch(/S3/);
    expect(storage).toMatch(/Google Cloud Storage/);
  });
});

describe.each([['English', en, /consistent hashing/, /cross-shard/, /not simulated/], ['Spanish', es, /hashing consistente/, /entre shards/, /no se simula/]] as const)(
  '%s Manual: what the game does not simulate',
  (_name, strings, hashing, crossShard, notSimulated) => {
    const concept = (id: string) => strings.manual.concepts.find(c => c.id === id)!;

    it('says sharding in real life also has consistent hashing and cross-shard transactions', () => {
      expect(concept('sharding').text).toMatch(hashing);
      expect(concept('sharding').text).toMatch(crossShard);
    });

    it('says failover is explained, not simulated', () => {
      expect(`${concept('failover').text} ${concept('failover').game}`).toMatch(notSimulated);
    });
  },
);

it('has the same concepts, in the same order, in English and Spanish', () => {
  expect(es.manual.concepts.map(c => c.id)).toEqual(en.manual.concepts.map(c => c.id));
});
