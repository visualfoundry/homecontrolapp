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

$next_url = defined( 'NEXT_APP_URL' ) && NEXT_APP_URL ? NEXT_APP_URL : 'http://localhost:3000';
wp_redirect( $next_url );
exit;
