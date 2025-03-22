import { FrameActor } from "../runtime/frame-actor.js";
import { PLAYER_CONTROLS } from '../input/fight-input.js?v=20260826-5';

export const FighterState = Object.freeze({
    IDLE: 0,
    WALK: 1,
    WALK_BACK: 2,
    JUMP: 3,
    ATTACK: 4,
    HIT: 5,
    KO: 6,
    CROUCH: 7,
    GUARD: 8,
});

const NORMAL_ATTACKS = {
    A: { damage: 7, reach: 86, height: 44, offsetY: 54, name: 'LIGHT PUNCH', level: 'mid' },
    B: { damage: 9, reach: 102, height: 50, offsetY: 96, name: 'LIGHT KICK', level: 'mid' },
    C: { damage: 14, reach: 122, height: 58, offsetY: 46, name: 'HEAVY PUNCH', level: 'mid' },
    D: { damage: 17, reach: 142, height: 56, offsetY: 90, name: 'HEAVY KICK', level: 'mid' },
};

const CROUCH_ATTACKS = {
    A: { damage: 6, reach: 78, height: 36, offsetY: 126, name: 'CROUCH A' },
    B: { damage: 8, reach: 112, height: 34, offsetY: 142, name: 'CROUCH B', level: 'low' },
    C: { damage: 12, reach: 104, height: 48, offsetY: 108, name: 'CROUCH C' },
    D: { damage: 15, reach: 150, height: 38, offsetY: 140, name: 'SWEEP', knockdown: true, level: 'low' },
};

const JUMP_ATTACKS = {
    A: { damage: 7, reach: 82, height: 46, offsetY: 72, name: 'JUMP A', level: 'high' },
    B: { damage: 9, reach: 102, height: 44, offsetY: 108, name: 'JUMP B', level: 'high' },
    C: { damage: 13, reach: 110, height: 58, offsetY: 62, name: 'JUMP C', level: 'high' },
    D: { damage: 15, reach: 124, height: 54, offsetY: 102, name: 'JUMP D', level: 'high' },
};

const ATTACK_TIMING = {
    A: { startup: 5, active: 4, total: 15, poseScaleX: 1.03, poseScaleY: 1.00, poseShift: 4 },
    B: { startup: 7, active: 5, total: 19, poseScaleX: 1.08, poseScaleY: 0.96, poseShift: 8 },
    C: { startup: 10, active: 6, total: 25, poseScaleX: 1.12, poseScaleY: 1.02, poseShift: 11 },
    D: { startup: 12, active: 7, total: 29, poseScaleX: 1.17, poseScaleY: 0.92, poseShift: 14 },
};

export class FighterActor extends FrameActor {
    constructor(root, info) {
        super();
        this.root = root;
        this.x = info.x;
        this.y = info.y;
        this.id = info.id;
        this.width = info.width;
        this.height = info.height;
        this.color = info.color;
        this.characterName = info.characterName || 'FIGHTER';
        this.profile = info.profile || {};
        this.direction = 1;
        this.vx = 0;
        this.vy = 0;
        this.walkSpeed = this.profile.walkSpeed || 400;
        this.jumpSpeed = this.profile.jumpSpeed || -1500;
        this.gravity = 50;
        this.status = FighterState.JUMP;
        this.animations = new Map();
        this.frame_current_cnt = 0;
        this.input = info.controller || this.root.game_map.input;
        this.controls = info.controls || PLAYER_CONTROLS[this.id];
        this.ctx = this.root.game_map.ctx;
        this.hp = info.hp ?? 100;
        this.power = info.power ?? 0;
        this.stocks = info.stocks ?? 0;
        this.maxModeMs = 0;
        this.comboCount = 0;
        this.comboTimer = 0;
        this.currentAttack = { ...NORMAL_ATTACKS.A, kind: 'A' };
        this.attackHit = false;
        this.cancelUsed = false;
        this.dashTime = 0;
        this.guardStunMs = 0;
        this.hitStunMs = 0;
        this.throwInvulnerableMs = 0;
        this.wakeupInvulnerableMs = 0;
        this.$hp = this.root.$kof.find(`.kof-head-hp-${this.id}>div`);
        this.$hp_div = this.$hp.find('div');
        this.$power = this.root.$kof.find(`.kof-power-${this.id}>div`);
        this.$stocks = this.root.$kof.find(`.kof-stocks-${this.id}`);
        this.$max = this.root.$kof.find(`.kof-max-${this.id}`);
    }

