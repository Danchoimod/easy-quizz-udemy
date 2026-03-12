const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  toggleSkip: (enabled) => ipcRenderer.send('toggle-skip', enabled),
  toggleQuiz: (enabled) => ipcRenderer.send('toggle-quiz', enabled),
  toggleAutoSolve: (enabled) => ipcRenderer.send('toggle-auto-solve', enabled),
  onSetSkipEnabled: (callback) => ipcRenderer.on('set-skip-enabled', (_event, value) => callback(value)),
  onSetQuizEnabled: (callback) => ipcRenderer.on('set-quiz-enabled', (_event, value) => callback(value)),
  onSetAutoSolveEnabled: (callback) => ipcRenderer.on('set-auto-solve-enabled', (_event, value) => callback(value)),
  openQuizResult: (url) => ipcRenderer.send('open-quiz-result', url)
})

contextBridge.exposeInMainWorld('browserAPI', {
  goBack: () => ipcRenderer.send('browser-back'),
  goForward: () => ipcRenderer.send('browser-forward'),
  reload: () => ipcRenderer.send('browser-reload'),
  loadURL: (url) => ipcRenderer.send('browser-load-url', url),
  openControl: () => ipcRenderer.send('open-control-panel'),
  onURLChanged: (callback) => ipcRenderer.on('url-changed', (_event, url) => callback(url)),
  onNavStateChanged: (callback) => ipcRenderer.on('nav-state-changed', (_event, state) => callback(state))
})

