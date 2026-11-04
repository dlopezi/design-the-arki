/** Min-heap of timed events. Ties are broken by insertion order so runs are deterministic. */
export class EventQueue<T> {
  private heap: { time: number; seq: number; value: T }[] = [];
  private seq = 0;

  push(time: number, value: T): void {
    const heap = this.heap;
    heap.push({ time, seq: this.seq++, value });
    let i = heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.before(i, parent)) break;
      [heap[i], heap[parent]] = [heap[parent]!, heap[i]!];
      i = parent;
    }
  }

  pop(): { time: number; value: T } | undefined {
    const heap = this.heap;
    const top = heap[0];
    const last = heap.pop();
    if (heap.length && last) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && this.before(l, m)) m = l;
        if (r < heap.length && this.before(r, m)) m = r;
        if (m === i) break;
        [heap[i], heap[m]] = [heap[m]!, heap[i]!];
        i = m;
      }
    }
    return top && { time: top.time, value: top.value };
  }

  private before(a: number, b: number): boolean {
    const x = this.heap[a]!, y = this.heap[b]!;
    return x.time < y.time || (x.time === y.time && x.seq < y.seq);
  }
}
