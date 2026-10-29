Vestigraid
Every move leaves a mark. Every mark fights back.

PROJECT STRUCTURE:
Vestigraid/
├── index.html        # Main HTML shell and UI overlays
├── favicon.ico       # Standard browser favicon
├── og-image.png      # Open Graph social sharing image
├── site.webmanifest  # Progressive web app manifest
├── README.txt        # Game documentation and release instructions
├── brand/            # Vector and raster brand identity assets (logos, icons)
├── css/
│   └── style.css     # Responsive design, terminal theme, animations, and controls
├── js/
│   ├── main.js       # Game coordinator, loop orchestration, and level transitions
│   ├── levels.js     # Case maps, metadata, and per-case timer settings
│   ├── player.js     # Player state, movement, boundaries, and collision checks
│   ├── enemies.js    # Enemy AI, patrol routes, combat, and collision checks
│   ├── shadows.js    # Shadow loop recording, ghost playback, and pressure plates
│   ├── renderer.js   # Canvas drawing, DPR scaling, HUD, and UI updates
│   ├── input.js      # Keyboard and mobile touch controls
│   └── timer.js      # Fixed-tick countdown, pause/resume, and auto-commit
└── tests/
    └── suite.js      # Headless Chrome regression and gameplay test suite

HOW TO PLAY LOCALLY:
Because Vestigraid uses standard ES modules for clean modular architecture:
Option A (Local Web Server - Recommended):
  Run any simple local HTTP server from the Vestigraid folder:
  - Python:  python -m http.server 8000
    Then open http://localhost:8000 in any browser.
  - Node.js: npx serve
    Then open the URL printed in the terminal.

Option B (Direct file:// with Chrome):
  Launch Chrome with the file-access flag:
  chrome --allow-file-access-from-files file:///C:/CG_PROJECT/Vestigraid/index.html

CONTROLS:
- WASD / Arrow Keys: Move
- Spacebar: Strike ahead
- R: Commit loop (leave a shadow behind to replay your actions)
- P / Esc: Pause / Unpause
- Z / Backspace: Reset current case
- Mobile/Touch: Onscreen directional D-pad, Strike, Loop, Pause, and Reset buttons.

MECHANICS & TIME LIMITS:
- Case 01 — Hold the Door: 30 seconds
- Case 02 — Two Keys: 40 seconds
- Case 03 — The Sentry: 50 seconds
- Case 04 — The Team: 70 seconds
- Shadows replay your recorded movements and strikes in real time.
- When a shadow finishes its recorded moves, it stays in its final position, holding pressure plates or blocking passageways.
- Stepping on pressure plates (a, b) opens matching security doors (A, B).
- Strikes eliminate enemies if timed correctly.
- In the final case ("The Team"), defeat all three rogue echoes to unlock the exit!

AUTOMATED TESTS:
Run: node tests/suite.js

ITCH.IO RELEASE INSTRUCTIONS:
1. Ensure index.html, README.txt, css/, and js/ are in the root of the archive.
2. Select all files and folders in the project root and zip them (e.g. vestigraid.zip).
   Important: index.html must be located at the root of the ZIP file, not inside a nested subfolder.
3. On itch.io, create or edit your game project:
   - Kind of project: HTML
   - Upload the ZIP archive and check "This file will be played in the browser".
   - Recommended viewport dimensions: 980 x 680 (or responsive / auto-detect).
4. Save and publish.
