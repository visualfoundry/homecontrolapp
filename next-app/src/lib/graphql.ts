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

// ---------------------------------------------------------------------------
// HomeConfig query — matches the shape in config-contract.md
// ---------------------------------------------------------------------------

export const HOME_CONFIG_QUERY = /* GraphQL */ `
  query HomeConfig {
    rooms(first: 100) {
      nodes {
        id
        name
        order
        devices {
          nodes {
            id
            name
            class
            room { node { id } }
            icon
            tint
            order
            meta { unit setpointMin setpointMax modeOptions speedSteps }
          }
        }
      }
    }
    scenes(first: 100) {
      nodes { id name icon tint order }
    }
    sceneRooms(first: 100) {
      nodes { id name type hasDoor hasNightDim }
    }
    favCatalog {
      groups { group items { id icon label } }
    }
    people(first: 50) {
      nodes { id name }
    }
    layout {
      dashboardSceneIds
      dashboardFavIds
      defaultTabs
    }
  }
`;
