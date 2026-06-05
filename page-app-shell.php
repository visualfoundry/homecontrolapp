<?php
/**
 * Template Name: App Shell
 *
 * Outputs a minimal HTML page that mounts the Home Control PWA.
 * Assign this template to the site's home page in WP Admin.
 *
 * The React/Next.js app mounts into #hca-root. All device data
 * comes from the home-control REST service via SSE; config comes
 * from WPGraphQL at build/ISR time — neither is fetched here.
 *
 * @package HomeControlApp
 */

// Prevent Genesis from rendering its own header/footer/loop.
add_filter( 'genesis_pre_get_option_site_layout', '__genesis_return_full_width_content' );
remove_action( 'genesis_loop', 'genesis_do_loop' );

add_action( 'genesis_loop', 'homecontrolapp_pwa_root' );
function homecontrolapp_pwa_root() {
	?>
	<div id="hca-root" class="hca-app" data-theme="light">
		<div id="hca-overlay-host" class="hca-overlay-host"></div>
		<noscript>
			<p style="padding:2rem;color:#1A1917;">
				<?php esc_html_e( 'JavaScript is required to run the Home Control app.', 'homecontrolapp' ); ?>
			</p>
		</noscript>
	</div>
	<?php
}

genesis();
