import jsPDF from 'jspdf'
import { Task, TimeRecord, TaskSection } from '../types'
import { WORK_DAYS } from '../types'

interface DailyReportData {
  day: number
  week: number
  tasks: Task[]
  timeRecords: TimeRecord[]
  sections: TaskSection[]
  userName: string
  userRole: string
  roomLabel: string
  signature?: string
  observations?: string
}

export async function generateDailyReportPDF(data: DailyReportData): Promise<void> {
  const { day, week, tasks, timeRecords, sections, userName, userRole, roomLabel, signature, observations } = data
  
  const dayName = WORK_DAYS.find((d) => d.num === day)?.fullName || `Day ${day}`
  const dayRecord = timeRecords.find((r) => r.day === day)
  
  const pdf = new jsPDF('p', 'mm', 'a4')
  
  // Ultra Premium Color Palette
  const colors = {
    primary: [15, 23, 42],           // Deep navy
    accent: [99, 102, 241],          // Electric indigo
    gradient1: [59, 130, 246],       // Bright blue
    gradient2: [147, 51, 234],       // Purple
    success: [16, 185, 129],        // Emerald
    warning: [251, 146, 60],        // Orange
    danger: [239, 68, 68],          // Red
    text: [15, 23, 42],             // Deep navy
    textSecondary: [100, 116, 139], // Slate
    textLight: [148, 163, 184],     // Light slate
    border: [226, 232, 240],        // Cool gray
    bg: [248, 250, 252],            // Off white
    bgDark: [241, 245, 249],        // Light blue-gray
    white: [255, 255, 255]
  }
  
  // Helper functions
  const setColor = (r: number, g: number, b: number) => pdf.setTextColor(r, g, b)
  const setFillColor = (r: number, g: number, b: number) => pdf.setFillColor(r, g, b)
  const setDrawColor = (r: number, g: number, b: number) => pdf.setDrawColor(r, g, b)
  
  const addText = (text: string, x: number, y: number, options: {
    fontSize?: number
    color?: number[]
    bold?: boolean
    maxWidth?: number
    align?: 'left' | 'center' | 'right'
  } = {}) => {
    const { fontSize = 10, color = colors.text, bold = false, maxWidth, align = 'left' } = options
    pdf.setFontSize(fontSize)
    pdf.setFont('helvetica', bold ? 'bold' : 'normal')
    setColor(color[0], color[1], color[2])
    const alignValue = align === 'center' ? 'center' : align === 'right' ? 'right' : 'left'
    if (maxWidth) {
      const lines = pdf.splitTextToSize(text, maxWidth)
      pdf.text(lines, x, y, { align: alignValue })
      return y + (lines.length * fontSize * 0.4)
    } else {
      pdf.text(text, x, y, { align: alignValue })
      return y + fontSize * 0.4
    }
  }
  
  const drawLine = (x1: number, y1: number, x2: number, y2: number, color: number[] = colors.border, width: number = 0.5) => {
    setDrawColor(color[0], color[1], color[2])
    pdf.setLineWidth(width)
    pdf.line(x1, y1, x2, y2)
  }
  
  const drawBox = (x: number, y: number, width: number, height: number, fillColor?: number[], strokeColor?: number[], radius?: number) => {
    if (radius && radius > 0) {
      // Rounded rectangle
      if (fillColor) {
        setFillColor(fillColor[0], fillColor[1], fillColor[2])
        pdf.roundedRect(x, y, width, height, radius, radius, 'F')
      }
      if (strokeColor) {
        setDrawColor(strokeColor[0], strokeColor[1], strokeColor[2])
        pdf.setLineWidth(0.3)
        pdf.roundedRect(x, y, width, height, radius, radius, 'S')
      }
    } else {
      if (fillColor) {
        setFillColor(fillColor[0], fillColor[1], fillColor[2])
        pdf.rect(x, y, width, height, 'F')
      }
      if (strokeColor) {
        setDrawColor(strokeColor[0], strokeColor[1], strokeColor[2])
        pdf.setLineWidth(0.3)
        pdf.rect(x, y, width, height, 'S')
      }
    }
  }
  
  // Create gradient effect
  const drawGradient = (x: number, y: number, width: number, height: number, color1: number[], color2: number[]) => {
    const steps = 20
    const stepHeight = height / steps
    for (let i = 0; i < steps; i++) {
      const ratio = i / steps
      const r = Math.round(color1[0] + (color2[0] - color1[0]) * ratio)
      const g = Math.round(color1[1] + (color2[1] - color1[1]) * ratio)
      const b = Math.round(color1[2] + (color2[2] - color1[2]) * ratio)
      drawBox(x, y + (i * stepHeight), width, stepHeight + 0.5, [r, g, b])
    }
  }
  
  // Page setup
  const pageWidth = 210
  const pageHeight = 297
  const margin = 15
  const contentWidth = pageWidth - (margin * 2)
  let yPos = margin
  
  // ULTRA PREMIUM HEADER with gradient
  drawGradient(0, 0, pageWidth, 45, colors.gradient1, colors.gradient2)
  
  // Logo area (white circle)
  setFillColor(255, 255, 255)
  pdf.circle(30, 22.5, 12, 'F')
  addText('BW', 30, 25, { 
    fontSize: 14, 
    bold: true, 
    align: 'center',
    color: colors.gradient2
  })
  
  // Header text
  addText('BRIGHT WORKS', pageWidth / 2, 18, { 
    fontSize: 24, 
    bold: true, 
    align: 'center',
    color: colors.white
  })
  addText('PROFESSIONAL CLEANING SERVICES', pageWidth / 2, 26, { 
    fontSize: 10, 
    align: 'center',
    color: colors.white
  })
  addText('Daily Performance Report', pageWidth / 2, 34, { 
    fontSize: 8, 
    align: 'center',
    color: [255, 255, 255]
  })
  
  yPos = 55
  
  // Modern Title Section
  addText(dayName.toUpperCase(), margin, yPos, { 
    fontSize: 28, 
    bold: true, 
    color: colors.primary 
  })
  addText(`WEEK ${week}`, margin, yPos + 10, { 
    fontSize: 12, 
    color: colors.accent,
    bold: true
  })
  
  yPos += 20
  
  // Stats Cards - Modern Card Design
  const cardHeight = 28
  const cardSpacing = 5
  const cardWidth = (contentWidth - cardSpacing * 2) / 3
  
  // Calculate stats - FIXED: Count ALL tasks from ALL sections, not just tasks in the array
  // Get all task names from all sections
  const allSectionTaskNames = new Set<string>()
  sections.forEach((section) => {
    if (section && section.tasks && Array.isArray(section.tasks)) {
      section.tasks.forEach((taskName) => allSectionTaskNames.add(taskName))
    }
  })
  
  // Filter tasks for this day
  const dayTasks = tasks.filter((t) => t.day === day)
  
  // Calculate total tasks from ALL sections (even if not in tasks array yet)
  // This ensures we count all 16 tasks across all 5 sections
  const totalTasksFromSections = Array.from(allSectionTaskNames).length
  
  // Count actual tasks that exist in the tasks array for this day
  const dayTasksFromSections = dayTasks.filter((t) => 
    t.taskName && allSectionTaskNames.has(t.taskName)
  )
  
  // Use the larger of: total from sections OR actual tasks in array
  // This handles both cases: when all tasks exist, and when some don't exist yet
  const totalTasks = Math.max(totalTasksFromSections, dayTasksFromSections.length)
  
  // More robust check for completed tasks (handles true, "true", 1, etc.)
  const isTaskCompleted = (completedValue: unknown): boolean => {
    if (typeof completedValue === 'boolean') return completedValue
    if (typeof completedValue === 'string') return completedValue.toLowerCase() === 'true' || completedValue === '1'
    if (typeof completedValue === 'number') return completedValue === 1
    return false
  }
  
  const totalCompleted = dayTasksFromSections.filter((t) => isTaskCompleted(t.completed)).length
  const totalPending = totalTasks - totalCompleted
  const overallPercentage = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0
  
  // Debug logging
  console.log('[PDF] All tasks received:', tasks.length)
  console.log('[PDF] Day:', day)
  console.log('[PDF] All sections:', sections.length)
  console.log('[PDF] All section task names:', Array.from(allSectionTaskNames))
  console.log('[PDF] Total tasks from sections:', totalTasksFromSections)
  console.log('[PDF] Day tasks filtered:', dayTasks.length)
  console.log('[PDF] Day tasks from sections:', dayTasksFromSections.length)
  console.log('[PDF] Day tasks details:', dayTasksFromSections.map(t => ({ 
    taskName: t.taskName, 
    day: t.day, 
    completed: t.completed, 
    completedType: typeof t.completed 
  })))
  console.log('[PDF] Completed tasks:', totalCompleted)
  console.log('[PDF] Total tasks (calculated):', totalTasks)
  
  // Card 1: Employee Info
  drawBox(margin, yPos, cardWidth, cardHeight, colors.white, colors.border, 3)
  drawBox(margin, yPos, cardWidth, 8, colors.primary, undefined, 3)
  addText('EMPLOYEE', margin + cardWidth/2, yPos + 5, { 
    fontSize: 7, 
    color: colors.white, 
    bold: true, 
    align: 'center' 
  })
  addText(userName.toUpperCase(), margin + cardWidth/2, yPos + 16, { 
    fontSize: 10, 
    color: colors.primary, 
    bold: true, 
    align: 'center',
    maxWidth: cardWidth - 10
  })
  addText(userRole, margin + cardWidth/2, yPos + 23, { 
    fontSize: 8, 
    color: colors.textSecondary,
    align: 'center'
  })
  
  // Card 2: Location
  const card2X = margin + cardWidth + cardSpacing
  drawBox(card2X, yPos, cardWidth, cardHeight, colors.white, colors.border, 3)
  drawBox(card2X, yPos, cardWidth, 8, colors.accent, undefined, 3)
  addText('LOCATION', card2X + cardWidth/2, yPos + 5, { 
    fontSize: 7, 
    color: colors.white, 
    bold: true,
    align: 'center'
  })
  addText(roomLabel.toUpperCase(), card2X + cardWidth/2, yPos + 18, { 
    fontSize: 11, 
    color: colors.text, 
    bold: true,
    align: 'center',
    maxWidth: cardWidth - 10
  })
  
  // Card 3: Completion Rate with circular progress
  const card3X = margin + (cardWidth + cardSpacing) * 2
  const rateColor = overallPercentage === 100 ? colors.success : 
                    overallPercentage >= 75 ? colors.accent : 
                    overallPercentage >= 50 ? colors.warning : colors.danger
  
  drawBox(card3X, yPos, cardWidth, cardHeight, colors.white, colors.border, 3)
  
  // Progress indicator - Simple box instead of circle (arc not available)
  const progressBoxWidth = 20
  const progressBoxHeight = 20
  const progressX = card3X + cardWidth/2 - progressBoxWidth/2
  const progressY = yPos + cardHeight/2 - progressBoxHeight/2 + 2
  
  // Background box
  drawBox(progressX, progressY, progressBoxWidth, progressBoxHeight, colors.bgDark, colors.border, 2)
  
  // Progress fill
  const fillWidth = (overallPercentage / 100) * progressBoxWidth
  if (fillWidth > 0) {
    drawBox(progressX, progressY, fillWidth, progressBoxHeight, rateColor, undefined, 2)
  }
  
  addText(`${overallPercentage}%`, card3X + cardWidth/2, progressY + progressBoxHeight/2 + 1, { 
    fontSize: 11, 
    color: overallPercentage > 50 ? colors.white : colors.primary, 
    bold: true,
    align: 'center'
  })
  addText('COMPLETION', card3X + cardWidth/2, yPos + 5, { 
    fontSize: 7, 
    color: colors.textSecondary,
    align: 'center'
  })
  
  yPos += cardHeight + 8
  
  // Performance Metrics Bar
  drawBox(margin, yPos, contentWidth, 15, colors.bgDark, undefined, 3)
  
  let metricsX = margin + 10
  const metricsSpacing = contentWidth / 4
  
  // Tasks completed
  addText('[OK]', metricsX, yPos + 9, { fontSize: 9, color: colors.success, bold: true })
  addText(`${totalCompleted} Completed`, metricsX + 18, yPos + 9, { fontSize: 9, color: colors.text })
  
  // Tasks pending
  metricsX += metricsSpacing
  addText('[ ]', metricsX, yPos + 9, { fontSize: 9, color: colors.danger, bold: true })
  addText(`${totalPending} Pending`, metricsX + 18, yPos + 9, { fontSize: 9, color: colors.text })
  
  // Time info
  if (dayRecord?.checkIn) {
    metricsX += metricsSpacing
    const checkInTime = new Date(dayRecord.checkIn).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
    addText(`In: ${checkInTime}`, metricsX, yPos + 9, { fontSize: 9, color: colors.text })
  }
  
  if (dayRecord?.checkOut) {
    metricsX += metricsSpacing - 10
    const checkOutTime = new Date(dayRecord.checkOut).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
    addText(`Out: ${checkOutTime}`, metricsX, yPos + 9, { fontSize: 9, color: colors.text })
  }
  
  yPos += 20
  
  // Signature badge (if signed)
  if (signature) {
    drawBox(margin, yPos, contentWidth, 12, colors.success, undefined, 3)
    addText('[SIGNED] DOCUMENT DIGITALLY SIGNED', pageWidth/2, yPos + 8, { 
      fontSize: 9, 
      color: colors.white, 
      bold: true,
      align: 'center'
    })
    yPos += 16
  }
  
  // Observations section (if present) - Get from timeRecord or passed parameter
  const dayObservations = observations || dayRecord?.observations
  if (dayObservations && dayObservations.trim() !== '') {
    // Observations box with accent border
    const obsLines = pdf.splitTextToSize(dayObservations, contentWidth - 20)
    const obsHeight = Math.max(25, 15 + (obsLines.length * 4.5))
    
    drawBox(margin, yPos, contentWidth, obsHeight, colors.bgDark, colors.accent, 3)
    
    // Header
    addText('OBSERVATIONS / NOTES', margin + 8, yPos + 8, { 
      fontSize: 9, 
      color: colors.accent, 
      bold: true 
    })
    
    // Observations text
    addText(dayObservations, margin + 8, yPos + 16, { 
      fontSize: 9, 
      color: colors.text,
      maxWidth: contentWidth - 16
    })
    
    yPos += obsHeight + 8
  }
  
  // Section Tasks - Ultra Modern Design
  drawLine(margin, yPos, pageWidth - margin, yPos, colors.border, 0.5)
  yPos += 8
  
  addText('TASK BREAKDOWN', margin, yPos, { 
    fontSize: 14, 
    color: colors.primary, 
    bold: true 
  })
  yPos += 12
  
  // Process sections with modern cards
  for (const section of sections) {
    if (yPos > pageHeight - 60) {
      pdf.addPage()
      yPos = margin
      
      // Page header on new pages
      drawLine(margin, yPos, pageWidth - margin, yPos, colors.accent, 2)
      yPos += 10
    }
    
    const sectionTasks = tasks.filter((t) => t.day === day && section.tasks.includes(t.taskName))
    
    // More robust check for completed tasks
    const isTaskCompleted = (completedValue: unknown): boolean => {
      if (typeof completedValue === 'boolean') return completedValue
      if (typeof completedValue === 'string') return completedValue.toLowerCase() === 'true' || completedValue === '1'
      if (typeof completedValue === 'number') return completedValue === 1
      return false
    }
    
    const completed = sectionTasks.filter((t) => isTaskCompleted(t.completed)).length
    
    // Total is the number of tasks configured for this section
    const total = section.tasks.length
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0
    const isComplete = percentage === 100
    
    // Debug logging
    console.log(`[PDF] Section: ${section.title}`)
    console.log(`[PDF] Section tasks from config:`, section.tasks)
    console.log(`[PDF] Section tasks found:`, sectionTasks.map(t => ({ 
      taskName: t.taskName, 
      completed: t.completed, 
      completedType: typeof t.completed 
    })))
    console.log(`[PDF] Completed: ${completed}, Total: ${total}, Percentage: ${percentage}%`)
    
    // Modern section card
    const sectionHeight = 8 + (section.tasks.length * 6) + 10
    drawBox(margin, yPos, contentWidth, sectionHeight, colors.white, colors.border, 3)
    
    // Section header with gradient accent
    const headerColor = isComplete ? colors.success : colors.accent
    drawBox(margin, yPos, contentWidth, 12, undefined, undefined, 3)
    drawGradient(margin + 0.5, yPos + 0.5, 4, 11, headerColor, colors.gradient2)
    
    addText(section.title.toUpperCase(), margin + 10, yPos + 8, { 
      fontSize: 10, 
      color: colors.primary, 
      bold: true,
      maxWidth: contentWidth - 80
    })
    
    // Progress badge
    const badgeX = pageWidth - margin - 50
    const badgeColor = isComplete ? colors.success : 
                      percentage >= 75 ? colors.accent : 
                      percentage >= 50 ? colors.warning : colors.danger
    
    drawBox(badgeX, yPos + 3, 45, 6, badgeColor, undefined, 2)
    addText(`${percentage}% (${completed}/${total})`, badgeX + 22.5, yPos + 7, { 
      fontSize: 7, 
      color: colors.white, 
      bold: true,
      align: 'center'
    })
    
    yPos += 16
    
    // Task list with modern checkboxes
    let taskY = yPos
    for (const taskName of section.tasks) {
      const task = sectionTasks.find((t) => t.taskName === taskName)
      
      // More robust check for completed
      const completed: unknown = task?.completed
      const isCompleted = (() => {
        if (typeof completed === 'boolean') return completed
        if (typeof completed === 'string') return completed.toLowerCase() === 'true' || completed === '1'
        if (typeof completed === 'number') return completed === 1
        return false
      })()
      
      if (taskY > pageHeight - 20) {
      pdf.addPage()
        taskY = margin + 20
      }
      
      if (isCompleted) {
        // Completed task - green checkbox
        drawBox(margin + 8, taskY - 3, 4, 4, colors.success, undefined, 1)
        addText('[X]', margin + 10, taskY, { 
          fontSize: 7, 
          color: colors.white, 
          bold: true 
        })
        addText(taskName, margin + 16, taskY, { 
          fontSize: 8, 
          color: colors.textSecondary,
          maxWidth: contentWidth - 30
        })
      } else {
        // Pending task - empty checkbox
        drawBox(margin + 8, taskY - 3, 4, 4, undefined, colors.danger, 1)
        addText('[ ]', margin + 10, taskY, { 
          fontSize: 7, 
          color: colors.danger, 
          bold: true 
        })
        addText(taskName, margin + 16, taskY, { 
          fontSize: 8, 
          color: colors.text,
          bold: true,
          maxWidth: contentWidth - 30
        })
      }
      taskY += 6
    }
    
    yPos = taskY + 8
  }
  
  // Modern Footer
  const footerY = pageHeight - 20
  drawBox(0, footerY, pageWidth, 20, colors.bgDark)
  
  // Footer content
    const today = new Date()
  const dateStr = today.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
  
  addText('BRIGHT WORKS PROFESSIONAL', pageWidth/2, footerY + 7, { 
    fontSize: 8, 
    color: colors.primary, 
    bold: true,
    align: 'center'
  })
  addText(`Report generated on ${dateStr}`, pageWidth/2, footerY + 12, { 
    fontSize: 7, 
    color: colors.textSecondary,
    align: 'center'
  })
  
  // Add page numbers if multiple pages
  const pageCount = pdf.getNumberOfPages()
  if (pageCount > 1) {
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i)
      addText(`Page ${i} of ${pageCount}`, pageWidth - margin, footerY + 10, { 
        fontSize: 7, 
        color: colors.textLight,
        align: 'right'
      })
    }
  }
  
  // Save with descriptive filename
  const roomStr = roomLabel ? roomLabel.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'general'
  const filename = `BW_Report_${roomStr}_Week${week}_${dayName.replace(/\s+/g, '_')}_${today.toISOString().split('T')[0]}.pdf`
  pdf.save(filename)
}
