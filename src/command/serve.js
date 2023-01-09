import {Command, InvalidArgumentError} from "commander";
import {Server} from "node:http";
import {Display} from "../display.js";

/** @type {Display} */
let display = null;

function simpleResponse(fn) {
    return (req, res) => {
        if (!display) {
            res.statusCode = 503;
            return;
        }

        try {
            let body = fn();
            res.statusCode = 200;
            if (typeof body === 'string') {
                res.setHeader('Content-length', body.length);
                res.write(body);
            }
        } catch (e) {
            console.log(e);
            res.statusCode = 500;
        }
    };
}

function displayImageRequest(req, res, parameters) {
    if (!display) {
        res.statusCode = 503;
        return;
    }
    parameters.x = parseInt(parameters.x, 10);
    parameters.y = parseInt(parameters.y, 10);
    if (isNaN(parameters.x) || isNaN(parameters.y)){
        res.statusCode=400;
        return;
    }

    const imageType = req.headers['content-type'] || '';
    if (['image/png', 'image/jpeg'].indexOf(imageType) === -1) {
        res.statusCode = 501;
        res.write(JSON.stringify({error: 'Content-type required and must be image/png or image/jpeg'}));
        return;
    }

    let imageData = null;
    req.on('data', (chunk) => {
        if (imageData) {
            imageData = Buffer.concat([imageData, chunk]);
        } else {
            imageData = chunk;
        }
    });
    req.on('end', async () => {
        const orientation = parameters.orientation === 'landscape' ? Display.Orientation.Landscape : Display.Orientation.Portrait;
        await display.setOrientation(orientation);
        await display.displayBitmap(parameters.x, parameters.y, imageType, imageData);
    });
}

const serveCommand = new Command('serve');
serveCommand.option('-p | --port', 'Port to serve api on', (opt) => {
    if (!/^\d+$/.test(opt) || opt < 1 || opt > 65535) {
        throw new InvalidArgumentError('Port must be a number between 1 and 65535');
    }
    return parseInt(opt, 10);
}, 7676);
serveCommand.argument('<device>', 'Device name / path of the serial port.');
serveCommand.action((device, options) => {
    display = new Display(device);
    const s = new Server((req, res) => {
        const routeTable = {
            'GET': [
                {path: '/version', callback: simpleResponse(() => '1.0')}
            ],
            'POST': [
                {path: '/on', callback: simpleResponse(() => display.screenOn())},
                {path: '/off', callback: simpleResponse(() => display.screenOff())},
                {path: '/clear', callback: simpleResponse(() => display.clear())}
            ],
            'PUT': [
                {regex: /^\/(?<orientation>landscape|portrait)\/(?<x>\d+)\/(?<y>\d+)/, callback: displayImageRequest}
            ]
        }

        if (!(req.method in routeTable)) {
            res.statusCode = 400;
        } else {
            const routeList = routeTable[req.method];
            res.statusCode = 404;
            for (let route of routeList) {
                const matchResult = urlMatchesRoute(req.url, route);
                if (matchResult !== null) {
                    res.statusCode = 200;
                    route.callback.apply(route, [req, res, matchResult]);
                    break;
                }
            }
        }
        res.end();

        function urlMatchesRoute(url, route) {
            let result = null;
            if (route.path && route.path === url) {
                result = true;
            } else if (route.regex) {
                const parameters = url.match(route.regex);
                if (parameters) {
                    result = parameters.groups;
                }
            }
            return result;
        }
    });
    s.listen(options.port);

});

export default serveCommand;
