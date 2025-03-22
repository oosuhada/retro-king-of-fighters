import { FrameActor } from '../runtime/frame-actor.js';

export class Projectile extends FrameActor {
    constructor(gameMap, owner, config) {
        super();
        this.gameMap = gameMap;
        this.owner = owner;
        this.ownerId = owner.id;
        this.direction = owner.direction;
        this.width = config.width || 72;
        this.height = config.height || 24;
        this.x = owner.direction > 0 ? owner.x + owner.width : owner.x - this.width;
        this.y = owner.y + (config.offsetY || 72);
        this.speed = config.speed || 640;
        this.damage = config.damage || 15;
        this.lifeMs = config.lifeMs || 1900;
        this.outerColor = config.outerColor || '#fff2a0';
        this.innerColor = config.innerColor || '#ff7200';
        this.style = config.style || 'flame';
        this.destroyed = false;
        this.gameMap.projectiles.push(this);
    }

    bounds() {
        return { x1: this.x, y1: this.y, x2: this.x + this.width, y2: this.y + this.height };
    }

    intersects(a, b) {
        return !(
            Math.max(a.x1, b.x1) > Math.min(a.x2, b.x2) ||
            Math.max(a.y1, b.y1) > Math.min(a.y2, b.y2)
        );
    }

    remove() {
        if (this.destroyed) return;
        this.destroyed = true;
        const index = this.gameMap.projectiles.indexOf(this);
        if (index >= 0) this.gameMap.projectiles.splice(index, 1);
        this.destroy();
    }

    update() {
        if (this.destroyed) return;
        if (this.gameMap.isHitStopped()) {
            this.render();
            return;
        }

        this.lifeMs -= this.timedelta;
        this.x += this.direction * this.speed * this.timedelta / 1000;

        const other = this.gameMap.projectiles.find(projectile =>
            projectile !== this &&
            projectile.ownerId !== this.ownerId &&
            !projectile.destroyed &&
            this.intersects(this.bounds(), projectile.bounds())
        );
        if (other) {
            other.remove();
            this.remove();
            this.gameMap.requestHitStop(55);
            return;
        }

        const opponent = this.gameMap.root.players[1 - this.ownerId];
        if (opponent) {
            const hurtbox = typeof opponent.hurtbox === 'function'
                ? opponent.hurtbox()
                : { x1: opponent.x, y1: opponent.y, x2: opponent.x + opponent.width, y2: opponent.y + opponent.height };
            if (this.intersects(this.bounds(), hurtbox)) {
                const landed = opponent.receiveHit(this.damage, this.direction, { projectile: true, special: true, level: 'mid' });
                if (landed) {
                    this.owner.registerHit(this.damage, true);
                    this.gameMap.requestHitStop(100);
                }
                this.remove();
                return;
            }
        }

        if (this.lifeMs <= 0 || this.x + this.width < 0 || this.x > this.gameMap.$canvas.width()) {
            this.remove();
            return;
        }
        this.render();
    }

    render() {
        const ctx = this.gameMap.ctx;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        const cx = Math.round(this.x + this.width / 2);
        const cy = Math.round(this.y + this.height / 2);
        const pulse = Math.floor((Date.now() / 55) % 3);
        ctx.translate(cx, cy);
        ctx.scale(this.direction, 1);
        if (this.style === 'fan') {
            ctx.rotate((pulse - 1) * 0.12);
            ctx.fillStyle = this.outerColor;
            ctx.beginPath();
            ctx.moveTo(-this.width * 0.42, 0);
            ctx.lineTo(this.width * 0.34, -this.height * 0.58);
            ctx.lineTo(this.width * 0.5, 0);
            ctx.lineTo(this.width * 0.34, this.height * 0.58);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = this.innerColor;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(-this.width * 0.34, 0);
            ctx.lineTo(this.width * 0.36, -this.height * 0.43);
            ctx.moveTo(-this.width * 0.34, 0);
            ctx.lineTo(this.width * 0.36, this.height * 0.43);
            ctx.stroke();
        } else {
            ctx.fillStyle = this.outerColor;
            ctx.beginPath();
            ctx.moveTo(-this.width * 0.58 - pulse * 3, 0);
            ctx.quadraticCurveTo(-this.width * 0.18, -this.height * 0.78, this.width * 0.5, -2);
            ctx.quadraticCurveTo(this.width * 0.16, this.height * 0.76, -this.width * 0.58 - pulse * 3, 0);
            ctx.fill();
            ctx.fillStyle = this.innerColor;
            ctx.beginPath();
            ctx.moveTo(-this.width * 0.32, 0);
            ctx.quadraticCurveTo(0, -this.height * 0.42, this.width * 0.38, 0);
            ctx.quadraticCurveTo(0, this.height * 0.40, -this.width * 0.32, 0);
            ctx.fill();
        }
        ctx.restore();
    }
}
