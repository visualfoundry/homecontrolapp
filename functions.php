<?php
/**
 * Home Control App — Genesis Child Theme
 *
 * Headless PWA shell. WordPress / Genesis provides the admin, WPGraphQL,
 * and CPT/ACF config plane. The front-end is a Next.js PWA that reads
 * config via WPGraphQL (ISR) and live state via the home-control REST service (SSE).
 *
 * @package HomeControlApp
 */

// Start the Genesis engine.
require_once get_template_directory() . '/lib/init.php';

// Theme constants (NEXT_APP_URL, REVALIDATE_SECRET).
require_once get_stylesheet_directory() . '/inc/constants.php';

// -------------------------------------------------------------------------
// Theme setup
// -------------------------------------------------------------------------

add_action( 'genesis_setup', 'homecontrolapp_setup', 15 );
function homecontrolapp_setup() {
	load_child_theme_textdomain( 'homecontrolapp', get_stylesheet_directory() . '/languages' );
}

// -------------------------------------------------------------------------
// Enqueue styles and scripts
// -------------------------------------------------------------------------

add_action( 'wp_enqueue_scripts', 'homecontrolapp_assets' );
function homecontrolapp_assets() {
	// Dequeue Genesis default styles — all styling is handled via compiled SCSS.
	wp_dequeue_style( 'genesis-style' );

	// Compiled SCSS → CSS.
	wp_enqueue_style(
		'homecontrolapp-style',
		get_stylesheet_directory_uri() . '/css/main.css',
		array(),
		CHILD_THEME_VERSION
	);
}

// -------------------------------------------------------------------------
// Theme version constant (used for cache-busting assets)
// -------------------------------------------------------------------------

define( 'CHILD_THEME_VERSION', '1.0.0' );

// -------------------------------------------------------------------------
// Remove Genesis structural markup not needed for a PWA shell
// -------------------------------------------------------------------------

// Let Genesis render a minimal page; the React app mounts inside #hca-root.
// Adjust or restore hooks as needed when adding WP-rendered content.
remove_action( 'genesis_header', 'genesis_header_markup_open', 5 );
remove_action( 'genesis_header', 'genesis_do_header' );
remove_action( 'genesis_header', 'genesis_header_markup_close', 15 );

remove_action( 'genesis_footer', 'genesis_footer_markup_open', 5 );
remove_action( 'genesis_footer', 'genesis_do_footer' );
remove_action( 'genesis_footer', 'genesis_footer_markup_close', 15 );

remove_action( 'genesis_sidebar', 'genesis_do_sidebar' );
remove_action( 'genesis_sidebar_alt', 'genesis_do_sidebar_alt' );

// -------------------------------------------------------------------------
// WPGraphQL — on-demand revalidation endpoint support
// -------------------------------------------------------------------------
// A Next.js route at /api/revalidate?secret=REVALIDATE_SECRET is called by
// the WordPress save_post / ACF-save hook below so config changes appear
// without a full rebuild.

add_action( 'save_post', 'homecontrolapp_trigger_revalidation' );
add_action( 'acf/save_post', 'homecontrolapp_trigger_revalidation' );

function homecontrolapp_trigger_revalidation( $post_id ) {
	// Only fire for published, non-auto-save, non-revision posts.
	if ( wp_is_post_autosave( $post_id ) || wp_is_post_revision( $post_id ) ) {
		return;
	}

	$next_base   = defined( 'NEXT_APP_URL' ) ? NEXT_APP_URL : '';
	$secret      = defined( 'REVALIDATE_SECRET' ) ? REVALIDATE_SECRET : '';

	if ( empty( $next_base ) || empty( $secret ) ) {
		return;
	}

	wp_remote_post(
		trailingslashit( $next_base ) . 'api/revalidate',
		array(
			'body'    => wp_json_encode( array( 'secret' => $secret ) ),
			'headers' => array( 'Content-Type' => 'application/json' ),
			'timeout' => 5,
			'blocking' => false,
		)
	);
}

// -------------------------------------------------------------------------
// WPGraphQL — raise per-request result cap (default is 100)
// -------------------------------------------------------------------------
add_filter( 'graphql_connection_max_query_amount', function() {
	return 500;
} );

