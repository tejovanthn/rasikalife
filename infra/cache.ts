// "shared-sst-server": one policy for every server-rendered app in this AWS account.
// Same settings as SST's own: TTL 0, so nothing is cached unless a response asks for
// it. It keys on no cookie, so give an app its own policy before any of its pages
// send `public, s-maxage`. Made by hand; no stage owns it.
export const serverCachePolicy = 'e924a972-9fe8-4ca1-9ec5-0639666eb0c8';
