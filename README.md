# EasyQuizz Udemy

An Electron-based desktop application that automates Udemy course navigation — automatically skipping videos and answering quizzes.

---

## Features

- **Built-in Browser** — Opens Udemy (`fpl.udemy.com`) inside a custom browser window with back, forward, reload, and address bar controls.
- **Auto-Skip Video** — Detects when a video is playing and fast-forwards it to the end, then clicks the "Continue" button automatically.
- **Auto-Show Quiz Answer** — When a Udemy quiz page is detected, the app fetches all questions and correct answers via the Udemy API, displays them in a dedicated window, and automatically selects the correct answer(s) before clicking "Next".

---

## Tech Stack

| Technology | Purpose |
|---|---|
| [Electron](https://www.electronjs.org/) | Desktop app framework |
| [Tailwind CSS](https://tailwindcss.com/) | UI styling |
| Node.js | Runtime |

---

## Requirements

- [Node.js](https://nodejs.org/) (v18 or later recommended)
- npm

---

## Installation

```bash
# Clone the repository
git clone https://github.com/Danchoimod/easy-quizz-udemy.git
cd easy-quizz-udemy

# Install dependencies
npm install
```

---

## Usage

### Run in development mode

```bash
npm start
```

This launches the Electron app, which opens a browser window pointed at `https://fpl.udemy.com`.

### Build for Windows

```bash
npm run build:win
```

Produces an NSIS installer in the `dist/` folder.

### Build for macOS

```bash
npm run build:mac
```

Produces a `.dmg` file in the `dist/` folder.

---

## How It Works

```
┌──────────────────────────────────────────────────────┐
│                  EasyQuizz Udemy Window               │
│  ┌────────────────────────────────────────────────┐  │
│  │  ← → ↺  [ https://fpl.udemy.com ]  ⚙️         │  │  ← browser-ui.html (navView)
│  └────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────┐  │
│  │                                                │  │
│  │              Udemy Content                     │  │  ← contentView (loads Udemy)
│  │                                                │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

1. **`main.js`** creates a `BaseWindow` with two `WebContentsView` layers:
   - `navView` renders `browser-ui.html` (navigation bar).
   - `contentView` loads `https://fpl.udemy.com` and injects the `preload.js` script.

2. **`preload.js`** runs on the Udemy page and every second checks:
   - If *Auto-Skip* is on and a skip-able element is found, sets `video.playbackRate = 16` and jumps the video to near the end.
   - If *Auto-Quiz* is on and a quiz URL is detected, fetches all quiz questions from the Udemy API, caches them, sends them to `main.js` to display in a results window, and auto-clicks the correct answers.

3. **Control Panel** (`index.html`) is opened via the ⚙️ button in the nav bar. It provides toggle switches to enable/disable Auto-Skip and Auto-Quiz at runtime.

---

## Project Structure

```
easy-quizz-udemy/
├── main.js              # Electron main process — window management & IPC
├── preload.js           # Preload script — injected into Udemy pages
├── index.html           # Control panel UI
├── browser-ui.html      # Navigation bar UI
├── src/
│   └── input.css        # Tailwind CSS entry point
├── tailwind.config.js   # Tailwind configuration
├── postcss.config.js    # PostCSS configuration
└── package.json
```

---

## IPC Events

| Channel | Direction | Description |
|---|---|---|
| `toggle-skip` | Renderer → Main | Enable/disable Auto-Skip |
| `toggle-quiz` | Renderer → Main | Enable/disable Auto-Quiz |
| `set-skip-enabled` | Main → Renderer | Propagate skip state to content view |
| `set-quiz-enabled` | Main → Renderer | Propagate quiz state to content view |
| `display-quiz-data` | Renderer → Main | Send fetched quiz data to display window |
| `open-control-panel` | Renderer → Main | Open/focus the control panel window |
| `browser-back` | Renderer → Main | Navigate content view back |
| `browser-forward` | Renderer → Main | Navigate content view forward |
| `browser-reload` | Renderer → Main | Reload content view |
| `browser-load-url` | Renderer → Main | Load a URL in the content view |
| `url-changed` | Main → Renderer | Sync URL bar with current page |
| `nav-state-changed` | Main → Renderer | Update back/forward button states |

---

## License

ISC
