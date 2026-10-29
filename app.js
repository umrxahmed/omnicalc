/**
 * OmniCalc — Modern Precision Calculator with Smart Memory & History Tape
 */

(function () {
  'use strict';

  // --- DOM Elements ---
  const screenMain = document.getElementById('screenMain');
  const screenExpression = document.getElementById('screenExpression');
  const screenPreview = document.getElementById('screenPreview');
  const memoryPill = document.getElementById('memoryPill');
  const memoryPillValue = document.getElementById('memoryPillValue');
  const memoryPillClearBtn = document.getElementById('memoryPillClearBtn');
  const btnMC = document.getElementById('btnMC');
  const btnMR = document.getElementById('btnMR');
  const historyList = document.getElementById('historyList');
  const historyEmpty = document.getElementById('historyEmpty');
  const historyCountBadge = document.getElementById('historyCountBadge');
  const historyToggleBtn = document.getElementById('historyToggleBtn');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  const exportHistoryBtn = document.getElementById('exportHistoryBtn');
  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const soundIconOff = document.getElementById('soundIconOff');
  const soundIconOn = document.getElementById('soundIconOn');
  const btnCopyResult = document.getElementById('btnCopyResult');
  const toast = document.getElementById('toastNotification');
  const workspaceLayout = document.querySelector('.workspace-layout');

  // --- State Variables ---
  let currentInput = '0';
  let expressionTokens = []; // Tokens forming the ongoing expression
  let justEvaluated = false;
  let memoryValue = 0;
  let hasMemory = false;
  let calculationHistory = [];
  let isSoundEnabled = false;
  let audioCtx = null;
  let toastTimer = null;

  // --- Initialization ---
  function init() {
    loadSessionMemory();
    setupEventListeners();
    updateDisplay();
    updateMemoryUI();
    renderHistory();
  }

  // --- Session Storage Management ---
  function loadSessionMemory() {
    try {
      const storedHistory = sessionStorage.getItem('omniCalc_history');
      if (storedHistory) {
        const parsedHistory = JSON.parse(storedHistory);
        if (Array.isArray(parsedHistory)) {
          calculationHistory = parsedHistory;
        }
      }

      const storedMemory = sessionStorage.getItem('omniCalc_memory');
      if (storedMemory !== null) {
        const parsedMemory = JSON.parse(storedMemory);
        if (parsedMemory && typeof parsedMemory === 'object') {
          const parsedValue = parseFloat(parsedMemory.value);
          memoryValue = Number.isFinite(parsedValue) ? parsedValue : 0;
          hasMemory = parsedMemory.hasMemory === true;
        } else if (typeof parsedMemory === 'number' && Number.isFinite(parsedMemory)) {
          // Backwards compatibility with the old plain-number format
          memoryValue = parsedMemory;
          hasMemory = true;
        }
      }

      const storedSound = localStorage.getItem('omniCalc_sound');
      if (storedSound === 'true') {
        isSoundEnabled = true;
        updateSoundUI();
      }
    } catch (e) {
      console.warn('Storage access unavailable:', e);
    }
  }

  function saveSessionMemory() {
    try {
      sessionStorage.setItem('omniCalc_history', JSON.stringify(calculationHistory));
      sessionStorage.setItem(
        'omniCalc_memory',
        JSON.stringify({ value: memoryValue, hasMemory: hasMemory })
      );
    } catch (e) {
      console.warn('Unable to save session memory:', e);
    }
  }

  // --- Audio Feedback (Web Audio API) ---
  function playClickSound(freq = 600, duration = 0.025) {
    if (!isSoundEnabled) return;

    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.5, audioCtx.currentTime + duration);

      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (err) {
      console.error('Audio playback error:', err);
    }
  }

  function toggleSound() {
    isSoundEnabled = !isSoundEnabled;
    try {
      localStorage.setItem('omniCalc_sound', isSoundEnabled ? 'true' : 'false');
    } catch (e) {}
    updateSoundUI();
    showToast(isSoundEnabled ? 'Sound feedback ON' : 'Sound feedback MUTED');
    if (isSoundEnabled) playClickSound(800, 0.04);
  }

  function updateSoundUI() {
    if (isSoundEnabled) {
      soundIconOff.classList.add('hidden');
      soundIconOn.classList.remove('hidden');
      soundToggleBtn.classList.add('active-state');
    } else {
      soundIconOff.classList.remove('hidden');
      soundIconOn.classList.add('hidden');
      soundToggleBtn.classList.remove('active-state');
    }
  }

  // --- Toast Notification ---
  function showToast(msg) {
    if (toastTimer) clearTimeout(toastTimer);
    toast.textContent = msg;
    toast.classList.add('show');
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2200);
  }

  // --- Clipboard Helpers ---
  function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }

    // Fallback for non-secure contexts (e.g. opening index.html via file://)
    return new Promise((resolve, reject) => {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.top = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();

      try {
        if (document.execCommand('copy')) {
          resolve();
        } else {
          reject(new Error('Copy command failed'));
        }
      } catch (err) {
        reject(err);
      } finally {
        textarea.remove();
      }
    });
  }

  function handleCopy(text, successMessage) {
    copyToClipboard(text)
      .then(() => showToast(successMessage))
      .catch(() => showToast('Copy failed — clipboard unavailable'));
  }

  // --- Display Formatting & Dynamic Scaling ---
  function updateDisplay() {
    // Format display string with commas for integer portions
    const formatted = formatNumberForDisplay(currentInput);
    screenMain.textContent = formatted;

    // Build the expression preview line
    const expStr = buildExpressionString();
    screenExpression.textContent = expStr;

    // Dynamically adjust font size for large strings
    adjustFontSize(formatted.length);

    // Live preview computation if expression is active
    computeLivePreview();
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  function formatNumberForDisplay(str) {
    if (str === 'Error' || str === 'Cannot divide by 0') return str;
    if (!str || str === '') return '0';

    // If it contains operators, display as raw expression
    if (/[+\-*/^()]/.test(str)) return str;

    const parts = str.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }

  function buildExpressionString() {
    if (expressionTokens.length === 0) return '';
    return expressionTokens
      .map(token => {
        if (token === '*') return '✕';
        if (token === '/') return '÷';
        if (token === '-') return '−';
        return token;
      })
      .join(' ');
  }

  function adjustFontSize(length) {
    if (length > 15) {
      screenMain.style.fontSize = '1.6rem';
    } else if (length > 11) {
      screenMain.style.fontSize = '2.1rem';
    } else if (length > 8) {
      screenMain.style.fontSize = '2.5rem';
    } else {
      screenMain.style.fontSize = '2.85rem';
    }
  }

  // --- Input Handlers ---
  function inputNumber(num) {
    playClickSound(520);
    if (currentInput === 'Error' || currentInput === 'Cannot divide by 0' || justEvaluated) {
      currentInput = num;
      justEvaluated = false;
    } else if (currentInput === '0') {
      currentInput = num;
    } else {
      currentInput += num;
    }
    updateDisplay();
  }

  function inputDecimal() {
    playClickSound(600);
    if (justEvaluated || currentInput === '' || currentInput === 'Error' || currentInput === 'Cannot divide by 0') {
      currentInput = '0.';
      justEvaluated = false;
    } else if (!currentInput.includes('.')) {
      currentInput += '.';
    }
    updateDisplay();
  }

  function inputOperator(op) {
    playClickSound(680);
    if (currentInput === 'Error' || currentInput === 'Cannot divide by 0') {
      currentInput = '0';
    }

    if (justEvaluated) {
      justEvaluated = false;
    }

    // Push current number if available
    if (currentInput !== '') {
      expressionTokens.push(currentInput);
      currentInput = '';
    } else if (expressionTokens.length > 0 && isOperator(expressionTokens[expressionTokens.length - 1])) {
      // Replace last operator if user presses another operator consecutively
      expressionTokens[expressionTokens.length - 1] = op;
      updateDisplay();
      return;
    }

    expressionTokens.push(op);
    updateDisplay();
  }

  function isOperator(tok) {
    return ['+', '-', '*', '/', '^', '%'].includes(tok);
  }

  function inputBracket() {
    playClickSound(560);
    const openCount = expressionTokens.filter(t => t === '(').length;
    const closeCount = expressionTokens.filter(t => t === ')').length;

    if (currentInput !== '') {
      if (openCount > closeCount) {
        expressionTokens.push(currentInput);
        expressionTokens.push(')');
        currentInput = '';
      } else {
        expressionTokens.push(currentInput);
        expressionTokens.push('*');
        expressionTokens.push('(');
        currentInput = '';
      }
    } else {
      if (expressionTokens.length > 0 && !isOperator(expressionTokens[expressionTokens.length - 1]) && expressionTokens[expressionTokens.length - 1] !== '(') {
        expressionTokens.push('*');
      }
      expressionTokens.push('(');
    }
    updateDisplay();
  }

  function toggleSign() {
    playClickSound(480);
    if (currentInput === '0' || currentInput === '' || currentInput === 'Error') return;

    if (currentInput.startsWith('-')) {
      currentInput = currentInput.slice(1);
    } else {
      currentInput = '-' + currentInput;
    }
    justEvaluated = false;
    updateDisplay();
  }

  function backspace() {
    playClickSound(420);
    if (justEvaluated) {
      clearAll();
      return;
    }

    if (currentInput.length > 1) {
      currentInput = currentInput.slice(0, -1);
      if (currentInput === '-') currentInput = '0';
    } else if (currentInput.length === 1 && currentInput !== '0') {
      currentInput = '0';
    } else if (expressionTokens.length > 0) {
      const lastToken = expressionTokens.pop();
      if (!isOperator(lastToken) && lastToken !== '(' && lastToken !== ')') {
        currentInput = lastToken;
      }
    }
    updateDisplay();
  }

  function clearAll() {
    playClickSound(380);
    currentInput = '0';
    expressionTokens = [];
    screenPreview.textContent = '';
    justEvaluated = false;
    updateDisplay();
  }

  function applyFunction(fnName) {
    playClickSound(700);
    if (currentInput === '' || currentInput === 'Error' || currentInput === 'Cannot divide by 0') return;

    const val = parseFloat(currentInput);
    if (!Number.isFinite(val)) return;

    if (fnName === 'sqrt') {
      if (val < 0) {
        currentInput = 'Error';
        expressionTokens = [];
        screenPreview.textContent = '';
      } else {
        const res = Math.sqrt(val);
        currentInput = cleanFloat(res).toString();
        addHistoryItem(`√(${val})`, currentInput);
      }
      justEvaluated = true;
      updateDisplay();
    }
  }

  // --- Safe Mathematical Evaluator ---
  // Implements Dijkstra's Shunting-yard algorithm & Reverse Polish Notation evaluation
  function evaluateExpressionTokens(tokens) {
    if (tokens.length === 0) return 0;

    const precedence = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, '^': 3 };
    const rightAssociative = { '^': true };

    const outputQueue = [];
    const operatorStack = [];

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      if (!isNaN(parseFloat(token))) {
        outputQueue.push(parseFloat(token));
      } else if (token === '(') {
        operatorStack.push(token);
      } else if (token === ')') {
        while (operatorStack.length > 0 && operatorStack[operatorStack.length - 1] !== '(') {
          outputQueue.push(operatorStack.pop());
        }
        operatorStack.pop(); // Pop '('
      } else if (isOperator(token)) {
        while (
          operatorStack.length > 0 &&
          operatorStack[operatorStack.length - 1] !== '(' &&
          ((!rightAssociative[token] && precedence[operatorStack[operatorStack.length - 1]] >= precedence[token]) ||
           (rightAssociative[token] && precedence[operatorStack[operatorStack.length - 1]] > precedence[token]))
        ) {
          outputQueue.push(operatorStack.pop());
        }
        operatorStack.push(token);
      }
    }

    while (operatorStack.length > 0) {
      outputQueue.push(operatorStack.pop());
    }

    // Evaluate RPN
    const evalStack = [];
    for (let i = 0; i < outputQueue.length; i++) {
      const token = outputQueue[i];
      if (typeof token === 'number') {
        evalStack.push(token);
      } else {
        const b = evalStack.pop();
        const a = evalStack.pop();

        if (a === undefined || b === undefined) return 'Error';

        let res;
        switch (token) {
          case '+': res = a + b; break;
          case '-': res = a - b; break;
          case '*': res = a * b; break;
          case '/':
            if (b === 0) return 'Cannot divide by 0';
            res = a / b;
            break;
          case '%': res = a * (b / 100); break;
          case '^': res = Math.pow(a, b); break;
          default: return 'Error';
        }
        evalStack.push(res);
      }
    }

    if (evalStack.length !== 1) return 'Error';
    return cleanFloat(evalStack[0]);
  }

  function cleanFloat(num) {
    if (typeof num !== 'number' || isNaN(num)) return 'Error';
    if (!isFinite(num)) return num > 0 ? 'Infinity' : '-Infinity';
    return Number(parseFloat(num.toPrecision(12)));
  }

  // --- Live Preview Computation ---
  function computeLivePreview() {
    if (expressionTokens.length === 0) {
      screenPreview.textContent = '';
      return;
    }

    const previewTokens = [...expressionTokens];
    if (currentInput !== '' && currentInput !== 'Error') {
      previewTokens.push(currentInput);
    }

    // Strip trailing operator for live preview
    while (previewTokens.length > 0 && isOperator(previewTokens[previewTokens.length - 1])) {
      previewTokens.pop();
    }

    // Close any unclosed parentheses
    const openCount = previewTokens.filter(t => t === '(').length;
    const closeCount = previewTokens.filter(t => t === ')').length;
    for (let i = 0; i < openCount - closeCount; i++) {
      previewTokens.push(')');
    }

    if (previewTokens.length === 0) {
      screenPreview.textContent = '';
      return;
    }

    const previewRes = evaluateExpressionTokens(previewTokens);
    if (previewRes !== 'Error' && previewRes !== 'Cannot divide by 0' && previewRes !== undefined) {
      screenPreview.textContent = formatNumberForDisplay(previewRes.toString());
    } else {
      screenPreview.textContent = '';
    }
  }

  // --- Calculation Execution (= Button) ---
  function calculate() {
    playClickSound(850, 0.04);

    if (currentInput === 'Error' || currentInput === 'Cannot divide by 0') {
      clearAll();
      return;
    }

    const fullTokens = [...expressionTokens];
    if (currentInput !== '') {
      fullTokens.push(currentInput);
    }

    // If nothing to calculate, do nothing
    if (fullTokens.length === 0) return;

    // A lone number is already the answer — don't spam the tape with "5 = 5"
    if (fullTokens.length === 1 && !isOperator(fullTokens[0]) && fullTokens[0] !== '(' && fullTokens[0] !== ')') {
      justEvaluated = true;
      updateDisplay();
      return;
    }

    // Close unclosed parentheses
    const openCount = fullTokens.filter(t => t === '(').length;
    const closeCount = fullTokens.filter(t => t === ')').length;
    for (let i = 0; i < openCount - closeCount; i++) {
      fullTokens.push(')');
    }

    const readableExpression = fullTokens
      .map(t => {
        if (t === '*') return '✕';
        if (t === '/') return '÷';
        if (t === '-') return '−';
        return t;
      })
      .join(' ');

    const result = evaluateExpressionTokens(fullTokens);

    if (result === 'Cannot divide by 0' || result === 'Error') {
      currentInput = result;
      expressionTokens = [];
      screenPreview.textContent = '';
      justEvaluated = true;
      updateDisplay();
      return;
    }

    const formattedResult = result.toString();

    // Save to temporary memory calculation history
    addHistoryItem(readableExpression, formattedResult);

    // Update screen
    currentInput = formattedResult;
    expressionTokens = [];
    screenPreview.textContent = '';
    justEvaluated = true;
    updateDisplay();
  }

  // --- Temporary Memory Registers (MC, MR, M+, M-, MS) ---
  function memoryClear() {
    playClickSound(400);
    memoryValue = 0;
    hasMemory = false;
    updateMemoryUI();
    saveSessionMemory();
    showToast('Memory Cleared (MC)');
  }

  function memoryRecall() {
    playClickSound(580);
    if (!hasMemory) return;

    currentInput = cleanFloat(memoryValue).toString();
    justEvaluated = false;
    updateDisplay();
    showToast(`Recalled Memory: ${currentInput}`);
  }

  function memoryAdd() {
    playClickSound(640);
    const currentNum = getActiveNumberValue();
    memoryValue = cleanFloat(memoryValue + currentNum);
    hasMemory = true;
    updateMemoryUI();
    saveSessionMemory();
    showToast(`Added to Memory: +${currentNum}`);
  }

  function memorySubtract() {
    playClickSound(640);
    const currentNum = getActiveNumberValue();
    memoryValue = cleanFloat(memoryValue - currentNum);
    hasMemory = true;
    updateMemoryUI();
    saveSessionMemory();
    showToast(`Subtracted from Memory: -${currentNum}`);
  }

  function memoryStore() {
    playClickSound(640);
    const currentNum = getActiveNumberValue();
    memoryValue = cleanFloat(currentNum);
    hasMemory = true;
    updateMemoryUI();
    saveSessionMemory();
    showToast(`Stored in Memory: ${memoryValue}`);
  }

  function getActiveNumberValue() {
    if (currentInput !== '' && currentInput !== 'Error' && currentInput !== 'Cannot divide by 0') {
      return parseFloat(currentInput) || 0;
    }
    return 0;
  }

  function updateMemoryUI() {
    if (hasMemory) {
      btnMC.disabled = false;
      btnMR.disabled = false;
      btnMC.classList.add('has-memory');
      btnMR.classList.add('has-memory');
      memoryPill.style.display = 'inline-flex';
      memoryPillValue.textContent = memoryValue.toString();
    } else {
      btnMC.disabled = true;
      btnMR.disabled = true;
      btnMC.classList.remove('has-memory');
      btnMR.classList.remove('has-memory');
      memoryPill.style.display = 'none';
      memoryPillValue.textContent = '0';
    }
  }

  // --- Calculation History Tape (Temporary Memory Log) ---
  function addHistoryItem(expression, result) {
    const item = {
      id: Date.now(),
      expression: expression,
      result: result,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };

    // Prepend to history tape
    calculationHistory.unshift(item);

    // Limit history length to 50 entries
    if (calculationHistory.length > 50) {
      calculationHistory.pop();
    }

    saveSessionMemory();
    renderHistory();
  }

  function renderHistory() {
    historyCountBadge.textContent = calculationHistory.length;

    if (calculationHistory.length === 0) {
      historyEmpty.style.display = 'flex';
      // Remove any item nodes except empty state
      Array.from(historyList.children).forEach(child => {
        if (child !== historyEmpty) child.remove();
      });
      return;
    }

    historyEmpty.style.display = 'none';

    // Clear existing rendered items
    Array.from(historyList.children).forEach(child => {
      if (child !== historyEmpty) child.remove();
    });

    // Populate items
    calculationHistory.forEach(item => {
      const card = document.createElement('div');
      card.className = 'history-item';
      card.dataset.id = item.id;
      card.dataset.result = item.result;
      card.dataset.expression = item.expression;

      card.innerHTML = `
        <div class="history-item-top">
          <span class="history-item-time">${escapeHtml(item.time)}</span>
          <div class="history-item-actions">
            <button class="item-action-icon copy-item" title="Copy result">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
            <button class="item-action-icon delete-item" title="Delete from history">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
        <div class="history-item-exp">${escapeHtml(item.expression)} =</div>
        <div class="history-item-res">${escapeHtml(formatNumberForDisplay(item.result))}</div>
      `;

      // Click card to restore result into calculator
      card.addEventListener('click', (e) => {
        if (e.target.closest('.item-action-icon')) return; // Ignore if clicked action icon
        playClickSound(620);
        currentInput = item.result;
        expressionTokens = [];
        justEvaluated = true;
        updateDisplay();
        showToast(`Loaded ${item.result} into display`);
      });

      // Copy icon
      const copyBtn = card.querySelector('.copy-item');
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleCopy(item.result, `Copied ${item.result} to clipboard`);
      });

      // Delete icon
      const deleteBtn = card.querySelector('.delete-item');
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        calculationHistory = calculationHistory.filter(h => h.id !== item.id);
        saveSessionMemory();
        renderHistory();
        showToast('Calculation removed from tape');
      });

      historyList.appendChild(card);
    });
  }

  function clearAllHistory() {
    if (calculationHistory.length === 0) return;
    calculationHistory = [];
    saveSessionMemory();
    renderHistory();
    showToast('Calculation tape cleared');
  }

  function exportTape() {
    if (calculationHistory.length === 0) {
      showToast('No calculations on tape to export');
      return;
    }

    const textTape = calculationHistory
      .slice()
      .reverse()
      .map(item => `${item.time}  |  ${item.expression} = ${item.result}`)
      .join('\n');

    handleCopy(textTape, 'Entire tape copied to clipboard!');
  }

  // --- Copy Result to Clipboard ---
  function copyCurrentResult() {
    if (currentInput === 'Error' || currentInput === 'Cannot divide by 0') {
      showToast('Nothing to copy');
      return;
    }
    const val = currentInput !== '' ? currentInput : '0';
    handleCopy(val, `Copied ${val} to clipboard`);
  }

  // --- Keyboard Shortcuts ---
  function handleKeyDown(e) {
    const key = e.key;

    // Prevent default scrolling for Space / Page keys if focused on button
    if (['Space', 'Enter'].includes(e.code) && document.activeElement.tagName === 'BUTTON') {
      // Allow default button activation
      return;
    }

    if (/[0-9]/.test(key)) {
      e.preventDefault();
      inputNumber(key);
    } else if (key === '.') {
      e.preventDefault();
      inputDecimal();
    } else if (key === '+' || key === '-' || key === '*' || key === '/') {
      e.preventDefault();
      inputOperator(key);
    } else if (key === '^' || key === '%') {
      e.preventDefault();
      inputOperator(key);
    } else if (key === '(' || key === ')') {
      e.preventDefault();
      inputBracket();
    } else if (key === 'Enter' || key === '=') {
      e.preventDefault();
      calculate();
    } else if (key === 'Backspace') {
      e.preventDefault();
      backspace();
    } else if (key === 'Escape') {
      e.preventDefault();
      clearAll();
    } else if (key.toLowerCase() === 'm') {
      e.preventDefault();
      memoryRecall();
    } else if (key.toLowerCase() === 'h') {
      e.preventDefault();
      toggleHistoryDrawer();
    }
  }

  function toggleHistoryDrawer() {
    workspaceLayout.classList.toggle('history-collapsed');
    const isCollapsed = workspaceLayout.classList.contains('history-collapsed');
    historyToggleBtn.classList.toggle('active-state', !isCollapsed);
  }

  // --- Event Listeners Setup ---
  function setupEventListeners() {
    // Keypad actions delegation
    document.querySelector('.keypad-grid').addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;

      const action = btn.dataset.action;
      const val = btn.dataset.val;

      switch (action) {
        case 'number':
          inputNumber(val);
          break;
        case 'decimal':
          inputDecimal();
          break;
        case 'operator':
          inputOperator(val);
          break;
        case 'clear-all':
          clearAll();
          break;
        case 'backspace':
          backspace();
          break;
        case 'insert-bracket':
          inputBracket();
          break;
        case 'toggle-sign':
          toggleSign();
          break;
        case 'calculate':
          calculate();
          break;
      }
    });

    // Advanced operations bar delegation
    document.querySelector('.advanced-ops-bar').addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;

      const action = btn.dataset.action;
      const val = btn.dataset.val;

      if (action === 'operator') {
        inputOperator(val);
      } else if (action === 'function') {
        applyFunction(val);
      } else if (action === 'copy-result') {
        copyCurrentResult();
      }
    });

    // Memory actions
    btnMC.addEventListener('click', memoryClear);
    btnMR.addEventListener('click', memoryRecall);
    document.getElementById('btnMPlus').addEventListener('click', memoryAdd);
    document.getElementById('btnMMinus').addEventListener('click', memorySubtract);
    document.getElementById('btnMS').addEventListener('click', memoryStore);
    memoryPillClearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      memoryClear();
    });

    // Header controls
    historyToggleBtn.addEventListener('click', toggleHistoryDrawer);
    soundToggleBtn.addEventListener('click', toggleSound);

    // History Tape controls
    clearHistoryBtn.addEventListener('click', clearAllHistory);
    exportHistoryBtn.addEventListener('click', exportTape);

    // Physical Keyboard Listener
    window.addEventListener('keydown', handleKeyDown);
  }

  // Boot app
  document.addEventListener('DOMContentLoaded', init);
})();
