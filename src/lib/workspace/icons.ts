/**
 * Bounded icon registry for workspace objects. Templates and the AI generator
 * pick icons BY NAME from this list only (`isWorkspaceIcon` gates the blueprint
 * schema), so arbitrary strings can never reach the renderer. `iconFor` maps a
 * stored name back to its lucide component with a safe fallback.
 */
import {
  Banknote,
  Box,
  Briefcase,
  Building2,
  Calendar,
  CalendarCheck,
  CalendarClock,
  Car,
  ChartColumn,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  Dumbbell,
  FileText,
  FolderOpen,
  Gavel,
  GraduationCap,
  Hammer,
  Handshake,
  HeartPulse,
  Home,
  Kanban,
  KeyRound,
  MapPin,
  Megaphone,
  Package,
  Phone,
  Receipt,
  Scale,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Target,
  Truck,
  UserRound,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

export const WORKSPACE_ICONS = {
  banknote: Banknote,
  box: Box,
  briefcase: Briefcase,
  building: Building2,
  calendar: Calendar,
  'calendar-check': CalendarCheck,
  'calendar-clock': CalendarClock,
  car: Car,
  chart: ChartColumn,
  'clipboard-check': ClipboardCheck,
  'clipboard-list': ClipboardList,
  'credit-card': CreditCard,
  dumbbell: Dumbbell,
  'file-text': FileText,
  'folder-open': FolderOpen,
  gavel: Gavel,
  'graduation-cap': GraduationCap,
  hammer: Hammer,
  handshake: Handshake,
  'heart-pulse': HeartPulse,
  home: Home,
  kanban: Kanban,
  key: KeyRound,
  'map-pin': MapPin,
  megaphone: Megaphone,
  package: Package,
  phone: Phone,
  receipt: Receipt,
  scale: Scale,
  'shield-check': ShieldCheck,
  sparkles: Sparkles,
  stethoscope: Stethoscope,
  target: Target,
  truck: Truck,
  user: UserRound,
  users: Users,
  wrench: Wrench,
} as const satisfies Record<string, LucideIcon>

export type WorkspaceIconName = keyof typeof WORKSPACE_ICONS

export const WORKSPACE_ICON_NAMES = Object.keys(WORKSPACE_ICONS) as WorkspaceIconName[]

export function isWorkspaceIcon(name: unknown): name is WorkspaceIconName {
  return typeof name === 'string' && name in WORKSPACE_ICONS
}

/** Icon component for a stored name; unknown/missing names render as a box. */
export function iconFor(name?: string | null): LucideIcon {
  return isWorkspaceIcon(name) ? WORKSPACE_ICONS[name] : Box
}
