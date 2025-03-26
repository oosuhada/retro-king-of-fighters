import {FighterActor} from './fighter-actor.js?v=20260826-8';
import {GIF} from '../utils/gif.js';

export class MaiFighter extends FighterActor {
    constructor(root, info) {
        super(root, info);

        this.init_animations();
        this.init_attack_animations();
    }

    init_animations() {
        let outer = this;
        let offset = [0, -22, -22, -140, -110, 0, 0];

        let r1 = {
            x1: 150,
            y1: 40,
            x2: 60,
            y2: 20,
        };
        let r2 = {
            x1: - 150 - 60,
            y1: 40,
            x2: 60,
            y2: 20,
        }

        for(let i = 0; i < 7; i++) {
            let gif = GIF();
            gif.load(`static/images/player/mai/${i}.gif`);
            this.animations.set(i, {
                gif : gif,
                frame_cnt : 0,
                frame_rate : 5,
                offset_y : offset[i],
                loaded : false,
                scale : 2.1,
                attack_r1: r1,
                attack_r2: r2,
                att_start : 20,
                att_t : 20,
                att_v : 17,
                att_hp : 2,
            });

            gif.onload = function () {
                let obj = outer.animations.get(i);
                obj.frame_cnt = gif.frames.length;
                obj.loaded = true;

                if(i === 0){
                    obj.frame_rate = 6;
                }

                if (i === 3) {
                    //move quicker when jumping
                    obj.frame_rate = 6;
                }

                if(i === 4){
                    obj.frame_rate = 3;
                }
            }
        }
    }

    init_attack_animations() {
        const names = [
            'stand-a', 'stand-b', 'stand-c', 'stand-d',
            'crouch-a', 'crouch-b', 'crouch-c', 'crouch-d',
            'jump-a', 'jump-b', 'jump-c', 'jump-d',
            'special-projectile', 'special-rush', 'special-dive',
        ];
        const scaleByName = {
            'stand-a': 2.12,
            'stand-b': 1.98,
            'stand-c': 1.88,
            'stand-d': 2.00,
            'crouch-a': 1.92,
            'crouch-b': 1.98,
            'crouch-c': 1.55,
            'crouch-d': 1.62,
            'jump-a': 1.78,
            'jump-b': 1.76,
            'jump-c': 1.92,
            'jump-d': 1.78,
            'special-projectile': 1.84,
            'special-rush': 1.62,
            'special-dive': 1.92,
        };
        names.forEach(name => {
            const gif = GIF();
            gif.load(`static/images/player/mai/attacks/${name}.gif?v=20260826-8`);
            const scale = scaleByName[name] || 1.9;
            const animation = {
                gif,
                frame_cnt: 0,
                frame_rate: 2,
                offset_y: Math.round(200 - 174 * scale),
                loaded: false,
                scale,
            };
            this.attackAnimations.set(name, animation);
            gif.onload = () => {
                animation.frame_cnt = gif.frames.length;
                animation.loaded = true;
            };
        });
    }
}
