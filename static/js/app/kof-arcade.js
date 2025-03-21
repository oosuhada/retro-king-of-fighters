import { BattleArena } from '../arena/battle-arena.js';
import { KyoFighter } from '../fighters/kyo-fighter.js';
import { MaiFighter } from '../fighters/mai-fighter.js';
import { TeamMatchState } from '../match/team-match-state.js';
import { SingleMatchState } from '../match/single-match-state.js';
import { CpuController, CPU_CONTROLS } from '../controllers/cpu-controller.js';

const ROSTER = [
    { name: 'MAI', FighterClass: MaiFighter, asset: 'mai', style: 'MOBILE PROJECTILE / RUSH', profile: { walkSpeed: 410, projectileSpeed: 560, damageScale: 1 } },
    { name: 'KYO', FighterClass: KyoFighter, asset: 'kyo', style: 'BALANCED PRESSURE / ANTI-AIR', profile: { walkSpeed: 400, projectileSpeed: 650, damageScale: 1 } },
    { name: 'EX MAI', FighterClass: MaiFighter, asset: 'mai', style: 'FAST PROJECTILE / LIGHT DAMAGE', profile: { walkSpeed: 445, projectileSpeed: 640, damageScale: 0.96, specialScale: 1.08 } },
    { name: 'EX KYO', FighterClass: KyoFighter, asset: 'kyo', style: 'FAST PRESSURE / STRONG SPECIALS', profile: { walkSpeed: 425, projectileSpeed: 720, damageScale: 0.98, specialScale: 1.12 } },
];

const MOVE_SUMMARIES = {
    kyo: ['↓↘→ + A/C · YAMI BARAI', '→↓↘ + A/C · ONIYAKI', '↓↙← + B/D · KOTOTSUKI YO', '↓↘→ ↓↘→ + A/C · OROCHINAGI'],
    mai: ['↓↘→ + A/C · KACHOSEN', '→↓↘ + A/C · SHINOBI BACHI', '↓↙← + B/D · RYU ENBU', '↓↘→ ↓↘→ + A/C · SUPER SHINOBI BACHI'],
};

const CONTROLS_HTML = `
    <div class="kof-control-grid">
        <div class="kof-control-card p1">
            <strong>PLAYER 1</strong>
            <div class="kof-key-row"><kbd>W</kbd><span>JUMP</span></div>
            <div class="kof-key-row"><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span>MOVE / CROUCH</span></div>
            <div class="kof-key-row"><kbd>J</kbd><span>A · LIGHT PUNCH</span></div>
            <div class="kof-key-row"><kbd>K</kbd><span>B · LIGHT KICK</span></div>
            <div class="kof-key-row"><kbd>U</kbd><span>C · HEAVY PUNCH</span></div>
            <div class="kof-key-row"><kbd>I</kbd><span>D · HEAVY KICK</span></div>
        </div>
        <div class="kof-control-card p2">
            <strong>PLAYER 2</strong>
            <div class="kof-key-row"><kbd>↑</kbd><span>JUMP</span></div>
            <div class="kof-key-row"><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd><span>MOVE / CROUCH</span></div>
            <div class="kof-key-row"><kbd>1</kbd><span>A · LIGHT PUNCH</span></div>
            <div class="kof-key-row"><kbd>2</kbd><span>B · LIGHT KICK</span></div>
            <div class="kof-key-row"><kbd>4</kbd><span>C · HEAVY PUNCH</span></div>
            <div class="kof-key-row"><kbd>5</kbd><span>D · HEAVY KICK</span></div>
        </div>
    </div>
    <div class="kof-command-help">
        HOLD BACK: WALK BACK + HIGH/MID GUARD · ↓+BACK: LOW GUARD · ↓ + BUTTON: CROUCH ATTACK · JUMP + BUTTON: AIR ATTACK<br>
        NEAR + ←/→ + C/D: THROW · C/D DURING THROW: THROW TECH · ↑↑ HOP · ↓↑ SUPER JUMP · →→ DASH · ←← BACK STEP<br>
        ↓↘→ + A/C PROJECTILE · →↓↘ + A/C DP · ABC MAX
    </div>
`;

