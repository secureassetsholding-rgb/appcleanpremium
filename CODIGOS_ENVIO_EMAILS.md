# CÓDIGOS COMPLETOS - ENVÍO AUTOMÁTICO DE EMAILS

## 📧 BACKEND - server.js

### 1. Schema de EmailNotificationConfig (líneas 269-283)

```javascript
// Email Notification Configuration Schema - Para gestionar qué admins reciben emails
const EmailNotificationConfigSchema = new mongoose.Schema({
  sectionCompletion: {
    enabledAdmins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    enabled: { type: Boolean, default: true }
  },
  dayCompletion: {
    enabledAdmins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    enabled: { type: Boolean, default: true }
  },
  updatedAt: { type: Date, default: Date.now },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true })

const EmailNotificationConfig = mongoose.model('EmailNotificationConfig', EmailNotificationConfigSchema)
```

### 2. Función sendEmail (líneas 74-162)

```javascript
async function sendEmail(to, subject, html) {
  if (!emailConfigured) {
    console.warn('⚠️  Email not sent: SendGrid not configured')
    console.warn(`   To: ${Array.isArray(to) ? to.join(', ') : to}`)
    console.warn(`   Subject: ${subject}`)
    return { success: false, message: 'Email service not configured' }
  }
  
  if (!to || (Array.isArray(to) && to.length === 0)) {
    console.warn('⚠️  Email not sent: No recipient provided')
    return { success: false, message: 'No recipient provided' }
  }
  
  try {
    const recipients = Array.isArray(to) ? to : [to]
    const validRecipients = recipients.filter(email => email && email.includes('@'))
    
    if (validRecipients.length === 0) {
      console.warn('⚠️  Email not sent: No valid email addresses')
      console.warn(`   Recipients:`, recipients)
      return { success: false, message: 'No valid email addresses' }
    }
    
    // Extract plain text from HTML for better deliverability
    const plainText = html
      .replace(/<style[^>]*>.*?<\/style>/gis, '')
      .replace(/<script[^>]*>.*?<\/script>/gis, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim()
    
    const msg = {
      to: validRecipients,
      from: {
        email: emailFrom,
        name: 'Bright Works Professional'
      },
      subject: subject,
      html: html,
      trackingSettings: {
        clickTracking: { enable: false },
        openTracking: { enable: false }
      }
    }
    
    console.log(`[sendEmail] Attempting to send email to: ${validRecipients.join(', ')}`)
    console.log(`[sendEmail] Subject: ${subject}`)
    console.log(`[sendEmail] From: ${emailFrom}`)
    console.log(`[sendEmail] Message config:`, JSON.stringify({
      to: validRecipients,
      from: emailFrom,
      subject: subject.substring(0, 50),
      hasHtml: !!html,
      htmlLength: html ? html.length : 0
    }, null, 2))
    
    const response = await sgMail.send(msg)
    console.log(`✅ Email sent successfully to: ${validRecipients.join(', ')}`)
    
    // Log response details safely (SendGrid response format may vary)
    try {
      if (Array.isArray(response) && response[0]) {
        console.log(`[sendEmail] SendGrid response:`, JSON.stringify({
          statusCode: response[0].statusCode,
          headers: response[0].headers ? Object.keys(response[0].headers) : [],
          body: response[0].body ? 'present' : 'missing'
        }, null, 2))
      } else {
        console.log(`[sendEmail] SendGrid response:`, typeof response, response ? 'object received' : 'null/undefined')
      }
    } catch (logErr) {
      console.log(`[sendEmail] Could not log response details:`, logErr.message)
    }
    
    return { success: true, message: 'Email sent successfully', recipients: validRecipients.length, response }
  } catch (err) {
    const errorMessage = err.response?.body?.errors?.[0]?.message || err.message
    const errorDetails = err.response?.body?.errors || []
    console.error('❌ Email send error:', errorMessage)
    console.error('❌ Error details:', JSON.stringify(errorDetails, null, 2))
    console.error('❌ Full error:', err)
    return { success: false, message: errorMessage, error: err }
  }
}
```

