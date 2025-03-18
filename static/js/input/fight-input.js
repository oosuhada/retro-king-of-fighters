import { MotionBuffer } from './motion-buffer.js';

export const PLAYER_CONTROLS = [
    {
        up: 'w', down: 's', left: 'a', right: 'd',
        attacks: { A: 'j', B: 'k', C: 'u', D: 'i' },
    },
    {
        up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
        attacks: { A: '1', B: '2', C: '4', D: '5' },
    },
];

export class FightInput {
    constructor($canvas) {
        this.$canvas = $canvas;
        this.pressedKeys = new Set();
        this.justPressed = new Set();
        this.buffer = new MotionBuffer();
        this.chordLatch = new Set();
        this.start();
    }

    start() {
        this.$canvas.keydown(event => {
            if (!this.pressedKeys.has(event.key)) {
                this.justPressed.add(event.key);
                this.buffer.push(event.key);
            }
            this.pressedKeys.add(event.key);
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault();
        });
        this.$canvas.keyup(event => this.pressedKeys.delete(event.key));
    }

    isDown(key) {
        return this.pressedKeys.has(key);
    }

    consumePress(key) {
        if (!this.justPressed.has(key)) return false;
        this.justPressed.delete(key);
        return true;
    }

    directionKey(profile, facing, token) {
        if (token === 'down') return profile.down;
        if (token === 'up') return profile.up;
        if (token === 'forward') return facing > 0 ? profile.right : profile.left;
        if (token === 'back') return facing > 0 ? profile.left : profile.right;
        return token;
    }

    consumeCommand(profile, facing, motion, attackKey = null, maxAgeMs = 500) {
        const sequence = motion.map(token => this.directionKey(profile, facing, token));
        if (attackKey) sequence.push(attackKey);
        return this.buffer.consume(sequence, maxAgeMs);
    }

    consumeChord(keys, id) {
        const down = keys.every(key => this.isDown(key));
        if (!down) {
            this.chordLatch.delete(id);
            return false;
        }
        if (this.chordLatch.has(id)) return false;
        this.chordLatch.add(id);
        keys.forEach(key => this.justPressed.delete(key));
        return true;
    }
}