class KofArcade {
    constructor(id) {
        this.$kof = $('#' + id);
        this.game_map = null;
        this.players = [];
        this.playerMode = 'two';
        this.matchKind = 'team';
        this.cpuDifficulty = 'normal';
        this.selectionCursor = [0, 1];
        this.teamChoices = [[], []];
        this.orderLocked = [false, false];
        this.battle = null;
        this.helpOpen = false;
        this.bindGlobalHelp();
        this.showTitle();
    }

    clearScreenEvents() {
        $(document).off('.kof-screen .kof-select .kof-order');
    }

    setOverlay(html, className = 'kof-flow-screen') {
        this.$kof.find('.kof-flow-screen,.kof-character-select,.kof-help-overlay').remove();
        this.$kof.append($(`<div class="${className}">${html}</div>`));
    }

    showTitle() {
        this.clearScreenEvents();
        this.setOverlay(`
            <div class="kof-title-mark">KOF</div>
            <div class="kof-logo">THE KING<br>OF FIGHTERS</div>
            <button class="kof-menu-button kof-start">PRESS START</button>
            <div class="kof-title-credit">1P VS CPU / 2P VS PLAYER</div>
        `);
        const next = () => this.showPlayerMode();
        this.$kof.find('.kof-start').on('click', next);
        $(document).on('keydown.kof-screen', event => {
            if (event.key === 'Enter') next();
        });
    }

    showPlayerMode() {
        this.clearScreenEvents();
        this.setOverlay(`
            <div class="kof-flow-title">PLAYER SELECT</div>
            <div class="kof-menu-stack">
                <button class="kof-menu-button" data-mode="one"><b>1 PLAYER</b><span>VS CPU</span></button>
                <button class="kof-menu-button" data-mode="two"><b>2 PLAYERS</b><span>VS PLAYER</span></button>
            </div>
            <div class="kof-flow-note">PRESS 1 / 2</div>
        `);
        const choose = mode => {
            this.playerMode = mode;
            this.showBattleMode();
        };
        this.$kof.find('[data-mode]').on('click', event => choose($(event.currentTarget).data('mode')));
        $(document).on('keydown.kof-screen', event => {
            if (event.key === '1') choose('one');
            if (event.key === '2') choose('two');
        });
    }

    showBattleMode() {
        this.clearScreenEvents();
        const onePlayer = this.playerMode === 'one';
        this.setOverlay(`
            <div class="kof-flow-title">${onePlayer ? '1 PLAYER' : '2 PLAYERS'}</div>
            <div class="kof-menu-stack">
                ${onePlayer ? `
                    <button class="kof-menu-button" data-battle="arcade"><b>ARCADE</b><span>1 VS CPU</span></button>
                    <button class="kof-menu-button" data-battle="training"><b>TRAINING</b><span>1 VS DUMMY</span></button>
                ` : `
                    <button class="kof-menu-button" data-battle="single"><b>SINGLE BATTLE</b><span>1 VS 1</span></button>
                    <button class="kof-menu-button" data-battle="team"><b>TEAM BATTLE</b><span>3 VS 3</span></button>
                `}
            </div>
            <button class="kof-text-button kof-back">← BACK</button>
        `);
        const choose = kind => {
            this.matchKind = kind === 'team' ? 'team' : 'single';
            if (kind === 'training') {
                this.cpuDifficulty = 'dummy';
                this.showControls();
                return;
            }
            if (kind === 'arcade') {
                this.showDifficulty();
                return;
            }
            this.showControls();
        };
        this.$kof.find('[data-battle]').on('click', event => choose($(event.currentTarget).data('battle')));
        this.$kof.find('.kof-back').on('click', () => this.showPlayerMode());
        $(document).on('keydown.kof-screen', event => {
            if (event.key === 'Escape') this.showPlayerMode();
        });
    }

