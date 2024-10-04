export const surfaceColors: { [key: string]: string } = {
    "missing": "#d1d1d1",
    "paved": "#8c8c8c",
    "unpaved": "#6b443a",
    "asphalt": "#8c8c8c",
    "concrete": "#8c8c8c",
    "cobblestone": "#ffd991",
    "paving_stones": "#8c8c8c",
    "sett": "#ffd991",
    "metal": "#8c8c8c",
    "wood": "#6b443a",
    "compacted": "#ffffa8",
    "fine_gravel": "#ffffa8",
    "gravel": "#ffffa8",
    "pebblestone": "#ffffa8",
    "rock": "#ffd991",
    "dirt": "#ffffa8",
    "ground": "#6b443a",
    "earth": "#6b443a",
    "mud": "#6b443a",
    "sand": "#ffffc4",
    "grass": "#61b55c",
    "grass_paver": "#61b55c",
    "clay": "#6b443a",
    "stone": "#ffd991",
};

export function getSurfaceColor(surface: string): string {
    return surfaceColors[surface] ? surfaceColors[surface] : surfaceColors.missing;
}

export const highwayColors: { [key: string]: string } = {
    "missing": "#d1d1d1",
    "motorway": "#ff4d33",
    "motorway_link": "#ff4d33",
    "trunk": "#ff5e4d",
    "trunk_link": "#ff947f",
    "primary": "#ff6e5c",
    "primary_link": "#ff6e5c",
    "secondary": "#ff8d7b",
    "secondary_link": "#ff8d7b",
    "tertiary": "#ffd75f",
    "tertiary_link": "#ffd75f",
    "unclassified": "#f1f2a5",
    "road": "#f1f2a5",
    "residential": "#73b2ff",
    "living_street": "#73b2ff",
    "service": "#9c9cd9",
    "track": "#a8e381",
    "footway": "#a8e381",
    "path": "#a8e381",
    "pedestrian": "#a8e381",
    "cycleway": "#9de2ff",
    "construction": "#e09a4a",
    "bridleway": "#946f43",
    "raceway": "#ff0000",
    "rest_area": "#9c9cd9",
    "services": "#9c9cd9",
    "corridor": "#474747",
    "elevator": "#474747",
    "steps": "#474747",
    "bus_stop": "#8545a3",
    "busway": "#8545a3",
    "via_ferrata": "#474747"
};

export const sacScaleColors: { [key: string]: string } = {
    "hiking": "#007700",
    "mountain_hiking": "#1843ad",
    "demanding_mountain_hiking": "#ffff00",
    "alpine_hiking": "#ff9233",
    "demanding_alpine_hiking": "#ff0000",
    "difficult_alpine_hiking": "#000000",
};

export const mtbScaleColors: { [key: string]: string } = {
    "0-": "#007700",
    "0": "#007700",
    "0+": "#007700",
    "1-": "#1843ad",
    "1": "#1843ad",
    "1+": "#1843ad",
    "2-": "#ffff00",
    "2": "#ffff00",
    "2+": "#ffff00",
    "3": "#ff0000",
    "4": "#00ff00",
    "5": "#000000",
    "6": "#b105eb",
};

function createPattern(backgroundColor: string, sacScaleColor: string | undefined, mtbScaleColor: string | undefined, size: number = 16, lineWidth: number = 4) {
    let canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    let ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, size, size);
        ctx.lineWidth = lineWidth;

        const halfSize = size / 2;
        const halfLineWidth = lineWidth / 2;
        if (sacScaleColor) {
            ctx.strokeStyle = sacScaleColor;
            ctx.beginPath();
            ctx.moveTo(halfSize - halfLineWidth, - halfLineWidth);
            ctx.lineTo(size + halfLineWidth, halfSize + halfLineWidth);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(- halfLineWidth, halfSize - halfLineWidth);
            ctx.lineTo(halfSize + halfLineWidth, size + halfLineWidth);
            ctx.stroke();
        }
        if (mtbScaleColor) {
            ctx.strokeStyle = mtbScaleColor;
            ctx.beginPath();
            ctx.moveTo(halfSize - halfLineWidth, size + halfLineWidth);
            ctx.lineTo(size + halfLineWidth, halfSize - halfLineWidth);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(- halfLineWidth, halfSize + halfLineWidth);
            ctx.lineTo(halfSize + halfLineWidth, - halfLineWidth);
            ctx.stroke();
        }
    }
    return ctx?.createPattern(canvas, 'repeat') || backgroundColor;
}

const patterns: Record<string, string | CanvasPattern> = {};
export function getHighwayColor(highway: string, sacScale: string | undefined, mtbScale: string | undefined) {
    let backgroundColor = highwayColors[highway] ? highwayColors[highway] : highwayColors.missing;
    let sacScaleColor = sacScale ? sacScaleColors[sacScale] : undefined;
    let mtbScaleColor = mtbScale ? mtbScaleColors[mtbScale] : undefined;
    if (sacScale || mtbScale) {
        let patternId = `${backgroundColor}-${[sacScale, mtbScale].filter(x => x).join('-')}`;
        if (!patterns[patternId]) {
            patterns[patternId] = createPattern(backgroundColor, sacScaleColor, mtbScaleColor);
        }
        return patterns[patternId];
    }
    return backgroundColor;
}

const maxSlope = 20;
export function getSlopeColor(slope: number): string {
    if (slope > maxSlope) {
        slope = maxSlope;
    } else if (slope < -maxSlope) {
        slope = -maxSlope;
    }

    let v = slope / maxSlope;
    v = 1 / (1 + Math.exp(-6 * v));
    v = v - 0.5;

    let hue = ((0.5 - v) * 120).toString(10);
    let lightness = 90 - Math.abs(v) * 70;

    return `hsl(${hue},70%,${lightness}%)`;
}