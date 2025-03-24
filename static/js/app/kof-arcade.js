import { BattleArena } from '../arena/battle-arena.js?v=20260826-6';
import { KyoFighter } from '../fighters/kyo-fighter.js?v=20260826-8';
import { MaiFighter } from '../fighters/mai-fighter.js?v=20260826-8';
import { TeamMatchState } from '../match/team-match-state.js';
import { SingleMatchState } from '../match/single-match-state.js';
import { CpuController, CPU_CONTROLS } from '../controllers/cpu-controller.js';
import { drawPixelText } from '../ui/pixel-font.js?v=20260826-7';
import { MobileController } from '../input/mobile-controller.js?v=20260826-9';

const ROSTER = [
    { name: 'MAI', FighterClass: MaiFighter, asset: 'mai', style: 'MOBILE PROJECTILE / RUSH', profile: { walkSpeed: 410, projectileSpeed: 560, damageScale: 1 } },
    { name: 'KYO', FighterClass: KyoFighter, asset: 'kyo', style: 'BALANCED PRESSURE / ANTI-AIR', profile: { walkSpeed: 400, projectileSpeed: 650, damageScale: 1 } },
    { name: 'EX MAI', FighterClass: MaiFighter, asset: 'mai', style: 'FAST PROJECTILE / LIGHT DAMAGE', profile: { walkSpeed: 445, projectileSpeed: 640, damageScale: 0.96, specialScale: 1.08 } },
    { name: 'EX KYO', FighterClass: KyoFighter, asset: 'kyo', style: 'FAST PRESSURE / STRONG SPECIALS', profile: { walkSpeed: 425, projectileSpeed: 720, damageScale: 0.98, specialScale: 1.12 } },
];

const MOVE_SUMMARIES = {
    kyo: ['QCF + A/C  YAMI BARAI', 'F,D,DF + A/C  ONIYAKI', 'QCB + B/D  KOTOTSUKI YO', 'QCF QCF + A/C  OROCHINAGI'],
    mai: ['QCF + A/C  KACHOSEN', 'F,D,DF + A/C  SHINOBI BACHI', 'QCB + B/D  RYU ENBU', 'QCF QCF + A/C  SUPER SHINOBI BACHI'],
};

