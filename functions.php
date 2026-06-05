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
// Page template support
// -------------------------------------------------------------------------
// The "App Shell" page template (page-app-shell.php) outputs the minimal HTML
// needed to mount the PWA. Assign it to the home page in WP admin.
