import {Command, InvalidArgumentError, Option} from "commander";
import {statSync} from "node:fs";
import {readFile} from "node:fs/promises";
import {Display} from "../display.js";

const extensionRegex = /\.(jpg|png)$/i;
const displayImageCommand = new Command('display-image');
let checkIsInteger = (value) => {
    value = parseInt(value, 10);
    if (isNaN(value) || value < 0) {
        throw new InvalidArgumentError('X must be a positive integer');
    }
    return value;
};

displayImageCommand.option('-x <x>', 'Starting x position', checkIsInteger, 0);
displayImageCommand.option('-y <y>', 'Starting y position', checkIsInteger, 0);
displayImageCommand.addOption(
    new Option('-o <orientation>', 'Starting y position')
        .choices(['landscape', 'portrait'])
        .default('portrait')
);
displayImageCommand.argument('<device>', 'Device name / path of the serial port.');
displayImageCommand.argument('<image>', 'Path of image to display.', (value) => {
    if (!extensionRegex.test(value)) {
        throw new InvalidArgumentError('Image must have extension .jpg, .png');
    }

    let info;
    try {
        info = statSync(value);
    } catch (e) {
        throw new InvalidArgumentError('Image cannot be read.');
    }

    if (!info.isFile()) {
        throw new InvalidArgumentError('Image path must be to a file.');
    }

    return value;
});
displayImageCommand.action(async (device, image, opts) => {
    const ext = image.match(extensionRegex)[1];
    const mime = {'png': 'image/png', 'jpg': 'image/jpeg'}[ext];
    await readFile(image).then(async (data) => {
        const d = new Display(device);
        await d.init(opts.o === 'landscape' ? Display.Orientation.Landscape : Display.Orientation.Portrait);
        return d.displayBitmap(opts.x, opts.y, mime, data);
    });
});

export default displayImageCommand;