    start() {
        this.update_health_ui();
        this.update_power_ui();
    }

    isGroundedNeutral() {
        return [FighterState.IDLE, FighterState.WALK, FighterState.WALK_BACK, FighterState.CROUCH, FighterState.GUARD].includes(this.status);
    }

    attackProfile(kind) {
        const base = this.status === FighterState.JUMP
            ? JUMP_ATTACKS[kind]
            : this.status === FighterState.CROUCH
                ? CROUCH_ATTACKS[kind]
                : NORMAL_ATTACKS[kind];
        const isMai = this.characterName.includes('MAI');
        const tuning = isMai
            ? {
                A: { reach: -6, damage: -1, startup: -1, total: -2, poseShift: 2 },
                B: { reach: 18, damage: 0, startup: -1, total: -1, poseShift: 7 },
                C: { reach: -4, damage: 0, startup: 0, total: 0, poseShift: 3 },
                D: { reach: 24, damage: 1, startup: 1, total: 1, poseShift: 10 },
            }[kind]
            : {
                A: { reach: 4, damage: 0, startup: 0, total: 0, poseShift: 3 },
                B: { reach: 4, damage: 0, startup: 1, total: 1, poseShift: 4 },
                C: { reach: 12, damage: 2, startup: 1, total: 2, poseShift: 8 },
                D: { reach: 8, damage: 2, startup: 2, total: 2, poseShift: 8 },
            }[kind];
        return {
            ...base,
            damage: base.damage + tuning.damage,
            reach: base.reach + tuning.reach,
            characterStartupAdjust: tuning.startup,
            characterTotalAdjust: tuning.total,
            characterPoseShift: tuning.poseShift,
        };
    }

    hurtbox() {
        if (this.status === FighterState.CROUCH) {
            return { x1: this.x + 18, y1: this.y + 86, x2: this.x + this.width - 16, y2: this.y + this.height };
        }
        if (this.status === FighterState.JUMP) {
            return { x1: this.x + 20, y1: this.y + 18, x2: this.x + this.width - 20, y2: this.y + this.height - 20 };
        }
        return { x1: this.x + 12, y1: this.y + 12, x2: this.x + this.width - 12, y2: this.y + this.height };
    }

    canThrow(kind) {
        if (!['C', 'D'].includes(kind) || this.status === FighterState.JUMP) return false;
        const opponent = this.root.players[1 - this.id];
        if (!opponent || opponent.throwInvulnerableMs > 0 || opponent.status === FighterState.KO) return false;
        const c = this.controls;
        const forwardKey = this.direction > 0 ? c.right : c.left;
        const backKey = this.direction > 0 ? c.left : c.right;
        const holdingDirection = this.input.isDown(forwardKey) || this.input.isDown(backKey);
        return holdingDirection && Math.abs(opponent.x - this.x) < 118;
    }

    performThrow(kind) {
        const opponent = this.root.players[1 - this.id];
        if (!opponent) return false;
        const damage = kind === 'D' ? 20 : 18;
        this.currentAttack = { kind, name: kind === 'D' ? 'HEAVY THROW' : 'THROW', damage, throw: true, hitStopMs: 125 };
        this.status = FighterState.ATTACK;
        this.frame_current_cnt = 0;
        this.attackHit = true;
        const landed = opponent.receiveHit(damage, this.direction, { throw: true, knockdown: true });
        if (!landed) {
            this.status = FighterState.IDLE;
            this.attackHit = false;
            return false;
        }
        opponent.vx = this.direction * 420;
        opponent.vy = -260;
        opponent.throwInvulnerableMs = 650;
        this.registerHit(damage);
        this.root.show_move_name(this.id, this.currentAttack.name);
        this.root.game_map.requestHitStop(this.currentAttack.hitStopMs);
        return true;
    }

    canTechThrow() {
        return ['C', 'D'].some(kind => this.input.consumePress(this.controls.attacks[kind]));
    }

