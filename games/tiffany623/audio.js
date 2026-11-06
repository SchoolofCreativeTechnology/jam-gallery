const sounds = {
  jump: new Audio('./assets/audio/jump.wav'),
  break: new Audio('./assets/audio/break.wav'),
  splash: new Audio('./assets/audio/splash.wav'),
};

export function play(name) {
  const s = sounds[name];
  if (!s) return;
  s.currentTime = 0;
  s.play().catch(() => {
    // Browsers may block audio until the first user gesture; ignore errors.
  });
}
