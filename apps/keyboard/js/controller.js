'use strict';

/*
  Controller is in charge of receive interaction events and transform them
  into KeyEvent as well as control interface's update.
*/

const IMEController = (function() {
  var _currentKeyboard, _currentInputType, _currentKey;
  var _surface;

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

  function _updateTargetWindowHeight() {
    var resizeAction = {action: 'resize', height: IMERender.ime.scrollHeight + 'px'};
    parent.postMessage(JSON.stringify(resizeAction), '*');
  }

  function _getKey(keyHTMLElement) {
    var r = keyHTMLElement.dataset.row;
    var c = keyHTMLElement.dataset.column;
    var a = keyHTMLElement.dataset.alternative;
    if (a !== undefined)
      return Keyboards[_currentKeyboard].keys[r][c].alternatives[a];
    else
      return Keyboards[_currentKeyboard].keys[r][c];
  }

  function UnexpectedKeyCode() {
    this.name = 'UnexpectedKeyCode';
    this.message = 'KeyCodes can only be arrays ([...]) or strings ("...")';
  }

  function _flatCodes(str) {
    var keyCodes = [];
    switch (typeof str) {
      // as it is if number
      case 'number':
        keyCodes.push(str);
      break;

      // split into chars and add one code by char
      case 'string':
        str.split('').forEach(function (char) {
            keyCodes.push(char.charCodeAt(0));
        });
      break;

      // if it is an array, go recursively flatting and concatenating results
      case 'object':
        if (Array.isArray(str)) {
          str.forEach(function(item) {
            Array.prototype.push.apply(keyCodes, _flatCodes(item));
          });
        } else {
          throw new UnexpectedKeyCode();
        }
      break;

      // other types not supported
      default:
        throw new UnexpectedKeyCode();
      break;
    }

    return keyCodes;
  }

  function _sendCodes(key, mode) {
    var codes;

    // determine where are the codes
    if (mode === 'doubletap' && key.doubletap)
      codes = key.doubletap;

    else if (key.keyCode !== undefined)
      codes = key.keyCode;

    else
      codes = key.value;

    // normalize codes
    if (!Array.isArray(codes))
      codes = [codes];

    codes = _flatCodes(codes);
    codes.forEach(function(code) { console.log('toSend: '+code);});

    // send codes
    for (var i = 0, l = codes.length, keyCode; i < l; i += 1) {
      keyCode = codes[i];
      switch (keyCode) {
        case KeyEvent.DOM_VK_BACK_SPACE:
        case KeyEvent.DOM_VK_RETURN:
          window.navigator.mozKeyboard.sendKey(keyCode, 0);
          break;

        default:
          window.navigator.mozKeyboard.sendKey(0, keyCode);
          break;
      }
    }
  }

  function _onTap(evt) {
    var area = evt.target;
    var key = _getKey(area);
    _sendCodes(key);
  }

  function _onKeepPressing(evt) {
    var area = evt.area;
    var key = _getKey(area);
    if (key.repeat)
      _sendCodes(key);
  }

  function _onDoubleTap(evt) {
    var area = evt.target;
    var key = _getKey(area);
    _sendCodes(key, 'doubletap');
  }
  
  var _imeEvents = {

    // hightlight on enter area
    enterarea: function (evt) {
      IMERender.highlightKey(evt.target);
    },

    // unhighlight on leaving area
    leavearea: function (evt) {
      IMERender.unHighlightKey(evt.target);
    },

    // send codes on tap
    tap: _onTap,

    // manage double tap
    doubletap: _onDoubleTap,

    // manage repetition
//    keeppressing: 
  }

  function _init() {
    IMERender.init();

    _surface = new eal.Surface(
      IMERender.ime,
      {
        isArea: function (target) { 
          if (target.tagName === 'BUTTON')
            return target;

          return null;
        }
      }
    );

    for (var type in _imeEvents) {
      IMERender.ime.addEventListener(type, _imeEvents[type].bind(this));
    }
  }

  function _uninit() {}

  return {

    init: _init,
    uninit: _uninit,

    get currentKeyboard() {
      return _currentKeyboard;
    },

    set currentKeyboard(value) {
      _currentKeyboard = value;
    },

    showIME: function(type) {
      _currentInputType = _mapType(type); // TODO: this should be unneccesary
      IMERender.draw(Keyboards[this.currentKeyboard]);
      _updateTargetWindowHeight();
    },

    onResize: function(nWidth, nHeight, fWidth, fHeihgt) {
      if (IMERender.ime.dataset.hidden)
        return;

      // we presume that the targetWindow has been restored by
      // window manager to full size by now.
      IMERender.getTargetWindowMetrics();
      IMERender.draw(Keyboards[_baseLayout]);
      _updateTargetWindowHeight();
    }
  };
})();