    specialFor(kind, attackKey) {
        const superMove = ['A', 'C'].includes(kind) &&
            this.stocks > 0 &&
            this.input.consumeCommand(this.controls, this.direction, ['down', 'forward', 'down', 'forward'], attackKey, 900);
        if (superMove) {
            const maxSuper = this.maxModeMs > 0 && this.stocks > 1;
            this.stocks -= maxSuper ? 2 : 1;
            this.update_power_ui();
            this.root.game_map.triggerSuperFlash(this.id, maxSuper ? 420 : 300);
            return {
                name: maxSuper
                    ? (this.characterName.includes('MAI') ? 'MAX CHO HISSATSU SHINOBI BACHI' : 'MAX OROCHINAGI')
                    : (this.characterName.includes('MAI') ? 'CHO HISSATSU SHINOBI BACHI' : 'URA 108 SHIKI: OROCHINAGI'),
                bonusDamage: maxSuper ? 44 : 30,
                reachScale: maxSuper ? 1.75 : 1.55,
                lunge: 300,
            };
        }

        if (['A', 'C'].includes(kind) && this.input.consumeCommand(this.controls, this.direction, ['forward', 'down', 'forward'], attackKey, 620)) {
            return {
                name: this.characterName.includes('MAI') ? 'HISSATSU SHINOBI BACHI' : '100 SHIKI: ONIYAKI',
                bonusDamage: 13,
                reachScale: 1.2,
                launch: -480,
            };
        }

        if (['A', 'C'].includes(kind) && this.input.consumeCommand(this.controls, this.direction, ['down', 'forward'], attackKey, 560)) {
            this.addPower(6);
            const isMai = this.characterName.includes('MAI');
            return {
                name: isMai ? 'KACHOSEN' : '108 SHIKI: YAMI BARAI',
                bonusDamage: 5,
                reachScale: 1,
                projectile: {
                    speed: this.profile.projectileSpeed || (isMai ? 560 : 650),
                    damage: Math.floor((isMai ? 14 : 16) * (this.profile.specialScale || 1)),
                    width: isMai ? 58 : 74,
                    height: isMai ? 34 : 24,
                    offsetY: isMai ? 62 : 74,
                    outerColor: isMai ? '#d8f5ff' : '#fff2a0',
                    innerColor: isMai ? '#5ac8fa' : '#ff7200',
                    style: isMai ? 'fan' : 'flame',
                },
            };
        }

        if (['B', 'D'].includes(kind) && this.input.consumeCommand(this.controls, this.direction, ['down', 'back'], attackKey, 560)) {
            this.addPower(6);
            return {
                name: this.characterName.includes('MAI') ? 'RYU ENBU' : '212 SHIKI: KOTOTSUKI YO',
                bonusDamage: 11,
                reachScale: 1.25,
                lunge: 210,
            };
        }
        return null;
    }

    startAttack(kind, special) {
        const normal = this.attackProfile(kind);
        const timing = ATTACK_TIMING[kind];
        const maxMultiplier = this.maxModeMs > 0 ? 1.25 : 1;
        this.currentAttack = {
            ...normal,
            kind,
            damage: Math.max(
                1,
                Math.floor(
                    (normal.damage + (special?.bonusDamage || 0)) *
                    maxMultiplier *
                    (this.profile.damageScale || 1)
                )
            ),
            reachScale: special?.reachScale || 1,
            name: special?.name || normal.name,
            special: !!special,
            knockdown: !!normal.knockdown,
            hitStopMs: special ? 125 : ['C', 'D'].includes(kind) ? 95 : 65,
            startupFrames: Math.max(3, (special ? timing.startup - 2 : timing.startup) + (normal.characterStartupAdjust || 0)),
            activeFrames: special ? timing.active + 2 : timing.active,
            totalFrames: Math.max(11, (special ? timing.total + 5 : timing.total) + (normal.characterTotalAdjust || 0)),
            poseScaleX: special ? timing.poseScaleX + 0.08 : timing.poseScaleX,
            poseScaleY: special ? timing.poseScaleY + 0.03 : timing.poseScaleY,
            poseShift: (special ? timing.poseShift + 8 : timing.poseShift) + (normal.characterPoseShift || 0),
        };
        this.status = FighterState.ATTACK;
        this.frame_current_cnt = 0;
        this.attackHit = false;
        this.cancelUsed = false;
        this.vx = special?.lunge ? this.direction * special.lunge : 0;
        if (special?.launch) this.vy = special.launch;
        this.root.show_move_name(this.id, this.currentAttack.name);
        if (special) {
            this.root.game_map.addHitEffect(
                this.x + this.width / 2 + this.direction * 42,
                this.y + 105,
                { special: true, size: 18, life: 110 }
            );
        }

        if (special?.projectile) {
            this.root.game_map.spawnProjectile(this, {
                ...special.projectile,
                damage: Math.max(1, Math.floor(special.projectile.damage * maxMultiplier)),
            });
        }
    }

