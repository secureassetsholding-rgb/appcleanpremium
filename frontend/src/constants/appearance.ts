import type { LucideIcon } from 'lucide-react'
import {
  Sun,
  Moon,
  Sparkles,
  Palette,
  Flame,
  Gem,
  Snowflake,
  Droplets,
  Crown,
} from 'lucide-react'

export type ThemeId =
  | 'default'
  | 'nightfall'
  | 'premium'
  | 'emerald'
  | 'sunset'
  | 'oceanic'
  | 'graphite'
  | 'royal'
  | 'blush'
  | 'amber'

export type ThemeOption = {
  id: ThemeId
  name: string
  description: string
  icon: LucideIcon
  colors: { primary: string; secondary: string; accent: string }
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'default',
    name: 'Skyline Blue',
    description: 'Original Bright Works palette with executive blue accents.',
    icon: Sun,
    colors: { primary: '#3b82f6', secondary: '#2563eb', accent: '#1d4ed8' },
  },
  {
    id: 'nightfall',
    name: 'Nightfall Indigo',
    description: 'Deep indigo layers for nocturnal operations.',
    icon: Moon,
    colors: { primary: '#312e81', secondary: '#4338ca', accent: '#3730a3' },
  },
  {
    id: 'premium',
    name: 'Cyan Premium',
    description: 'High-end cyan & teal combination for a futuristic feel.',
    icon: Sparkles,
    colors: { primary: '#0ea5e9', secondary: '#0284c7', accent: '#0369a1' },
  },
  {
    id: 'emerald',
    name: 'Emerald Executive',
    description: 'Calming green spectrum ideal for hospitality environments.',
    icon: Palette,
    colors: { primary: '#10b981', secondary: '#059669', accent: '#047857' },
  },
  {
    id: 'sunset',
    name: 'Sunset Amber',
    description: 'Warm amber gradients inspired by evening service windows.',
    icon: Flame,
    colors: { primary: '#fb923c', secondary: '#f97316', accent: '#ea580c' },
  },
  {
    id: 'oceanic',
    name: 'Oceanic Teal',
    description: 'Marine tones for coastal resorts and spas.',
    icon: Droplets,
    colors: { primary: '#14b8a6', secondary: '#0d9488', accent: '#0f766e' },
  },
  {
    id: 'graphite',
    name: 'Graphite Steel',
    description: 'Neutral graphite finish for corporate facilities.',
    icon: Gem,
    colors: { primary: '#64748b', secondary: '#475569', accent: '#334155' },
  },
  {
    id: 'royal',
    name: 'Royal Velvet',
    description: 'Purple and magenta treatment for exclusive venues.',
    icon: Crown,
    colors: { primary: '#a855f7', secondary: '#9333ea', accent: '#7e22ce' },
  },
  {
    id: 'blush',
    name: 'Blush Quartz',
    description: 'Sophisticated coral highlights for boutique experiences.',
    icon: Sparkles,
    colors: { primary: '#f472b6', secondary: '#ec4899', accent: '#db2777' },
  },
  {
    id: 'amber',
    name: 'Polar Frost',
    description: 'Cool ice-blue palette for clinical or laboratory settings.',
    icon: Snowflake,
    colors: { primary: '#38bdf8', secondary: '#0ea5e9', accent: '#0284c7' },
  },
]

export type TaskBackgroundId = 'midnight' | 'pearl' | 'petrol'

export type TaskBackgroundOption = {
  id: TaskBackgroundId
  name: string
  description: string
  previewClass: string
}

export const TASK_BACKGROUND_OPTIONS: TaskBackgroundOption[] = [
  {
    id: 'midnight',
    name: 'Midnight Slate',
    description: 'Default premium dark slate with electric highlights.',
    previewClass: 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800',
  },
  {
    id: 'pearl',
    name: 'Pearl Graphite',
    description: 'Soft graphite finish with pearl reflections.',
    previewClass: 'bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800',
  },
  {
    id: 'petrol',
    name: 'Petrol Teal',
    description: 'Teal-infused carbon background with subtle glow.',
    previewClass: 'bg-gradient-to-br from-slate-900 via-cyan-900/40 to-slate-900',
  },
]

