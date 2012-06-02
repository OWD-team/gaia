'use strict';

function extend(base) {
  var current, i, prop;
  for (var i = 1; i < arguments.length; i += 1) {
    current = arguments[i];
    for (prop in current) {
      base[prop] = current[prop];
    }
  }
  return base;
}

function clone(obj, deep) {
  if (deep)
    return JSON.parse(JSON.stringify(obj));
  else 
    return extend({}, obj);
}

const eal = {};

(function () {

/*
 * Surface EAL provides basic surface events:
 *  touch, press, longPress, tap, doubleTap, enterarea, leavearea, release, changearea
 *
 * Surfaces are compound by areas. When constructing a surface you can optionally pass 
 * a function that receives the target of the event and must return the area for that 
 * target or null if it is not an area. By default, it returns the target element itself.
 *
 * Events:
 * -------
 *  * __touch__ event is triggered when the surface is pressed for the first time
 *  * __press__ event is triggered just after entering a new area (see __enterarea__ event)
 *  * __longpress__ event is triggered when (and only once) the same area is touch during more than longPressDelay
 *  * __tap__ event is triggered when an area is touch and the surface is released without changing the area
 *  * __doubletap__ event is triggered when an area is touch for a second time before doubleTapTimeout
 *  * __enterarea__ event is triggered when entering a new area
 *  * __leavearea__ event is triggered when leaving an area
 *  * __release__ event is triggered when surface is release
 *  * __changearea__ event is triggered when changing the area
 *
 * Usual flows:
 * ------------
 * Take in count some interaction canr trigger more than one event. Here are some examples:
 * (Imagine a QWERTY keyboard)
 *  1- The user tap W:
 *  __touch__, __enterarea__, __press__, __leavearea__, __release__, __tap__
 *  2- The user tap and hold W, then release:
 *  __touch__, __enterarea__, __press__, __longPress__, __leavearea__, __release__, __tap__
 *  3- The user press I, then corrects and moves to U, then release:
 *  __touch__, __enterarea__, __press__, __leavearea__, __enterarea__, __press__, __leavearea__, __release__, __tap__
 *  4- The user press I, then corrects and moves and holds U:
 *  __touch__, __enterarea__, __press__, __leavearea__, __enterarea__, __press__, __longPress__
 *  5- The user release the surface
 *  __leavearea__, __release__, [__tap__ | __doubleTap__]
 *
 *  NOTE __press__ is always triggered after __enterarea__, it is intended to be this way. It is sintactic sugar
 *
 * How to use this:
 * ----------------
 * First convert yout HTML element into a surface. Now take in count every
 * compounding element capturing pointer events is an area.
 *
 * Then attach general callbacks to each event or specific events by area.
 */

var _debugBasicEvents = false;

function logEvent(evt) {
  switch (evt.type) {
    case 'touch':
    case 'release':
      console.log(evt.type);
    break;

    case 'changearea':
      console.log(evt.type+': from '+evt.fromArea.textContent+' to '+evt.area.textContent);
    break;

    default:
      console.log(evt.type+': '+evt.area.textContent);
    break;
  }
}

function _defaultIsArea(htmlElement) {
  return htmlElement;
}

var _longPressTimer, _doubleTapTimer;
var _isWaitingForSecondTap = false;
var _hasMoved;
var _enterArea, _currentArea;
var _options;
var _defaults = {
  longPressDelay: 700,
  doubleTapTimeout: 700,
  getArea: _defaultIsArea,

  touch: logEvent,
  press: logEvent,
  longpress: logEvent,
  tap: logEvent,
  doubletap: logEvent,
  enterarea: logEvent,
  leavearea: logEvent,
  release: logEvent,
  changearea: logEvent
};

function Event(base, type, area, from) {
  // TODO: include more info from base evt?
  extend(this, base);
  this.type = type; 
  this.area = area || base.area || base.target || null;
  this.moved = _hasMoved || base.moved || false;
  this.enterArea = _enterArea;
  if (type == 'changearea')
    this.fromArea = from || null;
}

function _reset() {
  _hasMoved = false;
  _enterArea = null;
}

// some events generate other events
function _addSynteticEvents(evts) {
  var newEvt, evt, type;
  for (var i = 0; evt = evts[i]; i += 1) {
    newEvt = null;
    switch (evt.type) {
      case 'enterarea':
        // enter area generate press
        newEvt = new Event(evt, 'press');
      break;

      case 'leavearea':
        // interrumpt long press
        window.clearTimeout(_longPressTimer);
      break;

      case 'release':
        // release, if in area, generates a tap
        if (_currentArea) {

          // waiting for second tap -> generate the double tap
          if (_isWaitingForSecondTap) {
            newEvt = new Event(evt, 'doubletap', _currentArea);

            _isWaitingForSecondTap = false;

          // not waiting -> generates a tap and now waiting no more than doubleTapTimeout
          } else {
            newEvt = new Event(evt, 'tap', _currentArea);

            _isWaitingForSecondTap = true;
            window.clearTimeout(_doubleTapTimer);
            _doubleTapTimer = window.setTimeout(
              function () { _isWaitingForSecondTap = false; },
              _options.doubleTapTimeout
            );
          }
        }

      break;

      case 'press':
        // set timeout up for long press
        var longPress = new Event(evt, 'longpress');
        window.clearTimeout(_longPressTimer);
        _longPressTimer = window.setTimeout(
          function () {
            _handleAbstractEvents([longPress]);
          },
          _options.longPressDelay
        );
      break;

    }

    if (newEvt)
      evts.splice(i+1, 0, newEvt);
  }
}

function _handleAbstractEvents(evts) {
  var fn;
  _addSynteticEvents(evts);   // improve performance by adding this to the loop
  for (var i = 0, evt; evt = evts[i]; i += 1) {
    // event callback
    fn = _options[evt.type];
    if (typeof fn === 'function')
      fn(evt);
  }
}

function _onMouseDown(evt) {
  _debugBasicEvents && console.log('--> mousedown');

  var abstractEvts = [new Event(evt, 'touch')];
  var newArea = _options.isArea(evt.target);
  if (newArea) {
    _enterArea = _currentArea = newArea;
    abstractEvts.push(
      new Event(evt, 'enterarea', _currentArea)
    );
  }

  _handleAbstractEvents(abstractEvts, evt);
}

function _onMouseLeave(evt) {
  _debugBasicEvents && console.log('--> mouseleave');

  var abstractEvts = [];
  if (_currentArea) {
    abstractEvts.push(
      new Event(evt, 'leavearea', _currentArea)
    );
  }

  abstractEvts.push(
    new Event(evt, 'release')
  );

  _handleAbstractEvents(abstractEvts, evt);
  _reset();
}

function _onMouseMove(evt) {
  _debugBasicEvents && console.log('--> mousemove');

  // ignore moving when not transitioning to another area
  // (leaving to a dead zone or remain in the same area)
  var newArea = _options.isArea(evt.target);
  if (!newArea || _currentArea === newArea)
    return;

  _hasMoved = true;
  var abstractEvts = [
    new Event(evt, 'leavearea', _currentArea),
    new Event(evt, 'changearea', newArea, _currentArea),
    new Event(evt, 'enterarea', newArea)
  ];

  _currentArea = newArea;
  _handleAbstractEvents(abstractEvts);
}

eal.Surface = function(surfaceElement, spec) {
  spec = spec || {};
  _options = extend({}, _defaults, spec);
  surfaceElement.addEventListener('mousedown', _onMouseDown);
  surfaceElement.addEventListener('mouseup', _onMouseLeave);
  surfaceElement.addEventListener('mousemove', _onMouseMove);
  surfaceElement.addEventListener('mouseleave', _onMouseLeave);
}

})();
