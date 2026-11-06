// The game's sound, synthesized in the browser with the Web Audio API: a low rail rumble that breathes,
// wheel clacks on the rail joints, and four short cues. No files, no imports — every sound is built from
// oscillators and one generated noise buffer. With no Web Audio at all this module is silent no-ops.
//
// MUSIC SEAM: build() makes a `music` bus that the whole bed hangs off. The tracks drop in there, beside
// the rumble, and the rotation only moves their gains; mute, dispose and the cues all keep working
// untouched, and the rumble's own constants can simply be lowered under them.

// --- LEVELS --------------------------------------------------------------------------------------
const MASTER_GAIN = 0.18;        // the whole game's ceiling: a late-night train, not an arcade
const MUSIC_GAIN = 0.9;          // the bed bus, and the level any real track should join at
const MUTE_GLIDE = 0.12;         // seconds for setMuted to slide to silence and back
const SILENT = 0.0001;           // an exponential ramp can never reach zero, so this stands in for it
const TAIL_SECONDS = 0.05;       // a source outlives its envelope by this, so the decay is not clipped

// --- THE BED: a rail rumble that breathes ---------------------------------------------------------
const NOISE_SECONDS = 2;         // one loop of generated noise, reused by the rumble and every burst
const RUMBLE_GAIN = 0.75;
const RUMBLE_NOISE_GAIN = 0.5;   // filtered noise carries the body of it
const RUMBLE_LOW_GAIN = 0.7;     // the very low oscillator under it: felt more than heard
const RUMBLE_LOW_TYPE = 'triangle';  // a sine that low is inaudible on a laptop speaker
const RUMBLE_FILTER_Q = 0.7;
const RUMBLE_BREATH_HZ = 0.06;   // about one filter breath per 16 s
const RUMBLE_BREATH_DEPTH = 60;  // Hz the filter drifts around the chapter's cutoff
const RUMBLE_SWELL_HZ = 0.13;
const RUMBLE_SWELL_DEPTH = 0.22; // keep under RUMBLE_GAIN, or the swell swings into silence

// --- MUSIC: four tracks on a rotation ---------------------------------------------------------------
// The one place this module reads a file, because a real track cannot be synthesized. Each track is a
// plain <audio> element streamed into the mix rather than decoded into a buffer: the longest of these
// runs nearly four minutes, and as raw samples that is tens of megabytes held in the tab for the whole
// jam. The rotation only moves gain nodes, so changing track is a crossfade with nothing to restart.
const TRACKS = [
  'assets/audio/music/stage-1-vaporware.mp3',
  'assets/audio/music/stage-2-mystical-piano.mp3',
  'assets/audio/music/stage-3-slow-piano.mp3',
  'assets/audio/music/stage-4-sirens.mp3',
];
// The four tracks ship normalised to -18 LUFS, but the master ceiling is only 0.18, so a track at unity
// would come out near -34 LUFS: present on headphones, gone on a laptop. This pushes the bed back up to
// about -28 LUFS, which is under the cues and over the rumble. It is the one number to turn by ear.
const TRACK_GAIN = 2;
const TRACK_SECONDS = 30;        // how long one track holds before the rotation moves to the next
const TRACK_GLIDE = 1.2;         // setTargetAtTime constant for the crossfade, so the next track swells in
const TRACK_LEAD = 0.05;         // a fade is scheduled a hair ahead, so its first sample is not clipped
const TRACK_FADE_OUT = 4;        // the outgoing track stays running this long, then it is paused

// --- CHAPTERS: 0 at the reference coach, 3 near home ----------------------------------------------
const CHAPTERS = 4;
const CHAPTER_MAX = CHAPTERS - 1;
const CHAPTER_GLIDE = 0.8;       // setTargetAtTime constant: a chapter settles in about 2.5 s
const RUMBLE_FILTER_HZ = [150, 182, 215, 250];    // the rumble brightens as the ride builds
const RUMBLE_LOW_HZ = [42, 46, 51, 57];           // and its floor note creeps up under it
const CLACK_INTERVAL = [0.95, 0.85, 0.75, 0.66];  // seconds between rail joints: the train gains speed
const CLACK_LEVEL = [0.5, 0.56, 0.62, 0.7];

