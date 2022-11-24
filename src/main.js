import {program} from "commander";
import serveCommand from "./command/serve.js";
import displayImageCommand from "./command/display-image.js";

program.addCommand(serveCommand);
program.addCommand(displayImageCommand);
program.parse();
