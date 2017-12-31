var http = require('http');
const log4js = require('log4js');
const exec = require('child_process').execSync;

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
    return exec(command).toString();
  }
  catch (error) {
    logger.error(error.message);
  }
}
