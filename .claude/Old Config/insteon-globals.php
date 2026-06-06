<?php
//* ----------------------------------------------------------------------------------------------------
//* For Insteon REST API
//*
//* Set the globals and setup the REST Functions. Note: Downstream dependency is insteon.php:
//*  - https://github.com/jdbower/insteon
//*  - https://gist.github.com/mrworf/5be3684d619288aedc49
//*
//* UD Documentation on REST API:
//*  - https://wiki.universal-control_devices.com/index.php?title=ISY_Developers:API:REST_Interface
//*
//* Author: Greg Dixon
//* Date: Dec 2018
//*
//* ----------------------------------------------------------------------------------------------------



//* ----------------------------------------------------------------------------------------------------
//* Set the globals
//*
//* ----------------------------------------------------------------------------------------------------

global $isy_systems;
global $isy_house_status;
global $isy_variables;
global $isy_control_devices;
global $isy_thermostats;
global $cameras;
global $isy_controls;

$isy_systems		= insteon_initialize();
$isy_house_status	= get_house_status();
$isy_controls		= get_controls();

/*
$isy_variables		= get_variables();
$isy_control_devices		= get_control_devices();
$isy_thermostats	= get_thermostats();
$cameras			= get_cameras();
*/

function insteon_initialize () {

	// Set the master variables
	$isyUser = 'admin'; $isyPass = 'Pz%Fn3Mx#f';
	$isyServerControl	= '192.168.1.10:8080';
	$isyServerMaster	= '192.168.1.11:8080';
	$isyServerRooms		= '192.168.1.12:8080';
	$isyServerCinema	= '192.168.1.13:8080';
	$isyServerExterior	= '192.168.1.14:8080';

//	$isyServerControl	= 'homecontrol-control.dixons.net:8080';
//	$isyServerMaster	= 'homecontrol-primary.dixons.net:8080';
//	$isyServerRooms		= 'homecontrol-rooms.dixons.net:8080';
//	$isyServerCinema	= 'homecontrol-cinema.dixons.net:8080';
//	$isyServerExterior	= 'homecontrol-exterior.dixons.net:8080';

	$isy_set = array();
    
	$isy_set[0] = new Insteon(); $isy_set[0]->Init($isyServerControl, $isyUser, $isyPass);
	$isy_set[1] = new Insteon(); $isy_set[1]->Init($isyServerMaster, $isyUser, $isyPass);
	$isy_set[2] = new Insteon(); $isy_set[2]->Init($isyServerRooms, $isyUser, $isyPass);
	$isy_set[3] = new Insteon(); $isy_set[3]->Init($isyServerCinema, $isyUser, $isyPass);
	$isy_set[4] = new Insteon(); $isy_set[4]->Init($isyServerExterior, $isyUser, $isyPass);

	return $isy_set;

}

function get_house_status( ) {

	$statuses = get_posts(array(
		'posts_per_page'	=> -1,
		'meta_key'			=> 'status_variable_value',
		'orderby'			=> 'meta_value',
		'order'				=> 'ASC',
		'post_type'			=> 'house_status'
	));
	$return_array = array();

	$status_isy = 0;
	$status_variable_id = 20;

	foreach ( $statuses as $status ) {

		$return_array[] = array(
			'ID'						=> $status->ID,
			'control_title'				=> $status->post_title,
			'control_isy'				=> $status_isy,
			'control_variable_id'		=> $status_variable_id,
			'status_variable_value'		=> $status->status_variable_value,
			'status_class'				=> $status->status_class,
			'status_image_color'		=> $status->status_image_color
		);

	}

	return $return_array;

	/*
		$status_array = array();
		if ( have_rows( 'house_status_settings', $status->ID ) ) {
			while( have_rows( 'house_status_settings', $status->ID ) ): the_row();
				$status_array[] = array (
					'house_status_option_setting'	=> get_sub_field('house_status_option_setting'),
					'house_status_option_label'		=> get_sub_field('house_status_option_label'),
					'house_status_option_image'		=> get_sub_field('house_status_option_image'),
					'house_status_option_color'		=> get_sub_field('house_status_option_color')
				);
			endwhile;
		}
		$return_array[$status->post_title] = array(
			'variable_type'				=> $control->variable_type,
			'house_status_isy'			=> $status->house_status_isy,
			'house_status_variable'		=> $status->house_status_variable,
			'house_status_settings'		=> $status_array
		);
	*/

}

