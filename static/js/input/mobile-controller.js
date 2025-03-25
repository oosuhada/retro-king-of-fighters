const MOBILE_BUTTONS = [
    { id: 'up', label: '▲', fightKey: 'w', menuKey: 'w', hold: true },
    { id: 'left', label: '◀', fightKey: 'a', menuKey: 'a', hold: true },
    { id: 'down', label: '▼', fightKey: 's', menuKey: 's', hold: true },
    { id: 'right', label: '▶', fightKey: 'd', menuKey: 'd', hold: true },
    { id: 'a', label: 'A', fightKey: 'j', menuKey: 'f', hold: false },
    { id: 'b', label: 'B', fightKey: 'k', menuKey: 'Escape', hold: false },
    { id: 'c', label: 'C', fightKey: 'u', menuKey: 'Enter', hold: false },
    { id: 'd', label: 'D', fightKey: 'i', menuKey: 'Enter', hold: false },
];

export class MobileController {
    constructor(root) {
        this.root = root;
        this.activePointers = new Map();
        this.isTouchDevice = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
        this.render();
        this.bind();
        this.updateVisibility();
        window.addEventListener('resize', () => this.updateVisibility());
        window.addEventListener('orientationchange', () => window.setTimeout(() => this.updateVisibility(), 120));
    }

    render() {
        const stage = document.querySelector('#kof-stage') || document.body;
        stage.insertAdjacentHTML('beforeend', `
            <div class="kof-mobile-controller" aria-label="Mobile game controls">
                <div class="kof-mobile-topbar">
                    <button type="button" data-mobile-command="Escape">BACK</button>
                    <button type="button" data-mobile-command="Enter">START</button>
                    <button type="button" data-mobile-command="p">PAUSE</button>
                </div>
                <div class="kof-mobile-dpad" aria-label="Direction pad">
                    <button type="button" class="up" data-mobile-button="up">▲</button>
                    <button type="button" class="left" data-mobile-button="left">◀</button>
                    <button type="button" class="down" data-mobile-button="down">▼</button>
                    <button type="button" class="right" data-mobile-button="right">▶</button>
                    <span class="center"></span>
                </div>
                <div class="kof-mobile-actions" aria-label="Attack buttons">
                    <button type="button" class="action-c" data-mobile-button="c"><span>C</span><small>HP</small></button>
                    <button type="button" class="action-d" data-mobile-button="d"><span>D</span><small>HK</small></button>
                    <button type="button" class="action-a" data-mobile-button="a"><span>A</span><small>LP</small></button>
                    <button type="button" class="action-b" data-mobile-button="b"><span>B</span><small>LK</small></button>
                </div>
            </div>
        `);
        this.controller = document.querySelector('.kof-mobile-controller');
    }

    currentTarget() {
        const canvas = this.root.game_map?.$canvas?.[0];
        return canvas || document;
    }

    isBattleActive() {
        return !!this.root.game_map;
    }

    resolveKey(button) {
        if (this.isBattleActive()) return button.fightKey;
        return button.menuKey;
    }

    dispatchKey(type, key) {
        const event = new KeyboardEvent(type, {
            key,
            bubbles: true,
            cancelable: true,
        });
        this.currentTarget().dispatchEvent(event);
    }

    pressButton(element, pointerId) {
        const config = MOBILE_BUTTONS.find(button => button.id === element.dataset.mobileButton);
        if (!config) return;
        const key = this.resolveKey(config);
        element.classList.add('pressed');
        this.dispatchKey('keydown', key);
        this.activePointers.set(pointerId, { element, key, hold: config.hold });
    }

    releaseButton(pointerId) {
        const active = this.activePointers.get(pointerId);
        if (!active) return;
        active.element.classList.remove('pressed');
        this.dispatchKey('keyup', active.key);
        this.activePointers.delete(pointerId);
    }

    bind() {
        this.controller.querySelectorAll('[data-mobile-button]').forEach(element => {
            element.addEventListener('pointerdown', event => {
                event.preventDefault();
                element.setPointerCapture?.(event.pointerId);
                this.pressButton(element, event.pointerId);
            });
            ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => {
                element.addEventListener(type, event => {
                    event.preventDefault();
                    this.releaseButton(event.pointerId);
                });
            });
        });

        this.controller.querySelectorAll('[data-mobile-command]').forEach(element => {
            element.addEventListener('pointerdown', event => {
                event.preventDefault();
                element.classList.add('pressed');
                const key = element.dataset.mobileCommand;
                this.dispatchKey('keydown', key);
                this.dispatchKey('keyup', key);
            });
            ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => {
                element.addEventListener(type, () => element.classList.remove('pressed'));
            });
        });

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) return;
            [...this.activePointers.keys()].forEach(pointerId => this.releaseButton(pointerId));
        });
    }

    updateVisibility() {
        const portrait = window.innerHeight > window.innerWidth;
        document.body.classList.toggle('kof-touch-device', this.isTouchDevice);
        document.body.classList.toggle('kof-mobile-portrait', this.isTouchDevice && portrait);
        this.root.fitViewport?.();
        this.controller.setAttribute('aria-hidden', String(!this.isTouchDevice));
    }
}
