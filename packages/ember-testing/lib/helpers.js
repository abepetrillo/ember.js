import { get } from 'ember-metal/property_get';
import EmberError from 'ember-metal/error';
import run from 'ember-metal/run_loop';
import jQuery from 'ember-views/system/jquery';
import Test from 'ember-testing/test';
import RSVP from 'ember-runtime/ext/rsvp';
import isEnabled from 'ember-metal/features';

/**
@module ember
@submodule ember-testing
*/

var helper = Test.registerHelper;
var asyncHelper = Test.registerAsyncHelper;

var keyboardEventTypes, mouseEventTypes, buildKeyboardEvent, buildMouseEvent, buildBasicEvent, fireEvent, focus;

if (isEnabled('ember-test-helpers-fire-native-events')) {
  let defaultEventOptions = { canBubble: true, cancelable: true };
  keyboardEventTypes = ['keydown', 'keypress', 'keyup'];
  mouseEventTypes = ['click', 'mousedown', 'mouseup', 'dblclick', 'mousenter', 'mouseleave', 'mousemove', 'mouseout', 'mouseover'];


  buildKeyboardEvent = function buildKeyboardEvent(type, options = {}) {
    let event;
    try {
      event = document.createEvent('KeyEvents');
      let eventOpts = jQuery.extend({}, defaultEventOptions, options);
      event.initKeyEvent(
        type,
        eventOpts.canBubble,
        eventOpts.cancelable,
        window,
        eventOpts.ctrlKey,
        eventOpts.altKey,
        eventOpts.shiftKey,
        eventOpts.metaKey,
        eventOpts.keyCode,
        eventOpts.charCode
      );
    } catch (e) {
      event = buildBasicEvent(type, options);
    }
    return event;
  };

  buildMouseEvent = function buildMouseEvent(type, options = {}) {
    let event;
    try {
      event = document.createEvent('MouseEvents');
      let eventOpts = jQuery.extend({}, defaultEventOptions, options);
      event.initMouseEvent(
        type,
        eventOpts.canBubble,
        eventOpts.cancelable,
        window,
        eventOpts.detail,
        eventOpts.screenX,
        eventOpts.screenY,
        eventOpts.clientX,
        eventOpts.clientY,
        eventOpts.ctrlKey,
        eventOpts.altKey,
        eventOpts.shiftKey,
        eventOpts.metaKey,
        eventOpts.button,
        eventOpts.relatedTarget);
    } catch (e) {
      event = buildBasicEvent(type, options);
    }
    return event;
  };

  buildBasicEvent = function buildBasicEvent(type, options = {}) {
    let event = document.createEvent('Events');
    event.initEvent(type, true, true);
    jQuery.extend(event, options);
    return event;
  };

  fireEvent = function fireEvent(element, type, options = {}) {
    if (!element) {
      return;
    }
    let event;
    if (keyboardEventTypes.indexOf(type) > -1) {
      event = buildKeyboardEvent(type, options);
    } else if (mouseEventTypes.indexOf(type) > -1) {
      let rect = element.getBoundingClientRect();
      let x = rect.left + 1;
      let y = rect.top + 1;
      let simulatedCoordinates = {
        screenX: x + 5,
        screenY: y + 95,
        clientX: x,
        clientY: y
      };
      event = buildMouseEvent(type, jQuery.extend(simulatedCoordinates, options));
    } else {
      event = buildBasicEvent(type, options);
    }
    element.dispatchEvent(event);
  };

  focus = function focus(el) {
    if (!el) { return; }
    let $el = jQuery(el);
    if ($el.is(':input, [contenteditable=true]')) {
      let type = $el.prop('type');
      if (type !== 'checkbox' && type !== 'radio' && type !== 'hidden') {
        run(null, function() {
          // Firefox does not trigger the `focusin` event if the window
          // does not have focus. If the document doesn't have focus just
          // use trigger('focusin') instead.

          if (!document.hasFocus || document.hasFocus()) {
            el.focus();
          } else {
            $el.trigger('focusin');
          }
        });
      }
    }
  };
} else {
  focus = function focus(el) {
    if (el && el.is(':input, [contenteditable=true]')) {
      var type = el.prop('type');
      if (type !== 'checkbox' && type !== 'radio' && type !== 'hidden') {
        run(el, function() {
          // Firefox does not trigger the `focusin` event if the window
          // does not have focus. If the document doesn't have focus just
          // use trigger('focusin') instead.
          if (!document.hasFocus || document.hasFocus()) {
            this.focus();
          } else {
            this.trigger('focusin');
          }
        });
      }
    }
  };

  fireEvent = function fireEvent(element, type, options) {
    var event = jQuery.Event(type, options);
    jQuery(element).trigger(event);
  };
}


function currentRouteName(app) {
  var routingService = app.__container__.lookup('service:-routing');

  return get(routingService, 'currentRouteName');
}