    showDifficulty() {
        this.clearScreenEvents();
        this.setOverlay(`
            <div class="kof-flow-title">SELECT CPU LEVEL</div>
            <div class="kof-menu-stack">
                <button class="kof-menu-button" data-difficulty="easy"><b>EASY</b><span>SLOW REACTION · FEWER ATTACKS</span></button>
                <button class="kof-menu-button" data-difficulty="normal"><b>NORMAL</b><span>CLASSIC ARCADE BALANCE</span></button>
                <button class="kof-menu-button" data-difficulty="hard"><b>HARD</b><span>FAST REACTION · MORE PRESSURE</span></button>
            </div>
            <button class="kof-text-button kof-back">← BACK</button>
        `);
        const choose = difficulty => {
            this.cpuDifficulty = difficulty;
            this.showControls();
        };
        this.$kof.find('[data-difficulty]').on('click', event => choose($(event.currentTarget).data('difficulty')));
        this.$kof.find('.kof-back').on('click', () => this.showBattleMode());
        $(document).on('keydown.kof-screen', event => {
            if (event.key === '1') choose('easy');
            if (event.key === '2') choose('normal');
            if (event.key === '3') choose('hard');
            if (event.key === 'Escape') this.showBattleMode();
        });
    }

    showControls() {
        this.clearScreenEvents();
        const p2Note = this.playerMode === 'one' ? '<div class="kof-cpu-note">PLAYER 2 IS CPU CONTROLLED IN THIS MODE</div>' : '';
        this.setOverlay(`
            <div class="kof-flow-title compact">CONTROLS</div>
            ${CONTROLS_HTML}
            ${p2Note}
            <button class="kof-menu-button kof-continue">ENTER · CONTINUE</button>
        `);
        const next = () => {
            this.clearScreenEvents();
            this.resetSelection();
            this.show_character_select();
        };
        this.$kof.find('.kof-continue').on('click', next);
        $(document).on('keydown.kof-screen', event => {
            if (event.key === 'Enter') next();
        });
    }

    bindGlobalHelp() {
        $(document).on('keydown.kof-help', event => {
            if (!this.game_map || !['?', 'h', 'H', 'Escape'].includes(event.key)) return;
            event.preventDefault();
            this.toggleHelp();
        });
    }

    toggleHelp() {
        if (this.helpOpen) {
            this.$kof.find('.kof-help-overlay').remove();
            this.helpOpen = false;
            if (this.game_map) this.game_map.can_fight = true;
            return;
        }
        this.helpOpen = true;
        if (this.game_map) this.game_map.can_fight = false;
        this.$kof.append($(`
            <div class="kof-help-overlay">
                <div class="kof-flow-title compact">CONTROLS & MOVE LIST</div>
                ${CONTROLS_HTML}
                <div class="kof-move-list">UNIVERSAL · ↓+BACK LOW GUARD · ↓+ATTACK CROUCH NORMAL · JUMP+ATTACK AIR NORMAL · NEAR+←/→+C/D THROW · C/D THROW TECH · ↑↑ HOP · ↓↑ SUPER JUMP</div>
                <div class="kof-move-list">KYO/MAI · ↓↘→ + A/C PROJECTILE · →↓↘ + A/C ANTI-AIR · ↓↙← + B/D RUSH · ↓↘→ ↓↘→ + A/C SUPER</div>
                <button class="kof-menu-button kof-close-help">ESC / H · RESUME</button>
            </div>
        `));
        this.$kof.find('.kof-close-help').on('click', () => this.toggleHelp());
    }

    battleControlStrip() {
        return `<div class="kof-battle-controls">
            <span>1P <b>WASD</b> · <b>J K U I</b></span>
            <span>${this.playerMode === 'one' ? `CPU <b>${this.cpuDifficulty.toUpperCase()}</b>` : '2P <b>ARROWS</b> · <b>1 2 4 5</b>'}</span>
            <span><b>H / ?</b> CONTROLS + MOVES</span>
        </div>`;
    }

    resetSelection() {
        this.selectionCursor = [0, 1];
        this.teamChoices = [[], []];
        this.orderLocked = [false, false];
    }

    character_name(index) { return ROSTER[index]?.name || 'UNKNOWN'; }
    move_selection_cursor(player, direction) { this.selectionCursor[player] = (this.selectionCursor[player] + direction + ROSTER.length) % ROSTER.length; }

    requiredPicks() { return this.matchKind === 'team' ? 3 : 1; }

