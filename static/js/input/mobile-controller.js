const ACTION_BUTTONS = [
    { id: 'a', fightKey: 'j', menuKey: 'f' },
    { id: 'b', fightKey: 'k', menuKey: 'Escape' },
    { id: 'c', fightKey: 'u', menuKey: 'Enter' },
    { id: 'd', fightKey: 'i', menuKey: 'Enter' },
];

const DIRECTION_KEYS = {
    up: ['w'],
    down: ['s'],
    left: ['a'],
    right: ['d'],
    'up-left': ['w', 'a'],
    'up-right': ['w', 'd'],
    'down-left': ['s', 'a'],
    'down-right': ['s', 'd'],
};

export class MobileController {
    constructor(root) {
        this.root = root;
        this.activePointers = new Map();
        this.activeDirectionKeys = new Set();
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
                    <button type="button" data-mobile-command="f">SELECT F</button>
                    <button type="button" data-mobile-command="Enter">START</button>
                    <button type="button" data-mobile-command="p">PAUSE</button>
                </div>
                <div class="kof-mobile-dpad" aria-label="8 way direction pad">
                    <button type="button" class="up-left" data-mobile-direction="up-left">↖</button>
                    <button type="button" class="up" data-mobile-direction="up">▲</button>
                    <button type="button" class="up-right" data-mobile-direction="up-right">↗</button>
                    <button type="button" class="left" data-mobile-direction="left">◀</button>
                    <span class="center"></span>
                    <button type="button" class="right" data-mobile-direction="right">▶</button>
                    <button type="button" class="down-left" data-mobile-direction="down-left">↙</button>
                    <button type="button" class="down" data-mobile-direction="down">▼</button>
                    <button type="button" class="down-right" data-mobile-direction="down-right">↘</button>
                </div>
                <div class="kof-mobile-actions" aria-label="Attack buttons">
                    <button type="button" class="action-c" data-mobile-button="c"><span>C</span><small>HP</small></button>
                    <button type="button" class="action-d" data-mobile-button="d"><span>D</span><small>HK</small></button>
                    <button type="button" class="action-a" data-mobile-button="a"><span>A</span><small>LP / F</small></button>
                    <button type="button" class="action-b" data-mobile-button="b"><span>B</span><small>LK / BACK</small></button>
                </div>
            </div>
        `);
        this.controller = document.querySelector('.kof-mobile-controller');
        this.dpad = this.controller.querySelector('.kof-mobile-dpad');
    }

    currentTarget() {
        const canvas = this.root.game_map?.$canvas?.[0];
        return canvas || document;
    }

    isBattleActive() {
        return !!this.root.game_map;
    }

    resolveActionKey(button) {
        return this.isBattleActive() ? button.fightKey : button.menuKey;
    }

    resolveDirectionKeys(direction) {
        const keys = DIRECTION_KEYS[direction] || [];
        if (this.isBattleActive()) return keys;
        return keys;
    }

    dispatchKey(type, key) {
        const event = new KeyboardEvent(type, {
            key,
            bubbles: true,
            cancelable: true,
        });
        this.currentTarget().dispatchEvent(event);
    }

    pressAction(element, pointerId) {
        const config = ACTION_BUTTONS.find(button => button.id === element.dataset.mobileButton);
        if (!config) return;
        const key = this.resolveActionKey(config);
        element.classList.add('pressed');
        this.dispatchKey('keydown', key);
        this.activePointers.set(pointerId, { type: 'action', element, keys: [key] });
    }

    releaseAction(pointerId) {
        const active = this.activePointers.get(pointerId);
        if (!active || active.type !== 'action') return;
        active.element.classList.remove('pressed');
        active.keys.forEach(key => this.dispatchKey('keyup', key));
        this.activePointers.delete(pointerId);
    }

    directionAtPoint(clientX, clientY) {
        const element = document.elementFromPoint(clientX, clientY);
        return element?.closest?.('[data-mobile-direction]')?.dataset.mobileDirection || null;
    }

    setDirection(pointerId, direction) {
        const previous = this.activePointers.get(pointerId);
        if (previous?.type === 'direction' && previous.direction === direction) return;

        if (previous?.type === 'direction') {
            previous.element?.classList.remove('pressed');
        }

        const element = direction
            ? this.dpad.querySelector(`[data-mobile-direction="${direction}"]`)
            : null;
        this.activePointers.set(pointerId, {
            type: 'direction',
            direction,
            element,
        });
        element?.classList.add('pressed');
        this.syncDirectionKeys();
    }

    releaseDirection(pointerId) {
        const active = this.activePointers.get(pointerId);
        if (!active || active.type !== 'direction') return;
        active.element?.classList.remove('pressed');
        this.activePointers.delete(pointerId);
        this.syncDirectionKeys();
    }

    syncDirectionKeys() {
        const nextKeys = new Set();
        this.activePointers.forEach(active => {
            if (active.type !== 'direction' || !active.direction) return;
            this.resolveDirectionKeys(active.direction).forEach(key => nextKeys.add(key));
        });

        this.activeDirectionKeys.forEach(key => {
            if (!nextKeys.has(key)) this.dispatchKey('keyup', key);
        });
        nextKeys.forEach(key => {
            if (!this.activeDirectionKeys.has(key)) this.dispatchKey('keydown', key);
        });
        this.activeDirectionKeys = nextKeys;
    }

    bindDpad() {
        this.dpad.addEventListener('pointerdown', event => {
            const direction = this.directionAtPoint(event.clientX, event.clientY);
            if (!direction) return;
            event.preventDefault();
            this.dpad.setPointerCapture?.(event.pointerId);
            this.setDirection(event.pointerId, direction);
        });

        this.dpad.addEventListener('pointermove', event => {
            const active = this.activePointers.get(event.pointerId);
            if (!active || active.type !== 'direction') return;
            event.preventDefault();
            this.setDirection(event.pointerId, this.directionAtPoint(event.clientX, event.clientY));
        });

        ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => {
            this.dpad.addEventListener(type, event => {
                event.preventDefault();
                this.releaseDirection(event.pointerId);
            });
        });
    }

    bindActions() {
        this.controller.querySelectorAll('[data-mobile-button]').forEach(element => {
            element.addEventListener('pointerdown', event => {
                event.preventDefault();
                element.setPointerCapture?.(event.pointerId);
                this.pressAction(element, event.pointerId);
            });
            ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => {
                element.addEventListener(type, event => {
                    event.preventDefault();
                    this.releaseAction(event.pointerId);
                });
            });
        });
    }

    bindCommands() {
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
    }

    blockSafariZoomGestures() {
        const prevent = event => event.preventDefault();
        ['gesturestart', 'gesturechange', 'gestureend'].forEach(type => {
            document.addEventListener(type, prevent, { passive: false });
        });
        document.addEventListener('dblclick', prevent, { passive: false });
        this.controller.addEventListener('touchmove', prevent, { passive: false });
    }

    bind() {
        this.bindDpad();
        this.bindActions();
        this.bindCommands();
        this.blockSafariZoomGestures();

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) return;
            [...this.activePointers.keys()].forEach(pointerId => {
                const active = this.activePointers.get(pointerId);
                if (active?.type === 'direction') this.releaseDirection(pointerId);
                if (active?.type === 'action') this.releaseAction(pointerId);
            });
        });
    }

    updateVisibility() {
        const portrait = window.innerHeight > window.innerWidth;
        document.documentElement.classList.toggle('kof-touch-device', this.isTouchDevice);
        document.body.classList.toggle('kof-touch-device', this.isTouchDevice);
        document.body.classList.toggle('kof-mobile-portrait', this.isTouchDevice && portrait);
        this.root.fitViewport?.();
        this.controller.setAttribute('aria-hidden', String(!this.isTouchDevice));
    }
}
