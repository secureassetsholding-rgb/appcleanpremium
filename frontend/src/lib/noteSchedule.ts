export const NOTE_SCHEDULE_STORAGE_KEY = 'brightworks_note_schedule'
export const NOTE_SCHEDULE_EVENT = 'brightworks:note-schedule'

export type NoteScheduleMap = Record<string, string>

function safeParse(value: string | null): NoteScheduleMap {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value)
    if (parsed && typeof parsed === 'object') {
      const filtered = Object.entries(parsed).filter(
        ([key, iso]) => typeof key === 'string' && typeof iso === 'string' && !Number.isNaN(Date.parse(iso))
      ) as [string, string][]
      return Object.fromEntries(filtered) as NoteScheduleMap
    }
  } catch {
    // ignore invalid JSON
  }
  return {}
}

export function loadNoteSchedules(): NoteScheduleMap {
  if (typeof window === 'undefined') return {}
  return safeParse(localStorage.getItem(NOTE_SCHEDULE_STORAGE_KEY))
}

export function saveNoteSchedules(map: NoteScheduleMap) {
  if (typeof window === 'undefined') return
  localStorage.setItem(NOTE_SCHEDULE_STORAGE_KEY, JSON.stringify(map))
  window.dispatchEvent(new Event(NOTE_SCHEDULE_EVENT))
}

export function setNoteSchedule(noteId: string, isoDate: string | null) {
  if (typeof window === 'undefined') return
  const map = loadNoteSchedules()
  if (!isoDate) {
    delete map[noteId]
  } else {
    map[noteId] = isoDate
  }
  saveNoteSchedules(map)
}


