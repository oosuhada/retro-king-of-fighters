import { BattleArena } from '../arena/battle-arena.js?v=20260826-6';
import { KyoFighter } from '../fighters/kyo-fighter.js?v=20260826-5';
import { MaiFighter } from '../fighters/mai-fighter.js?v=20260826-5';
import { TeamMatchState } from '../match/team-match-state.js';
import { SingleMatchState } from '../match/single-match-state.js';
import { CpuController, CPU_CONTROLS } from '../controllers/cpu-controller.js';
import { drawPixelText } from '../ui/pixel-font.js?v=20260826-6';

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
        this.pauseOpen = false;
        this.fitViewport = this.fitViewport.bind(this);
        $(window).on('resize.kof-fit', this.fitViewport);
        this.fitViewport();
        this.bindGlobalHelp();
        this.showTitle();
    }

    fitViewport() {
        const scale = Math.min(window.innerWidth / 1280, window.innerHeight / 720, 1.6);
        this.$kof.css('--kof-scale', scale.toFixed(4));
    }

    clearScreenEvents() {
        $(document).off('.kof-screen .kof-select .kof-order');
    }

    setOverlay(html, className = 'kof-flow-screen') {
        this.$kof.find('.kof-flow-screen,.kof-character-select,.kof-help-overlay').remove();
        this.$kof.append($(`<div class="${className}">${html}</div>`));
        this.pixelizeHeadings();
    }

    pixelizeHeadings() {
        this.$kof.find('.kof-flow-title,.kof-select-title').each((_, element) => {
            const $heading = $(element);
            if ($heading.is('canvas')) return;
            const text = $heading.text().trim();
            const compact = $heading.hasClass('compact');
            const canvas = document.createElement('canvas');
            canvas.width = 320;
            canvas.height = compact ? 34 : 44;
            canvas.className = `kof-pixel-heading${compact ? ' compact' : ''}`;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            const scale = text.length > 18 ? 2 : text.length > 11 ? 3 : 4;
            drawPixelText(ctx, text, 160, compact ? 8 : 10, {
                scale,
                align: 'center',
                color: '#f5d51f',
                shadowColor: '#71130b',
                shadowOffset: 2,
            });
            $heading.replaceWith(canvas);
        });
    }

    bindArcadeMenu(selector, onChoose, onBack = null) {
        const $items = this.$kof.find(selector);
        let cursor = 0;
        const render = () => {
            $items.removeClass('kof-menu-active');
            $items.eq(cursor).addClass('kof-menu-active');
        };
        const chooseCurrent = () => {
            const $item = $items.eq(cursor);
            if ($item.length) onChoose($item);
        };
        $items.each((index, element) => {
            $(element).on('mouseenter focus', () => {
                cursor = index;
                render();
            });
            $(element).on('click', () => {
                cursor = index;
                chooseCurrent();
            });
        });
        render();
        $(document).on('keydown.kof-screen', event => {
            if (['ArrowUp', 'w', 'W'].includes(event.key)) {
                event.preventDefault();
                cursor = (cursor - 1 + $items.length) % $items.length;
                render();
            }
            if (['ArrowDown', 's', 'S'].includes(event.key)) {
                event.preventDefault();
                cursor = (cursor + 1) % $items.length;
                render();
            }
            if (event.key === 'Enter') {
                event.preventDefault();
                chooseCurrent();
            }
            if (event.key === 'Escape' && onBack) onBack();
        });
    }

    showTitle() {
        this.clearScreenEvents();
        this.setOverlay(`
            <canvas class="kof-title-pixel" width="320" height="180"></canvas>
            <canvas class="kof-start-pixel" width="160" height="18" tabindex="0" role="button" aria-label="Press Start"></canvas>
        `);
        const canvas = this.$kof.find('.kof-title-pixel')[0];
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        drawPixelText(ctx, 'KOF', 160, 20, { scale: 7, align: 'center', color: '#a91b12', shadowColor: '#2c0000', shadowOffset: 2 });
        drawPixelText(ctx, 'THE KING', 160, 64, { scale: 4, align: 'center', color: '#ffd51a', shadowColor: '#8d1708', shadowOffset: 2 });
        drawPixelText(ctx, 'OF FIGHTERS', 160, 96, { scale: 4, align: 'center', color: '#ffd51a', shadowColor: '#8d1708', shadowOffset: 2 });
        const startCanvas = this.$kof.find('.kof-start-pixel')[0];
        const startCtx = startCanvas.getContext('2d');
        startCtx.imageSmoothingEnabled = false;
        drawPixelText(startCtx, 'PRESS START', 80, 3, { scale: 2, align: 'center', color: '#ffffff', shadowColor: '#4a3725', shadowOffset: 1 });
        const next = () => this.showPlayerMode();
        this.$kof.find('.kof-start-pixel').on('click', next);
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
        this.bindArcadeMenu('[data-mode]', $item => choose($item.data('mode')));
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
        this.$kof.find('.kof-back').on('click', () => this.showPlayerMode());
        this.bindArcadeMenu('[data-battle]', $item => choose($item.data('battle')), () => this.showPlayerMode());
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
        this.$kof.find('.kof-back').on('click', () => this.showBattleMode());
        this.bindArcadeMenu('[data-difficulty]', $item => choose($item.data('difficulty')), () => this.showBattleMode());
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
            if (!this.game_map) return;
            if (['p', 'P', 'Escape'].includes(event.key)) {
                event.preventDefault();
                this.togglePause();
                return;
            }
            if (['?', 'h', 'H'].includes(event.key)) {
                event.preventDefault();
                this.toggleHelp();
            }
        });
    }

    togglePause() {
        if (!this.game_map || this.game_map.phase === 'match-over') return;
        if (this.helpOpen) this.toggleHelp();
        this.pauseOpen = !this.pauseOpen;
        this.game_map.paused = this.pauseOpen;
        this.$kof.find('.kof-pause-overlay').remove();
        if (!this.pauseOpen) {
            $(document).off('keydown.kof-pause-title');
            this.game_map.$canvas.focus();
            return;
        }
        const $overlay = $(`
            <div class="kof-pause-overlay">
                <canvas width="320" height="180"></canvas>
            </div>
        `);
        this.$kof.append($overlay);
        const ctx = $overlay.find('canvas')[0].getContext('2d');
        ctx.imageSmoothingEnabled = false;
        drawPixelText(ctx, 'PAUSE', 160, 38, { scale: 5, align: 'center', color: '#f5d31f', shadowColor: '#69150d', shadowOffset: 2 });
        drawPixelText(ctx, 'P / ESC  RESUME', 160, 94, { scale: 2, align: 'center', color: '#ffffff' });
        drawPixelText(ctx, 'H  CONTROLS', 160, 116, { scale: 2, align: 'center', color: '#d7c988' });
        drawPixelText(ctx, 'T  TITLE', 160, 138, { scale: 2, align: 'center', color: '#d7c988' });
        $(document).off('keydown.kof-pause-title').on('keydown.kof-pause-title', event => {
            if (!this.pauseOpen) return;
            if (event.key === 't' || event.key === 'T') window.location.reload();
        });
    }

    toggleHelp() {
        if (this.helpOpen) {
            this.$kof.find('.kof-help-overlay').remove();
            this.helpOpen = false;
            if (this.game_map) this.game_map.paused = this.pauseOpen;
            return;
        }
        this.helpOpen = true;
        if (this.game_map) this.game_map.paused = true;
        this.$kof.append($(`
            <div class="kof-help-overlay">
                <div class="kof-flow-title compact">CONTROLS & MOVE LIST</div>
                ${CONTROLS_HTML}
                <div class="kof-move-list">UNIVERSAL · ↓+BACK LOW GUARD · ↓+ATTACK CROUCH NORMAL · JUMP+ATTACK AIR NORMAL · NEAR+←/→+C/D THROW · C/D THROW TECH · ↑↑ HOP · ↓↑ SUPER JUMP</div>
                <div class="kof-move-list">KYO/MAI · ↓↘→ + A/C PROJECTILE · →↓↘ + A/C ANTI-AIR · ↓↙← + B/D RUSH · ↓↘→ ↓↘→ + A/C SUPER</div>
                <button class="kof-menu-button kof-close-help">H / ? · CLOSE</button>
            </div>
        `));
        this.$kof.find('.kof-close-help').on('click', () => this.toggleHelp());
    }

    battleControlStrip() {
        return '';
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
        const playerPicks = this.teamChoices[0];
        if (playerPicks.length < this.requiredPicks()) {
            this.teamChoices[1] = [];
            return;
        }
        if (this.matchKind === 'single') {
            const playerIndex = playerPicks[0];
            const playerAsset = ROSTER[playerIndex].asset;
            const differentAsset = ROSTER.map((fighter, index) => ({ fighter, index }))
                .filter(entry => entry.fighter.asset !== playerAsset);
            const pool = differentAsset.length ? differentAsset : ROSTER.map((fighter, index) => ({ fighter, index })).filter(entry => entry.index !== playerIndex);
            const choice = pool[Math.floor(Math.random() * pool.length)]?.index ?? ((playerIndex + 1) % ROSTER.length);
            this.teamChoices[1] = [choice];
            return;
        }
        const pool = ROSTER.map((fighter, index) => index).sort(() => Math.random() - 0.5);
        const playerLeadAsset = ROSTER[playerPicks[0]].asset;
        const differentLeadIndex = pool.findIndex(index => ROSTER[index].asset !== playerLeadAsset);
        if (differentLeadIndex > 0) [pool[0], pool[differentLeadIndex]] = [pool[differentLeadIndex], pool[0]];
        this.teamChoices[1] = pool.slice(0, 3);
    }

    selectionComplete() {
        const required = this.requiredPicks();
        return this.teamChoices[0].length === required && this.teamChoices[1].length === required;
    }

    show_character_select() {
        if (this.playerMode === 'one') this.teamChoices[1] = [];
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
            <div class="kof-select-help">A / D MOVE · F DECIDE${this.playerMode === 'two' ? '&nbsp;&nbsp; 2P ← / → MOVE · ENTER DECIDE' : ''}</div>
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
            if (this.playerMode === 'one') this.prepareCpuChoices();
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
        this.pixelizeHeadings();
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
