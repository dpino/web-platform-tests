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
    let opts = {}
    opts.strict = true;
    run_in_iframe(test262, attrs, t, opts);
}

function run_in_iframe(test262, attrs, t, opts) {
  opts = opts || {};
  // Rethrow error from iframe.
  window.addEventListener('message', t.step_func(function(e) {
    if (e.data[0] == 'error') {
      throw new Error(e.data[1]);
    }
  }));
  let iframe = document.createElement('iframe');
  iframe.style = 'display: none';
  content = test262_as_html(test262, attrs, opts.strict);
  let blob = new Blob([content], {type: 'text/html'});
  iframe.src = URL.createObjectURL(blob);
  document.body.appendChild(iframe);

  let w = iframe.contentWindow;
  // Finish test on completed event.
  w.addEventListener('completed', t.step_func(function(e) {
    t.done();
  }));
  // If test failed, rethrow error.
  let FAILED = 'iframe-failed' + opts.strict ? 'strict' : '';
  window.addEventListener(FAILED, t.step_func(function(e) {
    t.set_status(t.FAIL);
    throw new Error(e.detail);
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
    top.dispatchEvent(new CustomEvent(FAILED, {detail: e.message}));
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

  <script type="text/javascript">
    function __completed__() {
      window.dispatchEvent(new CustomEvent('completed'));
    }
  <\/script>
</head>
<body>
</body>
<script type="text/javascript">
`;
let FOOTER = `
  ;__completed__();
<\/script>
</html>
`;

function test262_as_html(test262, attrs, strict) {
  output = [];
  output.push(HEADER.replace('###INCLUDES###', addScripts(attrs.includes)));
  output.push(prepareTest(test262, attrs, strict));
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

function prepareTest(test262, attrs, strict) {
  function escapeEvalExpr(str) {
      // Escape double quotes.
      let ret = str.replace(/\"/g, '\\\"');
      // Remove backreturn characters.
      return ret.replace(/\n/g, '');
  }
  let output = [];
  let test = test262();
  if (strict) {
    test = "'use strict';\n" + test;
  }
  if (attrs.type == 'SyntaxError') {
      // If phase is 'runtime' the error will be caught here. If phase is 'early' the
      // error will be handled at the window.onerror event.
      output.push('try { eval("');
      output.push(escapeEvalExpr(test));
      output.push('"); }\ncatch (e) { assert.sameValue(e instanceof SyntaxError, true); }');
  } else {
      output.push(test);
  }
  return output.join("");
}

/* Popup Window */

function run_in_window_strict(test262, attrs, t) {
    let opts = {}
    opts.strict = true;
    run_in_window(test262, attrs, t, opts);
}

function run_in_window(test262, attrs, t, opts) {
  opts = opts || {};
  let content = test262_as_html(test262, attrs, opts.strict);
  let blob = new Blob([content], {type: 'text/html'});
  let page = URL.createObjectURL(blob);
  let popup = window.open(page, 'popup');
  // Finish test on completed event.
  popup.addEventListener('completed', t.step_func(function(e) {
    popup.close();
    t.done();
  }));
  // If test failed, rethrow error.
  let FAILED = 'popup-failed' + opts.strict ? 'strict' : '';
  window.addEventListener(FAILED, t.step_func(function(e) {
    popup.close();
    t.set_status(t.FAIL);
    throw new Error(e.detail);
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
    top.dispatchEvent(new CustomEvent(FAILED, {detail: e.message}));
  });
}

/* Worker */

let WORKER_TEMPLATE = `
  ###INCLUDES###

  function __completed__() {
    postMessage(['completed', '###NAME###']);
  }

  onmessage = function(e) {
    ###BODY###
    __completed__();
  }
`;

function workerNameByType(type, strict) {
    strict = strict || false;
    return type.toLowerCase() + (strict ? "strict" : "");
}

function createWorkerFromString(test262, attrs, opts) {
  function importScripts(sources) {
    sources = sources || [];
    let ret = [];
    let master = ['assert.js', 'sta.js'];  // Must always be included.
    let root = 'http://localhost:8000/test262/harness/'
    master.forEach(function(src) {
      ret.push('"' + root + src + '"');
    });
    sources.forEach(function(src) {
      ret.push('"' + root + src + '"');
    });
    return "importScripts(" + ret.join(",") + ");";
  }
  function createWorker(type, code) {
    let blob = new Blob([code], {type: 'text/javascript'});
    if (type == 'Worker') {
      return new Worker(URL.createObjectURL(blob));
    }
    if (type == 'SharedWorker') {
      return new SharedWorker(URL.createObjectURL(blob));
    }
    throw new Error('unreachable');
  }
  function getWorkerTemplate(type) {
    if (type == 'Worker') {
      return WORKER_TEMPLATE;
    }
    if (type == 'SharedWorker') {
      return SHARED_WORKER_TEMPLATE;
    }
    throw new Error('unreachable');
  }
  let type = opts.worker_type || 'Worker';
  let template = getWorkerTemplate(type);
  template = template.replace('###INCLUDES###', importScripts(attrs.includes));
  template = template.replace('###NAME###', workerNameByType(type, opts.strict));
  template = template.replace('###BODY###', prepareTest(test262, attrs));
  return createWorker(type, template);
}

function run_in_worker_strict(test262, attrs, t) {
    let opts = {}
    opts.strict = true;
    run_in_worker(test262, attrs, t, opts);
}

function run_in_worker(test262, attrs, t, opts) {
  opts = opts || {};
  let worker = createWorkerFromString(test262, attrs, opts);
  let worker_name = workerNameByType('Worker', opts.strict);
  worker.addEventListener('message', t.step_func(function(e) {
    let [message, name] = e.data;
    if (message == 'completed' && name == worker_name) {
      t.done();
    }
  }));
  // If test failed, rethrow error.
  let FAILED = 'worker-failed' + opts.strict ? 'strict' : '';
  window.addEventListener(FAILED, t.step_func(function(e) {
    t.set_status(t.FAIL);
    throw new Error(e.detail);
  }));
  // In case of error send it back to sender.
  worker.addEventListener('error', function(e) {
    e.preventDefault();
    // If the test failed due to a SyntaxError but phase was 'early', then the
    // test should actually pass.
    if (e.message.startsWith("SyntaxError")) {
      if (attrs.type == 'SyntaxError' && attrs.phase == 'early') {
        t.done();
        return;
      }
    }
    top.dispatchEvent(new CustomEvent(FAILED, {detail: e.message}));
  });
  worker.postMessage([]);
}

/* SharedWorker */

let SHARED_WORKER_TEMPLATE = `
  ###INCLUDES###

  onconnect = function(e) {

    let port = e.ports[0];

    function __completed__() {
      port.postMessage(['completed', '###NAME###']);
    }

    port.addEventListener('message', function(e) {
      ###BODY###
      __completed__();
    });

    port.start();
  }
`;

function run_in_shared_worker_strict(test262, attrs, t) {
    let opts = {}
    opts.strict = true;
    run_in_shared_worker(test262, attrs, t, opts);
}

function run_in_shared_worker(test262, attrs, t, opts) {
  opts = opts || {};
  let worker = createSharedWorkerFromString(test262, attrs, opts);
  let worker_name = workerNameByType('SharedWorker', opts.strict);
  worker.port.addEventListener('message', t.step_func(function(e) {
    let [message, name] = e.data;
    if (message == 'completed' && name == worker_name) {
      t.done();
    }
  }));
  // If test failed, rethrow error.
  let FAILED = 'shared-worker-failed' + opts.strict ? 'strict' : '';
  window.addEventListener(FAILED, t.step_func(function(e) {
    t.set_status(t.FAIL);
    throw new Error(e.detail);
  }));
  // In case of error send it back to sender.
  worker.port.addEventListener('error', function(e) {
    e.preventDefault();
    // If the test failed due to a SyntaxError but phase was 'early', then the
    // test should actually pass.
    if (e.message.startsWith("SyntaxError")) {
      if (attrs.type == 'SyntaxError' && attrs.phase == 'early') {
        t.done();
        return;
      }
    }
    top.dispatchEvent(new CustomEvent(FAILED, {detail: e.message}));
  });
  worker.port.start();
  worker.port.postMessage([]);
}

function createSharedWorkerFromString(test262, attrs, opts) {
    opts.worker_type = 'SharedWorker';
    return createWorkerFromString(test262, attrs, opts);
}

installAPI(window);
