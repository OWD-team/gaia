const IMERender = (function() {

  var ime, menu;

  var init = function kr_init() {
    this.ime = document.getElementById('keyboard');
  }

  var setUpperCaseLock = function kr_setUpperCaseLock() {
    // TODO: To control render of shift key
  }
  //
  // Public method that draws the Keyboard
  //
  var draw = function kr_draw(layout, flags) {
    flags = flags || {};

    //change scale (Our target screen width is 320px)
    //TODO get document.documentElement.style.fontSize
    //and use it for multipling changeScale deppending on the value of pixel density
    //used in media queries

    var content = '';
    var layoutWidth = layout.width || 10;
    var widthRatio = 10 / layoutWidth;

    resizeUI();

    layout.upperCase = layout.upperCase || {};
    layout.keys.forEach((function buildKeyboardRow(row, nrow) {
      content += '<div class="keyboard-row">';
      row.forEach((function buildKeyboardColumns(key, ncolumn) {

        var specialCodes = [
          KeyEvent.DOM_VK_BACK_SPACE,
          KeyEvent.DOM_VK_CAPS_LOCK,
          KeyEvent.DOM_VK_RETURN,
          KeyEvent.DOM_VK_ALT,
          KeyEvent.DOM_VK_SPACE
        ];
        var hasSpecialCode = specialCodes.indexOf(key.keyCode) > -1;

        var keyChar = key.value;
        if (flags.uppercase && !(key.keyCode < 0 || hasSpecialCode))
          keyChar = layout.upperCase[key.value] || key.value.toUpperCase();

        var code = key.keyCode || keyChar.charCodeAt(0);
        var className = '';
        var ratio = key.ratio || 1;

        //key with + key separation in rems
        var keyWidth = ratio;
        content += buildKey(nrow, ncolumn, code, keyChar, className, keyWidth);

      }));
      content += '</div>';
    }));

    // Append empty accent char menu and key highlight into content HTML
    content += '<span id="keyboard-accent-char-menu-out"><span id="keyboard-accent-char-menu"></span></span>';
    content += '<span id="keyboard-key-highlight"><span id="key-string" class="key-inner"></span> <span class="key-bridge"></span></span>';

    this.ime.innerHTML = content;
    this.menu = document.getElementById('keyboard-accent-char-menu');
    this.keyHighlight = document.getElementById('keyboard-key-highlight');
  };

  var highlightKey = function kr_updateKeyHighlight(key) {
    var keyHighlight = this.keyHighlight;
    var target = key;

    keyHighlight.querySelector("#key-string").textContent = target.textContent;
    keyHighlight.classList.add('show');

    var width = keyHighlight.offsetWidth;
    var top = target.offsetTop - 1;
    var left = target.offsetLeft + target.offsetWidth / 2 - width / 2;
    var keyWidth = target.offsetWidth;

    var menu = this.menu;
    if (target.parentNode === menu) {
      top += menu.offsetTop;
      left += menu.offsetLeft;
    }

    left = Math.max(left, 5);
    left = Math.min(left, window.innerWidth - width - 5);

    keyHighlight.style.top = top + 'px';
    keyHighlight.style.left = left + 'px';
    keyHighlight.querySelector("#key-string").style.width = keyWidth + 'px';
    keyHighlight.querySelector(".key-bridge").style.width = keyWidth + 'px';
    keyHighlight.querySelector(".key-bridge").style.marginLeft = keyWidth/2*-1 + 'px';
  }

  var unHighlightKey = function kr_unHighlightKey(key) {
    var keyHighlight = this.keyHighlight;
    keyHighlight.classList.remove('show');
  };

  var showAlternativesCharMenu = function km_showAlternativesCharMenu(key, altChars) {
    var target = key;
    var cssWidth = target.style.width;
    var left = (window.innerWidth / 2 > target.offsetLeft);
    var altCharsCurrent = [];

    if (left === true) {
      this.menu.style.left = '-moz-calc(' + target.offsetLeft + 'px - 0.8rem)';
      this.menu.style.right = 'auto';
      this.menu.style.textAlign = 'center';
      altCharsCurrent.push(key.firstChild.innerHTML);
      altCharsCurrent = altCharsCurrent.concat(altChars);
    } else {
      var width = '-moz-calc(' + window.innerWidth + 'px - ' + target.offsetLeft + 'px - 0.8rem - ' + target.style.width + ' )';
      this.menu.style.right = width;
      this.menu.style.left = 'auto';
      this.menu.style.textAlign = 'center';
      altCharsCurrent = altChars.reverse();
      altCharsCurrent.push(key.firstChild.innerHTML);
    }

    var content = '';
    var auxCount = 0;
    altCharsCurrent.forEach(function(keyChar) {
      if ((left && auxCount == 0) || (!left && auxCount == altCharsCurrent.length - 1))
        content += buildKey(-1, -1, keyChar.charCodeAt(0), keyChar, 'first-char', cssWidth);
      else
        content += buildKey(-1, -1, keyChar.charCodeAt(0), keyChar, '', cssWidth);
      auxCount++;
    });
    this.menu.innerHTML = content;
    this.menu.style.display = 'block';
    this.menu.style.top = '-moz-calc(' + target.offsetTop + 'px - 4.6rem)';
  };

  var hideAlternativesCharMenu = function km_hideAlternativesCharMenu() {
    this.menu = document.getElementById('keyboard-accent-char-menu');
    this.menu.innerHTML = '';
    this.menu.className = '';
    this.menu.style.display = 'none';
  };

  var resizeUI = function() {

     if ( window.innerWidth > 0 && window.innerWidth < window.innerHeight ) {
        var changeScale = window.innerWidth / 32;
        document.documentElement.style.fontSize = changeScale + 'px';
       console.log( "portrait");
      } 
      if ( window.innerWidth > window.innerHeight) {
        var changeScale = window.innerWidth / 64;
        document.documentElement.style.fontSize = changeScale + 'px';
        console.log( "landscape");
      }

  };

  //
  // Private Methods
  //

  var buildKey = function buildKey(row, column, code, label, className, width) {
    //width -= 1;

    return '<button class="keyboard-key ' + className + '"' +
      ' data-row="' + row + '"' +
      ' data-column="' + column + '"' +
      ' data-keycode="' + code + '"' +
      ' style="-moz-box-flex:' + width +'"' +
      '><span>' + label + '</span></button>';
  };

  return {
    'init': init,
    'draw': draw,
    'ime': ime,
    'highlightKey': highlightKey,
    'unHighlightKey': unHighlightKey,
    'showAlternativesCharMenu': showAlternativesCharMenu,
    'hideAlternativesCharMenu': hideAlternativesCharMenu,
    'setUpperCaseLock': setUpperCaseLock,
    'resizeUI': resizeUI
  };
})();
