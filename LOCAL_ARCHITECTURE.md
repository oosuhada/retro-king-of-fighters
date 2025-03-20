# Local team-arcade architecture

This checkout preserves the upstream repository history. Local commits turn the original prototype into a layered 3-on-3 match implementation.

- `static/js/runtime/frame-actor.js`: frame runtime.
- `static/js/input/motion-buffer.js` and `fight-input.js`: command recognition.
- `static/js/arena/team-arena.js`: active round, timer, hit stop and projectiles.
- `static/js/fighters/`: fighter behavior and character-specific assets.
- `static/js/combat/projectile.js`: projectile simulation.
- `static/js/match/team-match-state.js`: roster order, elimination, winner-stays recovery and team-shared POWER gauge.
- `static/js/app/team-arcade.js`: character select, order select and match composition.

Team POWER/stock belongs to the player side and survives character elimination, while HP remains character-specific.
