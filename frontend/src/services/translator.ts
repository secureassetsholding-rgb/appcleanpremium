import { useState, useEffect, useCallback, useMemo } from 'react'

type LanguageCode = 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'zh' | 'ja' | 'ko' | 'ar'

interface TranslationDictionary {
  [key: string]: {
    [lang in LanguageCode]?: string
  }
}

// Comprehensive translation dictionary for Bright Works
const translations: TranslationDictionary = {
  // Common UI
  'app.title': {
    en: 'Bright Works Professional',
    es: 'Bright Works Profesional',
    fr: 'Bright Works Professionnel',
    de: 'Bright Works Professionell',
    it: 'Bright Works Professionale',
    pt: 'Bright Works Profissional',
    zh: 'Bright Works 专业版',
    ja: 'Bright Works プロフェッショナル',
    ko: 'Bright Works 전문',
    ar: 'برايت ووركس المحترف',
  },
  'task.completed': {
    en: 'Completed',
    es: 'Completado',
    fr: 'Terminé',
    de: 'Abgeschlossen',
    it: 'Completato',
    pt: 'Concluído',
    zh: '已完成',
    ja: '完了',
    ko: '완료됨',
    ar: 'مكتمل',
  },
  'task.pending': {
    en: 'Pending',
    es: 'Pendiente',
    fr: 'En attente',
    de: 'Ausstehend',
    it: 'In attesa',
    pt: 'Pendente',
    zh: '待处理',
    ja: '保留中',
    ko: '대기 중',
    ar: 'قيد الانتظار',
  },
  'schedule.daily': {
    en: 'Daily Schedule',
    es: 'Horario Diario',
    fr: 'Planning Quotidien',
    de: 'Tagesplan',
    it: 'Programma Giornaliero',
    pt: 'Agenda Diária',
    zh: '每日日程',
    ja: '日次スケジュール',
    ko: '일일 일정',
    ar: 'الجدول اليومي',
  },
  'attendance.checkIn': {
    en: 'Check In',
    es: 'Entrada',
    fr: 'Arrivée',
    de: 'Einchecken',
    it: 'Entrata',
    pt: 'Entrada',
    zh: '签到',
    ja: 'チェックイン',
    ko: '체크인',
    ar: 'تسجيل الدخول',
  },
  'attendance.checkOut': {
    en: 'Check Out',
    es: 'Salida',
    fr: 'Départ',
    de: 'Auschecken',
    it: 'Uscita',
    pt: 'Saída',
    zh: '签退',
    ja: 'チェックアウト',
    ko: '체크아웃',
    ar: 'تسجيل الخروج',
  },
  'attendance.employeeName': {
    en: 'Employee Name',
    es: 'Nombre del Empleado',
    fr: 'Nom de l\'employé',
    de: 'Mitarbeitername',
    it: 'Nome Dipendente',
    pt: 'Nome do Funcionário',
    zh: '员工姓名',
    ja: '従業員名',
    ko: '직원 이름',
    ar: 'اسم الموظف',
  },
  'report.daily': {
    en: 'Daily Report',
    es: 'Reporte Diario',
    fr: 'Rapport Quotidien',
    de: 'Tagesbericht',
    it: 'Rapporto Giornaliero',
    pt: 'Relatório Diário',
    zh: '每日报告',
    ja: '日次レポート',
    ko: '일일 보고서',
    ar: 'التقرير اليومي',
  },
  'report.pdf': {
    en: 'PDF Report',
    es: 'Reporte PDF',
    fr: 'Rapport PDF',
    de: 'PDF-Bericht',
    it: 'Rapporto PDF',
    pt: 'Relatório PDF',
    zh: 'PDF报告',
    ja: 'PDFレポート',
    ko: 'PDF 보고서',
    ar: 'تقرير PDF',
  },
  'section.completed': {
    en: 'Section Completed',
    es: 'Sección Completada',
    fr: 'Section Terminée',
    de: 'Abschnitt Abgeschlossen',
    it: 'Sezione Completata',
    pt: 'Seção Concluída',
    zh: '部分完成',
    ja: 'セクション完了',
    ko: '섹션 완료',
    ar: 'اكتمل القسم',
  },
  'day.completed': {
    en: 'Day Completed',
    es: 'Día Completado',
    fr: 'Jour Terminé',
    de: 'Tag Abgeschlossen',
    it: 'Giorno Completato',
    pt: 'Dia Concluído',
    zh: '日期完成',
    ja: '日完了',
    ko: '일 완료',
    ar: 'اكتمل اليوم',
  },
  'signature.received': {
    en: 'Signature Received',
    es: 'Firma Recibida',
    fr: 'Signature Reçue',
    de: 'Unterschrift Erhalten',
    it: 'Firma Ricevuta',
    pt: 'Assinatura Recebida',
    zh: '已收到签名',
    ja: '署名受領',
    ko: '서명 수신',
    ar: 'تم استلام التوقيع',
  },
  'settings.title': {
    en: 'Settings',
    es: 'Configuración',
    fr: 'Paramètres',
    de: 'Einstellungen',
    it: 'Impostazioni',
    pt: 'Configurações',
    zh: '设置',
    ja: '設定',
    ko: '설정',
    ar: 'الإعدادات',
  },
  'ai.analysis': {
    en: 'AI Task Analysis',
    es: 'Análisis de Tareas con IA',
    fr: 'Analyse de Tâches IA',
    de: 'KI-Aufgabenanalyse',
    it: 'Analisi Attività IA',
    pt: 'Análise de Tarefas IA',
    zh: 'AI任务分析',
    ja: 'AIタスク分析',
    ko: 'AI 작업 분석',
    ar: 'تحليل المهام بالذكاء الاصطناعي',
  },
}

