import { TrackPoint, TrackSegment } from "gpx";
import { get } from "svelte/store";
import mapboxgl from "mapbox-gl";
import { dbUtils, getFile } from "$lib/db";
import { applyToOrderedSelectedItemsFromFile, selection } from "$lib/components/file-list/Selection";
import { ListTrackSegmentItem } from "$lib/components/file-list/FileList";
import { currentTool, gpxStatistics, Tool } from "$lib/stores";
import { _ } from "svelte-i18n";
import { Scissors } from "lucide-static";

export class SplitControls {
    active: boolean = false;
    map: mapboxgl.Map;
    controls: ControlWithMarker[] = [];
    shownControls: ControlWithMarker[] = [];
    unsubscribes: Function[] = [];

    toggleControlsForZoomLevelAndBoundsBinded: () => void = this.toggleControlsForZoomLevelAndBounds.bind(this);

    constructor(map: mapboxgl.Map) {
        this.map = map;

        this.unsubscribes.push(selection.subscribe(this.addIfNeeded.bind(this)));
        this.unsubscribes.push(gpxStatistics.subscribe(this.addIfNeeded.bind(this)));
        this.unsubscribes.push(currentTool.subscribe(this.addIfNeeded.bind(this)));
    }

    addIfNeeded() {
        let scissors = get(currentTool) === Tool.SCISSORS;
        if (!scissors) {
            if (this.active) {
                this.remove();
            }
            return;
        }

        if (this.active) {
            this.updateControls();
        } else {
            this.add();
        }
    }

    add() {
        this.active = true;

        this.map.on('zoom', this.toggleControlsForZoomLevelAndBoundsBinded);
        this.map.on('move', this.toggleControlsForZoomLevelAndBoundsBinded);
    }

    updateControls() { // Update the markers when the files change

        let controlIndex = 0;

        applyToOrderedSelectedItemsFromFile((fileId, level, items) => {
            let file = getFile(fileId);

            if (file) {
                file.forEachSegment((segment, trackIndex, segmentIndex) => {
                    if (get(selection).hasAnyParent(new ListTrackSegmentItem(fileId, trackIndex, segmentIndex))) {
                        for (let point of segment.trkpt.slice(1, -1)) { // Update the existing controls (could be improved by matching the existing controls with the new ones?)
                            if (point._data.anchor) {
                                if (controlIndex < this.controls.length) {
                                    this.controls[controlIndex].point = point;
                                    this.controls[controlIndex].segment = segment;
                                    this.controls[controlIndex].trackIndex = trackIndex;
                                    this.controls[controlIndex].segmentIndex = segmentIndex;
                                    this.controls[controlIndex].marker.setLngLat(point.getCoordinates());
                                } else {
                                    this.controls.push(this.createControl(point, segment, fileId, trackIndex, segmentIndex));
                                }
                                controlIndex++;
                            }
                        }
                    }
                });

            }
        }, false);

        while (controlIndex < this.controls.length) { // Remove the extra controls
            this.controls.pop()?.marker.remove();
        }

        this.toggleControlsForZoomLevelAndBounds();
    }

    remove() {
        this.active = false;

        for (let control of this.controls) {
            control.marker.remove();
        }
        this.map.off('zoom', this.toggleControlsForZoomLevelAndBoundsBinded);
        this.map.off('move', this.toggleControlsForZoomLevelAndBoundsBinded);
    }

    toggleControlsForZoomLevelAndBounds() { // Show markers only if they are in the current zoom level and bounds
        this.shownControls.splice(0, this.shownControls.length);

        let southWest = this.map.unproject([0, this.map.getCanvas().height]);
        let northEast = this.map.unproject([this.map.getCanvas().width, 0]);
        let bounds = new mapboxgl.LngLatBounds(southWest, northEast);

        let zoom = this.map.getZoom();
        this.controls.forEach((control) => {
            control.inZoom = control.point._data.zoom <= zoom;
            if (control.inZoom && bounds.contains(control.marker.getLngLat())) {
                control.marker.addTo(this.map);
                this.shownControls.push(control);
            } else {
                control.marker.remove();
            }
        });
    }

    createControl(point: TrackPoint, segment: TrackSegment, fileId: string, trackIndex: number, segmentIndex: number): ControlWithMarker {
        let element = document.createElement('div');
        element.className = `h-6 w-6 p-0.5 rounded-full bg-white border-2 border-black cursor-pointer`;
        element.innerHTML = Scissors.replace('width="24"', "").replace('height="24"', "");

        let marker = new mapboxgl.Marker({
            draggable: true,
            className: 'z-10',
            element
        }).setLngLat(point.getCoordinates());

        let control = {
            point,
            segment,
            fileId,
            trackIndex,
            segmentIndex,
            marker,
            inZoom: false
        };

        marker.getElement().addEventListener('click', (e) => {
            e.stopPropagation();
            dbUtils.split(fileId, trackIndex, segmentIndex, point.getCoordinates(), point._data.index);
        });

        return control;
    }

    destroy() {
        this.remove();
        this.unsubscribes.forEach((unsubscribe) => unsubscribe());
    }
}

type Control = {
    segment: TrackSegment;
    fileId: string;
    trackIndex: number;
    segmentIndex: number;
    point: TrackPoint;
};

type ControlWithMarker = Control & {
    marker: mapboxgl.Marker;
    inZoom: boolean;
};
