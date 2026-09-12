import type { ColorValue } from 'react-native'
import {
  Activity,
  ArrowLeft,
  Bell,
  Camera,
  CheckCircle,
  ChevronRight,
  Circle,
  Clock,
  FileText,
  Home,
  Landmark,
  Map,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Trash2,
  User,
  Users,
} from 'lucide-react-native'

import { colors, iconography } from '../theme/vertice'

const ICONS = {
  home: Home,
  community: Users,
  actions: CheckCircle,
  territory: MapPin,
  governance: Landmark,
  profile: User,
  chevronRight: ChevronRight,
  back: ArrowLeft,
  notifications: Bell,
  verified: ShieldCheck,
  checkCircle: CheckCircle,
  circle: Circle,
  delete: Trash2,
  report: FileText,
  map: Map,
  evidence: Camera,
  timeline: Clock,
  refresh: RefreshCw,
  signal: Activity,
} as const

export type VerticeIconName = keyof typeof ICONS

interface VerticeIconProps {
  name: VerticeIconName
  color?: ColorValue
  size?: number
  strokeWidth?: number
}

/**
 * Canonical icon boundary for VÉRTICE native clients.
 *
 * Product code should request a semantic icon name from this adapter instead
 * of importing arbitrary icon families. The adapter owns the Lucide family,
 * 24px grid and canonical stroke contract shared with Web.
 */
export function VerticeIcon({
  name,
  color = colors.navy,
  size = iconography.sizes.standard,
  strokeWidth = iconography.strokeWidth,
}: VerticeIconProps) {
  const Icon = ICONS[name]
  return <Icon color={color} size={size} strokeWidth={strokeWidth} />
}