function get_controls( ) {

	$controls = get_posts(array(
		'posts_per_page'=> -1,
		'post_type'		=> 'controls',
		'orderby'		=> 'title',
		'order'			=> 'ASC'
	));
	$return_array = array();

	foreach ( $controls as $control ) {
		// $control_array = array();
		// $displayIcon = get_field('variable_type_icon', $control->variable_type_id);

		$type_id			= $control->control_type;
		$icon_id			= get_field('control_type_icon', $type_id);
		$icon_battery_id	= get_field('control_type_icon_lowbattery', $type_id);
		$icon_heartbeat_id	= get_field('control_type_icon_noheartbeat', $type_id);

		$return_array[] = array(

			// Post Type 'controls'
			'ID'						=> $control->ID,
			'control_title'				=> $control->post_title,
			'control_isy'				=> $control->control_isy,
			'control_isy_control_type'	=> $control->control_isy_control_type,
			'control_address'			=> $control->control_address,
			'control_variable_id'		=> $control->control_variable_id,
			'control_variable_init'		=> $control->control_variable_init,
			'control_variable_value'	=> $control->control_variable_value,
			'control_parent'			=> $control->control_parent,
			'control_subordinate_embed'	=> $control->control_subordinate_embed,
			'control_confirm'			=> $control->control_confirm,
			'battery_check_display_order' => ($control->control_battery_check_order?$control->control_battery_check_order:0),

			// Post Type 'places'
			'control_place'			=> get_the_title($control->control_place),

			// Post Type 'control_types'
			'control_type_title'					=> get_the_title($type_id),
			'control_type_class'					=> get_field('control_type_class', $type_id),
			'control_type_type'						=> get_field('control_type_type', $type_id),
			'control_type_method'					=> get_field('control_type_method', $type_id),
			'control_type_address_id_onoff_status'	=> get_field('control_type_address_id_onoff_status', $type_id),
			'control_type_address_id_dimmer_min'	=> get_field('control_type_address_id_dimmer_min', $type_id),
			'control_type_address_id_dimmer_max'	=> get_field('control_type_address_id_dimmer_max', $type_id),
			'control_type_address_id_dimmer_step'	=> get_field('control_type_address_id_dimmer_step', $type_id),
			'control_type_address_id_lowbattery'	=> get_field('control_type_address_id_lowbattery', $type_id),
			'control_type_address_id_heartbeat'		=> get_field('control_type_address_id_heartbeat', $type_id),
			'control_type_countdown_time'			=> get_field('control_type_countdown_time', $type_id),

			// Post Type 'icons'
			'icon_title'			=> get_the_title($icon_id),
			'icon_class_primary'	=> get_field('icon_class_primary', $icon_id),
			'icon_class_secondary'	=> get_field('icon_class_secondary', $icon_id),

			// Post Type 'icons' battery
			'icon_title_lowbattery'				=> get_the_title($icon_battery_id),
			'icon_class_lowbattery_primary'		=> get_field('icon_class_primary', $icon_battery_id),
			'icon_class_lowbattery_secondary'	=> get_field('icon_class_secondary', $icon_battery_id),

			// Post Type 'icons' heartbeat
			'icon_title_noheartbeat'			=> get_the_title($icon_battery_id),
			'icon_title_noheartbeat_primary'	=> get_field('icon_class_primary', $icon_battery_id),
			'icon_title_noheartbeat_secondary'	=> get_field('icon_class_secondary', $icon_battery_id),

		);

	}
    
	return $return_array;

}

