// Warehouse floor plan — hand-composed top-down layout (SVG, viewBox 0 0 100 100).
// This is the BASE map: walls, rooms, dancefloor, openings and accesses.
// It must read as a coherent physical space on its own, before any pin overlay.
//
// Design intent (not rigid rules — this is one convincing composition):
//   - Thick continuous outer walls = the building shell.
//   - Main Stage against the top wall, raised platform in front.
//   - A big open Main Floor (dancefloor) is the negative space you move through.
//   - Two back rooms (Concrete Room + Chill/Quiet) share walls and connect to the
//     floor through real door openings (gaps in the walls), reached via a corridor.
//   - Two accesses cut into the bottom wall (entrance + exit).
//
// Anchors exported so the service-pin layer can sit at meaningful spots
// (centre of a room, beside the stage, in the corridor…). Coordinates 0-100.

export const warehouseAnchors = {
  main: { x: 50, y: 26 },        // main floor (in front of stage)
  stage: { x: 50, y: 12 },       // on the stage
  concrete: { x: 30, y: 74 },    // concrete room centre
  chill: { x: 71, y: 74 },       // chill / quiet room centre
  corridor: { x: 50, y: 60 },    // corridor linking floor to back rooms
  entrance: { x: 38, y: 95 },    // door in bottom wall
  exit: { x: 64, y: 95 },        // door in bottom wall
  leftWall: { x: 12, y: 50 },
  rightWall: { x: 88, y: 44 },
}

// Waypoints define a walkable route from a start anchor to any point.
// We route via the corridor so lines don't cut through walls.
export const warehouseRoute = (from, to) => {
  // from/to are {x,y}. Everything below y=52 is "back rooms" reached via corridor.
  const backZone = (p) => p.y > 52
  const corridor = { x: 50, y: 56 }
  const pts = [from]
  if (backZone(from) !== backZone(to)) {
    // cross the wall through the corridor opening
    pts.push({ x: from.x < 42 || from.x > 58 ? 50 : from.x, y: 50 })
    pts.push(corridor)
  }
  pts.push(to)
  return pts
}

const WarehouseFloorPlan = () => (
  <g className="fp fp-warehouse">
    {/* ── building shell: thick outer walls with door gaps in bottom wall ── */}
    {/* We draw the interior floor fill first, then the walls on top. */}
    <rect x="6" y="6" width="88" height="88" className="fp-floor" rx="1" />

    {/* dancefloor texture: subtle crowd dots over the main floor area */}
    <g className="fp-crowd" clipPath="url(#fp-floor-clip)">
      {crowdDots()}
    </g>
    <defs>
      <clipPath id="fp-floor-clip">
        <rect x="8" y="20" width="84" height="30" />
      </clipPath>
    </defs>

    {/* ── MAIN STAGE against the top wall ── */}
    <g className="fp-stage-g">
      {/* stage recess */}
      <rect x="22" y="8" width="56" height="9" className="fp-stage" rx="0.8" />
      {/* raised platform lip facing the crowd */}
      <rect x="24" y="15.5" width="52" height="2.2" className="fp-stage-lip" rx="0.8" />
      {/* DJ booth hint */}
      <rect x="46" y="10" width="8" height="4" className="fp-booth" rx="0.6" />
      <text x="50" y="12.6" className="fp-label fp-label-stage" textAnchor="middle" dominantBaseline="middle">MAIN STAGE</text>
    </g>

    {/* MAIN FLOOR label sits in the open dancefloor */}
    <text x="50" y="34" className="fp-label fp-label-floor" textAnchor="middle">MAIN FLOOR</text>
    <text x="50" y="38" className="fp-sublabel" textAnchor="middle">dancefloor</text>

    {/* ── back rooms: two rooms sharing a middle wall, with door openings ── */}
    {/* horizontal wall separating the front floor from the back rooms,
        broken by a central corridor opening */}
    <path d="M6 52 H42 M58 52 H94" className="fp-wall fp-wall-inner" />
    {/* corridor walls leading from the opening down between the rooms */}
    <path d="M42 52 V66 M58 52 V66" className="fp-wall fp-wall-inner" />

    {/* Concrete Room (left back) */}
    <rect x="6" y="52" width="36" height="42" className="fp-room" />
    <text x="24" y="60" className="fp-label fp-label-room" textAnchor="middle">CONCRETE ROOM</text>
    {/* door opening from corridor into concrete room (gap rendered as light sill) */}
    <rect x="41" y="58" width="2" height="6" className="fp-door" />

    {/* Chill / Quiet Room (right back) */}
    <rect x="58" y="52" width="36" height="42" className="fp-room fp-room-quiet" />
    <text x="76" y="60" className="fp-label fp-label-room" textAnchor="middle">CHILL / QUIET</text>
    <rect x="57" y="58" width="2" height="6" className="fp-door" />

    {/* ── outer walls on top (thick shell) with door gaps in the bottom ── */}
    {/* top / left / right continuous; bottom split into segments to leave doors */}
    <path
      d="M6 94 V6 H94 V94"
      className="fp-wall fp-wall-outer"
      fill="none"
    />
    {/* bottom wall segments (gaps = entrance & exit) */}
    <path d="M6 94 H34 M42 94 H60 M68 94 H94" className="fp-wall fp-wall-outer" />

    {/* access markers built into the geometry (door thresholds) */}
    <g className="fp-access">
      <rect x="34" y="92.5" width="8" height="3" className="fp-threshold" />
      <text x="38" y="99" className="fp-access-label" textAnchor="middle">ENTRADA</text>
      <rect x="60" y="92.5" width="8" height="3" className="fp-threshold" />
      <text x="64" y="99" className="fp-access-label" textAnchor="middle">SALIDA</text>
    </g>
  </g>
)

// deterministic scatter of tiny dots to suggest a crowd on the dancefloor
function crowdDots() {
  const dots = []
  let seed = 7
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
  for (let i = 0; i < 90; i++) {
    const x = 10 + rnd() * 80
    const y = 21 + rnd() * 28
    dots.push(<circle key={i} cx={x} cy={y} r="0.5" className="fp-crowd-dot" />)
  }
  return dots
}

export default WarehouseFloorPlan
