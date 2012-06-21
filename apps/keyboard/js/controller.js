/*
  Controller is in charge of receive interaction events and transform them
  into KeyEvent as well as control interface's update.
*/

'use strict';

// The controller is in charge of capture events and translate them into
// keyboard interactions, send keys and coordinate rendering.
const IMEController = (function() {

  // Special key codes
  var BASIC_LAYOUT = -1,
      ALTERNATE_LAYOUT = -2,
      SWITCH_KEYBOARD = -3,
      TOGGLE_CANDIDATE_PANEL = -4;

  var _specialCodes = [
    KeyEvent.DOM_VK_BACK_SPACE,
    KeyEvent.DOM_VK_CAPS_LOCK,
    KeyEvent.DOM_VK_RETURN,
    KeyEvent.DOM_VK_ALT,
    KeyEvent.DOM_VK_SPACE
  ];

  // Layout modes
  var LAYOUT_MODE_DEFAULT = 'Default',
      LAYOUT_MODE_SYMBOLS_I = 'Symbols_1',
      LAYOUT_MODE_SYMBOLS_II = 'Symbols_2';

  // Current state of the keyboard
  var _isPressing = null,
      _isWaitingForSecondTap = false,
      _isShowingAlternativesMenu = false,
      _isContinousSpacePressed = false,
      _isWaitingForSpaceSecondTap = false,
      _isUpperCase = false,
      _baseLayoutName = '',
      _currentTrack = null,
      _currentKeyId = '',
      _currentLayout = null,
      _currentLayoutMode = LAYOUT_MODE_DEFAULT,
      _currentKey = null,
      _currentInputType = 'text',
      _menuLockedArea = null,
      _lastHeight = 0;

  var _IMEngines = {};
  var _currentEngine = function() {
      return _IMEngines[Keyboards[_baseLayoutName].imEngine];
  };

  // Taps the space key twice within kSpaceDoubleTapTimeoout
  // to produce a "." followed by a space
  var _kSpaceDoubleTapTimeout = 700;

  // Show accent char menu (if there is one) after kAccentCharMenuTimeout
  var _kAccentCharMenuTimeout = 700;

  // If user leave the original key and did not move to
  // a key within the accent character menu,
  // after khideAlternativesCharMenuTimeout the menu will be removed.
  var _kHideAlternativesCharMenuTimeout = 500;

  // timeout and interval for delete, they could be cancelled on mouse over
  var _deleteTimeout = 0,
      _deleteInterval = 0,
      _menuTimeout = 0,
      _hideMenuTimeout = 0;

  // Backspace repeat delay and repeat rate
  var _kRepeatRate = 100,
      _kRepeatTimeout = 700;

  // Taps the shift key twice within kCapsLockTimeout
  // to lock the keyboard at upper case state.
  var _kCapsLockTimeout = 450,
      _isUpperCaseLocked = false;

  // Return true if several languages are enabled
  function _severalLanguages() {
    return IMEManager.keyboards.length > 1;
  };

  // Map the input type to another type
  function _mapType(type) {
    switch (type) {
      // basic types
      case 'url':
      case 'tel':
      case 'email':
      case 'text':
        return type;
      break;

      // default fallback and textual types
      case 'password':
      case 'search':
      default:
        return 'text';
      break;

      case 'number':
      case 'range': // XXX: should be different from number
        return 'number';
      break;
    }
  }

  // Add some special keys depending on the input's type
  function _addTypeSensitiveKeys(inputType, row, space, where, overwrites) {
    overwrites = overwrites || {};

    switch (inputType) {
      // adds . / and .com
      case 'url':
        space.ratio -= 5;
        row.splice(where, 1, // delete space
          { value: '.', ratio: 1, keyCode: 46 },
          { value: '/', ratio: 2, keyCode: 47 },
          { value: '.com', ratio: 2, compositeKey: '.com' }
        );
      break;

      // adds @ and .
      case 'email':
        space.ratio -= 2;
        row.splice(where, 0, { value: '@', ratio: 1, keyCode: 64 });
        row.splice(where + 2, 0, { value: '.', ratio: 1, keyCode: 46 });
      break;

      // adds . and , to both sides of the space bar
      case 'text':

        var next = where + 1;
        if (overwrites['.'] !== false) {
          space.ratio -= 1;
          next = where + 2;
        }
        if (overwrites[','] !== false)
          space.ratio -= 1;

        if (overwrites[',']) {
          row.splice(where, 0, {
            value: overwrites[','],
            ratio: 1,
            keyCode: overwrites[','].charCodeAt(0)
          });
        } else if (overwrites[','] !== false) {
          row.splice(where, 0, {
            value: ',',
            ratio: 1,
            keyCode: 44
          });
        }

        if (overwrites['.']) {
          row.splice(next, 0, {
            value: overwrites['.'],
            ratio: 1,
            keyCode: overwrites['.'].charCodeAt(0)
          });
        } else if (overwrites['.'] !== false) {
          row.splice(next, 0, {
            value: '.',
            ratio: 1,
            keyCode: 46
          });
        }

      break;
    }
  };

  // Build the "input sensitive" row and add it to the layout
  function _buildLayout(layoutName, inputType, layoutMode) {

    // One level copy
    function copy(obj) {
      var newObj = {};
      for (var prop in obj) if (obj.hasOwnProperty(prop)) {
        newObj[prop] = obj[prop];
      }
      return newObj;
    }

    if (inputType === 'number' || inputType === 'tel')
      layoutName = inputType + 'Layout';

    // let look for a layout overriding or fallback to defaults
    var layout = Keyboards[_baseLayoutName][layoutName] ||
                 Keyboards[layoutName];

    // look for keyspace (it behaves as the placeholder for special keys)
    var where = false;
    for (var r = 0, row; !where && (row = layout.keys[r]); r += 1)
      for (var c = 0, space; space = layout.keys[r][c]; c += 1) {
        if (space.keyCode == KeyboardEvent.DOM_VK_SPACE) {
          where = r;
          break;
        }
      }

    // if found, add special keys
    if (where) {

      // we will perform some alchemy here, so preserve...
      layout = copy(layout); // the original space row
      layout.keys = layout.keys.slice(0);
      row = layout.keys[where] = layout.keys[where].slice(0);
      space = copy(space);   // and the original space key
      row[c] = space;

      // switch languages button
      if (IMEManager.keyboards.length > 1 && !layout['hidesSwitchKey']) {
        space.ratio -= 1;
        row.splice(c, 0, {
          value: '&#x1f310;',
          ratio: 1,
          keyCode: SWITCH_KEYBOARD
        });
        c += 1;
      }

      // Alternate layout key
      // This gives the author the ability to change the alternate layout
      // key contents
      var alternateLayoutKey = '?123';
      if (layout['alternateLayoutKey']) {
        alternateLayoutKey = layout['alternateLayoutKey'];
      }

      // This gives the author the ability to change the basic layout
      // key contents
      var basicLayoutKey = 'ABC';
      if (layout['basicLayoutKey']) {
        basicLayoutKey = layout['basicLayoutKey'];
      }

      if (!layout['disableAlternateLayout']) {
        space.ratio -= 2;
        if (_currentLayoutMode === LAYOUT_MODE_DEFAULT) {
          row.splice(c, 0, {
            keyCode: ALTERNATE_LAYOUT,
            value: alternateLayoutKey,
            ratio: 2
          });

        } else {
          row.splice(c, 0, {
            keyCode: BASIC_LAYOUT,
            value: basicLayoutKey,
            ratio: 2
          });
        }
        c += 1;
      }

      // Text types specific keys
      var spliceArgs;
      if (!layout['typeInsensitive']) {
        _addTypeSensitiveKeys(
          inputType,
          row,
          space,
          c,
          layout.textLayoutOverwrite
        );
      }

    } else {
      console.warn('No space key found. No special keys will be added.');
    }

    return layout;
  }

  // Manage how to draw a keyboard. In short:
  //  1- Take in count the current layout (current language / current keyboard),
  //     the input type, the layout mode and if uppercase
  //  2- Compute the input type sensitive row.
  //  3- Setup rendering flags
  //  4- Draw the keyboard via IMERender
  //  5- If needed, empty the candidate panel
  function _draw(layoutName, inputType, layoutMode, uppercase) {

    // When user scrolls over candidate panels on IME
    function _onScroll(evt) {
      if (!_isPressing || !_currentKey)
        return;

      _onMouseLeave(evt);
      _isPressing = false; // cancel the following mouseover event
    }

    layoutName = layoutName || _baseLayoutName;
    inputType = inputType || _currentInputType;
    layoutMode = layoutMode || _currentLayout;
    uppercase = uppercase || false;

    // 2- Compute the input type sensitive row
    _currentLayout = _buildLayout(layoutName, inputType, layoutMode);

    // 4- Draw the keyboard via IMERender
    IMERender.draw(
      _currentLayout,
      _onScroll,
      {uppercase: uppercase} // 3- Setup rendering flags
    );

    // 5- If needed, empty the candidate panel
    if (_currentLayout.needsCandidatePanel)
      _currentEngine().empty();
  }


  // Cycle layout modes
  function _handleSymbolLayoutRequest(keycode) {
    var base;

    // request for SYMBOLS (page 1)
    if (keycode === ALTERNATE_LAYOUT) {
      _currentLayoutMode = LAYOUT_MODE_SYMBOLS_I;
      base = 'alternateLayout';

    // altern between pages 1 and 2 of SYMBOLS
    } else if (keycode === KeyEvent.DOM_VK_ALT) {

      if (_currentLayoutMode === LAYOUT_MODE_SYMBOLS_I) {
        _currentLayoutMode = LAYOUT_MODE_SYMBOLS_II;
        base = 'symbolLayout';

      } else {
        _currentLayoutMode = LAYOUT_MODE_SYMBOLS_I;
        base = 'alternateLayout';
      }

    // request for ABC
    } else {
      _currentLayoutMode = LAYOUT_MODE_DEFAULT;
      base = _baseLayoutName;
    }

    _draw(base, _currentInputType, _currentLayoutMode);
  }

  // Inform about a change in the displayed application via mutation observer
  // http://hacks.mozilla.org/2012/05/dom-mutationobserver-reacting-to-dom-changes-without-killing-browser-performance/
  function _updateTargetWindowHeight() {
    var height;
    if (IMERender.ime.dataset.hidden) {
      height = 0;
    } else {
      height = IMERender.ime.scrollHeight;
    }

    var message = {
      action: 'updateHeight',
      keyboardHeight: height,
      hidden: !!IMERender.ime.dataset.hidden
    };

    parent.postMessage(JSON.stringify(message), '*');
  }

  var _dimensionsObserver = new MutationObserver(_updateTargetWindowHeight);
  var _dimensionsObserverConfig = {
    childList: true, // to detect changes in IMEngine
    attributes: true, attributeFilter: ['class', 'style', 'data-hidden']
  };

  // Sends a delete code to remove last character
  function _sendDelete(feedback) {
    if (feedback)
      IMEFeedback.triggerFeedback();
    if (Keyboards[_baseLayoutName].type == 'ime' &&
        _currentLayoutMode === LAYOUT_MODE_DEFAULT) {
      _currentEngine().click(KeyboardEvent.DOM_VK_BACK_SPACE);
      return;
    }
    window.navigator.mozKeyboard.sendKey(KeyboardEvent.DOM_VK_BACK_SPACE, 0);
  };

  // Return the upper value for a key object
  function _getUpperCaseValue(key) {
    var hasSpecialCode = _specialCodes.indexOf(key.keyCode) > -1;
    if (key.keyCode < 0 || hasSpecialCode || key.compositeKey)
      return key.value;

    var upperCase = _currentLayout.upperCase || {};
    var v = upperCase[key.value] || key.value.toUpperCase();
    return v;
  }

  // Show alternatives for the HTML node key
  function _showAlternatives(key) {

    // Avoid alternatives of alternatives
    if (_isShowingAlternativesMenu)
      return;

    // Get the key object from layout
    var alternatives, altMap, value, keyObj, uppercaseValue;
    var r = key ? key.dataset.row : -1, c = key ? key.dataset.column : -1;
    if (r < 0 || c < 0)
      return;
    keyObj = _currentLayout.keys[r][c];

    console.log('showing alternatives');

    // Handle languages alternatives
    if (keyObj.keyCode === SWITCH_KEYBOARD) {
      IMERender.showKeyboardAlternatives(
        key,
        IMEManager.keyboards,
        _baseLayoutName,
        SWITCH_KEYBOARD
      );
      return;
    }

    // Handle key alternatives
    altMap = _currentLayout.alt || {};
    value = keyObj.value;
    alternatives = altMap[value] || '';

    // If in uppercase, look for other alternatives or use default's
    if (_isUpperCase) {
      uppercaseValue = _getUpperCaseValue(keyObj);
      alternatives = altMap[uppercaseValue] || alternatives.toUpperCase();
    }

    // Split alternatives
    if (alternatives.indexOf(' ') != -1) {
      alternatives = alternatives.split(' ');

      // Check just one item
      if (alternatives.length === 2 && alternatives[1] === '')
        alternatives.pop();

    } else {
      alternatives = alternatives.split('');
    }

    if (!alternatives.length)
      return;

    // The first alternative is ALWAYS the original key
    alternatives.splice(
      0, 0,
      _isUpperCase ? uppercaseValue : value
    );

    // Locked limits
    // TODO: look for [LOCKED_AREA]
    var top = getWindowTop(key);
    var bottom = getWindowTop(key) + key.scrollHeight;

    IMERender.showAlternativesCharMenu(key, alternatives);
    _isShowingAlternativesMenu = true;

    // Locked limits
    // TODO: look for [LOCKED_AREA]
    function getWindowTop(obj) {
      var top;
      top = obj.offsetTop;
      while (obj = obj.offsetParent) {
        top += obj.offsetTop;
      }
      return top;
    }

    function getWindowLeft(obj) {
      var left;
      left = obj.offsetLeft;
      while (obj = obj.offsetParent) {
        left += obj.offsetLeft;
      }
      return left;
    }

    _menuLockedArea = {
      top: top,
      bottom: bottom,
      left: getWindowLeft(IMERender.menu),
      right: getWindowLeft(IMERender.menu) + IMERender.menu.scrollWidth
    };
    _menuLockedArea.width = _menuLockedArea.right - _menuLockedArea.left;
    _menuLockedArea.ratio =
      _menuLockedArea.width / IMERender.menu.children.length;
    for (var prop in _menuLockedArea)
      console.log(prop + ': ' + _menuLockedArea[prop]);

  }

  // Hide alternatives.
  function _hideAlternatives() {
    if (!_isShowingAlternativesMenu)
      return;

    IMERender.hideAlternativesCharMenu();
    _isShowingAlternativesMenu = false;
  }

  // Test if an HTML node is a normal key
  function _isNormalKey(key) {
    var keyCode = parseInt(key.dataset.keycode);
    return keyCode || key.dataset.selection || key.dataset.compositekey;
  }

  //
  // EVENTS HANDLERS
  //

  // When user touches the keyboard
  function _onMouseDown(evt) {
    var keyCode;

    _isPressing = true;
    _currentKey = evt.target;
    if (!_isNormalKey(_currentKey))
      return;
    keyCode = parseInt(_currentKey.dataset.keycode);

    // Feedback
    IMERender.highlightKey(_currentKey);
    IMEFeedback.triggerFeedback();

    // Key alternatives when long press
    _menuTimeout = window.setTimeout((function menuTimeout() {
      _showAlternatives(_currentKey);
    }), _kAccentCharMenuTimeout);

    // Special keys (such as delete) response when pressing (not releasing)
    // Furthermore, delete key has a repetition behavior
    if (keyCode === KeyEvent.DOM_VK_BACK_SPACE) {

      // First, just pressing (without feedback)
      _sendDelete(false);

      // Second, after a delay (with feedback)
      _deleteTimeout = window.setTimeout(function() {
        _sendDelete(true);

        // Third, after shorter delay (with feedback too)
        _deleteInterval = setInterval(function() {
          _sendDelete(true);
        }, _kRepeatRate);

      }, _kRepeatTimeout);

    }
  }

  // [LOCKED_AREA] TODO:
  // This is an agnostic way to improve the usability of the alternatives.
  // It consists into compute an area where the user movement is redirected
  // to the alternative menu keys but I would prefer another alternative
  // with better performance.
  function _onMouseMove(evt) {
    var altCount, width, menuChildren;

    // Control locked zone for menu
    if (_isShowingAlternativesMenu &&
        _menuLockedArea &&
        evt.screenY >= _menuLockedArea.top &&
        evt.screenY <= _menuLockedArea.bottom &&
        evt.screenX >= _menuLockedArea.left &&
        evt.screenX <= _menuLockedArea.right) {

      clearTimeout(_hideMenuTimeout);
      menuChildren = IMERender.menu.children;

      var event = document.createEvent('MouseEvent');
      event.initMouseEvent(
        'mouseover', true, true, window, 0,
        0, 0, 0, 0,
        false, false, false, false, 0, null
      );

      menuChildren[Math.floor(
        (evt.screenX - _menuLockedArea.left) / _menuLockedArea.ratio
      )].dispatchEvent(event);
      return;
    }

  }

  // When user changes to another button (it handle what happend if the user
  // keeps pressing the same area. Similar to _onMouseDown)
  function _onMouseOver(evt) {
    var target = evt.target;
    var keyCode = parseInt(target.dataset.keycode);

    // Do nothing if no pressing (mouse events), same key or not a normal key
    if (!_isPressing || _currentKey == target || !_isNormalKey(target))
      return;

    // Update highlight: remove from older
    IMERender.unHighlightKey(_currentKey);

    // Ignore if moving over delete key
    if (keyCode == KeyEvent.DOM_VK_BACK_SPACE) {
      _currentKey = null;
      return;
    }

    // Update highlight: add to the new
    IMERender.highlightKey(target);
    _currentKey = target;

    clearTimeout(_deleteTimeout);
    clearInterval(_deleteInterval);
    clearTimeout(_menuTimeout);

    // Control hide of alternatives menu
    if (target.parentNode === IMERender.menu) {
      clearTimeout(_hideMenuTimeout);
    } else {
      clearTimeout(_hideMenuTimeout);
      _hideMenuTimeout = window.setTimeout(
        function hideMenuTimeout() {
          _hideAlternatives();
        },
        _kHideAlternativesCharMenuTimeout
      );
    }

    // Control showing alternatives menu
    _menuTimeout = window.setTimeout((function menuTimeout() {
      _showAlternatives(target);
    }), _kAccentCharMenuTimeout);

  }

  // When user leaves the keyboard
  function _onMouseLeave(evt) {
    if (!_isPressing || !_currentKey)
      return;

    IMERender.unHighlightKey(_currentKey);

    // Program alternatives to hide
    _hideMenuTimeout = window.setTimeout(function hideMenuTimeout() {
        _hideAlternatives();
    }, _kHideAlternativesCharMenuTimeout);

    _currentKey = null;
  }

  // Handle the default behavior for a pressed key
  function _handleMouseDownEvent(keyCode) {

    // Redirects to IME
    if (Keyboards[_baseLayoutName].type == 'ime' &&
        _currentLayoutMode == LAYOUT_MODE_DEFAULT) {

      _currentEngine().click(keyCode);
      return;
    }

    // Send the key
    window.navigator.mozKeyboard.sendKey(0, keyCode);

    // Return to default layout after pressinf an uppercase
    if (_isUpperCase &&
        !_isUpperCaseLocked && _currentLayoutMode === LAYOUT_MODE_DEFAULT) {

      _isUpperCase = false;
      _draw(
        _baseLayoutName, _currentInputType,
        _currentLayoutMode, _isUpperCase
      );
    }
  }

  // The user is releasing a key so the key has been pressed. The meat is here.
  function _onMouseUp(evt) {
    _isPressing = false;

    if (!_currentKey)
      return;

    clearTimeout(_deleteTimeout);
    clearInterval(_deleteInterval);
    clearTimeout(_menuTimeout);

    _hideAlternatives();

    var target = _currentKey;
    var keyCode = parseInt(target.dataset.keycode);
    if (!_isNormalKey(target))
      return;

    // IME candidate selected
    var dataset = target.dataset;
    if (dataset.selection) {
      _currentEngine().select(target.textContent, dataset.data);
      IMERender.highlightKey(target);
      _currentKey = null;
      return;
    }

    IMERender.unHighlightKey(target);
    _currentKey = null;

    // Delete is a special key, it reacts when pressed not released
    if (keyCode == KeyEvent.DOM_VK_BACK_SPACE)
      return;

    // Reset the flag when a non-space key is pressed,
    // used in space key double tap handling
    if (keyCode != KeyEvent.DOM_VK_SPACE)
      _isContinousSpacePressed = false;

    // Handle composite key (key that sends more than one code)
    var sendCompositeKey = function sendCompositeKey(compositeKey) {
        compositeKey.split('').forEach(function sendEachKey(key) {
          window.navigator.mozKeyboard.sendKey(0, key.charCodeAt(0));
        });
    }

    var compositeKey = target.dataset.compositekey;
    if (compositeKey) {
      sendCompositeKey(compositeKey);
      return;
    }

    // Handle normal key
    switch (keyCode) {

      // Layout mode change
      case BASIC_LAYOUT:
      case ALTERNATE_LAYOUT:
      case KeyEvent.DOM_VK_ALT:
        _handleSymbolLayoutRequest(keyCode);
      break;

      // Switch language (keyboard)
      case SWITCH_KEYBOARD:

        // If the user has specify a keyboard in the menu,
        // switch to that keyboard.
        if (target.dataset.keyboard) {
          _baseLayoutName = target.dataset.keyboard;

        // Cycle between languages (keyboard)
        } else {
          var keyboards = IMEManager.keyboards;
          var index = keyboards.indexOf(_baseLayoutName);
          index = (index + 1) % keyboards.length;
          _baseLayoutName = IMEManager.keyboards[index];
        }

        _reset();
        _draw(
          _baseLayoutName, _currentInputType,
          _currentLayoutMode, _isUpperCase
        );

        if (Keyboards[_baseLayoutName].type == 'ime') {
          if (_currentEngine().show) {
            _currentEngine().show(_currentInputType);
          }
        }

        break;

      // Expand / shrink the candidate panel
      case TOGGLE_CANDIDATE_PANEL:
        if (IMERender.ime.classList.contains('candidate-panel')) {
          IMERender.ime.classList.remove('candidate-panel');
          IMERender.ime.classList.add('full-candidate-panel');
        } else {
          IMERender.ime.classList.add('candidate-panel');
          IMERender.ime.classList.remove('full-candidate-panel');
        }
        break;

      // Shift or caps lock
      case KeyEvent.DOM_VK_CAPS_LOCK:

        // Already waiting for caps lock
        if (_isWaitingForSecondTap) {
          _isWaitingForSecondTap = false;

          _isUpperCase = _isUpperCaseLocked = true;
          _draw(
            _baseLayoutName, _currentInputType,
            _currentLayoutMode, _isUpperCase
          );

        // Normal behavior: set timeout for second tap and toggle caps
        } else {

          _isWaitingForSecondTap = true;
          window.setTimeout(
            function() {
              _isWaitingForSecondTap = false;
            },
            _kCapsLockTimeout
          );

          // Toggle caps
          _isUpperCase = !_isUpperCase;
          _isUpperCaseLocked = false;
          _draw(
            _baseLayoutName, _currentInputType,
            _currentLayoutMode, _isUpperCase
          );
        }

        // Keyboard updated: all buttons recreated so event target is lost.
        var capsLockKey = document.querySelector(
          'button[data-keycode="' + KeyboardEvent.DOM_VK_CAPS_LOCK + '"]'
        );
        IMERender.setUpperCaseLock(
          capsLockKey,
          _isUpperCaseLocked ? 'locked' : _isUpperCase
        );

      break;

      // Return key
      case KeyEvent.DOM_VK_RETURN:
        if (Keyboards[_baseLayoutName].type == 'ime' &&
            _currentLayoutMode === LAYOUT_MODE_DEFAULT) {
          _currentEngine().click(keyCode);
          break;
        }

        window.navigator.mozKeyboard.sendKey(keyCode, 0);
      break;

      // Space key need a special treatmen due to the point added when double
      // tapped.
      case KeyEvent.DOM_VK_SPACE:
        if (_isWaitingForSpaceSecondTap &&
            !_isContinousSpacePressed) {

          if (Keyboards[_baseLayoutName].type == 'ime' &&
            _currentLayoutMode === LAYOUT_MODE_DEFAULT) {

            //TODO: need to define the inteface for double tap handling
            //_currentEngine().doubleTap(keyCode);
            break;
          }

          // Send a delete key to remove the previous space sent
          window.navigator.mozKeyboard.sendKey(KeyEvent.DOM_VK_BACK_SPACE,
                                               0);

          // Send the . symbol followed by a space
          window.navigator.mozKeyboard.sendKey(0, 46);
          window.navigator.mozKeyboard.sendKey(0, keyCode);

          _isWaitingForSpaceSecondTap = false;

          // A flag to prevent continous replacement of space with "."
          _isContinousSpacePressed = true;
          break;
        }

        // Program timeout for second tap
        _isWaitingForSpaceSecondTap = true;
        window.setTimeout(
          (function removeSpaceDoubleTapTimeout() {
            _isWaitingForSpaceSecondTap = false;
          }).bind(this),
          _kSpaceDoubleTapTimeout
        );

        // After all: treat as a normal key
        _handleMouseDownEvent(keyCode);
        break;

      // Normal key
      default:
        _handleMouseDownEvent(keyCode);
        break;
    }
  }

  // Turn to default values
  function _reset() {
    _currentTrack = null;
    _currentLayoutMode = LAYOUT_MODE_DEFAULT;
    _isUpperCase = false;
  }

  var _imeEvents = {
    'mousedown': _onMouseDown,
    'mouseover': _onMouseOver,
    'mouseleave': _onMouseLeave,
    'mouseup': _onMouseUp,
    'mousemove': _onMouseMove
  };

  function _onEnterArea(evt) {
    var track = evt.detail.track;
    if (_currentTrack === null)
      _currentTrack = track;

    // if a simultaneous touch, finalize the current before continue
    if (_currentTrack !== track) {
      _onLeaveArea(evt, true);
      _onTap(evt, true);
      _currentTrack = track;
    }

    _currentKeyId = evt.detail.area;
    _currentKey = IMERender.getKey(_currentKeyId);
    IMERender.highlightKey(_currentKey);
  }

  function _onLeaveArea(evt, abortingCurrent) {
    // ignore tap events produce by former touchs
    // unless we are precisely aborting the current one
    if (!abortingCurrent && _currentTrack !== evt.detail.track)
      return;

    IMERender.unHighlightKey(_currentKey);
  }

  function _onTap(evt, abortingCurrent) {
    var compositeKey, keyCode;

    // ignore tap events produce by former touchs
    // unless we are precisely aborting the current one
    if (!abortingCurrent && _currentTrack !== evt.detail.track)
      return;


    // composite keys
    function sendCompositeKey(compositeKey) {
      compositeKey.split('').forEach(function sendEachKey(key) {
        window.navigator.mozKeyboard.sendKey(0, key.charCodeAt(0));
      });
    }

    compositeKey = _currentKey.dataset.compositekey;
    if (compositeKey) {
      sendCompositeKey(compositeKey);
      return;
    }

    // default codes
    keyCode = parseInt(_currentKey.dataset.keycode);
    switch (keyCode) {

      // Layout mode change
      case BASIC_LAYOUT:
      case ALTERNATE_LAYOUT:
      case KeyEvent.DOM_VK_ALT:
        _handleSymbolLayoutRequest(keyCode);
      break;

      // Switch language (keyboard)
      case SWITCH_KEYBOARD:

        // If the user has specify a keyboard in the menu,
        // switch to that keyboard.
        if (_currentKey.dataset.keyboard) {
          _baseLayoutName = _currentKey.dataset.keyboard;

        // Cycle between languages (keyboard)
        } else {
          var keyboards = IMEManager.keyboards;
          var index = keyboards.indexOf(_baseLayoutName);
          index = (index + 1) % keyboards.length;
          _baseLayoutName = IMEManager.keyboards[index];
        }

        _reset();
        _draw(
          _baseLayoutName, _currentInputType,
          _currentLayoutMode, _isUpperCase
        );

        if (Keyboards[_baseLayoutName].type == 'ime') {
          if (_currentEngine().show) {
            _currentEngine().show(_currentInputType);
          }
        }

        break;

      // Expand / shrink the candidate panel
      case TOGGLE_CANDIDATE_PANEL:
        if (IMERender.ime.classList.contains('candidate-panel')) {
          IMERender.ime.classList.remove('candidate-panel');
          IMERender.ime.classList.add('full-candidate-panel');
        } else {
          IMERender.ime.classList.add('candidate-panel');
          IMERender.ime.classList.remove('full-candidate-panel');
        }
        break;

      // Shift or caps lock
      case KeyEvent.DOM_VK_CAPS_LOCK:

        // Toggle caps
        _isUpperCase = !_isUpperCase;
        _isUpperCaseLocked = false;
        _draw(
          _baseLayoutName, _currentInputType,
          _currentLayoutMode, _isUpperCase
        );

        // Keyboard updated: all buttons recreated so event target is lost.
        var capsLockKey = document.querySelector(
          'button[data-keycode="' + KeyboardEvent.DOM_VK_CAPS_LOCK + '"]'
        );
        IMERender.setUpperCaseLock(
          capsLockKey,
          _isUpperCase
        );

      break;

      // Return key
      case KeyEvent.DOM_VK_RETURN:
        if (Keyboards[_baseLayoutName].type == 'ime' &&
            _currentLayoutMode === LAYOUT_MODE_DEFAULT) {
          _currentEngine().click(keyCode);
          break;
        }

        window.navigator.mozKeyboard.sendKey(keyCode, 0);
      break;

      // Normal key
      default:
        _handleMouseDownEvent(keyCode);
        break;
    }

  }

  function _onDoubleTap(evt) {
    var keyCode;
    var doubleTapCodes = [KeyEvent.DOM_VK_SPACE, KeyEvent.DOM_VK_CAPS_LOCK];

    if (_currentTrack !== evt.detail.track)
      return;

    keyCode = parseInt(_currentKey.dataset.keycode);

    // it is not a double tap relevant key, do nothing
    if (doubleTapCodes.indexOf(keyCode) < 0) {
      _onTap(evt);
      return;
    }

    // double tap relevant keys
    switch (keyCode) {
      // space adds a point
      case KeyEvent.DOM_VK_SPACE:
        if (Keyboards[_baseLayoutName].type == 'ime' &&
          _currentLayoutMode === LAYOUT_MODE_DEFAULT) {

          //TODO: need to define the inteface for double tap handling
          //_currentEngine().doubleTap(keyCode);
          return;
        }

        // Send a delete key to remove the previous space sent
        window.navigator.mozKeyboard.sendKey(KeyEvent.DOM_VK_BACK_SPACE,
                                             0);

        // Send the . symbol followed by a space
        window.navigator.mozKeyboard.sendKey(0, 46);
      break;

      // shift locks uppercase
      case KeyEvent.DOM_VK_CAPS_LOCK:
        console.log('lock');
        _isUpperCase = _isUpperCaseLocked = true;
        _draw(
          _baseLayoutName, _currentInputType,
          _currentLayoutMode, _isUpperCase
        );

        // Keyboard updated: all buttons recreated so event target is lost.
        var capsLockKey = document.querySelector(
          'button[data-keycode="' + KeyboardEvent.DOM_VK_CAPS_LOCK + '"]'
        );
        IMERender.setUpperCaseLock(
          capsLockKey,
          'locked'
        );

      break;
    }

  }

  function _onTouchSurface(evt) {
    if (evt.detail.area !== null)
      IMEFeedback.triggerFeedback();
  }

  function _onLeaveSurface(evt) {
    if (_currentTrack !== evt.detail.track)
      return;

    _currentKey = null;
  }

  var _newImeEvents = {
    'touchsurface' : _onTouchSurface,
    'enterarea' : _onEnterArea,
    'leavearea' : _onLeaveArea,
    'tap' : _onTap,
    'doubletap' : _onDoubleTap,
    'leavesurface' : _onLeaveSurface
  };

  // Initialize the keyboard (exposed, controlled by IMEManager)
  var srfController = null;
  function _init() {

    // Support function for render
    function isSpecialKeyObj(key) {
      var hasSpecialCode = !KeyEvent.DOM_VK_SPACE &&
                           key.keyCode &&
                           _specialCodes.indexOf(key.keyCode) !== -1;
      return hasSpecialCode || key.keyCode <= 0;
    }
    IMERender.init(_getUpperCaseValue, isSpecialKeyObj);

    // create the surface controller
    srfController = new eal.Surface(
      IMERender.ime, 
      {
        isArea:IMERender.touchBasedIsArea,
        multitouch: true
      }
    );

    // Attach event listeners
    for (var event in _newImeEvents) {
      var callback = _newImeEvents[event] || null;
      if (callback)
        IMERender.ime.addEventListener(event, callback.bind(this));
    }
    _dimensionsObserver.observe(IMERender.ime, _dimensionsObserverConfig);
  }

  // Finalizes the keyboard (exposed, controlled by IMEManager)
  function _uninit() {

    // Detach event listeners
    _dimensionsObserver.disconnect();
    for (event in _imeEvents) {
      var callback = _imeEvents[event] || null;
      if (callback)
        IMERender.ime.removeEventListener(event, callback.bind(this));
    }
    // XXX: Not yet implemented
    // IMERender.uninit();

    for (var engine in this.IMEngines) {
      if (this.IMEngines[engine].uninit)
        this.IMEngines[engine].uninit();
      delete this.IMEngines[engine];
    }
  }

  // Expose pattern
  return {
    // IME Engines are self registering here.
    get IMEngines() { return _IMEngines; },

    // Current keyboard as the name of the layout
    get currentKeyboard() { return _baseLayoutName; },
    set currentKeyboard(value) { _baseLayoutName = value; },

    // Exposed methods
    init: _init,
    uninit: _uninit,

    // Show IME, receives the input's type
    showIME: function(type) {
      delete IMERender.ime.dataset.hidden;
      IMERender.ime.classList.remove('hide');

      _currentInputType = _mapType(type);
      _draw(
        _baseLayoutName, _currentInputType,
        _currentLayoutMode, _isUpperCase
      );

      if (Keyboards[_baseLayoutName].type == 'ime') {
        if (_currentEngine().show) {
          _currentEngine().show(type);
        }
      }
    },

    // Hide IME
    hideIME: function km_hideIME(imminent) {
      IMERender.ime.classList.add('hide');
      IMERender.hideIME(imminent);
    },

    // Controlled by IMEManager, i.e. when orientation change
    onResize: function(nWidth, nHeight, fWidth, fHeihgt) {
      if (IMERender.ime.dataset.hidden)
        return;

      IMERender.resizeUI();
      _updateTargetWindowHeight(); // this case is not captured by the mutation
                                   // observer so we handle it apart
    },

    // Load a special IMEngine (not a usual keyboard but a special IMEngine such
    // as Chinese or Japanese)
    loadKeyboard: function km_loadKeyboard(name) {
      var keyboard = Keyboards[name];
      if (keyboard.type !== 'ime')
        return;

      var sourceDir = './js/imes/';
      var imEngine = keyboard.imEngine;

      // Same IME Engine could be load by multiple keyboard layouts
      // keep track of it by adding a placeholder to the registration point
      if (this.IMEngines[imEngine])
        return;

      this.IMEngines[imEngine] = {};

      var script = document.createElement('script');
      script.src = sourceDir + imEngine + '/' + imEngine + '.js';

      // glue is a special object acting like the interface to let
      // the engine use methods from the controller.
      var glue = {
        path: sourceDir + imEngine,
        sendCandidates: function(candidates) {
          IMERender.showCandidates(candidates);
        },
        sendPendingSymbols: function(symbols,
                                      highlightStart,
                                      highlightEnd,
                                      highlightState) {

          IMERender.showPendingSymbols(
            symbols,
            highlightStart, highlightEnd, highlightState
          );
        },
        sendKey: function(keyCode) {
          switch (keyCode) {
            case KeyEvent.DOM_VK_BACK_SPACE:
            case KeyEvent.DOM_VK_RETURN:
              window.navigator.mozKeyboard.sendKey(keyCode, 0);
              break;

            default:
              window.navigator.mozKeyboard.sendKey(0, keyCode);
              break;
          }
        },
        sendString: function(str) {
          for (var i = 0; i < str.length; i++)
            this.sendKey(str.charCodeAt(i));
        },
        alterKeyboard: function(keyboard) {
          _draw(keyboard, _currentInputType, _currentLayoutMode, _isUpperCase);
        }
      };

      script.addEventListener('load', (function IMEnginesLoaded() {
        var engine = this.IMEngines[imEngine];
        engine.init(glue);
      }).bind(this));

      document.body.appendChild(script);
    }

  };
})();
