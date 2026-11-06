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

### 13:58: Card, world, twist
- **Changed:** Arena dodger (move to dodge). World: the Pee-wee's Playhouse floor. Twist: Jambi's head has come loose, and you roll it along the path home to his box.
- **Expected:** didn't predict
- **Saw:** not built yet
- **Decided, and why (JS):** Chose it for fun and nostalgia, from two 80s things: Marble Madness and Pee-wee's Playhouse.

## Reflection

**What did you decide that Claude didn't (JS):** The concept, the flow, the character, the look and feel.

**What did you reject from Claude, and why (JS):** Some of the positioning changes, and the original level design. It wasn't fun.

**What would you do with another jam session (JS):** On this same game: polish, more interesting controls like a speed boost and jumping, and flesh out the assets so they're more organic and less geometric.

## AI Use Disclosure

**Directed by JS:** the concept, the Arena dodger card, the character, the flow, the look and feel, and the level design refinements. Rejected some of Claude's positioning changes and its original level design because they weren't fun.

**Claude Code (build terminal):** drafted the build plan from the concept and card; JS edited and approved it (commit `0e59010`). Wrote the game code (three.js, plain ES modules) for the milestones: movement, falls and restart, cars, win and timer, UI, path, audio, and an FPS overlay. Tuned difficulty after live play: car speed and placement, platform width, inclines and declines.

**Other AI tools:** none.

**AI-generated asset files:** none. The game loads no image, model, or sound files. `meta.json` `assets` and `ai_assets` are empty.

Sources: `devlog/AI-USE-LOG.md`, rows for the build plan (08:57) and the live-test tuning.
