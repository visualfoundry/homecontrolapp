// =============================================================================
// WPGraphQL client — Home Control App
//
// Thin typed fetch wrapper. Used server-side only (config plane, ISR).
// Tagged with 'hca-config' for on-demand revalidation via /api/revalidate.
// =============================================================================

const ENDPOINT = process.env.NEXT_PUBLIC_WP_GRAPHQL_URL ?? '';

export class GraphQLError extends Error {
  constructor(public errors: Array<{ message: string }>) {
    super(errors.map(e => e.message).join(', '));
    this.name = 'GraphQLError';
  }
}

interface GQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

/**
 * Execute a GraphQL query against the WPGraphQL endpoint.
 * Uses Next.js ISR tag 'hca-config' so the cache can be purged
 * by the /api/revalidate route when WordPress content is saved.
 */
export async function gql<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  if (!ENDPOINT) {
    throw new Error('NEXT_PUBLIC_WP_GRAPHQL_URL is not set');
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    next: { tags: ['hca-config'] },
  });

  if (!res.ok) {
    throw new Error(`WPGraphQL HTTP ${res.status}: ${res.statusText}`);
  }

  const json = (await res.json()) as GQLResponse<T>;

  if (json.errors?.length) {
    throw new GraphQLError(json.errors);
  }

  if (!json.data) {
    throw new Error('WPGraphQL returned no data');
  }

  return json.data;
}

interface PagedConnection<N> {
  nodes: N[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
}

type PagedResult<N> = { controls: PagedConnection<N> };

/**
 * Fetch all pages of the controls connection, following cursors until done.
 * Each page uses up to 500 items (matching the WPGraphQL cap raised in the theme).
 */
export async function gqlAllControls<N>(
  query: string,
): Promise<N[]> {
  const all: N[] = [];
  let cursor: string | null = null;

  do {
    const variables: Record<string, unknown> = cursor ? { after: cursor } : {};
    const data: PagedResult<N> = await gql<PagedResult<N>>(query, variables);
    all.push(...data.controls.nodes);
    cursor = data.controls.pageInfo.hasNextPage ? data.controls.pageInfo.endCursor : null;
  } while (cursor !== null);

  return all;
}

// ---------------------------------------------------------------------------
// HomeConfig query — fetches all controls from the WP CPT/ACF structure.
// ACF fields exposed via WPGraphQL for ACF v2 (field groups: controlFields,
// controlTypeFields). Device IDs are WP databaseId (string-cast).
// ---------------------------------------------------------------------------

export const HOME_CONFIG_QUERY = /* GraphQL */ `
  query HomeConfig($after: String) {
    controls(first: 500, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        databaseId
        title
        controlFields {
          controlIsy
          controlIsyControlType
          controlAddress
          controlVariableId
          controlVariableValueCopy
          controlType {
            nodes {
              ... on ControlType {
                databaseId
                title
                controlTypeFields {
                  controlTypeType
                  controlTypeMethod
                }
              }
            }
          }
          controlPlace {
            nodes {
              ... on Place {
                databaseId
                title
              }
            }
          }
        }
      }
    }
  }
`;