    render_character_select() {
        const cards = this.$kof.find('.kof-select-card');
        cards.removeClass('p1-selected p2-selected');
        cards.eq(this.selectionCursor[0]).addClass('p1-selected');
        if (this.playerMode === 'two') cards.eq(this.selectionCursor[1]).addClass('p2-selected');
        const required = this.requiredPicks();
        for (let player = 0; player < 2; player++) {
            const picks = this.teamChoices[player].map(choice => this.character_name(choice));
            const cursorName = this.character_name(this.selectionCursor[player]);
            const cpu = player === 1 && this.playerMode === 'one';
            this.$kof.find(`.kof-select-p${player + 1}`).text(cpu
                ? `CPU [${picks.join(' / ') || 'AUTO'}]`
                : `${player + 1}P [${picks.join(' / ') || '---'}] ${picks.length}/${required} ▶ ${cursorName}`
            );
        }
        const focus = ROSTER[this.selectionCursor[0]];
        const moves = MOVE_SUMMARIES[focus.asset] || [];
        this.$kof.find('.kof-select-move-title').text(`${focus.name} · ${focus.style}`);
        this.$kof.find('.kof-select-moves').html(moves.map(move => `<span>${move}</span>`).join(''));
    }

    add_team_pick(player) {
        if (this.teamChoices[player].length >= this.requiredPicks()) return;
        this.teamChoices[player].push(this.selectionCursor[player]);
    }

    remove_team_pick(player) { this.teamChoices[player].pop(); }

    prepareCpuChoices() {
        if (this.playerMode !== 'one') return;
        if (this.matchKind === 'single') this.teamChoices[1] = [this.cpuDifficulty === 'dummy' ? 0 : 1];
        else this.teamChoices[1] = [1, 0, 3];
    }

    selectionComplete() {
        const required = this.requiredPicks();
        return this.teamChoices[0].length === required && this.teamChoices[1].length === required;
    }

    show_character_select() {
        this.prepareCpuChoices();
        const required = this.requiredPicks();
        const cards = ROSTER.map((fighter, index) => `<div class="kof-select-card" data-roster-index="${index}" data-asset="${fighter.asset}"><span>${fighter.name}</span></div>`).join('');
        this.setOverlay(`
            <div class="kof-select-title">SELECT ${required === 1 ? 'FIGHTER' : '3 FIGHTERS'}</div>
            <div class="kof-select-grid">${cards}</div>
            <div class="kof-select-status"><span class="kof-select-p1"></span><span class="kof-select-p2"></span></div>
            <div class="kof-select-move-panel">
                <strong class="kof-select-move-title"></strong>
                <div class="kof-select-moves"></div>
            </div>
            <div class="kof-select-help">1P A/D + F PICK, R UNDO ${this.playerMode === 'two' ? '&nbsp;&nbsp; 2P ←/→ + ENTER PICK, BACKSPACE UNDO' : ''}</div>
        `, 'kof-character-select');
        this.render_character_select();
        $(document).on('keydown.kof-select', event => {
            if (event.key === 'a') this.move_selection_cursor(0, -1);
            if (event.key === 'd') this.move_selection_cursor(0, 1);
            if (event.key === 'f') this.add_team_pick(0);
            if (event.key === 'r') this.remove_team_pick(0);
            if (this.playerMode === 'two') {
                if (event.key === 'ArrowLeft') this.move_selection_cursor(1, -1);
                if (event.key === 'ArrowRight') this.move_selection_cursor(1, 1);
                if (event.key === 'Enter') this.add_team_pick(1);
                if (event.key === 'Backspace') this.remove_team_pick(1);
            }
            this.render_character_select();
            if (this.selectionComplete()) {
                $(document).off('keydown.kof-select');
                window.setTimeout(() => this.matchKind === 'team' ? this.show_order_select() : this.start_match(), 300);
            }
        });
    }

    rotateOrder(player, direction) {
        const team = this.teamChoices[player];
        if (direction > 0) team.push(team.shift()); else team.unshift(team.pop());
    }

    render_order_select() {
        for (let player = 0; player < 2; player++) {
            this.$kof.find(`.kof-order-team-${player}`).text(this.teamChoices[player].map((choice, index) => `${index + 1}.${this.character_name(choice)}`).join('  '));
            this.$kof.find(`.kof-order-ready-${player}`).text(this.orderLocked[player] ? 'READY' : 'SELECT ORDER');
        }
    }

