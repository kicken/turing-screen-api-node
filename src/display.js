import {SerialPort} from "serialport";
import getPixels from "get-pixels";

export class Display {
    static Orientation = Object.freeze({
        Landscape: 1,
        Portrait: 2
    });

    static Command = Object.freeze({
        Reset: 0x65,
        Clear: 0x66,
        ToBlack: 0x67,
        ScreenOff: 0x6C,
        ScreenOn: 0x6D,
        SetBrightness: 0x6E,
        SetOrientation: 0x79,
        DisplayBitmap: 0xC5
    });

    constructor(port) {
        this._port = new SerialPort({
            path: port
            , baudRate: 9600
            , dataBits: 8
            , stopBits: 1
            , parity: 'none'
        });
        this.width = 320;
        this.height = 480;
        this._write(this._packCommand(0xFF)).then(() => {
            return this.setOrientation(Display.Orientation.Portrait);
        });
    }

    async setOrientation(orientation, reverse = false) {
        const reverseFlag = reverse ? 0x01 : 0x00;
        const orientationFlag = orientation === Display.Orientation.Landscape ? 0x02 : 0x00;
        let w = this.width, h = this.height, bytes;
        if (orientation === Display.Orientation.Landscape) {
            [w, h] = [h, w];
        }

        bytes = this._packCommand(0x7A);
        bytes = this._appendBytes(bytes, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        await this._write(bytes);

        bytes = this._packCommand(Display.Command.SetOrientation);
        bytes = this._appendBytes(bytes,
            0x64 | reverseFlag | orientationFlag,
            ...this._packUInt16(w),
            ...this._packUInt16(h),
            0, 0, 0, 0, 0
        );

        await this._write(bytes);
    }

    async clear() {
        return this._write(this._packCommand(Display.Command.Clear));
    }

    async toBlack() {
        return this._write(this._packCommand(Display.Command.ToBlack));
    }

    async screenOn() {
        return this._write(this._packCommand(Display.Command.ScreenOn));
    }

    async screenOff() {
        return this._write(this._packCommand(Display.Command.ScreenOff));
    }

    async displayBitmap(x, y, type, buffer) {
        return new Promise((resolve, reject) => {
            getPixels(buffer, type, async (err, pixels) => {
                if (err) {
                    reject(err);
                }

                const w = pixels.shape[0];
                const h = pixels.shape[1];
                const x2 = x + w - 1;
                const y2 = y + h - 1;
                let command = this._packCommand(Display.Command.DisplayBitmap, x, y, x2, y2);
                await this._write(command);

                const colorData = new Uint16Array(w);
                for (let y = 0; y < h; y++) {
                    colorData.fill(0xffff);
                    for (let x = 0; x < w; x++) {
                        const r = pixels.get(x, y, 0);
                        const g = pixels.get(x, y, 1);
                        const b = pixels.get(x, y, 2);
                        colorData[x] = this._packColor(r, g, b);
                    }
                    await this._write(new Uint8Array(colorData.buffer));
                }

                resolve();
            });
        });
    }

    _packCommand(command, param1 = 0, param2 = 0, param3 = 0, param4 = 0) {
        const buffer = new Uint8Array(6);
        buffer[0] = param1 >> 2;
        buffer[1] = (param1 & 0x03) << 6 | (param2 >> 4) & 0x3F;
        buffer[2] = (param2 & 0x0F) << 4 | (param3 >> 6) & 0x0F;
        buffer[3] = (param3 & 0x3F) << 2 | (param4 >> 8) & 0x03;
        buffer[4] = param4 & 0xff;
        buffer[5] = command & 0xFF;
        return buffer;
    }

    _packUInt16(int) {
        const buffer = new Uint8Array(2);
        buffer[1] = (int >> 8) & 0xff;
        buffer[0] = int & 0xff;
        return buffer;
    }

    _packColor(r, g, b) {
        const mr = (r / 255 * 0x1f);
        const mg = (g / 255 * 0x3f);
        const mb = (b / 255 * 0x1f);
        return (mr << 11 | mg << 5 | mb);
    }

    async _write(bytes) {
        //this._logBytes(bytes);
        return new Promise((resolve, reject) => {
            this._port.write(bytes, 'binary', (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    _appendBytes(buffer, ...newBytes) {
        const newBuffer = new Uint8Array(buffer.length + newBytes.length);
        newBuffer.set(buffer);
        newBuffer.set(newBytes, buffer.length);
        return newBuffer;
    }
}
