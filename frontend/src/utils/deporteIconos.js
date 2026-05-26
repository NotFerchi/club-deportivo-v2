import {
  Activity, Bike, CircleDot, Dumbbell, Flag,
  Flame, Heart, MapPin, Music2, Shield,
  Target, Waves, Building2, Swords, Zap
} from 'lucide-react';

function norm(str) {
  return String(str || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

const RULES = [
  // Acuáticos
  { keys: ['alberca', 'natacion', 'piscina', 'acuatic', 'swimming'], Icon: Waves,     color: '#0284c7', bg: '#e0f2fe' },
  // Raqueta / pared
  { keys: ['tenis', 'tennis'],                                        Icon: Target,    color: '#1d4ed8', bg: '#dbeafe' },
  { keys: ['padel', 'paddle'],                                        Icon: Target,    color: '#7c3aed', bg: '#ede9fe' },
  { keys: ['squash'],                                                 Icon: Target,    color: '#0d9488', bg: '#ccfbf1' },
  { keys: ['fronton', 'frontenis'],                                   Icon: Target,    color: '#d97706', bg: '#fef3c7' },
  { keys: ['badminton'],                                              Icon: Target,    color: '#db2777', bg: '#fce7f3' },
  // Pelota / cancha
  { keys: ['futbol', 'soccer', 'football'],                          Icon: CircleDot, color: '#059669', bg: '#d1fae5' },
  { keys: ['basket', 'basquet', 'basquetbol'],                       Icon: CircleDot, color: '#f97316', bg: '#fff7ed' },
  { keys: ['volei', 'volley', 'voleibol'],                           Icon: CircleDot, color: '#0284c7', bg: '#e0f2fe' },
  { keys: ['multiusos', 'multiple', 'multideporte'],                 Icon: CircleDot, color: '#64748b', bg: '#f1f5f9' },
  // Fitness / pesas
  { keys: ['fuerza', 'pesas', 'musculacion', 'crossfit'],            Icon: Dumbbell,  color: '#1d4ed8', bg: '#dbeafe' },
  { keys: ['gimnasio', 'gym', 'fitness'],                            Icon: Dumbbell,  color: '#6366f1', bg: '#ede9fe' },
  { keys: ['cardio'],                                                 Icon: Heart,     color: '#dc2626', bg: '#fee2e2' },
  // Ciclo / spinning
  { keys: ['spinning', 'ciclo', 'cycling', 'bicicleta'],             Icon: Bike,      color: '#7c3aed', bg: '#ede9fe' },
  // Baile / música
  { keys: ['zumba', 'baile', 'danza', 'dance', 'aerobics'],         Icon: Music2,    color: '#db2777', bg: '#fce7f3' },
  // Yoga / pilates
  { keys: ['yoga', 'pilates', 'meditacion', 'mindfulness'],          Icon: Flame,     color: '#f97316', bg: '#fff7ed' },
  // Atletismo / pista
  { keys: ['caminata', 'trote', 'atletismo', 'pista', 'running'],   Icon: Activity,  color: '#059669', bg: '#d1fae5' },
  // Golf
  { keys: ['golf'],                                                   Icon: Flag,      color: '#65a30d', bg: '#ecfccb' },
  // Artes marciales
  { keys: ['karate', 'judo', 'taekwondo', 'box', 'lucha', 'mma', 'artes marciales', 'esgrima'], Icon: Swords, color: '#dc2626', bg: '#fee2e2' },
  // Funcional / HIIT
  { keys: ['funcional', 'hiit', 'trx'],                              Icon: Zap,       color: '#f59e0b', bg: '#fef3c7' },
  // Artes / defensa
  { keys: ['defensa', 'combate', 'shield'],                          Icon: Shield,    color: '#475569', bg: '#f1f5f9' },
  // Salones / eventos
  { keys: ['salon', 'eventos', 'auditorio', 'sala', 'showroom', 'sotano', 'actividad de piso'], Icon: Building2, color: '#64748b', bg: '#f1f5f9' },
];

export function getDeporteIcono(nombre) {
  const n = norm(nombre);
  for (const rule of RULES) {
    if (rule.keys.some(k => n.includes(k))) {
      return { Icon: rule.Icon, color: rule.color, bg: rule.bg };
    }
  }
  return { Icon: MapPin, color: '#64748b', bg: '#f1f5f9' };
}