### 3. Función getAdminEmails (líneas 165-249)

```javascript
// Get admin emails based on notification configuration
async function getAdminEmails(type = 'sectionCompletion') {
  try {
    if (!mongoConnected) {
      console.log(`[getAdminEmails] MongoDB not connected, returning empty array for type: ${type}`)
      return []
    }
    
    // Obtener configuración de notificaciones
    let config = await EmailNotificationConfig.findOne()
    
    // Si no existe configuración, crear una por defecto con todos los admins y superadmins
    if (!config) {
      console.log(`[getAdminEmails] No email notification config found, creating default...`)
      const allAdmins = await User.find({ 
        $or: [{ role: 'admin' }, { role: 'superadmin' }],
        isActive: true 
      }).select('_id email username')
      
      console.log(`[getAdminEmails] Found ${allAdmins.length} admins for default config`)
      
      config = await EmailNotificationConfig.create({
        sectionCompletion: {
          enabledAdmins: allAdmins.map(a => a._id),
          enabled: true
        },
        dayCompletion: {
          enabledAdmins: allAdmins.map(a => a._id),
          enabled: true
        }
      })
      console.log(`[getAdminEmails] Default email notification config created`)
    }
    
    // Obtener la configuración del tipo de notificación solicitado
    const notificationConfig = config[type] || config.sectionCompletion
    
    console.log(`[getAdminEmails] Type: ${type}, Enabled: ${notificationConfig?.enabled}, EnabledAdmins count: ${notificationConfig?.enabledAdmins?.length || 0}`)
    
    // Si está deshabilitado, retornar array vacío
    if (!notificationConfig || !notificationConfig.enabled) {
      console.log(`[getAdminEmails] Email notifications disabled for type: ${type}`)
      return []
    }
    
    // Obtener emails de los admins habilitados
    if (notificationConfig.enabledAdmins && notificationConfig.enabledAdmins.length > 0) {
      const enabledUsers = await User.find({
        _id: { $in: notificationConfig.enabledAdmins },
        isActive: true,
        $or: [{ role: 'admin' }, { role: 'superadmin' }]
      }).select('email username fullName')
      
      const emails = enabledUsers.map(u => u.email).filter(Boolean)
      console.log(`[getAdminEmails] Found ${emails.length} enabled admin emails for ${type}:`, emails)
      return emails
    }
    
    // Si no hay admins específicos habilitados, retornar todos los admins
    console.log(`[getAdminEmails] No specific admins enabled, returning all admins...`)
    const allAdmins = await User.find({ 
      $or: [{ role: 'admin' }, { role: 'superadmin' }],
      isActive: true 
    }).select('email username')
    
    const emails = allAdmins.map(u => u.email).filter(Boolean)
    console.log(`[getAdminEmails] Returning all ${emails.length} admin emails:`, emails)
    return emails
  } catch (err) {
    console.error(`[getAdminEmails] Error getting admin emails for type ${type}:`, err.message)
    console.error(`[getAdminEmails] Error stack:`, err.stack)
    // Fallback: retornar todos los admins
    try {
      const admins = await User.find({ 
        $or: [{ role: 'admin' }, { role: 'superadmin' }],
        isActive: true 
      }).select('email username')
      const emails = admins.map(u => u.email).filter(Boolean)
      console.log(`[getAdminEmails] Fallback: returning ${emails.length} admin emails:`, emails)
      return emails
    } catch (fallbackErr) {
      console.error(`[getAdminEmails] Fallback error:`, fallbackErr.message)
      return []
    }
  }
}
```

### 4. Endpoint POST /api/emails/section-completion (líneas 1908-2113)

