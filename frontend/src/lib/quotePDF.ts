import jsPDF from 'jspdf'
import { Quote } from '../pages/Quotes'

// Function to compress Base64 image
function compressImage(base64String: string, maxWidth = 800, quality = 0.7): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let width = img.width
      let height = img.height
      
      // Resize if too large
      if (width > maxWidth) {
        height = (height * maxWidth) / width
        width = maxWidth
      }
      
      canvas.width = width
      canvas.height = height
      
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height)
        // Convert to JPEG with compression
        const compressed = canvas.toDataURL('image/jpeg', quality)
        resolve(compressed)
      } else {
        resolve(base64String) // Fallback to original
      }
    }
    img.onerror = () => resolve(base64String) // Fallback to original on error
    img.src = base64String
  })
}

export async function generateQuotePDF(quote: Quote): Promise<void> {
  const doc = new jsPDF('p', 'mm', 'a4')
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  let yPos = margin

  // Colors
  const primaryColor: [number, number, number] = [0, 102, 204]
  const textColor: [number, number, number] = [30, 41, 59]

  // Header
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.rect(0, 0, pageWidth, 40, 'F')
  
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(24)
  doc.setFont('helvetica', 'bold')
  doc.text('BRIGHT WORKS PROFESSIONAL', margin, 25)
  
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text('Infrastructure Budget Proposal', margin, 32)

  yPos = 50

  // Client Information
  doc.setFillColor(240, 244, 248)
  doc.rect(margin, yPos, pageWidth - 2 * margin, 35, 'F')
  
  doc.setTextColor(textColor[0], textColor[1], textColor[2])
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('Client Information', margin + 5, yPos + 10)
  
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text(`Client: ${quote.clientName}`, margin + 5, yPos + 18)
  doc.text(`Facility: ${quote.facilityType}`, margin + 5, yPos + 24)
  doc.text(`Status: ${quote.status.toUpperCase()}`, pageWidth - margin - 5, yPos + 18, { align: 'right' })
  
  if (quote.startDate || quote.endDate) {
    let dateInfo = ''
    if (quote.startDate) dateInfo += `Start: ${new Date(quote.startDate).toLocaleDateString()}`
    if (quote.startDate && quote.endDate) dateInfo += ' | '
    if (quote.endDate) dateInfo += `End: ${new Date(quote.endDate).toLocaleDateString()}`
    doc.text(dateInfo, pageWidth - margin - 5, yPos + 24, { align: 'right' })
  }

  yPos += 45

  // Service Scope
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(textColor[0], textColor[1], textColor[2])
  doc.text('Scope of Work', margin, yPos)
  yPos += 8

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const serviceLines = doc.splitTextToSize(quote.service, pageWidth - 2 * margin)
  doc.text(serviceLines, margin, yPos)
  yPos += serviceLines.length * 5 + 10

  // Budget Amount (highlighted)
  doc.setFillColor(16, 185, 129)
  doc.setDrawColor(16, 185, 129)
  doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 20, 3, 3, 'FD')
  
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('ESTIMATED INVESTMENT', margin + 5, yPos + 8)
  
  doc.setFontSize(20)
  doc.text(`$${quote.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, margin + 5, yPos + 16)

  yPos += 30

  // Technical Details
  if (quote.squareFootage || quote.humidityProfile || quote.sanitationScope) {
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(textColor[0], textColor[1], textColor[2])
    doc.text('Technical Specifications', margin, yPos)
    yPos += 8

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    if (quote.squareFootage) {
      doc.text(`Square Footage: ${quote.squareFootage} ft²`, margin, yPos)
      yPos += 6
    }
    if (quote.humidityProfile) {
      doc.text(`Humidity Profile: ${quote.humidityProfile}`, margin, yPos)
      yPos += 6
    }
    if (quote.sanitationScope) {
      doc.text(`Sanitation Scope: ${quote.sanitationScope}`, margin, yPos)
      yPos += 6
    }
    yPos += 5
  }

  // Compliance Standards
  if (quote.compliance && quote.compliance.length > 0) {
    // Check if we need a new page
    if (yPos > pageHeight - 40) {
      doc.addPage()
      yPos = margin
    }

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(textColor[0], textColor[1], textColor[2])
    doc.text('Regulatory Compliance', margin, yPos)
    yPos += 8

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    quote.compliance.forEach((standard: string) => {
      if (yPos > pageHeight - 15) {
        doc.addPage()
        yPos = margin
      }
      doc.text(`✓ ${standard}`, margin + 5, yPos)
      yPos += 6
    })
    yPos += 5
  }

  // Photos Section
  if (quote.photos && quote.photos.length > 0) {
    // Check if we need a new page
    if (yPos > pageHeight - 80) {
      doc.addPage()
      yPos = margin
    }

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(textColor[0], textColor[1], textColor[2])
    doc.text('Attached Photos', margin, yPos)
    yPos += 8

    const photosPerRow = 2
    const photoWidth = (pageWidth - 2 * margin - (photosPerRow - 1) * 5) / photosPerRow
    const photoHeight = photoWidth * 0.75 // 4:3 aspect ratio

    // Compress all photos first
    const compressedPhotos = await Promise.all(
      quote.photos.map((photo) => compressImage(photo, 800, 0.7))
    )

    compressedPhotos.forEach((photoBase64: string, index: number) => {
      // Check if we need a new page
      if (yPos + photoHeight > pageHeight - 20) {
        doc.addPage()
        yPos = margin
      }

      const col = index % photosPerRow
      const xPos = margin + col * (photoWidth + 5)

      try {
        // Add compressed image
        doc.addImage(
          photoBase64,
          'JPEG',
          xPos,
          yPos,
          photoWidth,
          photoHeight
        )

        // Add photo number
        doc.setFontSize(8)
        doc.setTextColor(100, 100, 100)
        doc.text(`Photo ${index + 1}`, xPos + 2, yPos + photoHeight - 2)

        // Move to next row if needed
        if ((index + 1) % photosPerRow === 0) {
          yPos += photoHeight + 10
        }
      } catch (error) {
        console.error('Error adding image to PDF:', error)
        doc.setFontSize(8)
        doc.setTextColor(220, 38, 38)
        doc.text(`[Error loading image ${index + 1}]`, xPos, yPos + photoHeight / 2)
        if ((index + 1) % photosPerRow === 0) {
          yPos += photoHeight + 10
        }
      }
    })

    // Move to next line if last row is incomplete
    if (quote.photos.length % photosPerRow !== 0) {
      yPos += photoHeight + 10
    }
  }

  // Notes
  if (quote.notes) {
    // Check if we need a new page
    if (yPos > pageHeight - 40) {
      doc.addPage()
      yPos = margin
    }

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(textColor[0], textColor[1], textColor[2])
    doc.text('Additional Notes', margin, yPos)
    yPos += 8

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    const notesLines = doc.splitTextToSize(quote.notes, pageWidth - 2 * margin)
    notesLines.forEach((line: string) => {
      if (yPos > pageHeight - 15) {
        doc.addPage()
        yPos = margin
      }
      doc.text(line, margin, yPos)
      yPos += 5
    })
  }

  // Footer
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(
      `Generated: ${new Date().toLocaleString()} | Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    )
  }

  // Generate filename and save
  const filename = `BrightWorks_Quote_${quote.clientName.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.pdf`
  doc.save(filename)
}


