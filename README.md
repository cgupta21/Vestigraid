<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="brand/logo-on-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="brand/logo.svg">
    <img alt="Vestigraid Logo" src="brand/logo-on-dark.svg" width="460">
  </picture>
</p>

<p align="center">
  <strong>Every move leaves a mark. Every mark fights back.</strong>
</p>

<p align="center">
  A tactical time-loop action puzzle game crafted in pure vanilla JavaScript, HTML5 Canvas, and modern CSS.
</p>

<p align="center">
  <a href="https://vestigraid.netlify.app/">
    <strong>🎮 PLAY VESTIGRAID ONLINE</strong>
  </a>
</p>

<p align="center">
  <a href="https://vestigraid.netlify.app/">
    https://vestigraid.netlify.app/
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/JavaScript-ES2022%20Modules-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript ES2022">
  <img src="https://img.shields.io/badge/HTML5-Canvas-E34F26?logo=html5&logoColor=white" alt="HTML5 Canvas">
  <img src="https://img.shields.io/badge/CSS3-Modern%20Grid%20%26%20Flex-1572B6?logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/Tests-90%20Passing-brightgreen?logo=googlechrome&logoColor=white" alt="Tests 90 Passing">
  <img src="https://img.shields.io/badge/Cases-8%20Playable-orange?logo=target&logoColor=white" alt="8 Playable Cases">
  <a href="https://vestigraid.netlify.app/"><img src="https://img.shields.io/badge/Demo-vestigraid.netlify.app-00C7B7?logo=netlify&logoColor=white" alt="Live Demo"></a>
  <img src="https://img.shields.io/badge/License-Not%20Specified-lightgrey" alt="License">
</p>

