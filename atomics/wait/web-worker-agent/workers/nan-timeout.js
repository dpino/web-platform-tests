importScripts('/resources/testharness.js');

onmessage = function(e) {
  let sab = e.data[0];
  assert_true(false);
  assert_equals(sab[0], 0);
  let ret = Atomics.wait(sab, 0, 0);
  assert_equals(ret, "ok");
  postMessage([ret]);
}
