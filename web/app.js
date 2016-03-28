window.app = (function() {
'use strict';

function init() {
  riot.observable(this);
  this.mvc.init();
  return this;
}

return {
  init: init
};

})();