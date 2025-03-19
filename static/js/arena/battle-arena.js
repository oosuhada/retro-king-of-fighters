import { FrameActor } from '../runtime/frame-actor.js';
import { FightInput } from '../input/fight-input.js';
import { Projectile } from '../combat/projectile.js';

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

        this.root.$kof.append($('<div class="kof-round-message"></div>'));
        this.root.$kof.append($('<div class="kof-move-callout kof-move-callout-0"></div>'));
        this.root.$kof.append($('<div class="kof-move-callout kof-move-callout-1"></div>'));
        this.root.$kof.append($('<div class="kof-combo-callout kof-combo-callout-0"></div>'));
        this.root.$kof.append($('<div class="kof-combo-callout kof-combo-callout-1"></div>'));
        this.root.$kof.append($(this.root.battleControlStrip()));

        this.time_left = 60000;  //unit in ms
        this.$timer = this.root.$kof.find(".kof-head-timer");
        this.$message = this.root.$kof.find('.kof-round-message');
        this.phase = 'intro';
        this.phase_left = 2200;
        this.can_fight = false;
        this.round_resolved = false;
        this.team_result = null;
        this.projectiles = [];
        this.hitStopRemaining = 0;
    }

    requestHitStop(durationMs) {
        this.hitStopRemaining = Math.max(this.hitStopRemaining, durationMs);
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
        this.$message.text(`ROUND ${this.root.battle.round}`);
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
        this.$message.text(winner === null ? 'DRAW GAME' : `${winnerName} WINS`);
        this.phase = 'result';
        this.phase_left = 2600;
    }

    next_round_or_finish() {
        if (this.team_result?.matchOver) {
            this.phase = 'match-over';
            this.can_fight = false;
            this.$message.text(
                this.team_result.matchWinner === null
                    ? 'DRAW GAME'
                    : `PLAYER ${this.team_result.matchWinner + 1} WINS`
            );
            window.setTimeout(() => {
                this.$message.html(`${this.$message.text()}<small>PRESS ENTER · TITLE</small>`);
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
        if (this.hitStopRemaining > 0) {
            this.hitStopRemaining = Math.max(0, this.hitStopRemaining - this.timedelta);
            this.render();
            return;
        }
        if (this.phase === 'intro') {
            this.phase_left -= this.timedelta;
            if (this.phase_left <= 1200 && this.phase_left > 500) this.$message.text('READY');
            if (this.phase_left <= 500 && this.phase_left > 0) this.$message.text('GO!');
            if (this.phase_left <= 0) {
                this.phase = 'fight';
                this.can_fight = true;
                this.$message.text('');
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
        // this.ctx.fillStyle = 'black';
        // this.ctx.fillRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
    }
}