function get_thermostats( ) {
	/*
	$thermostats = get_posts(array(
		'posts_per_page'=> -1,
		'post_type'		=> 'thermostats',
		'orderby'		=> 'title',
		'order'			=> 'ASC'
	));
	$return_array = array();

	foreach ( $thermostats as $thermostat ) {
		$return_array[] = array(
			'ID'				=> $thermostat->ID,
			'thermostat_name'	=> $thermostat->post_title,
			'thermostat_isy'	=> $thermostat->thermostat_isy,
			'thermostat_id'		=> $thermostat->thermostat_id
		);
	}

	return $return_array;
	*/
}


function get_masters( ) {
	/*
	$masters = get_posts(array(
		'posts_per_page'=> -1,
		'post_type'		=> 'master_variables',
		'orderby'		=> 'title',
		'order'			=> 'ASC'
	));
	$return_array = array();

	foreach ( $masters as $master ) {
		$master_array = array();
		if ( have_rows( 'light_programs', $master->ID ) ) {
			while( have_rows( 'light_programs', $master->ID ) ): the_row();
				$master_array[] = get_sub_field('light_program');
			endwhile;
		}
		$return_array[] = array(
			'ID'					=> $master->ID,
			'master_name'			=> $master->post_title,
			'master_variable_id'	=> $master->master_variable_id
		);
	}

	return $return_array;
	*/
}

function get_variables( ) {
	/*
	$controls = get_posts(array(
		'posts_per_page'=> -1,
		'post_type'		=> 'control_variables',
		'orderby'		=> 'title',
		'order'			=> 'ASC'
	));
	$return_array = array();

	foreach ( $controls as $control ) {
		$control_array = array();
		if ( have_rows( 'light_programs', $control->ID ) ) {
			while( have_rows( 'light_programs', $control->ID ) ): the_row();
				$control_array[] = get_sub_field('light_program');
			endwhile;
		}
		$displayControl = get_field('variable_type_icon', $control->variable_type_id);
		$return_array[] = array(
			'ID'						=> $control->ID,
			'variable_title'			=> $control->post_title,
			'variable_role'				=> $control->variable_role,
			'variable_type'				=> $control->variable_type,
			'variable_group'			=> $control->variable_group,
			'location_name'				=> $control->post_title,
			'automation_isy'			=> $control->automation_isy,
			'automation_variable'		=> $control->automation_variable,
			'device_parent_id'			=> $control->device_parent_id,
			'variable_type_id'			=> $control->variable_type_id,
			'motion_override_variable'	=> $control->motion_override_variable,
			'dnd_isy'					=> $control->dnd_isy,
			'dnd_variable'				=> $control->dnd_variable,
			'light_isy'					=> $control->light_isy,
			'light_variable'			=> $control->light_variable,
			'light_programs'			=> $control_array,
			'light_icon_off'			=> $control->light_icon_switch_off,
			'light_icon_on'				=> $control->light_icon_switch_on,
			'control_type_class'		=> get_field('control_type_class', $control->variable_type_id),
			'control_type_icon'		=> get_field('control_type_icon', $control->variable_type_id),
			'icon_class_primary'		=> get_field('icon_class_primary', $displayControl),
			'icon_class_secondary'	=> get_field('icon_class_secondary', $displayControl),
		);
	}

	return $return_array;
	*/
}

function get_control_devices( ) {
	/*
	$control_devices = get_posts(array(
		'posts_per_page'=> -1,
		'post_type'		=> 'control_devices',
		'meta_key'		=> 'device_room',
		'orderby'		=> 'meta_value',
		'order'			=> 'ASC'
	));
	$return_array = array();

	foreach ( $control_devices as $device ) {
		$displayControl = get_field('device_type_icon', $device->device_type_id);
		$return_array[] = array(
			'ID'				=> $device->ID,
			'device_role'		=> $device->device_role,
			'device_type_id'	=> $device->device_type_id,
			'device_isy'		=> $device->device_isy,
			'device_address'	=> $device->device_address,
			'device_parent_id'	=> $device->device_parent_id,
			'device_child_id'	=> $device->device_child_id,
			'device_title'		=> $device->post_title,
			'device_location'	=> $device->device_location,
			'device_type'		=> $device->device_type,
			'device_description'	=> $device->device_description,
			'device_type_class'					=> get_field('device_type_class', $device->device_type_id), 
			'device_type_display'				=> get_field('device_type_display', $device->device_type_id),
			'device_type_battery'				=> get_field('device_type_battery', $device->device_type_id),
			'icon_class_primary'		=> get_field('icon_class_primary', $displayControl),
			'icon_class_secondary'	=> get_field('icon_class_secondary', $displayControl),
			// special attributes
			'device_type_countdown_time'		=> get_field('device_type_countdown_time', $device->device_type_id),
			'device_type_dimmer_min'		=> get_field('device_type_dimmer_min', $device->device_type_id),
			'device_type_dimmer_max'		=> get_field('device_type_dimmer_max', $device->device_type_id),
			'device_type_dimmer_step'		=> get_field('device_type_dimmer_step', $device->device_type_id),

		);
	}

	return $return_array;
	*/
}

