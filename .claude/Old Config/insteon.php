<?php
/**
 * A handy PHP class which allows communication with
 * Universal Device's ISY994i over their exposed REST
 * API.
 *
 * Primarily this class was created to interface with any
 * INSTEON product hooked up to the ISY994i. It does not support
 * all functionality of the REST interface, instead it's expanded
 * as the need for a feature arises.
 *
 * Copyright (c) 2015 Henric Andersson
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

class Insteon {
  private $sUser = null;
  private $sPass = null;
  private $sServer = "";

  private $DeviceTree = null;
  private $VarTree = null;
  private $PrgTree = null;

  /**
   * Initialize the INSTEON class
   *
   * @param sServer The name of the server (IP or DNS name)
   * @param sUser Username used to authenticate
   * @param sPass Password used to authenticate
   *
   * @note If you're using sessions, this call will also attempt
   *       to restore the various configuration data previously
   *       obtained to speed up performance. Thus it's highly 
   *       recommended to use this class after session_start()
   */
  public function init($sServer, $sUser, $sPass) {
    $this->sUser = $sUser;
    $this->sPass = $sPass;
    $this->sServer = $sServer;

    $this->DeviceTree = NULL;
    $this->VarTree = NULL;
    $this->PrgTree = NULL;

    // Try and load old data if we had a session
    $this->loadSession();
  }

  /**
   * Loads the stored device, variable and program tree from the session.
   */
  private function loadSession() {
    if (session_status() == PHP_SESSION_ACTIVE && isset($_SESSION["_insteon_class"])) {
      $this->DeviceTree = $_SESSION["_insteon_class"]["device"] != NULL ? simplexml_load_string($_SESSION["_insteon_class"]["device"]) : NULL;
      $this->VarTree = $_SESSION["_insteon_class"]["var"] != NULL ? array("Integer" => new SimpleXML($_SESSION["_insteon_class"]["var"]["Integer"]),
        "State"   => simplexml_load_string($_SESSION["_insteon_class"]["var"]["State"])) : NULL;
      $this->PrgTree = $_SESSION["_insteon_class"]["program"] != NULL ? simplexml_load_string($_SESSION["_insteon_class"]["program"]) : NULL;
    }
  }

  /**
   * Saves the in-memory version of device, variable and program tree into the active session (if any)
   */
  private function saveSession() {
    if (session_status() == PHP_SESSION_ACTIVE) {
      $_SESSION["_insteon_class"] = array("device" => $this->DeviceTree != NULL ? $this->DeviceTree->asXML() : NULL, 
        "var" => ($this->VarTree != NULL && $this->VarTree["Integer"] != NULL && $this->VarTree["State"] != NULL) ? array("Integer" => $this->VarTree["Integer"]->asXML(),
          "State" => $this->VarTree["State"]->asXML()) : NULL,
        "program" => $this->PrgTree != NULL ? $this->PrgTree->asXML() : NULL
        );
    }
  }

  /**
   * Loads the device tree from ISY994i (or returns the cached copy)
   *
   * @param bRefresh Forces a refresh of tree even if we have a cache
   *
   * @return The device tree
   */
  public function getDevices($bRefresh = false) {
    if ($bRefresh || $this->DeviceTree == null) {
      $this->DeviceTree = $this->rest("/rest/nodes/");
      $this->saveSession();
    }

    return $this->DeviceTree;
  }

  /**
   * Loads the program tree from ISY994i (or returns the cached copy)
   *
   * @param bRefresh Forces a refresh of tree even if we have a cache
   *
   * @return The program tree
   */
  public function getPrograms($bRefresh = false) {
    if ($bRefresh || $this->PrgTree == null) {
      $this->PrgTree = $this->rest("/rest/programs?subfolders=true");
      $this->saveSession();
    }

    return $this->PrgTree;
  }

  /**
   * Loads the variable tree from ISY994i (or returns the cached copy)
   *
   * @param bRefresh Forces a refresh of tree even if we have a cache
   *
   * @return A named array (Integer, State), both with their own tree of variables
   */
  public function getVariables($bRefresh = false) {
    if ($bRefresh || $this->VarTree == null) {
      $this->VarTree = array("Integer" => $this->rest("/rest/vars/definitions/1"),
                             "State" => $this->rest("/rest/vars/definitions/2"));
      $this->saveSession();
    }

    return $this->VarTree;
  }

  /**
   * Resolves a program name into the program id
   *
   * @param sName Name of the program
   * @return id of program or null
   */
  public function resolveProgramName($sName) {
    $tree = $this->getPrograms();

    foreach ($tree->program as $item) {
      if ($item->name == $sName) {
        return (String)$item->attributes()["id"];
      }
    }

    return null;
  }

  /**
   * Resolves a program id into the program name
   *
   * @param iID Id of the program
   * @return Name of program or null
   */
  public function resolveProgramId($iID) {
    $tree = $this->getPrograms();

    foreach ($tree->program as $item) {
      if (hexdec($item->attributes()["id"]) == intval($iID)) {
        return (String)$item->name;
      }
    }

    return null;
  }

  /**
   * Resolves a device address into a name
   *
   * @param sAddr The address of the device
   * @return The name or NULL if not found
   */
  public function resolveDeviceAddress($sAddr) {
    $tree = $this->getDevices();

    foreach ($tree->node as $item) {
      if (strval($item->address) == strval($sAddr))
        return (String)$item->name;
    }

    return null;
  }
  
  /**
   * Resolves a device name into an address
   *
   * @param sName The name of the device
   * @return The address or NULL if not found
   */
  public function resolveDeviceName($sName) {
    $tree = $this->getDevices();

    foreach ($tree->node as $item) {
      if ($item->name == $sName)
        return (String)$item->address;
    }

    return null;
  }

  /**
   * Resolves a scene's name into an address
   *
   * @param sName The name of the scene
   * @return The address or NULL if not found
   */
  public function resolveSceneName($sName) {
    $tree = $this->getDevices();

    foreach ($tree->group as $item) {
      if ($item->name == $sName)
        return (String)$item->address;
    }

    return null;
  }

  /**
   * Resolves state variable name into an id
   *
   * @param sName The name of the state variable
   * @return The id or NULL if not found
   */
  public function resolveStateName($sName) {
    return $this->resolveVariableName($sName, "State");
  }

  /**
   * Resolves integer variable name into an id
   *
   * @param sName The name of the integer variable
   * @param sType Allows to override default behavior and search other types
   * @return The id or NULL if not found
   */
  public function resolveVariableName($sName, $sType = "Integer") {
    $tree = $this->getVariables()[$sType];
    foreach ($tree->e as $item) {
      if ($item->attributes()->name == $sName)
        return (Integer)$item->attributes()->id;
    }

    return null;
  }

  /**
   * Resolves state variable id into an name
   *
   * @param iID The id of the state variable
   * @return The name or NULL if not found
   */
  public function resolveStateId($iID) {
    return $this->resolveVariableId($iID, "State");
  }
  
  /**
   * Resolves integer variable id into an name
   *
   * @param iID The id of the state variable
   * @param sType Allows to override default behavior and search other types
   * @return The name or NULL if not found
   */
  public function resolveVariableId($iID, $sType = "Integer") {
    $tree = $this->getVariables()[$sType];
    foreach ($tree->e as $item) {
      if (intval($item->attributes()->id) == $iID)
        return (String)$item->attributes()->name;
    }

    return null;
  }

  /**
   * Obtains the value of a regular varibale
   *
   * @param id The ID of the variable
   * @return The value of the variable
   */
  public function getVariableValue($id) {
    $data = $this->rest("/rest/vars/get/1/" . rawurlencode($id));
    return (Integer)$data->val;
  }

  /**
   * Sets the variable to a new value
   *
   * @param id The ID of the variable
   * @param value The new value
   * @return The value held by the variable (usually same as value)
   */
  public function setVariableValue($id, $value) {
    $value = intval($value);
    $data = $this->rest("/rest/vars/set/1/" . rawurlencode($id) . "/" . rawurlencode($value));
    return $this->getVariableValue($id);
  }

  /**
   * Sets the initial value of a variable. This value is assigned to the variable
   * if the ISY994i is rebooted.
   *
   * @param id The ID of the variable
   * @param value The new value
   * @return The value provided
   */
  public function setVariableInit($id, $value) {
    $value = intval($value);
    $data = $this->rest("/rest/vars/init/1/" . rawurlencode($id) . "/" . rawurlencode($value));
    return $value;
  }

  /**
   * Obtains the value of a state varibale
   *
   * @param id The ID of the state variable
   * @return The value of the state variable
   */
  public function getStateValue($id) {
    $data = $this->rest("/rest/vars/get/2/" . rawurlencode($id));
    return (Integer)$data->val;
  }

  /**
   * Sets the variable to a new value
   *
   * @param id The ID of the variable
   * @param value The new value
   * @return The value held by the variable (usually same as value)
   */
  public function setStateValue($id, $value) {
    $value = intval($value);
    $data = $this->rest("/rest/vars/set/2/" . rawurlencode($id) . "/" . rawurlencode($value));
    return $this->getStateValue($id);
  }

  /**
   * Sets the initial value of a variable. This value is assigned to the variable
   * if the ISY994i is rebooted.
   *
   * @param id The ID of the variable
   * @param value The new value
   * @return The value provided
   */
  public function setStateInit($id, $value) {
    $value = intval($value);
    $data = $this->rest("/rest/vars/init/2/" . rawurlencode($id) . "/" . rawurlencode($value));
    return $value;
  }

  /**
   * Forces the INSTEON device to send out an update on its state/status
   *
   * @param sAddr Address of device
   * @return true if successfully update, false if not
   *
   * @note This is a fairly expensive call and will not return immediately
   */
  public function refreshDeviceStatus($sAddr) {
    $data = $this->rest("/rest/query/" . rawurlencode($sAddr));
    if ( ((String)($data->attributes()->succeeded)) == "true")
      return true;
    return false;
  }

  /**
   * Returns the status of a device
   *
   * @param sAddr Address of the device
   * @param Returns the value held by device
   */
  public function getDeviceStatus($sAddr) {
    $data = $this->rest("/rest/status/" . rawurlencode($sAddr));
    if ( $data->property->count() != 0 ) {
      return $data->property->attributes()->value;
    } else {
      echo '<p>ERROR: Device with address \'' . $sAddr . '\' not found.</p>';
    }
  }

  /**
   * Obtains arbitrary property from a device
   *
   * @param sAddr Address of the device
   * @param sProp The property to retrieve (case-insensitive)
   * @return The value of said property (the formatted version) or null if not found
   */
  public function getDeviceProperty($sAddr, $sProp) {
    $data = $this->rest("/rest/nodes/" . rawurlencode($sAddr));
    foreach ($data->properties->property as $property) {
      if (strtolower($property->attributes()->id) == strtolower($sProp))
        return $property->attributes()->formatted;
    }
    return null;
  }

  /**
   * Sets an arbitrary property to an arbitrary value
   *
   * @param sAddr Address of the device
   * @param sProp The property to change
   * @param sValue The value to set
   * @return The raw XML
   *
   * @todo Have more sane return value
   */
  public function setDeviceProperty($sAddr, $sProp, $sValue) {
    $data = $this->rest("/rest/nodes/" . rawurlencode($sAddr) . "/set/" . rawurlencode($sProp) . "/" . rawurlencode($sValue));
    return $data;
  }

  /**
   * Obtain the last time a specific program was run
   *
   * @param id The ID of the program
   * @return Last time it ran (in unix time)
   */
  public function getProgramLastRun($id) {
    $data = $this->rest("/rest/programs/" . rawurlencode($id));
    return strtotime($data->program->lastFinishTime);
  }

  /**
   * Obtain the next time a specific program is scheduled to run
   *
   * @param id The ID of the program
   * @return Next time it will run (in unix time)
   */
  public function getProgramNextRun($id) {
    $data = $this->rest("/rest/programs/" . rawurlencode($id));
    return strtotime($data->program->nextScheduledRunTime);
  }

  /**
   * Execute a program's desired section
   *
   * @param id The ID of the program
   * @param cmd The section to execute
   */
  private function runProgram($id, $cmd) {
    $this->rest("/rest/programs/" . rawurlencode($id) . "/" . rawurlencode($cmd));
  }

  /**
   * Execute the IF section (and resulting then/else) of a program
   *
   * @param id The ID of the program
   */
  public function runIfProgram($id) {
    $this->runProgram($id, "run");
  }

  /**
   * Execute the THEN section of a program
   *
   * @param id The ID of the program
   */
  public function runThenProgram($id) {
    $this->runProgram($id, "runThen");
  }

  /**
   * Execute the ELSE section of a program
   *
   * @param id The ID of the program
   */
  public function runElseProgram($id) {
    $this->runProgram($id, "runElse");
  }

  /**
   * Obtains the values of the climate module
   *
   * @param id The ID of the state variable
   * @return The value of the state variable
   */
  public function getClimate() {
    $data = $this->rest("/rest/climate");
  //  $data = $this->rest("/rest/ns/5/nodes/n004_weather/status");
    return $data;
  }


  /**
   * This is a bit special, scenes can normally not be queried,
   * but we can make some assumptions. If ALL members are non-zero
   * then we assume that the scene is on, otherwise off.
   *
   * Subsequently, this function will only return true or false
   *
   * @param sAddr Address of SCENE to query
   * @return true if active, false if not
   */
  public function getSceneStatus($sAddr) {
    $isOn = false;

    // First, locate the scene
    $tree = $this->getDevices();
    foreach ($tree->group as $item) {
      if ($item->address == $sAddr) {
        // Found it! Now, query every device in this scene
        foreach ($item->members as $item) {
          foreach ($item as $link) {
            if ($this->getDeviceStatus($link) == 0)
              return false;
          }
        }
        return true;
      }
    }
    return false;
  }

  /**
   * Sets the status of the device
   *
   * @param sAddr The Address of the device
   * @param sValue One of the following:
   *               0-255 = Dim to this setting
   *               Off = Turn off (fast)
   *               On = Turn on (fast)
   *               Inc = - ~3%
   *               Dec = + ~3%
   *               BDim = Begin manual dim (disabled due to odd behaviors)
   *               EDim = End manual dim (disabled due to odd behaviors)
   *
   * @return SimpleXML object
   */
  public function setDeviceStatus($sAddr, $sCommand, $sParam) {
    $sCmd = "";
    switch (strtolower($sCommand)) {
      case "on":
        $sCmd = "DON";
        break;
      case "off":
        $sCmd = "DOF";
        break;
      case "inc":
        $sCmd = "BRT";
        break;
      case "dec":
        $sCmd = "DIM";
        break;
      case "heat":
        $sCmd = "CLISPH";
        break;
      case "cool":
        $sCmd = "CLISPC";
        break;
      case "bdim":
        $sCmd = "BMAN";
        return FALSE;
        break;
      case "edim":
        $sCmd = "SMAN";
        return FALSE;
        break;
      default:
        // Assume it's a numeric value
        $i = min(255, max(0, intval($sCommand)));
        $sCmd = "DON/" . $i;
        break;
    }
    $data = $this->rest("rest/nodes/" . rawurlencode($sAddr) . "/cmd/" . $sCmd);
    return $data;
  }

  /**
   * Set the status of a scene
   *
   * @param sAddr The address of the scene
   * @param sValue The new value of the scene
   *
   * @return SimpleXML object
   */
  public function setSceneStatus($sAddr, $sValue) {
    return $this->setDeviceStatus($sAddr, $sValue);
  }

  /**
   * Convenience function, this is the one doing the network talking.
   *
   * @param url The path to be requested using GET
   * @param secure If true, uses https instead of http
   * @return SimpleXML object or null on failure
   *
   * @note Check error.log for network issues
   */
  private function rest($url, $secure = false)
  {
    $url = ($secure ? "https://" : "http://") . $this->sServer . "/" . $url;
    $result = null;

    $reqParam = array(
      'http' => array(
        'ignore_errors' => true,
        'header' => 'Content-Type: text/xml; charset="utf-8"' . "\r\n",
      )
    );

    if ($this->sUser !== null && $this->sPass !== null) {
      $reqParam["http"]["header"] .= "Authorization: Basic " . base64_encode($this->sUser . ":" . $this->sPass) . "\r\n";
    }

    $ctx = stream_context_create($reqParam);
    $fp = fopen($url, "rb", false, $ctx);
    if ($fp !== false) {
      $result = stream_get_contents($fp);
      fclose($fp);

      if ($result === false) {
        error_log("GET $url failed");
        $result = null;
      } else {
        $result = simplexml_load_string($result);
        if ($result === null) {
          error_log("Received data was not XML");
        }
      }
    }
    return $result;
  }





  /**
   * Returns the status of a device
   *
   * @param sAddr Address of the device
   * @param Returns the value held by device
   */
  public function getZDeviceStatus($sAddr, $sPara) {
    $data = $this->rest("/rest/zwave/node/" . rawurlencode($sAddr) . "/config/query/" . rawurlencode($sPara));
print_r($data);
    if ( $data->property->count() != 0 ) {
      return $data->property->attributes()->value;
    } else {
      echo '<p>ERROR: Device with address \'' . $sAddr . '\' not found.</p>';
    }
  }





}
