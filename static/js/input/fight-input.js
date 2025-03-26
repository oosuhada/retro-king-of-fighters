import { MotionBuffer } from './motion-buffer.js?v=20260826-5';

export function normalizeKeyboardKey(event) {
    const nativeEvent = event?.originalEvent || event || {};
    const code = nativeEvent.code || event?.code || '';

    // Use the physical key position first so WASD/J/K/U/I keeps working when
    // the user's active keyboard layout is Korean (or any other non-Latin IME).
    if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
    if (/^Digit[0-9]$/.test(code)) return code.slice(5);
    if (/^Numpad[0-9]$/.test(code)) return code.slice(6);
    if (code === 'Space') return ' ';
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape', 'Backspace'].includes(code)) return code;

    const key = event?.key ?? nativeEvent.key ?? '';
    return /^[A-Z]$/.test(key) ? key.toLowerCase() : key;
}

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
            const key = normalizeKeyboardKey(event);
            if (!this.pressedKeys.has(key)) {
                this.justPressed.add(key);
                this.buffer.push(key);
            }
            this.pressedKeys.add(key);
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(key)) event.preventDefault();
        });
        this.$canvas.keyup(event => this.pressedKeys.delete(normalizeKeyboardKey(event)));
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

    consumeCommand(profile, facing, motion, attackKey = null, maxAgeMs = 500, strict = false) {
        const sequence = motion.map(token => this.directionKey(profile, facing, token));
        if (attackKey) sequence.push(attackKey);
        return this.buffer.consume(sequence, maxAgeMs, strict);
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
