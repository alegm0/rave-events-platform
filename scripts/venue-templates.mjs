// Shared venue templates + picker, mirrored from src/lib/db.js so seeding
// scripts can assign a venue map to every event. Pure data, no side effects.

export const VENUE_LAYOUT_VERSION = 4

export const VENUE_TEMPLATES = {
  warehouse: {
    layout: 'indoor', setting: 'Warehouse · 2 escenarios',
    zones: [
      { id: 'main', label: 'Main Stage', type: 'stage', x: 6, y: 8, w: 88, h: 34 },
      { id: 'second', label: 'Concrete Room', type: 'stage', x: 52, y: 46, w: 42, h: 34 },
      { id: 'chill', label: 'Chill / Quiet Zone', type: 'quiet', x: 6, y: 46, w: 42, h: 34 },
    ],
    services: [
      { id: 'gate', type: 'entrance', label: 'Gate B (entrada sin escalones)', x: 38, y: 90, accessible: true, walkMin: 0 },
      { id: 'water1', type: 'water', label: 'Estación de agua', x: 62, y: 30, walkMin: 2 },
      { id: 'toilet1', type: 'toilet', label: 'Baños', x: 18, y: 88, walkMin: 3 },
      { id: 'toilet-acc', type: 'toilet', label: 'Baño accesible', x: 84, y: 88, accessible: true, walkMin: 3 },
      { id: 'firstaid', type: 'firstaid', label: 'First Aid', x: 26, y: 30, walkMin: 4 },
      { id: 'rest', type: 'rest', label: 'Zona de descanso', x: 71, y: 68, accessible: true, walkMin: 4 },
      { id: 'smoking', type: 'smoking', label: 'Smoking Area', x: 90, y: 30, walkMin: 3 },
      { id: 'exit', type: 'exit', label: 'Salida norte', x: 64, y: 90, walkMin: 3 },
    ],
    knowBeforeYouGo: ['Trae documento de identidad', 'No hay guardarropa', 'Transporte cercano: estación Fortitude Valley'],
  },
  club: {
    layout: 'indoor', setting: 'Club subterráneo · 1 escenario',
    zones: [
      { id: 'main', label: 'Dancefloor', type: 'stage', x: 6, y: 8, w: 88, h: 46 },
      { id: 'bar', label: 'Bar / Lounge', type: 'quiet', x: 6, y: 58, w: 88, h: 22 },
    ],
    services: [
      { id: 'gate', type: 'entrance', label: 'Entrada (con escaleras)', x: 28, y: 90, accessible: false, walkMin: 0 },
      { id: 'water1', type: 'water', label: 'Estación de agua', x: 18, y: 56, walkMin: 1 },
      { id: 'toilet1', type: 'toilet', label: 'Baños', x: 82, y: 56, walkMin: 2 },
      { id: 'rest', type: 'rest', label: 'Lounge para sentarse', x: 50, y: 68, accessible: true, walkMin: 2 },
      { id: 'exit', type: 'exit', label: 'Salida', x: 72, y: 90, walkMin: 2 },
    ],
    knowBeforeYouGo: ['Trae documento de identidad', 'La entrada tiene escaleras (sin acceso sin escalones)', 'Aforo reducido'],
  },
  festival: {
    layout: 'outdoor', setting: 'Aire libre · 3 escenarios',
    zones: [
      { id: 'main', label: 'Main Stage', type: 'stage', x: 6, y: 8, w: 88, h: 26 },
      { id: 'stage2', label: 'Sunset Stage', type: 'stage', x: 6, y: 38, w: 42, h: 26 },
      { id: 'stage3', label: 'Forest Stage', type: 'stage', x: 52, y: 38, w: 42, h: 26 },
      { id: 'chill', label: 'Quiet / Sensory Zone', type: 'quiet', x: 6, y: 68, w: 88, h: 16 },
    ],
    services: [
      { id: 'gate', type: 'entrance', label: 'Entrada principal (sin escalones)', x: 30, y: 92, accessible: true, walkMin: 0 },
      { id: 'water1', type: 'water', label: 'Agua (centro)', x: 50, y: 36, walkMin: 5 },
      { id: 'water2', type: 'water', label: 'Agua (este)', x: 90, y: 36, walkMin: 6 },
      { id: 'toilet-acc', type: 'toilet', label: 'Baños accesibles', x: 10, y: 66, accessible: true, walkMin: 5 },
      { id: 'firstaid', type: 'firstaid', label: 'First Aid', x: 90, y: 66, walkMin: 4 },
      { id: 'rest', type: 'rest', label: 'Zona de descanso', x: 50, y: 86, accessible: true, walkMin: 6 },
      { id: 'exit', type: 'exit', label: 'Salida de emergencia', x: 70, y: 92, walkMin: 5 },
    ],
    knowBeforeYouGo: ['Trae documento de identidad', 'Evento al aire libre: revisa el clima', 'Parqueadero accesible en puerta sur'],
  },
  gallery: {
    layout: 'indoor', setting: 'Galería de arte · 1 escenario',
    zones: [
      { id: 'main', label: 'Sala Principal', type: 'stage', x: 6, y: 8, w: 88, h: 44 },
      { id: 'chill', label: 'Sala tranquila', type: 'quiet', x: 6, y: 56, w: 88, h: 24 },
    ],
    services: [
      { id: 'gate', type: 'entrance', label: 'Entrada (sin escalones)', x: 28, y: 90, accessible: true, walkMin: 0 },
      { id: 'water1', type: 'water', label: 'Estación de agua', x: 20, y: 54, walkMin: 1 },
      { id: 'toilet-acc', type: 'toilet', label: 'Baño accesible', x: 82, y: 54, accessible: true, walkMin: 2 },
      { id: 'rest', type: 'rest', label: 'Bancas para descansar', x: 50, y: 68, accessible: true, walkMin: 2 },
      { id: 'exit', type: 'exit', label: 'Salida', x: 72, y: 90, walkMin: 2 },
    ],
    knowBeforeYouGo: ['Trae documento de identidad', 'Espacio íntimo, aforo limitado', 'Transporte cercano disponible'],
  },
}

export const pickVenueTemplate = (event) => {
  const g = (event.genre || '').toLowerCase()
  const loc = (event.location || '').toLowerCase()
  if ((event.capacity || 0) >= 1000 || loc.includes('parque') || loc.includes('festival') || loc.includes('riverstage') || loc.includes('open air')) return 'festival'
  if (loc.includes('galer') || loc.includes('gallery') || g.includes('minimal')) return 'gallery'
  if (loc.includes('club') || loc.includes('subterr') || g.includes('house')) return 'club'
  return 'warehouse'
}

export const venueForEvent = (event) => VENUE_TEMPLATES[pickVenueTemplate(event)]
