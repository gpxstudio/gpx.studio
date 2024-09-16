import { GPXFile } from "./gpx";
export declare function parseGPX(gpxData: string): GPXFile;
export declare function buildGPX(file: GPXFile, exclude: string[]): string;