function get_cameras( ) {
	/*
	$cameras = get_posts(array(
		'posts_per_page'=> -1,
		'post_type'		=> 'cameras',
		'orderby'		=> 'title',
		'order'			=> 'ASC'
	));
	$return_array = array();

	foreach ( $cameras as $camera ) {
		$return_array[] = array(
			'ID'				=> $camera->ID,
			'camera_name'		=> $camera->post_title,
			'camera_location'	=> $camera->camera_location,
			'camera_type'		=> $camera->camera_type,
			'camera_ip_address'	=> $camera->camera_ip_address,
			'camera_port_no'	=> $camera->camera_port_no,
			'camera_user_id'	=> $camera->camera_user_id,
			'camera_password'	=> $camera->camera_password
		);
	}

	return $return_array;
	*/
}

//* ----------------------------------------------------------------------------------------------------
//* Hardware validation and correction functions
//*
//* ----------------------------------------------------------------------------------------------------

function device_correction( $isyID, $isyAddr ) {

	$isy_control = $GLOBALS['isy_systems'];

	$expectedState = $isy_control[$isyID]->getDeviceStatus($isyAddr);
	$queryState = $isy_control[$isyID]->refreshDeviceStatus($isyAddr);

	switch ($expectedState) {
		case 255: $sCmd = "on"; break;
		case 0: $sCmd = "off"; break;
		default: $sCmd = $expectedState; break;
	}

	$i = 1;
	while ( intval($expectedState) != intval($queryState) ) {

		echo 'Device ' . $isyAddr . ' expected state: ' . $expectedState . ', actual state: ' . $queryState . '<br />';

		$tryState = $isy_control[$isyID]->setDeviceStatus($isyAddr, $sCmd, $expectedState);
		sleep(5);
		$queryState = $isy_control[$isyID]->refreshDeviceStatus($isyAddr);

		$i++; if ($i> 2) break;

	}
	echo 'Device ' . $isyAddr . ' expected state: ' . $expectedState . ', actual state: ' . $queryState . '<br />';

}


//* ----------------------------------------------------------------------------------------------------
//* AJAX Functions
//*
//* ----------------------------------------------------------------------------------------------------

add_action( 'wp_ajax_insteon_set_variable', 'insteon_set_variable' );
add_action( 'wp_ajax_nopriv_insteon_set_variable', 'insteon_set_variable' );

function insteon_set_variable() {

	$isyID	= intval( $_POST['isyID'] );
	$varID	= intval( $_POST['varID'] );
	$varVal	= intval( $_POST['varVal'] );
	$doInit	= intval( $_POST['doInit'] );

	$isy_control = $GLOBALS['isy_systems'];
	$control_vars = $GLOBALS['isy_variables'];

	if ( $varVal == 20 ) {
		// this is the garage door open command. Let's make sure security is off before we command this
		$security_state = 1;
		foreach ($control_vars as $control_var ) {
			if ( $control_var['location_name'] == 'House Security' ) $security_state = $isy_control[$control_var['automation_isy']]->getStateValue($control_var['automation_variable']);
		}
		if ($security_state==1) {
			echo 'Security On';
			wp_die();
		}
	}
	if ($doInit) $return_result = $isy_control[$isyID]->setStateInit( $varID, $varVal );
	$return_result = $isy_control[$isyID]->setStateValue( $varID, $varVal );
	echo 'Set Variable: $isyID : ' . $isyID . ' varID: ' . $varID . ' varVal: ' . $varVal . ', ISY returned val of ' . $return_result;

	wp_die();

}
add_action( 'wp_ajax_insteon_set_slider', 'insteon_set_slider' );
add_action( 'wp_ajax_nopriv_insteon_set_slider', 'insteon_set_slider' );

