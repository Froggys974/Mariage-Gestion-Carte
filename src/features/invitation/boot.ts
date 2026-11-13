/**
 * Données transmises par le serveur au script du site invité (JSON dans la page).
 * Partagé serveur / client : aucun import Node ici.
 */
import type { PhotoFrame } from '../card/photo-frame';
import type { WeddingLabels } from '../wedding/wedding';

export type GuestStatus = 'not_sent' | 'sent' | 'opened' | 'started' | 'submitted' | 'declined';

export interface BootSeat {
  id?: string;
  first: string;
  last: string;
  note: string;
}

export interface BootPhoto {
  avif: string;
  webp: string;
  fallback: string;
  width: number;
  height: number;
}

export interface BootCard {
  names: string;
  date: string;
  place: string;
  ceremony: string;
  reception: string;
  message: string;
  photo: BootPhoto | null;
  /** forme, point de cadrage et zoom de la photo */
  frame: PhotoFrame;
}

/** Un moment du programme de la journée */
export interface BootProgrammeItem {
  time: string;
  title: string;
  place: string;
  note: string;
}

export interface GuestBoot {
  /** null : page « / » sans lien personnel */
  token: string | null;
  /** email de l'invitation (proposé pour « Recevoir la carte par email ») */
  email: string | null;
  family: string;
  hostAgreement: 'invite' | 'invitee';
  maxSeats: number;
  /** 6 entrées (index = chaise) ; null = chaise libre */
  seats: Array<BootSeat | null>;
  status: GuestStatus | null;
  /** une réponse a déjà été envoyée (confirmée) */
  sent: boolean;
  declined: boolean;
  /** le brouillon diffère de la réponse envoyée */
  changed: boolean;
  updatedAt: string | null;
  draftUpdatedAt: string | null;
  deadlineLabel: string;
  closed: boolean;
  purgeLabel: string;
  publicRsvp: boolean;
  card: BootCard;
  programme: BootProgrammeItem[];
  /** infos du mariage (noms, date, lieu, contacts) saisies dans l'assistant d'installation */
  wedding: WeddingLabels;
}

export const SEAT_COUNT = 6;
