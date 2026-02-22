import { TaskConfig, TaskSection } from '../types'
import { api } from './api'

const CONFIG_STORAGE_KEY = 'brightworks_task_config'
const CONFIG_VERSION = 1

const DEFAULT_TASK_SECTIONS: TaskSection[] = [
  {
    id: 'cleaning-1',
    title: 'Cleaning Task',
    tasks: ['Floors', 'Toilets', 'Sinks', 'Mirror', 'Walls'],
    order: 0,
  },
  {
    id: 'cleaning-2',
    title: 'Cleaning Task',
    tasks: ['Floor Vacuuming L&C', 'Floor Cleaning/Mopping', "Children's Tables", "Children's Chairs", 'Weekly UV'],
    order: 1,
  },
  {
    id: 'refill',
    title: 'Refill',
    tasks: ['Soap', 'Toilet Paper', 'Paper Towel'],
    order: 2,
  },
  {
    id: 'trash-bags',
    title: 'Trash Bags',
    tasks: ['Trash Bag Removed', 'Trash Bag Replacement'],
    order: 3,
  },
  {
    id: 'disinfection',
    title: 'Weekly Disinfection & Sanitization',
    tasks: ['Complete Disinfection'],
    order: 4,
  },
]

class ConfigService {
  private defaultConfig: TaskConfig = {
    sections: DEFAULT_TASK_SECTIONS.map((section, index) => ({ ...section, order: index })),
    version: CONFIG_VERSION,
    lastUpdated: new Date().toISOString(),
  }

  async getConfig(): Promise<TaskConfig> {
    try {
      const apiConfig = await api.get<TaskConfig>('/api/tasks/config').catch(() => null)
      if (apiConfig && apiConfig.sections && apiConfig.sections.length > 0) {
        localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(apiConfig))
        return apiConfig
      }
    } catch (error) {
      console.log('API config not available, using localStorage')
    }

    const stored = localStorage.getItem(CONFIG_STORAGE_KEY)
    if (stored) {
      try {
        const config = JSON.parse(stored) as TaskConfig
        if (config.sections && Array.isArray(config.sections) && config.sections.length >= 5) {
          return config
        }
        console.log('Stored config outdated, updating with default sections')
        const updatedConfig = {
          ...this.defaultConfig,
          sections: [...this.defaultConfig.sections],
        }
        localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(updatedConfig))
        return updatedConfig
      } catch (error) {
        console.error('Error parsing stored config:', error)
      }
    }

    return this.defaultConfig
  }

  async saveConfig(config: TaskConfig): Promise<void> {
    const configToSave: TaskConfig = {
      ...config,
      version: CONFIG_VERSION,
      lastUpdated: new Date().toISOString(),
    }

    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(configToSave))

    try {
      await api.post('/api/tasks/config', configToSave).catch(() => {
        console.log('API save failed, config saved to localStorage only')
      })
    } catch (error) {
      console.error('Error saving config to API:', error)
    }
  }

  async resetConfig(): Promise<TaskConfig> {
    const defaultConfig: TaskConfig = {
      sections: DEFAULT_TASK_SECTIONS.map((section, index) => ({ ...section, order: index })),
      version: CONFIG_VERSION,
      lastUpdated: new Date().toISOString(),
    }
    await this.saveConfig(defaultConfig)
    return defaultConfig
  }

  async addSection(section: Omit<TaskSection, 'id' | 'order'>): Promise<TaskSection> {
    const config = await this.getConfig()
    const newSection: TaskSection = {
      ...section,
      id: `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      order: config.sections.length,
    }
    config.sections.push(newSection)
    await this.saveConfig(config)
    return newSection
  }

  async updateSection(sectionId: string, updates: Partial<TaskSection>): Promise<void> {
    const config = await this.getConfig()
    const index = config.sections.findIndex((section) => section.id === sectionId)
    if (index !== -1) {
      config.sections[index] = { ...config.sections[index], ...updates }
      await this.saveConfig(config)
    }
  }

  async deleteSection(sectionId: string): Promise<void> {
    const config = await this.getConfig()
    config.sections = config.sections.filter((section) => section.id !== sectionId)
    config.sections.forEach((section, index) => {
      section.order = index
    })
    await this.saveConfig(config)
  }

  async reorderSections(sectionIds: string[]): Promise<void> {
    const config = await this.getConfig()
    const sectionMap = new Map(config.sections.map((section) => [section.id, section]))
    config.sections = sectionIds.map((id, index) => {
      const section = sectionMap.get(id)
      if (section) {
        return { ...section, order: index }
      }
      return section!
    })
    await this.saveConfig(config)
  }

  async updateSectionTasks(sectionId: string, tasks: string[]): Promise<void> {
    await this.updateSection(sectionId, { tasks })
  }

  async reorderTasks(sectionId: string, taskOrder: string[]): Promise<void> {
    const config = await this.getConfig()
    const section = config.sections.find((item) => item.id === sectionId)
    if (section) {
      section.tasks = taskOrder
      await this.saveConfig(config)
    }
  }
}

export const configService = new ConfigService()