    show_order_select() {
        if (this.playerMode === 'one') this.orderLocked[1] = true;
        this.$kof.find('.kof-character-select').html(`
            <div class="kof-select-title">ORDER SELECT</div>
            <div class="kof-order-board">
                <div class="kof-order-side"><div class="kof-order-label">1P</div><div class="kof-order-team kof-order-team-0"></div><div class="kof-order-ready kof-order-ready-0"></div><div class="kof-order-help">A / D ROTATE · F READY</div></div>
                <div class="kof-order-vs">VS</div>
                <div class="kof-order-side"><div class="kof-order-label">${this.playerMode === 'one' ? 'CPU' : '2P'}</div><div class="kof-order-team kof-order-team-1"></div><div class="kof-order-ready kof-order-ready-1"></div><div class="kof-order-help">${this.playerMode === 'one' ? 'AUTO ORDER' : '← / → ROTATE · ENTER READY'}</div></div>
            </div>`);
        this.render_order_select();
        $(document).on('keydown.kof-order', event => {
            if (!this.orderLocked[0]) {
                if (event.key === 'a') this.rotateOrder(0, -1);
                if (event.key === 'd') this.rotateOrder(0, 1);
                if (event.key === 'f') this.orderLocked[0] = true;
            }
            if (this.playerMode === 'two' && !this.orderLocked[1]) {
                if (event.key === 'ArrowLeft') this.rotateOrder(1, -1);
                if (event.key === 'ArrowRight') this.rotateOrder(1, 1);
                if (event.key === 'Enter') this.orderLocked[1] = true;
            }
            this.render_order_select();
            if (this.orderLocked[0] && this.orderLocked[1]) {
                $(document).off('keydown.kof-order');
                window.setTimeout(() => this.start_match(), 350);
            }
        });
    }

    create_player(characterIndex, info) {
        const rosterEntry = ROSTER[characterIndex];
        const fighter = new rosterEntry.FighterClass(this, { ...info, characterName: rosterEntry.name, profile: rosterEntry.profile });
        if (this.playerMode === 'one' && info.id === 1) {
            const cpu = new CpuController(this.cpuDifficulty);
            cpu.bind(fighter);
            fighter.input = cpu;
            fighter.controls = CPU_CONTROLS;
        }
        return fighter;
    }

    start_match() {
        this.clearScreenEvents();
        this.$kof.find('.kof-character-select,.kof-flow-screen').remove();
        this.battle = this.matchKind === 'team' ? new TeamMatchState(this.teamChoices) : new SingleMatchState(this.teamChoices);
        this.game_map = new BattleArena(this);
        this.spawn_active_fighters();
    }

    spawn_active_fighters() {
        this.players.forEach(player => player?.destroy());
        const positions = [200, 900];
        this.players = [0, 1].map(player => {
            const member = this.battle.activeMember(player);
            const gauge = this.battle.gaugeFor(player);
            if (!member) return null;
            return this.create_player(member.characterIndex, { id: player, x: positions[player], y: 0, width: 120, height: 200, color: player === 0 ? 'blue' : 'red', hp: member.hp, power: gauge.power, stocks: gauge.stocks });
        });
        const left = this.battle.activeMember(0);
        const right = this.battle.activeMember(1);
        this.game_map.set_names(left ? this.character_name(left.characterIndex) : '---', right ? this.character_name(right.characterIndex) : '---');
        this.update_match_ui();
    }

    update_match_ui() {
        if (!this.battle) return;
        this.$kof.find('.kof-wins-0').text(this.battle.teamLabel(0, index => this.character_name(index)));
        this.$kof.find('.kof-wins-1').text(this.battle.teamLabel(1, index => this.character_name(index)));
    }

    resolve_match_round(winner, timeLeftMs) {
        this.battle.snapshot(this.players);
        const result = this.battle.resolveRound(winner, timeLeftMs);
        this.update_match_ui();
        return result;
    }

    prepare_next_round() { this.spawn_active_fighters(); }

    show_move_name(player, name) {
        const $callout = this.$kof.find(`.kof-move-callout-${player}`);
        $callout.text(name).addClass('visible');
        window.clearTimeout($callout.data('timer'));
        const timer = window.setTimeout(() => $callout.removeClass('visible'), 900);
        $callout.data('timer', timer);
    }

    show_combo(player, count) {
        const $combo = this.$kof.find(`.kof-combo-callout-${player}`);
        if (!count || count < 2) { $combo.removeClass('visible').text(''); return; }
        $combo.text(`${count} HIT COMBO`).addClass('visible');
    }
}

export { KofArcade };
