'use strict';

/*
  Controller is in charge of receive interaction events and transform them
  into KeyEvent as well as control interface's update.
*/

const IMEController = (function() {
  var _currentGroup, _currentInputType, _currentKey;
  var _inAlternativeMode = false;
  var _formerLayout, _currentLayout;
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

  // return an item from root following dot notation such as 'object.item.subitem'
  function _getRef(root, ref) {
    var path, current = Keyboards[_currentGroup];
    path = ref.split('.');

    for (var i = 0, key; key = path[i]; i += 1) {
      current = current[key];
      if (root === undefined)
        return null;
    }

    return current;
  }

  // expand the layout group to compression 0 especification (bigger, more regular, more verbose)
  function _normalize(group) {
    if (group.normalized)
      return;

    var base = {};
    var overriden = group.overrides;
    if (overriden)
      base = clone(Keyboards['fallbacks']);

    group.normalized = true; // mark as normalized. TODO: improve this with a magic number
  }

  function _getKey(keyHTMLElement) {
    var r = keyHTMLElement.dataset.row;
    var c = keyHTMLElement.dataset.column;
    var a = keyHTMLElement.dataset.alternative;
    if (a !== undefined)
      return _currentLayout.keys[r][c].alternatives[a];
    else
      return _currentLayout.keys[r][c];
  }

  function UnexpectedKeyCode() {
    this.name = 'UnexpectedKeyCode';
    this.message = 'KeyCodes can only be arrays ([...]), strings ("...") or supported actions';
  }

  function _flatCodes(str) {
    var keyCodes = [];
    switch (typeof str) {
      // do not process if number
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

        // special object: changeTo, switchAlternative, toInputType
        } else {
            keyCodes.push(str);
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
    if (mode === 'doubletap' && key.doubletap.length)
      codes = key.doubletap;

    else
      codes = key.keyCodes;


    // send codes
    for (var i = 0, l = codes.length, keyCode; i < l; i += 1) {
      keyCode = codes[i];

      // special action
      if (typeof keyCode === 'object') {

        // changeTo action changes the layout
        if (keyCode.changeTo !== undefined) {
          _updateLayout(keyCode.changeTo);

        // toInputType returns the layout to which represents the current input type
        } else if (keyCode.toInputType) {
          _updateLayout();

        // switchAlternative lets change the layout, if the key is pressed again, return to the former one
        } else if (keyCode.switchAlternative !== undefined) {
          if (!_inAlternativeMode) {
            _inAlternativeMode = true;
            _formerLayout = _currentLayout;
            _updateLayout(keyCode.switchAlternative);

          } else {
            _inAlternativeMode = false;
            _updateLayout(_formerLayout);
          }

        } else {
          throw {name:'UnexpectedAction', message:'Action not recognized for this key'};
        }

      // default keyCode
      } else {
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
  }

  // send codes
  function _onTap(evt) {
    var key = _getKey(evt.target);
    _sendCodes(key);
  }

  // show alternatives
  function _onLongPress(evt) {
    var key = _getKey(evt.target);
    if (!key.alternatives.length)
      return;

    IMERender.showAlternativesCharMenu(evt.target, key, key.alternatives);
  }

  // if repeat is enabled for the key, send codes
  function _onKeepPressing(evt) {
    var key = _getKey(evt.target);
    if (key.repeat) {
      IMEFeedback.triggerFeedback();
      _sendCodes(key);
    }
  }

  // send codes of the double tap
  function _onDoubleTap(evt) {
    var key = _getKey(evt.target);
    _sendCodes(key, 'doubletap');
  }

  // trigger feedback
  function _onPressArea(evt) {
    IMEFeedback.triggerFeedback();
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
    keeppressing: _onKeepPressing,

    // triggers feedback
    pressarea: _onPressArea,

    // show alternatives
    longpress: _onLongPress
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

  // get the proper layout falling back when missing
  function _getLayout(name) {
    // look into current group
    var layout = Keyboards[_currentGroup][name]; // first try

    // look into fallbacks
    if (!layout)
      layout = Keyboards.fallbacks[name]; // second try

    // fallback to text
    if (!layout)
      layout = Keyboards.fallbacks.textType;

    return layout;
  }

  // normalize the layout (bigger, more verbose but easy to treat programatically)
  function _expandLayout(layout) {

    // expand key
    function expandKey(key, row, column) {
      if (key.value === undefined)
        throw {name:'MissedValue', message:'value entry is mandatory for keys.'};

      var altOptions, alternativeKeys = [];

      // set value for alternative key
      if (typeof key.keyCode === 'object' && key.keyCode.switchAlternative) {
        key.value = (_inAlternativeMode ? key.keyCode.altValue : key.value) || key.value;
        console.log(_inAlternativeMode);
        console.log(key.value);
      }

      // set id
      key.id = {
        row: row,
        column: column
      };

      // get keycodes
      key.keyCodes = _flatCodes(key.keyCodes || key.keyCode || key.value);
      key.doubletap = _flatCodes(key.doubletap || '');
      key.repeat = !!key.repeat;

      // alternatives
      if (!key.alternatives) {
        altOptions = layout.alt && layout.alt[key.value] ? layout.alt[key.value] : [];
        if (typeof altOptions === 'string')
          altOptions = altOptions.split('');

        for (var a = 0, alt; alt = altOptions[a]; a += 1) {
          alternativeKeys.push({
            keyCodes: _flatCodes(alt),
            value: alt,
            doubletap: '',
            repeat: false,
            id: {
              row: row,
              column: column,
              alternative: a
            }
          });
        }
        key.alternatives = alternativeKeys;
      }

      return key;
    }

    // resolve key dynamics
    function resolveKey(key, r, c) {
      if (typeof key === 'object')
        return key;

      if (key === 'inputType')
        return _getLayout(_currentInputType+'Type').keys[r][c], true;

      if (typeof key === 'string')
        return resolveKey(_getLayout(key).keys[r][c], r, c);

      throw {
        name:'UnexpectedKeySpecification',
        message:"Keys should be objects, the keyword 'current' or other layout names"
      };
    }

    // resolve row dynamics
    function resolveRow(row, r) {
      
      if (Array.isArray(row))
        return row;

      if (row === 'inputType')
        return _getLayout(_currentInputType+'Type').keys[r];

      if (typeof row === 'string')
        return resolveRow(_getLayout(row).keys[r], r);

      throw {
        name:'UnexpectedRowSpecification',
        message:"Rows should be arrays, the keyword 'current' or other layout names"
      };
    }

    var k, row, rows = layout.keys;
    for (var r = 0, l = rows.length; r < l; r += 1) {
      rows[r] = row = resolveRow(rows[r], r).slice(0); // avoid shared memory

      // expand keys
      for (var c = 0, key; key = row[c]; c += 1) {
        k = clone(resolveKey(key, r, c)); // never touch original
        row[c] = expandKey(k, r, c);
      }
    }
  }

  function _updateLayout(which) {
    which = which || _currentInputType+'Type';
    var layout = typeof which === 'string' ? _getLayout(which) : which;
    _currentLayout = clone(layout, true);

    _expandLayout(_currentLayout);
    IMERender.draw(_currentLayout);
    _updateTargetWindowHeight();
  }

  return {

    init: _init,
    uninit: _uninit,

    get currentGroup() {
      return _currentGroup;
    },

    set currentGroup(value) {
      _currentGroup = value;
    },

    showIME: function(type) {
      _currentInputType = type;
      _updateLayout();
    },

    onResize: function(nWidth, nHeight, fWidth, fHeihgt) {
      if (IMERender.ime.dataset.hidden)
        return;

      // we presume that the targetWindow has been restored by
      // window manager to full size by now.
      IMERender.getTargetWindowMetrics();
      _updateLayout();
    }
  };
})();
