/**
 * Instagram scraper using the unofficial web API.
 *
 * Instagram's web frontend loads profile data via:
 *   GET /api/v1/users/web_profile_info/?username=<handle>
 *
 * This works for public profiles without login and returns the same
 * `edge_owner_to_timeline_media` graph as the old shared_data approach.
 *
 * Required headers mirror what the Instagram web client sends.
 */

// The Instagram web app ID — stable across requests for the logged-out web client
const IG_APP_ID = '936619743392459';

const DEFAULT_HEADERS: Record<string, string> = {
  'x-ig-app-id': IG_APP_ID,
  'x-requested-with': 'XMLHttpRequest',
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  accept: '*/*',
  'accept-language': 'en-US,en;q=0.9',
  referer: 'https://www.instagram.com/',
};

export interface RawInstagramPost {
  shortcode: string;
  postUrl: string;
  caption: string;
  mediaUrls: string[]; // full-resolution image URLs
  timestamp: string; // ISO timestamp
  isVideo: boolean;
}

interface ProfileApiResponse {
  data: {
    user: {
      id: string;
      username: string;
      edge_owner_to_timeline_media: {
        count: number;
        page_info: {
          has_next_page: boolean;
          end_cursor: string | null;
        };
        edges: Array<{
          node: MediaNode;
        }>;
      };
    } | null;
  };
}

interface MediaNode {
  __typename: string;
  id: string;
  shortcode: string;
  display_url: string;
  is_video: boolean;
  taken_at_timestamp: number;
  edge_media_to_caption: {
    edges: Array<{ node: { text: string } }>;
  };
  // Carousel children
  edge_sidecar_to_children?: {
    edges: Array<{ node: { display_url: string } }>;
  };
}

export interface ScraperOptions {
  /** Only return posts newer than this shortcode (exclusive). */
  sincePostId?: string;
  /** Max posts to return. Defaults to 50. */
  maxPosts?: number;
  /** Delay in ms between paginated requests. Defaults to 1000. */
  delayMs?: number;
}

function mediaNodeToPost(node: MediaNode): RawInstagramPost {
  const caption = node.edge_media_to_caption.edges[0]?.node.text ?? '';

  const mediaUrls: string[] = [];
  if (node.display_url) mediaUrls.push(node.display_url);

  // Carousel: add all child images
  if (node.edge_sidecar_to_children) {
    for (const edge of node.edge_sidecar_to_children.edges) {
      if (edge.node.display_url && !mediaUrls.includes(edge.node.display_url)) {
        mediaUrls.push(edge.node.display_url);
      }
    }
  }

  return {
    shortcode: node.shortcode,
    postUrl: `https://www.instagram.com/p/${node.shortcode}/`,
    caption,
    mediaUrls,
    timestamp: new Date(node.taken_at_timestamp * 1000).toISOString(),
    isVideo: node.is_video,
  };
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchProfilePage(
  handle: string,
  cursor?: string
): Promise<ProfileApiResponse['data']['user']['edge_owner_to_timeline_media'] & { userId: string } | null> {
  // First call: profile info endpoint (also returns first page of posts)
  if (!cursor) {
    const url = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(handle)}`;
    const res = await fetch(url, { headers: DEFAULT_HEADERS });

    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Instagram API error: ${res.status} ${res.statusText}`);

    const json = (await res.json()) as ProfileApiResponse;
    const user = json.data?.user;
    if (!user) return null;

    return {
      userId: user.id,
      ...user.edge_owner_to_timeline_media,
    };
  }

  // Subsequent pages: GraphQL query for more posts
  // doc_id corresponds to the ProfilePageContainer query
  const variables = JSON.stringify({ id: cursor, first: 12 });
  const url = `https://www.instagram.com/graphql/query/?query_hash=69cba40317214236af40e7efa9efb319&variables=${encodeURIComponent(variables)}`;

  const res = await fetch(url, { headers: DEFAULT_HEADERS });
  if (!res.ok) throw new Error(`Instagram GraphQL error: ${res.status}`);

  const json = await res.json() as { data?: { user?: { edge_owner_to_timeline_media: ProfileApiResponse['data']['user']['edge_owner_to_timeline_media'] } } };
  const media = json.data?.user?.edge_owner_to_timeline_media;
  if (!media) return null;

  return { userId: '', ...media };
}

export async function scrapeInstagramProfile(
  handle: string,
  options: ScraperOptions = {}
): Promise<RawInstagramPost[]> {
  const { sincePostId, maxPosts = 50, delayMs = 1000 } = options;

  const posts: RawInstagramPost[] = [];
  const seen = new Set<string>();
  let reachedSince = false;

  const firstPage = await fetchProfilePage(handle);
  if (!firstPage) {
    console.warn(`[instagram] Profile not found or private: @${handle}`);
    return [];
  }

  function processEdges(edges: Array<{ node: MediaNode }>) {
    for (const { node } of edges) {
      if (seen.has(node.shortcode)) continue;
      seen.add(node.shortcode);

      if (sincePostId && node.shortcode === sincePostId) {
        reachedSince = true;
        return;
      }

      posts.push(mediaNodeToPost(node));
      if (posts.length >= maxPosts) return;
    }
  }

  processEdges(firstPage.edges);

  // Paginate if needed and cursor is available
  let pageInfo = firstPage.page_info;
  let userId = firstPage.userId;

  while (
    !reachedSince &&
    posts.length < maxPosts &&
    pageInfo.has_next_page &&
    pageInfo.end_cursor
  ) {
    await sleep(delayMs);

    try {
      const variables = JSON.stringify({ id: userId, first: 12, after: pageInfo.end_cursor });
      const url = `https://www.instagram.com/graphql/query/?query_hash=69cba40317214236af40e7efa9efb319&variables=${encodeURIComponent(variables)}`;
      const res = await fetch(url, { headers: DEFAULT_HEADERS });

      if (!res.ok) {
        console.warn(`[instagram] Pagination request failed: ${res.status}`);
        break;
      }

      const json = await res.json() as { data?: { user?: { edge_owner_to_timeline_media: ProfileApiResponse['data']['user']['edge_owner_to_timeline_media'] } } };
      const media = json.data?.user?.edge_owner_to_timeline_media;
      if (!media) break;

      processEdges(media.edges);
      pageInfo = media.page_info;
    } catch (err) {
      console.warn('[instagram] Pagination error:', err);
      break;
    }
  }

  // Sort descending (newest first)
  posts.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return posts;
}