function insteon_set_slider() {

	$controlLabel	= $_POST['controlLabel'];
	$isyID			= intval( $_POST['isyID'] );
	$varVal			= intval( $_POST['varVal'] );

	$isy_control = $GLOBALS['isy_systems'];
	$control_vars = $GLOBALS['isy_variables'];

	foreach ( $control_vars as $control_var ) {
		if ( format_control_name($control_var['location_name']) == $controlLabel ) {
			$isy_control[$isyID]->runThenProgram($control_var['light_programs'][$varVal]);
			echo 'Set Slider: isyID: ' . $isyID . ' varVal: ' . $varVal . ', ISY program "' . $control_var['light_programs'][$varVal] . '"';
		}
	}

	wp_die();

}

add_action( 'wp_ajax_insteon_get_variable_status', 'insteon_get_variable_status' );
add_action( 'wp_ajax_nopriv_insteon_get_variable_status', 'insteon_get_variable_status' );

function insteon_get_variable_status() {

	$isyID			= intval( $_POST['isyID'] );
	$varID			= intval( $_POST['varID'] );

	$isy_control = $GLOBALS['isy_systems'];

	echo $isy_control[$isyID]->getStateValue($varID);

	wp_die();

}

add_action( 'wp_ajax_insteon_get_thermostat_status', 'insteon_get_thermostat_status' );
add_action( 'wp_ajax_nopriv_insteon_get_thermostat_status', 'insteon_get_thermostat_status' );

function insteon_get_thermostat_status() {

	$isyID			= intval( $_POST['isyID'] );
	$varID			= $_POST['varID'];

	$isy_control = $GLOBALS['isy_systems'];

	$current_temperature	= $isy_control[$isyID]->getDeviceProperty($varID, 'ST')[0];
	if (substr($current_temperature, 3,1) == 5 ) {
		$current_temperature = substr($current_temperature, 0, 2);
		$current_temperature = $current_temperature +1;
	} else {
		$current_temperature = substr($current_temperature, 0, 2);
	}

	$current_status = $isy_control[$isyID]->getDeviceProperty($varID, 'CLIHCS')[0];
	$current_threshold_cool	= substr($isy_control[$isyID]->getDeviceProperty($varID, 'CLISPH')[0], 0, 2);
	$current_threshold_heat	= substr($isy_control[$isyID]->getDeviceProperty($varID, 'CLISPC')[0], 0, 2);

	echo json_encode( array( "current_status" => $current_status, "current_temperature" => $current_temperature, "current_threshold_cool" => $current_threshold_cool, "current_threshold_heat" => $current_threshold_heat ));

	wp_die();

}

add_action( 'wp_ajax_insteon_set_thermostat_range', 'insteon_set_thermostat_range' );
add_action( 'wp_ajax_nopriv_insteon_set_thermostat_range', 'insteon_set_thermostat_range' );

function insteon_set_thermostat_range() {

	$isyID			= intval( $_POST['isyID'] );
	$isyAddr		= $_POST['isyAddr'];
	$varVal			= $_POST['varVal'];

	$isy_control = $GLOBALS['isy_systems'];

	$new_temperature_heat = intval(substr( $varVal, 0, 2 ))*2;
	$new_temperature_cool = intval(substr( $varVal, 3, 2 ))*2;

	$set_temperature_heat = $isy_control[$isyID]->setDeviceStatus($isyAddr, 'heat', $new_temperature_heat);
	$set_temperature_cool = $isy_control[$isyID]->setDeviceStatus($isyAddr, 'cool', $new_temperature_cool);

	echo 'New temperature range: ' . $new_temperature_heat/2 . ' to ' . $new_temperature_cool/2;

	wp_die();

}

