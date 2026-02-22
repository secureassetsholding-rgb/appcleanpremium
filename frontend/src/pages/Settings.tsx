import { ChangeEvent, DragEvent, FormEvent, KeyboardEvent, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Save,
  Plus,
  Edit2,
  Trash2,
  Palette,
  Sun,
  Sparkles,
  Contrast,
  Bell,
  Camera,
  User as UserIcon,
  RotateCcw,
  Smartphone,
  ArrowUp,
  ArrowDown,
  GripVertical,
  X,
  CheckCircle2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { configService } from '../services/config'
import { TaskConfig, TaskSection } from '../types'
import { useAuth } from '../contexts/AuthContext'
import { pushNotificationService } from '../services/pushNotifications'
import { cn } from '../lib/utils'
import {
  THEME_OPTIONS,
  TASK_BACKGROUND_OPTIONS,
  CHECKBOX_STYLE_OPTIONS,
  FONT_FAMILY_OPTIONS,
  FONT_WEIGHT_OPTIONS,
  BUTTON_STYLE_OPTIONS,
  BUTTON_SIZE_OPTIONS,
  ThemeId,
  TaskBackgroundId,
  CheckboxStyleId,
  FontFamilyId,
  FontWeightId,
  ButtonStyleId,
  ButtonSizeId,
} from '../constants/appearance'


const CONFIG_VERSION = 1

interface SectionDraft {
  id?: string
  title: string
  icon?: string
  tasks: string[]
}

interface SectionEditorProps {
  open: boolean
  draft: SectionDraft | null
  onSave: (draft: SectionDraft) => void
  onClose: () => void
}

type NotificationKey = 'email' | 'tasks' | 'reminders' | 'reports' | 'sections'
type NotificationPreferences = Record<NotificationKey, boolean>

type CustomColors = {
  primary: string
  secondary: string
  accent: string
}

const defaultColors: CustomColors = {
  primary: '#3b82f6',
  secondary: '#8b5cf6',
  accent: '#10b981',
}

const notificationOptions: Array<{ key: NotificationKey; label: string; description: string }> = [
  { key: 'email', label: 'Email Notifications', description: 'Receive a summary of important updates via email.' },
  { key: 'tasks', label: 'Task Completion', description: 'Get notified when tasks are completed or reassigned.' },
  { key: 'reminders', label: 'Reminders', description: 'Reminder alerts for scheduled cleanings and follow-ups.' },
  { key: 'reports', label: 'Daily Reports', description: 'Daily activity report delivered straight to your inbox.' },
  { key: 'sections', label: 'Section Completion', description: 'Celebrate when a full section is completed on time.' },
]

const generateSectionId = () => `section-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

function SectionEditor({ open, draft, onSave, onClose }: SectionEditorProps) {
  const [title, setTitle] = useState('')
  const [icon, setIcon] = useState('')
  const [tasks, setTasks] = useState<string[]>([])
  const [taskInput, setTaskInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setTitle(draft?.title ?? '')
    setIcon(draft?.icon ?? '')
    setTasks(draft?.tasks ?? [])
    setTaskInput('')
    setError(null)
  }, [open, draft])

  const addTask = () => {
    const trimmed = taskInput.trim()
    if (!trimmed) return
    if (tasks.some((task) => task.toLowerCase() === trimmed.toLowerCase())) {
      setError('This task is already in the list')
      return
    }
    setTasks((prev) => [...prev, trimmed])
    setTaskInput('')
    setError(null)
  }

  const updateTask = (index: number, value: string) => {
    setTasks((prev) => {
      const updated = [...prev]
      updated[index] = value
      return updated
    })
  }

  const removeTask = (index: number) => {
    setTasks((prev) => prev.filter((_, i) => i !== index))
  }

  const moveTask = (index: number, direction: number) => {
    setTasks((prev) => {
      const targetIndex = index + direction
      if (targetIndex < 0 || targetIndex >= prev.length) return prev
      const updated = [...prev]
      const [moved] = updated.splice(index, 1)
      updated.splice(targetIndex, 0, moved)
      return updated
    })
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedTitle = title.trim()
    const normalizedTasks = tasks.map((task) => task.trim()).filter(Boolean)

    if (!trimmedTitle) {
      setError('Section title is required')
      return
    }
    if (normalizedTasks.length === 0) {
      setError('Add at least one task to the section')
      return
    }

    onSave({
      id: draft?.id,
      title: trimmedTitle,
      icon: icon.trim() || undefined,
      tasks: normalizedTasks,
    })
  }

  const handleTaskInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      addTask()
    }
  }

  if (!open) {
    return null
  }

  // Ensure all props are valid
  if (!onSave || !onClose) {
    console.error('SectionEditor: Missing required props', { onSave, onClose })
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-white">{draft?.id ? 'Edit Section' : 'Create Section'}</h2>
            <p className="mt-1 text-sm text-slate-400">
              Define the tasks and visual identity for this section. Changes are local until you press “Save Changes”.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-600 bg-slate-800 p-2 text-slate-400 transition-colors hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-300">Section title *</span>
              <input
                value={title}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setTitle(event.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-white outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30"
                placeholder="Ex. Cleaning Tasks"
                maxLength={64}
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-300">Icon (optional)</span>
              <input
                value={icon}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setIcon(event.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-white outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30"
                placeholder="Emoji or short label"
                maxLength={4}
              />
            </label>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-300">Tasks *</span>
              <span className="text-xs text-slate-500">{tasks.length} task{tasks.length === 1 ? '' : 's'}</span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={taskInput}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setTaskInput(event.target.value)}
                onKeyDown={handleTaskInputKeyDown}
                className="flex-1 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-white outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30"
                placeholder="Add a task name and press Enter"
              />
              <button
                type="button"
                onClick={addTask}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-primary-500"
              >
                <Plus className="h-4 w-4" />
                Add task
              </button>
            </div>
            <div className="space-y-2">
              {tasks.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-600 bg-slate-800/60 p-4 text-sm text-slate-400">
                  No tasks yet. Add at least one to save this section.
                </div>
              ) : (
                tasks.map((task, index) => (
                  <div
                    key={`task-${index}`}
                    className="flex flex-col gap-2 rounded-xl border border-slate-700 bg-slate-800 p-3 sm:flex-row sm:items-center"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-600 bg-slate-900 text-xs font-semibold text-slate-300">
                        {index + 1}
                      </span>
                      <input
                        value={task}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => updateTask(index, event.target.value)}
                        className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30"
                      />
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => moveTask(index, -1)}
                        disabled={index === 0}
                        className="rounded-lg border border-slate-600 bg-slate-900 p-2 text-slate-400 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveTask(index, 1)}
                        disabled={index === tasks.length - 1}
                        className="rounded-lg border border-slate-600 bg-slate-900 p-2 text-slate-400 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeTask(index)}
                        className="rounded-lg border border-red-700 bg-red-600/20 p-2 text-red-400 transition hover:bg-red-600/30 hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/60 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>
          )}

          <div className="flex flex-col gap-3 border-t border-slate-700 pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-300 transition-colors hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-500"
            >
              <Save className="h-4 w-4" />
              Save section
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Settings() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const { data: config, isLoading } = useQuery({
    queryKey: ['taskConfig'],
    queryFn: () => configService.getConfig(),
    staleTime: Infinity,
  })

  const saveConfigMutation = useMutation({
    mutationFn: (payload: TaskConfig) => configService.saveConfig(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskConfig'] })
    },
  })

  const resetConfigMutation = useMutation({
    mutationFn: () => configService.resetConfig(),
    onSuccess: (newConfig) => {
      const sorted = [...newConfig.sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      setLocalSections(sorted)
      setHasUnsavedChanges(false)
      queryClient.invalidateQueries({ queryKey: ['taskConfig'] })
      toast.success('Configuration reset to defaults', { icon: '🔄' })
    },
    onError: () => {
      toast.error('Unable to reset configuration right now', { icon: '❌' })
    },
  })

  const [localSections, setLocalSections] = useState<TaskSection[]>([])
  const sectionCount = localSections.length

  useEffect(() => {
    if (config?.sections && Array.isArray(config.sections)) {
      const sorted = [...config.sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      setLocalSections(sorted)
      setHasUnsavedChanges(false)
    }
  }, [config?.sections])

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null)
  const [hoveredSectionId, setHoveredSectionId] = useState<string | null>(null)

  const [sectionEditorOpen, setSectionEditorOpen] = useState(false)
  const [sectionDraft, setSectionDraft] = useState<SectionDraft | null>(null)

  const [selectedTheme, setSelectedTheme] = useState<ThemeId>(() => {
    if (typeof window === 'undefined') return 'default'
    return (localStorage.getItem('brightworks_theme') as ThemeId) || 'default'
  })

  const [taskBackground, setTaskBackground] = useState<TaskBackgroundId>(() => {
    if (typeof window === 'undefined') return 'midnight'
    return (localStorage.getItem('brightworks_task_background') as TaskBackgroundId) || 'midnight'
  })

  const [checkboxStyle, setCheckboxStyle] = useState<CheckboxStyleId>(() => {
    if (typeof window === 'undefined') return 'classic'
    return (localStorage.getItem('brightworks_checkbox_style') as CheckboxStyleId) || 'classic'
  })

  const [brightness, setBrightness] = useState(() => {
    if (typeof window === 'undefined') return 100
    const stored = localStorage.getItem('brightworks_brightness')
    const value = stored ? Number.parseFloat(stored) : 100
    const clamped = Number.isFinite(value) ? value : 100
    // Clamp to safe range to prevent blur
    return Math.max(50, Math.min(150, clamped))
  })

  const [contrast, setContrast] = useState(() => {
    if (typeof window === 'undefined') return 100
    const stored = localStorage.getItem('brightworks_contrast')
    const value = stored ? Number.parseFloat(stored) : 100
    const clamped = Number.isFinite(value) ? value : 100
    // Clamp to safe range to prevent blur
    return Math.max(50, Math.min(150, clamped))
  })

  const [fontSize, setFontSize] = useState(() => {
    if (typeof window === 'undefined') return 100
    const stored = localStorage.getItem('brightworks_font_size')
    const value = stored ? Number.parseFloat(stored) : 100
    return Number.isFinite(value) && value >= 75 && value <= 150 ? value : 100
  })

  const [tabSize, setTabSize] = useState(() => {
    if (typeof window === 'undefined') return 'medium'
    return (localStorage.getItem('brightworks_tab_size') as 'small' | 'medium' | 'large') || 'medium'
  })

  const [tabStyle, setTabStyle] = useState(() => {
    if (typeof window === 'undefined') return 'rounded'
    return (localStorage.getItem('brightworks_tab_style') as 'rounded' | 'square' | 'pill') || 'rounded'
  })

  const [fontFamily, setFontFamily] = useState<FontFamilyId>(() => {
    if (typeof window === 'undefined') return 'sans'
    return (localStorage.getItem('brightworks_font_family') as FontFamilyId) || 'sans'
  })

  const [fontWeight, setFontWeight] = useState<FontWeightId>(() => {
    if (typeof window === 'undefined') return 'normal'
    return (localStorage.getItem('brightworks_font_weight') as FontWeightId) || 'normal'
  })

  const [buttonStyle, setButtonStyle] = useState<ButtonStyleId>(() => {
    if (typeof window === 'undefined') return 'default'
    return (localStorage.getItem('brightworks_button_style') as ButtonStyleId) || 'default'
  })

  const [buttonSize, setButtonSize] = useState<ButtonSizeId>(() => {
    if (typeof window === 'undefined') return 'md'
    return (localStorage.getItem('brightworks_button_size') as ButtonSizeId) || 'md'
  })

  const [customColors, setCustomColors] = useState<CustomColors>(() => {
    if (typeof window === 'undefined') return { ...defaultColors }
    try {
      const raw = localStorage.getItem('brightworks_custom_colors')
      if (!raw) return { ...defaultColors }
      const parsed = JSON.parse(raw) as Partial<CustomColors>
      return { ...defaultColors, ...parsed }
    } catch (error) {
      console.warn('Failed to parse stored custom colors:', error)
      return { ...defaultColors }
    }
  })

  const [profilePhoto, setProfilePhoto] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('brightworks_user_photo')
  })

  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default')

  useEffect(() => {
    if (typeof window === 'undefined') return
    let active = true
    const loadPushStatus = async () => {
      try {
        const permission = await pushNotificationService.getPermission()
        if (!active) return
        setPushPermission(permission)
        if (permission === 'granted') {
          const subscribed = await pushNotificationService.isSubscribed()
          if (active) setPushEnabled(subscribed)
        }
      } catch (error) {
        console.error('Error checking push status:', error)
      }
    }
    loadPushStatus()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return
    // DESHABILITADO: El filtro CSS causa problemas de blur
    // Mantener sin filtro para evitar problemas de renderizado
    document.documentElement.style.filter = ''
    // Clamp brightness and contrast to safe values
    const safeBrightness = Math.max(50, Math.min(150, brightness))
    const safeContrast = Math.max(50, Math.min(150, contrast))
    document.documentElement.style.setProperty('--brightness', `${safeBrightness}%`)
    document.documentElement.style.setProperty('--contrast', `${safeContrast}%`)
    document.documentElement.style.setProperty('--font-size-multiplier', `${fontSize / 100}`)
    document.documentElement.style.setProperty('--tab-size', tabSize)
    document.documentElement.style.setProperty('--tab-style', tabStyle)
    document.documentElement.setAttribute('data-font-size', fontSize.toString())
    document.documentElement.setAttribute('data-tab-size', tabSize)
    document.documentElement.setAttribute('data-tab-style', tabStyle)
    
    // Apply font family
    const fontOption = FONT_FAMILY_OPTIONS.find(f => f.id === fontFamily)
    if (fontOption) {
      document.documentElement.style.setProperty('--font-family', fontOption.fontFamily)
      document.body.style.fontFamily = fontOption.fontFamily
    }
    
    // Apply font weight
    const weightOption = FONT_WEIGHT_OPTIONS.find(w => w.id === fontWeight)
    if (weightOption) {
      document.documentElement.style.setProperty('--font-weight', weightOption.weight.toString())
      document.body.style.fontWeight = weightOption.weight.toString()
    }
    
    // Apply button style and size
    document.documentElement.setAttribute('data-button-style', buttonStyle)
    document.documentElement.setAttribute('data-button-size', buttonSize)
  }, [brightness, contrast, fontSize, tabSize, tabStyle, fontFamily, fontWeight, buttonStyle, buttonSize])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const theme = THEME_OPTIONS.find((option) => option.id === selectedTheme)
    if (typeof window !== 'undefined') {
      document.documentElement.setAttribute('data-theme', selectedTheme)
      localStorage.setItem('brightworks_theme', selectedTheme)
    }
    if (theme) {
      document.documentElement.style.setProperty('--primary-500', theme.colors.primary)
      document.documentElement.style.setProperty('--primary-600', theme.colors.secondary)
      document.documentElement.style.setProperty('--primary-700', theme.colors.accent)
    }
  }, [selectedTheme])

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.style.setProperty('--primary-500', customColors.primary)
    document.documentElement.style.setProperty('--primary-600', customColors.secondary)
    document.documentElement.style.setProperty('--accent-500', customColors.accent)
  }, [customColors])

  const initialNotificationPrefs: NotificationPreferences = useMemo(() => {
    const defaults: NotificationPreferences = {
      email: true,
      tasks: true,
      reminders: true,
      reports: true,
      sections: true,
    }
    if (typeof window === 'undefined') return defaults
    notificationOptions.forEach(({ key }) => {
      const stored = localStorage.getItem(`brightworks_notification_${key}`)
      if (stored !== null) {
        defaults[key] = stored === 'true'
      }
    })
    return defaults
  }, [])

  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(initialNotificationPrefs)

  const openNewSection = () => {
    setSectionDraft({ title: '', icon: '', tasks: [] })
    setSectionEditorOpen(true)
  }

  const openEditSection = (section: TaskSection) => {
    setSectionDraft({ id: section.id, title: section.title, icon: section.icon, tasks: [...section.tasks] })
    setSectionEditorOpen(true)
  }

  const closeSectionEditor = () => {
    setSectionEditorOpen(false)
    setSectionDraft(null)
  }

  const handleSectionSave = (draft: SectionDraft) => {
    setLocalSections((prev) => {
      let updated: TaskSection[]
      if (draft.id) {
        updated = prev.map((section) =>
          section.id === draft.id
            ? { ...section, title: draft.title, icon: draft.icon, tasks: draft.tasks }
            : section
        )
      } else {
        const newSection: TaskSection = {
          id: generateSectionId(),
          title: draft.title,
          icon: draft.icon,
          tasks: draft.tasks,
          order: prev.length,
        }
        updated = [...prev, newSection]
      }
      return updated.map((section, index) => ({ ...section, order: index }))
    })
    toast.success(
      draft.id ? 'Section updated. Remember to save your changes.' : 'Section added. Remember to save your changes.',
      { icon: '✅' }
    )
    setHasUnsavedChanges(true)
    closeSectionEditor()
  }

  const moveSection = (index: number, direction: number) => {
    setLocalSections((prev) => {
      const targetIndex = index + direction
      if (targetIndex < 0 || targetIndex >= prev.length) return prev
      const reordered = [...prev]
      const [moved] = reordered.splice(index, 1)
      reordered.splice(targetIndex, 0, moved)
      return reordered.map((section, idx) => ({ ...section, order: idx }))
    })
    setHasUnsavedChanges(true)
  }

  const handleDragStart = (event: DragEvent<HTMLDivElement>, sectionId: string) => {
    event.dataTransfer.effectAllowed = 'move'
    setDraggedSectionId(sectionId)
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>, sectionId: string) => {
    event.preventDefault()
    if (!draggedSectionId || draggedSectionId === sectionId) return
    event.dataTransfer.dropEffect = 'move'
    if (hoveredSectionId !== sectionId) {
      setHoveredSectionId(sectionId)
    }
  }

  const commitSectionReorder = (targetId: string | null) => {
    if (!draggedSectionId || draggedSectionId === targetId) {
      setHoveredSectionId(null)
      setDraggedSectionId(null)
      return
    }
    setLocalSections((prev) => {
      const fromIndex = prev.findIndex((section) => section.id === draggedSectionId)
      if (fromIndex === -1) return prev
      const updated = [...prev]
      const [moved] = updated.splice(fromIndex, 1)

      if (targetId === null) {
        updated.push(moved)
      } else {
        let toIndex = updated.findIndex((section) => section.id === targetId)
        if (toIndex === -1) return prev
        if (fromIndex < toIndex) {
          toIndex -= 1
        }
        updated.splice(Math.max(0, toIndex), 0, moved)
      }
      return updated.map((section, index) => ({ ...section, order: index }))
    })
    setHasUnsavedChanges(true)
    setHoveredSectionId(null)
    setDraggedSectionId(null)
  }

  const handleDragEnd = () => {
    setHoveredSectionId(null)
    setDraggedSectionId(null)
  }

  const handleSectionDelete = (sectionId: string) => {
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm('Delete this section? This cannot be undone.')
      if (!confirmed) return
    }
    setLocalSections((prev) => prev.filter((section) => section.id !== sectionId).map((section, index) => ({ ...section, order: index })))
    setHasUnsavedChanges(true)
    toast.success('Section removed. Remember to save changes.', { icon: '🗑️' })
  }

  const handleSaveAllChanges = async () => {
    if (localSections.length === 0) {
      toast.error('Add at least one section before saving.', { icon: '⚠️' })
      return
    }

    const payload: TaskConfig = {
      ...(config || { sections: [] }),
      sections: localSections.map((section, index) => ({ ...section, order: index })),
      version: CONFIG_VERSION,
      lastUpdated: new Date().toISOString(),
    }

    try {
      toast.loading('Saving configuration...', { id: 'settings-save' })
      await saveConfigMutation.mutateAsync(payload)
      toast.success('Configuration saved!', { id: 'settings-save', icon: '✅' })
      setHasUnsavedChanges(false)
      queryClient.setQueryData(['taskConfig'], payload)
    } catch (error) {
      console.error('Error saving configuration:', error)
      toast.error('Failed to save configuration', { id: 'settings-save', icon: '❌' })
    }
  }

  const handleResetConfig = () => {
    if (resetConfigMutation.isPending) return
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm('Reset to Bright Works default configuration? Custom sections will be lost.')
      if (!confirmed) return
    }
    resetConfigMutation.mutate()
  }

  const clampValue = (value: number) => Math.min(150, Math.max(50, value))

  const handleBrightnessChange = (value: number) => {
    const next = clampValue(value)
    setBrightness(next)
    if (typeof window !== 'undefined') {
      localStorage.setItem('brightworks_brightness', next.toString())
    }
  }

  const handleContrastChange = (value: number) => {
    const next = clampValue(value)
    setContrast(next)
    if (typeof window !== 'undefined') {
      localStorage.setItem('brightworks_contrast', next.toString())
    }
  }

  const handleFontSizeChange = (value: number) => {
    const clamped = Math.min(150, Math.max(75, value))
    setFontSize(clamped)
    if (typeof window !== 'undefined') {
      localStorage.setItem('brightworks_font_size', clamped.toString())
    }
    toast.success('Font size updated', { icon: '🔤', duration: 1200 })
  }

  const handleTabSizeChange = (size: 'small' | 'medium' | 'large') => {
    setTabSize(size)
    if (typeof window !== 'undefined') {
      localStorage.setItem('brightworks_tab_size', size)
      window.dispatchEvent(new CustomEvent('brightworks-tab-size-change', { detail: size }))
    }
    toast.success('Tab size updated', { icon: '📑', duration: 1200 })
  }

  const handleTabStyleChange = (style: 'rounded' | 'square' | 'pill') => {
    setTabStyle(style)
    if (typeof window !== 'undefined') {
      localStorage.setItem('brightworks_tab_style', style)
      window.dispatchEvent(new CustomEvent('brightworks-tab-style-change', { detail: style }))
    }
    toast.success('Tab style updated', { icon: '🎨', duration: 1200 })
  }

  const handleFontFamilyChange = (family: FontFamilyId) => {
    setFontFamily(family)
    if (typeof window !== 'undefined') {
      localStorage.setItem('brightworks_font_family', family)
    }
    toast.success('Font family updated', { icon: '🔤', duration: 1200 })
  }

  const handleFontWeightChange = (weight: FontWeightId) => {
    setFontWeight(weight)
    if (typeof window !== 'undefined') {
      localStorage.setItem('brightworks_font_weight', weight)
    }
    toast.success('Font weight updated', { icon: '📝', duration: 1200 })
  }

  const handleButtonStyleChange = (style: ButtonStyleId) => {
    setButtonStyle(style)
    if (typeof window !== 'undefined') {
      localStorage.setItem('brightworks_button_style', style)
      window.dispatchEvent(new CustomEvent('brightworks-button-style-change', { detail: style }))
    }
    toast.success('Button style updated', { icon: '🔘', duration: 1200 })
  }

  const handleButtonSizeChange = (size: ButtonSizeId) => {
    setButtonSize(size)
    if (typeof window !== 'undefined') {
      localStorage.setItem('brightworks_button_size', size)
      window.dispatchEvent(new CustomEvent('brightworks-button-size-change', { detail: size }))
    }
    toast.success('Button size updated', { icon: '📏', duration: 1200 })
  }

  const handleThemeChange = (themeId: ThemeId) => {
    setSelectedTheme(themeId)
    toast.success('Theme applied!', { icon: '🎨', duration: 1200 })
  }

  const handleTaskBackgroundChange = (backgroundId: TaskBackgroundId) => {
    setTaskBackground(backgroundId)
    if (typeof window !== 'undefined') {
      localStorage.setItem('brightworks_task_background', backgroundId)
      window.dispatchEvent(new CustomEvent<TaskBackgroundId>('brightworks-task-bg-change', { detail: backgroundId }))
    }
    toast.success('Task table background updated', { icon: '🗂️', duration: 1200 })
  }

  const handleCheckboxStyleChange = (styleId: CheckboxStyleId) => {
    setCheckboxStyle(styleId)
    if (typeof window !== 'undefined') {
      localStorage.setItem('brightworks_checkbox_style', styleId)
      window.dispatchEvent(new CustomEvent<CheckboxStyleId>('brightworks-checkbox-style-change', { detail: styleId }))
    }
    toast.success('Checkbox style updated', { icon: '✔️', duration: 1200 })
  }

  const handleColorChange = (key: keyof CustomColors, value: string) => {
    const next = { ...customColors, [key]: value || defaultColors[key] }
    setCustomColors(next)
    if (typeof window !== 'undefined') {
      localStorage.setItem('brightworks_custom_colors', JSON.stringify(next))
    }
    toast.success(`${key.charAt(0).toUpperCase() + key.slice(1)} color updated`, { icon: '💡', duration: 1200 })
  }

  const handlePushToggle = async () => {
    try {
      if (!pushEnabled) {
        const supported = await pushNotificationService.initialize()
        if (!supported) {
          toast.error('Push notifications are not supported on this device', { icon: '⚠️' })
          return
        }
        const permission = await pushNotificationService.requestPermission()
        setPushPermission(permission)
        if (permission !== 'granted') {
          toast.error('Notification permission denied', { icon: '❌' })
          return
        }
        await pushNotificationService.subscribe()
        setPushEnabled(true)
        toast.success('Push notifications enabled', { icon: '🔔' })
      } else {
        await pushNotificationService.unsubscribe()
        setPushEnabled(false)
        toast.success('Push notifications disabled', { icon: '🔕' })
      }
    } catch (error) {
      console.error('Push notification error:', error)
      toast.error('Unable to update push notifications', { icon: '❌' })
    }
  }

  const handleProfilePhotoUpload = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be smaller than 5MB', { icon: '❌' })
      return
    }
    const reader = new FileReader()
    reader.onloadend = () => {
      const photo = reader.result as string
      if (typeof window !== 'undefined') {
        localStorage.setItem('brightworks_user_photo', photo)
      }
      setProfilePhoto(photo)
      toast.success('Profile photo updated', { icon: '📸' })
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveProfilePhoto = () => {
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm('Remove your profile photo?')
      if (!confirmed) return
      localStorage.removeItem('brightworks_user_photo')
    }
    setProfilePhoto(null)
    toast.success('Profile photo removed', { icon: '🗑️' })
  }

  const handleEnableAllNotifications = () => {
    const updated: NotificationPreferences = { ...notificationPrefs }
    notificationOptions.forEach(({ key }) => {
      updated[key] = true
      if (typeof window !== 'undefined') {
        localStorage.setItem(`brightworks_notification_${key}`, 'true')
      }
    })
    setNotificationPrefs(updated)
    toast.success('All notifications enabled!', { icon: '🔔' })
  }

  if (isLoading && localSections.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-slate-400">Loading configuration…</span>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-16">
      <div className="sticky top-0 z-20 -mx-6 mb-2 rounded-b-2xl border border-slate-800 bg-slate-900/90 px-6 pb-4 pt-5 backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <UserIcon className="h-8 w-8 text-primary-400" />
              Settings
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Manage task sections, appearance, notifications, and profile preferences. Press “Save Changes” to sync with the cloud.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              onClick={handleSaveAllChanges}
              disabled={!hasUnsavedChanges || saveConfigMutation.isPending}
              className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                !hasUnsavedChanges || saveConfigMutation.isPending
                  ? 'cursor-not-allowed border border-slate-700 bg-slate-800 text-slate-500'
                  : 'border border-green-500/40 bg-green-600 text-white hover:bg-green-500'
              }`}
            >
              <Save className="h-4 w-4" />
              {saveConfigMutation.isPending ? 'Saving…' : 'Save Changes'}
            </button>
            <button
              onClick={handleResetConfig}
              disabled={resetConfigMutation.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-orange-500/40 bg-orange-600/20 px-4 py-3 text-sm font-semibold text-orange-200 transition-colors hover:bg-orange-500/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RotateCcw className="h-4 w-4" />
              Reset to defaults
            </button>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-lg shadow-slate-900/30">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary-400" />
              Task sections
            </h2>
            <p className="text-sm text-slate-400">
              Drag & drop the handle or use the arrows to reorder sections. Edit tasks to keep the cleaning workflow premium.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              onClick={openNewSection}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary-500/40 bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-500"
            >
              <Plus className="h-4 w-4" />
              New section
            </button>
            <span className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {sectionCount} configured
            </span>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {sectionCount === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-800/50 p-8 text-center text-slate-400">
              No sections yet. Create your first section to start customizing the workflow.
            </div>
          ) : (
            <div className="space-y-4">
              {localSections.map((section, index) => (
                <div
                  key={section.id}
                  onDragOver={(event) => handleDragOver(event, section.id)}
                  onDrop={(event) => {
                    event.preventDefault()
                    commitSectionReorder(section.id)
                  }}
                  onDragLeave={() => {
                    if (hoveredSectionId === section.id) setHoveredSectionId(null)
                  }}
                  className={`rounded-2xl border bg-slate-900/70 p-4 transition-all ${
                    hoveredSectionId === section.id
                      ? 'border-primary-500/70 shadow-lg shadow-primary-500/20'
                      : 'border-slate-800'
                  }`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                    <div
                      draggable
                      onDragStart={(event) => handleDragStart(event, section.id)}
                      onDragEnd={handleDragEnd}
                      className="flex cursor-grab select-none flex-col items-center gap-3 self-start rounded-xl border border-slate-700 bg-slate-800/70 px-3 py-4 text-slate-400"
                    >
                      <span className="rounded-full border border-slate-600 bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-300">
                        {index + 1}
                      </span>
                      <GripVertical className="h-5 w-5" />
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{section.icon || '📋'}</span>
                          <div>
                            <p className="text-lg font-semibold text-white">{section.title}</p>
                            <p className="text-xs text-slate-400">{section.tasks.length} task{section.tasks.length === 1 ? '' : 's'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => moveSection(index, -1)}
                            disabled={index === 0}
                            className="inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-400 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => moveSection(index, 1)}
                            disabled={index === sectionCount - 1}
                            className="inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-400 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openEditSection(section)}
                            className="inline-flex items-center justify-center rounded-lg border border-primary-500/40 bg-primary-600/20 p-2 text-primary-200 transition hover:bg-primary-600/30"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleSectionDelete(section.id)}
                            className="inline-flex items-center justify-center rounded-lg border border-red-500/40 bg-red-600/20 p-2 text-red-300 transition hover:bg-red-600/30"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {section.tasks.map((task, taskIndex) => (
                          <span
                            key={`${section.id}-task-${taskIndex}`}
                            className="inline-flex items-center rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200"
                          >
                            {task}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {draggedSectionId && (
                <div
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault()
                    commitSectionReorder(null)
                  }}
                  className="rounded-2xl border border-dashed border-primary-500/60 bg-primary-500/10 p-4 text-center text-sm text-primary-200"
                >
                  Drop here to send the section to the end
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-lg shadow-slate-900/30">
        <h2 className="flex items-center gap-2 text-2xl font-semibold text-white">
          <Palette className="h-6 w-6 text-primary-400" />
          Visual Experience
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Choose a signature theme, adjust the task board background, and personalise the completion toggles for an unmistakably Bright Works look.
        </p>
        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Premium theme</p>
                <p className="text-xs text-slate-400">Applies instantly to the entire interface.</p>
              </div>
            </div>
            <select
              value={selectedTheme}
              onChange={(event) => handleThemeChange(event.target.value as ThemeId)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30"
            >
              {THEME_OPTIONS.map((theme) => (
                <option key={theme.id} value={theme.id}>
                  {theme.name} — {theme.description}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-3 gap-2 text-xs text-slate-300">
              {THEME_OPTIONS.filter((theme) => theme.id === selectedTheme).map((theme) => (
                <div key={theme.id} className="rounded-xl border border-slate-700 bg-slate-900 p-3 text-center">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-primary-200">
                    <theme.icon className="h-5 w-5" />
                  </div>
                  <div className="mt-3 flex justify-center gap-2 text-[11px] font-semibold">
                    <span style={{ color: theme.colors.primary }}>Primary</span>
                    <span style={{ color: theme.colors.secondary }}>Secondary</span>
                    <span style={{ color: theme.colors.accent }}>Accent</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Task board background</p>
                <p className="text-xs text-slate-400">Subtle gradients that respect readability.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {TASK_BACKGROUND_OPTIONS.map((option) => {
                const isSelected = taskBackground === option.id
                return (
                  <button
                    key={option.id}
                    onClick={() => handleTaskBackgroundChange(option.id)}
                    className={`group flex h-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                      isSelected ? 'border-cyan-400 bg-cyan-500/10 shadow-lg shadow-cyan-500/20' : 'border-slate-800 bg-slate-900/70 hover:border-cyan-500/40 hover:bg-slate-900'
                    }`}
                  >
                    <div className={cn('h-12 w-20 rounded-lg border border-white/10', option.previewClass)} />
                    <div>
                      <p className="text-sm font-semibold text-white">{option.name}</p>
                      <p className="text-xs text-slate-400">{option.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="flex items-center justify_between">
              <div>
                <p className="text-sm font-semibold text-white">Task checkboxes</p>
                <p className="text-xs text-slate-400">Choose how completions look and feel.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {CHECKBOX_STYLE_OPTIONS.map((option) => {
                const isSelected = checkboxStyle === option.id
                return (
                  <button
                    key={option.id}
                    onClick={() => handleCheckboxStyleChange(option.id)}
                    className={`group flex h-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                      isSelected ? 'border-emerald-400 bg-emerald-500/10 shadow-lg shadow-emerald-500/20' : 'border-slate-800 bg-slate-900/70 hover:border-emerald-500/40 hover:bg-slate-900'
                    }`}
                  >
                    <span className={cn('flex h-8 w-8 items-center justify-center', option.previewClass)}>
                      <CheckCircle2 className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-white">{option.name}</p>
                      <p className="text-xs text-slate-400">{option.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                  <Sun className="h-4 w-4 text-yellow-300" /> Brightness
                </label>
                <span className="text-xs font-semibold text-primary-300">{brightness}%</span>
              </div>
              <input
                type="range"
                min={50}
                max={150}
                value={brightness}
                onChange={(event) => handleBrightnessChange(Number(event.target.value))}
                className="w-full cursor-pointer accent-primary-500"
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                  <Contrast className="h-4 w-4 text-purple-300" /> Contrast
                </label>
                <span className="text-xs font-semibold text-primary-300">{contrast}%</span>
              </div>
              <input
                type="range"
                min={50}
                max={150}
                value={contrast}
                onChange={(event) => handleContrastChange(Number(event.target.value))}
                className="w-full cursor-pointer accent-primary-500"
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                  <span className="text-lg">🔤</span> Font Size
                </label>
                <span className="text-xs font-semibold text-primary-300">{fontSize}%</span>
              </div>
              <input
                type="range"
                min={75}
                max={150}
                value={fontSize}
                onChange={(event) => handleFontSizeChange(Number(event.target.value))}
                className="w-full cursor-pointer accent-primary-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>Small</span>
                <span>Default</span>
                <span>Large</span>
              </div>
            </div>
            <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <div>
                <p className="text-sm font-semibold text-white mb-1">Font Family</p>
                <p className="text-xs text-slate-400">Choose your preferred font family</p>
              </div>
              <select
                value={fontFamily}
                onChange={(event) => handleFontFamilyChange(event.target.value as FontFamilyId)}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30"
              >
                {FONT_FAMILY_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name} — {option.description}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <div>
                <p className="text-sm font-semibold text-white mb-1">Font Weight</p>
                <p className="text-xs text-slate-400">Adjust text thickness</p>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {FONT_WEIGHT_OPTIONS.map((option) => {
                  const isSelected = fontWeight === option.id
                  return (
                    <button
                      key={option.id}
                      onClick={() => handleFontWeightChange(option.id)}
                      className={cn(
                        'rounded-lg border px-2 py-2 text-xs font-semibold transition',
                        isSelected
                          ? 'border-primary-500 bg-primary-500/20 text-primary-200 shadow-lg shadow-primary-500/20'
                          : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                      )}
                      style={{ fontWeight: option.weight }}
                    >
                      {option.name}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <div>
                <p className="text-sm font-semibold text-white mb-1">Tab Size</p>
                <p className="text-xs text-slate-400">Adjust navigation tab size</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(['small', 'medium', 'large'] as const).map((size) => {
                  const isSelected = tabSize === size
                  return (
                    <button
                      key={size}
                      onClick={() => handleTabSizeChange(size)}
                      className={cn(
                        'rounded-lg border px-3 py-2 text-xs font-semibold transition',
                        isSelected
                          ? 'border-primary-500 bg-primary-500/20 text-primary-200 shadow-lg shadow-primary-500/20'
                          : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                      )}
                    >
                      {size.charAt(0).toUpperCase() + size.slice(1)}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <div>
                <p className="text-sm font-semibold text-white mb-1">Tab Style</p>
                <p className="text-xs text-slate-400">Choose navigation tab appearance</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(['rounded', 'square', 'pill'] as const).map((style) => {
                  const isSelected = tabStyle === style
                  return (
                    <button
                      key={style}
                      onClick={() => handleTabStyleChange(style)}
                      className={cn(
                        'rounded-lg border px-3 py-2 text-xs font-semibold transition',
                        isSelected
                          ? 'border-primary-500 bg-primary-500/20 text-primary-200 shadow-lg shadow-primary-500/20'
                          : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                      )}
                    >
                      {style === 'rounded' ? 'Rounded' : style === 'square' ? 'Square' : 'Pill'}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <div>
                <p className="text-sm font-semibold text-white mb-1">Button Style</p>
                <p className="text-xs text-slate-400">Customize button appearance</p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {BUTTON_STYLE_OPTIONS.map((option) => {
                  const isSelected = buttonStyle === option.id
                  return (
                    <button
                      key={option.id}
                      onClick={() => handleButtonStyleChange(option.id)}
                      className={cn(
                        'flex flex-col items-center gap-2 rounded-lg border p-3 transition',
                        isSelected
                          ? 'border-primary-500 bg-primary-500/20 shadow-lg shadow-primary-500/20'
                          : 'border-slate-700 bg-slate-900/70 hover:border-slate-600'
                      )}
                    >
                      <div className={cn('h-8 w-full', option.previewClass)} />
                      <div>
                        <p className="text-xs font-semibold text-white">{option.name}</p>
                        <p className="text-[10px] text-slate-400">{option.description}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <div>
                <p className="text-sm font-semibold text-white mb-1">Button Size</p>
                <p className="text-xs text-slate-400">Adjust button dimensions</p>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {BUTTON_SIZE_OPTIONS.map((option) => {
                  const isSelected = buttonSize === option.id
                  return (
                    <button
                      key={option.id}
                      onClick={() => handleButtonSizeChange(option.id)}
                      className={cn(
                        'rounded-lg border px-2 py-2 text-xs font-semibold transition',
                        isSelected
                          ? 'border-primary-500 bg-primary-500/20 text-primary-200 shadow-lg shadow-primary-500/20'
                          : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                      )}
                    >
                      {option.name}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Custom palette</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {(
                  [
                    { key: 'primary', label: 'Primary' },
                    { key: 'secondary', label: 'Secondary' },
                    { key: 'accent', label: 'Accent' },
                  ] as Array<{ key: keyof CustomColors; label: string }>
                ).map(({ key, label }) => (
                  <div key={key} className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-300">{label}</span>
                      <span
                        className="h-5 w-5 rounded-full border border-slate-600"
                        style={{ backgroundColor: customColors[key] }}
                      />
                    </div>
                    <input
                      type="color"
                      value={customColors[key]}
                      onChange={(event) => handleColorChange(key, event.target.value)}
                      className="h-12 w-full cursor-pointer rounded-lg border border-slate-700 bg-slate-900"
                    />
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={() => {
                handleBrightnessChange(100)
                handleContrastChange(100)
                handleFontSizeChange(100)
                handleTabSizeChange('medium')
                handleTabStyleChange('rounded')
                handleFontFamilyChange('sans')
                handleFontWeightChange('normal')
                handleButtonStyleChange('default')
                handleButtonSizeChange('md')
                setCustomColors({ ...defaultColors })
                if (typeof window !== 'undefined') {
                  localStorage.setItem('brightworks_custom_colors', JSON.stringify(defaultColors))
                }
                toast.success('Appearance reset to default', { icon: '🔄' })
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:text-white"
            >
              <RotateCcw className="h-4 w-4" />
              Reset appearance values
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-lg shadow-slate-900/30">
        <h2 className="flex items-center gap-2 text-2xl font-semibold text-white">
          <UserIcon className="h-6 w-6 text-primary-400" />
          Profile & identity
        </h2>
        <p className="mt-1 text-sm text-slate-400">Upload a premium avatar, review your account metadata, and keep the team aligned with recognisable branding.</p>
        <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-center">
          <div className="relative h-32 w-32 flex-shrink-0">
            {profilePhoto ? (
              <img
                src={profilePhoto}
                alt="Profile"
                className="h-full w-full rounded-full border-4 border-primary-500 object-cover shadow-lg shadow-primary-500/30"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-full border-4 border-primary-400 bg-gradient-to-br from-primary-500 to-primary-600 text-4xl font-bold text-white shadow-lg shadow-primary-500/30">
                {user?.fullName?.[0] || user?.username?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
            <label className="absolute bottom-0 right-0 inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-primary-500/40 bg-primary-600 text-white shadow-lg shadow-primary-500/30 transition hover:bg-primary-500">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) {
                    handleProfilePhotoUpload(file)
                    event.target.value = ''
                  }
                }}
              />
              <Camera className="h-5 w-5" />
            </label>
            {profilePhoto && (
              <button
                onClick={handleRemoveProfilePhoto}
                className="absolute top-0 right-0 inline-flex h-9 w-9 items-center justify-center rounded-full border border-red-500/40 bg-red-600 text-white shadow-lg shadow-red-500/30 transition hover:bg-red-500"
                title="Remove photo"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex-1 space-y-2">
            <p className="text-2xl font-bold text-white">{user?.fullName || user?.username || 'Bright Works User'}</p>
            <p className="text-sm text-slate-400">{user?.email || 'No email on record'}</p>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Role:{' '}
              <span className="ml-2 rounded-lg border border-primary-500/30 bg-primary-600/20 px-2 py-1 text-primary-200">
                {user?.role || 'employee'}
              </span>
            </p>
            <p className="text-xs text-slate-500">
              Supported formats: JPG, PNG, WEBP. Maximum size 5MB.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-lg shadow-slate-900/30">
        <h2 className="flex items-center gap-2 text-2xl font-semibold text-white">
          <Smartphone className="h-6 w-6 text-primary-400" />
          Push notifications
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Receive instant updates even when Bright Works is closed. Works with supported browsers and devices.
        </p>
        <div className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Browser push notifications</p>
              <p className="text-xs text-slate-400">
                {pushPermission === 'granted'
                  ? 'Notifications are permitted. Toggle to control subscription.'
                  : pushPermission === 'denied'
                  ? 'Notifications are blocked by the browser. Enable them in browser settings to proceed.'
                  : 'Permission pending. Enable to receive real-time alerts.'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  pushPermission === 'granted'
                    ? 'border border-green-500/40 bg-green-500/20 text-green-300'
                    : pushPermission === 'denied'
                    ? 'border border-red-500/40 bg-red-500/20 text-red-300'
                    : 'border border-yellow-500/40 bg-yellow-500/20 text-yellow-200'
                }`}
              >
                {pushPermission === 'granted'
                  ? pushEnabled
                    ? 'Enabled'
                    : 'Permitted'
                  : pushPermission === 'denied'
                  ? 'Blocked'
                  : 'Pending'}
              </span>
              <button
                onClick={handlePushToggle}
                disabled={pushPermission === 'denied'}
                className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                  pushEnabled
                    ? 'border border-red-500/40 bg-red-600/20 text-red-200 hover:bg-red-600/30'
                    : 'border border-primary-500/40 bg-primary-600/20 text-primary-200 hover:bg-primary-600/30'
                } ${pushPermission === 'denied' ? 'cursor-not-allowed opacity-40' : ''}`}
              >
                {pushEnabled ? 'Disable' : 'Enable'}
              </button>
            </div>
          </div>
          {pushPermission === 'granted' && pushEnabled && (
            <div className="rounded-xl border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-200">
              <span className="inline-flex items-center gap-2">
                <Bell className="h-4 w-4" />
                You will receive Bright Works updates on this device.
              </span>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-lg shadow-slate-900/30">
        <h2 className="flex items-center gap-2 text-2xl font-semibold text-white">
          <Bell className="h-6 w-6 text-primary-400" />
          Notification preferences
        </h2>
        <p className="mt-1 text-sm text-slate-400">Fine-tune what the team receives. Preferences are stored locally per device.</p>
        <div className="mt-6 space-y-4">
          {notificationOptions.map((option) => {
            const enabled = notificationPrefs[option.key]
            return (
              <div
                key={option.key}
                className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-white">{option.label}</p>
                  <p className="text-xs text-slate-400">{option.description}</p>
                </div>
                <label className="relative inline-flex items-center">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={() => {
                      const nextValue = !enabled
                      setNotificationPrefs((prev) => ({ ...prev, [option.key]: nextValue }))
                      if (typeof window !== 'undefined') {
                        localStorage.setItem(`brightworks_notification_${option.key}`, nextValue.toString())
                      }
                      toast.success(
                        nextValue ? `${option.label} enabled` : `${option.label} disabled`,
                        { icon: nextValue ? '🔔' : '🔕', duration: 1400 }
                      )
                    }}
                    className="peer sr-only"
                  />
                  <span className="relative h-6 w-11 rounded-full border border-slate-600 bg-slate-700 transition peer-checked:border-primary-500 peer-checked:bg-primary-600">
                    <span className="absolute top-[2px] left-[2px] h-5 w-5 transform rounded-full bg-white transition peer-checked:translate-x-[22px]" />
                  </span>
                </label>
              </div>
            )
          })}
        </div>
        <div className="mt-6 border-t border-slate-800 pt-4">
          <button
            onClick={handleEnableAllNotifications}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary-500/40 bg-primary-600/20 px-4 py-2 text-sm font-semibold text-primary-200 transition hover:bg-primary-600/30"
          >
            <Bell className="h-4 w-4" /> Enable all notifications
          </button>
        </div>
      </section>

      <SectionEditor open={sectionEditorOpen} draft={sectionDraft} onSave={handleSectionSave} onClose={closeSectionEditor} />
    </div>
  )
}
