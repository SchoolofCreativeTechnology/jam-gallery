# ODDLY ENOUGH — Devlog

Team: LG, MD. These entries were reconstructed on 2026-11-06 from the team's submitted reflection, development conversation, repository history and `DEVELOPMENT.md`. They are retrospective records; no unrecorded wall-clock times or human playtests are claimed.

## Entries

### 2026-11-06 — Retrospective: our core experience

- **Changed:** We chose a pawn shop game built around buying, selling and talking to different customers.
- **Expected:** Open conversations would feel more natural than card-based interactions.
- **Saw:** The current game lets us inspect an object, speak freely, negotiate a price and complete a purchase or sale. Development checks cover the transaction and conversation flows; this is not a report from an independent human playtest.
- **Decided, and why (who):** We moved away from the AI's card-based suggestion because we wanted open, natural conversations. LG and MD, as described in our submitted reflection.

### 2026-11-06 — Retrospective: what we would develop next

- **Changed:** We identified the next work in our submitted reflection.
- **Expected:** Didn't predict a measured result.
- **Saw:** Customer dialogue, reactions, unusual objects and a more immersive shop remain the areas we want to improve.
- **Decided, and why (who):** With another session, we would improve dialogue and reactions, add unusual items and recurring customers, and make the shop more immersive. LG and MD, as described in our submitted reflection.

## Reflection

My teammate and I decided to make a pawn shop game where buying, selling, and talking to different customers is the main experience. We moved away from the AI’s suggestion to make it feel more like a card-based interaction because we wanted the conversations to stay open and feel more natural. With another session, I’d improve the customer dialogue and reactions, add more unusual items and recurring customers, and make the shop feel more immersive.

## AI Use Disclosure

We chose the pawn shop concept, the buying and selling experience, and open customer conversations. We directed the changes and supplied the visual references and Pawn Shop Pack. The initial AI-assisted planning session recorded our answers in `context/` and drafted `context/BUILD-PLAN.md`; the approved plan is recorded in commit `a26add6`. Later requests expanded and changed that initial scope.

We used the supplied API gateway for coding and development, including implementation and review of the game code, interface, scene integration, bargaining rules, inventory and profit progression, persistence, microphone handling, API routes and automated tests. All game source listed in the **AI-assisted code inventory** in [AI-USE-LOG.md](https://github.com/lndsmedia/oddly-enough-jam-game/blob/main/devlog/AI-USE-LOG.md) was authored or modified with AI assistance. This retrospective log and runbook document that work; the reflection above is the team's exact supplied text.

The supplied API gateway key also powered real model calls with `claude-code/vmc/jam-cheap[1m]` for fictional customer/item content, live NPC dialogue and spoken-offer interpretation. Gateway models `openai/whisper-1` and `openai/tts-1` provide speech transcription and NPC speech respectively. Exact model IDs for coding and development were not recorded; these runtime model IDs describe the game's configured services.

The supplied shop, ten character models and ten item models came from the team. Their creation tools and origin before being supplied were not established, and no separate license was supplied. Their paths and supplied provenance are recorded in `meta.json` and the AI use log. The bundled fonts are third-party assets credited under the SIL Open Font License 1.1.

API-assisted development produced the procedural geometry and CanvasTextures in `shop-dressing.js`: shop furnishings and clutter, worn surfaces and signs, and six decorative counter curios. This is the generated asset file listed in `meta.json` under `ai_assets` and in the linked AI use log. NPC speech is generated at runtime and is not committed as audio files. No independent human playtest is represented by the automated or browser verification records.