// -------------------------------------------------------------------------
// WPGraphQL — expose CPTs
// -------------------------------------------------------------------------
// The 'control' and 'place' CPTs are registered without show_in_graphql; patch them here.
// 'control-type' is already exposed (controlType / controlTypes).

add_filter( 'register_post_type_args', 'homecontrolapp_graphql_post_type_args', 10, 2 );
function homecontrolapp_graphql_post_type_args( $args, $post_type ) {
	if ( $post_type === 'control' ) {
		$args['show_in_graphql']     = true;
		$args['graphql_single_name'] = 'control';
		$args['graphql_plural_name'] = 'controls';
	}
	if ( $post_type === 'place' ) {
		$args['show_in_graphql']     = true;
		$args['graphql_single_name'] = 'place';
		$args['graphql_plural_name'] = 'places';
	}
	return $args;
}

// -------------------------------------------------------------------------
// Admin columns — control-type CPT
// -------------------------------------------------------------------------

add_filter( 'manage_control-type_posts_columns', 'homecontrolapp_control_type_columns' );
function homecontrolapp_control_type_columns( $columns ) {
	unset( $columns['date'] );
	$columns['control_type_type']    = 'Type';
	$columns['control_type_count']   = 'Controls';
	return $columns;
}

// Make Type and Class columns sortable.
add_filter( 'manage_edit-control-type_sortable_columns', 'homecontrolapp_control_type_sortable_columns' );
function homecontrolapp_control_type_sortable_columns( $columns ) {
	$columns['control_type_type']  = 'control_type_type';
	return $columns;
}

add_action( 'manage_control-type_posts_custom_column', 'homecontrolapp_control_type_column_values', 10, 2 );
function homecontrolapp_control_type_column_values( $column, $post_id ) {
	if ( $column === 'control_type_type' ) {
		echo esc_html( get_field( 'control_type_type', $post_id ) ?: '—' );
	} elseif ( $column === 'control_type_count' ) {
		$count = get_posts( array(
			'post_type'      => 'control',
			'posts_per_page' => -1,
			'fields'         => 'ids',
			'meta_query'     => array(
				array(
					'key'     => 'control_type',
					'value'   => $post_id,
					'compare' => '=',
					'type'    => 'NUMERIC',
				),
			),
		) );
		$n = count( $count );
		if ( $n > 0 ) {
			$url = add_query_arg( array(
				'post_type'           => 'control',
				'filter_control_type' => $post_id,
			), admin_url( 'edit.php' ) );
			printf( '<a href="%s">%d</a>', esc_url( $url ), $n );
		} else {
			echo '0';
		}
	}
}

// Filter dropdowns for control-type list.
add_action( 'restrict_manage_posts', 'homecontrolapp_control_type_filters' );
function homecontrolapp_control_type_filters( $post_type ) {
	if ( $post_type !== 'control-type' ) {
		return;
	}

	// Collect distinct Type values from existing posts.
	global $wpdb;
	$types = $wpdb->get_col(
		"SELECT DISTINCT meta_value FROM {$wpdb->postmeta}
		 WHERE meta_key = 'control_type_type' AND meta_value != ''
		 ORDER BY meta_value ASC"
	);
	$current_type = isset( $_GET['filter_ct_type'] ) ? sanitize_text_field( $_GET['filter_ct_type'] ) : '';
	echo '<select name="filter_ct_type">';
	echo '<option value="">All Types</option>';
	foreach ( $types as $t ) {
		printf(
			'<option value="%s"%s>%s</option>',
			esc_attr( $t ),
			selected( $current_type, $t, false ),
			esc_html( $t )
		);
	}
	echo '</select>';

	// Collect distinct Class values.
	$classes = $wpdb->get_col(
		"SELECT DISTINCT meta_value FROM {$wpdb->postmeta}
		 WHERE meta_key = 'control_type_class' AND meta_value != ''
		 ORDER BY meta_value ASC"
	);
	$current_class = isset( $_GET['filter_ct_class'] ) ? sanitize_text_field( $_GET['filter_ct_class'] ) : '';
	echo '<select name="filter_ct_class">';
	echo '<option value="">All Classes</option>';
	foreach ( $classes as $c ) {
		printf(
			'<option value="%s"%s>%s</option>',
			esc_attr( $c ),
			selected( $current_class, $c, false ),
			esc_html( $c )
		);
	}
	echo '</select>';
}