const CONTROLS_HTML = `
    <div class="kof-howto-board">
        <div class="kof-control-column">
            <div class="kof-pixel-label" data-pixel-text="PLAYER 1" data-pixel-scale="3"></div>
            <div class="kof-key-row"><i data-pixel-key="W"></i><span data-pixel-text="JUMP"></span></div>
            <div class="kof-key-row"><i data-pixel-key="A"></i><i data-pixel-key="S"></i><i data-pixel-key="D"></i><span data-pixel-text="MOVE / CROUCH"></span></div>
            <div class="kof-key-row"><i data-pixel-key="J"></i><span data-pixel-text="A  LIGHT PUNCH"></span></div>
            <div class="kof-key-row"><i data-pixel-key="K"></i><span data-pixel-text="B  LIGHT KICK"></span></div>
            <div class="kof-key-row"><i data-pixel-key="U"></i><span data-pixel-text="C  HEAVY PUNCH"></span></div>
            <div class="kof-key-row"><i data-pixel-key="I"></i><span data-pixel-text="D  HEAVY KICK"></span></div>
        </div>
        <div class="kof-howto-divider"></div>
        <div class="kof-control-column">
            <div class="kof-pixel-label" data-pixel-text="PLAYER 2" data-pixel-scale="3"></div>
            <div class="kof-key-row"><i data-pixel-key="UP"></i><span data-pixel-text="JUMP"></span></div>
            <div class="kof-key-row"><i data-pixel-key="LEFT"></i><i data-pixel-key="DOWN"></i><i data-pixel-key="RIGHT"></i><span data-pixel-text="MOVE / CROUCH"></span></div>
            <div class="kof-key-row"><i data-pixel-key="1"></i><span data-pixel-text="A  LIGHT PUNCH"></span></div>
            <div class="kof-key-row"><i data-pixel-key="2"></i><span data-pixel-text="B  LIGHT KICK"></span></div>
            <div class="kof-key-row"><i data-pixel-key="4"></i><span data-pixel-text="C  HEAVY PUNCH"></span></div>
            <div class="kof-key-row"><i data-pixel-key="5"></i><span data-pixel-text="D  HEAVY KICK"></span></div>
        </div>
    </div>
    <div class="kof-command-help">
        <div data-pixel-text="BACK = GUARD   DOWN+BACK = LOW GUARD   DOWN+BUTTON = CROUCH ATTACK"></div>
        <div data-pixel-text="NEAR + LEFT/RIGHT + C/D = THROW   C/D = THROW TECH   UP UP = HOP"></div>
        <div data-pixel-text="DOWN UP = SUPER JUMP   RIGHT RIGHT = DASH   LEFT LEFT = BACK STEP"></div>
        <div data-pixel-text="QCF + A/C = PROJECTILE   F,D,DF + A/C = ANTI AIR   ABC = MAX"></div>
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
        this.handleGlobalKeydown = this.handleGlobalKeydown.bind(this);
        this.fitViewport = this.fitViewport.bind(this);
        $(window).on('resize.kof-fit', this.fitViewport);
        this.fitViewport();
        document.addEventListener('keydown', this.handleGlobalKeydown, true);
        this.showTitle();
        this.mobileController = new MobileController(this);
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
        this.pixelizeUi();
    }

    drawPixelCanvas(canvas, text, options = {}) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;
        drawPixelText(ctx, text, options.x ?? canvas.width / 2, options.y ?? 4, {
            scale: options.scale || 2,
            align: options.align || 'center',
            color: options.color || '#efe8c0',
            shadowColor: options.shadowColor || '#000000',
            shadowOffset: options.shadowOffset ?? 1,
        });
    }

    pixelizeUi() {
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
        this.$kof.find('[data-pixel-text]').each((_, element) => {
            const $element = $(element);
            if ($element.find('canvas').length) return;
            const text = String($element.data('pixel-text') || '').toUpperCase();
            const scale = Number($element.data('pixel-scale')) || (text.length > 34 ? 1 : 2);
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(32, (text.length * 6 + 2) * scale);
            canvas.height = 8 * scale + 2;
            canvas.className = 'kof-inline-pixel';
            this.drawPixelCanvas(canvas, text, { x: 1, y: 1, scale, align: 'left' });
            $element.empty().append(canvas);
        });
        this.$kof.find('[data-pixel-key]').each((_, element) => {
            const $element = $(element);
            if ($element.find('canvas').length) return;
            const text = String($element.data('pixel-key') || '').toUpperCase();
            const scale = text.length > 3 ? 1 : 2;
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(18, (text.length * 6 + 3) * scale);
            canvas.height = 18;
            canvas.className = 'kof-key-pixel';
            this.drawPixelCanvas(canvas, text, { scale, color: '#ffffff', y: scale === 1 ? 5 : 2 });
            $element.empty().append(canvas);
        });
        this.refreshMenuPixels();
    }

    refreshMenuPixels() {
        this.$kof.find('.kof-menu-button').each((_, element) => {
            const $button = $(element);
            const active = $button.hasClass('kof-menu-active');
            $button.find('canvas[data-menu-line]').each((__, canvas) => {
                this.drawPixelCanvas(canvas, canvas.dataset.text, {
                    scale: Number(canvas.dataset.scale) || 2,
                    color: active ? '#f7df34' : (canvas.dataset.kind === 'sub' ? '#a9a588' : '#efe8c0'),
                    y: canvas.dataset.kind === 'sub' ? 3 : 2,
                });
            });
        });
    }

    menuButton(label, sublabel, attrs = '') {
        const main = String(label).toUpperCase();
        const sub = String(sublabel || '').toUpperCase();
        return `<button class="kof-menu-button" ${attrs} aria-label="${main}">
            <canvas data-menu-line data-kind="main" data-text="${main}" data-scale="3" width="300" height="26"></canvas>
            ${sub ? `<canvas data-menu-line data-kind="sub" data-text="${sub}" data-scale="1" width="300" height="12"></canvas>` : ''}
        </button>`;
    }

    bindArcadeMenu(selector, onChoose, onBack = null) {
        const $items = this.$kof.find(selector);
        let cursor = 0;
        const render = () => {
            $items.removeClass('kof-menu-active');
            $items.eq(cursor).addClass('kof-menu-active');
            this.refreshMenuPixels();
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
                ${this.menuButton('1 PLAYER', 'VS CPU', 'data-mode="one"')}
                ${this.menuButton('2 PLAYERS', 'VS PLAYER', 'data-mode="two"')}
            </div>
            <div class="kof-flow-note" data-pixel-text="UP / DOWN  SELECT   ENTER  DECIDE"></div>
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
                    ${this.menuButton('ARCADE', '1 VS CPU', 'data-battle="arcade"')}
                    ${this.menuButton('TRAINING', '1 VS DUMMY', 'data-battle="training"')}
                ` : `
                    ${this.menuButton('SINGLE BATTLE', '1 VS 1', 'data-battle="single"')}
                    ${this.menuButton('TEAM BATTLE', '3 VS 3', 'data-battle="team"')}
                `}
            </div>
            <button class="kof-text-button kof-back"><span data-pixel-text="< BACK"></span></button>
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
                ${this.menuButton('EASY', 'SLOW REACTION  FEWER ATTACKS', 'data-difficulty="easy"')}
                ${this.menuButton('NORMAL', 'CLASSIC ARCADE BALANCE', 'data-difficulty="normal"')}
                ${this.menuButton('HARD', 'FAST REACTION  MORE PRESSURE', 'data-difficulty="hard"')}
            </div>
            <button class="kof-text-button kof-back"><span data-pixel-text="< BACK"></span></button>
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
        const p2Note = this.playerMode === 'one' ? '<div class="kof-cpu-note" data-pixel-text="PLAYER 2 IS CPU CONTROLLED IN THIS MODE"></div>' : '';
        this.setOverlay(`
            <div class="kof-flow-title compact">CONTROLS</div>
            ${CONTROLS_HTML}
            ${p2Note}
            ${this.menuButton('CONTINUE', 'ENTER', 'data-continue')}
        `);
        const next = () => {
            this.clearScreenEvents();
            this.resetSelection();
            this.show_character_select();
        };
        this.$kof.find('[data-continue]').on('click', next);
        this.$kof.find('[data-continue]').addClass('kof-menu-active');
        this.refreshMenuPixels();
        $(document).on('keydown.kof-screen', event => {
            if (event.key === 'Enter') next();
            if (event.key === 'Escape') {
                if (this.playerMode === 'one' && this.matchKind === 'single' && this.cpuDifficulty !== 'dummy') this.showDifficulty();
                else this.showBattleMode();
            }
        });
    }

    handleGlobalKeydown(event) {
        if (!this.game_map || this.game_map.phase === 'match-over') return;
        if (event.repeat) return;
        if (event.key === 'Escape' || event.key === 'p' || event.key === 'P') {
            event.preventDefault();
            event.stopImmediatePropagation();
            this.togglePause();
            return;
        }
        if (event.key === '?' || event.key === 'h' || event.key === 'H') {
            event.preventDefault();
            event.stopImmediatePropagation();
            this.toggleHelp();
            return;
        }
        if (this.pauseOpen && (event.key === 't' || event.key === 'T')) {
            event.preventDefault();
            event.stopImmediatePropagation();
            window.location.reload();
        }
    }

    togglePause() {
        if (!this.game_map || this.game_map.phase === 'match-over') return;
        if (this.helpOpen) this.toggleHelp();
        this.pauseOpen = !this.pauseOpen;
        this.game_map.paused = this.pauseOpen;
        this.$kof.find('.kof-pause-overlay').remove();
        if (!this.pauseOpen) {
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
                <div class="kof-move-list" data-pixel-text="UNIVERSAL  GUARD  CROUCH  AIR ATTACK  THROW  HOP  DASH"></div>
                <div class="kof-move-list" data-pixel-text="KYO / MAI  QCF PROJECTILE  F,D,DF ANTI AIR  QCB RUSH  QCF QCF SUPER"></div>
                ${this.menuButton('CLOSE', 'H / ?', 'data-close-help')}
            </div>
        `));
        this.pixelizeUi();
        this.$kof.find('[data-close-help]').on('click', () => this.toggleHelp());
        this.$kof.find('[data-close-help]').addClass('kof-menu-active');
        this.refreshMenuPixels();
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
            const status = cpu
                ? `CPU  ${picks.join(' / ') || 'AUTO'}`
                : `${player + 1}P  ${picks.join(' / ') || '---'}  ${picks.length}/${required} > ${cursorName}`;
            const $status = this.$kof.find(`.kof-select-p${player + 1}`);
            $status.attr('data-pixel-text', status).empty();
        }
        const focus = ROSTER[this.selectionCursor[0]];
        const moves = MOVE_SUMMARIES[focus.asset] || [];
        this.$kof.find('.kof-select-move-title').attr('data-pixel-text', `${focus.name}  ${focus.style}`).empty();
        this.$kof.find('.kof-select-moves').html(moves.map(move => `<span data-pixel-text="${move}"></span>`).join(''));
        this.pixelizeUi();
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
            const weightedPool = [];
            ROSTER.forEach((fighter, index) => {
                if (index === playerIndex) return;
                const weight = fighter.asset === playerAsset ? 1 : 4;
                for (let i = 0; i < weight; i++) weightedPool.push(index);
            });
            const choice = weightedPool[Math.floor(Math.random() * weightedPool.length)] ?? ((playerIndex + 1) % ROSTER.length);
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
        const cards = ROSTER.map((fighter, index) => `<div class="kof-select-card" data-roster-index="${index}" data-asset="${fighter.asset}"><span data-pixel-text="${fighter.name}" data-pixel-scale="2"></span></div>`).join('');
        this.setOverlay(`
            <div class="kof-select-title">SELECT ${required === 1 ? 'FIGHTER' : '3 FIGHTERS'}</div>
            <div class="kof-select-grid">${cards}</div>
            <div class="kof-select-status"><span class="kof-select-p1"></span><span class="kof-select-p2"></span></div>
            <div class="kof-select-move-panel">
                <strong class="kof-select-move-title"></strong>
                <div class="kof-select-moves"></div>
            </div>
            <div class="kof-select-help" data-pixel-text="A / D MOVE  F DECIDE${this.playerMode === 'two' ? '   2P LEFT / RIGHT MOVE  ENTER DECIDE' : ''}"></div>
        `, 'kof-character-select');
        this.render_character_select();
        $(document).on('keydown.kof-select', event => {
            if (event.key === 'Escape') {
                event.preventDefault();
                $(document).off('keydown.kof-select');
                this.showControls();
                return;
            }
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
        this.pixelizeUi();
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
