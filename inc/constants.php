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
 * Wi-Fi presence reads the client list from the console running UniFi Network —
 * the gateway, not the NVR that runs Protect:
 *
 *   define( 'UNIFI_NETWORK_HOST',    'https://192.168.1.1' );
 *   define( 'UNIFI_NETWORK_API_KEY', 'the-key-from-the-gateway' );
 *
 * It must be an API key created on that console (Settings → Control Plane →
 * Integrations). A password login is refused when the account has MFA, and a
 * Protect token is not accepted by Network.
 *
 * @package HomeControlApp
 */

if ( ! defined( 'NEXT_APP_URL' ) ) {
	define( 'NEXT_APP_URL', '' );
}

if ( ! defined( 'REVALIDATE_SECRET' ) ) {
	define( 'REVALIDATE_SECRET', '' );
}

if ( ! defined( 'UNIFI_NETWORK_HOST' ) ) {
	define( 'UNIFI_NETWORK_HOST', '' );
}

if ( ! defined( 'UNIFI_NETWORK_API_KEY' ) ) {
	define( 'UNIFI_NETWORK_API_KEY', '' );
}
