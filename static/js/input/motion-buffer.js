export class MotionBuffer {
    constructor(maxAgeMs = 900) {
        this.maxAgeMs = maxAgeMs;
        this.events = [];
    }

    push(key) {
        const now = performance.now();
        this.events.push({ key, time: now });
        this.events = this.events.filter(event => now - event.time <= this.maxAgeMs);
    }

    consume(sequence, maxAgeMs = 500, strict = false) {
        const now = performance.now();
        let cursor = this.events.length - 1;
        let latestMatchedIndex = -1;

        for (let index = sequence.length - 1; index >= 0; index--) {
            let matched = false;
            for (; cursor >= 0; cursor--) {
                const event = this.events[cursor];
                if (now - event.time > maxAgeMs) return false;
                if (event.key === sequence[index]) {
                    if (latestMatchedIndex < 0) latestMatchedIndex = cursor;
                    cursor--;
                    matched = true;
                    break;
                }
                if (strict) return false;
            }
            if (!matched) return false;
        }

        if (latestMatchedIndex >= 0) this.events.splice(0, latestMatchedIndex + 1);
        return true;
    }
}
