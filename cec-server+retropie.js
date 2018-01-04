var http = require('http');
const log4js = require('log4js');
const { spawn, exec, execSync } = require('child_process');

log4js.configure(
  {
    appenders: {
      file: {
        type: 'file',
        filename: './logs/hdmicec.log',
        maxLogSize: 1 * 1024 * 1024, // = 1Mb
        numBackups: 3, // keep three backup files
      }
    },
    categories: {
      default: { appenders: ['file'], level: 'info' }
    }
  }
);
const logger = log4js.getLogger('tv');

const PORT = 7476;
var server = http.createServer(onRequest);
server.listen(PORT);
logger.info("The HDMI CEC controller has started");

function onRequest(request, response) {
  var command = request.headers['cec-command'];

  var msg = '';
  switch(command) {
    case "on":
      msg = 'echo "on 0" | cec-client RPI -s -d 1';
      execmd(msg);
      response.end(msg);
      break;
    case "off":
      msg = 'echo "standby 0" | cec-client RPI -s -d 1';
      execmd(msg);
      response.end(msg);
      break;
    case "1":
    case "2":
    case "3":
      msg = 'echo "tx 1F:82:'.concat(command, '0:00" | cec-client RPI -s -d 1');
      execmd(msg);
      response.end(msg);
      break;
    case "status":
      msg = 'echo "pow 0" | cec-client RPI -s -d 1';
      var state = getStatus(msg);
      response.setHeader("tv-status", state);
      response.end(msg);
      break;
    case "retro-on":
      msg = 'emulationstation | sudo tee /dev/tty1';
      if (retroStatus() == "off") {
        logger.info("executing cmd: ".concat(msg));
        exec('emulationstation | sudo tee /dev/tty1', {
          stdio: 'inherit'
        });

        var pre_cmd = 'echo "tx 1F:82:10:00" | cec-client RPI -s -d 1';
        systemExec(pre_cmd);
      }
      response.end(msg);
      break;
    case "retro-off":
      msg = 'killall emulationstation';
      if (retroStatus() == "on") {
        execmd(msg);
      }
      response.end(msg);
      break;
    case "retro-status":
      msg = 'checking emulationstation status';
      var state = retroStatus();
      response.setHeader("retro-status", state);
      response.end(msg);
      break;
    case "ps4-on":
      var device = request.headers['device'];
      msg = 'turning ps4 on'
      on(device);
      response.end(msg);
      break;
    case "ps4-off":
      var device = request.headers['device'];
      msg = 'turning ps4 off'
      off(device);
      response.end(msg);
      break;
    case "ps4-status":
      var device = request.headers['device'];
      msg = 'checking ps4 status'
      var state = getState(device);
      response.setHeader("status", state);
      response.end(msg);
      break;
    default:
      msg = 'unsupported command: '.concat(command);
      logger.error(msg);
      response.end(msg);
      break;
  }
}

function execmd(command) {
  var stdout = systemSync(command);
  if (stdout) {
    logger.info(`stdout: ${stdout}`);
  }
}

function getStatus(command) {
  var stdout = systemSync(command);
  if (stdout == null) return "off";

  logger.info(`stdout: ${stdout}`);
  var arrayOfLines = stdout.match(/[^\r\n]+/g);
  if (arrayOfLines.length != 2) return "off";
  if (arrayOfLines[1] == 'power status: on') return "on";
  return "off";
}

function systemSync(command) {
  logger.info("executing cmd: ".concat(command));
  try {
    return execSync(command).toString();
  }
  catch (error) {
    logger.error(error.message);
  }
}

function systemExec(command) {
  logger.info("executing cmd: ".concat(command));
  exec(command, (error, stdout, stderr) => {
    if (error) {
      logger.error(`exec error: ${error}`);
      return;
    }
    if (stdout) {
      logger.info(`stdout: ${stdout}`);
    }
    if (stderr) {
      logger.error(`stderr: ${stderr}`);
    }
  });
}

function retroStatus() {
  var command = 'ps aux | grep emulationstation | grep -v "grep" | wc -l';
  var stdout = systemSync(command);

  if (stdout == null) return "error";
  logger.info(`stdout: ${stdout}`);
  var arrayOfLines = stdout.match(/[^\r\n]+/g);
  if (isNaN(stdout)) return "error";

  var num = parseInt(stdout);
  if (num == 0) return "off";
  else if (num > 0) return "on";
  else return "error";
}

function on(device) {
  var command = 'echo "on '.concat(device, '" | cec-client RPI -s -d 1');
  var stdout = systemSync(command);
  if (stdout) {
    logger.info(`stdout: ${stdout}`);
  }
}

function off(device) {
  var command = 'echo "standby '.concat(device, '" | cec-client RPI -s -d 1');
  var stdout = systemSync(command);
  if (stdout) {
    logger.info(`stdout: ${stdout}`);
  }
}

function getState(device) {
  var command = 'echo "pow '.concat(device, '" | cec-client RPI -s -d 1');
  var stdout = systemSync(command);
  if (stdout == null) return "off";

  logger.info(`stdout: ${stdout}`);
  var arrayOfLines = stdout.match(/[^\r\n]+/g);
  if (arrayOfLines.length != 2) return "off";
  if (arrayOfLines[1] == 'power status: on') return "on";
  return "off";
}
