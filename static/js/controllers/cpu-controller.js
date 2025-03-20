export const CPU_CONTROLS = {
    up: 'cpu-up', down: 'cpu-down', left: 'cpu-left', right: 'cpu-right',
    attacks: { A: 'cpu-a', B: 'cpu-b', C: 'cpu-c', D: 'cpu-d' },
};

export class CpuController {
    constructor(difficulty = 'normal') {
        this.difficulty = difficulty;
        this.fighter = null;
        this.action = 'idle';
        this.attack = null;
        this.special = false;
        this.nextDecisionAt = 0;
        this.consumedAttack = false;
    }

    bind(fighter) {
        this.fighter = fighter;
    }

    reactionMs() {
        if (this.difficulty === 'easy') return 420;
        if (this.difficulty === 'hard') return 140;
        if (this.difficulty === 'dummy') return 1000;
        return 260;
    }

    decide() {
        if (!this.fighter) return;
        const now = performance.now();
        if (now < this.nextDecisionAt) return;
        this.nextDecisionAt = now + this.reactionMs() + Math.random() * 140;
        this.consumedAttack = false;
        this.special = false;

        if (this.difficulty === 'dummy') {
            this.action = 'idle';
            this.attack = null;
            return;
        }

        const opponent = this.fighter.root.players[1 - this.fighter.id];
        if (!opponent) return;
        const distance = Math.abs(opponent.x - this.fighter.x);
        const roll = Math.random();
        const aggression = this.difficulty === 'hard' ? 0.18 : this.difficulty === 'easy' ? -0.15 : 0;

        if (opponent.status === 4 && distance < 250 && roll < 0.55 - aggression * 0.35) {
            this.action = 'back';
            this.attack = null;
            return;
        }
        if (distance > 430) {
            if (roll < 0.30 + aggression) {
                this.action = 'attack';
                this.attack = Math.random() < 0.5 ? 'A' : 'C';
                this.special = true;
            } else if (roll < 0.40 + aggression * 0.5) {
                this.action = 'jump-forward';
                this.attack = null;
            } else {
                this.action = 'forward';
                this.attack = null;
            }
            return;
        }
        if (distance > 190) {
            if (roll < 0.20 - aggression * 0.3) this.action = 'back';
            else if (roll < 0.45 - aggression * 0.2) this.action = 'forward';
            else if (roll < 0.58) this.action = 'jump-forward';
            else {
                this.action = 'attack';
                this.attack = Math.random() < (this.difficulty === 'hard' ? 0.35 : 0.55) ? 'B' : 'C';
                this.special = this.difficulty === 'hard' && Math.random() < 0.32;
            }
            return;
        }
        if (roll < (this.difficulty === 'easy' ? 0.28 : 0.14)) {
            this.action = 'back';
            this.attack = null;
            return;
        }
        if (roll < 0.28 && opponent.status !== 7) {
            this.action = 'crouch';
            this.attack = null;
            return;
        }
        this.action = 'attack';
        this.attack = this.action === 'attack' ? ['A', 'B', 'C', 'D'][Math.floor(Math.random() * 4)] : null;
        this.special = this.difficulty === 'hard' && ['A', 'C'].includes(this.attack) && Math.random() < 0.22;
    }

    isDown(key) {
        this.decide();
        if (!this.fighter) return false;
        const forwardKey = this.fighter.direction > 0 ? CPU_CONTROLS.right : CPU_CONTROLS.left;
        const backKey = this.fighter.direction > 0 ? CPU_CONTROLS.left : CPU_CONTROLS.right;
        return (this.action === 'forward' && key === forwardKey) ||
            (this.action === 'back' && key === backKey) ||
            (this.action === 'crouch' && key === CPU_CONTROLS.down) ||
            (this.action === 'jump-forward' && (key === CPU_CONTROLS.up || key === forwardKey));
    }

    consumePress(key) {
        this.decide();
        if (this.action !== 'attack' || this.consumedAttack || !this.attack) return false;
        if (CPU_CONTROLS.attacks[this.attack] !== key) return false;
        this.consumedAttack = true;
        return true;
    }

    consumeCommand(profile, facing, motion, attackKey) {
        if (!this.special || this.consumedAttack === false || !attackKey) return false;
        return motion.join(',') === 'down,forward';
    }

    consumeChord() {
        return false;
    }
}
