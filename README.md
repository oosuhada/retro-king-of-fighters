# Retro King of Fighters

A browser-playable JavaScript recreation of the classic **THE KING OF FIGHTERS** arcade experience, with 1P CPU battles, local 2P matches, 3-on-3 team battles, command moves, POWER stocks and MAX mode.

## Current systems

- Title screen and explicit 1 Player / 2 Players mode selection
- 1P Arcade versus CPU and Training versus a passive dummy
- Easy / Normal / Hard CPU difficulty selection for Arcade
- 2P Single Battle (1 vs 1) and Team Battle (3 vs 3)
- First-run style controls screen before character select
- Persistent in-battle keyboard legend and H/? move-list overlay
- Backward walking while holding back, with guard-on-contact behavior
- Standing, crouching and jumping normal attacks with posture-specific hit/hurt boxes
- Close-range C/D throws, guard stun and knockdown sweeps
- High / low guard distinction, throw tech, hop and super-jump inputs
- Three-fighter team selection and order select
- Character-select move preview with fighter style and command list
- Mai, Kyo and EX gameplay profiles
- Winner-stays 3-on-3 match state
- Time-based winner HP recovery
- Team-owned POWER / stock carry-over across fighter changes
- A/B/C/D attacks, guards, movement and command parsing
- Character projectiles and projectile clashes
- Hit stop, cancel windows and combo counter
- POWER stocks, ABC MAX mode and command supers
- Round intro, timer, KO and team winner flow

## Architecture

```text
runtime/   frame scheduling
input/     key state and motion parsing
controllers/ CPU opponent behavior
arena/     active round and projectile ownership
fighters/  fighter behavior and character implementations
combat/    projectile entities
match/     single and three-on-three match state
app/       title, mode select, onboarding, character select and match composition (`KofArcade`)
```

See `LOCAL_ARCHITECTURE.md` for more detail.

## Local development

Serve the repository directory with a static HTTP server and open the root route backed by `templates/index.html`.

## Deployment

The canonical playable build is served from `https://retro.oosu.dev/kof/` and the canonical repository is `oosuhada/retro-king-of-fighters`.

GitHub `main` is the canonical release branch. A MacBook Air launchd mirror fetches GitHub and forwards new commits to the Mac mini through the `mac-mini` Tailscale SSH alias. The Mac mini publishes an atomic static release only after local nginx and public HTTPS health checks pass.

