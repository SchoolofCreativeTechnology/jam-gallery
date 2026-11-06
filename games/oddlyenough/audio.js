// Tiny synthesized shop sounds. No downloaded assets; enabled only by the player.
export function createAudio(){
 let context,enabled=false;
 function tone(frequency,duration=.12,type='sine',gain=.06){if(!enabled)return;try{context??=new (window.AudioContext||window.webkitAudioContext)();context.resume();const o=context.createOscillator(),g=context.createGain();o.type=type;o.frequency.value=frequency;g.gain.setValueAtTime(gain,context.currentTime);g.gain.exponentialRampToValueAtTime(.001,context.currentTime+duration);o.connect(g);g.connect(context.destination);o.start();o.stop(context.currentTime+duration);}catch{enabled=false;}}
 return {toggle(){enabled=!enabled;if(enabled)tone(580,.2);return enabled;},bell(){tone(880,.4);tone(1320,.3,'sine',.025);},deal(){tone(660,.13);tone(990,.2,'triangle',.04);},inspect(){tone(220,.055,'triangle',.025);}};
}
