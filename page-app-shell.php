<?php
/**
 * Template Name: App Shell
 *
 * Redirects to the Next.js Home Control app.
 * Assign this template to the site's home page in WP Admin.
 *
 * Authentication is handled entirely by Next.js — the login form
 * at the Next.js URL verifies credentials against WordPress server-side.
 *
 * @package HomeControlApp
 */

// Browsers need the app's public address. NEXT_APP_URL can be a server-side
// address (e.g. http://localhost:3000, used for the revalidate/revoke calls),
// so NEXT_APP_PUBLIC_URL overrides it for this redirect when defined.
if ( defined( 'NEXT_APP_PUBLIC_URL' ) && NEXT_APP_PUBLIC_URL ) {
	$next_url = NEXT_APP_PUBLIC_URL;
} elseif ( defined( 'NEXT_APP_URL' ) && NEXT_APP_URL ) {
	$next_url = NEXT_APP_URL;
} else {
	$next_url = 'http://localhost:3000';
}
wp_redirect( $next_url );
exit;
