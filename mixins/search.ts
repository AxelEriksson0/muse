import {
  BADGE_LABEL,
  MRLIR,
  MRLITFC,
  MUSIC_SHELF,
  NAVIGATION_BROWSE_ID,
  NAVIGATION_VIDEO_ID,
  RUN_TEXT,
  SECTION_LIST,
  THUMBNAILS,
  TITLE_TEXT,
} from "../nav.ts";
import { _, parse_search_results } from "../parsers/browsing.ts";
import {
  Filter,
  filters,
  get_search_params,
  Scope,
  scopes,
} from "../parsers/search.ts";
import { j, jo } from "../util.ts";
import { request_json } from "./_request.ts";

export async function get_search_suggestions(query: string) {
  const json = await request_json("music/get_search_suggestions", {
    params: {
      input: query,
    },
  });

  const results = j(json, "contents");

  const suggestions = [], quick_links = [], history = [];

  Deno.writeTextFileSync(
    "store/quick_links.json",
    JSON.stringify(results, null, 2),
  );

  if (results[0]) {
    const items = j(results[0], "searchSuggestionsSectionRenderer.contents");

    for (const item of items) {
      if ("historySuggestionRenderer" in item) {
        const query = j(item, "historySuggestionRenderer");

        history.push({
          search: j(query, "suggestion.runs"),
          feedback_token: j(
            query,
            "serviceEndpoint.feedbackEndpoint.feedbackToken",
          ),
          query: j(query, "navigationEndpoint.searchEndpoint.query"),
        });
      } else if ("searchSuggestionRenderer" in item) {
        const query = j(item, "searchSuggestionRenderer");

        suggestions.push({
          query: j(query, "suggestion.runs"),
          search: j(query, "navigationEndpoint.searchEndpoint.query"),
        });
      }
    }
  }

  if (results[1]) {
    const items = j(results[1], "searchSuggestionsSectionRenderer.contents");

    for (const item of items) {
      const data = j(item, MRLIR);
      const flex_items = j(data, "flexColumns");

      if (flex_items.length === 2) {
        const first = j(flex_items[0], MRLITFC);

        // artist
        quick_links.push({
          type: "artist",
          thumbnails: j(data, THUMBNAILS),
          name: j(first, RUN_TEXT),
          id: j(data, NAVIGATION_BROWSE_ID),
        });
      } else if (flex_items.length === 3) {
        // song or video

        const first = j(flex_items[0], MRLITFC, "runs[0]");
        const second = j(flex_items[1], MRLITFC);

        const artist = j(second, "runs[2]");

        const type = _(j(second, RUN_TEXT).toLowerCase());

        switch (type) {
          case "video":
          case "song":
            quick_links.push({
              type,
              title: j(first, "text"),
              videoId: j(first, NAVIGATION_VIDEO_ID),
              artists: [
                {
                  name: j(artist, "text"),
                  id: j(artist, NAVIGATION_BROWSE_ID),
                },
              ],
              isExplicit: j(data, BADGE_LABEL) != null,
            });
            break;
          default:
            console.warn("Unknown search suggestion return type", type);
            break;
        }
      }
      // quick_links.push(item);
    }
  }

  return {
    suggestions,
    quick_links,
    history,
  };
}

export interface SearchOptions {
  filter?: Filter;
  scope?: Scope;
  ignore_spelling?: boolean;
}

export async function search(query: string, options: SearchOptions = {}) {
  const { filter, scope, ignore_spelling = true } = options;

  const data = { query } as any;
  const endpoint = "search";
  const search_results = {
    did_you_mean: null as any,
    categories: [] as any[],
  };

  if (filter != null && !filters.includes(filter)) {
    throw new Error(
      `Invalid filter provided. Please use one of the following filters or leave out the parameter: ${
        filters.join(", ")
      }`,
    );
  }

  if (scope != null && !scopes.includes(scope)) {
    throw new Error(
      `Invalid scope provided. Please use one of the following scopes or leave out the parameter: ${
        scopes.join(", ")
      }`,
    );
  }

  if (scope == "uploads" && filter != null) {
    throw new Error(
      "No filter can be set when searching uploads. Please unset the filter parameter when scope is set to uploads",
    );
  }

  const params = get_search_params(filter, scope, ignore_spelling);

  if (params) {
    data.params = params;
  }

  const response = await request_json(endpoint, { data });

  await Deno.writeTextFile(
    "store/search.json",
    JSON.stringify(response, null, 2),
  );

  let results;

  // no results
  if (!("contents" in response)) {
    return search_results;
  } else if ("tabbedSearchResultsRenderer" in response.contents) {
    const tab_index = (!scope || filter) ? 0 : scopes.indexOf(scope as any) + 1;
    results = response.contents.tabbedSearchResultsRenderer.tabs[tab_index]
      .tabRenderer.content;
  } else {
    results = response.contents;
  }

  const section_list = j(results, SECTION_LIST);

  // no results
  if (
    !section_list ||
    (section_list.length == 1 && ("itemSectionRenderer" in results[0]))
  ) {
    return search_results;
  }

  // set filter for parser
  let parser_filter = filter as string;

  if (filter && filter.includes("playlist")) {
    parser_filter = "playlists";
  } else if (scope == "uploads") {
    parser_filter = "uploads";
  }

  for (const res of section_list) {
    if ("musicShelfRenderer" in res) {
      const results = j(res, "musicShelfRenderer.contents");
      let new_filter = parser_filter;
      const category = j(res, MUSIC_SHELF, TITLE_TEXT);

      if (!filter && scope == scopes[0]) {
        new_filter = category;
      }

      const type = new_filter ? new_filter.slice(0, -1).toLowerCase() : null;

      const category_search_results = parse_search_results(results, type);

      if (category_search_results.length > 0) {
        search_results.categories.push({
          category,
          items: category_search_results,
        });
      }
    } else if ("itemSectionRenderer" in res) {
      const did_you_mean = jo(
        res,
        "itemSectionRenderer.contents[0].didYouMeanRenderer",
      );

      if (did_you_mean) {
        search_results.did_you_mean = {
          query: j(did_you_mean, "correctedQuery.runs"),
          search: j(
            did_you_mean,
            "correctedQueryEndpoint.searchEndpoint.query",
          ),
        };
      }
    }
  }

  return search_results;
}
