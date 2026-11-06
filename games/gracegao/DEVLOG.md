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

### 15:30: M1 check-in
- **Expected:** didn't predict
- **Saw when we played it:** All the checks worked, but it didn't feel like an island. It was flat and square, the water looked like blocks, there were no palm trees or shop, and the camera was too far.
- **Next (who decided):** We chose to build the day loop first and the look later. (GG)

### 15:30: M2 check-in
- **Expected:** didn't predict
- **Saw when we played it:** We couldn't stop playing. But we didn't know how much money we needed to unlock a new area, we couldn't see where the new area was, and the day ended too suddenly when the boat arrived. (Our own play only; no outside playtest happened.)
- **Next (who decided):** Added a boat that sails in with a banner, a sale summary and a sunset fade, plus a money goal and a visible locked islet. (GG)

## Reflection

*At the end: What did you decide that Claude didn't? What did you reject from Claude, and why? What would you do with another jam session?*

What I decided that Claude didn't:
- The tide is the soul of the game. Every round is a low-tide run across the beach, collecting sea treasures while dodging the waves coming back in.
- Risky wet sand and safe dry land, so the tide decides where you go.
- Gentle knockback.
- A full collect, craft, sell day, with a boat that buys what you've made.
- A money goal with a visible locked islet.
- A close camera.
- My own models: the girl and the boat, made from my ChatGPT images and turned into 3D in Tripo.

What I rejected from Claude, and why:
- It suggested one collectible. I kept all 8, because each one is an ingredient.
- It suggested building the craft and boat step later. I wanted the full loop from the start.
- It suggested a wide camera. I wanted it close.

With another jam session, I would add:
- A round island.
- Unlocking the islet.
- The dog.
- Choosing recipes.
- Music.
- The painterly Van Gogh and Monet look.

I would also cut scope earlier and do playtests on time.

## AI Use Disclosure

*Short summary for the gallery, taken from your running log in `devlog/AI-USE-LOG.md` (not from memory at the last minute). Say what you directed yourselves, what Claude Code did in the build terminal (and its builder subagents), and what other AI tools did. List every AI-generated asset file again here, or cite the log row that names it.*

*Be accurate: neither more nor less than what happened.*

I directed the concept, the card, the world, the rules, the scope and every change. Claude Code, in the build terminal with its builder subagents, wrote all the game code from my plan and my requests.

Other AI tools:
- **ChatGPT image generation:** the girl and the boat concept images. I used them as the input for Tripo.
- **Tripo (3D generator):** turned those images into the two 3D models in the game, and rigged and animated the girl (idle, walk, run). The boat is a static model, not rigged or animated. I used a paid Tripo plan, so I own the rights to these models under Tripo's terms.
- **Claude, in a separate chat (not Claude Code):** helped me understand the terminal setup, translate my ideas from Chinese to English, and draft the wording of this devlog from what I told it. I reviewed and edited all of it.

AI-generated files in the game (both also listed in `meta.json` under `ai_assets`):
- `assets/tripo_convert_68b874cf-77b5-427a-ab5d-3875b44eba50.glb` (girl)
- `assets/after_moved.glb` (boat)

Sound and music: no AI sound or music tools were used.

Non-AI models (palm trees, bushes, fruit, shells, coral, the wooden market) are free models from Poly Pizza, all credited in `meta.json`.

Full log: `devlog/AI-USE-LOG.md`.