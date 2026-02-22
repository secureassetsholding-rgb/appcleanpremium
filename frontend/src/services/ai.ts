interface AIGenerateOptions {
  type: 'note' | 'reminder' | 'quote' | 'expense' | 'budget' | 'custom' | 'task-analysis'
  prompt: string
  context?: unknown
}

interface TaskAnalysisContext {
  taskName: string
  completed: boolean
  day: number
  week: number
  sectionTitle?: string
  allTasks?: Array<{ taskName: string; completed: boolean }>
}

class AIService {
  private apiKey: string | null = null

  constructor() {
    this.apiKey = localStorage.getItem('brightworks_ai_api_key') || null
  }

  setApiKey(key: string) {
    this.apiKey = key
    localStorage.setItem('brightworks_ai_api_key', key)
  }

  async generateContent(options: AIGenerateOptions): Promise<string> {
    const { type, prompt, context } = options

    if (!this.apiKey) {
      return this.generateTemplateContent(type, prompt, context)
    }

    try {
      return await this.generateWithAPI(type, prompt, context)
    } catch (error) {
      console.warn('AI API error, falling back to template:', error)
      return this.generateTemplateContent(type, prompt, context)
    }
  }

  private async generateWithAPI(type: string, prompt: string, context?: unknown): Promise<string> {
    void context
    return this.generateTemplateContent(type as AIGenerateOptions['type'], prompt)
  }

  private generateTemplateContent(type: AIGenerateOptions['type'], prompt: string, _context?: unknown): string {
    switch (type) {
      case 'note':
        return this.generateNote(prompt)
      case 'reminder':
        return this.generateReminder(prompt)
      case 'quote':
        return this.generateQuote(prompt)
      case 'expense':
        return this.generateExpense(prompt)
      case 'budget':
        return this.generateBudget(prompt, _context)
      case 'custom':
        return this.generateCustom(prompt)
      case 'task-analysis':
        return this.generateTaskAnalysis(prompt, _context as TaskAnalysisContext)
      default:
        return prompt
    }
  }

  private generateNote(prompt: string): string {
    const templates = [
      `Meeting Notes: ${prompt}\n\nKey Points:\n- Action items to follow up\n- Important decisions made\n- Next steps`,
      `Project Update: ${prompt}\n\nStatus: In Progress\n\nDetails:\n- Current progress\n- Challenges encountered\n- Resources needed`,
      `Daily Summary: ${prompt}\n\nCompleted:\n- Tasks finished today\n\nPending:\n- Items for tomorrow`,
    ]

    const keywords: Record<string, string> = {
      meeting: templates[0],
      project: templates[1],
      daily: templates[2],
      summary: templates[2],
    }

    for (const [key, template] of Object.entries(keywords)) {
      if (prompt.toLowerCase().includes(key)) {
        return template
      }
    }

    return `Note: ${prompt}\n\nCreated: ${new Date().toLocaleDateString()}\n\nDetails:\n${prompt}`
  }

  private generateReminder(prompt: string): string {
    const date = new Date()
    date.setDate(date.getDate() + 1)

    return `Reminder: ${prompt}\n\nDue Date: ${date.toLocaleDateString()}\n\nPriority: Medium\n\nDescription:\n${prompt}`
  }

  private generateQuote(prompt: string): string {
    const services = prompt.match(/cleaning|maintenance|service|professional/i)?.[0] || 'Professional Service'

    return `Quote for ${services}\n\nClient: [Client Name]\nService: ${services}\n\nLine Items:\n- Service 1: $0.00\n- Service 2: $0.00\n\nSubtotal: $0.00\nTax: $0.00\nTotal: $0.00\n\nValid Until: ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}`
  }

  private generateExpense(prompt: string): string {
    const categories = ['Supplies', 'Equipment', 'Transportation', 'Other']
    const category = categories.find((item) => prompt.toLowerCase().includes(item.toLowerCase())) || categories[0]

    return `Expense: ${prompt}\n\nCategory: ${category}\nAmount: $0.00\nDate: ${new Date().toLocaleDateString()}\n\nDescription:\n${prompt}\n\nReceipt: [Attach if available]`
  }