    addPower(amount) {
        if (this.stocks >= 3) {
            this.power = 100;
            this.update_power_ui();
            return;
        }
        this.power += amount;
        while (this.power >= 100 && this.stocks < 3) {
            this.power -= 100;
            this.stocks += 1;
        }
        if (this.stocks >= 3) this.power = 100;
        this.update_power_ui();
    }

    activateMaxMode() {
        if (this.stocks <= 0 || this.maxModeMs > 0) return false;
        this.stocks -= 1;
        this.maxModeMs = 20000;
        this.root.show_move_name(this.id, 'POWER MAX');
        this.root.game_map.triggerSuperFlash(this.id, 220);
        this.update_power_ui();
        return true;
    }

    registerHit(damage, projectile = false) {
        this.comboCount += 1;
        this.comboTimer = 950;
        this.addPower(projectile ? 10 : Math.max(7, Math.floor(damage * 0.8)));
        this.root.show_combo(this.id, this.comboCount);
    }

    update_control() {
        if (!this.root.game_map.can_fight) {
            this.vx = 0;
            return;
        }
        const c = this.controls;
        const forwardKey = this.direction > 0 ? c.right : c.left;
        const backKey = this.direction > 0 ? c.left : c.right;
        const forward = this.input.isDown(forwardKey);
        const back = this.input.isDown(backKey);
        const down = this.input.isDown(c.down);
        const up = this.input.isDown(c.up);

        if (
            this.input.consumeChord(
                [c.attacks.A, c.attacks.B, c.attacks.C],
                `max-${this.id}`
            ) &&
            this.activateMaxMode()
        ) {
            this.vx = 0;
            return;
        }

        if (this.status === FighterState.ATTACK && this.currentAttack.throw) return;

        if (this.status === FighterState.ATTACK && this.attackHit && !this.cancelUsed) {
            for (const kind of ['A', 'B', 'C', 'D']) {
                const attackKey = c.attacks[kind];
                if (this.input.consumePress(attackKey)) {
                    const nextSpecial = this.specialFor(kind, attackKey);
                    const canCancel = nextSpecial || ['A', 'B'].includes(this.currentAttack.kind) && ['C', 'D'].includes(kind);
                    if (!canCancel) return;
                    this.cancelUsed = true;
                    this.startAttack(kind, nextSpecial);
                    this.cancelUsed = true;
                    return;
                }
            }
        }

        if (this.guardStunMs > 0 || this.hitStunMs > 0) return;

        if (this.status === FighterState.JUMP) {
            for (const kind of ['A', 'B', 'C', 'D']) {
                const attackKey = c.attacks[kind];
                if (this.input.consumePress(attackKey)) {
                    this.startAttack(kind, null);
                    return;
                }
            }
            return;
        }

        if (!this.isGroundedNeutral()) return;

        for (const kind of ['A', 'B', 'C', 'D']) {
            const attackKey = c.attacks[kind];
            if (this.input.consumePress(attackKey)) {
                if (this.canThrow(kind) && this.performThrow(kind)) return;
                this.startAttack(kind, this.specialFor(kind, attackKey));
                return;
            }
        }

        if (this.input.consumeCommand(c, this.direction, ['forward', 'forward'], null, 280, true)) {
            this.dashTime = 170;
            this.vx = this.direction * 720;
            this.status = FighterState.WALK;
            return;
        }
        if (this.input.consumeCommand(c, this.direction, ['back', 'back'], null, 280, true)) {
            this.dashTime = 140;
            this.vx = -this.direction * 620;
            this.vy = -210;
            this.status = FighterState.JUMP;
            return;
        }

        if (this.input.consumeCommand(c, this.direction, ['down', 'up'], null, 360, true)) {
            this.status = FighterState.JUMP;
            this.vy = this.jumpSpeed * 1.2;
            this.vx = forward ? this.direction * this.walkSpeed * 1.45 : back ? -this.direction * this.walkSpeed * 1.15 : 0;
            this.frame_current_cnt = 0;
            this.root.show_move_name(this.id, 'SUPER JUMP');
            return;
        }
        if (this.input.consumeCommand(c, this.direction, ['up', 'up'], null, 260, true)) {
            this.status = FighterState.JUMP;
            this.vy = this.jumpSpeed * 0.72;
            this.vx = forward ? this.direction * this.walkSpeed * 1.08 : back ? -this.direction * this.walkSpeed * 0.9 : 0;
            this.frame_current_cnt = 0;
            this.root.show_move_name(this.id, 'HOP');
            return;
        }

        if (down) {
            this.status = FighterState.CROUCH;
            this.vx = 0;
        } else if (back) {
            this.status = FighterState.WALK_BACK;
            this.vx = -this.direction * this.walkSpeed * 0.78;
        } else if (up) {
            this.status = FighterState.JUMP;
            this.vy = this.jumpSpeed;
            this.vx = forward ? this.direction * this.walkSpeed : back ? -this.direction * this.walkSpeed : 0;
            this.frame_current_cnt = 0;
        } else if (forward) {
            this.status = FighterState.WALK;
            this.vx = this.direction * this.walkSpeed;
        } else {
            this.status = FighterState.IDLE;
            this.vx = 0;
        }
    }