// Apply filters and custom sort for control-type.
add_action( 'pre_get_posts', 'homecontrolapp_control_type_query' );
function homecontrolapp_control_type_query( $query ) {
	if ( ! is_admin() || ! $query->is_main_query() ) {
		return;
	}
	if ( $query->get( 'post_type' ) !== 'control-type' ) {
		return;
	}

	$meta_query = array();

	if ( ! empty( $_GET['filter_ct_type'] ) ) {
		$meta_query[] = array(
			'key'     => 'control_type_type',
			'value'   => sanitize_text_field( $_GET['filter_ct_type'] ),
			'compare' => '=',
		);
	}

	if ( ! empty( $_GET['filter_ct_class'] ) ) {
		$meta_query[] = array(
			'key'     => 'control_type_class',
			'value'   => sanitize_text_field( $_GET['filter_ct_class'] ),
			'compare' => '=',
		);
	}

	if ( $meta_query ) {
		$query->set( 'meta_query', $meta_query );
	}

	$orderby = $query->get( 'orderby' );
	if ( in_array( $orderby, array( 'control_type_type', 'control_type_class' ), true ) ) {
		$query->set( 'meta_key', $orderby );
		$query->set( 'orderby', 'meta_value' );
	}
}

// -------------------------------------------------------------------------
// Admin columns — control CPT
// -------------------------------------------------------------------------

// IoX hub choices (value => label), matching the ACF select field definition.
function homecontrolapp_iox_choices() {
	return array(
		'0' => 'Control',
		'1' => 'Master',
		'2' => 'Rooms',
		'3' => 'Cinema',
		'4' => 'Exterior',
	);
}

add_filter( 'manage_control_posts_columns', 'homecontrolapp_control_columns' );
function homecontrolapp_control_columns( $columns ) {
	unset( $columns['date'] );
	$columns['control_isy']     = 'IoX';
	$columns['control_address'] = 'Address / Var ID';
	$columns['control_place']   = 'Location';
	$columns['control_type']    = 'Control Type';
	return $columns;
}

// Make IoX, Location, and Control Type columns sortable.
add_filter( 'manage_edit-control_sortable_columns', 'homecontrolapp_control_sortable_columns' );
function homecontrolapp_control_sortable_columns( $columns ) {
	$columns['control_isy']   = 'control_isy';
	$columns['control_place'] = 'control_place';
	$columns['control_type']  = 'control_type';
	return $columns;
}

add_action( 'manage_control_posts_custom_column', 'homecontrolapp_control_column_values', 10, 2 );
function homecontrolapp_control_column_values( $column, $post_id ) {
	switch ( $column ) {
		case 'control_isy':
			$val     = get_post_meta( $post_id, 'control_isy', true );
			$choices = homecontrolapp_iox_choices();
			echo esc_html( $choices[ $val ] ?? ( $val ?: '—' ) );
			break;
		case 'control_address':
			$address = get_field( 'control_address', $post_id )
				?: get_field( 'control_variable_id', $post_id )
				?: '—';
			echo esc_html( $address );
			break;
		case 'control_place':
			$place_id   = get_field( 'control_place', $post_id );
			$place_post = $place_id ? get_post( $place_id ) : null;
			echo esc_html( $place_post ? $place_post->post_title : '—' );
			break;
		case 'control_type':
			$type_id   = get_field( 'control_type', $post_id );
			$type_post = $type_id ? get_post( $type_id ) : null;
			echo esc_html( $type_post ? $type_post->post_title : '—' );
			break;
	}
}