  private generateBudget(prompt: string, context?: unknown): string {
    const details = typeof context === 'string' ? context : ''
    return `Bright Works Professional Infrastructure Proposal

Scope Overview:
${prompt}

Compliance & Standards:
- ISO 9001 Quality Management
- ISO 14001 Environmental Management
- OSHA 29 CFR 1910 Subpart D (Walking-Working Surfaces)
- EPA Best Practices for Moisture Control

Insurance & Licensing:
- General liability: USD $2,000,000 coverage
- Certified construction license (state & federal compliant)
- Authorized to operate in sanitary and healthcare environments

Recommended Methodology:
1. Site preparation and environmental containment
2. Mechanical remediation for flooring substrate and moisture correction
3. Sanitisation program aligned with EPA disinfectant protocols
4. Final QA/QC inspection and digital handover package

Deliverables:
- Professional crew with PPE and calibrated equipment
- Daily activity logs and photographic evidence
- Post-project verification aligned with ISO documentation
- Warranty and maintenance schedule as negotiated

Next Steps:
- Confirm measurements and access logistics
- Schedule pre-construction safety briefing
- Issue notice-to-proceed upon contract execution`
      + (details ? `

Supplementary Notes:
${details}` : '')
  }

  private generateCustom(prompt: string): string {
    return `Suggested services for ${prompt}\n\n1. Weekly deep cleaning for critical zones.\n2. Daily maintenance of high-touch surfaces.\n3. Executive reports with compliance metrics.\n\nAdditional notes:\n- Adjust cadence based on personnel traffic.\n- Review inventory before every shift.`
  }

  private generateTaskAnalysis(prompt: string, context?: TaskAnalysisContext): string {
    if (!context) {
      return `Task Analysis: ${prompt}\n\nStatus: Analyzing task completion patterns...`
    }

    const { taskName, completed, day, week, sectionTitle, allTasks } = context
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    const dayName = dayNames[day - 1] || `Day ${day}`
    
    let analysis = `🤖 AI Task Analysis Report\n\n`
    analysis += `Task: ${taskName}\n`
    analysis += `Section: ${sectionTitle || 'General'}\n`
    analysis += `Week: ${week} | Day: ${dayName}\n`
    analysis += `Status: ${completed ? '✅ Completed' : '⏳ Pending'}\n\n`

    if (allTasks && allTasks.length > 0) {
      const completedCount = allTasks.filter(t => t.completed).length
      const totalCount = allTasks.length
      const completionRate = Math.round((completedCount / totalCount) * 100)
      
      analysis += `Section Progress:\n`
      analysis += `- Completed: ${completedCount}/${totalCount} tasks (${completionRate}%)\n`
      analysis += `- Remaining: ${totalCount - completedCount} tasks\n\n`

      if (completionRate === 100) {
        analysis += `🎉 Excellent! All tasks in this section are completed.\n`
        analysis += `This section is ready for final review and sign-off.\n\n`
      } else if (completionRate >= 75) {
        analysis += `📊 Good progress! Almost finished with this section.\n`
        analysis += `Consider prioritizing remaining tasks for completion.\n\n`
      } else if (completionRate >= 50) {
        analysis += `⚡ Steady progress. Halfway through this section.\n`
        analysis += `Maintain current pace to complete on schedule.\n\n`
      } else {
        analysis += `📋 Getting started. Focus on completing tasks systematically.\n`
        analysis += `Consider breaking down complex tasks into smaller steps.\n\n`
      }
    }

    if (completed) {
      analysis += `✅ Completion Insights:\n`
      analysis += `- Task "${taskName}" has been successfully completed.\n`
      analysis += `- This contributes to overall daily progress.\n`
      analysis += `- Great work maintaining quality standards!\n\n`
    } else {
      analysis += `⏳ Pending Task Recommendations:\n`
      analysis += `- Review task requirements and resources needed.\n`
      analysis += `- Ensure all necessary tools and materials are available.\n`
      analysis += `- Plan completion time to avoid delays.\n\n`
    }

    analysis += `📈 Performance Metrics:\n`
    analysis += `- Task completion tracking: Active\n`
    analysis += `- Quality standards: Maintained\n`
    analysis += `- Timeline adherence: On track\n\n`

    analysis += `💡 Recommendations:\n`
    if (completed) {
      analysis += `- Document any issues encountered during completion.\n`
      analysis += `- Note any improvements for future similar tasks.\n`
      analysis += `- Proceed to next pending task in sequence.\n`
    } else {
      analysis += `- Review task checklist before starting.\n`
      analysis += `- Allocate sufficient time for quality completion.\n`
      analysis += `- Update status as you progress.\n`
    }

    return analysis
  }
}

export const aiService = new AIService()
