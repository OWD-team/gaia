'use strict';

const Keyboards = {
  fallbacks: {

    meta: {
      label: 'System',
      menuLabel: 'System'
    },

    // text layout
    textType: {
      type: 'keyboard',
      alt: {
        a: 'àáâãäåāæ',
        c: 'çćč',
        e: 'èéêëē€',
        i: 'ìíîïī',
        o: 'òóôõöōœø',
        u: 'ùúûüū',
        s: 'śšşß',
        S: 'ŚŠŞ',
        n: 'ńñň',
        ';)': [':)', 'x)', ':(', 'x('],
        '?123': ['?', '!'],
        '.': [',', ':', ';', '...']
      },
      keys: [
        [{ value: 'q' }, { value: 'w' }, { value: 'e' } , { value: 'r' }, { value: 't' } , { value: 'y' }, { value: 'u' } , { value: 'i' }, { value: 'o' }, { value: 'p' }],
        [{ value: 'a' }, { value: 's' }, { value: 'd' }, { value: 'f' }, { value: 'g' } , { value: 'h' }, { value: 'j' }, { value: 'k' }, { value: 'l' }, { value: "'", keyCode: 39 }],
        [{ value: '⇪', ratio: 1.5, keyCode: KeyEvent.DOM_VK_CAPS_LOCK }, { value: 'z' }, { value: 'x' }, { value: 'c' }, { value: 'v' }, { value: 'b' }, { value: 'n' }, { value: 'm' }, { value: '⇍', ratio: 1.5, keyCode: KeyEvent.DOM_VK_BACK_SPACE, repeat:true }],
        [{ value: '?123', keyCode: {switchAlternative: 'alternative', altValue: 'ABC'}, ratio: 2}, { value: ';)', ratio: 1}, { value: ' ', ratio: 4, keyCode: KeyboardEvent.DOM_VK_SPACE, doubletap: [KeyEvent.DOM_VK_BACK_SPACE, '.'], repeat:true }, {value: '.', ratio: 1}, { value: '↵', ratio: 2, keyCode: KeyEvent.DOM_VK_RETURN }]
      ]
    },

    alternative: {
      type: 'keyboard',
      keys: [
        [{ value: '1' }, { value: '2' }, { value: '3' } , { value: '4' }, { value: '5' } , { value: '6' }, { value: '7' } , { value: '8' }, { value: '9' }, { value: '0' }],
        [{ value: '-' }, { value: '/' }, { value: ':' }, { value: ';' }, { value: '(' } , { value: ')' }, { value: '$' }, { value: '&' }, { value: '@' }, { value: '%' }],
        [{ value: '#+=', ratio: 1.5, keyCode: {changeTo: 'symbols'} }, { value: '_' }, { value: '?' }, { value: "\\" }, { value: '!' }, { value: '"' }, { value: "'" }, { value: '*' }, { value: '⇍', ratio: 1.5, keyCode: KeyEvent.DOM_VK_BACK_SPACE, repeat:true }],
        'inputType',
      ]
    },

    symbols: {
      type: 'keyboard',
      keys: [
        [{ value: '[' }, { value: ']' }, { value: '{' }, { value: '}' }, { value: '#' }, { value: '%' }, { value: '^' }, { value: '+' }, { value: '=' }, { value: '°' }],
        [{ value: '_' }, { value: '¡' }, { value: '|' }, { value: '~' }, { value: '<' }, { value: '>' }, { value: '€' }, { value: '£' }, { value: '¥' }, { value: '·' }],
        [{ value: '123', ratio: 1.5, keyCode: {changeTo: 'alternative'} }, { value: '¿' }, { value: '?' }, { value: "¡" }, { value: '!' }, { value: '"' }, { value: "'" }, { value: '*' }, { value: '⇍', ratio: 1.5, keyCode: KeyEvent.DOM_VK_BACK_SPACE, repeat:true }],
        'inputType',
      ]
    },

    // url layout
    urlType: {
      type: 'keyboard',
      alt: {
        '.com' : ['.org', '.gov', '.es', '.co.uk', '.fr'],
      },
      keys: [
        'textType',
        [{ value: 'a' }, { value: 's' }, { value: 'd' }, { value: 'f' }, { value: 'g' } , { value: 'h' }, { value: 'j' }, { value: 'k' }, { value: 'l' }, { value: "@"}],
        'textType',
        [{ value: '?123', keyCode: {switchAlternative: 'alternative', altValue: 'ABC'}, ratio: 2}, { value: '/', reatio: 1}, { value: '-', reatio: 1}, { value: '_', reatio: 1}, { value: ':', reatio: 1}, { value: '.', reatio: 1}, { value: '.com', reatio: 1}, { value: '↵', ratio: 2, keyCode: KeyEvent.DOM_VK_RETURN }]
      ]
    },

    // email layout
    emailType: {
      type: 'keyboard',
      alt: {
        '.com' : ['.org', '.gov', '.es', '.co.uk', '.fr'],
      },
      keys: [
        'urlType',
        'urlType',
        'urlType',
        [{ value: '?123', keyCode: {switchAlternative: 'alternative', altValue: 'ABC'}, ratio: 2}, { value: '+', reatio: 1}, { value: '-', reatio: 1}, { value: '_', reatio: 1}, { value: ',', reatio: 1}, { value: '.', reatio: 1}, { value: '.com', reatio: 1}, { value: '↵', ratio: 2, keyCode: KeyEvent.DOM_VK_RETURN }]
      ]
    },

    // number type
    numberType: {
      type: 'keyboard',
      width: 9,
      alt: {
        '.' : '\''
      },
      keys: [
        [{ value: '1', ratio: 3},{ value: '2', ratio: 3},{ value: '3', ratio: 3}],
        [{ value: '4', ratio: 3},{ value: '5', ratio: 3},{ value: '6', ratio: 3}],
        [{ value: '7', ratio: 3},{ value: '8', ratio: 3},{ value: '9', ratio: 3}],
        [{ value: '.', ratio: 3},{ value: '0', ratio: 3},{ value: '⇍', ratio: 3, keyCode: KeyEvent.DOM_VK_BACK_SPACE, repeat:true }]
      ]
    },

    // tel type
    telType: {
      type: 'keyboard',
      width: 9,
      keys: [
        'numberType',
        'numberType',
        'numberType',
        [{ value: '*', ratio: 3},{ value: '0', ratio: 3},{ value: '#', ratio: 3}],
        [{ value: '+', ratio: 3},{ value: ',', ratio: 3},{ value: '⇍', ratio: 3, keyCode: KeyEvent.DOM_VK_BACK_SPACE, repeat:true }]
      ]
    }

  },

  en: {
    meta: {
      label: 'English',
      menuLabel: 'English'
    }
  },

  es: {
    meta: {
      label: 'Español',
      menuLabel: 'Español',
    },

    textType: {
      type: 'keyboard',
      alt: {
        a: 'áàâãäåāæ',
        c: 'çćč',
        e: 'é€èêëē',
        i: 'íìîïī',
        o: 'óòôõöōœø',
        u: 'úùûüū',
        s: 'śšşß',
        S: 'ŚŠŞ',
        n: 'ńñň'
      },
      keys: [
        '.fallbacks.textType',
        [{ value: 'a' }, { value: 's' }, { value: 'd' }, { value: 'f' }, { value: 'g' } , { value: 'h' }, { value: 'j' }, { value: 'k' }, { value: 'l' }, { value: "ñ"}],
        '.fallbacks.textType',
        '.fallbacks.textType',
      ]
    }
  }
};