add_action( 'wp_ajax_insteon_requery', 'insteon_requery' );
add_action( 'wp_ajax_nopriv_insteon_requery', 'insteon_requery' );

function insteon_requery() {


	$isyID			= intval( $_POST['isyID'] );
	$isyAddr		= $_POST['isyAddr'];

	$isy_control = $GLOBALS['isy_systems'];

	$return = $isy_control[$isyID]->refreshDeviceStatus($isyAddr);

	echo 'ISY returned: ' . $return;

	wp_die();

}

add_action( 'wp_ajax_dash_weather_status', 'dash_weather_status' );
add_action( 'wp_ajax_nopriv_dash_weather_status', 'dash_weather_status' );

function dash_weather_status() {

	/*
	$isyID			= intval( $_POST['isyID'] );
	$varID			= $_POST['varID'];
	$varVal			= $_POST['varVal'];

	$isy_control = $GLOBALS['isy_systems'];

	$new_temperature_heat = intval(substr( $varVal, 0, 2 ))*2;
	$new_temperature_cool = intval(substr( $varVal, 3, 2 ))*2;

	$set_temperature_heat = $isy_control[$isyID]->setDeviceStatus($varID, 'heat', $new_temperature_heat);
	$set_temperature_cool = $isy_control[$isyID]->setDeviceStatus($varID, 'cool', $new_temperature_cool);

	echo 'New temperature range: ' . $set_temperature_heat . ' to ' . $set_temperature_cool;
	*/
	wp_die();

}


add_action( 'wp_ajax_insteon_get_device_val', 'insteon_get_device_val' );
add_action( 'wp_ajax_nopriv_insteon_get_device_val', 'insteon_get_device_val' );

function insteon_get_device_val() {

	$isyID	= intval( $_POST['isyID'] );
	$isyAddr= $_POST['isyAddr'];

	$isy_control = $GLOBALS['isy_systems'];

	$return_result = $isy_control[$isyID]->getDeviceStatus($isyAddr);

	//echo '$isyID : ' . $isyID . ' isyAddr: ' . $isyAddr . ', ISY returned val of ' . $return_result;
	echo $return_result;

	wp_die();

}

add_action( 'wp_ajax_insteon_set_device_val', 'insteon_set_device_val' );
add_action( 'wp_ajax_nopriv_insteon_set_device_val', 'insteon_set_device_val' );

function insteon_set_device_val() {

	$isyID	= intval( $_POST['isyID'] );
	$isyAddr	= $_POST['isyAddr'];
	$varVal	= intval( $_POST['varVal'] );

	$isy_control = $GLOBALS['isy_systems'];

	switch ($varVal) {
		case 255: $sCmd = "on"; break;
		case 0: $sCmd = "off"; break;
		default: $sCmd = $varVal; break;
	}

	$return_result = $isy_control[$isyID]->setDeviceStatus($isyAddr, $sCmd, $varVal);

	echo '$isyID: ' . $isyID . ' isyAddr: ' . $isyAddr . ' sCmd: ' . $sCmd . ' varVal: ' . $varVal . ', ISY returned val of ' . $return_result;

	wp_die();

}

add_action( 'wp_ajax_zwave_get_device_val', 'zwave_get_device_val' );
add_action( 'wp_ajax_nopriv_zwave_get_device_val', 'zwave_get_device_val' );

function zwave_get_device_val() {

	$isyID	= intval( $_POST['isyID'] );
	$zAddr = $_POST['zAddr'];
	$zPara = $_POST['zPara'];

	$isy_control = $GLOBALS['isy_systems'];

	$return_result = $isy_control[$isyID]->getZDeviceStatus($zAddr, $zPara);

	//echo '$isyID : ' . $isyID . ' isyAddr: ' . $isyAddr . ', ISY returned val of ' . $return_result;
	echo $return_result;

	wp_die();

}

