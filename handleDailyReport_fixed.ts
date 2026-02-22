  const handleDailyReport = async () => {
    try {
      toast.loading('Generating daily report PDF...', { id: 'daily-loading' })
      
      // Build local HTML report
      const localHtml = buildDailyReportHtml()
      
      // Create temporary div for HTML to canvas conversion
      const tempDiv = document.createElement('div')
      tempDiv.style.position = 'absolute'
      tempDiv.style.left = '-9999px'
      tempDiv.style.width = '1200px'
      tempDiv.style.backgroundColor = '#0f172a'
      tempDiv.innerHTML = localHtml
      document.body.appendChild(tempDiv)

      try {
        // Wait for images and fonts to load
        await new Promise((resolve) => setTimeout(resolve, 1000))

        // Convert HTML to canvas
        const wrapper = tempDiv.querySelector('.wrapper') || tempDiv
        const canvas = await html2canvas(wrapper as HTMLElement, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#0f172a',
          width: 1200,
          windowWidth: 1200,
          allowTaint: true,
        })

        // Clean up temporary div
        if (document.body.contains(tempDiv)) {
          document.body.removeChild(tempDiv)
        }

        // Create PDF
        const pdf = new jsPDF('p', 'mm', 'a4')
        const imgData = canvas.toDataURL('image/png', 0.95)
        const imgWidth = 210 // A4 width in mm
        const pageHeight = 297 // A4 height in mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width
        let heightLeft = imgHeight
        let position = 0

        // Add first page
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight

        // Add additional pages if needed
        while (heightLeft > 0) {
          position = heightLeft - imgHeight
          pdf.addPage()
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
          heightLeft -= pageHeight
        }

        // Generate filename
        const today = new Date()
        const dateStr = today.toISOString().split('T')[0]
        const roomStr = activeRoomLabel ? activeRoomLabel.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'general'
        const filename = `brightworks_daily_report_${roomStr}_week${week}_${dateStr}.pdf`

        // Save PDF
        pdf.save(filename)
        toast.success('Daily report PDF generated!', { icon: '📊', id: 'daily-loading', duration: 2000 })
        
        // Also open HTML preview
        setTimeout(() => {
          openReportWindow(localHtml, false)
        }, 500)
      } catch (pdfError) {
        console.error('PDF generation error:', pdfError)
        // Clean up temporary div
        if (document.body.contains(tempDiv)) {
          document.body.removeChild(tempDiv)
        }
        // Fallback to HTML if PDF fails
        const opened = openReportWindow(localHtml, false)
        if (opened) {
          toast.success('Daily report ready (HTML fallback)!', { icon: '📊', id: 'daily-loading', duration: 2000 })
        } else {
          toast.error('Please allow pop-ups to view the report.', { id: 'daily-loading' })
        }
      }
    } catch (error) {
      console.error('Daily report error:', error)
      toast.error('Failed to generate report', { id: 'daily-loading', icon: '❌' })
    }
  }
