'use strict';

//TODO: Make this list of apps customisable 
var ITEMS = ['Dialer', 'Settings', 'Market', 'Browser'];
var shortcuts = {};

/**
  Renders the specific version of the Mozilla shortcuts
  elements
**/
var MozillaShortcutsRenderer = {
  init: function _init() {
    
  },
  
  /**
  <div class="shortcut" id="Dialer">
    <img src="style/icons/Messages.png"></img>
    <span>Messages</span>
  </div>
  **/
  renderMenuItem: function(app, extras) {
    var div,img,span;
    
    div = document.createElement('div');
    div.className = 'shortcut';
    div.id = app._manifest.name;

    //Get the icon for each app from it's domain
    img = document.createElement('img');
    img.src = app._installOrigin + app._manifest.icons['120']; //TODO: ensure we get the proper icon
    //hack, get them from the homescreen as far as they are different right now
    //img.src = 'http://homescreen.gaiamobile.org:8080' + app._manifest.icons['120'];
    img.addEventListener('mousedown', this);
    div.appendChild(img);
    
    span = document.createElement('span');
    //TODO: use l10n here
    span.innerHTML = app._manifest.name;
    div.appendChild(span);
    
    return div;
  },
  
  handleEvent: function _handleEvent(evt) {
		var shortcut = evt.currentTarget.parentNode.id;
		if(evt.type == "mousedown" && shortcuts.hasOwnProperty(shortcut)) {
			shortcuts[shortcut].launch();
		}
	}
};

var Shortcuts = {
	
	init: function _init() {
		/*
		var i, items = document.querySelectorAll('#shortcuts .shortcut img');
		for(i = 0; i < items.length; i++) {
			shortcuts[items.item(i).parentNode.id] = 0;
			items.item(i).addEventListener('mousedown', this);
			//items.item(i).addEventListener('mouseup', this);
		};
		*/
		navigator.mozApps.mgmt.getAll().onsuccess = function(e) {
		  var menuElement, apps = e.target.result;
			apps.forEach(function(app) {
				if(ITEMS.indexOf(app._manifest.name) >= 0) {
					shortcuts[app._manifest.name] = app;
				}
			});
			
			menuElement = document.querySelector('#shortcuts');
			ITEMS.forEach(function(item) {
			  if(shortcuts.hasOwnProperty(item)) {
			    menuElement.appendChild(MozillaShortcutsRenderer.renderMenuItem(shortcuts[item]));
		    }
			});
		};
	}
	
};

window.addEventListener('load', function shortcutsLoad(evt) {
  window.removeEventListener('load', shortcutsLoad);
  Shortcuts.init();
});