function currentPath(app) {
  var routingService = app.__container__.lookup('service:-routing');

  return get(routingService, 'currentPath');
}

function currentURL(app) {
  var router = app.__container__.lookup('router:main');

  return get(router, 'location').getURL();
}

function pauseTest() {
  Test.adapter.asyncStart();
  return new RSVP.Promise(function() { }, 'TestAdapter paused promise');
}

function visit(app, url) {
  var router = app.__container__.lookup('router:main');
  var shouldHandleURL = false;

  app.boot().then(function() {
    router.location.setURL(url);

    if (shouldHandleURL) {
      run(app.__deprecatedInstance__, 'handleURL', url);
    }
  });

  if (app._readinessDeferrals > 0) {
    router['initialURL'] = url;
    run(app, 'advanceReadiness');
    delete router['initialURL'];
  } else {
    shouldHandleURL = true;
  }

  return app.testHelpers.wait();
}

function click(app, selector, context) {
  let $el = app.testHelpers.findWithAssert(selector, context);
  let el = $el[0];

  run(null, fireEvent, el, 'mousedown');

  focus(el);

  run(null, fireEvent, el, 'mouseup');
  run(null, fireEvent, el, 'click');

  return app.testHelpers.wait();
}

function triggerEvent(app, selector, contextOrType, typeOrOptions, possibleOptions) {
  var arity = arguments.length;
  var context, type, options;

  if (arity === 3) {
    // context and options are optional, so this is
    // app, selector, type
    context = null;
    type = contextOrType;
    options = {};
  } else if (arity === 4) {
    // context and options are optional, so this is
    if (typeof typeOrOptions === 'object') {  // either
      // app, selector, type, options
      context = null;
      type = contextOrType;
      options = typeOrOptions;
    } else { // or
      // app, selector, context, type
      context = contextOrType;
      type = typeOrOptions;
      options = {};
    }
  } else {
    context = contextOrType;
    type = typeOrOptions;
    options = possibleOptions;
  }

  var $el = app.testHelpers.findWithAssert(selector, context);
  var el = $el[0];

  run(null, fireEvent, el, type, options);

  return app.testHelpers.wait();
}

function keyEvent(app, selector, contextOrType, typeOrKeyCode, keyCode) {
  var context, type;

  if (typeof keyCode === 'undefined') {
    context = null;
    keyCode = typeOrKeyCode;
    type = contextOrType;
  } else {
    context = contextOrType;
    type = typeOrKeyCode;
  }

  return app.testHelpers.triggerEvent(selector, context, type, { keyCode: keyCode, which: keyCode });
}

function fillIn(app, selector, contextOrText, text) {
  var $el, el, context;
  if (typeof text === 'undefined') {
    text = contextOrText;
  } else {
    context = contextOrText;
  }
  $el = app.testHelpers.findWithAssert(selector, context);
  el = $el[0];
  focus(el);
  run(function() {
    $el.val(text);
    fireEvent(el, 'input');
    fireEvent(el, 'change');
  });
  return app.testHelpers.wait();
}

function findWithAssert(app, selector, context) {
  var $el = app.testHelpers.find(selector, context);
  if ($el.length === 0) {
    throw new EmberError('Element ' + selector + ' not found.');
  }
  return $el;
}

function find(app, selector, context) {
  var $el;
  context = context || get(app, 'rootElement');
  $el = app.$(selector, context);

  return $el;
}

function andThen(app, callback) {
  return app.testHelpers.wait(callback(app));
}

function wait(app, value) {
  return new RSVP.Promise(function(resolve) {
    var router = app.__container__.lookup('router:main');

    // Every 10ms, poll for the async thing to have finished
    var watcher = setInterval(function() {
      // 1. If the router is loading, keep polling
      var routerIsLoading = router.router && !!router.router.activeTransition;
      if (routerIsLoading) { return; }

      // 2. If there are pending Ajax requests, keep polling
      if (Test.pendingAjaxRequests) { return; }

      // 3. If there are scheduled timers or we are inside of a run loop, keep polling
      if (run.hasScheduledTimers() || run.currentRunLoop) { return; }
      if (Test.waiters && Test.waiters.any(function(waiter) {
        var context = waiter[0];
        var callback = waiter[1];
        return !callback.call(context);
      })) {
        return;
      }
      // Stop polling
      clearInterval(watcher);

      // Synchronously resolve the promise
      run(null, resolve, value);
    }, 10);
  });
}


/**
  Loads a route, sets up any controllers, and renders any templates associated
  with the route as though a real user had triggered the route change while
  using your app.

  Example:

  ```javascript
  visit('posts/index').then(function() {
    // assert something
  });
  ```

  @method visit
  @param {String} url the name of the route
  @return {RSVP.Promise}
  @public
*/
asyncHelper('visit', visit);

