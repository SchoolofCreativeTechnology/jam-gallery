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

## Reflection

*At the end: What did you decide that Claude didn't? What did you reject from Claude, and why? What would you do with another jam session?*

*Translated from KZ's Chinese notes. Not yet answered: what Claude suggested that KZ rejected, and what KZ would do in another jam.*

Our game is inspired by the traditional Chinese game "勾老将 / 拔根儿" (hooking the old general, pulling up the root). It continues the theme of my earlier stop-motion work: people and nature negotiating through a game. This time I turned that into an interactive game, exploring the risky choices between persisting, conceding, and losing a leaf stalk (叶梗). The main difficulties were the stalk-hooking structure, break feedback, opponent balance, and fitting the art assets into a playable prototype. Repeated playtesting taught me that the visuals and the gameplay feedback have to be checked together.

## AI Use Disclosure

*Short summary for the gallery, taken from your running log in `devlog/AI-USE-LOG.md` (not from memory at the last minute). Say what you directed yourselves, what Claude Code did in the build terminal (and its builder subagents), and what other AI tools did. List every AI-generated asset file again here, or cite the log row that names it.*

*Be accurate: neither more nor less than what happened.*

**DRAFT (KZ to confirm the [to confirm] items; remove this label only after KZ approves)**

KZ directed the project: the concept, the game design and risk choices, art direction, choosing assets, and playtest feedback. Claude Code, in the build terminal, did the programming, debugging, and integration for milestones m1 to m4 (see git history, `5349caf` to `576df69`). [to confirm: whether builder subagents were used.] ChatGPT helped organize design notes, generate and revise some concept images, and prepare the presentation. [to confirm: whether any ChatGPT image is in the game.] OpenArt was used to generate some visual assets. [to confirm: which files.] Tripo generated 3D models used in the game: `assets/stem.glb`, `assets/stem-draco.glb`, and `assets/victory-pose-draco.glb`, with FBX sources in `assets-extracted/`. These are listed in `meta.json` and `devlog/AI-USE-LOG.md`. [to confirm: the other Tripo files in `meta.json` (`tripo-tree-king`, `tripo-duel-start`, `tripo-broken-victory`, `tripo-tree-selection`) and whether each is in the game.] The paper puppets, watercolor backgrounds, and production notes from KZ's earlier stop-motion work are KZ's own prior work. [to confirm: whether any of them are used in this game.]
