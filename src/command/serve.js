import {Command, InvalidArgumentError} from "commander";

const serveCommand = new Command('serve');
serveCommand.option('-p | --port', 'Port to serve api on', (opt) => {
    if (!/^\d+$/.test(opt) || opt < 1 || opt > 65535) {
        throw new InvalidArgumentError('Port must be a number between 1 and 65535');
    }
    return parseInt(opt, 10);
}, 7676);
serveCommand.argument('<device>', 'Device name / path of the serial port.');
serveCommand.action((device, port) => {
    console.log(device);
    console.log(port);
});

export default serveCommand;
