'use strict';

var shortcuts = {};

var Shortcuts = {
	
	init: function _init() {
		var i, items = document.querySelectorAll('#shortcuts .shortcut img');
		for(i = 0; i < items.length; i++) {
			shortcuts[items.item(i).parentNode.id] = 0;
			items.item(i).addEventListener('mousedown', this);
			//items.item(i).addEventListener('mouseup', this);
		};
		
		navigator.mozApps.mgmt.getAll().onsuccess = function(e) {
		  var apps = e.target.result;
			apps.forEach(function(app) {
				if(shortcuts.hasOwnProperty(app._manifest.name)) {
					shortcuts[app._manifest.name] = app;
				}
			});
		};
	},
	
	handleEvent: function _handleEvent(evt) {
		var shortcut = evt.currentTarget.parentNode.id;
		console.log(evt);
		if(evt.type == "mousedown" && shortcuts.hasOwnProperty(shortcut)) {
			shortcuts[shortcut].launch();
		}
	}
};

window.addEventListener('load', function shortcutsLoad(evt) {
  window.removeEventListener('load', shortcutsLoad);
  Shortcuts.init();
});