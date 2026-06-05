<?php
/**
 * Theme constants — Home Control App
 *
 * Add these to wp-config.php (or a local-config.php not committed to source
 * control) for the revalidation webhook to function:
 *
 *   define( 'NEXT_APP_URL',       'https://your-next-app.example.com' );
 *   define( 'REVALIDATE_SECRET',  'a-long-random-secret-string' );
 *
 * The NEXT_APP_URL must match the Next.js app's base URL.
 * The REVALIDATE_SECRET must match REVALIDATE_SECRET in the Next.js .env.
 *
 * @package HomeControlApp
 */

if ( ! defined( 'NEXT_APP_URL' ) ) {
	define( 'NEXT_APP_URL', '' );
}

if ( ! defined( 'REVALIDATE_SECRET' ) ) {
	define( 'REVALIDATE_SECRET', '' );
}
