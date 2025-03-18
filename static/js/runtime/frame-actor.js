let frameActors = [];

class FrameActor {
    constructor() {
        frameActors.push(this);

        this.timedelta = 0;
        this.has_call_start = false;
    }

    start(){
        //work when init
        
    }

    update() {
        //work every frame(except 1st frame)
    }

    destroy() {
        //delete current object
        for(let i in frameActors){
            if(frameActors[i] === this){
                frameActors.splice(i, 1);
                break;
            }
        }
    }
}

let last_timestamp;

let GAME_OBJECT_FRAME = (timestamp) => {
    for(let obj of frameActors){
        if(!obj.has_call_start){
            obj.start();
            obj.has_call_start = true;
        }else{
            obj.timedelta = timestamp - last_timestamp;  //in ms
            obj.update();
        }
    }

    last_timestamp = timestamp;

    requestAnimationFrame(GAME_OBJECT_FRAME);
}

requestAnimationFrame(GAME_OBJECT_FRAME);


export {
    FrameActor
}