class TranslatorService {
  private currentLanguage: LanguageCode = 'en'

  constructor() {
    // Load saved language preference
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('brightworks_language') as LanguageCode
      if (saved && this.isValidLanguage(saved)) {
        this.currentLanguage = saved
        // Apply language to document immediately
        document.documentElement.setAttribute('lang', saved)
      } else {
        // Default to English if no saved language
        this.currentLanguage = 'en'
        document.documentElement.setAttribute('lang', 'en')
      }
    }
  }

  setLanguage(lang: LanguageCode): void {
    if (this.isValidLanguage(lang)) {
      this.currentLanguage = lang
      if (typeof window !== 'undefined') {
        localStorage.setItem('brightworks_language', lang)
        // Set document language attribute for accessibility
        document.documentElement.setAttribute('lang', lang)
        // Trigger language change event
        window.dispatchEvent(new CustomEvent('brightworks-language-changed', { detail: lang }))
        // Also trigger a storage event to notify other tabs/windows
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'brightworks_language',
          newValue: lang,
          oldValue: this.currentLanguage
        }))
      }
    }
  }

  getLanguage(): LanguageCode {
    return this.currentLanguage
  }

  translate(key: string, fallback?: string): string {
    const translation = translations[key]?.[this.currentLanguage]
    if (translation) {
      return translation
    }
    
    // Fallback to English if available
    const englishFallback = translations[key]?.['en']
    if (englishFallback) {
      return englishFallback
    }
    
    // Use provided fallback or key itself
    return fallback || key
  }

  translateTask(taskName: string): string {
    // For task names, try to translate common patterns
    const taskKey = `task.${taskName.toLowerCase().replace(/\s+/g, '.')}`
    const translated = this.translate(taskKey)
    
    // If translation found (not the key itself), return it
    if (translated !== taskKey) {
      return translated
    }
    
    // Otherwise return original task name
    return taskName
  }

  translateSection(sectionTitle: string): string {
    const sectionKey = `section.${sectionTitle.toLowerCase().replace(/\s+/g, '.')}`
    const translated = this.translate(sectionKey)
    
    if (translated !== sectionKey) {
      return translated
    }
    
    return sectionTitle
  }

  private isValidLanguage(lang: string): lang is LanguageCode {
    return ['en', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko', 'ar'].includes(lang)
  }

  // Get available languages
  getAvailableLanguages(): Array<{ code: LanguageCode; name: string; nativeName: string }> {
    return [
      { code: 'en', name: 'English', nativeName: 'English' },
      { code: 'es', name: 'Spanish', nativeName: 'Español' },
      { code: 'fr', name: 'French', nativeName: 'Français' },
      { code: 'de', name: 'German', nativeName: 'Deutsch' },
      { code: 'it', name: 'Italian', nativeName: 'Italiano' },
      { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
      { code: 'zh', name: 'Chinese', nativeName: '中文' },
      { code: 'ja', name: 'Japanese', nativeName: '日本語' },
      { code: 'ko', name: 'Korean', nativeName: '한국어' },
      { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
    ]
  }
}

export const translatorService = new TranslatorService()

// Helper hook for React components
export function useTranslation() {
  // Ensure we always have a valid initial state
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    try {
      if (typeof window === 'undefined') return 'en'
      // Read directly from localStorage first, then from service
      const saved = localStorage.getItem('brightworks_language') as LanguageCode
      const lang = (saved && ['en', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko', 'ar'].includes(saved)) 
        ? saved 
        : translatorService.getLanguage()
      
      console.log('[useTranslation] Initializing language:', { saved, lang, serviceLang: translatorService.getLanguage() })
      
      // Validate the language code
      if (lang && ['en', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko', 'ar'].includes(lang)) {
        // Ensure service has the correct language
        if (translatorService.getLanguage() !== lang) {
          translatorService.setLanguage(lang)
        }
        return lang
      }
      return 'en'
    } catch (error) {
      console.error('Error initializing translation hook:', error)
      return 'en'
    }
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Initialize language from service on mount
    const currentLang = translatorService.getLanguage()
    if (currentLang && currentLang !== language) {
      setLanguageState(currentLang)
    }
    
    // Set document lang attribute
    document.documentElement.setAttribute('lang', currentLang || 'en')

    const handleLanguageChange = (event: CustomEvent<LanguageCode>) => {
      const detail = event.detail
      if (detail && ['en', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko', 'ar'].includes(detail)) {
        setLanguageState(detail)
        document.documentElement.setAttribute('lang', detail)
      }
    }

    window.addEventListener('brightworks-language-changed', handleLanguageChange as EventListener)
    return () => {
      window.removeEventListener('brightworks-language-changed', handleLanguageChange as EventListener)
    }
  }, [language])

  // FIXED: t now depends on language so it updates when language changes
  // The translatorService already has the correct language, but we need to
  // ensure the callback updates when language state changes
  const t = useCallback((key: string, fallback?: string) => {
    try {
      // translatorService already has the current language set
      // We just need to ensure this callback updates when language changes
      return translatorService.translate(key, fallback)
    } catch {
      return fallback || key
    }
  }, [language]) // FIXED: Now depends on language to trigger re-renders

  const setLanguage = useCallback((lang: LanguageCode) => {
    if (!['en', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko', 'ar'].includes(lang)) {
      return
    }
    try {
      translatorService.setLanguage(lang)
      setLanguageState(lang)
    } catch (error) {
      console.error('Error setting language:', error)
    }
  }, [])

  const availableLanguages = useMemo(() => {
    try {
      return translatorService.getAvailableLanguages()
    } catch {
      return [
        { code: 'en' as LanguageCode, name: 'English', nativeName: 'English' },
        { code: 'es' as LanguageCode, name: 'Spanish', nativeName: 'Español' },
        { code: 'fr' as LanguageCode, name: 'French', nativeName: 'Français' },
        { code: 'de' as LanguageCode, name: 'German', nativeName: 'Deutsch' },
        { code: 'it' as LanguageCode, name: 'Italian', nativeName: 'Italiano' },
        { code: 'pt' as LanguageCode, name: 'Portuguese', nativeName: 'Português' },
        { code: 'zh' as LanguageCode, name: 'Chinese', nativeName: '中文' },
        { code: 'ja' as LanguageCode, name: 'Japanese', nativeName: '日本語' },
        { code: 'ko' as LanguageCode, name: 'Korean', nativeName: '한국어' },
        { code: 'ar' as LanguageCode, name: 'Arabic', nativeName: 'العربية' },
      ]
    }
  }, [])

  // Ensure we always return a valid object with all required properties
  const result = {
    t,
    language: language || 'en',
    setLanguage,
    availableLanguages: Array.isArray(availableLanguages) && availableLanguages.length > 0 
      ? availableLanguages 
      : [
          { code: 'en' as LanguageCode, name: 'English', nativeName: 'English' },
          { code: 'es' as LanguageCode, name: 'Spanish', nativeName: 'Español' },
        ],
  }

  // Validate result before returning
  if (!result.t || !result.language || !result.setLanguage || !result.availableLanguages) {
    console.error('Invalid translation hook result:', result)
    // Return safe defaults
    return {
      t: (key: string, fallback?: string) => fallback || key,
      language: 'en' as LanguageCode,
      setLanguage: () => {},
      availableLanguages: [
        { code: 'en' as LanguageCode, name: 'English', nativeName: 'English' },
        { code: 'es' as LanguageCode, name: 'Spanish', nativeName: 'Español' },
      ],
    }
  }

  return result
}