// --- WHEEL CLACKS ---------------------------------------------------------------------------------
const CLACK_LOOKAHEAD = 0.25;    // seconds of clacks scheduled ahead of the audio clock
const CLACK_MAX_LAG = 1;         // a backgrounded tab jumps the clock: never replay a backlog of clacks
const CLACK_PAIR_GAP = 0.075;    // the two bogies cross the joint one after the other
const CLACK_BOGIES = 2;
const CLACK_JITTER = 0.18;       // ± fraction on the interval, so it never ticks like a metronome
const CLACK_LEVEL_JITTER = 0.3;  // ± fraction on the level, for the same reason
const CLACK_NOISE_GAIN = 0.28;
const CLACK_FILTER_HZ = 1500;
const CLACK_FILTER_Q = 0.9;
const CLACK_ATTACK = 0.002;
const CLACK_DECAY = 0.07;
const CLACK_THUMP_HZ = 130;
const CLACK_THUMP_GAIN = 0.22;
const CLACK_THUMP_DECAY = 0.1;
const STATION_QUIET = 3;         // clacks stop this long after the station bell: the train is standing

// --- CUES: all in C, so the four of them relate instead of being four unrelated noises -------------
// C5 is the bell, the clear answer runs G5 to C6, a wrong turn lets a low C fall away, and home lands
// on a C major chord.
const NOTES = { c3: 130.81, c4: 261.63, e4: 329.63, g4: 392, c5: 523.25, g5: 783.99, c6: 1046.5 };
const CUE_LEAD = 0.02;           // cues are scheduled a hair ahead, so their attack lands exactly

const STATION_SECONDS = 2.6;
const STATION_GAIN = 0.12;
const STATION_ATTACK = 0.004;
// A bell is inharmonic, and its high partials die first.
const STATION_PARTIALS = [
  { ratio: 1, gain: 1, decay: 1 },
  { ratio: 1.5, gain: 0.32, decay: 0.6 },
  { ratio: 2.76, gain: 0.16, decay: 0.35 },
];

const CLEAR_SECONDS = 0.42;
const CLEAR_GAIN = 0.14;
const CLEAR_ATTACK = 0.006;
const CLEAR_TYPE = 'triangle';   // brighter than a sine without being a saw
const CLEAR_GAP = 0.12;          // the two notes of it, up a fourth

const WRONG_SECONDS = 0.75;
const WRONG_GAIN = 0.16;
const WRONG_ATTACK = 0.006;
const WRONG_FROM_HZ = 98;        // it falls an octave and dies: a door closing, not a punishment
const WRONG_TO_HZ = 49;
const WRONG_AIR_SECONDS = 0.4;   // the short, low breath of the door swinging shut
const WRONG_AIR_GAIN = 0.1;
const WRONG_AIR_FILTER_HZ = 420;
const WRONG_AIR_Q = 0.7;

const HOME_SECONDS = 3.4;
const HOME_GAIN = 0.13;
const HOME_ATTACK = 0.45;        // a slow swell: the warmest and most settled of the four
const HOME_CHORD = [
  { freq: NOTES.c3, gain: 1, type: 'sine', decay: 1 },
  { freq: NOTES.c4, gain: 0.7, type: 'triangle', decay: 0.85 },
  { freq: NOTES.e4, gain: 0.55, type: 'triangle', decay: 0.85 },
  { freq: NOTES.g4, gain: 0.5, type: 'triangle', decay: 0.8 },
];

// --- ENGINE ---------------------------------------------------------------------------------------
// Every number above is local to this file rather than tuning.js: this task owns audio.js alone.