// Filter dropdowns above the list table.
add_action( 'restrict_manage_posts', 'homecontrolapp_control_filters' );
function homecontrolapp_control_filters( $post_type ) {
	if ( $post_type !== 'control' ) {
		return;
	}

	// IoX filter.
	$current_iox = isset( $_GET['filter_control_isy'] ) ? sanitize_text_field( $_GET['filter_control_isy'] ) : '';
	echo '<select name="filter_control_isy">';
	echo '<option value="">All IoX Hubs</option>';
	foreach ( homecontrolapp_iox_choices() as $val => $label ) {
		printf(
			'<option value="%s"%s>%s</option>',
			esc_attr( $val ),
			selected( $current_iox, $val, false ),
			esc_html( $label )
		);
	}
	echo '</select>';

	// Location filter.
	$places = get_posts( array(
		'post_type'      => 'place',
		'posts_per_page' => -1,
		'orderby'        => 'title',
		'order'          => 'ASC',
		'post_status'    => 'publish',
	) );
	$current_place = isset( $_GET['filter_control_place'] ) ? absint( $_GET['filter_control_place'] ) : 0;
	echo '<select name="filter_control_place">';
	echo '<option value="">All Locations</option>';
	foreach ( $places as $p ) {
		printf(
			'<option value="%d"%s>%s</option>',
			$p->ID,
			selected( $current_place, $p->ID, false ),
			esc_html( $p->post_title )
		);
	}
	echo '</select>';

	// Control Type filter.
	$types = get_posts( array(
		'post_type'      => 'control-type',
		'posts_per_page' => -1,
		'orderby'        => 'title',
		'order'          => 'ASC',
		'post_status'    => 'publish',
	) );
	$current_type = isset( $_GET['filter_control_type'] ) ? absint( $_GET['filter_control_type'] ) : 0;
	echo '<select name="filter_control_type">';
	echo '<option value="">All Control Types</option>';
	foreach ( $types as $t ) {
		printf(
			'<option value="%d"%s>%s</option>',
			$t->ID,
			selected( $current_type, $t->ID, false ),
			esc_html( $t->post_title )
		);
	}
	echo '</select>';
}

// Apply filters and custom sort to the query.
add_action( 'pre_get_posts', 'homecontrolapp_control_query' );
function homecontrolapp_control_query( $query ) {
	if ( ! is_admin() || ! $query->is_main_query() ) {
		return;
	}
	if ( $query->get( 'post_type' ) !== 'control' ) {
		return;
	}

	$meta_query = array();

	// Filter: IoX hub.
	if ( isset( $_GET['filter_control_isy'] ) && $_GET['filter_control_isy'] !== '' ) {
		$meta_query[] = array(
			'key'     => 'control_isy',
			'value'   => sanitize_text_field( $_GET['filter_control_isy'] ),
			'compare' => '=',
		);
	}

	// Filter: Location.
	if ( ! empty( $_GET['filter_control_place'] ) ) {
		$meta_query[] = array(
			'key'     => 'control_place',
			'value'   => absint( $_GET['filter_control_place'] ),
			'compare' => '=',
			'type'    => 'NUMERIC',
		);
	}

	// Filter: Control Type.
	if ( ! empty( $_GET['filter_control_type'] ) ) {
		$meta_query[] = array(
			'key'     => 'control_type',
			'value'   => absint( $_GET['filter_control_type'] ),
			'compare' => '=',
			'type'    => 'NUMERIC',
		);
	}

	if ( $meta_query ) {
		$query->set( 'meta_query', $meta_query );
	}

	// Sort by meta value for IoX, Location, Control Type columns.
	$orderby = $query->get( 'orderby' );
	if ( in_array( $orderby, array( 'control_isy', 'control_place', 'control_type' ), true ) ) {
		$query->set( 'meta_key', $orderby );
		$query->set( 'orderby', 'meta_value' );
	}
}

// -------------------------------------------------------------------------
// HCA Settings — ACF Options page + field group for connection credentials
// -------------------------------------------------------------------------
// Registers an "HCA Settings" admin page where connection credentials
// (e.g. UniFi Protect host/user/pass) are stored as ACF Options fields.
// Next.js reads these server-side via GET /wp-json/hca/v1/settings.

if ( function_exists( 'acf_add_options_page' ) ) {
	acf_add_options_page(
		array(
			'page_title' => 'HCA Settings',
			'menu_title' => 'HCA Settings',
			'menu_slug'  => 'hca-settings',
			'capability' => 'manage_options',
			'redirect'   => false,
		)
	);
}

