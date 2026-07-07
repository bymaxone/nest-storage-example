/**
 * @fileoverview Typed navigation table for the storage dashboard sidebar.
 *
 * Routes are grouped into four sections: Vault / Transfer / Labs / System.
 * Each item carries its route `href` and a `lucide-react` icon.
 *
 * @module components/layout/nav-items
 */

import {
  LayoutDashboard,
  FolderOpen,
  Upload,
  Globe,
  Link,
  ShieldCheck,
  ScanLine,
  Building2,
  TriangleAlert,
  Server,
  type LucideIcon,
} from 'lucide-react'

/** A single navigation entry: visible label, route, and its icon. */
export interface NavItem {
  /** Human-readable label shown in the rail. */
  label: string
  /** App Router route the item links to. */
  href: string
  /** Lucide icon rendered beside the label. */
  icon: LucideIcon
}

/** A labelled group of navigation entries. */
export interface NavGroup {
  /** Section heading (rendered uppercase). */
  group: string
  /** Entries belonging to this section. */
  items: readonly NavItem[]
}

/** The grouped nav model for the storage dashboard. */
export const NAV_GROUPS: readonly NavGroup[] = [
  {
    group: 'Vault',
    items: [
      { label: 'Overview', href: '/', icon: LayoutDashboard },
      { label: 'Browser', href: '/vault', icon: FolderOpen },
    ],
  },
  {
    group: 'Transfer',
    items: [
      { label: 'Upload Lab', href: '/upload', icon: Upload },
      { label: 'Direct Upload', href: '/direct', icon: Globe },
      { label: 'Signed URLs', href: '/signed', icon: Link },
    ],
  },
  {
    group: 'Labs',
    items: [
      { label: 'Validation', href: '/validation', icon: ShieldCheck },
      { label: 'Scanner', href: '/scanner', icon: ScanLine },
      { label: 'Tenants', href: '/tenants', icon: Building2 },
      { label: 'Errors', href: '/errors', icon: TriangleAlert },
    ],
  },
  {
    group: 'System',
    items: [{ label: 'System', href: '/system', icon: Server }],
  },
]
