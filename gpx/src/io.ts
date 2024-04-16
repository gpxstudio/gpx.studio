import { XMLParser } from "fast-xml-parser";
import { GPXFile } from "./types";

export function parseGPX(gpxData: string): GPXFile {
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "",
        removeNSPrefix: true,
        isArray: (name: string) => {
            return name === 'trk' || name === 'trkseg' || name === 'trkpt' || name === 'wpt';
        },
        attributeValueProcessor(attrName, attrValue, jPath) {
            if (attrName === 'lat' || attrName === 'lon') {
                return parseFloat(attrValue);
            }
            return attrValue;
        },
        transformTagName(tagName: string) {
            if (tagName === 'power') {
                // Transform the simple <power> tag to the more complex <gpxpx:PowerExtension> tag, the nested <gpxpx:PowerInWatts> tag is then handled by the tagValueProcessor
                return 'PowerExtension';
            }
            return tagName;
        },
        tagValueProcessor(tagName, tagValue, jPath, hasAttributes, isLeafNode) {
            if (isLeafNode) {
                if (tagName === 'ele') {
                    return parseFloat(tagValue);
                }

                if (tagName === 'time') {
                    return new Date(tagValue);
                }

                if (tagName === 'hr' || tagName === 'cad' || tagName === 'atemp' || tagName === 'PowerInWatts' || tagName === 'opacity' || tagName === 'weight') {
                    return parseFloat(tagValue);
                }

                if (tagName === 'PowerExtension') {
                    // Finish the transformation of the simple <power> tag to the more complex <gpxpx:PowerExtension> tag
                    // Note that this only targets the transformed <power> tag, since it must be a leaf node
                    return {
                        'PowerInWatts': parseFloat(tagValue)
                    };
                }
            }

            return tagValue;
        },
        transformAttributeName(attributeName) {
            if (attributeName !== 'lat' && attributeName !== 'lon' && attributeName !== 'creator' && attributeName !== 'href') {
                return `@_${attributeName}`;
            }
            return attributeName;
        },
    });

    const parsed = parser.parse(gpxData);

    return parsed.gpx;
}
