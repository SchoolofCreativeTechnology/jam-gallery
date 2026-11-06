# Devlog

Your record of the jam, in your words. The devlog terminal (`claude --agent devlog`) helps you write it; you decide what goes in. On a team, initials show who decided.

## Entries

Format for each change (one change per entry):

### HH:MM: short title
- **Changed:**
- **Expected:**
- **Saw:**
- **Decided, and why (who):**

Format for each milestone check-in (M1 to M5):

### HH:MM: M# check-in
- **Expected:**
- **Saw when we played it:**
- **Next (who decided):**

Format for each playtest (after M2 and after M3):

### HH:MM: Playtest N
- **Their story:**
- **Bored or stuck:**
- **What we'll change (who decided):**

### 13:42: M1 gray box: hold to aim, release to jump
- **Changed:** Building the core hold-to-aim, release-to-jump mechanic for Way of the Whisker with simple placeholder shapes.
- **Expected:** When I hold Space, the dotted jump trajectory and landing indicator move left and right. When I release Space, the cat follows exactly the predicted trajectory and lands where the marker showed. I want accurate, responsive jumping and reliable landing detection before adding visual details, hazards, or other gameplay features.
- **Saw:** Not tested yet. This is my prediction before the first playtest, so the actual result is still unknown.
- **Decided, and why (who):** Prioritize the jump and landing over visuals, hazards, and other features, so the one action feels right first. (solo)

### 14:19: M1 check-in
- **Expected:** Holding Space moves the dotted trajectory and landing marker left and right. Releasing Space makes the cat follow the predicted trajectory exactly and land where the marker showed.
- **Saw when we played it:** Hold-to-aim and release-to-jump work, and the predicted landing direction looks accurate. Two problems: (1) the aiming sweep moves too fast, making the game harder than intended; (2) the cat sometimes falls through rooftops even when the predicted landing point is correct. Fixes not yet verified.
- **Next (who decided):** Slow the aiming sweep by about 30–40%. Fix the platform collision bug before adding more gameplay. The difficulty should come from timing and strategy, not unreliable controls or collisions. (solo)

### 14:27: M2 check-in (my own test in Chrome)
- **Expected (for the next iteration):** The cat lands reliably on valid rooftops, falls naturally onto lower rooftops when possible, and only loses when touching the floodwater. Slower flood and sliding give enough time to make meaningful jumping decisions.
- **Saw when we played it:** Hold-to-aim and release-to-jump work. Aim sweep was too fast at 2.2; at 1.4 it feels much better, though slightly faster (about 1.6) would be better. The cat still sometimes passes through rooftops even when the predicted landing point is correct; the previous collision fix did not fully resolve it. The flood rises too quickly, making the game hard to learn and enjoy. The cat slides down sloped roofs too quickly, leaving too little time to prepare the next jump. Falling or sliding off a rooftop can cause Game Over instead of falling onto a lower rooftop. Not verified by another playtest yet.
- **Next (who decided):** Raise the aim sweep to about 1.6. Prioritize fixing rooftop collision and falling behavior. Reduce the initial flood speed, keeping gradual acceleration every 10 metres of new maximum height. Reduce sloped-roof sliding speed by about 40–50%. Keep floodwater contact as the only Game Over condition. Challenge should come from timing and decision-making, not unreliable collisions or overly aggressive speeds. (solo)

## Reflection

*At the end: What did you decide that Claude didn't? What did you reject from Claude, and why? What would you do with another jam session?*

**What I decided that Claude didn't:** I created the original concept of a calico cat as a little martial arts master escaping rising floodwater in a Chinese ink-wash world. I chose the art direction, the single-button hold-and-release jump mechanic, the rising flood difficulty system, and the character design. I also decided to replace full buildings with standalone Chinese rooftops and to use my custom animated 3D cat.

**What I rejected, and why:** I rejected complicated 3D building models and individually modeled roof tiles, because they were taking too long and did not match my watercolor art direction. I chose simple 3D rooftop geometry with watercolor textures. I also decided not to add extra hazards and mechanics, so we could focus on a reliable jumping experience.

**What I would do with another session:** I would further improve the watercolor textures, polish the cat animations, add more environmental variety, and conduct more playtesting to improve game balance.

## AI Use Disclosure

*Short summary for the gallery, taken from your running log in `devlog/AI-USE-LOG.md` (not from memory at the last minute). Say what you directed yourselves, what Claude Code did in the build terminal (and its builder subagents), and what other AI tools did. List every AI-generated asset file again here, or cite the log row that names it.*

*Be accurate: neither more nor less than what happened.*

I provided the concept, creative direction, gameplay decisions, and manual playtesting.

Claude Code, with its builder subagents, implemented the gameplay, Three.js environment, physics, UI, procedural rooftops, and integration of assets. It also wrote the script that generates the three sound effects (`assets/audio/generate.js`).

OpenAI's image generation tool in ChatGPT created the three visual reference studies in `context/references/` (the game does not load these files) and the title-screen artwork, `assets/title-screen.png`.

Codex generated the custom animated 3D calico cat model, `assets/cat.glb` (idle, aim, jump, land, and fall animations), and its animation controller, `cat-controller.js`. Claude Code integrated them into the game. Codex terms for this output: unverified.

AI-generated files in the game:
- `assets/cat.glb` and `cat-controller.js` (Codex; terms unverified)
- `assets/title-screen.png` (OpenAI image generation in ChatGPT)
- `assets/audio/jump.wav`, `assets/audio/break.wav`, `assets/audio/splash.wav` (synthesized by a script Claude Code wrote)