    update_move() {
        if (this.dashTime > 0) {
            this.dashTime -= this.timedelta;
            if (this.dashTime <= 0 && this.isGroundedNeutral()) this.vx = 0;
        }

        this.vy += this.gravity;
        this.x += this.vx * this.timedelta / 1000;
        this.y += this.vy * this.timedelta / 1000;

        if (this.y > 450) {
            this.y = 450;
            this.vy = 0;
            if (this.status === FighterState.JUMP) this.status = FighterState.IDLE;
        }
        this.x = Math.max(0, Math.min(this.root.game_map.$canvas.width() - this.width, this.x));
        const opponent = this.root.players[1 - this.id];
        if (opponent && this.status !== FighterState.JUMP && opponent.status !== FighterState.JUMP) {
            const minGap = 74;
            const center = this.x + this.width / 2;
            const otherCenter = opponent.x + opponent.width / 2;
            const gap = Math.abs(center - otherCenter);
            if (gap < minGap) {
                const correction = (minGap - gap) / 2;
                this.x += center < otherCenter ? -correction : correction;
                this.x = Math.max(0, Math.min(this.root.game_map.$canvas.width() - this.width, this.x));
            }
        }
    }

    update_direction() {
        if ([FighterState.ATTACK, FighterState.HIT, FighterState.KO].includes(this.status)) return;
        const opponent = this.root.players[1 - this.id];
        if (!opponent) return;
        this.direction = this.x < opponent.x ? 1 : -1;
    }

    receiveHit(damage, attackDirection, options = {}) {
        if (this.status === FighterState.KO) return;
        if (this.wakeupInvulnerableMs > 0) return false;
        if (options.throw && this.canTechThrow()) {
            this.throwInvulnerableMs = 420;
            this.hitStunMs = 110;
            this.vx = -attackDirection * 90;
            this.root.show_move_name(this.id, 'THROW TECH');
            this.root.game_map.requestHitStop(55);
            return false;
        }
        const backKey = this.direction > 0 ? this.controls.left : this.controls.right;
        const holdingBack = this.input.isDown(backKey) && this.direction === -attackDirection;
        const attackLevel = options.level || 'mid';
        const guardPostureOk = attackLevel === 'low'
            ? this.status === FighterState.CROUCH
            : attackLevel === 'high'
                ? this.status !== FighterState.CROUCH
                : true;
        const guarding = !options.throw && holdingBack && guardPostureOk &&
            [FighterState.GUARD, FighterState.WALK_BACK, FighterState.CROUCH, FighterState.IDLE].includes(this.status);
        const appliedDamage = guarding ? Math.max(1, Math.floor(damage * 0.15)) : damage;
        this.hp = Math.max(0, this.hp - appliedDamage);
        this.addPower(guarding ? 4 : Math.max(6, Math.floor(appliedDamage * 0.45)));
        this.frame_current_cnt = 0;

        if (guarding) {
            this.status = FighterState.GUARD;
            this.vx = attackDirection * 42;
            this.guardStunMs = options.special ? 210 : 130;
        } else {
            this.status = this.hp <= 0 ? FighterState.KO : FighterState.HIT;
            this.vx = this.hp <= 0 ? 0 : attackDirection * (options.knockdown ? 320 : 130);
            this.hitStunMs = options.knockdown ? 520 : options.special ? 300 : 210;
            if (options.knockdown) {
                this.vy = -220;
                this.wakeupInvulnerableMs = 700;
            }
        }

        this.root.game_map.addHitEffect(
            this.x + this.width / 2,
            this.y + (this.status === FighterState.CROUCH ? 130 : 82),
            { guard: guarding, special: !!options.special, size: options.special ? 38 : 27, life: options.special ? 190 : 145 }
        );

        this.update_health_ui();
        this.update_power_ui();
        if (!options.projectile) this.root.game_map.requestHitStop(guarding ? 45 : 80);
        return true;
    }

