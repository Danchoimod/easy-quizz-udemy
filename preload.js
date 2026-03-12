const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  toggleSkip: (enabled) => ipcRenderer.send('toggle-skip', enabled),
  toggleQuiz: (enabled) => ipcRenderer.send('toggle-quiz', enabled),
  onSetSkipEnabled: (callback) => ipcRenderer.on('set-skip-enabled', (_event, value) => callback(value)),
  onSetQuizEnabled: (callback) => ipcRenderer.on('set-quiz-enabled', (_event, value) => callback(value)),
  openQuizResult: (url) => ipcRenderer.send('open-quiz-result', url)
})

contextBridge.exposeInMainWorld('browserAPI', {
  goBack: () => ipcRenderer.send('browser-back'),
  goForward: () => ipcRenderer.send('browser-forward'),
  reload: () => ipcRenderer.send('browser-reload'),
  loadURL: (url) => ipcRenderer.send('browser-load-url', url),
  onURLChanged: (callback) => ipcRenderer.on('url-changed', (_event, url) => callback(url)),
  onNavStateChanged: (callback) => ipcRenderer.on('nav-state-changed', (_event, state) => callback(state))
})

window.addEventListener('DOMContentLoaded', () => {
  const isUdemy = window.location.hostname.includes('udemy.com')

  if (isUdemy) {
    console.log('Udemy page detected, logic running...')
    let skipEnabled = false
    let quizEnabled = false
    let lastQuizUrl = ''

    ipcRenderer.on('set-skip-enabled', (_event, enabled) => {
      skipEnabled = enabled
      console.log('Skip enabled status changed:', skipEnabled)
    })

    ipcRenderer.on('set-quiz-enabled', (_event, enabled) => {
      quizEnabled = enabled
      console.log('Quiz enabled status changed:', quizEnabled)
    })

    const checkQuizUrl = () => {
      if (!quizEnabled) return;
      const currentUrl = window.location.href;
      // https://fpl.udemy.com/course/intro-to-entrepreneurship-get-started-as-an-entrepreneur/learn/quiz/201016#overview
      const quizMatch = currentUrl.match(/\/course\/([^\/]+)\/learn\/quiz\/(\d+)/);
      
      if (quizMatch && currentUrl !== lastQuizUrl) {
        lastQuizUrl = currentUrl;
        const courseName = quizMatch[1];
        const quizId = quizMatch[2];
        
        console.log('Quiz detected, fetching API data...');
        // ipcRenderer.send('open-quiz-result', resultUrl); // Đã xóa cửa sổ này

        // Fetch API
        const fetchAllQuizPages = async (quizId) => {
          let questions = [];
          let currentUrl = `https://fpl.udemy.com/api-2.0/quizzes/${quizId}/assessments/`;
          
          try {
            while (currentUrl) {
              const res = await fetch(currentUrl);
              const data = await res.json();
              if (data.results) questions.push(...data.results);
              currentUrl = data.next; // Udemy API uses pagination
            }
            return { count: questions.length, results: questions };
          } catch (err) {
            console.error('Error fetching quiz pages:', err);
            return null;
          }
        };

        fetchAllQuizPages(quizId).then(allData => {
          if (allData) {
            console.log('Quiz API Data (All Pages):', allData);
            ipcRenderer.send('display-quiz-data', allData);
          }
        });
      }
    };

    const skipInterval = setInterval(() => {
      checkQuizUrl();
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