window.addEventListener('DOMContentLoaded', () => {
  const isUdemy = window.location.hostname.includes('udemy.com')

  if (isUdemy) {
    console.log('Udemy page detected, logic running...')
    let skipEnabled = false
    let quizEnabled = false
    let autoSolveEnabled = false
    let lastQuizUrl = ''
    let cachedQuizData = null         // Lưu dữ liệu API
    let lastAnsweredQuestionId = null // Tránh trả lời lại câu đã answered

    ipcRenderer.on('set-skip-enabled', (_event, enabled) => {
      skipEnabled = enabled
      console.log('Skip enabled status changed:', skipEnabled)
    })

    ipcRenderer.on('set-quiz-enabled', (_event, enabled) => {
      quizEnabled = enabled
      console.log('Quiz enabled status changed:', quizEnabled)
      if (!enabled) {
        cachedQuizData = null
        autoSolveEnabled = false
      }
    })

    ipcRenderer.on('set-auto-solve-enabled', (_event, enabled) => {
      autoSolveEnabled = enabled
      console.log('Auto solve enabled status changed:', autoSolveEnabled)
    })

    const fetchAllQuizPages = async (quizId) => {
      let questions = []
      let url = `https://fpl.udemy.com/api-2.0/quizzes/${quizId}/assessments/`
      try {
        while (url) {
          const res = await fetch(url)
          const data = await res.json()
          if (data.results) questions.push(...data.results)
          url = data.next
        }
        return { count: questions.length, results: questions }
      } catch (err) {
        console.error('Error fetching quiz pages:', err)
        return null
      }
    }

    // Tự động chọn đáp án đúng và nhấn Next
    const autoAnswerQuiz = () => {
      if (!quizEnabled || !cachedQuizData || !autoSolveEnabled) return

      // Bước 1: Nhấn nút "Bắt đầu làm trắc nghiệm" nếu chưa bắt đầu
      const startBtn = document.querySelector('button[data-purpose="start-or-resume-quiz"]')
      if (startBtn && startBtn.offsetParent !== null) {
        console.log('Clicking start quiz button...')
        startBtn.click()
        return
      }

      // Bước 2: Tìm form câu hỏi hiện tại
      const form = document.querySelector('form[data-testid="mc-quiz-question"]')
      if (!form) return

      const questionId = form.getAttribute('data-question-id')
      if (!questionId || questionId === lastAnsweredQuestionId) return

      // Bước 3: Tìm câu hỏi khớp trong API data
      const numericId = questionId.replace(/\D/g, '')
      const letters = ['a', 'b', 'c', 'd', 'e', 'f']

      let apiQuestion = cachedQuizData.results.find(q => String(q.id) === numericId)

      if (!apiQuestion) {
        // Fallback: so sánh nội dung câu hỏi
        const promptEl = form.querySelector('#question-prompt, .mc-quiz-question--question-prompt--9cMw2')
        if (!promptEl) return
        const currentText = promptEl.innerText.trim().toLowerCase()
        apiQuestion = cachedQuizData.results.find(q => {
          const apiText = q.prompt.question.replace(/<[^>]*>/g, '').trim().toLowerCase()
          return currentText.includes(apiText) || apiText.includes(currentText)
        })
      }

      if (!apiQuestion || !apiQuestion.correct_response) return

      // Bước 4: Tính index của đáp án đúng (a=0, b=1, ...)
      const correctIndices = apiQuestion.correct_response
        .map(letter => letters.indexOf(letter.toLowerCase()))
        .filter(i => i !== -1)

      if (correctIndices.length === 0) return

      // Bước 5: Click vào đáp án đúng
      let clicked = false
      correctIndices.forEach(index => {
        const input = form.querySelector(`input[data-index="${index}"]`)
        if (input) {
          const label = input.closest('label')
          if (label) label.click()
          else input.click()
          clicked = true
          console.log(`Clicked answer index ${index} for question ${questionId}`)
        }
      })

      if (clicked) {
        lastAnsweredQuestionId = questionId
        // Bước 6: Chờ 800ms rồi nhấn "Kiểm tra đáp án"
        setTimeout(() => {
          const checkBtn = document.querySelector(
            'button[data-purpose="next-question-button"], ' +
            'button[data-testid="next-question-button"]'
          )
          if (checkBtn && !checkBtn.disabled) {
            console.log('Clicking "Kiểm tra đáp án" button...')
            checkBtn.click()
            // Chờ thêm 1000ms rồi nhấn "Câu tiếp theo" nếu xuất hiện
            setTimeout(() => {
              const nextBtn = document.querySelector(
                'button[data-purpose="next-question-button"], ' +
                'button[data-testid="next-question-button"]'
              )
              if (nextBtn && !nextBtn.disabled) {
                console.log('Clicking next question button...')
                nextBtn.click()
              }
            }, 1000)
          }
        }, 800)
      }
    }

    const checkQuizUrl = () => {
      if (!quizEnabled) return;
      const currentUrl = window.location.href;
      const quizMatch = currentUrl.match(/\/course\/([^\/]+)\/learn\/quiz\/(\d+)/);
      
      if (quizMatch && currentUrl !== lastQuizUrl) {
        lastQuizUrl = currentUrl;
        const quizId = quizMatch[2];
        lastAnsweredQuestionId = null // Reset khi vào quiz mới
        
        console.log('Quiz detected, fetching API data...');

        fetchAllQuizPages(quizId).then(allData => {
          if (allData) {
            cachedQuizData = allData
            console.log('Quiz API Data cached:', allData.count, 'questions')
            ipcRenderer.send('display-quiz-data', allData);
          }
        });
      }
    };

    const skipInterval = setInterval(() => {
      checkQuizUrl();
      autoAnswerQuiz();
      if (!skipEnabled) return

      // Logic chuyển tiếp video khi có nút "Tiếp tục" hoặc nút skip xuất hiện
      const continueButton = document.querySelector('div[data-purpose="go-to-next-button"]');
      if (continueButton) {
        console.log('Nút Tiếp tục được phát hiện, đang nhấn...');
        continueButton.click();
      }

      const skipButton = document.querySelector('#playerId__38594256--37shaka-mock-vjs-control-bar-popover-area')
      
      // Dự phòng nếu ID thay đổi, tìm theo class đặc trưng của Udemy
      const fallbackButton = document.querySelector('.shaka-control-bar--popover-area--p01Ag')
      
      const target = skipButton || fallbackButton

      if (target) {
        console.log('Target element detected, performing skip...')
        const v = document.querySelector('video');
        if (v && v.duration > 0 && !v.paused) {
            // Chỉ thực hiện nhảy thời gian nếu chưa ở gần cuối video (để tránh lặp lại)
            if (v.currentTime < v.duration - 5) {
                v.playbackRate = 16.0; 
                v.currentTime = v.duration - 2;
                v.play();
            } else {
                // Nếu đã ở cuối, đảm bảo tốc độ cao để kết thúc nhanh
                v.playbackRate = 16.0;
            }
        }
      }
    }, 1000)
  }
})