add_action( 'acf/include_fields', function () {
	if ( ! function_exists( 'acf_add_local_field_group' ) ) {
		return;
	}
	acf_add_local_field_group(
		array(
			'key'      => 'group_hca_settings',
			'title'    => 'HCA Settings',
			'fields'   => array(
				array(
					'key'          => 'field_unifi_protect_host',
					'label'        => 'UniFi Protect Host',
					'name'         => 'unifi_protect_host',
					'type'         => 'text',
					'instructions' => 'Must start with https://, e.g. https://192.168.1.141 — no port needed',
				),
				array(
					'key'   => 'field_unifi_protect_username',
					'label' => 'UniFi Username',
					'name'  => 'unifi_protect_username',
					'type'  => 'text',
				),
				array(
					'key'   => 'field_unifi_protect_password',
					'label' => 'UniFi Password',
					'name'  => 'unifi_protect_password',
					'type'  => 'password',
				),
				array(
					'key'          => 'field_unifi_api_key',
					'label'        => 'UniFi API Key',
					'name'         => 'unifi_api_key',
					'type'         => 'password',
					'instructions' => 'Optional — from UniFi Protect → System → API Tokens. If set, bypasses username/password (recommended).',
				),
			),
			'location' => array(
				array(
					array(
						'param'    => 'options_page',
						'operator' => '==',
						'value'    => 'hca-settings',
					),
				),
			),
		)
	);
} );

// -------------------------------------------------------------------------
// HCA auth — custom REST endpoint for Next.js credential verification
// -------------------------------------------------------------------------
// POST /wp-json/hca/v1/login
// Body: { username, password }
// Header: X-HCA-Internal-Key: <HCA_INTERNAL_KEY from wp-config.php>
//
// Called server-side from Next.js /api/auth/login — never directly by the browser.
// Returns { userId } on success, 401 on bad credentials, 403 if key is missing/wrong.

add_action( 'rest_api_init', function () {
	register_rest_route(
		'hca/v1',
		'/login',
		array(
			'methods'             => 'POST',
			'callback'            => 'homecontrolapp_rest_login',
			'permission_callback' => '__return_true',
		)
	);

	register_rest_route(
		'hca/v1',
		'/settings',
		array(
			'methods'             => 'GET',
			'callback'            => 'homecontrolapp_rest_settings',
			'permission_callback' => '__return_true',
		)
	);

	// WebAuthn credential storage (called server-side from Next.js, never by browser)
	register_rest_route(
		'hca/v1',
		'/webauthn/credentials',
		array(
			'methods'             => 'GET',
			'callback'            => 'homecontrolapp_webauthn_list',
			'permission_callback' => '__return_true',
		)
	);
	register_rest_route(
		'hca/v1',
		'/webauthn/credentials',
		array(
			'methods'             => 'POST',
			'callback'            => 'homecontrolapp_webauthn_store',
			'permission_callback' => '__return_true',
		)
	);
	register_rest_route(
		'hca/v1',
		'/webauthn/credentials/(?P<id>[^/]+)',
		array(
			'methods'             => array( 'PATCH', 'DELETE' ),
			'callback'            => 'homecontrolapp_webauthn_update_or_delete',
			'permission_callback' => '__return_true',
		)
	);
} );

function homecontrolapp_rest_settings( WP_REST_Request $req ) {
	$key = defined( 'HCA_INTERNAL_KEY' ) ? HCA_INTERNAL_KEY : '';
	if ( empty( $key ) || $req->get_header( 'X-HCA-Internal-Key' ) !== $key ) {
		return new WP_REST_Response( array( 'error' => 'Forbidden' ), 403 );
	}

	return new WP_REST_Response(
		array(
			'unifi_protect_host'     => (string) ( get_field( 'unifi_protect_host', 'option' ) ?? '' ),
			'unifi_protect_username' => (string) ( get_field( 'unifi_protect_username', 'option' ) ?? '' ),
			'unifi_protect_password' => (string) ( get_field( 'unifi_protect_password', 'option' ) ?? '' ),
			'unifi_api_key'          => (string) ( get_field( 'unifi_api_key', 'option' ) ?? '' ),
		),
		200
	);
}