export const TASK_BACKGROUND_PRESETS: Record<
  TaskBackgroundId,
  {
    container: string
    headerBg: string
    headerBorder: string
    rowEven: string
    rowOdd: string
    cellEven: string
    cellOdd: string
    dayHeaderEven: string
    dayHeaderOdd: string
    dayHeaderHover: string
    cellHover: string
  }
> = {
  midnight: {
    container: 'border border-slate-800 bg-slate-900/70 shadow-xl shadow-slate-950/40',
    headerBg: 'bg-gradient-to-r from-primary-500 via-primary-600 to-primary-500',
    headerBorder: 'border-slate-800',
    rowEven: 'bg-slate-900/20',
    rowOdd: 'bg-slate-900/40',
    cellEven: 'bg-slate-900/10',
    cellOdd: 'bg-slate-900/30',
    dayHeaderEven: 'bg-slate-900/70 text-primary-100',
    dayHeaderOdd: 'bg-slate-900/40 text-slate-300',
    dayHeaderHover: 'bg-primary-500/25 text-white',
    cellHover: 'bg-primary-500/10',
  },
  pearl: {
    container: 'border border-slate-600/60 bg-slate-900/80 shadow-xl shadow-slate-900/30',
    headerBg: 'bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700',
    headerBorder: 'border-slate-600/80',
    rowEven: 'bg-slate-900/30',
    rowOdd: 'bg-slate-900/50',
    cellEven: 'bg-slate-900/20',
    cellOdd: 'bg-slate-900/35',
    dayHeaderEven: 'bg-slate-800/70 text-slate-200',
    dayHeaderOdd: 'bg-slate-800/40 text-slate-300',
    dayHeaderHover: 'bg-slate-700/60 text-white',
    cellHover: 'bg-slate-700/40',
  },
  petrol: {
    container: 'border border-cyan-500/30 bg-slate-950/80 shadow-xl shadow-cyan-900/30',
    headerBg: 'bg-gradient-to-r from-cyan-500 via-sky-500 to-cyan-600',
    headerBorder: 'border-cyan-500/40',
    rowEven: 'bg-slate-950/35',
    rowOdd: 'bg-slate-950/55',
    cellEven: 'bg-slate-950/25',
    cellOdd: 'bg-slate-950/40',
    dayHeaderEven: 'bg-slate-950/60 text-cyan-100',
    dayHeaderOdd: 'bg-slate-950/40 text-slate-200',
    dayHeaderHover: 'bg-cyan-500/20 text-white',
    cellHover: 'bg-cyan-500/10',
  },
}

export type CheckboxStyleId = 'classic' | 'round' | 'minimal'

export type CheckboxStyleOption = {
  id: CheckboxStyleId
  name: string
  description: string
  previewClass: string
}

export const CHECKBOX_STYLE_OPTIONS: CheckboxStyleOption[] = [
  {
    id: 'classic',
    name: 'Classic Square',
    description: 'Rounded square with premium glow and gradient fill.',
    previewClass: 'h-6 w-6 rounded-lg border-2 border-slate-500 bg-slate-800',
  },
  {
    id: 'round',
    name: 'Round Luxe',
    description: 'Circular pill toggles with luxury sheen.',
    previewClass: 'h-6 w-6 rounded-full border-2 border-slate-400 bg-slate-800',
  },
  {
    id: 'minimal',
    name: 'Minimal Outline',
    description: 'Lightweight outline with accent highlight on completion.',
    previewClass: 'h-6 w-6 rounded-md border border-slate-500 bg-transparent',
  },
]

export const CHECKBOX_STYLE_PRESETS: Record<
  CheckboxStyleId,
  {
    base: string
    idle: string
    hover: string
    completed: string
  }
> = {
  classic: {
    base: 'rounded-lg border-2',
    idle: 'border-slate-600 bg-slate-800 text-slate-500',
    hover: 'border-primary-400 bg-primary-500/20 text-primary-200',
    completed: 'border-emerald-400 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-500/40',
  },
  round: {
    base: 'rounded-full border-2',
    idle: 'border-slate-500 bg-slate-800 text-slate-300',
    hover: 'border-primary-300 bg-primary-500/15 text-primary-100',
    completed: 'border-emerald-400 bg-emerald-500 text-white shadow-lg shadow-emerald-500/30',
  },
  minimal: {
    base: 'rounded-md border',
    idle: 'border-slate-500 bg-transparent text-slate-400',
    hover: 'border-primary-400 bg-primary-500/10 text-primary-200',
    completed: 'border-transparent bg-emerald-500 text-white shadow-none',
  },
}

