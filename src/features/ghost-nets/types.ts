import type { GearType, GhostNetStatus } from '@/types';
export const GEAR_LABELS: Record<GearType, string> = { net: 'Rete', longline: 'Palamito', trap: 'Nassa', rope: 'Cima / cavo', other: 'Altro' };
export const METHODS = { dive: 'Immersione', snorkel: 'Snorkeling / apnea', fishing: 'Uscita di pesca', sonar: 'Sonar / ecoscandaglio', rov: 'ROV / telecamera subacquea', other: 'Altro' };
export const STATUS_LABELS: Record<GhostNetStatus, string> = { reported: 'Da verificare', verified: 'Verificata', recovery_planned: 'Recupero pianificato', recovered: 'Recuperata', rejected: 'Respinta' };
export type Position = { lat: number; lng: number };
export type NearbyNet = Position & { id: string; gear_type: GearType; status: GhostNetStatus; depth_m: number | null; description: string | null; distance_m: number; observer_count: number; contributed: boolean };
export type ReviewNet = Omit<NearbyNet, 'distance_m' | 'contributed'> & { review_notes: string | null; observations: { id: string; method: keyof typeof METHODS; observed_at: string; description: string; evidence_url: string | null; lat: number; lng: number; depth_m: number | null }[] };