function homecontrolapp_rest_login( WP_REST_Request $req ) {
	$key = defined( 'HCA_INTERNAL_KEY' ) ? HCA_INTERNAL_KEY : '';
	if ( empty( $key ) || $req->get_header( 'X-HCA-Internal-Key' ) !== $key ) {
		return new WP_REST_Response( array( 'error' => 'Forbidden' ), 403 );
	}

	$user = wp_authenticate(
		sanitize_user( (string) $req->get_param( 'username' ) ),
		(string) $req->get_param( 'password' )
	);

	if ( is_wp_error( $user ) ) {
		return new WP_REST_Response( array( 'error' => 'Invalid credentials' ), 401 );
	}

	return new WP_REST_Response( array( 'userId' => $user->ID ), 200 );
}

// -------------------------------------------------------------------------
// WebAuthn credential storage — server-side only (called by Next.js)
// -------------------------------------------------------------------------
// Credentials stored as WP user meta under 'hca_webauthn_credentials':
//   array of { id, publicKey, signCount, transports, name, userId, createdAt }
// All endpoints gated by X-HCA-Internal-Key.

function homecontrolapp_webauthn_check_key( WP_REST_Request $req ): bool {
	$key = defined( 'HCA_INTERNAL_KEY' ) ? HCA_INTERNAL_KEY : '';
	return ! empty( $key ) && $req->get_header( 'X-HCA-Internal-Key' ) === $key;
}

/** GET /wp-json/hca/v1/webauthn/credentials[?userId=X] */
function homecontrolapp_webauthn_list( WP_REST_Request $req ) {
	if ( ! homecontrolapp_webauthn_check_key( $req ) ) {
		return new WP_REST_Response( array( 'error' => 'Forbidden' ), 403 );
	}

	$user_id = (int) $req->get_param( 'userId' );

	if ( $user_id > 0 ) {
		$raw   = get_user_meta( $user_id, 'hca_webauthn_credentials', true );
		$creds = is_array( $raw ) ? $raw : array();
		return new WP_REST_Response( array_values( $creds ), 200 );
	}

	// No userId — return credentials for all users (used by login-options).
	$all   = array();
	$users = get_users( array( 'fields' => 'ID' ) );
	foreach ( $users as $uid ) {
		$raw   = get_user_meta( (int) $uid, 'hca_webauthn_credentials', true );
		$creds = is_array( $raw ) ? $raw : array();
		foreach ( $creds as $c ) {
			$all[] = $c;
		}
	}
	return new WP_REST_Response( array_values( $all ), 200 );
}

/** POST /wp-json/hca/v1/webauthn/credentials */
function homecontrolapp_webauthn_store( WP_REST_Request $req ) {
	if ( ! homecontrolapp_webauthn_check_key( $req ) ) {
		return new WP_REST_Response( array( 'error' => 'Forbidden' ), 403 );
	}

	$body = $req->get_json_params();
	if ( empty( $body['id'] ) || empty( $body['publicKey'] ) || empty( $body['userId'] ) ) {
		return new WP_REST_Response( array( 'error' => 'Missing required fields' ), 400 );
	}

	$user_id = (int) $body['userId'];
	$raw     = get_user_meta( $user_id, 'hca_webauthn_credentials', true );
	$creds   = is_array( $raw ) ? $raw : array();

	$creds[ $body['id'] ] = array(
		'id'         => (string) $body['id'],
		'publicKey'  => (string) $body['publicKey'],
		'signCount'  => (int) ( $body['signCount'] ?? 0 ),
		'transports' => (array) ( $body['transports'] ?? array() ),
		'name'       => sanitize_text_field( (string) ( $body['name'] ?? 'Passkey' ) ),
		'userId'     => $user_id,
		'createdAt'  => (int) ( $body['createdAt'] ?? time() ),
	);

	update_user_meta( $user_id, 'hca_webauthn_credentials', $creds );
	return new WP_REST_Response( array( 'ok' => true ), 201 );
}

