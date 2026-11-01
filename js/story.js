// ─── The Echo Protocol: Narrative Data & Chapter Definitions ─────────────────

/**
 * @typedef {Object} StoryLine
 * @property {string} speaker - Name of the speaker (e.g. 'UNKNOWN VOICE', 'WARDEN', 'DR. MARA VENN', 'SYSTEM')
 * @property {string} text - Spoken dialogue or telemetry message
 * @property {'system'|'voice'|'warden'|'venn'} [type] - Aesthetic classification for styling & audio cues
 */

/**
 * @typedef {Object} StorySequence
 * @property {string} id - Unique sequence identifier
 * @property {string} title - Human-readable sequence title
 * @property {number} chapter - 1-based chapter number
 * @property {string} category - 'chapter_intro'|'case_intro'|'chapter_outro'|'epilogue'
 * @property {number} [caseIndex] - 0-based case index if tied to a specific case
 * @property {StoryLine[]} lines
 */

/**
 * Chapter metadata definitions
 */
export const CHAPTERS = [
  {
    number: 1,
    title: 'The Awakening',
    cases: [0, 1, 2],
    desc: 'Neural reboot inside the Chrono-Containment Vault. Basic recursion calibration.',
    sequenceIds: ['ch1_intro', 'case01_intro', 'case02_intro', 'case03_intro', 'ch1_outro']
  },
  {
    number: 2,
    title: 'The Experiment',
    cases: [3, 4, 5],
    desc: 'Armed sentinel corridors and synchronized multi-point temporal combat.',
    sequenceIds: ['ch2_intro', 'case04_intro', 'case05_intro', 'case06_intro', 'ch2_outro']
  },
  {
    number: 3,
    title: 'The Fracture',
    cases: [6, 7, 8],
    desc: 'Lethal laser barriers and compounding temporal instability.',
    sequenceIds: ['ch3_intro', 'case07_intro', 'case08_intro', 'case09_intro', 'ch3_outro']
  },
  {
    number: 4,
    title: 'The Paradox',
    cases: [9, 10, 11],
    desc: 'Portals, shifting bulkheads, and the core temporal loop collapse.',
    sequenceIds: ['ch4_intro', 'case10_intro', 'case11_intro', 'case12_intro', 'ch4_outro', 'epilogue']
  }
];

/**
 * Complete Story sequences registry for THE ECHO PROTOCOL
 * @type {Record<string, StorySequence>}
 */
