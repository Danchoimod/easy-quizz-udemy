const { app, BrowserWindow, ipcMain, BaseWindow, WebContentsView } = require('electron')
const path = require('path')

let win
let udemyWin
let navView
let contentView

function createWindow () {
  /*
  win = new BrowserWindow({
    width: 400,
    height: 300,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.loadFile('index.html')
  */

  udemyWin = new BaseWindow({
    width: 1200,
    height: 800,
  })

  // View cho thanh địa chỉ (Navbar)
  navView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  })
  udemyWin.contentView.addChildView(navView)
  navView.webContents.loadFile('browser-ui.html')

  // View cho nội dung Udemy
  contentView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  udemyWin.contentView.addChildView(contentView)
  contentView.webContents.loadURL('https://fpl.udemy.com')

  const updateLayout = () => {
    const { width, height } = udemyWin.getContentBounds()
    const navHeight = 56
    navView.setBounds({ x: 0, y: 0, width, height: navHeight })
    contentView.setBounds({ x: 0, y: navHeight, width, height: height - navHeight })
  }

  udemyWin.on('resize', updateLayout)
  updateLayout()

  // Đồng bộ URL và trạng thái điều hướng
  contentView.webContents.on('did-navigate', (event, url) => {
    navView.webContents.send('url-changed', url)
    navView.webContents.send('nav-state-changed', {
      canGoBack: contentView.webContents.canGoBack(),
      canGoForward: contentView.webContents.canGoForward()
    })
  })

  contentView.webContents.on('did-navigate-in-page', (event, url) => {
    navView.webContents.send('url-changed', url)
  })
}

// IPC cho điều hướng trình duyệt
ipcMain.on('browser-back', () => contentView.webContents.goBack())
ipcMain.on('browser-forward', () => contentView.webContents.goForward())
ipcMain.on('browser-reload', () => contentView.webContents.reload())
ipcMain.on('browser-load-url', (event, url) => contentView.webContents.loadURL(url))

ipcMain.on('open-control-panel', () => {
  if (win && !win.isDestroyed()) {
    win.show()
    win.focus()
  } else {
    win = new BrowserWindow({
      width: 400,
      height: 300,
      title: 'EasyQuizz Udemy Control',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    })
    win.loadFile('index.html')
    
    // Đảm bảo khi đóng cửa sổ win sẽ được giải phóng
    win.on('closed', () => {
      win = null
    })
  }
})

ipcMain.on('toggle-skip', (event, enabled) => {
  if (contentView) {
    contentView.webContents.send('set-skip-enabled', enabled)
  }
})

ipcMain.on('toggle-quiz', (event, enabled) => {
  if (contentView) {
    contentView.webContents.send('set-quiz-enabled', enabled)
  }
})

ipcMain.on('open-quiz-result', (event, url) => {
  // Cửa sổ này đã bị xóa theo yêu cầu
})

ipcMain.on('display-quiz-data', (event, data) => {
  let displayWin = new BrowserWindow({
    width: 900,
    height: 750,
    title: 'Udemy Easy Quizz - Answers',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  // Format data similar to the old project's logic
  let questionsHtml = ''
  if (data && data.results && Array.isArray(data.results)) {
    data.results.forEach((item, idx) => {
      const questionText = item.prompt?.question?.replace(/<[^>]*>/g, '') || 'No question text'
      let answersHtml = ''
      
      if (item.prompt?.answers && item.correct_response) {
        const letters = ['a', 'b', 'c', 'd', 'e', 'f']
        item.correct_response.forEach((correctLetter) => {
          const ansIdx = letters.indexOf(correctLetter.toLowerCase())
          if (ansIdx !== -1 && item.prompt.answers[ansIdx]) {
            const answerText = item.prompt.answers[ansIdx].replace(/<[^>]*>/g, '')
            answersHtml += `<div class="mt-1 p-2 bg-green-100 border-l-4 border-green-500 text-green-800 font-medium rounded-r">${answerText}</div>`
          }
        })
      }
      
      questionsHtml += `
        <div class="mb-6 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
          <div class="font-bold text-gray-800 mb-2">Question ${idx + 1}:</div>
          <div class="text-gray-700 mb-3">${questionText}</div>
          <div class="space-y-1">
            <div class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Correct Answer(s):</div>
            ${answersHtml || '<div class="text-gray-400 italic">No answer data available</div>'}
          </div>
        </div>
      `
    })
  } else {
    questionsHtml = '<div class="text-center p-10 text-gray-500 italic">No quiz data found.</div>'
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Quiz Answers</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Inter', sans-serif; }
          ::-webkit-scrollbar { width: 8px; }
          ::-webkit-scrollbar-track { background: #f1f1f1; }
          ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
          ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        </style>
      </head>
      <body class="bg-slate-50 min-h-screen">
        <div class="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10 shadow-sm flex justify-between items-center">
          <h1 class="text-xl font-bold text-slate-800 flex items-center">
            <span class="mr-2 text-blue-600">✨</span> Udemy Easy Quizz Answers
          </h1>
          <div class="text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full text-center">
            Total: ${data.count || 0} Questions
          </div>
        </div>
        <div class="max-w-4xl mx-auto p-6">
          ${questionsHtml}
        </div>
        <footer class="py-10 text-center text-gray-400 text-sm">
          Udemy Easy Quizz Automation
        </footer>
      </body>
    </html>
  `
  displayWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
})

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
