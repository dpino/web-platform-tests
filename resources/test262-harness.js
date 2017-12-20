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
				let dst = ArrayBuffer.transfer(buffer, buffer.byteLength);
                console.log(dst);
				postMessage(null, '*', [dst]);
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

function run_in_iframe(test262, includes, t) {
  // Rethrow error from iframe.
  window.addEventListener('message', t.step_func(function(e) {
    if (e.data[0] == 'error') {
      throw new Error(e.data[1]);
    }
  }));
  let iframe = document.createElement('iframe');
  iframe.style = 'display: none';
  content = test262_as_html(test262, includes);
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
    w.top.postMessage(['error', e.message], '*');
  });
}

function test262_as_html(test262, includes) {
  let content = `
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
      ###JSTEST###
      ;__completed__(window);
    <\/script>
    </html>
  `.replace('###JSTEST###', test262())
   .replace('###INCLUDES###', addScripts(includes));
  console.log(content);
  return content;
}

function addScripts(sources) {
  let ret = [];
  let root = 'http://localhost:8000/test262/harness/'
  sources.forEach(function(src) {
    ret.push("<script src='###SRC###'><\/script>".replace('###SRC###', root + src));
  });
  return ret.join("\n");
}

function __completed__(w) {
	w.dispatchEvent(new CustomEvent('completed'));
}

installAPI(window);