/** PATCH|DELETE /wp-json/hca/v1/webauthn/credentials/{id} */
function homecontrolapp_webauthn_update_or_delete( WP_REST_Request $req ) {
	if ( ! homecontrolapp_webauthn_check_key( $req ) ) {
		return new WP_REST_Response( array( 'error' => 'Forbidden' ), 403 );
	}

	$cred_id = urldecode( (string) $req->get_param( 'id' ) );
	$method  = strtoupper( $req->get_method() );

	// Find which user owns this credential.
	$users = get_users( array( 'fields' => 'ID' ) );
	foreach ( $users as $uid ) {
		$raw   = get_user_meta( (int) $uid, 'hca_webauthn_credentials', true );
		$creds = is_array( $raw ) ? $raw : array();
		if ( ! isset( $creds[ $cred_id ] ) ) {
			continue;
		}

		if ( 'DELETE' === $method ) {
			unset( $creds[ $cred_id ] );
			update_user_meta( (int) $uid, 'hca_webauthn_credentials', $creds );
			return new WP_REST_Response( array( 'ok' => true ), 200 );
		}

		// PATCH — only signCount supported for now.
		$body = $req->get_json_params();
		if ( isset( $body['signCount'] ) ) {
			$creds[ $cred_id ]['signCount'] = (int) $body['signCount'];
			update_user_meta( (int) $uid, 'hca_webauthn_credentials', $creds );
		}
		return new WP_REST_Response( array( 'ok' => true ), 200 );
	}

	return new WP_REST_Response( array( 'error' => 'Credential not found' ), 404 );
}

// -------------------------------------------------------------------------
// User preferences — per-user server storage
// -------------------------------------------------------------------------
// GET  /wp-json/hca/v1/prefs?userId=X  — read hca_prefs user meta
// PUT  /wp-json/hca/v1/prefs           — write hca_prefs user meta
// Both gated by X-HCA-Internal-Key; called server-side from Next.js.

add_action( 'rest_api_init', function () {
	register_rest_route(
		'hca/v1',
		'/prefs',
		array(
			array(
				'methods'             => 'GET',
				'callback'            => 'homecontrolapp_prefs_get',
				'permission_callback' => '__return_true',
				'args'                => array(
					'userId' => array( 'required' => true, 'type' => 'integer' ),
				),
			),
			array(
				'methods'             => 'PUT',
				'callback'            => 'homecontrolapp_prefs_put',
				'permission_callback' => '__return_true',
			),
		)
	);
} );

function homecontrolapp_prefs_get( WP_REST_Request $req ) {
	$key = defined( 'HCA_INTERNAL_KEY' ) ? HCA_INTERNAL_KEY : '';
	if ( empty( $key ) || $req->get_header( 'X-HCA-Internal-Key' ) !== $key ) {
		return new WP_REST_Response( array( 'error' => 'Forbidden' ), 403 );
	}
	$user_id = (int) $req->get_param( 'userId' );
	$raw     = get_user_meta( $user_id, 'hca_prefs', true );
	$data    = $raw ? json_decode( $raw, true ) : null;
	return new WP_REST_Response( $data ?? new stdClass(), 200 );
}

function homecontrolapp_prefs_put( WP_REST_Request $req ) {
	$key = defined( 'HCA_INTERNAL_KEY' ) ? HCA_INTERNAL_KEY : '';
	if ( empty( $key ) || $req->get_header( 'X-HCA-Internal-Key' ) !== $key ) {
		return new WP_REST_Response( array( 'error' => 'Forbidden' ), 403 );
	}
	$body    = $req->get_json_params();
	$user_id = (int) ( $body['userId'] ?? 0 );
	if ( ! $user_id ) {
		return new WP_REST_Response( array( 'error' => 'Missing userId' ), 400 );
	}
	unset( $body['userId'] );
	update_user_meta( $user_id, 'hca_prefs', wp_json_encode( $body ) );
	return new WP_REST_Response( array( 'ok' => true ), 200 );
}

// -------------------------------------------------------------------------
// Page template support
// -------------------------------------------------------------------------
// The "App Shell" page template (page-app-shell.php) outputs the minimal HTML
// needed to mount the PWA. Assign it to the home page in WP admin.
