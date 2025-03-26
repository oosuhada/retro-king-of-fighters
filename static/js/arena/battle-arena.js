import { FrameActor } from '../runtime/frame-actor.js';
import { FightInput } from '../input/fight-input.js?v=20260826-6';
import { Projectile } from '../combat/projectile.js?v=20260826-6';
import { drawPixelText } from '../ui/pixel-font.js?v=20260826-6';

export class BattleArena extends FrameActor {
    constructor(root) {
        super();

        this.root = root;

        this.$canvas = $('<canvas width="1280" height="720" tabindex = 0></canvas>');
        this.ctx = this.$canvas[0].getContext('2d');
        this.root.$kof.append(this.$canvas);
        this.$canvas.focus();

        this.input = new FightInput(this.$canvas);

        this.root.$kof.append($(
            `<div class="kof-head">
            <div class="kof-side kof-side-left">
                <div class="kof-name kof-name-0">P1</div>
                <div class="kof-wins kof-wins-0"></div>
                <div class="kof-head-hp-0"><div><div></div></div></div>
                <div class="kof-power kof-power-0"><div></div></div>
                <div class="kof-stocks kof-stocks-0">○○○</div>
                <div class="kof-max kof-max-0"></div>
            </div>
            <div class="kof-head-timer">60</div>
            <div class="kof-side kof-side-right">
                <div class="kof-name kof-name-1">P2</div>
                <div class="kof-wins kof-wins-1"></div>
                <div class="kof-head-hp-1"><div><div></div></div></div>
                <div class="kof-power kof-power-1"><div></div></div>
                <div class="kof-stocks kof-stocks-1">○○○</div>
                <div class="kof-max kof-max-1"></div>
            </div>
            </div>`
        ));

        this.root.$kof.append($('<canvas class="kof-round-message" width="640" height="120"></canvas>'));
        this.root.$kof.append($('<div class="kof-move-callout kof-move-callout-0"></div>'));
        this.root.$kof.append($('<div class="kof-move-callout kof-move-callout-1"></div>'));
        this.root.$kof.append($('<div class="kof-combo-callout kof-combo-callout-0"></div>'));
        this.root.$kof.append($('<div class="kof-combo-callout kof-combo-callout-1"></div>'));
        this.root.$kof.append($(this.root.battleControlStrip()));

        this.time_left = 60000;  //unit in ms
        this.$timer = this.root.$kof.find(".kof-head-timer");
        this.$message = this.root.$kof.find('.kof-round-message');
        this.messageCtx = this.$message[0].getContext('2d');
        this.messageCtx.imageSmoothingEnabled = false;
        this.phase = 'intro';
        this.phase_left = 2200;
        this.can_fight = false;
        this.round_resolved = false;
        this.team_result = null;
        this.projectiles = [];
        this.hitStopRemaining = 0;
        this.hitEffects = [];
        this.shakeMs = 0;
        this.shakeStrength = 0;
        this.superFlashMs = 0;
        this.superFlashOwner = 0;
        this.paused = false;
    }

    setMessage(text = '', small = '') {
        const ctx = this.messageCtx;
        ctx.clearRect(0, 0, 640, 120);
        if (!text) return;
        const scale = text.length > 14 ? 4 : 6;
        drawPixelText(ctx, text, 320, 28, { scale, align: 'center', color: '#f8d42a', shadowColor: '#6f0d08', shadowOffset: 3 });
        if (small) drawPixelText(ctx, small, 320, 86, { scale: 2, align: 'center', color: '#ffffff', shadowColor: '#000000', shadowOffset: 1 });
    }

    requestHitStop(durationMs) {
        this.hitStopRemaining = Math.max(this.hitStopRemaining, durationMs);
    }

    triggerSuperFlash(ownerId, durationMs = 300) {
        this.superFlashOwner = ownerId;
        this.superFlashMs = Math.max(this.superFlashMs, durationMs);
        this.requestHitStop(Math.min(110, Math.floor(durationMs * 0.32)));
        this.shakeMs = Math.max(this.shakeMs, durationMs);
        this.shakeStrength = Math.max(this.shakeStrength, 11);
    }

    addHitEffect(x, y, options = {}) {
        this.hitEffects.push({
            x,
            y,
            life: options.life || 150,
            maxLife: options.life || 150,
            size: options.size || 26,
            guard: !!options.guard,
            special: !!options.special,
        });
        if (!options.guard) {
            this.shakeMs = Math.max(this.shakeMs, options.special ? 150 : 85);
            this.shakeStrength = Math.max(this.shakeStrength, options.special ? 9 : 5);
        }
    }

    updateHitEffects() {
        this.hitEffects.forEach(effect => effect.life -= this.timedelta);
        this.hitEffects = this.hitEffects.filter(effect => effect.life > 0);
        this.shakeMs = Math.max(0, this.shakeMs - this.timedelta);
        if (this.shakeMs <= 0) this.shakeStrength = 0;
        this.superFlashMs = Math.max(0, this.superFlashMs - this.timedelta);
    }

    isHitStopped() {
        return this.hitStopRemaining > 0;
    }

    spawnProjectile(owner, config) {
        return new Projectile(this, owner, config);
    }

    clearProjectiles() {
        [...this.projectiles].forEach(projectile => projectile.remove());
        this.projectiles = [];
    }

