// From test262-runner.
// Source: https://github.com/bakkot/test262-web-runner
function installAPI(global) {
	global.$262 = {
		createRealm: function() {
			var iframe = global.document.createElement('iframe');
            iframe.style.cssText = "display: none";
			iframe.src = ""; // iframeSrc;
			global.document.body.appendChild(iframe);
			return installAPI(iframe.contentWindow);
		},
		evalScript: function(src) {
			var script = global.document.createElement('script');
			script.text = src;
			global.document.body.appendChild(script);
		},
		detachArrayBuffer: function(buffer) {
			if (typeof postMessage !== 'function') {
				throw new Error('No method available to detach an ArrayBuffer');
			} else {
                postMessage(null, '*', [buffer]);
				/*
				  See https://html.spec.whatwg.org/multipage/comms.html#dom-window-postmessage
				  which calls https://html.spec.whatwg.org/multipage/infrastructure.html#structuredclonewithtransfer
				  which calls https://html.spec.whatwg.org/multipage/infrastructure.html#transfer-abstract-op
				  which calls the DetachArrayBuffer abstract operation https://tc39.github.io/ecma262/#sec-detacharraybuffer
                */
	        }
        },
	    global: global
    };
    return global.$262;
}

// TODO: $DONE is used by Promise tests and others, but I don't know from where to fetch it.
function $DONE() {

}

/* IFrame */

function run_in_iframe_strict(test262, attrs, t) {
    attrs.strict = true;
    run_in_iframe(test262, attrs, t);
}

function run_in_iframe(test262, attrs, t) {
  // Rethrow error from iframe.
  window.addEventListener('message', t.step_func(function(e) {
    if (e.data[0] == 'error') {
      throw new Error(e.data[1]);
    }
  }));
  let iframe = document.createElement('iframe');
  iframe.style = 'display: none';
  content = test262_as_html(test262, attrs);
  let blob = new Blob([content], {type: 'text/html'});
  iframe.src = URL.createObjectURL(blob);
  document.body.appendChild(iframe);

  let w = iframe.contentWindow;
  // Finish test on completed event.
  w.addEventListener('completed', t.step_func(function(e) {
    t.done();
  }));
  // In case of error send it to parent window.
  w.addEventListener('error', function(e) { 
    e.preventDefault();
    // If the test failed due to a SyntaxError but phase was 'early', then the
    // test should actually pass.
    if (e.message.startsWith("SyntaxError")) {
        if (attrs.type == 'SyntaxError' && attrs.phase == 'early') {
            t.done();
            return;
        }
    }
    w.top.postMessage(['error', e.message], '*');
  });
}

let HEADER = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title></title>

  <!-- Test262 harness -->
  <script src="http://localhost:8000/resources/test262-harness.js"><\/script>

  <!-- Test262 required libraries -->
  <script src="http://localhost:8000/test262/harness/assert.js"><\/script>
  <script src="http://localhost:8000/test262/harness/sta.js"><\/script>

  ###INCLUDES###
</head>
<body>
</body>
<script type="text/javascript">
`;
let FOOTER = `
  ;__completed__(window);
<\/script>
</html>
`;

function test262_as_html(test262, attrs) {
  output = [];
  output.push(HEADER.replace('###INCLUDES###', addScripts(attrs.includes)));
  output.push(prepareTest(test262, attrs));
  output.push(FOOTER);
  return output.join("");
}

function addScripts(sources) {
  sources = sources || [];
  let ret = [];
  let root = 'http://localhost:8000/test262/harness/'
  sources.forEach(function(src) {
    ret.push("<script src='###SRC###'><\/script>".replace('###SRC###', root + src));
  });
  return ret.join("\n");
}

function prepareTest(test262, attrs) {
  function escapeDoubleQuotes(str) {
      return str.replace(/\"/g, '\\\"');
  }
  let output = [];
  let test = test262();
  if (attrs.strict) {
    test = "'use strict';\n" + test;
  }
  if (attrs.type == 'SyntaxError') {
      // If phase is 'runtime' the error will be caught here. If phase is 'early' the
      // error will be handled at the window.onerror event.
      output.push('try { eval("');
      output.push(escapeDoubleQuotes(test));
      output.push('"); } catch (e) { assert.sameValue(e instanceof SyntaxError, true); }');
  } else {
      output.push(test);
  }
  return output.join("");
}

function __completed__(w) {
	w.dispatchEvent(new CustomEvent('completed'));
}

/* Popup Window */

function run_in_window_strict(test262, attrs, t) {
    attrs.strict = true;
    run_in_window(test262, attrs, t);
}

function run_in_window(test262, attrs, t) {
  // Rethrow error from popup window.
  window.addEventListener('message', t.step_func(function(e) {
    if (e.data[0] == 'error') {
      throw new Error(e.data[1]);
    }
  }));
  let content = test262_as_html(test262, attrs);
  let blob = new Blob([content], {type: 'text/html'});
  let page = URL.createObjectURL(blob);
  let popup = window.open(page, 'popup');
  // Finish test on completed event.
  popup.addEventListener('completed', t.step_func(function(e) {
    popup.close();
    t.done();
  }));
  // In case of error send it to parent window.
  popup.addEventListener('error', function(e) {
    e.preventDefault();
    // If the test failed due to a SyntaxError but phase was 'early', then the
    // test should actually pass.
    if (e.message.startsWith("SyntaxError")) {
        if (attrs.type == 'SyntaxError' && attrs.phase == 'early') {
            t.done();
            return;
        }
    }
    popup.top.postMessage(['error', e.message], '*');
  });
}

installAPI(window);