    is_collision(r1, r2) {
        return !(Math.max(r1.x1, r2.x1) > Math.min(r1.x2, r2.x2) || Math.max(r1.y1, r2.y1) > Math.min(r1.y2, r2.y2));
    }

    update_attack() {
        if (this.status !== FighterState.ATTACK || this.attackHit || this.currentAttack.throw) return;
        const animation = this.animations.get(FighterState.ATTACK);
        if (!animation) return;
        const startup = this.currentAttack.startupFrames ?? animation.att_start;
        const active = this.currentAttack.activeFrames ?? Math.max(animation.att_t, 2);
        if (this.frame_current_cnt < startup || this.frame_current_cnt >= startup + active) return;

        const opponent = this.root.players[1 - this.id];
        const reach = (this.currentAttack.reach || 100) * (this.currentAttack.reachScale || 1);
        const x = this.direction > 0 ? this.x + this.width - 16 : this.x - reach + 16;
        const hitbox = {
            x1: x,
            y1: this.y + (this.currentAttack.offsetY || 56),
            x2: x + reach,
            y2: this.y + (this.currentAttack.offsetY || 56) + (this.currentAttack.height || 50),
        };
        const hurtbox = opponent.hurtbox();

        if (this.is_collision(hitbox, hurtbox)) {
            const landed = opponent.receiveHit(this.currentAttack.damage, this.direction, {
                special: this.currentAttack.special,
                knockdown: this.currentAttack.knockdown,
                level: this.currentAttack.level || 'mid',
            });
            if (!landed) return;
            this.registerHit(this.currentAttack.damage);
            this.root.game_map.requestHitStop(this.currentAttack.hitStopMs);
            this.attackHit = true;
        }
    }

    update() {
        if (this.root.game_map.isHitStopped()) {
            this.render(false);
            return;
        }

        if (this.maxModeMs > 0) {
            this.maxModeMs = Math.max(0, this.maxModeMs - this.timedelta);
            this.update_power_ui();
        }
        if (this.comboTimer > 0) {
            this.comboTimer -= this.timedelta;
            if (this.comboTimer <= 0) {
                this.comboCount = 0;
                this.root.show_combo(this.id, 0);
            }
        }
        this.guardStunMs = Math.max(0, this.guardStunMs - this.timedelta);
        this.hitStunMs = Math.max(0, this.hitStunMs - this.timedelta);
        this.throwInvulnerableMs = Math.max(0, this.throwInvulnerableMs - this.timedelta);
        this.wakeupInvulnerableMs = Math.max(0, this.wakeupInvulnerableMs - this.timedelta);
        this.update_direction();
        this.update_control();
        this.update_move();
        this.update_attack();
        this.render();
    }

    update_health_ui() {
        this.$hp_div.stop(true).css('width', `${this.hp}%`);
    }

    update_power_ui() {
        if (this.$power) this.$power.css('width', `${this.power}%`);
        if (this.$stocks) this.$stocks.text('●'.repeat(this.stocks) + '○'.repeat(3 - this.stocks));
        if (this.$max) this.$max.text(this.maxModeMs > 0 ? `MAX ${Math.ceil(this.maxModeMs / 1000)}` : '');
    }

