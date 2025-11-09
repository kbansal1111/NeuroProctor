/**
 * Keyboard Restriction Utility for Exam Proctoring
 * 
 * Features:
 * - Disables all keys (Caps Lock, Shift, Enter, Navigation, Alphanumeric, Symbols)
 * - Warns students on keyboard shortcuts (Ctrl/Alt/Meta combinations)
 * - Records generic key alerts (no specific key data)
 * - Tab switch detection handled separately for exam termination
 */

export const setupKeyboardRestriction = (options = {}) => {
  const {
    studentId = null,
    examId = null,
    onShortcutWarning = null,
    onKeyAlert = null,
    backendUrl = 'http://localhost:5000'
  } = options;

  // Blocked keys list
  const blockedKeys = new Set([
    // Modifier keys
    'CapsLock', 'Shift', 'ShiftLeft', 'ShiftRight',
    'Control', 'ControlLeft', 'ControlRight',
    'Alt', 'AltLeft', 'AltRight',
    'Meta', 'MetaLeft', 'MetaRight',
    
    // Control keys
    'Enter', 'Tab', 'Escape', 'Backspace', 'Delete',
    'Insert', 'Space',
    
    // Navigation keys
    'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
    'Home', 'End', 'PageUp', 'PageDown',
    
    // Function keys
    'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
    
    // Additional keys
    'ContextMenu', 'PrintScreen', 'ScrollLock', 'Pause'
  ]);

  // Record generic alert to backend
  const recordAlert = async (alertType, details = {}) => {
    if (!studentId || !examId) return;

    try {
      await fetch(`${backendUrl}/api/exam/alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          student_id: studentId,
          exam_id: examId,
          alert_type: alertType,
          timestamp: new Date().toISOString(),
          ...details
        }),
        keepalive: true
      });
    } catch (error) {
      console.error('Failed to record alert:', error);
    }
  };

  // Main keyboard event handler
  const handleKeyDown = (e) => {
    // Check for keyboard shortcuts (Ctrl/Alt/Meta combinations)
    if (e.ctrlKey || e.altKey || e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
      
      // Warn the student
      if (onShortcutWarning) {
        onShortcutWarning('⚠️ Keyboard shortcuts are disabled during the exam!');
      }
      
      // Record generic shortcut alert
      recordAlert('keyboard_shortcut', { message: 'Shortcut attempt detected' });
      
      if (onKeyAlert) {
        onKeyAlert('shortcut');
      }
      
      return false;
    }

    // Block specific keys
    if (blockedKeys.has(e.key) || blockedKeys.has(e.code)) {
      e.preventDefault();
      e.stopPropagation();
      
      // Record generic key press alert
      recordAlert('key_press', { message: 'Blocked key press attempt' });
      
      if (onKeyAlert) {
        onKeyAlert('key_press');
      }
      
      return false;
    }

    // Block alphanumeric, symbols, and numeric keys
    // Check if it's a printable character (length === 1)
    if (e.key && e.key.length === 1) {
      e.preventDefault();
      e.stopPropagation();
      
      // Record generic character input alert
      recordAlert('character_input', { message: 'Character input attempt detected' });
      
      if (onKeyAlert) {
        onKeyAlert('character_input');
      }
      
      return false;
    }

    return true;
  };

  const handleKeyUp = (e) => {
    // Also block on keyup to prevent any bypass attempts
    if (e.ctrlKey || e.altKey || e.metaKey || blockedKeys.has(e.key) || blockedKeys.has(e.code)) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
    
    if (e.key && e.key.length === 1) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
    
    return true;
  };

  const handleKeyPress = (e) => {
    // Block on keypress as well for maximum coverage
    e.preventDefault();
    e.stopPropagation();
    return false;
  };

  // Prevent copy/paste/cut
  const handleClipboard = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (onShortcutWarning) {
      onShortcutWarning('⚠️ Copy/Paste/Cut operations are not allowed during the exam!');
    }
    
    recordAlert('clipboard_attempt', { 
      message: `${e.type} operation blocked`,
      operation: e.type 
    });
    
    return false;
  };

  // Prevent context menu (right-click)
  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (onShortcutWarning) {
      onShortcutWarning('⚠️ Right-click is disabled during the exam!');
    }
    
    recordAlert('context_menu_attempt', { message: 'Right-click attempt detected' });
    
    return false;
  };

  // Prevent drag and drop
  const handleDragStart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    return false;
  };

  // Attach event listeners
  const attachListeners = () => {
    // Use capture phase (true) to intercept events before they bubble
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('keyup', handleKeyUp, true);
    document.addEventListener('keypress', handleKeyPress, true);
    document.addEventListener('copy', handleClipboard, true);
    document.addEventListener('paste', handleClipboard, true);
    document.addEventListener('cut', handleClipboard, true);
    document.addEventListener('contextmenu', handleContextMenu, true);
    document.addEventListener('dragstart', handleDragStart, true);
  };

  // Detach event listeners
  const detachListeners = () => {
    document.removeEventListener('keydown', handleKeyDown, true);
    document.removeEventListener('keyup', handleKeyUp, true);
    document.removeEventListener('keypress', handleKeyPress, true);
    document.removeEventListener('copy', handleClipboard, true);
    document.removeEventListener('paste', handleClipboard, true);
    document.removeEventListener('cut', handleClipboard, true);
    document.removeEventListener('contextmenu', handleContextMenu, true);
    document.removeEventListener('dragstart', handleDragStart, true);
  };

  return {
    attach: attachListeners,
    detach: detachListeners,
    recordAlert
  };
};

/**
 * Tab Switch Detection and Termination
 * This is separate from keyboard restriction
 */
export const setupTabSwitchDetection = (options = {}) => {
  const {
    studentId = null,
    examId = null,
    onTabSwitch = null,
    backendUrl = 'http://localhost:5000',
    autoTerminate = true
  } = options;

  const handleVisibilityChange = async () => {
    if (document.hidden) {
      // Tab switched or window minimized
      console.warn('⚠️ Tab switch detected!');
      
      // Record termination event
      try {
        await fetch(`${backendUrl}/api/exam/terminate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            student_id: studentId,
            exam_id: examId,
            reason: 'tab_switch',
            timestamp: new Date().toISOString()
          }),
          keepalive: true
        });
      } catch (error) {
        console.error('Failed to record termination:', error);
      }

      // Call termination callback
      if (onTabSwitch && autoTerminate) {
        onTabSwitch();
      }
    }
  };

  const handleBlur = () => {
    // Window lost focus
    if (document.hidden && onTabSwitch && autoTerminate) {
      handleVisibilityChange();
    }
  };

  const attachListeners = () => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
  };

  const detachListeners = () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('blur', handleBlur);
  };

  return {
    attach: attachListeners,
    detach: detachListeners
  };
};