    start() {
        this.show_round_intro();
    }

    set_names(left, right) {
        this.root.$kof.find('.kof-name-0').text(left);
        this.root.$kof.find('.kof-name-1').text(right);
    }

    show_round_intro() {
        this.phase = 'intro';
        this.phase_left = 2200;
        this.can_fight = false;
        this.round_resolved = false;
        this.time_left = 60000;
        this.$timer.text('60');
        this.setMessage(`ROUND ${this.root.battle.round}`);
        this.clearProjectiles();

        const readyGo = new Audio('static/images/audio/readygo.wav');
        readyGo.volume = 0.65;
        readyGo.play().catch(() => {});
    }

    resolve_round() {
        if (this.round_resolved) return;
        this.round_resolved = true;
        this.can_fight = false;
        const [a, b] = this.root.players;
        let winner = null;
        if (a.hp > b.hp) winner = 0;
        if (b.hp > a.hp) winner = 1;
        const winnerName = winner === null ? null : this.root.players[winner]?.characterName;
        this.team_result = this.root.resolve_match_round(winner, this.time_left);
        this.setMessage(winner === null ? 'DRAW GAME' : `${winnerName} WINS`);
        this.phase = 'result';
        this.phase_left = 2600;
    }

    next_round_or_finish() {
        if (this.team_result?.matchOver) {
            this.phase = 'match-over';
            this.can_fight = false;
            const finalMessage = (
                this.team_result.matchWinner === null
                    ? 'DRAW GAME'
                    : `PLAYER ${this.team_result.matchWinner + 1} WINS`
            );
            this.setMessage(finalMessage);
            window.setTimeout(() => {
                this.setMessage(finalMessage, 'PRESS ENTER - TITLE');
                $(document).one('keydown.kof-restart', event => {
                    if (event.key === 'Enter') window.location.reload();
                });
            }, 700);
            return;
        }
        this.root.prepare_next_round();
        this.show_round_intro();
    }

    update_timer() {
        let [a, b] = this.root.players;
        if (!a || !b || !this.can_fight) return;
        if (a.status === 6 || b.status === 6) return;

        this.time_left -= this.timedelta;

        if (this.time_left < 0) {
            this.time_left = 0;

            this.resolve_round();
        }

        this.$timer.text(parseInt(this.time_left / 1000));
    }

    update() {
        if (this.paused) {
            this.render();
            return;
        }
        this.updateHitEffects();
        if (this.hitStopRemaining > 0) {
            this.hitStopRemaining = Math.max(0, this.hitStopRemaining - this.timedelta);
            this.render();
            return;
        }
        if (this.phase === 'intro') {
            this.phase_left -= this.timedelta;
            if (this.phase_left <= 1200 && this.phase_left > 500) this.setMessage('READY');
            if (this.phase_left <= 500 && this.phase_left > 0) this.setMessage('GO!');
            if (this.phase_left <= 0) {
                this.phase = 'fight';
                this.can_fight = true;
                this.setMessage('');
            }
            this.render();
            return;
        }

        if (this.phase === 'result') {
            this.phase_left -= this.timedelta;
            if (this.phase_left <= 0) this.next_round_or_finish();
            this.render();
            return;
        }

        if (this.phase === 'match-over') {
            this.render();
            return;
        }

        this.update_timer();
        const [a, b] = this.root.players;
        if (a && b && (a.hp <= 0 || b.hp <= 0)) this.resolve_round();

        this.render();
    }

    render() {
        this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
        const shakeX = this.shakeMs > 0 ? Math.round((Math.random() - 0.5) * this.shakeStrength) : 0;
        const shakeY = this.shakeMs > 0 ? Math.round((Math.random() - 0.5) * this.shakeStrength) : 0;
        this.root.$kof.css({ '--kof-shake-x': `${shakeX}px`, '--kof-shake-y': `${shakeY}px` });
        this.hitEffects.forEach(effect => {
            const t = effect.life / effect.maxLife;
            const radius = effect.size * (1.35 - t * 0.35);
            this.ctx.save();
            this.ctx.translate(Math.round(effect.x), Math.round(effect.y));
            this.ctx.globalAlpha = Math.min(1, t * 1.7);
            this.ctx.fillStyle = effect.guard ? '#7fd7ff' : effect.special ? '#fff35c' : '#ffffff';
            for (let i = 0; i < 8; i++) {
                this.ctx.rotate(Math.PI / 4);
                this.ctx.fillRect(Math.round(radius * 0.3), -3, Math.round(radius), 6);
            }
            this.ctx.fillStyle = effect.guard ? '#ffffff' : '#ff5a18';
            this.ctx.fillRect(-7, -7, 14, 14);
            this.ctx.restore();
        });
        if (this.superFlashMs > 0) {
            const pulse = Math.floor(this.superFlashMs / 45) % 2 === 0;
            this.ctx.save();
            this.ctx.globalAlpha = pulse ? 0.28 : 0.12;
            this.ctx.fillStyle = this.superFlashOwner === 0 ? '#fff3a6' : '#d7edff';
            this.ctx.fillRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
            this.ctx.globalAlpha = 0.9;
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fillRect(0, 0, this.ctx.canvas.width, 5);
            this.ctx.fillRect(0, this.ctx.canvas.height - 5, this.ctx.canvas.width, 5);
            this.ctx.restore();
        }
    }
}
