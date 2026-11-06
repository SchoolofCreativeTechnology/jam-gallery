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

### 13:48: Jump keys and double jump
- **Changed:** Space, Up, and W all jump. Added a double jump: a second jump when the jump button is pressed again quickly.
- **Expected:** A quick second press makes the second jump go twice as high as a single jump.
- **Saw:** Double jump works well. The second jump went twice as high as the first. Space, Up, and W all jump.
- **Decided, and why (RF):** Double jump makes the game more interactive and can help dodge monsters.

### 14:05: Ka Blam font
- **Changed:** Added HTML/CSS for the Ka Blam font (dafont.com/ka-blam, by imagex) to fix illegible text. License on the site: free for personal use; commercial use needs contact at contact@imagex-fonts.com.
- **Expected:** Font outlined and legible.
- **Saw:** Black fill, and we can't read it.
- **Decided, and why (KR):** Fits our retro game vibe.

### 15:59: Body font, weight, and colors
- **Changed:** Body font changed, with weight and colors adjusted. Ka Blam stays on headings.
- **Expected:** Fonts more legible and colorful, like a comic book.
- **Saw:** The text stayed the same. Neither happened.
- **Decided, and why (KR):** The bigger display font was hard to read.

### 15:59: Stylized obstacles instead of squares
- **Changed:** Claude first made the obstacles squares. We changed them to flying scissors and stars.
- **Expected:** Didn't predict.
- **Saw:** The scissors and stars played well when tested.
- **Decided, and why (VR, RF):** Stylized obstacles add to the style and interest of the gameplay.

## Reflection

*At the end: What did you decide that Claude didn't? What did you reject from Claude, and why? What would you do with another jam session?*

**What did you decide that Claude didn't?** We decided all gameplay and visual elements. Claude decided none of it. Claude only handled the coding.

**What did you reject from Claude, and why?** We rejected the square obstacles because they were boring.

**What would you do with another jam session?** We would be more strict and specific with context and gameplay from the get-go. We would start out building the functionality and then progress to a fully built and stylized world.

## AI Use Disclosure

*Short summary for the gallery, taken from your running log in `devlog/AI-USE-LOG.md` (not from memory at the last minute). Say what you directed yourselves, what Claude Code did in the build terminal (and its builder subagents), and what other AI tools did. List every AI-generated asset file again here, or cite the log row that names it.*

*Be accurate: neither more nor less than what happened.*

Lucid Ink was made by VR, KR, and RF in the Anthropic Game Jam, using Claude Code. The team decided the card (Card 2: Jumper/Runner, extended with stomp and slash), the game design, the characters, fonts, colors, and obstacle style. They rejected and reworked several of Claude's suggestions, including the first square obstacles, which became flying scissors and stars. Claude Code (the build terminal, jam-companion) and its agents wrote all of the game code and drew all of the art in code. The makers directed the gameplay and design.

- **Planning:** Imra, the makers' personal vault AI agent (Gemini 3.8 Flash, a separate project), used Socratic questioning to help develop the ideas and helped write the context files (12:30 and 12:43 in the log). The team came up with all of the ideas.
- **Visual references:** ChatGPT (6.1 sol light and 5.6 sol) made 20 comic mockups, used only as visual references. None are in the shipped game.
- **Game assets:** No AI-generated images, sound, or 3D models are in the game (`ai_assets` in `meta.json` is empty). The one asset file is the Ka Blam font, which is not AI-generated; its source and license are in `meta.json`.
- **Plan block:** The build terminal wrote the plan answers into `context/` and drafted `context/BUILD-PLAN.md`. The makers edited and approved it (git log shows when, first in the 12:55 commit).
