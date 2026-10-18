/** The part of pngjs (it ships no types) that the share images use: writing the art's overlay and reading the render back into RGBA pixels. */
declare module 'pngjs' {
  export class PNG {
    constructor(options: { width: number; height: number });
    width: number;
    height: number;
    data: Buffer;
    static sync: {
      read(buffer: Buffer): { width: number; height: number; data: Buffer };
      write(png: PNG): Buffer;
    };
  }
}