    render(advanceFrame = true) {
        let animationStatus = this.status;
        if (this.status === FighterState.WALK && this.direction * this.vx < 0) animationStatus = FighterState.WALK_BACK;
        if (this.status === FighterState.CROUCH || this.status === FighterState.GUARD) animationStatus = FighterState.IDLE;
        const animation = this.animations.get(animationStatus);

        if (animation?.loaded) {
            const isAttack = this.status === FighterState.ATTACK;
            const attackProgress = isAttack
                ? Math.min(1, this.frame_current_cnt / Math.max(1, this.currentAttack.totalFrames || 1))
                : 0;
            const frame = isAttack
                ? Math.min(
                    animation.frame_cnt - 1,
                    Math.floor(
                        (this.currentAttack.kind === 'A' ? 0.00 : this.currentAttack.kind === 'B' ? 0.18 : this.currentAttack.kind === 'C' ? 0.38 : 0.58) * animation.frame_cnt +
                        attackProgress * animation.frame_cnt * (this.currentAttack.special ? 0.42 : 0.30)
                    ) % Math.max(1, animation.frame_cnt)
                )
                : parseInt(this.frame_current_cnt / animation.frame_rate) % animation.frame_cnt;
            const image = animation.gif.frames[frame].image;
            const poseScaleX = isAttack ? (this.currentAttack.poseScaleX || 1) : 1;
            const poseScaleY = isAttack ? (this.currentAttack.poseScaleY || 1) : 1;
            const poseShift = isAttack ? (this.currentAttack.poseShift || 0) : 0;
            const drawX = this.x + this.direction * poseShift;
            const drawY = this.y + animation.offset_y;
            const drawWidth = image.width * animation.scale * poseScaleX;
            const drawHeight = image.height * animation.scale * poseScaleY;

            const drawPose = (alpha = 1, trailOffset = 0) => {
                this.ctx.save();
                this.ctx.globalAlpha = alpha;
                this.ctx.imageSmoothingEnabled = false;
                if (this.direction === 1) {
                    this.ctx.drawImage(image, drawX - trailOffset, drawY, drawWidth, drawHeight);
                } else {
                    this.ctx.scale(-1, 1);
                    this.ctx.translate(-this.root.game_map.$canvas.width(), 0);
                    this.ctx.drawImage(
                        image,
                        this.root.game_map.$canvas.width() - drawX - this.width - trailOffset,
                        drawY,
                        drawWidth,
                        drawHeight
                    );
                }
                this.ctx.restore();
            };

            if (isAttack && (this.currentAttack.special || ['C', 'D'].includes(this.currentAttack.kind))) {
                drawPose(this.currentAttack.special ? 0.16 : 0.10, this.direction * 18);
                drawPose(this.currentAttack.special ? 0.24 : 0.14, this.direction * 9);
            }
            drawPose(1, 0);

            if (this.status === FighterState.ATTACK && this.currentAttack.special) {
                this.ctx.save();
                this.ctx.globalAlpha = 0.48;
                const isMai = this.characterName.includes('MAI');
                this.ctx.fillStyle = isMai ? '#bff6ff' : '#ffd34f';
                const effectX = this.direction > 0 ? this.x + this.width - 4 : this.x - 52;
                const effectY = this.y + 58;
                if (isMai) {
                    this.ctx.fillRect(effectX, effectY, 64, 5);
                    this.ctx.fillRect(effectX + (this.direction > 0 ? 12 : -12), effectY + 11, 48, 4);
                    this.ctx.fillRect(effectX + (this.direction > 0 ? 22 : -22), effectY + 20, 34, 3);
                } else {
                    this.ctx.fillRect(effectX, effectY, 54, 8);
                    this.ctx.fillRect(effectX + (this.direction > 0 ? 12 : -12), effectY - 8, 30, 6);
                    this.ctx.fillRect(effectX + (this.direction > 0 ? 18 : -18), effectY + 12, 38, 5);
                }
                this.ctx.restore();
            }

            if (this.status === FighterState.ATTACK && this.frame_current_cnt >= (this.currentAttack.totalFrames || animation.frame_rate * animation.frame_cnt)) {
                this.status = FighterState.IDLE;
                this.vx = 0;
            } else if ([FighterState.HIT, FighterState.KO].includes(this.status) && this.frame_current_cnt === animation.frame_rate * (animation.frame_cnt - 1)) {
                if (this.status === FighterState.KO) this.frame_current_cnt--;
                else this.status = FighterState.IDLE;
            }
        }
        if (advanceFrame) this.frame_current_cnt++;
    }
}