export type FontFamilyId = 'sans' | 'serif' | 'mono' | 'inter' | 'roboto' | 'open-sans'

export type FontFamilyOption = {
  id: FontFamilyId
  name: string
  description: string
  fontFamily: string
}

export const FONT_FAMILY_OPTIONS: FontFamilyOption[] = [
  {
    id: 'sans',
    name: 'System Sans',
    description: 'Default system sans-serif font',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  {
    id: 'inter',
    name: 'Inter',
    description: 'Modern, clean sans-serif',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  {
    id: 'roboto',
    name: 'Roboto',
    description: 'Google Material Design font',
    fontFamily: 'Roboto, sans-serif',
  },
  {
    id: 'open-sans',
    name: 'Open Sans',
    description: 'Humanist sans-serif',
    fontFamily: 'Open Sans, sans-serif',
  },
  {
    id: 'serif',
    name: 'Serif',
    description: 'Classic serif font',
    fontFamily: 'Georgia, serif',
  },
  {
    id: 'mono',
    name: 'Monospace',
    description: 'Fixed-width font',
    fontFamily: 'JetBrains Mono, monospace',
  },
]

export type FontWeightId = 'light' | 'normal' | 'medium' | 'semibold' | 'bold'

export type FontWeightOption = {
  id: FontWeightId
  name: string
  weight: number
}

export const FONT_WEIGHT_OPTIONS: FontWeightOption[] = [
  { id: 'light', name: 'Light', weight: 300 },
  { id: 'normal', name: 'Normal', weight: 400 },
  { id: 'medium', name: 'Medium', weight: 500 },
  { id: 'semibold', name: 'Semibold', weight: 600 },
  { id: 'bold', name: 'Bold', weight: 700 },
]

export type ButtonStyleId = 'default' | 'rounded' | 'square' | 'pill' | 'outline' | 'gradient'

export type ButtonStyleOption = {
  id: ButtonStyleId
  name: string
  description: string
  previewClass: string
}

export const BUTTON_STYLE_OPTIONS: ButtonStyleOption[] = [
  {
    id: 'default',
    name: 'Default',
    description: 'Standard button style',
    previewClass: 'rounded-lg border border-primary-500 bg-primary-600',
  },
  {
    id: 'rounded',
    name: 'Rounded',
    description: 'Rounded corners',
    previewClass: 'rounded-xl border border-primary-500 bg-primary-600',
  },
  {
    id: 'square',
    name: 'Square',
    description: 'Sharp corners',
    previewClass: 'rounded border border-primary-500 bg-primary-600',
  },
  {
    id: 'pill',
    name: 'Pill',
    description: 'Fully rounded',
    previewClass: 'rounded-full border border-primary-500 bg-primary-600',
  },
  {
    id: 'outline',
    name: 'Outline',
    description: 'Transparent with border',
    previewClass: 'rounded-lg border-2 border-primary-500 bg-transparent',
  },
  {
    id: 'gradient',
    name: 'Gradient',
    description: 'Gradient background',
    previewClass: 'rounded-lg bg-gradient-to-r from-primary-500 to-primary-600',
  },
]

export type ButtonSizeId = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export type ButtonSizeOption = {
  id: ButtonSizeId
  name: string
  padding: string
  fontSize: string
}

export const BUTTON_SIZE_OPTIONS: ButtonSizeOption[] = [
  { id: 'xs', name: 'Extra Small', padding: 'px-2 py-1', fontSize: 'text-xs' },
  { id: 'sm', name: 'Small', padding: 'px-3 py-1.5', fontSize: 'text-sm' },
  { id: 'md', name: 'Medium', padding: 'px-4 py-2', fontSize: 'text-base' },
  { id: 'lg', name: 'Large', padding: 'px-6 py-3', fontSize: 'text-lg' },
  { id: 'xl', name: 'Extra Large', padding: 'px-8 py-4', fontSize: 'text-xl' },
]
