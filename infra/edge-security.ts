// CloudFront Functions JS (runtime 2.0), injected at the top of SST's own
// viewer-request handler, so it stays ES5.1-safe and returns early.
//
// Blocks vulnerability-scanner traffic (WordPress/PHP probes, .env/.git
// dumps, blind POSTs to "/") at the edge, before it reaches the origin —
// none of that needs a Lambda invocation. See console.sst.dev error spam
// from these exact patterns (/.env, malformed-content-type POSTs) across
// prod, 2026-09.
export const blockBadBots = `
var uri = event.request.uri.toLowerCase();
var method = event.request.method;

function endsWith(str, suffix) {
  return str.length >= suffix.length && str.substring(str.length - suffix.length) === suffix;
}
function startsWith(str, prefix) {
  return str.substring(0, prefix.length) === prefix;
}

var blockedPrefixes = [
  '/wp-admin', '/wp-content', '/wp-includes', '/wp-login', '/wp-json',
  '/xmlrpc.php', '/phpmyadmin', '/pma', '/administrator', '/.git',
  '/.env', '/.aws', '/.ssh', '/.vscode', '/cgi-bin', '/vendor/',
  '/actuator', '/telescope', '/_profiler', '/geoserver', '/solr',
];

var blocked = endsWith(uri, '.php');
for (var i = 0; !blocked && i < blockedPrefixes.length; i++) {
  if (startsWith(uri, blockedPrefixes[i])) blocked = true;
}
if (!blocked && method === 'POST' && uri === '/') blocked = true;

if (blocked) {
  return { statusCode: 403, statusDescription: 'Forbidden' };
}
`;
