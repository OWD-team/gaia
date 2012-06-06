'use strict';

/*
  Controller is in charge of receive interaction events and transform them
  into KeyEvent as well as control interface's update.
*/

const IMEController = (function() {
  var _currentGroup, _currentInputType, _currentKey;
  var _inUpperCase, _isUpperCaseLocked, _inAlternativeMode = false;
  var _formerLayout, _currentLayout, _upperCaseVariation;
  var _surface;
  var _hideMenuTimer, _hideMenuTimeout = 700;

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

  function _getKey(id) {
    console.log(id);
    var tuple = JSON.parse(id);
    console.log(id);
    var r = tuple[0];
    var c = tuple[1];
    var a = tuple[2];
    var root = _inUpperCase ? _upperCaseVariation : _currentLayout;
    if (a >= 0)
      return root.keys[r][c].alternatives[a];
    else
      return root.keys[r][c];
  }

  function UnexpectedKeyCode() {
    this.name = 'UnexpectedKeyCode';
    this.message = 'KeyCodes can only be arrays ([...]), strings ("...") or supported actions';
  }

  // return an array of numeric key codes
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
          _updateLayout(_currentInputType+'Type');

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
          case KeyEvent.DOM_VK_CAPS_LOCK:
            if (mode === 'doubletap') {
              _isUpperCaseLocked = true;
              _inUpperCase = true;
            } else {
              _isUpperCaseLocked = false;
              _inUpperCase = !_inUpperCase;
              _updateLayout();
            }
          break;

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
    console.log('on tap');
    var key = _getKey(evt.target);
    console.log(key.value);
    _sendCodes(key);

    // disable upperCase when clicking another key
    if (key.keyCodes[0] !== KeyEvent.DOM_VK_CAPS_LOCK && !_isUpperCaseLocked && _inUpperCase) {
      _inUpperCase = false;
      _updateLayout();
    }
  }

  // show alternatives
  function _onLongPress(evt) {
    var key = _getKey(evt.target);
    if (!key.alternatives.length)
      return;

    IMERender.showAlternativesCharMenu(evt.target, key, key.alternatives);
  }

  // hide alternatives
  function _onEnterArea(evt) {
    var key = _getKey(evt.details.area);
    console.log(key.value);
    IMERender.highlightKey(key);
    if (key.parentNode !== IMERender.menu)
      IMERender.hideAlternativesCharMenu();
    else
      window.clearTimeout(_hideMenuTimer);
  }

  // timeout to hide alternatives
  function _onReleaseSurface() {
    _hideMenuTimer = window.setTimeout(
      function() {
        IMERender.hideAlternativesCharMenu();
      },
      _hideMenuTimeout
    );
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

    // hide alternatives and hightlight on enter area
    enterarea: _onEnterArea,

    // unhighlight on leaving area
    leavearea: function (evt) 
    {
      var key = _getKey(evt.detail.area);
      IMERender.unHighlightKey(key);
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
    longpress: _onLongPress,

    // hide alternatives menu
    releasesurface: _onReleaseSurface
  }

  function _init() {
    IMERender.init();

    _surface = new eal.Surface(
      IMERender.ime,
      {
        isArea: function (evt) { 
          var target = evt.target;
          if (target.tagName === 'BUTTON')
            return JSON.stringify([
              target.dataset.row,
              target.dataset.column,
              target.dataset.alternative
            ]);

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
    function expandKey(key, row, column, altIndex) {
      if (key.value === undefined)
        throw {name:'MissedValue', message:'value entry is mandatory for keys.'};

      var altOptions, altKey, upperCodes, alternativeKeys = [];

      // set value for alternative key
      if (typeof key.keyCode === 'object' && key.keyCode.switchAlternative)
        key.value = (_inAlternativeMode ? key.keyCode.altValue : key.value) || key.value;

      // UpperCase: part 1
      // provide a default upperCase, normalize and update the info of the key
      key.upperCase = key.upperCase || {};
      if (_inUpperCase) {
        if (typeof key.upperCase === 'string') {
          key.upperCase = {
            value: key.upperCase,
            keyCodes: key.upperCase
          };
        }
        extend(key, key.upperCase);
      }

      // set id
      key.id = {
        row: row,
        column: column
      };
      if (altIndex)
        key.id.alternative = altIndex;

      // get keycodes
      key.keyCodes = _flatCodes(key.keyCodes || key.keyCode || key.value);
      key.doubletap = _flatCodes(key.doubletap || '');
      key.repeat = !!key.repeat;

      // UpperCase: part 2
      // try local upperCase when needed
      if (_inUpperCase) {

        if (!key.upperCase.value)
          key.value = key.value.toLocaleUpperCase();

        if (!key.upperCase.keyCodes) {
          upperCodes = [];
          key.keyCodes.forEach(function(code) {
            Array.prototype.push.apply(upperCodes, _flatCodes(String.fromCharCode(code).toLocaleUpperCase()));
          });
          key.keyCodes = upperCodes;
        }
      }

      // alternatives are optional
      if (key.alternatives === undefined)
        key.alternatives = [];

      // if provided as string, split one by character
      else if (typeof key.alternatives === 'string')
        key.alternatives = key.alternatives.split('');

      // array is the normalized form
      if (Array.isArray(key.alternatives)) {
        altOptions = key.alternatives;
        for (var a = 0, alt; alt = altOptions[a]; a += 1) {

          // base key
          altKey = {
            value: key.value,
          };

          // each alternative can be a string or an array
          if (Array.isArray(alt) || typeof alt === 'string') {
            altKey.keyCodes = _flatCodes(alt);
            if (typeof alt === 'string')
              altKey.value = alt;

          // alternative can be the key object itself
          } else {
            extend(altKey, alt, {
              alternatives:[] // prevent for alternatives to have alternatives
            });
          }
          key.alternatives[a] = expandKey(altKey, r, c, a);
        }

      // error
      } else {
        throw {
          name: 'UnexpectedAlternativesSpecification',
          message: 'If provided, alternative should be a string ("...") or an array of alternatives ([...]).'
        };
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
    which = which || _currentLayout;
    var layout = typeof which === 'string' ? _getLayout(which) : which;
    layout = clone(layout, true);

    _expandLayout(layout);

    // save the upperCase variation but keep the current layout unalterated
    if (_inUpperCase)
      _upperCaseVariation = layout;
    else
      _currentLayout = layout;

    IMERender.draw(layout);
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
      _inAlternativeMode = false;
      _inUpperCase = _isUpperCaseLocked = false;
      _currentInputType = type;
      _updateLayout(_currentInputType+'Type');
    },

    onResize: function(nWidth, nHeight, fWidth, fHeihgt) {
      if (IMERender.ime.dataset.hidden)
        return;

      // we presume that the targetWindow has been restored by
      // window manager to full size by now.
      IMERender.getTargetWindowMetrics();
      _updateLayout(_currentInputType+'Type');
    }
  };
})();
