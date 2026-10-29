# OmniCalc

A modern, dependency-free calculator web app with a temporary memory register, a live calculation history tape, and full keyboard support.

![HTML](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)
![License](https://img.shields.io/badge/license-ISC-blue)

## Features

- **Arithmetic & beyond** — `+`, `−`, `×`, `÷`, exponentiation (`xʸ`), percentages, square root, and parentheses.
- **Live preview** — see the running result below the expression as you type.
- **Memory register** — MC, MR, M+, M−, and MS, with a status pill on the display.
- **Calculation tape** — every calculation is logged (up to 50 entries). Click an entry to restore its result, copy it, or delete it.
- **Session persistence** — the tape and memory survive page reloads within the same tab (`sessionStorage`). Sound preference is remembered across sessions (`localStorage`).
- **Keyboard-first** — full physical keyboard support (see below).
- **Optional click sounds** — synthesized with the Web Audio API; no audio files required.
- **Responsive glassmorphism UI** — adapts to desktop, tablet, and mobile.

## Getting started

The app itself has **zero dependencies**. A Node.js static server is included for convenience.

```bash
# Requires Node.js 18+
npm start
```

Then open <http://localhost:3000>.

You can also open `index.html` directly in a browser. For the best experience (clipboard API, session storage), serve it over HTTP as shown above.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `0`–`9` | Enter digits |
| `.` | Decimal point |
| `+` `-` `*` `/` `^` `%` | Operators |
| `(` `)` | Open / close parenthesis (the on-screen `( )` button closes when a group is open) |
| `Enter` or `=` | Calculate |
| `Backspace` | Delete last character |
| `Escape` | Clear all (AC) |
| `M` | Recall memory |
| `H` | Toggle the history tape |

## Project structure

```
.
├── index.html      # Markup: display, keypad, memory row, history tape
├── style.css       # Glassmorphism theme, animations, responsive layout
├── app.js          # Calculator state, shunting-yard evaluator, memory, history
├── server.js       # Minimal static file server (Node, no dependencies)
├── package.json
└── README.md
```

## How it works

- **No `eval()`** — expressions are converted from infix to Reverse Polish Notation using Dijkstra's shunting-yard algorithm, then evaluated on a stack. See `evaluateExpressionTokens()` in `app.js`.
- **State model** — the current entry (`currentInput`) is kept separate from the committed expression (`expressionTokens`), which makes backspacing and operator replacement predictable.
- **Storage keys** — `omniCalc_history` and `omniCalc_memory` in `sessionStorage`; `omniCalc_sound` in `localStorage`.
- **Server** — `server.js` serves the static files, normalizes URL paths, and blocks path traversal outside the project directory.

## License

ISC — see [LICENSE](LICENSE).
