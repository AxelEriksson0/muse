import {
  get_continuation_contents,
  get_continuation_params,
  get_continuations,
} from "../continuations.ts";
import {
  CAROUSEL,
  CONTENT,
  DESCRIPTION,
  MUSIC_SHELF,
  NAVIGATION_BROWSE_ID,
  SECTION_LIST_CONTINUATION,
  SECTION_LIST_ITEM,
  SINGLE_COLUMN_TAB,
  SUBTITLE2,
  SUBTITLE3,
  THUMBNAIL_CROPPED,
  TITLE_TEXT,
} from "../nav.ts";
import { parse_content_list, parse_playlist } from "../parsers/browsing.ts";
import { parse_playlist_items, PlaylistItem } from "../parsers/playlists.ts";
import { j, jo, sum_total_duration } from "../util.ts";
import { request_json } from "./_request.ts";

export interface GetPlaylistOptions {
  limit?: number;
  suggestions_limit?: number;
  related?: boolean;
}

export interface Thumbnail {
  url: string;
  width: number;
  height: number;
}

export interface Playlist {
  id: string;
  privacy: "PUBLIC" | "PRIVATE";
  title: string;
  thumbnails: Thumbnail[];
  description: string | null;
  author: {
    name: string;
    id: string;
  } | null;
  year: string | null;
  trackCount: number;
  duration_seconds: number;
  tracks: any[];
  continuation: string | null;
  suggestions: any;
  suggestions_continuation: string | null;
  related: any;
}

export interface PlaylistSuggestions {
  suggestions: PlaylistItem[];
  continuation: string | null;
}

export async function get_playlist_suggestions(
  playlistId: string,
  continuation: string | any,
  limit: number,
) {
  const browseId = playlistId.startsWith("VL") ? playlistId : `VL${playlistId}`;
  const data = { browseId };
  const endpoint = "browse";

  const continued_suggestions = await get_continuations(
    continuation,
    "musicShelfContinuation",
    limit,
    (params: any) => request_json(endpoint, { data, params }),
    parse_playlist_items,
    undefined,
    true,
  );

  return {
    suggestions: continued_suggestions.items,
    continuation: continued_suggestions.continuation,
  } as PlaylistSuggestions;
}

export interface MorePlaylistTracks {
  tracks: PlaylistItem[];
  continuation: string | null;
}

export async function get_more_playlist_tracks(
  playlistId: string,
  continuation: string | any,
  limit: number,
) {
  const browseId = playlistId.startsWith("VL") ? playlistId : `VL${playlistId}`;
  const data = { browseId };
  const endpoint = "browse";

  const continued_data = await get_continuations(
    continuation,
    "musicPlaylistShelfContinuation",
    limit,
    (params: any) => request_json(endpoint, { data, params }),
    (contents) => parse_playlist_items(contents),
  );

  return {
    tracks: continued_data.items,
    continuation: continued_data.continuation,
  } as MorePlaylistTracks;
}

export async function get_playlist(
  playlistId: string,
  options?: GetPlaylistOptions,
) {
  const { limit = 100, related = false, suggestions_limit = 0 } = options || {};

  const browseId = playlistId.startsWith("VL") ? playlistId : `VL${playlistId}`;
  const data = { browseId };
  const endpoint = "browse";

  const json = await request_json(endpoint, { data });

  const results = j(
    json,
    SINGLE_COLUMN_TAB,
    SECTION_LIST_ITEM,
    "musicPlaylistShelfRenderer",
  );

  const own_playlist = "musicEditablePlaylistDetailHeaderRenderer" in
    json.header;

  const header = own_playlist
    ? json.header.musicEditablePlaylistDetailHeaderRenderer.header
      .musicDetailHeaderRenderer
    : json.header.musicDetailHeaderRenderer;

  const run_count = header.subtitle.runs.length;

  const song_count = Number(
    header.secondSubtitle.runs[0].text.normalize("NFKD").split(" ")[0],
  );

  const playlist: Playlist = {
    id: results.playlistId,
    privacy: own_playlist
      ? json.header.musicEditablePlaylistDetailHeaderRenderer.editHeader
        .musicPlaylistEditHeaderRenderer.privacy
      : "PUBLIC",
    title: j(header, TITLE_TEXT),
    thumbnails: j(header, THUMBNAIL_CROPPED),
    description: jo(header, DESCRIPTION),
    author: run_count > 1
      ? {
        name: j(header, SUBTITLE2),
        id: jo(header, "subtitle.runs.2", NAVIGATION_BROWSE_ID),
      }
      : null,
    year: run_count === 5 ? j(header, SUBTITLE3) : null,
    trackCount: song_count,
    duration_seconds: 0,
    tracks: song_count > 0 ? parse_playlist_items(results.contents) : [],
    continuation: null,
    suggestions: [],
    suggestions_continuation: null,
    related: [],
  };

  const request = (params: any) => request_json(endpoint, { data, params });

  // suggestions and related are missing e.g. on liked songs
  const section_list = j(json, SINGLE_COLUMN_TAB, "sectionListRenderer");

  if ("continuations" in section_list) {
    let params = get_continuation_params(section_list);

    if (own_playlist && (suggestions_limit > 0 || related)) {
      const suggested = await request(params);
      const continuation = j(suggested, SECTION_LIST_CONTINUATION);

      params = get_continuation_params(continuation);
      const suggestions_shelf = j(continuation, CONTENT, MUSIC_SHELF);

      playlist.suggestions = get_continuation_contents(
        suggestions_shelf,
        parse_playlist_items,
      );

      playlist.suggestions_continuation = j(
        suggestions_shelf,
        "continuations.0.reloadContinuationData.continuation",
      );

      const continued_suggestions = await get_playlist_suggestions(
        playlistId,
        suggestions_shelf,
        suggestions_limit - playlist.suggestions.length,
      );

      playlist.suggestions.push(...continued_suggestions.suggestions);
      playlist.suggestions_continuation = continued_suggestions.continuation;
    }

    if (related) {
      const response = await request(params);
      const continuation = j(response, SECTION_LIST_CONTINUATION);

      playlist.related = get_continuation_contents(
        j(continuation, CONTENT, CAROUSEL),
        (results: any) => parse_content_list(results, parse_playlist),
      );
    }
  }

  if (song_count > 0) {
    const songs_to_get = Math.min(limit ?? song_count, song_count);

    if ("continuations" in results) {
      const continued_data = await get_more_playlist_tracks(
        playlistId,
        results,
        songs_to_get - playlist.tracks.length,
      );

      playlist.tracks.push(...continued_data.tracks);
      playlist.continuation = continued_data.continuation;
    }
  }

  playlist.duration_seconds = sum_total_duration(playlist);

  return playlist;
}
