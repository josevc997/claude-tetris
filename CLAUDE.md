# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Response style

At the start of every session in this repo, activate the `caveman` skill in `full` mode (invoke it as if the user typed `/caveman full`). Stay in that mode for the rest of the session unless the user says "stop caveman" or "normal mode".

## What this is

A classic Tetris implementation in vanilla JavaScript, HTML5 Canvas, and CSS. No dependencies, no build step, no package.json — just `index.html`, `style.css`, and `game.js`.

## Running / testing

There is no build, lint, or test tooling in this repo. To run the game, just open `index.html` directly, or serve it with any static server, e.g.:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`. Verify changes by opening the page and playing (there are no automated tests).

## Architecture

All game logic lives in `game.js` (~300 lines), structured as global state + a `requestAnimationFrame` loop — not classes or modules.

- **Board model**: `board` is a `ROWS × COLS` (20×10) matrix; each cell is `0` (empty) or a color index 1–7 identifying which piece type occupies it.
- **Pieces**: `PIECES` defines the 7 standard tetrominoes (I,O,T,S,Z,J,L) as square matrices of color indices. `current` and `next` hold `{ type, shape, x, y }`.
- **Rotation**: `rotateCW` transposes + reverses rows to rotate a shape matrix 90°. `tryRotate` applies the rotation then attempts wall kicks (`[0, -1, 1, -2, 2]` column offsets) until one doesn't collide, else the rotation is discarded.
- **Collision**: `collide(shape, ox, oy)` checks board bounds and overlap with locked cells — the single function all movement/rotation/drop logic routes through.
- **Game loop** (`loop`): accumulates elapsed time (`dropAccum`); once it exceeds `dropInterval`, the piece drops a row or gets locked (`lockPiece` → `merge` + `clearLines` + `spawn`).
- **Line clearing** (`clearLines`): scans bottom-up, splices full rows out and unshifts empty rows at the top; scoring uses `LINE_SCORES = [0, 100, 300, 500, 800]` multiplied by `level`.
- **Level/speed**: level increments every 10 lines; `dropInterval = max(100, 1000 - (level-1)*90)` ms.
- **Ghost piece** (`ghostY`): projects the current piece straight down to where it would land; drawn at `globalAlpha = 0.2`.
- **Game over**: triggered in `spawn()` when a freshly spawned piece immediately collides.

Input is a single `keydown` listener mapping arrows/space/X to move/rotate/soft-drop/hard-drop, and `P` to pause (`togglePause` cancels/restarts the animation frame loop).

Tunable constants at the top of `game.js`: `COLS`, `ROWS`, `BLOCK` (cell size in px), `COLORS`, `LINE_SCORES`, `dropInterval`. If `COLS`/`ROWS`/`BLOCK` change, update the `<canvas id="board">` `width`/`height` in `index.html` to match (`COLS × BLOCK`, `ROWS × BLOCK`).