// One independent audio engine. Nothing at all is created until start() is called from a user gesture.
export function createAudio() {
  let ctx = null;
  let master = null;
  let music = null;
  let noiseBuffer = null;
  let noiseFilter = null;
  let rumbleGain = null;
  let lowOsc = null;
  let live = [];                 // the sources the build started, so dispose can stop them
  let trackEls = [];             // one <audio> per track: the browser streams them, we never hold PCM
  let trackGains = [];           // one gain per track, all on the music bus, only the current one up
  let trackReady = [];           // tracks the browser can play, so the rotation can step over the rest
  let trackIndex = 0;            // the track the rotation is on
  let trackUntil = 0;            // the context time it moves on at
  let fadingOut = -1;            // the track still falling away after a change
  let fadingUntil = 0;           // the context time that one can be paused at
  let muted = false;
  let failed = false;            // a browser with no usable Web Audio: stay silent, stop retrying
  let chapter = 0;
  let nextClackAt = 0;
  let clackQuietUntil = 0;

  const noop = () => {};

  // --- LIFECYCLE ----------------------------------------------------------------------------------

  // Called from the player's first key or tap. This is the only place an AudioContext is ever made, and
  // every way it can go wrong ends in silence rather than in an error the game would have to handle.
  function start() {
    if (failed) return;
    if (ctx) {
      resume();
      return;
    }
    const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (typeof Ctor !== 'function') {
      failed = true;
      return;
    }
    try {
      ctx = new Ctor();
      noiseBuffer = makeNoise();
      build();
    } catch (error) {
      console.warn('Audio unavailable, carrying on in silence:', error);
      teardown();
      closeContext();
      failed = true;
      return;
    }
    resume();
  }

  // A context made inside a gesture still starts suspended in some browsers, so nudge it.
  function resume() {
    if (!ctx || typeof ctx.resume !== 'function' || ctx.state !== 'suspended') return;
    try {
      const running = ctx.resume();
      if (running && typeof running.catch === 'function') running.catch(noop);
    } catch (error) {
      // A browser that will not resume is not fatal: the game keeps running, silently.
    }
  }

  // Stops every source the build started and forgets the graph. Safe on a half-built graph.
  function teardown() {
    for (const source of live) {
      try {
        source.stop();
      } catch (error) {
        // Already stopped, or never started: nothing to do either way.
      }
    }
    // Pausing the elements before dropping the references is what stops the streaming.
    for (const element of trackEls) {
      if (element) element.pause();
    }
    live = [];
    trackEls = [];
    trackGains = [];
    trackReady = [];
    fadingOut = -1;
    master = null;
    music = null;
    noiseBuffer = null;
    noiseFilter = null;
    rumbleGain = null;
    lowOsc = null;
  }

  // close() is another promise that can reject, and closing twice is not an error worth passing on.
  function closeContext() {
    const closing = ctx;
    ctx = null;
    if (!closing || typeof closing.close !== 'function') return;
    try {
      const closed = closing.close();
      if (closed && typeof closed.catch === 'function') closed.catch(noop);
    } catch (error) {
      // Never closed, or already closed: the graph is dropped either way.
    }
  }

  // Stops everything and closes the context. Calling it twice, or before start(), does nothing.
  function dispose() {
    if (!ctx) return;
    teardown();
    closeContext();
  }

  // --- THE GRAPH ----------------------------------------------------------------------------------

  // Built once, inside the user's gesture. master is the game's ceiling; music is the bed bus a real
  // track would join; the cues go straight to master so a track can never change their level. The bed
  // opens at whatever chapter is already set, so a chapter chosen before start() is never jumped out of.
  function build() {
    master = ctx.createGain();
    master.gain.value = muted ? 0 : MASTER_GAIN;
    master.connect(ctx.destination);

    music = ctx.createGain();
    music.gain.value = MUSIC_GAIN;
    music.connect(master);

    // One gain per track, all on the music bus and all silent, and one streaming element into each. The
    // rotation's current one rises as soon as the browser can play it; nothing waits on the network.
    trackEls = [];
    trackGains = [];
    trackReady = [];
    trackIndex = 0;
    trackUntil = ctx.currentTime + TRACK_SECONDS;
    fadingOut = -1;
    for (let i = 0; i < TRACKS.length; i += 1) addTrack(i);
    // Start the first track here, still inside the gesture, rather than waiting for its canplay to fire:
    // this is the play() a browser is most willing to honour, and the rest follow on their own turn.
    startCurrent();

    noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = RUMBLE_FILTER_HZ[chapter];
    noiseFilter.Q.value = RUMBLE_FILTER_Q;

    rumbleGain = ctx.createGain();
    rumbleGain.gain.value = RUMBLE_GAIN;
    noiseFilter.connect(rumbleGain);
    rumbleGain.connect(music);

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;
    const noiseLevel = ctx.createGain();
    noiseLevel.gain.value = RUMBLE_NOISE_GAIN;
    noise.connect(noiseLevel).connect(noiseFilter);

    lowOsc = ctx.createOscillator();
    lowOsc.type = RUMBLE_LOW_TYPE;
    lowOsc.frequency.value = RUMBLE_LOW_HZ[chapter];
    const lowLevel = ctx.createGain();
    lowLevel.gain.value = RUMBLE_LOW_GAIN;
    lowOsc.connect(lowLevel).connect(rumbleGain);

    // Two slow LFOs, so the rumble breathes instead of sitting flat: one opens and closes the filter,
    // the other lifts and drops the whole bed.
    const breath = ctx.createOscillator();
    breath.type = 'sine';
    breath.frequency.value = RUMBLE_BREATH_HZ;
    const breathDepth = ctx.createGain();
    breathDepth.gain.value = RUMBLE_BREATH_DEPTH;
    breath.connect(breathDepth).connect(noiseFilter.frequency);

    const swell = ctx.createOscillator();
    swell.type = 'sine';
    swell.frequency.value = RUMBLE_SWELL_HZ;
    const swellDepth = ctx.createGain();
    swellDepth.gain.value = RUMBLE_SWELL_DEPTH;
    swell.connect(swellDepth).connect(rumbleGain.gain);

    live = [noise, lowOsc, breath, swell];
    for (const source of live) source.start();
    nextClackAt = ctx.currentTime + CLACK_INTERVAL[chapter];
  }

  // Brings the rotation's current track up and lets every other one down. Safe before any track has
  // arrived, and safe on a graph that was torn down mid-fade.
  function setTrackLevels(now) {
    for (let i = 0; i < trackGains.length; i += 1) {
      const gain = trackGains[i];
      if (!gain) continue;
      gain.gain.setTargetAtTime(i === trackIndex ? TRACK_GAIN : 0, now + TRACK_LEAD, TRACK_GLIDE);
    }
  }

  // One track: an element streamed into its own gain on the music bus. Streaming instead of decoding is
  // what keeps the tab light, and it makes the track audible as soon as it has buffered rather than after
  // the whole file has arrived and been turned into samples.
  function addTrack(index) {
    const element = new Audio();
    element.src = TRACKS[index];
    element.loop = true;
    element.preload = 'auto';

    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(music);
    ctx.createMediaElementSource(element).connect(gain);

    // A track that will not load is not fatal: the rotation simply steps over it. But say so, so a silent
    // track is a line in the console rather than a mystery.
    element.addEventListener('error', () => {
      console.warn('Music track did not load; the rotation will step over it:', TRACKS[index]);
    });
    element.addEventListener('canplay', () => {
      trackReady[index] = true;
      startCurrent();
      setTrackLevels(ctx.currentTime);
    });

    trackEls.push(element);
    trackGains.push(gain);
  }

  // Starts the rotation's current track if it is not already running. A play() the browser blocks is
  // logged and left alone: the next rotation tries again, and the rumble and the cues are unaffected.
  function startCurrent() {
    const element = trackEls[trackIndex];
    if (!element || !element.paused) return;
    const playing = element.play();
    if (playing && typeof playing.catch === 'function') {
      playing.catch((error) => console.warn('Music could not start:', error));
    }
  }

  // One short buffer of white noise, looped by the rumble and re-read by every burst.
  function makeNoise() {
    const length = Math.max(1, Math.floor(ctx.sampleRate * NOISE_SECONDS));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  // --- VOICES -------------------------------------------------------------------------------------

  // The shape every short sound here shares: silence, a fast attack, an exponential decay.
  function envelope(bus, startAt, seconds, peak, attack) {
    const env = ctx.createGain();
    env.gain.setValueAtTime(SILENT, startAt);
    env.gain.linearRampToValueAtTime(peak, startAt + attack);
    env.gain.exponentialRampToValueAtTime(SILENT, startAt + seconds);
    env.connect(bus);
    return env;
  }

  // One note, optionally falling in pitch across its length, straight into a bus.
  function playNote(bus, { type, freq, startAt, seconds, peak, attack, endFreq }) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startAt);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, startAt + seconds);
    const env = envelope(bus, startAt, seconds, peak, attack);
    osc.connect(env);
    osc.start(startAt);
    osc.stop(startAt + seconds + TAIL_SECONDS);
    osc.onended = () => env.disconnect();
  }

  // A burst of the shared noise buffer through a filter: the clack's edge, the door's air.
  function playNoise(bus, { startAt, seconds, peak, attack, filterType, filterHz, q }) {
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = filterHz;
    filter.Q.value = q;
    const env = envelope(bus, startAt, seconds, peak, attack);
    source.connect(filter).connect(env);
    source.start(startAt);
    source.stop(startAt + seconds + TAIL_SECONDS);
    source.onended = () => filter.disconnect();
  }

  // One rail joint: the two bogies crossing it one after the other, over a low knock of the bogie itself.
  function playClack(startAt, level) {
    for (let bogie = 0; bogie < CLACK_BOGIES; bogie += 1) {
      const at = startAt + bogie * CLACK_PAIR_GAP;
      playNoise(music, {
        startAt: at, seconds: CLACK_DECAY, peak: CLACK_NOISE_GAIN * level, attack: CLACK_ATTACK,
        filterType: 'bandpass', filterHz: CLACK_FILTER_HZ, q: CLACK_FILTER_Q,
      });
      playNote(music, {
        type: 'sine', freq: CLACK_THUMP_HZ, startAt: at, seconds: CLACK_THUMP_DECAY,
        peak: CLACK_THUMP_GAIN * level, attack: CLACK_ATTACK,
      });
    }
  }

  // A soft bell, and the clacks stop: the train is standing at a station.
  function station(at) {
    for (const partial of STATION_PARTIALS) {
      playNote(master, {
        type: 'sine', freq: NOTES.c5 * partial.ratio, startAt: at,
        seconds: STATION_SECONDS * partial.decay, peak: STATION_GAIN * partial.gain,
        attack: STATION_ATTACK,
      });
    }
    clackQuietUntil = at + STATION_QUIET;
    nextClackAt = Math.max(nextClackAt, clackQuietUntil);
  }

  // Two small bright notes, low then high: nothing is wrong, it is just done.
  function clear(at) {
    playNote(master, {
      type: CLEAR_TYPE, freq: NOTES.g5, startAt: at, seconds: CLEAR_SECONDS,
      peak: CLEAR_GAIN, attack: CLEAR_ATTACK,
    });
    playNote(master, {
      type: CLEAR_TYPE, freq: NOTES.c6, startAt: at + CLEAR_GAP, seconds: CLEAR_SECONDS,
      peak: CLEAR_GAIN, attack: CLEAR_ATTACK,
    });
  }

  // The reset. A low note closing down onto its octave with the air of a door behind it: heavy, not harsh.
  function wrong(at) {
    playNote(master, {
      type: 'sine', freq: WRONG_FROM_HZ, endFreq: WRONG_TO_HZ, startAt: at, seconds: WRONG_SECONDS,
      peak: WRONG_GAIN, attack: WRONG_ATTACK,
    });
    playNoise(master, {
      startAt: at, seconds: WRONG_AIR_SECONDS, peak: WRONG_AIR_GAIN, attack: WRONG_ATTACK,
      filterType: 'lowpass', filterHz: WRONG_AIR_FILTER_HZ, q: WRONG_AIR_Q,
    });
  }

  // Warmer and more resolved than the others, and the only one that is a chord.
  function home(at) {
    for (const voice of HOME_CHORD) {
      playNote(master, {
        type: voice.type, freq: voice.freq, startAt: at, seconds: HOME_SECONDS * voice.decay,
        peak: HOME_GAIN * voice.gain, attack: HOME_ATTACK,
      });
    }
  }

  const CUES = { station, clear, wrong, home };

  // --- THE API ------------------------------------------------------------------------------------

  // One short, distinct cue. An unknown name is ignored, so a typo can never break a run.
  function cue(name) {
    if (!ctx) return;
    const play = CUES[name];
    if (!play) return;
    play(ctx.currentTime + CUE_LEAD);
  }

  // 0 to 3 through the run. The rumble's filter and floor note glide to the new character and the clack
  // tempo changes at the next joint, so the ride is heard to build rather than snapping between states.
  // The music is deliberately not part of this: it runs on its own rotation, independent of the ride.
  function setChapter(n) {
    const next = clampChapter(n);
    if (next === chapter) return;
    chapter = next;
    if (!ctx) return;
    const now = ctx.currentTime;
    noiseFilter.frequency.setTargetAtTime(RUMBLE_FILTER_HZ[chapter], now, CHAPTER_GLIDE);
    lowOsc.frequency.setTargetAtTime(RUMBLE_LOW_HZ[chapter], now, CHAPTER_GLIDE);
  }

  // Muting only moves the master gain, so nothing else in the graph has to know about it.
  function setMuted(flag) {
    muted = Boolean(flag);
    if (!ctx || !master) return;
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setTargetAtTime(muted ? 0 : MASTER_GAIN, now, MUTE_GLIDE);
  }

  function isMuted() {
    return muted;
  }

  // Called every frame. The Web Audio clock owns the timing; dt is here because the frame passes it.
  function update(dt) {
    if (!ctx) return;
    const now = ctx.currentTime;

    // The rotation. One track holds for TRACK_SECONDS, then the next playable one swells in underneath
    // it. Stepping only to a track the browser can actually play means a slow or failed load can never
    // leave a hole in the music.
    if (now >= trackUntil) {
      let next = -1;
      for (let step = 1; step <= TRACKS.length; step += 1) {
        const candidate = (trackIndex + step) % TRACKS.length;
        if (trackReady[candidate]) {
          next = candidate;
          break;
        }
      }
      if (next < 0) {
        trackUntil = now + 1;    // nothing has arrived yet: look again shortly rather than skip a slot
      } else {
        fadingOut = trackIndex;
        fadingUntil = now + TRACK_FADE_OUT;
        trackIndex = next;
        trackUntil = now + TRACK_SECONDS;
        startCurrent();
        setTrackLevels(now);
      }
    }

    // The outgoing track has finished falling away, so it can stop. Leaving it running through the fade
    // is what makes a change a crossfade rather than a cut.
    if (fadingOut >= 0 && now >= fadingUntil) {
      const element = trackEls[fadingOut];
      if (element && !element.paused && fadingOut !== trackIndex) element.pause();
      fadingOut = -1;
    }

    if (nextClackAt < now - CLACK_MAX_LAG) nextClackAt = now + CLACK_INTERVAL[chapter];
    while (nextClackAt < now + CLACK_LOOKAHEAD) {
      if (!muted && nextClackAt >= clackQuietUntil) playClack(nextClackAt, clackLevel());
      nextClackAt += clackInterval();
    }
  }

  // --- SMALL HELPERS ------------------------------------------------------------------------------

  function clampChapter(n) {
    const value = Math.round(Number(n));
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(CHAPTER_MAX, value));
  }

  function clackInterval() {
    return CLACK_INTERVAL[chapter] * (1 + (Math.random() - 0.5) * CLACK_JITTER);
  }

  function clackLevel() {
    return CLACK_LEVEL[chapter] * (1 + (Math.random() - 0.5) * CLACK_LEVEL_JITTER);
  }

  return { start, update, setChapter, cue, setMuted, isMuted, dispose };
}
