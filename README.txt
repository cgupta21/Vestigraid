# Vestigraid

> *Every move leaves a mark. Every mark fights back.*

Vestigraid is a 2D browser action-puzzle game where your past actions become **echoes** (shadows) that replay alongside you. Record a loop, commit it, and let your shadow hold down pressure plates, block passages, or take out enemies while you tackle the rest of the puzzle.

Built with vanilla JavaScript (ES modules) and HTML5 Canvas. No frameworks, no build step.

---

## Gameplay

Each level is a **case** with a countdown timer. Within that time you move, strike, and then **commit your loop** with `R`. Your recorded movements and strikes become a shadow that replays in real time while you play a new pass.

- Shadows replay your recorded movements and strikes exactly as you performed them.
- When a shadow finishes its moves, it stays in its final position, so it can keep holding a pressure plate or block a path.
- Stepping on pressure plates (`a`, `b`) opens the matching security doors (`A`, `B`).
- Strikes eliminate enemies if timed correctly.
- In the final case, defeat all three rogue echoes to unlock the exit.

### Cases

| Case | Title | Time limit |
|------|-------|-----------|
| 01 | Hold the Door | 30 s |
| 02 | Two Keys | 40 s |
| 03 | The Sentry | 50 s |
| 04 | The Team | 70 s |

---

## Controls

| Action | Keyboard | Mobile / Touch |
|--------|----------|----------------|
| Move | `W` `A` `S` `D` / Arrow keys | On-screen D-pad |
| Strike ahead | `Space` | Strike button |
| Commit loop (leave a shadow) | `R` | Loop button |
| Pause / unpause | `P` / `Esc` | Pause button |
| Reset current case | `Z` / `Backspace` | Reset button |

---

## Running Locally

Vestigraid uses standard ES modules, so it needs to be served over HTTP rather than opened directly from the file system.

### Option A: Local web server (recommended)

From the project folder, run any simple static server:

```bash
# Python
python -m http.server 8000
# then open http://localhost:8000
```

```bash
# Node.js
npx serve
# then open the URL printed in the terminal
```

### Option B: Open via `file://` in Chrome

Launch Chrome with the file-access flag:

```bash
chrome --allow-file-access-from-files file:///path/to/Vestigraid/index.html
```

---

## Project Structure

```
Vestigraid/
├── index.html        # Main HTML shell and UI overlays
├── favicon.ico       # Browser favicon
├── og-image.png      # Open Graph social sharing image
├── site.webmanifest  # Progressive web app manifest
├── README.txt        # Original game documentation and release notes
├── brand/            # Vector and raster brand assets (logos, icons)
├── css/
│   └── style.css     # Responsive layout, terminal theme, animations, controls
├── js/
│   ├── main.js       # Game coordinator, loop orchestration, level transitions
│   ├── levels.js     # Case maps, metadata, per-case timer settings
│   ├── player.js     # Player state, movement, boundaries, collision checks
│   ├── enemies.js    # Enemy AI, patrol routes, combat, collision checks
│   ├── shadows.js    # Loop recording, ghost playback, pressure plates
│   ├── renderer.js   # Canvas drawing, DPR scaling, HUD, UI updates
│   ├── input.js      # Keyboard and mobile touch controls
│   └── timer.js      # Fixed-tick countdown, pause/resume, auto-commit
└── tests/
    └── suite.js      # Headless Chrome regression and gameplay tests
```

---

## Automated Tests

A headless Chrome regression and gameplay suite lives in `tests/`:

```bash
node tests/suite.js
```

---

## Publishing to itch.io

1. Make sure `index.html`, `css/`, and `js/` (plus any assets you want to ship) are at the root of your archive.
2. Select everything in the project root and zip it (for example `vestigraid.zip`).
   **Important:** `index.html` must be at the root of the ZIP, not inside a nested folder.
3. On itch.io, create or edit your game project:
   - **Kind of project:** HTML
   - Upload the ZIP and check **"This file will be played in the browser"**
   - **Recommended viewport:** 980 × 680 (or responsive / auto-detect)
4. Save and publish.

---

## Tech Stack

- HTML5 Canvas for rendering (with device-pixel-ratio scaling)
- Vanilla JavaScript, ES modules
- CSS with a terminal-style theme
- Node.js + headless Chrome for tests

---

## License

No license has been specified yet. Add a `LICENSE` file to clarify how others may use this project.