/**
  Clicks an element and triggers any actions triggered by the element's `click`
  event.

  Example:

  ```javascript
  click('.some-jQuery-selector').then(function() {
    // assert something
  });
  ```

  @method click
  @param {String} selector jQuery selector for finding element on the DOM
  @return {RSVP.Promise}
  @public
*/
asyncHelper('click', click);

/**
  Simulates a key event, e.g. `keypress`, `keydown`, `keyup` with the desired keyCode

  Example:

  ```javascript
  keyEvent('.some-jQuery-selector', 'keypress', 13).then(function() {
   // assert something
  });
  ```

  @method keyEvent
  @param {String} selector jQuery selector for finding element on the DOM
  @param {String} type the type of key event, e.g. `keypress`, `keydown`, `keyup`
  @param {Number} keyCode the keyCode of the simulated key event
  @return {RSVP.Promise}
  @since 1.5.0
  @public
*/
asyncHelper('keyEvent', keyEvent);

/**
  Fills in an input element with some text.

  Example:

  ```javascript
  fillIn('#email', 'you@example.com').then(function() {
    // assert something
  });
  ```

  @method fillIn
  @param {String} selector jQuery selector finding an input element on the DOM
  to fill text with
  @param {String} text text to place inside the input element
  @return {RSVP.Promise}
  @public
*/
asyncHelper('fillIn', fillIn);

/**
  Finds an element in the context of the app's container element. A simple alias
  for `app.$(selector)`.

  Example:

  ```javascript
  var $el = find('.my-selector');
  ```

  @method find
  @param {String} selector jQuery string selector for element lookup
  @return {Object} jQuery object representing the results of the query
  @public
*/
helper('find', find);

/**
  Like `find`, but throws an error if the element selector returns no results.

  Example:

  ```javascript
  var $el = findWithAssert('.doesnt-exist'); // throws error
  ```

  @method findWithAssert
  @param {String} selector jQuery selector string for finding an element within
  the DOM
  @return {Object} jQuery object representing the results of the query
  @throws {Error} throws error if jQuery object returned has a length of 0
  @public
*/
helper('findWithAssert', findWithAssert);

/**
  Causes the run loop to process any pending events. This is used to ensure that
  any async operations from other helpers (or your assertions) have been processed.

  This is most often used as the return value for the helper functions (see 'click',
  'fillIn','visit',etc).

  Example:

  ```javascript
  Ember.Test.registerAsyncHelper('loginUser', function(app, username, password) {
    visit('secured/path/here')
    .fillIn('#username', username)
    .fillIn('#password', password)
    .click('.submit')

    return app.testHelpers.wait();
  });

  @method wait
  @param {Object} value The value to be returned.
  @return {RSVP.Promise}
  @public
*/
asyncHelper('wait', wait);
asyncHelper('andThen', andThen);


/**
  Returns the currently active route name.

Example:

```javascript
function validateRouteName() {
  equal(currentRouteName(), 'some.path', "correct route was transitioned into.");
}

visit('/some/path').then(validateRouteName)
```

@method currentRouteName
@return {Object} The name of the currently active route.
@since 1.5.0
@public
*/
helper('currentRouteName', currentRouteName);

/**
  Returns the current path.

Example:

```javascript
function validateURL() {
  equal(currentPath(), 'some.path.index', "correct path was transitioned into.");
}

click('#some-link-id').then(validateURL);
```

@method currentPath
@return {Object} The currently active path.
@since 1.5.0
@public
*/
helper('currentPath', currentPath);

/**
  Returns the current URL.

Example:

```javascript
function validateURL() {
  equal(currentURL(), '/some/path', "correct URL was transitioned into.");
}

click('#some-link-id').then(validateURL);
```

@method currentURL
@return {Object} The currently active URL.
@since 1.5.0
@public
*/
helper('currentURL', currentURL);

/**
 Pauses the current test - this is useful for debugging while testing or for test-driving.
 It allows you to inspect the state of your application at any point.

 Example (The test will pause before clicking the button):

 ```javascript
 visit('/')
 return pauseTest();

 click('.btn');
 ```

 @since 1.9.0
 @method pauseTest
 @return {Object} A promise that will never resolve
 @public
*/
helper('pauseTest', pauseTest);

/**
  Triggers the given DOM event on the element identified by the provided selector.

  Example:

  ```javascript
  triggerEvent('#some-elem-id', 'blur');
  ```

  This is actually used internally by the `keyEvent` helper like so:

  ```javascript
  triggerEvent('#some-elem-id', 'keypress', { keyCode: 13 });
  ```

 @method triggerEvent
 @param {String} selector jQuery selector for finding element on the DOM
 @param {String} [context] jQuery selector that will limit the selector
                           argument to find only within the context's children
 @param {String} type The event type to be triggered.
 @param {Object} [options] The options to be passed to jQuery.Event.
 @return {RSVP.Promise}
 @since 1.5.0
 @public
*/
asyncHelper('triggerEvent', triggerEvent);