```javascript
// POST /api/emails/section-completion - Send email when a section is completed
app.post('/api/emails/section-completion', authenticateToken, async (req, res) => {
  console.log(`[Section Completion Email] ========== ENDPOINT CALLED ==========`)
  console.log(`[Section Completion Email] User:`, req.user?.username || 'unknown', req.user?.userId || 'no-id')
  console.log(`[Section Completion Email] Body:`, JSON.stringify({
    sectionId: req.body.sectionId,
    sectionTitle: req.body.sectionTitle?.substring(0, 50),
    day: req.body.day,
    week: req.body.week,
    userId: req.body.userId,
    userName: req.body.userName?.substring(0, 30)
  }, null, 2))
  
  try {
    if (!emailConfigured) {
      console.error(`[Section Completion Email] ❌ Email service not configured!`)
      return res.status(503).json({ message: 'Email service not configured' })
    }
    console.log(`[Section Completion Email] ✅ Email service is configured`)

    const { sectionId, sectionTitle, day, week, userId, userName, room, roomKey } = req.body

    if (!sectionId || !sectionTitle || !day || !week) {
      return res.status(400).json({ message: 'Missing required fields' })
    }

    // Get tasks for this section, day, week, and room
    if (!mongoConnected) {
      return res.status(503).json({ message: 'Database not available' })
    }

    const query = { userId, week, day }
    if (roomKey) {
      query.roomKey = roomKey.toLowerCase().trim()
    } else if (room) {
      query.$or = [
        { room: room.trim() },
        { roomKey: room.toLowerCase().trim().replace(/\s+/g, '-') }
      ]
    }

    const dayTasks = await Task.find(query)
    
    // Get section tasks from config
    const userConfig = await TaskConfig.findOne({ userId })
    const section = userConfig?.sections?.find((s) => s.id === sectionId)
    
    if (!section || !section.tasks || !Array.isArray(section.tasks)) {
      return res.status(404).json({ message: 'Section not found' })
    }

    // Filter tasks by section
    const sectionTasks = dayTasks.filter((task) => 
      section.tasks.includes(task.taskName)
    )

    const completedTasks = sectionTasks.filter((task) => task.completed)
    const completedCount = completedTasks.length
    const totalCount = section.tasks.length
    const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

    // Day name
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const dayName = dayNames[day - 1] || `Day ${day}`

    // Get admin emails para section completion
    console.log(`[Section Completion Email] Getting admin emails...`)
    const recipients = await getAdminEmails('sectionCompletion')
    console.log(`[Section Completion Email] Recipients: ${recipients.length}`, recipients)
    if (recipients.length === 0) {
      console.warn(`[Section Completion Email] No recipients found!`)
      console.warn(`[Section Completion Email] This might mean email notifications are disabled or no admins are selected.`)
      // Still return success but log the issue
      return res.status(200).json({ 
        success: false,
        message: 'No admin emails configured for section completion notifications',
        recipients: 0,
        total: 0
      })
    }

    // Build email HTML matching the example format
    const completedTasksHTML = completedTasks.map((task) => `
      <div style="background:#f0fdf4;border:2px solid #86efac;border-radius:8px;padding:12px;margin-bottom:8px;display:flex;align-items:center;gap:10px;">
        <span style="color:#10b981;font-size:20px;">✅</span>
        <span style="color:#1f2937;font-weight:600;font-size:14px;">${task.taskName}</span>
      </div>
    `).join('')

    const allTasksHTML = section.tasks.map((taskName) => {
      const task = sectionTasks.find((t) => t.taskName === taskName)
      const isCompleted = task?.completed || false
      return `
        <div style="padding:8px 0;border-bottom:1px solid #e5e7eb;">
          <span style="color:#1f2937;font-size:14px;">${taskName}</span>
          <span style="color:#10b981;font-weight:600;margin-left:8px;font-size:12px;">${isCompleted ? 'COMPLETED' : 'PENDING'}</span>
        </div>
      `
    }).join('')

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Section completion alert</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#f3f4f6;">
  <div style="max-width:650px;margin:20px auto;background:#ffffff;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
    <div style="background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);color:white;padding:30px;text-align:center;">
      <h1 style="margin:0 0 10px 0;font-size:28px;font-weight:700;">BRIGHT WORKS PROFESSIONAL</h1>
      <p style="margin:0;font-size:16px;opacity:0.9;">Section completion alert.</p>
    </div>
    <div style="padding:30px;">
      <h2 style="color:#1e40af;font-size:24px;margin:0 0 20px 0;font-weight:700;text-align:center;">SECTION COMPLETED</h2>
      <h3 style="color:#1f2937;font-size:18px;margin:0 0 30px 0;text-align:center;font-weight:600;">${sectionTitle} - Week ${week} - ${dayName}</h3>
      
      <div style="display:flex;gap:10px;margin-bottom:30px;flex-wrap:wrap;">
        <div style="flex:1;min-width:140px;background:#f9fafb;border:2px solid #e5e7eb;border-radius:8px;padding:15px;text-align:center;">
          <div style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;margin-bottom:5px;">COMPLETION</div>
          <div style="color:#1f2937;font-size:20px;font-weight:700;">${completedCount}/${totalCount}</div>
        </div>
        <div style="flex:1;min-width:140px;background:#f9fafb;border:2px solid #e5e7eb;border-radius:8px;padding:15px;text-align:center;">
          <div style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;margin-bottom:5px;">RATE</div>
          <div style="color:#1f2937;font-size:20px;font-weight:700;">${completionRate}%</div>
        </div>
        <div style="flex:1;min-width:140px;background:#f9fafb;border:2px solid #e5e7eb;border-radius:8px;padding:15px;text-align:center;">
          <div style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;margin-bottom:5px;">COMPLETED BY</div>
          <div style="color:#1f2937;font-size:14px;font-weight:600;">${userName || 'Employee'}</div>
        </div>
        <div style="flex:1;min-width:140px;background:#f9fafb;border:2px solid #e5e7eb;border-radius:8px;padding:15px;text-align:center;">
          <div style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;margin-bottom:5px;">AREA / ROOM</div>
          <div style="color:#1f2937;font-size:14px;font-weight:600;">${room || 'General'}</div>
        </div>
      </div>

      <div style="margin-bottom:30px;">
        <h4 style="color:#1e40af;font-size:16px;font-weight:600;margin:0 0 15px 0;">COMPLETED TASKS</h4>
        ${completedTasksHTML || '<p style="color:#64748b;font-size:14px;">No completed tasks</p>'}
      </div>

      <div style="margin-bottom:30px;">
        <h4 style="color:#1e40af;font-size:16px;font-weight:600;margin:0 0 15px 0;">SECTION TASKS</h4>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:15px;">
          ${allTasksHTML}
        </div>
      </div>
    </div>
    <div style="background:#f9fafb;border-top:2px solid #e5e7eb;padding:20px;text-align:center;">
      <p style="color:#64748b;font-size:12px;margin:0 0 10px 0;">AUTOMATED NOTIFICATION</p>
      <p style="margin:0;">
        <a href="https://brightworks.app" style="color:#3b82f6;text-decoration:none;font-weight:600;">BRIGHTWORKS.APP</a>
      </p>
      <p style="color:#9ca3af;font-size:11px;margin:10px 0 0 0;">© 2025 BRIGHT WORKS PROFESSIONAL. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `

    // Send email to all admins
    const results = await Promise.allSettled(
      recipients.map((email) => 
        sendEmail(email, `Section completion alert - ${sectionTitle}`, html)
      )
    )

    // Check both fulfilled and rejected promises, and also check the result.success
    const successCount = results.filter((r) => {
      if (r.status === 'fulfilled') {
        return r.value && r.value.success === true
      }
      return false
    }).length
    
    const failedResults = results.filter((r) => {
      if (r.status === 'rejected') return true
      if (r.status === 'fulfilled' && r.value && r.value.success === false) return true
      return false
    })
    
    if (failedResults.length > 0) {
      console.error(`❌ Section completion email failures (${failedResults.length}):`)
      failedResults.forEach((r, idx) => {
        if (r.status === 'rejected') {
          console.error(`   ${idx + 1}. Rejected:`, r.reason)
        } else if (r.value) {
          console.error(`   ${idx + 1}. Failed:`, r.value.message || 'Unknown error', r.value.error)
        }
      })
    }
    
    console.log(`✅ Section completion email sent: ${sectionTitle} - Week ${week} - ${dayName} - Room ${room || 'General'} - ${successCount}/${recipients.length} recipients`)

    res.json({ 
      success: true, 
      message: 'Section completion email sent',
      recipients: successCount,
      total: recipients.length
    })
  } catch (err) {
    console.error('Section completion email error:', err.message)
    res.status(500).json({ message: 'Error sending section completion email' })
  }
})
```

### 5. Endpoint POST /api/emails/day-completion (líneas 2115-2343)

```javascript
// POST /api/emails/day-completion - Send email when day is signed (daily report)
app.post('/api/emails/day-completion', authenticateToken, async (req, res) => {
  console.log(`[Day Completion Email] ========== ENDPOINT CALLED ==========`)
  console.log(`[Day Completion Email] User:`, req.user?.username || 'unknown', req.user?.userId || 'no-id')
  console.log(`[Day Completion Email] Body:`, JSON.stringify({
    day: req.body.day,
    week: req.body.week,
    userId: req.body.userId,
    userName: req.body.userName?.substring(0, 30),
    room: req.body.room?.substring(0, 30)
  }, null, 2))
  
  try {
    if (!emailConfigured) {
      console.error(`[Day Completion Email] ❌ Email service not configured!`)
      return res.status(503).json({ message: 'Email service not configured' })
    }
    console.log(`[Day Completion Email] ✅ Email service is configured`)

    const { day, week, userId, userName, signature, room, roomKey } = req.body

    if (!day || !week || !userId) {
      return res.status(400).json({ message: 'Day, week, and userId are required' })
    }

    if (!mongoConnected) {
      return res.status(503).json({ message: 'Database not available' })
    }

    // Get tasks for this day, week, and room
    const query = { userId, week, day }
    if (roomKey) {
      query.roomKey = roomKey.toLowerCase().trim()
    } else if (room) {
      query.$or = [
        { room: room.trim() },
        { roomKey: room.toLowerCase().trim().replace(/\s+/g, '-') }
      ]
    }

    const dayTasks = await Task.find(query)
    
    // Get time record
    const timeRecordQuery = { userId, week, day }
    if (roomKey) {
      timeRecordQuery.roomKey = roomKey.toLowerCase().trim()
    } else if (room) {
      timeRecordQuery.$or = [
        { room: room.trim() },
        { roomKey: room.toLowerCase().trim().replace(/\s+/g, '-') }
      ]
    }
    
    const timeRecord = await TimeRecord.findOne(timeRecordQuery)
    
    // Get user config for sections
    const userConfig = await TaskConfig.findOne({ userId })
    const sections = userConfig?.sections || []
    
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const dayName = dayNames[day - 1] || `Day ${day}`
    
    // Get admin emails para day completion
    console.log(`[Day Completion Email] Getting admin emails...`)
    const recipients = await getAdminEmails('dayCompletion')
    console.log(`[Day Completion Email] Recipients: ${recipients.length}`, recipients)
    if (recipients.length === 0) {
      console.warn(`[Day Completion Email] No recipients found!`)
      console.warn(`[Day Completion Email] This might mean email notifications are disabled or no admins are selected.`)
      // Still return success but log the issue
      return res.status(200).json({ 
        success: false,
        message: 'No admin emails configured for day completion notifications',
        recipients: 0,
        total: 0
      })
    }

    // Build sections HTML
    const sectionsHTML = sections.map((section) => {
      if (!section || !section.tasks || !Array.isArray(section.tasks)) return ''
      
      const sectionTasks = dayTasks.filter((task) => 
        section.tasks.includes(task.taskName)
      )
      const completed = sectionTasks.filter((t) => t.completed).length
      const total = section.tasks.length
      const percentage = total > 0 ? Math.round((completed / total) * 100) : 0
      
      const completedTasksHTML = sectionTasks
        .filter((t) => t.completed)
        .map((t) => `<li style="color:#10b981;margin:5px 0;">✅ ${t.taskName}</li>`)
        .join('')
      
      const pendingTasksHTML = section.tasks
        .filter((taskName) => !sectionTasks.find((t) => t.taskName === taskName && t.completed))
        .map((taskName) => `<li style="color:#dc2626;margin:5px 0;">⏳ ${taskName}</li>`)
        .join('')
      
      return `
        <div style="background:${percentage === 100 ? '#f0fdf4' : '#fef2f2'};padding:15px;border-radius:8px;border:2px solid ${percentage === 100 ? '#86efac' : '#fecaca'};margin-bottom:15px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <h4 style="color:#1e40af;font-size:16px;margin:0;font-weight:600;">${section.title}</h4>
            <span style="background:${percentage === 100 ? '#10b981' : '#ef4444'};color:white;padding:4px 12px;border-radius:12px;font-size:12px;font-weight:600;">
              ${percentage}% (${completed}/${total})
            </span>
          </div>
          ${completedTasksHTML ? `<ul style="margin:5px 0 0 20px;padding:0;list-style:none;">${completedTasksHTML}</ul>` : ''}
          ${pendingTasksHTML ? `<ul style="margin:5px 0 0 20px;padding:0;list-style:none;">${pendingTasksHTML}</ul>` : ''}
        </div>
      `
    }).join('')

    const totalCompleted = dayTasks.filter((t) => t.completed).length
    const totalTasks = dayTasks.length
    const overallPercentage = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Report - ${dayName}</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#f3f4f6;">
  <div style="max-width:650px;margin:20px auto;background:#ffffff;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
    <div style="background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);color:white;padding:30px;text-align:center;">
      <h1 style="margin:0 0 10px 0;font-size:28px;font-weight:700;">BRIGHT WORKS PROFESSIONAL</h1>
      <p style="margin:0;font-size:16px;opacity:0.9;">Daily Report - ${dayName} - Week ${week}</p>
    </div>
    <div style="padding:30px;">
      <div style="display:flex;gap:10px;margin-bottom:30px;flex-wrap:wrap;">
        <div style="flex:1;min-width:140px;background:#f9fafb;border:2px solid #e5e7eb;border-radius:8px;padding:15px;text-align:center;">
          <div style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;margin-bottom:5px;">EMPLOYEE</div>
          <div style="color:#1f2937;font-size:14px;font-weight:600;">${userName || 'Employee'}</div>
        </div>
        <div style="flex:1;min-width:140px;background:#f9fafb;border:2px solid #e5e7eb;border-radius:8px;padding:15px;text-align:center;">
          <div style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;margin-bottom:5px;">AREA / ROOM</div>
          <div style="color:#1f2937;font-size:14px;font-weight:600;">${room || 'General'}</div>
        </div>
        <div style="flex:1;min-width:140px;background:#f9fafb;border:2px solid #e5e7eb;border-radius:8px;padding:15px;text-align:center;">
          <div style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;margin-bottom:5px;">COMPLETION</div>
          <div style="color:#1f2937;font-size:20px;font-weight:700;">${totalCompleted}/${totalTasks}</div>
        </div>
        <div style="flex:1;min-width:140px;background:#f9fafb;border:2px solid #e5e7eb;border-radius:8px;padding:15px;text-align:center;">
          <div style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;margin-bottom:5px;">RATE</div>
          <div style="color:#1f2937;font-size:20px;font-weight:700;">${overallPercentage}%</div>
        </div>
      </div>
      
      ${timeRecord ? `
        <div style="background:#f9fafb;border:2px solid #e5e7eb;border-radius:8px;padding:15px;margin-bottom:30px;">
          <h4 style="color:#1e40af;font-size:16px;font-weight:600;margin:0 0 10px 0;">TIME RECORD</h4>
          ${timeRecord.startTime ? `<p style="margin:5px 0;color:#1f2937;"><strong>Start:</strong> ${new Date(timeRecord.startTime).toLocaleTimeString()}</p>` : ''}
          ${timeRecord.endTime ? `<p style="margin:5px 0;color:#1f2937;"><strong>End:</strong> ${new Date(timeRecord.endTime).toLocaleTimeString()}</p>` : ''}
          ${timeRecord.totalHours !== undefined ? `<p style="margin:5px 0;color:#1f2937;"><strong>Total Hours:</strong> ${timeRecord.totalHours.toFixed(2)}h</p>` : ''}
        </div>
      ` : ''}
      
      <h4 style="color:#1e40af;font-size:18px;font-weight:600;margin:0 0 15px 0;">SECTIONS</h4>
      ${sectionsHTML || '<p style="color:#64748b;">No sections configured</p>'}
    </div>
    <div style="background:#f9fafb;border-top:2px solid #e5e7eb;padding:20px;text-align:center;">
      <p style="color:#64748b;font-size:12px;margin:0 0 10px 0;">AUTOMATED NOTIFICATION</p>
      <p style="margin:0;">
        <a href="https://brightworks.app" style="color:#3b82f6;text-decoration:none;font-weight:600;">BRIGHTWORKS.APP</a>
      </p>
      <p style="color:#9ca3af;font-size:11px;margin:10px 0 0 0;">© 2025 BRIGHT WORKS PROFESSIONAL. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `

    // Send email to all configured admins
    console.log(`[Day Completion Email] Sending to ${recipients.length} recipients:`, recipients)
    const results = await Promise.allSettled(
      recipients.map((email) => {
        console.log(`[Day Completion Email] Sending email to: ${email}`)
        return sendEmail(email, `Daily Report - ${dayName} - Week ${week} - ${room || 'General'}`, html)
      })
    )

    // Check both fulfilled and rejected promises, and also check the result.success
    const successCount = results.filter((r) => {
      if (r.status === 'fulfilled') {
        return r.value && r.value.success === true
      }
      return false
    }).length
    
    const failedResults = results.filter((r) => {
      if (r.status === 'rejected') return true
      if (r.status === 'fulfilled' && r.value && r.value.success === false) return true
      return false
    })
    
    if (failedResults.length > 0) {
      console.error(`❌ Day completion email failures (${failedResults.length}):`)
      failedResults.forEach((r, idx) => {
        if (r.status === 'rejected') {
          console.error(`   ${idx + 1}. Rejected:`, r.reason)
        } else if (r.value) {
          console.error(`   ${idx + 1}. Failed:`, r.value.message || 'Unknown error', r.value.error)
        }
      })
    }
    
    console.log(`✅ Day completion email sent: ${dayName} - Week ${week} - Room ${room || 'General'} - ${successCount}/${recipients.length} recipients`)

    res.json({ 
      success: true, 
      message: 'Day completion email sent',
      recipients: successCount,
      total: recipients.length
    })
  } catch (err) {
    console.error('Day completion email error:', err.message)
    res.status(500).json({ message: 'Error sending day completion email' })
  }
})
```

---

## 🎨 FRONTEND

### 1. Servicio de Email - src/services/email.ts

```typescript
import { api } from './api'

export interface SectionCompletionEmailParams {
  sectionId: string
  sectionTitle: string
  day: number
  week: number
  userId: string
  userName: string
  room?: string
  roomKey?: string
}

export interface DayCompletionEmailParams {
  day: number
  week: number
  userId: string
  userName: string
  signature: string
  room?: string
  roomKey?: string
}

export const emailService = {
  async sendSectionCompletionEmail(params: SectionCompletionEmailParams): Promise<void> {
    await api.post('/api/emails/section-completion', params)
  },

  async sendDayCompletionEmail(params: DayCompletionEmailParams): Promise<void> {
    await api.post('/api/emails/day-completion', params)
  },

  async sendAppAccessEmail(userId: string): Promise<void> {
    await api.post('/api/send-app-access-email', { userId })
  },
}
```

### 2. Llamadas desde Schedule.tsx

#### 2.1. Envío automático cuando se completa una sección (líneas 325-350)

```typescript
const notifySectionCompletion = async (section: TaskSection, day: number, trackerKey: string) => {
  if (!user) {
    toast.error('You must be logged in to send notifications.')
    sectionEmailSentRef.current.delete(trackerKey)
    return
  }

  try {
    await emailService.sendSectionCompletionEmail({
      sectionId: section.id,
      sectionTitle: section.title,
      day,
      week: currentWeek,
      userId: user._id,
      userName: user.fullName || user.username,
      room: activeRoomLabel,
      roomKey: activeRoomKey,
    })
    const dayName = WORK_DAYS.find((workDay) => workDay.num === day)?.fullName ?? `Day ${day}`
    toast.success(`${section.title} completed · Email sent for ${dayName}`)
  } catch (error) {
    console.error('Section completion email error:', error)
    sectionEmailSentRef.current.delete(trackerKey)
    toast.error('Unable to send section completion email right now.')
  }
}
```

#### 2.2. Envío automático cuando se firma el día (líneas 410-451)

```typescript
const handleDaySignature = async (day: number, signature: string) => {
  // ... código de firma ...
  
  const trackerKey = `${currentWeek}-${day}-${user._id}-${activeRoomKey}`
  if (dayEmailSentRef.current.has(trackerKey)) {
    console.log(`Email ya enviado para room ${activeRoomKey} - día ${day}`)
    return
  }

  dayEmailSentRef.current.add(trackerKey)
  
  // Automatically send email when day is signed
  const dayName = WORK_DAYS.find((workDay) => workDay.num === day)?.fullName ?? `Day ${day}`
  try {
    toast.loading(`Sending automatic email notification for ${dayName}...`, { id: `auto-email-${day}` })
    
    await emailService.sendDayCompletionEmail({
      day,
      week: currentWeek,
      signature,
      userId: user._id,
      userName: user.fullName || user.username,
      room: activeRoomLabel,
      roomKey: activeRoomKey,
    })
    
    toast.success(`Automatic email sent for ${dayName}`, { 
      id: `auto-email-${day}`, 
      icon: '📧',
      duration: 3000
    })
  } catch (error) {
    console.error('Automatic email error:', error)
    dayEmailSentRef.current.delete(trackerKey)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    toast.error(`Unable to send automatic email: ${errorMessage}`, { 
      id: `auto-email-${day}` 
    })
  }
}
```

#### 2.3. Envío manual desde el menú de acciones (líneas 507-530)

```typescript
case 'mail': {
  const trackerKey = `${currentWeek}-${day}-${user._id}-${activeRoomKey}`
  try {
    toast.loading(`Sending email for ${dayName}...`, { id: `daily-report-${day}` })
    
    await emailService.sendDayCompletionEmail({
      day,
      week: currentWeek,
      signature,
      userId: user._id,
      userName: user.fullName || user.username,
      room: activeRoomLabel,
      roomKey: activeRoomKey,
    })
    
    dayEmailSentRef.current.add(trackerKey)
    toast.success(`Daily report sent via email for ${dayName}`, { 
      id: `daily-report-${day}`, 
      icon: '📧',
      duration: 3000
    })
  } catch (error) {
    console.error('Email error:', error)
    // ... manejo de error ...
  }
  break
}
```

---

## 📝 RESUMEN

### Flujo de envío automático de emails:

1. **Section Completion Email**:
   - Se dispara cuando todas las tareas de una sección están completadas
   - Función: `notifySectionCompletion` en `Schedule.tsx`
   - Endpoint: `POST /api/emails/section-completion`
   - Tipo de configuración: `'sectionCompletion'`

2. **Day Completion Email**:
   - Se dispara automáticamente cuando se firma el día
   - También se puede enviar manualmente desde el menú de acciones
   - Función: `handleDaySignature` en `Schedule.tsx`
   - Endpoint: `POST /api/emails/day-completion`
   - Tipo de configuración: `'dayCompletion'`

### Configuración:
- Los administradores que reciben los emails se configuran en la página "Email Notifications"
- Se almacena en la colección `EmailNotificationConfig` en MongoDB
- `getAdminEmails(type)` obtiene los emails según la configuración
- Si no hay configuración, se crea una por defecto con todos los admins activos

### Logging:
- Todos los pasos están logueados con prefijos como `[Section Completion Email]`, `[Day Completion Email]`, `[sendEmail]`, `[getAdminEmails]`
- Los logs muestran: destinatarios, estado de envío, errores, etc.