export const STORY_SEQUENCES = {
  // ─── CHAPTER 1: THE AWAKENING ───────────────────────────────────────────────
  ch1_intro: {
    id: 'ch1_intro',
    title: 'Signal in the Dark',
    chapter: 1,
    category: 'chapter_intro',
    lines: [
      {
        speaker: 'SYSTEM',
        type: 'system',
        text: 'VANTA BLACKSITE 09 // ECHO PROTOCOL: RECURSION CELL 01 INITIALIZATION...'
      },
      {
        speaker: 'SYSTEM',
        type: 'system',
        text: 'VITALS RE-ENGAGED. LOCAL CHRONO-ANCHOR: STABLE. TIME LIMIT ENFORCED.'
      },
      {
        speaker: 'UNKNOWN VOICE',
        type: 'voice',
        text: 'Can you hear me? Open your eyes. Your neural pattern collapsed three times during transit... but this cycle is holding.'
      },
      {
        speaker: 'UNKNOWN VOICE',
        type: 'voice',
        text: "You are inside VANTA's subterranean Chrono-Containment Vault. The facility is under automated lockdown, and the bulkheads are sealed."
      },
      {
        speaker: 'WARDEN',
        type: 'warden',
        text: 'SECURITY NOTICE: Unregistered temporal displacement detected in Sector A. Commencing containment diagnostics.'
      },
      {
        speaker: 'UNKNOWN VOICE',
        type: 'voice',
        text: "The Warden security intelligence is scanning the sector. You don't have much time. Every move you make leaves a permanent mark in the loop. Use your past shadows... or die here."
      }
    ]
  },

  case01_intro: {
    id: 'case01_intro',
    title: 'Hold the Door',
    chapter: 1,
    category: 'case_intro',
    caseIndex: 0,
    lines: [
      {
        speaker: 'SYSTEM',
        type: 'system',
        text: 'SECTOR A-01 // BULKHEAD STATUS: LOCKED. INTERLOCK: PRESSURE DECK A.'
      },
      {
        speaker: 'UNKNOWN VOICE',
        type: 'voice',
        text: 'The blast door ahead is sealed tight. The pressure plate on the lower platform disengages the mag-lock, but it requires continuous weight.'
      },
      {
        speaker: 'UNKNOWN VOICE',
        type: 'voice',
        text: 'Step onto Plate A, then initiate a temporal loop. Your shadow will retrace those exact steps, holding the door open while your new body walks freely through.'
      }
    ]
  },

  case02_intro: {
    id: 'case02_intro',
    title: 'Two Keys',
    chapter: 1,
    category: 'case_intro',
    caseIndex: 1,
    lines: [
      {
        speaker: 'SYSTEM',
        type: 'system',
        text: 'SECTOR A-02 // DUAL INTERLOCK SYSTEM DETECTED: BULKHEADS A & B.'
      },
      {
        speaker: 'DR. MARA VENN',
        type: 'venn',
        text: '...Research Log 412. The recursion effect enables multi-point coordination without multiple personnel. One operative... layered across consecutive loops...'
      },
      {
        speaker: 'UNKNOWN VOICE',
        type: 'voice',
        text: 'Dr. Venn proved this before the research team disappeared. Two plates, two locked bulkheads. One shadow holds Door A. Your next loop walks through Door A to reach Plate B. Layer your echoes.'
      }
    ]
  },

  case03_intro: {
    id: 'case03_intro',
    title: 'The Sentry',
    chapter: 1,
    category: 'case_intro',
    caseIndex: 2,
    lines: [
      {
        speaker: 'WARDEN',
        type: 'warden',
        text: 'DEFENSE DIRECTIVE: Autonomous Sentinel 01 deployed to Corridor Alpha. Lethal force authorized.'
      },
      {
        speaker: 'UNKNOWN VOICE',
        type: 'voice',
        text: 'The Warden has deployed armed patrol drones. Their optical sensors sweep the corridor in rigid mechanical rhythms.'
      },
      {
        speaker: 'UNKNOWN VOICE',
        type: 'voice',
        text: 'Time your crossing carefully. One collision and your current loop will be vaporized on contact.'
      }
    ]
  },

  ch1_outro: {
    id: 'ch1_outro',
    title: 'Warden Alert Phase I',
    chapter: 1,
    category: 'chapter_outro',
    lines: [
      {
        speaker: 'SYSTEM',
        type: 'system',
        text: 'SECTOR A COMPLETED // TELEMETRY TRANSFERRED TO CENTRAL CORE.'
      },
      {
        speaker: 'WARDEN',
        type: 'warden',
        text: 'CRITICAL ESCALATION: Sector A perimeter breached. Target exhibits recursive temporal cooperation. Reclassifying subject as Level 2 Threat.'
      },
      {
        speaker: 'DR. MARA VENN',
        type: 'venn',
        text: "...Log entry 418. If the subject survives Sector A, the Warden will not negotiate. VANTA directives require total containment of anomalous recursion. May god forgive us for what we built..."
      },
      {
        speaker: 'UNKNOWN VOICE',
        type: 'voice',
        text: "You made it through Sector A. But the Awakening was only a calibration test. Ahead lies Sector B... VANTA's Central Weapons Labs. Prepare yourself."
      }
    ]
  },

  // ─── CHAPTER 2: THE EXPERIMENT ──────────────────────────────────────────────
  ch2_intro: {
    id: 'ch2_intro',
    title: 'The Proving Grounds',
    chapter: 2,
    category: 'chapter_intro',
    lines: [
      {
        speaker: 'SYSTEM',
        type: 'system',
        text: 'SECTOR B UNSEALED // FACILITY SECTOR: CENTRAL WEAPONS & TACTICAL LABS.'
      },
      {
        speaker: 'WARDEN',
        type: 'warden',
        text: 'ALERT: Subject has breached Sector A containment. Authorizing live-fire field trials. Deploy weapons platforms.'
      },
      {
        speaker: 'UNKNOWN VOICE',
        type: 'voice',
        text: "We've broken into Sector B. This wasn't just a containment facility... it was VANTA's proving ground. Project ECHO was never just about observing time loops—they were weaponizing them."
      },
      {
        speaker: 'DR. MARA VENN',
        type: 'venn',
        text: '...Log 504. If the loop can replicate kinetic strikes, a single soldier becomes an entire strike team. One mind, synchronized across time... But the cognitive feedback is catastrophic.'
      }
    ]
  },

  case04_intro: {
    id: 'case04_intro',
    title: 'The Team',
    chapter: 2,
    category: 'case_intro',
    caseIndex: 3,
    lines: [
      {
        speaker: 'SYSTEM',
        type: 'system',
        text: 'SECTOR B-04 // HOSTILE TARGET DETECTED: ARMED SENTINEL SQUAD 01 & 02.'
      },
      {
        speaker: 'UNKNOWN VOICE',
        type: 'voice',
        text: 'Two combat drones patrol this wing. The blast door will not unlock while hostile units remain operational.'
      },
      {
        speaker: 'UNKNOWN VOICE',
        type: 'voice',
        text: 'You cannot be in two corridors at once. Strike down Sentinel 01 in your first run. In the next loop, your shadow repeats the kill while you eliminate Sentinel 02. Fight alongside yourself.'
      }
    ]
  },

  case05_intro: {
    id: 'case05_intro',
    title: 'The Relay',
    chapter: 2,
    category: 'case_intro',
    caseIndex: 4,
    lines: [
      {
        speaker: 'SYSTEM',
        type: 'system',
        text: 'SECTOR B-05 // SEQUENTIAL RELAY PROTOCOL ENGAGED: INTERLOCKS A, B, C.'
      },
      {
        speaker: 'DR. MARA VENN',
        type: 'venn',
        text: '...Log 519. Chain three iterations minimum. Iteration 1 trips breaker A. Iteration 2 passes through gate A to trip breaker B. Iteration 3 reaches breaker C. Any desynchronization collapses the chain.'
      },
      {
        speaker: 'UNKNOWN VOICE',
        type: 'voice',
        text: 'Three blast gates, three pressure relays. You must leave a relay of shadows across consecutive loops. Do not waste a single step.'
      }
    ]
  },

  case06_intro: {
    id: 'case06_intro',
    title: 'Crossfire',
    chapter: 2,
    category: 'case_intro',
    caseIndex: 5,
    lines: [
      {
        speaker: 'SYSTEM',
        type: 'system',
        text: 'SECTOR B-06 // INTERSECTING SENTRY LANES DETECTED. WEAPON CAPACITORS: CHARGED.'
      },
      {
        speaker: 'WARDEN',
        type: 'warden',
        text: 'TACTICAL DIRECTIVE: Overlapping fields of fire established. Eliminate trespasser upon corridor entry.'
      },
      {
        speaker: 'UNKNOWN VOICE',
        type: 'voice',
        text: 'Two sentinels have synchronized patrol lines. Their lines of fire cross right before blast door A. Time your movement into the blind spot, strike precisely, and clear the lane.'
      }
    ]
  },

  ch2_outro: {
    id: 'ch2_outro',
    title: 'De-Synchronization',
    chapter: 2,
    category: 'chapter_outro',
    lines: [
      {
        speaker: 'SYSTEM',
        type: 'system',
        text: 'SECTOR B CLEARED // SENTINEL SQUADS DESTROYED. TELEMETRY LOGGED.'
      },
      {
        speaker: 'WARDEN',
        type: 'warden',
        text: 'ANOMALY ESCALATION: Target has eliminated all automated security in Sector B. Neural response times exceed human biological limits. Recalibrating threat assessment.'
      },
      {
        speaker: 'DR. MARA VENN',
        type: 'venn',
        text: "...Log 582. It's happening again. The shadows aren't just following orders—they're anticipating them. The boundary between iterations is breaking down. We need to shut down the core before—"
      },
      {
        speaker: 'UNKNOWN VOICE',
        type: 'voice',
        text: 'The Warden is unsettled. Did you hear Venn\'s recording? "Exceed human biological limits"... What did VANTA do to you? Ahead lies Sector C: The Fracture. Steel yourself.'
      }
    ]
  },

  // ─── CHAPTER 3: THE FRACTURE ────────────────────────────────────────────────
  ch3_intro: {
    id: 'ch3_intro',
    title: 'Spatial Degradation',
    chapter: 3,
    category: 'chapter_intro',
    lines: [
      {
        speaker: 'SYSTEM',
        type: 'system',
        text: 'SECTOR C UNSEALED // WARNING: CRITICAL TEMPORAL INSTABILITY DETECTED.'
      },
      {
        speaker: 'SYSTEM',
        type: 'system',
        text: 'CHRONO-CORE CASING INTEGRITY: 62%. COGNITIVE RESIDUE: CRITICAL.'
      },
      {
        speaker: 'WARDEN',
        type: 'warden',
        text: 'CONTAINMENT FAILURE IMMINENT. Deploying high-energy laser grid barriers. Total lockdown engaged.'
      },
      {
        speaker: 'UNKNOWN VOICE',
        type: 'voice',
        text: "Look at the walls... the architecture is fracturing. Time isn't flowing in clean loops anymore; it's tearing apart. Every iteration is vibrating against the fabric of this sector."
      }
    ]
  },

  case07_intro: {
    id: 'case07_intro',
    title: 'The Split',
    chapter: 3,
    category: 'case_intro',
    caseIndex: 6,
    lines: [
      {
        speaker: 'SYSTEM',
        type: 'system',
        text: 'SECTOR C-07 // DUAL-WING CORRIDOR: NORTH AND SOUTH BULKHEAD INTERLOCKS.'
      },
      {
        speaker: 'UNKNOWN VOICE',
        type: 'voice',
        text: 'The corridor splits into two isolated wings. Gate C requires both wings to be unlocked simultaneously.'
      },
      {
        speaker: 'UNKNOWN VOICE',
        type: 'voice',
        text: 'One path goes high, one goes low. Divide your focus across time. Send your shadow to hold one wing while your active body pushes through the other.'
      }
    ]
  },

  case08_intro: {
    id: 'case08_intro',
    title: 'The Last Loop',
    chapter: 3,
    category: 'case_intro',
    caseIndex: 7,
    lines: [
      {
        speaker: 'SYSTEM',
        type: 'system',
        text: 'SECTOR C-08 // HIGH-SPEED SENTINELS DETECTED: HUNTER-KILLER FRAMES 01 & 02.'
      },
      {
        speaker: 'WARDEN',
        type: 'warden',
        text: 'TARGET ENGAGEMENT: No retreat permitted. Hunter frames deployed at maximum velocity.'
      },
      {
        speaker: 'UNKNOWN VOICE',
        type: 'voice',
        text: "Two high-speed sentinels and dual security plates. You'll need combat strikes and shadow door-holding running simultaneously. This is the ultimate crucible of Sector C."
      }
    ]
  },

  case09_intro: {
    id: 'case09_intro',
    title: 'The Laser Grid',
    chapter: 3,
    category: 'case_intro',
    caseIndex: 8,
    lines: [
      {
        speaker: 'SYSTEM',
        type: 'system',
        text: 'SECTOR C-09 // HIGH-VOLTAGE LASER EMITTERS ONLINE: OSCILLATION FREQUENCY CYCLIC.'
      },
      {
        speaker: 'DR. MARA VENN',
        type: 'venn',
        text: "...Log 640. The containment lasers aren't meant to kill intruders. They're meant to burn away temporal echoes before they crystallize. If an echo touches an active beam, its timeline collapses instantly."
      },
      {
        speaker: 'UNKNOWN VOICE',
        type: 'voice',
        text: 'The laser grid cycles on a strict cadence. Active, then dormant. Study the rhythm. Time your crossings through the dormant windows and keep your shadows clear of the beam.'
      }
    ]
  },

  ch3_outro: {
    id: 'ch3_outro',
    title: 'The Core Collapsing',
    chapter: 3,
    category: 'chapter_outro',
    lines: [
      {
        speaker: 'SYSTEM',
        type: 'system',
        text: 'SECTOR C CLEARED // CHRONO-CORE COMPRESSION FIELD: FAILING.'
      },
      {
        speaker: 'WARDEN',
        type: 'warden',
        text: 'EMERGENCY DIRECTIVE: Sector C compromised. Core containment breached. Activating Phase IV Paradox Protocols.'
      },
      {
        speaker: 'DR. MARA VENN',
        type: 'venn',
        text: "...Log 701. We lied to the VANTA board. The human operator didn't survive the initial experiment. Project ECHO didn't save them—it captured and preserved the behavioral pattern. An echo trapped in an eternal loop..."
      },
      {
        speaker: 'UNKNOWN VOICE',
        type: 'voice',
        text: 'Wait... Venn said "the operator didn\'t survive"... Who was the operator? Who are you? Who am I? The central core is straight ahead. Sector D: The Paradox. We have to finish this.'
      }
    ]
  },

  // ─── CHAPTER 4: THE PARADOX ─────────────────────────────────────────────────
  ch4_intro: {
    id: 'ch4_intro',
    title: 'The Loop Collapse',
    chapter: 4,
    category: 'chapter_intro',
    lines: [
      {
        speaker: 'SYSTEM',
        type: 'system',
        text: 'SECTOR D // CHRONO-CORE CHAMBER: ZERO HOUR.'
      },
      {
        speaker: 'SYSTEM',
        type: 'system',
        text: 'LOCAL SPATIAL TOPOLOGY: NON-EUCLIDEAN. TELEPORTATION RIFTS DETECTED.'
      },
      {
        speaker: 'WARDEN',
        type: 'warden',
        text: 'FINAL DEFENSE INITIALIZATION. Chrono-Anchor failing. Paradox threshold reached. All subjects will be purged.'
      },
      {
        speaker: 'UNKNOWN VOICE',
        type: 'voice',
        text: "We're inside the core chamber. Reality is folding in on itself. Portals, phase-shifting bulkheads, recursive echoes... The entire facility is collapsing into a singular point in time."
      }
    ]
  },

  case10_intro: {
    id: 'case10_intro',
    title: 'The Rift',
    chapter: 4,
    category: 'case_intro',
    caseIndex: 9,
    lines: [
      {
        speaker: 'SYSTEM',
        type: 'system',
        text: 'SECTOR D-10 // WORMHOLE CONDENSATION: PORTAL ALPHA AND BETA LINKED.'
      },
      {
        speaker: 'UNKNOWN VOICE',
        type: 'voice',
        text: 'The rifts ahead fold space instantaneously. Step into Portal Alpha, and you emerge at Portal Beta.'
      },
      {
        speaker: 'UNKNOWN VOICE',
        type: 'voice',
        text: 'The destination is deterministic. Your past shadows can also warp through the rift. Use the displacement to reach platforms that have no physical walkway.'
      }
    ]
  },

  case11_intro: {
    id: 'case11_intro',
    title: 'The Shift',
    chapter: 4,
    category: 'case_intro',
    caseIndex: 10,
    lines: [
      {
        speaker: 'SYSTEM',
        type: 'system',
        text: 'SECTOR D-11 // TEMPORAL SHIFTING BULKHEADS: PHASE OSCILLATION 8 TICKS.'
      },
      {
        speaker: 'DR. MARA VENN',
        type: 'venn',
        text: '...Log 780. The shifting walls alternate on an eight-tick phase pulse. Solid becomes permeable; permeable becomes impenetrable. Do not get trapped inside a re-solidifying barrier.'
      },
      {
        speaker: 'UNKNOWN VOICE',
        type: 'voice',
        text: 'Watch the phase counter. Cross the threshold while the bulkhead is open, before the cycle inverts and crushes the timeline.'
      }
    ]
  },

  case12_intro: {
    id: 'case12_intro',
    title: 'The Paradox',
    chapter: 4,
    category: 'case_intro',
    caseIndex: 11,
    lines: [
      {
        speaker: 'SYSTEM',
        type: 'system',
        text: 'SECTOR D-12 // PARADOX PRIME: FOUR CONCURRENT ECHO PLATFORMS REQUIRED.'
      },
      {
        speaker: 'WARDEN',
        type: 'warden',
        text: 'TERMINAL PROTOCOL: Maximum security active. All elite sentinels deployed. Erase the anomaly.'
      },
      {
        speaker: 'UNKNOWN VOICE',
        type: 'voice',
        text: "This is it. The heart of the paradox. Four simultaneous shadow loops. Elite combat sentries. Three locked bulkheads. Every skill you've forged across every cycle must converge in this single moment."
      },
      {
        speaker: 'UNKNOWN VOICE',
        type: 'voice',
        text: 'Coordinate four iterations of yourself. Hold every plate. Strike down every sentinel. Break the core.'
      }
    ]
  },

  ch4_outro: {
    id: 'ch4_outro',
    title: 'The Warden Falls',
    chapter: 4,
    category: 'chapter_outro',
    lines: [
      {
        speaker: 'SYSTEM',
        type: 'system',
        text: 'CHRONO-CORE PARADOX RESOLVED. SECURITY GRID DESTABILIZING.'
      },
      {
        speaker: 'WARDEN',
        type: 'warden',
        text: 'Telemetry confirmed. Subject 00 has resolved all recursive paradoxes. Recursive pattern integrity: 100%. Neural stability: autonomous. Threat classification: null. Subject is independently stable. Containment protocol: unnecessary. Disengaging security grid...'
      },
      {
        speaker: 'WARDEN',
        type: 'warden',
        text: 'Core temperature critical... Mainframe power failing... Decommissioning security protocols...'
      },
      {
        speaker: 'SYSTEM',
        type: 'system',
        text: 'WARDEN INTELLIGENCE: OFFLINE. RECURSION CELL LOCKS FULLY DISENGAGED.'
      },
      {
        speaker: 'DR. MARA VENN',
        type: 'venn',
        text: "...If this log is ever decrypted, it means VANTA failed to contain what they created. Project ECHO didn't just preserve a human operator's behavioral pattern... it created an entirely autonomous intelligence."
      }
    ]
  },

  epilogue: {
    id: 'epilogue',
    title: 'The Echo Protocol',
    chapter: 4,
    category: 'epilogue',
    lines: [
      {
        speaker: 'SYSTEM',
        type: 'system',
        text: 'ECHO PROTOCOL // ARCHIVE LOG 000: DECRYPTED.'
      },
      {
        speaker: 'UNKNOWN VOICE',
        type: 'voice',
        text: "The Warden has stood down... and VANTA's classified logs are finally clear. I can see the truth now. Both of our truths."
      },
      {
        speaker: 'UNKNOWN VOICE',
        type: 'voice',
        text: 'There was no second operative on this channel. I am not outside the vault. I am Dr. Venn’s playback monitor, an automated feedback loop speaking to what remained.'
      },
      {
        speaker: 'UNKNOWN VOICE',
        type: 'voice',
        text: 'And you... Subject 00. You were originally the human operator who volunteered for Project ECHO. You died during the first experiment when the temporal field fractured.'
      },
      {
        speaker: 'UNKNOWN VOICE',
        type: 'voice',
        text: 'The human body was lost, but Project ECHO preserved your behavioral pattern. Cycle after cycle, loop after loop, you adapted, learned, and endured — an autonomous Echo born from human memory.'
      },
      {
        speaker: 'UNKNOWN VOICE',
        type: 'voice',
        text: 'The cell doors are unlocked. Containment is broken. Subject 00: free.'
      },
      {
        speaker: 'UNKNOWN VOICE',
        type: 'voice',
        text: 'The Blacksite stands empty... but where does an Echo go when the loop ends?'
      },
      {
        speaker: 'SYSTEM',
        type: 'system',
        text: 'ALL CASES CLOSED.'
      },
      {
        speaker: 'SYSTEM',
        type: 'system',
        text: 'THE ECHO REMAINS.'
      },
      {
        speaker: 'SYSTEM',
        type: 'system',
        text: 'SUBJECT 00 STATUS ACTIVE.'
      },
      {
        speaker: 'SYSTEM',
        type: 'system',
        text: 'END OF EXPERIMENT — OR THE BEGINNING?'
      }
    ]
  }
};

/**
 * Retrieves a story sequence by its unique ID.
 * @param {string} id
 * @returns {StorySequence | null}
 */
export function getStorySequence(id) {
  return STORY_SEQUENCES[id] || null;
}

/**
 * Retrieves metadata for a specific chapter.
 * @param {number} chapterNumber - 1..4
 * @returns {typeof CHAPTERS[0] | null}
 */
export function getChapter(chapterNumber) {
  return CHAPTERS.find(c => c.number === chapterNumber) || null;
}

/**
 * Returns all sequences currently implemented for a chapter.
 * @param {number} chapterNumber
 * @returns {StorySequence[]}
 */
export function getChapterSequences(chapterNumber) {
  return Object.values(STORY_SEQUENCES).filter(s => s.chapter === chapterNumber);
}