---
🎮 **[Play Vestigraid Online](https://vestigraid.netlify.app/)**

## 📖 About the Game

**Vestigraid** is a grid-based, time-loop action puzzle game where time is both your greatest resource and your ultimate adversary. 

Players navigate confidential security sectors called **Cases**. In each case, your past movements and actions are recorded in real time. When you commit a loop or run out of time, your past run manifests as a **Shadow** (or Echo) replaying your previous steps. These shadows can be leveraged collaboratively—such as pressing remote floor plates to keep blast doors open—but they physically occupy grid cells and will block your future self.

Across eight distinct cases, puzzles escalate from fundamental door-holding maneuvers to multi-chamber relays, crossing sentry fire, synchronized corridor splits, rogue echo hunts, and master sentinel sweeps.

---

## 🌐 Play Online

Experience Vestigraid directly in your web browser with zero setup or installation required:

<p align="center">
  <a href="https://vestigraid.netlify.app/">
    <img src="https://img.shields.io/badge/PLAY%20ONLINE-vestigraid.netlify.app-00C7B7?style=for-the-badge&logo=netlify&logoColor=white" alt="Play Vestigraid Online">
  </a>
  <br>
  <strong>Play deployed game:</strong> <a href="https://vestigraid.netlify.app/">https://vestigraid.netlify.app/</a>
</p>

- **Zero Installation**: Runs 100% client-side in Google Chrome, Firefox, Safari, Edge, or any modern standards-compliant browser.
- **Cross-Platform Controls**: Play on desktop using keyboard inputs (`W` `A` `S` `D` / Arrow keys, `Spacebar`, `R`) or on mobile and touch devices using the integrated virtual directional pad and action buttons.
- **All 12 Cases Live**: Progress seamlessly from Case 01 through Case 12 ("The Paradox").

---

## 🕹️ Gameplay Features

- **Collaborative Echo Mechanics**: Up to 4 active shadows replay past movements, strikes, and path navigations in synchronized real time.
- **Physical Obstruction & Pressure Plates**: Shadows persist at their final recorded destination upon completing their sequence, continuously depressing pressure plates (`a`, `b`) to open linked security doors (`A`, `B`), while physically blocking doorways and narrow corridors.
- **Directional Melee Combat**: Execute forward directional strikes (`Space`) to eliminate patrolling enemies or strike rogue echoes. Strikes feature an active cooldown recovery cycle (3 simulation ticks).
- **Fixed-Timestep Simulation**: Runs on a deterministic 140 ms game tick (`TICK = 140ms`) with an accumulator loop and delta-time clamping (`MAX_DT = 420ms`) to eliminate frame-rate variance and prevent multi-tick bursts after tab switching.
- **Case Progression & Puzzle Design**:
  - **Case 01 — Hold the Door** (*6 seconds / 43 ticks*): Single pressure plate and security door. Teaches loop commitment and shadow door-holding mechanics.
  - **Case 02 — Two Keys** (*7 seconds / 50 ticks*): Multi-stage puzzle requiring chained loops to activate plates `a` and `b` in sequence to open doors `A` and `B`.
  - **Case 03 — The Sentry** (*8 seconds / 57 ticks*): Introduces real-time enemy patrol routes across waypoint tracks. Requires precise timing to cross the sentry lane safely.
  - **Case 04 — The Team** (*10 seconds / 71 ticks*): Boss puzzle. Two rogue sentinels patrol the sector corridors. Both must be destroyed in the same loop before the exit unlock triggers.
  - **Case 05 — The Relay** (*8 seconds / 57 ticks*): Triple-chamber security relay. Chained shadows must systematically trigger floor switches `a`, `b`, and `c` to unlock blast gates `A`, `B`, and `C` in sequence.
  - **Case 06 — Crossfire** (*9 seconds / 64 ticks*): Sentry coordination puzzle featuring two intersecting sentry patrol lanes (`01` and `02`) alongside blast door `A`. Requires precise timing and combat strikes to slip past the crossfire.
  - **Case 07 — The Split** (*10 seconds / 71 ticks*): Dual-branch sector requiring simultaneous coordination across upper and lower wings to unlock gates `A`, `B`, and final gate `C`.
  - **Case 08 — The Last Loop** (*13 seconds / 93 ticks*): Master sector uniting dual pressure plates (`a`, `b`) and two high-speed roaming sentinels (`01`, `02`) who must both be eliminated to unseal the security gate and unlock advanced sectors.
  - **Case 09 — The Laser Grid** (*10 seconds / 71 ticks*): Introduces pulsing and moving laser barriers with high-voltage active states and dormant intervals. Coordinate shadow door holds and time crossings through safe laser windows.
  - **Case 10 — The Rift** (*11 seconds / 79 ticks*): Introduces deterministic teleportation portals (`α` and `β`). Warp across isolated containment vaults to depress switches and coordinate loops across the rift.
  - **Case 11 — The Shift** (*12 seconds / 86 ticks*): Introduces alternating shifting bulkheads cycling on an 8-tick rhythm. Synchronize your run to cross barriers before phase inversion, with automatic displacement safeguards.
  - **Case 12 — The Paradox** (*14 seconds / 100 ticks*): The ultimate temporal master challenge. Coordinate four concurrent shadow recordings across four security chambers, eliminate elite sentinels, and simultaneously hold plates `a`, `b`, and `c` to conquer the final paradox and close all cases.
- **Progressive Case Unlocking & Persistence**: Progress saves seamlessly to browser `localStorage` (`vestigraid_progress_v1`). Unlocking is strictly progressive — solve each case to access the next. Any previously unlocked sector can be replayed at will via the Sector Archive (`C` key or header button), without risk of losing progress. Includes a guarded "Reset Progress" option with explicit confirmation.
- **Dynamic Hi-DPI Rendering**: Automatic canvas scaling using `window.devicePixelRatio` ensures pixel-sharp geometry and text across high-density displays (Retina, 4K) without layout shifts.
- **Cross-Platform Responsive Design**: Playable with standard desktop keyboard controls or mobile touch screens via an integrated on-screen directional pad and action buttons.

---

## 🎮 How to Play

### Controls

| Action | Desktop Keyboard | Mobile / Touch |
|---|---|---|
| **Move Up / Down / Left / Right** | `W` `A` `S` `D` or `↑` `←` `↓` `→` | On-Screen D-Pad Buttons |
| **Strike Ahead** | `Spacebar` | **Strike** Button |
| **End / Commit Loop** | `R` | **Loop** Button |
| **Select Case / Archive** | `C` | **Select Case** Button |
| **Pause / Resume** | `P` or `Esc` | **Pause** Button |
| **Reset Case** | `Z` or `Backspace` | **Reset** Button |

### Rules & Objectives

1. **Start the Loop**: The clock begins on your first movement input. 
2. **Coordinate with Past Echoes**: Step on pressure plates or position yourself strategically, then press `R` to commit the loop. A shadow is minted that repeats your exact timeline.
3. **Avoid Collisions**: Colliding with active enemies or walking into an enemy's tile triggers **"Caught"**, erasing the current loop and requiring a retry.
4. **Time Management**: The progress bar at the bottom reflects your remaining case time. If the timer expires before you reach the exit, the game automatically commits your actions into a shadow and begins the next loop.
5. **Clear the Case**: Reaching the exit tile (`E`) advances you to the next sector. In combat boss cases (Case 04, Case 08 & Case 12), the exit remains sealed until all designated hostile entities are neutralized and required security locks are held. Clearing Case 12 presents the final **"ALL CASES CLOSED"** victory terminal with full case replay options.

---

## 📷 Visuals & Media

> *Note: Dynamic in-game captures will be featured upon public release. The official promotional banner below illustrates the terminal-kraft paper aesthetic.*

<p align="center">
  <img src="og-image.png" alt="Vestigraid Social Preview" width="700">
</p>

---

## 🛠️ Technology Stack

- **Core Engine**: Pure Vanilla JavaScript (ES2022 Modules) with zero external runtime libraries or build steps.
- **Rendering**: HTML5 2D Canvas API utilizing sub-pixel DPR scaling and custom vector rasterization.
- **Typography & Styling**: CSS3 (Flexbox, CSS Grid, custom properties, responsive `clamp()`) paired with *Anton* and *Courier Prime* web fonts.
- **PWA & Brand Identity**: Web App Manifest (`site.webmanifest`), adaptive maskable icons, vector SVG logos, and Open Graph metadata.
- **Testing & Verification**: Headless Google Chrome automation via native Chrome DevTools Protocol (CDP) WebSocket communication and Node.js test runners.

---

## 📁 Project Structure

```text
Vestigraid/
├── index.html            # Main semantic markup shell and UI layout
├── favicon.ico           # Browser shortcut icon
├── og-image.png          # Social sharing and Open Graph preview image (1200x630)
├── site.webmanifest      # Progressive Web App manifest
├── README.md             # Project documentation and engineering overview
├── brand/                # Vector and raster identity assets
│   ├── logo.svg          # Light-theme vector logo
│   ├── logo-on-dark.svg  # Dark-theme vector logo (used in game header)
│   ├── logo.png          # High-resolution raster logo
│   ├── logo-on-dark.png  # High-resolution dark raster logo
│   ├── icon.svg          # Vector icon and victory seal
│   ├── icon-maskable.svg # Android adaptive maskable vector icon
│   ├── icon-192.png      # 192x192 PWA launcher icon
│   ├── icon-512.png      # 512x512 PWA launcher icon
│   ├── icon-maskable-512.png # 512x512 PWA maskable icon
│   ├── favicon-32.png    # 32x32 PNG favicon
│   └── apple-touch-icon.png # iOS home screen icon
├── css/
│   └── style.css         # Theme palette, CRT effects, layout, and responsive styles
├── js/
│   ├── main.js           # Core state coordinator, game loop, and level transitions
│   ├── levels.js         # Level definitions, ASCII map parsers, and timer configs
│   ├── player.js         # Player coordinates, facing directions, and collision logic
│   ├── enemies.js        # Patrol paths, hunter AI, combat hits, and collision detection
│   ├── shadows.js        # Loop action recording, ghost playback, and pressure plates
│   ├── renderer.js       # Canvas drawing, DPR adjustments, HUD, and CRT styling
│   ├── input.js          # Keyboard listeners, input queuing, and touch D-pad binding
│   └── timer.js          # Fixed-timestep accumulator loop and countdown handling
└── tests/
    └── suite.js          # Chrome CDP headless automated regression & gameplay test suite
```

---

## 🚀 Getting Started

### Prerequisites

- A modern web browser supporting ES Modules and HTML5 Canvas (Google Chrome, Mozilla Firefox, Microsoft Edge, or Apple Safari).
- *(Optional, for running tests)* [Node.js](https://nodejs.org/) (v18.0.0 or higher).

### Installation & Local Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/cgupta21/Vestigraid.git
   cd Vestigraid
   ```

2. **Launch a local server**:
   Because Vestigraid utilizes native JavaScript ES Modules (`<script type="module">`), modern browsers enforce CORS restrictions when loading scripts directly from local `file:///` paths. Run any local HTTP server from the project root:

   **Using Python (pre-installed on most systems):**
   ```bash
   python -m http.server 8000
   ```
   *Then open `http://localhost:8000` in your browser.*

   **Using Node.js:**
   ```bash
   npx serve
   ```

   **Using Chrome with file access enabled (no server required):**
   ```powershell
   chrome --allow-file-access-from-files file:///C:/CG_PROJECT/Vestigraid/index.html
   ```

---

## 🧪 Testing & Verification

Vestigraid includes a headless browser test suite that validates game logic, boundary collisions, combat resolution, timer synchronization, and responsive rendering inside Google Chrome using the Chrome DevTools Protocol (CDP).

### Running the Test Suite

Execute the test suite with Node.js:

```powershell
node tests/suite.js
```

### Test Coverage Highlights

The suite performs **90 automated assertions** across 10 functional test categories:

1. **Canvas Dimensions**: Verifies correct pixel scaling and aspect ratios across all 12 cases.
2. **Boundary Collision & Clamping**: Verifies that pressing directions into exterior bounds or solid walls prevents illegal tile escapes and never triggers false deaths.
3. **Wall Impassability**: Ensures perimeter walls and interior obstacles remain completely impassable.
4. **Melee Strike Mechanics**: Confirms directional attacks register in the player's facing direction and enforce cooldown delays.
5. **Enemy Collision Logic**: Confirms that legitimate enemy collisions (including swap-cross encounters) properly trigger failure resets.
6. **State Transitions**: Validates loop starts, pause/unpause idempotency (`P`), and full-case resets (`Z`).
7. **Complete Gameplay Walkthrough**: Automatically simulates puzzle solutions for Cases 01, 02, and 03.
8. **Advanced Case & Boss Solves**: Simulates multi-loop solutions and verified completions for:
   - **Case 04**: Defeat of both rogue sentinels advancing to Case 05.
   - **Case 05**: 4-loop relay puzzle solution through gates `A`, `B`, and `C`.
   - **Case 06**: 2-loop sentry strike and gate escape.
   - **Case 07**: 4-loop dual-branch coordination and final exit run.
   - **Case 08**: 3-loop run eliminating both sentinels and unsealing gate `B`.
   - **Case 09**: 3-loop laser grid crossing timing safe windows through dormant beams.
   - **Case 10**: 3-loop teleportation portal transit linking isolated security chambers.
   - **Case 11**: 3-loop shifting bulkhead phase synchronization with built-in displacement safety.
   - **Case 12**: 4-loop master paradox solution coordinating four concurrent shadows, eliminating elite sentinels, unlocking all blast doors, asserting **"ALL CASES CLOSED"**, and verifying final case restart.
9. **Timer System & Auto-Commit**: Asserts timer configurations across all 12 cases (6s, 7s, 8s, 10s, 8s, 9s, 10s, 13s, 10s, 11s, 12s, 14s), verifies pause freezing, and checks auto-commit behavior upon tick expiration.
10. **Branding Assets & Responsiveness**: Verifies the presence and integrity of all 14 brand files, validates DOM element loading, checks manifest/meta links, and verifies logo layout without stage overlap on both desktop (1024×768) and mobile (375×667) viewports.
11. **Expansion Mechanics & Anti-Bypass**: Rigorously tests laser damage, portal warping and loop prevention, shifting bulkhead collisions and player safety displacement, multi-shadow recording playback, and exit validation across all 12 cases.

---

## 🏗️ Architecture & Implementation

The game is structured into decoupled ES modules to maintain separation of concerns:

```mermaid
flowchart TD
    HTML["index.html"] --> Main["js/main.js<br><i>State Coordinator & RAF Loop</i>"]
    Input["js/input.js<br><i>Keyboard & Touch</i>"] --> Main
    Main --> Timer["js/timer.js<br><i>Fixed-Timestep Accumulator</i>"]
    Main --> Player["js/player.js<br><i>Position & Boundary Checks</i>"]
    Main --> Shadows["js/shadows.js<br><i>Loop Recording & Ghosts</i>"]
    Main --> Enemies["js/enemies.js<br><i>Patrols & Rogue Echoes</i>"]
    Main --> Levels["js/levels.js<br><i>Maps & Timer Settings</i>"]
    Main --> Renderer["js/renderer.js<br><i>Canvas DPR & HUD Updates</i>"]
```

### Module Responsibilities

- **`js/main.js`**: Central director managing level loading, the `requestAnimationFrame` loop, game state (`running`, `paused`, `won`), and loop recycling.
- **`js/timer.js`**: Encapsulates tick math, fixed accumulator steps (`140ms`), pause timing, and remaining duration calculations.
- **`js/player.js`**: Enforces strict boundary checks (`isSolid`), grid containment, facing vectors, and strike cooldown cycles.
- **`js/shadows.js`**: Buffers step-by-step positions and strikes for the active run; replays past loops as ghosts; calculates which pressure plates are currently active.
- **`js/enemies.js`**: Computes waypoint patrol trajectories, hunter AI paths based on recorded player runs, and strike hitboxes.
- **`js/renderer.js`**: Handles responsive 2D canvas sizing, High-DPI scaling, entity interpolation, and thematic UI rendering.
- **`js/input.js`**: Normalizes desktop keyboard and mobile touch events into an unified action queue.
- **`js/levels.js`**: Stores ASCII level matrices, case metadata, and per-case timer thresholds.

---

## 🤝 Development & Contributions

Contributions, bug reports, and suggestions are welcome!

1. **Fork the repository** on GitHub.
2. **Create a feature branch**:
   ```bash
   git checkout -b feature/new-case
   ```
3. **Follow the code style**: Keep JavaScript modular, avoid introducing heavy build dependencies, and preserve the terminal-kraft visual aesthetic.
4. **Run the regression suite**: Ensure all 90 tests pass before submitting changes:
   ```bash
   node tests/suite.js
   ```
5. **Open a Pull Request** with a clear description of your changes.

---

## 🗺️ Roadmap

The current version of Vestigraid provides eight complete, fully tested cases. Potential future enhancements under consideration:

- [ ] **Audio & Sound Design**: Procedural retro synth sound effects for footsteps, strikes, door opening, and caught alerts.
- [ ] **Speedrun Timer**: High-precision tick counters and best-time tracking saved to `localStorage`.
- [ ] **Additional Sectors**: Advanced mechanics such as laser barriers, multi-state toggle switches, and conveyor belts.
- [ ] **Community Level Editor**: In-browser ASCII grid creator allowing players to design and export custom cases.

---

## 👤 Developer & Repository

- **Developer**: Chandan Kumar Gupta
- **GitHub Profile**: [@cgupta21](https://github.com/cgupta21)
- **Repository**: [https://github.com/cgupta21/Vestigraid](https://github.com/cgupta21/Vestigraid)

---

## 📄 License

No license has been specified for this project. All rights are reserved by the author. If you wish to use or adapt any portion of this codebase, please contact the developer.
