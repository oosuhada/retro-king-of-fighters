import { FighterActor } from './fighter-actor.js?v=20260826-8';
import { GIF } from '../utils/gif.js';

export class KyoFighter extends FighterActor {
    constructor(root, info) {
        super(root, info);

        this.init_animations();
        this.init_attack_animations();
    }

    init_animations() {
        let outer = this;
        let offset = [0, -22, -22, -140, 0, 0, 0];
        let r1 = {
            x1: 120,
            y1: 40,
            x2: 100,  //width
            y2: 20,   //height
        };
        let r2 = {
            x1: - 120 - 100,
            y1: 40,
            x2: 100,
            y2: 20,
        }


        for (let i = 0; i < 7; i++) {
            let gif = GIF();
            gif.load(`static/images/player/kyo/${i}.gif`);
            this.animations.set(i, {
                gif: gif,
                frame_cnt: 0,
                frame_rate: 5,
                offset_y: offset[i],
                loaded: false,
                scale: 2,
                attack_r1: r1,
                attack_r2: r2,
                att_start : 16,
                att_t : 1,
                att_v : 1,   //v on x-axis
                att_hp : 20,
            });

            gif.onload = function () {
                let obj = outer.animations.get(i);
                obj.frame_cnt = gif.frames.length;
                obj.loaded = true;

                if (i === 3) {
                    //move quicker when jumping
                    obj.frame_rate = 4;
                }
            }
        }
    }

    init_attack_animations() {
        const names = [
            'stand-a', 'stand-b', 'stand-c', 'stand-d',
            'crouch-a', 'crouch-b', 'crouch-c', 'crouch-d',
            'jump-a', 'jump-b', 'jump-c', 'jump-d',
            'special-projectile', 'special-rush',
        ];
        names.forEach(name => {
            const gif = GIF();
            gif.load(`static/images/player/kyo/attacks/${name}.gif?v=20260826-8`);
            const animation = {
                gif,
                frame_cnt: 0,
                frame_rate: 2,
                offset_y: -66,
                loaded: false,
                scale: 1.55,
            };
            this.attackAnimations.set(name, animation);
            gif.onload = () => {
                animation.frame_cnt = gif.frames.length;
                animation.loaded = true;
            };
        });
    }
}
