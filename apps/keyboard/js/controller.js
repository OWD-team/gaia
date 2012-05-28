/*
  Controller is in charge of receive interaction events and transform them
  into KeyEvent as well as control interface's update.
*/

const IMEController = (function() {

  var _currentKey = null;
  var _isPressing = null;

  function _mapType (type) {
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

  function _highlightKey(target) {
    console.log(target.dataset.keycode);
    if (target.dataset.keycode != KeyboardEvent.DOM_VK_SPACE) {
      IMERender.highlightKey(target);
    }
  }

  return {
    // TODO: IMEngines are other kind of controllers, but now they are like
    // controller's plugins. Maybe refactor is required as well but not now.

    BASIC_LAYOUT: -1,
    ALTERNATE_LAYOUT: -2,
    SWITCH_KEYBOARD: -3,
    TOGGLE_CANDIDATE_PANEL: -4,
    DOT_COM: -5,

    // IME Engines are self registering here.
    IMEngines: {},
    get currentEngine() {
      return this.IMEngines[Keyboards[this.currentKeyboard].imEngine];
    },

    currentKeyboard: '',
    currentKeyboardMode: '',

    currentType: 'text',

    isUpperCase: false,

    get isAlternateLayout() {
      var alternateLayouts = ['Alternate', 'Symbol'];
      return alternateLayouts.indexOf(this.currentKeyboardMode) > -1;
    },

    set isAlternateLayout(isAlternateLayout) {
      if (isAlternateLayout) {
        this.currentKeyboardMode = 'Alternate';
        IMERender.draw('alternateLayout');
      } else {
        this.currentKeyboardMode = '';
        IMERender.draw(this.currentKeyboard);
      }
      this.updateTargetWindowHeight();
    },

    get isSymbolLayout() {
      return this.currentKeyboardMode == 'Symbol';
    },

    set isSymbolLayout(isSymbolLayout) {
      if (isSymbolLayout) {
        this.currentKeyboardMode = 'Symbol';
        IMERender.draw('symbolLayout');
      } else {
        this.currentKeyboardMode = 'Alternate';
        IMERender.draw('alternateLayout');
      }
      this.updateTargetWindowHeight();
    },

    // backspace repeat delay and repeat rate
    kRepeatTimeout: 700,
    kRepeatRate: 100,

    // Taps the shift key twice within kCapsLockTimeout
    // to lock the keyboard at upper case state.
    kCapsLockTimeout: 450,
    isUpperCaseLocked: false,

    // show accent char menu (if there is one) after kAccentCharMenuTimeout
    kAccentCharMenuTimeout: 700,

    // if user leave the original key and did not move to
    // a key within the accent character menu,
    // after kHideAccentCharMenuTimeout the menu will be removed.
    kHideAccentCharMenuTimeout: 500,

    // Taps the space key twice within kSpaceDoubleTapTimeoout
    // to produce a "." followed by a space
    kSpaceDoubleTapTimeout: 700,

    imeEvents: ['mouseup', 'mousedown', 'mouseover', 'mouseleave'],
    init: function km_con_init() {
      IMERender.init();
      this.imeEvents.forEach((function imeEvents(type) {
        IMERender.ime.addEventListener(type, this);
      }).bind(this));
    },

    uninit: function km_con_uninit() {
      this.imeEvents.forEach((function imeEvents(type) {
        IMERender.ime.removeEventListener(type, this);
      }).bind(this));

      for (var engine in this.IMEngines) {
        if (this.IMEngines[engine].uninit)
          this.IMEngines[engine].uninit();
        delete this.IMEngines[engine];
      }

    },

    showIME: function(type) {
      this.currentType = _mapType(type);
      IMERender.draw(this.currentKeyboard);

      if (Keyboards[this.currentKeyboard].type == 'ime') {
        if (this.currentEngine.show) {
          this.currentEngine.show(type);
        }
      }
      this.updateTargetWindowHeight();
    },

    onResize: function(nWidth, nHeight, fWidth, fHeihgt) {
      if (IMERender.ime.dataset.hidden)
        return;

      // we presume that the targetWindow has been restored by
      // window manager to full size by now.
      IMERender.getTargetWindowMetrics();
      IMERender.draw(this.currentKeyboard);
      this.updateTargetWindowHeight();
    },

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
      // TODO: Remvoe variable self
      var self = IMERender;
      var glue = {
        path: sourceDir + imEngine,
        sendCandidates: function(candidates) {
          self.showCandidates(candidates);
        },
        sendPendingSymbols: function(symbols) {
          self.showPendingSymbols(symbols);
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
          self.updateLayout(keyboard);
        }
      };

      script.addEventListener('load', (function IMEnginesLoaded() {
        var engine = this.IMEngines[imEngine];
        engine.init(glue);
      }).bind(this));

      document.body.appendChild(script);
    },

    handleEvent: function km_con_handleEvent(evt) {

      var target = evt.target;
      switch (evt.type) {
        case 'mousedown':
          var keyCode = parseInt(target.dataset.keycode);
          _currentKey = target;
          _isPressing = true;

          if (!keyCode && !target.dataset.selection)
            return;

          _highlightKey(target);
          IMEFeedback.triggerFeedback();

          this._menuTimeout = window.setTimeout((function menuTimeout() {
//              IMERender.showAccentCharMenu();
          }).bind(this), this.kAccentCharMenuTimeout);

          if (keyCode != KeyEvent.DOM_VK_BACK_SPACE)
            return;

          var sendDelete = (function sendDelete(feedback) {
            if (feedback)
              IMEFeedback.triggerFeedback();
            if (Keyboards[this.currentKeyboard].type == 'ime' &&
                !this.currentKeyboardMode) {
              this.currentEngine.click(keyCode);
              return;
            }
            window.navigator.mozKeyboard.sendKey(keyCode, 0);
          }).bind(this);

          sendDelete(false);
          this._deleteTimeout = window.setTimeout((function deleteTimeout() {
            sendDelete(true);

            this._deleteInterval = setInterval(function deleteInterval() {
              sendDelete(true);
            }, this.kRepeatRate);
          }).bind(this), this.kRepeatTimeout);
          break;

        case 'mouseover':
          if (!_isPressing || _currentKey == target)
            return;

          var keyCode = parseInt(target.dataset.keycode);

          if (!keyCode && !target.dataset.selection)
            return;

          if (keyCode == KeyEvent.DOM_VK_BACK_SPACE) {
            IMERender.updateKeyHighlight();
            return;
          }

          IMERender.unHighlightKey(_currentKey);
          _highlightKey(target)
          _currentKey = target;

          clearTimeout(this._deleteTimeout);
          clearInterval(this._deleteInterval);
          clearTimeout(this._menuTimeout);

          if (target.parentNode === IMERender.menu) {
            clearTimeout(this._hideMenuTimeout);
          } else {
/* XXX: Re-enable when new key-options menu is ready
            if (IMERender.menu.className) {
              this._hideMenuTimeout = window.setTimeout(
                (function hideMenuTimeout() {
                  IMERender.hideAccentCharMenu();
                }).bind(this),
                this.kHideAccentCharMenuTimeout
              );
            }

            var needMenu =
              target.dataset.alt || keyCode === this.SWITCH_KEYBOARD;
            if (needMenu) {
              this._menuTimeout = window.setTimeout((function menuTimeout() {
                  IMERender.showAccentCharMenu();
                }).bind(this), this.kAccentCharMenuTimeout);
            }
*/
          }

          break;

        case 'mouseleave':
        case 'scroll': // scrolling IME candidate panel
          if (!_isPressing || !_currentKey)
            return;

          IMERender.unHighlightKey(_currentKey);
/* XXX; Not yet implemented
          this._hideMenuTimeout = window.setTimeout((function hideMenuTimeout() {
              IMERender.hideAccentCharMenu();
          }).bind(this), this.kHideAccentCharMenuTimeout);
*/

          if (evt.type == 'scroll')
            _isPressing = false; // cancel the following mouseover event

          break;

        case 'mouseup':
          _isPressing = false;

          if (!_currentKey)
            return;

          clearTimeout(this._deleteTimeout);
          clearInterval(this._deleteInterval);
          clearTimeout(this._menuTimeout);

//          IMERender.hideAccentCharMenu();

          var target = _currentKey;
          var keyCode = parseInt(target.dataset.keycode);
          if (!keyCode && !target.dataset.selection)
            return;

          var dataset = target.dataset;
          if (dataset.selection) {
            this.currentEngine.select(target.textContent, dataset.data);

            IMERender.updateKeyHighlight();
            return;
          }


          IMERender.unHighlightKey(target);

          if (keyCode == KeyEvent.DOM_VK_BACK_SPACE)
            return;

          // Reset the flag when a non-space key is pressed,
          // used in space key double tap handling
          if (keyCode != KeyEvent.DOM_VK_SPACE)
            delete this.isContinousSpacePressed;

          switch (keyCode) {
            case this.BASIC_LAYOUT:
              this.isAlternateLayout = false;
              break;

            case this.ALTERNATE_LAYOUT:
              this.isAlternateLayout = true;
              break;

            case this.SWITCH_KEYBOARD:

              // If the user has specify a keyboard in the menu,
              // switch to that keyboard.
              if (target.dataset.keyboard) {

                if (IMEManager.keyboards.indexOf(target.dataset.keyboard) === -1)
                  this.currentKeyboard = IMEManager.keyboards[0];
                else
                  this.currentKeyboard = target.dataset.keyboard;

                this.currentKeyboardMode = '';
                this.isUpperCase = false;
                IMERender.draw(this.currentKeyboard);
                this.updateTargetWindowHeight();
              } else {
                // If this is the last keyboard in the stack, start
                // back from the beginning.
                var keyboards = IMEManager.keyboards;
                var index = keyboards.indexOf(this.currentKeyboard);
                if (index >= keyboards.length - 1 || index < 0)
                  this.currentKeyboard = keyboards[0];
                else
                  this.currentKeyboard = keyboards[++index];

                this.currentKeyboardMode = '';
                this.isUpperCase = false;
                IMERender.draw(this.currentKeyboard);
                this.updateTargetWindowHeight();
              }

              if (Keyboards[this.currentKeyboard].type == 'ime') {
                if (this.currentEngine.show) {
                  this.currentEngine.show(this.currentType);
                }
              }

              break;

            case this.TOGGLE_CANDIDATE_PANEL:
              if (IMERender.ime.classList.contains('candidate-panel')) {
                IMERender.ime.classList.remove('candidate-panel');
                IMERender.ime.classList.add('full-candidate-panel');
              } else {
                IMERender.ime.classList.add('candidate-panel');
                IMERender.ime.classList.remove('full-candidate-panel');
              }
              this.updateTargetWindowHeight();
              break;

            case this.DOT_COM:
              ('.com').split('').forEach((function sendDotCom(key) {
                window.navigator.mozKeyboard.sendKey(0, key.charCodeAt(0));
              }).bind(this));
              break;

            case KeyEvent.DOM_VK_ALT:
              this.isSymbolLayout = !this.isSymbolLayout;
              break;

            case KeyEvent.DOM_VK_CAPS_LOCK:
              if (this.isWaitingForSecondTap) {
                this.isUpperCaseLocked = true;
                if (!this.isUpperCase) {
                  this.isUpperCase = true;
                  IMERender.draw(this.currentKeyboard);

                  // XXX: keyboard updated; target is lost.
                  var selector =
                    'span[data-keycode="' + KeyEvent.DOM_VK_CAPS_LOCK + '"]';
                  target = document.querySelector(selector);
                }
                target.dataset.enabled = 'true';
                delete this.isWaitingForSecondTap;
                break;
              }
              this.isWaitingForSecondTap = true;

              window.setTimeout(
                (function removeCapsLockTimeout() {
                  delete this.isWaitingForSecondTap;
                }).bind(this),
                this.kCapsLockTimeout
              );

              this.isUpperCaseLocked = false;
              this.isUpperCase = !this.isUpperCase;
              IMERender.draw(this.currentKeyboard);
              break;

            case KeyEvent.DOM_VK_RETURN:
              if (Keyboards[this.currentKeyboard].type == 'ime' &&
                  !this.currentKeyboardMode) {
                this.currentEngine.click(keyCode);
                break;
              }

              window.navigator.mozKeyboard.sendKey(keyCode, 0);
              break;

            // To handle the case when double tapping the space key
            case KeyEvent.DOM_VK_SPACE:
              if (this.isWaitingForSpaceSecondTap &&
                  !this.isContinousSpacePressed) {

                if (Keyboards[this.currentKeyboard].type == 'ime' &&
                  !this.currentKeyboardMode) {

                  //TODO: need to define the inteface for double tap handling
                  //this.currentEngine.doubleTap(keyCode);
                  break;
                }

                // Send a delete key to remove the previous space sent
                window.navigator.mozKeyboard.sendKey(KeyEvent.DOM_VK_BACK_SPACE,
                                                     0);

                // Send the . symbol followed by a space
                window.navigator.mozKeyboard.sendKey(0, 46);
                window.navigator.mozKeyboard.sendKey(0, keyCode);

                delete this.isWaitingForSpaceSecondTap;

                // a flag to prevent continous replacement of space with "."
                this.isContinousSpacePressed = true;
                break;
              }

              this.isWaitingForSpaceSecondTap = true;

              window.setTimeout(
                (function removeSpaceDoubleTapTimeout() {
                  delete this.isWaitingForSpaceSecondTap;
                }).bind(this),
                this.kSpaceDoubleTapTimeout
              );

              this.handleMouseDownEvent(keyCode);
              break;

            default:
              this.handleMouseDownEvent(keyCode);
              break;

          }
          break;
      }
    },

    updateTargetWindowHeight: function km_updateTargetWindowHeight() {
      var resizeAction = {action: 'resize', height: IMERender.ime.scrollHeight + 'px'};
      parent.postMessage(JSON.stringify(resizeAction), '*');
    },

    handleMouseDownEvent: function km_handleMouseDownEvent(keyCode) {
      if (Keyboards[this.currentKeyboard].type == 'ime' &&
          !this.currentKeyboardMode) {
            this.currentEngine.click(keyCode);
            return;
          }

      window.navigator.mozKeyboard.sendKey(0, keyCode);

      if (this.isUpperCase &&
          !this.isUpperCaseLocked && !this.currentKeyboardMode) {
            this.isUpperCase = false;
            IMERender.draw(this.currentKeyboard);
          }
    }
  };
})();