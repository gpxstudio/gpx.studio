use std::io;

use chrono::DateTime;
use quick_xml::Writer;
use quick_xml::events::{BytesDecl, BytesText, Event};

use crate::{File, Link, Track, Trackpoint, TrackpointCategories, Waypoint};

/// What the written file contains: the data of the trackpoints that are `false` are left out.
/// The same type tells which data a file has, see [`File::exportable_data`].
///
/// With `as_route`, the file is written with routes instead of tracks, see [`write`]. It is not
/// data: it is off in `ALL` and `NONE`, and in what [`File::exportable_data`] gives.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ExportOptions {
    pub time: bool,
    pub hr: bool,
    pub cad: bool,
    pub atemp: bool,
    pub power: bool,
    /// The OpenStreetMap data: surface, highway, SAC scale and MTB scale.
    pub osm: bool,
    /// Writes every segment as a route (`rte`) instead of a track.
    pub as_route: bool,
}

impl ExportOptions {
    pub const ALL: Self = Self::of(true);
    pub const NONE: Self = Self::of(false);

    const fn of(value: bool) -> Self {
        Self {
            time: value,
            hr: value,
            cad: value,
            atemp: value,
            power: value,
            osm: value,
            as_route: false,
        }
    }

    /// The options that are on in `self` or in `other`.
    pub fn union(self, other: Self) -> Self {
        Self {
            time: self.time || other.time,
            hr: self.hr || other.hr,
            cad: self.cad || other.cad,
            atemp: self.atemp || other.atemp,
            power: self.power || other.power,
            osm: self.osm || other.osm,
            as_route: self.as_route || other.as_route,
        }
    }
}

impl File {
    /// The data that the trackpoints of the file have (and waypoints for the time), which the
    /// options of [`write`] can leave out.
    pub fn exportable_data(&self) -> ExportOptions {
        let mut data = ExportOptions::NONE;
        for point in self
            .trk
            .iter()
            .flat_map(|trk| &trk.trkseg)
            .flat_map(|seg| seg.iter())
        {
            data.time |= point.time.is_some();
            data.hr |= point.hr.is_some();
            data.cad |= point.cad.is_some();
            data.atemp |= point.atemp.is_some();
            data.power |= point.power.is_some();
            data.osm |= point.surface.is_some()
                || point.highway.is_some()
                || point.sac_scale.is_some()
                || point.mtb_scale.is_some();
            if data == ExportOptions::ALL {
                break;
            }
        }
        data
    }
}

const SCHEMA_LOCATION: &str = "http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd http://www.garmin.com/xmlschemas/GpxExtensions/v3 http://www.garmin.com/xmlschemas/GpxExtensionsv3.xsd http://www.garmin.com/xmlschemas/TrackPointExtension/v1 http://www.garmin.com/xmlschemas/TrackPointExtensionv1.xsd http://www.garmin.com/xmlschemas/PowerExtension/v1 http://www.garmin.com/xmlschemas/PowerExtensionv1.xsd http://www.topografix.com/GPX/gpx_style/0/2 http://www.topografix.com/GPX/gpx_style/0/2/gpx_style.xsd";

type XmlWriter = Writer<Vec<u8>>;

/// Writes a file as GPX 1.1, in UTF-8. The surface, highway, SAC scale and MTB scale of the trackpoints are
/// the names of their codes in `categories`.
///
/// The segments are written as tracks, or with `options.as_route` as routes: a segment becomes a
/// `rte` that has the information of its track, its anchors are the `rtept` and the trackpoints
/// between two anchors are the `gpxx:rpt` of the `rtept` before them (which only have a
/// position, unlike the `rtept`). The first and last trackpoints always are `rtept`.
pub fn write(file: &File, categories: &TrackpointCategories, options: ExportOptions) -> Vec<u8> {
    let mut writer = Writer::new_with_indent(Vec::new(), b' ', 4);
    // writing to memory does not fail
    write_file(&mut writer, file, categories, options).expect("writing to memory");
    writer.into_inner()
}

fn write_file(
    w: &mut XmlWriter,
    file: &File,
    categories: &TrackpointCategories,
    options: ExportOptions,
) -> io::Result<()> {
    w.write_event(Event::Decl(BytesDecl::new("1.0", Some("UTF-8"), None)))?;
    w.create_element("gpx")
        .with_attributes([
            ("creator", "https://gpx.studio"),
            ("version", "1.1"),
            ("xmlns", "http://www.topografix.com/GPX/1/1"),
            ("xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance"),
            ("xsi:schemaLocation", SCHEMA_LOCATION),
            (
                "xmlns:gpxtpx",
                "http://www.garmin.com/xmlschemas/TrackPointExtension/v1",
            ),
            (
                "xmlns:gpxx",
                "http://www.garmin.com/xmlschemas/GpxExtensions/v3",
            ),
            (
                "xmlns:gpxpx",
                "http://www.garmin.com/xmlschemas/PowerExtension/v1",
            ),
            (
                "xmlns:gpx_style",
                "http://www.topografix.com/GPX/gpx_style/0/2",
            ),
        ])
        .write_inner_content(|w| {
            write_metadata(w, file, options)?;
            for wpt in file.wpt.iter() {
                write_waypoint(w, wpt, options)?;
            }
            for trk in &file.trk {
                // a single unnamed track is named like the file
                let name = match (&trk.info.name, file.trk.len()) {
                    (Some(name), _) if !name.is_empty() => Some(name.as_str()),
                    (_, 1) => Some(file.info.name.as_str()),
                    _ => None,
                };
                if options.as_route {
                    for segment in trk.trkseg.iter().filter(|segment| !segment.is_empty()) {
                        write_route(w, trk, segment, name, categories, options)?;
                    }
                } else {
                    write_track(w, trk, name, categories, options)?;
                }
            }
            Ok(())
        })?;
    Ok(())
}

fn text(w: &mut XmlWriter, name: &str, value: &str) -> io::Result<()> {
    if !value.is_empty() {
        w.create_element(name)
            .write_text_content(BytesText::new(value))?;
    }
    Ok(())
}

fn optional_text(w: &mut XmlWriter, name: &str, value: &Option<String>) -> io::Result<()> {
    text(w, name, value.as_deref().unwrap_or_default())
}

fn number(w: &mut XmlWriter, name: &str, value: impl std::fmt::Display) -> io::Result<()> {
    text(w, name, &value.to_string())
}

fn time(w: &mut XmlWriter, millis: Option<i64>) -> io::Result<()> {
    if let Some(time) = millis.and_then(DateTime::from_timestamp_millis) {
        text(
            w,
            "time",
            &time.format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string(),
        )?;
    }
    Ok(())
}

fn link(w: &mut XmlWriter, link: &Link) -> io::Result<()> {
    if !link.href.is_empty() {
        w.create_element("link")
            .with_attribute(("href", link.href.as_str()))
            .write_inner_content(|w| optional_text(w, "text", &link.text))?;
    }
    Ok(())
}

fn links(w: &mut XmlWriter, links: &[Link]) -> io::Result<()> {
    links.iter().try_for_each(|l| link(w, l))
}

fn write_metadata(w: &mut XmlWriter, file: &File, options: ExportOptions) -> io::Result<()> {
    let info = &file.info;
    let time = options.time.then_some(info.time).flatten();
    if info.name.is_empty()
        && info.desc.is_none()
        && info.author.is_none()
        && info.links.is_empty()
        && time.is_none()
    {
        return Ok(());
    }
    w.create_element("metadata").write_inner_content(|w| {
        text(w, "name", &info.name)?;
        optional_text(w, "desc", &info.desc)?;
        if let Some(author) = &info.author {
            w.create_element("author").write_inner_content(|w| {
                optional_text(w, "name", &author.name)?;
                if let Some((id, domain)) = author.email.as_deref().and_then(|e| e.split_once('@'))
                {
                    w.create_element("email")
                        .with_attributes([("id", id), ("domain", domain)])
                        .write_empty()?;
                }
                author.link.iter().try_for_each(|l| link(w, l))
            })?;
        }
        links(w, &info.links)?;
        self::time(w, time)
    })?;
    Ok(())
}

fn write_coordinates<'a>(
    w: &'a mut XmlWriter,
    name: &'a str,
    coordinates: crate::LngLat,
) -> quick_xml::writer::ElementWriter<'a, Vec<u8>> {
    w.create_element(name).with_attributes([
        ("lat", coordinates.lat.to_string().as_str()),
        ("lon", coordinates.lng.to_string().as_str()),
    ])
}

fn write_waypoint(w: &mut XmlWriter, wpt: &Waypoint, options: ExportOptions) -> io::Result<()> {
    write_coordinates(w, "wpt", wpt.coordinates).write_inner_content(|w| {
        number(w, "ele", wpt.ele)?;
        if options.time {
            time(w, wpt.time)?;
        }
        optional_text(w, "name", &wpt.name)?;
        optional_text(w, "cmt", &wpt.cmt)?;
        optional_text(w, "desc", &wpt.desc)?;
        links(w, &wpt.links)?;
        optional_text(w, "sym", &wpt.sym)?;
        optional_text(w, "type", &wpt.type_)
    })?;
    Ok(())
}

/// The information of a track that its routes have too: name, comment, description, source,
/// links, type and style.
fn write_track_info(
    w: &mut XmlWriter,
    name: Option<&str>,
    info: &crate::TrackInfo,
) -> io::Result<()> {
    text(w, "name", name.unwrap_or_default())?;
    optional_text(w, "cmt", &info.cmt)?;
    optional_text(w, "desc", &info.desc)?;
    optional_text(w, "src", &info.src)?;
    links(w, &info.links)?;
    optional_text(w, "type", &info.type_)?;
    if info.color.is_some() || info.opacity.is_some() || info.width.is_some() {
        w.create_element("extensions").write_inner_content(|w| {
            w.create_element("gpx_style:line")
                .write_inner_content(|w| {
                    optional_text(w, "gpx_style:color", &info.color)?;
                    if let Some(opacity) = info.opacity {
                        number(w, "gpx_style:opacity", opacity)?;
                    }
                    if let Some(width) = info.width {
                        number(w, "gpx_style:width", width)?;
                    }
                    Ok(())
                })?;
            Ok(())
        })?;
    }
    Ok(())
}

fn write_track(
    w: &mut XmlWriter,
    trk: &Track,
    name: Option<&str>,
    categories: &TrackpointCategories,
    options: ExportOptions,
) -> io::Result<()> {
    w.create_element("trk").write_inner_content(|w| {
        write_track_info(w, name, &trk.info)?;
        for segment in &trk.trkseg {
            w.create_element("trkseg").write_inner_content(|w| {
                for point in segment.iter() {
                    write_point(w, "trkpt", point, &[], categories, options)?;
                }
                Ok(())
            })?;
        }
        Ok(())
    })?;
    Ok(())
}

fn write_route(
    w: &mut XmlWriter,
    trk: &Track,
    segment: &crate::TrackSegment,
    name: Option<&str>,
    categories: &TrackpointCategories,
    options: ExportOptions,
) -> io::Result<()> {
    w.create_element("rte").write_inner_content(|w| {
        write_track_info(w, name, &trk.info)?;
        let points: Vec<&Trackpoint> = segment.iter().collect();
        let last = points.len() - 1;
        let is_anchor = |i: usize| i == 0 || i == last || points[i].anchor.is_some();
        let mut i = 0;
        while i < points.len() {
            // the trackpoints up to the next anchor
            let mut next = i + 1;
            while next < points.len() && !is_anchor(next) {
                next += 1;
            }
            write_point(
                w,
                "rtept",
                points[i],
                &points[i + 1..next],
                categories,
                options,
            )?;
            i = next;
        }
        Ok(())
    })?;
    Ok(())
}

/// A trackpoint or a route point (`tag`). A route point has the `path` that leads to the next one,
/// of which only the positions are written.
fn write_point(
    w: &mut XmlWriter,
    tag: &str,
    point: &Trackpoint,
    path: &[&Trackpoint],
    categories: &TrackpointCategories,
    options: ExportOptions,
) -> io::Result<()> {
    let atemp = point.atemp.filter(|_| options.atemp);
    let hr = point.hr.filter(|_| options.hr);
    let cad = point.cad.filter(|_| options.cad);
    let power = point.power.filter(|_| options.power);
    let osm = [
        ("surface", point.surface, &categories.surface),
        ("highway", point.highway, &categories.highway),
        ("sac_scale", point.sac_scale, &categories.sac_scale),
        ("mtb_scale", point.mtb_scale, &categories.mtb_scale),
    ]
    .map(|(name, code, categories)| {
        let value = code
            .filter(|_| options.osm)
            .and_then(|code| categories.name(code));
        (name, value)
    });
    let has_osm = osm.iter().any(|(_, value)| value.is_some());
    let has_track_point_extension = atemp.is_some() || hr.is_some() || cad.is_some() || has_osm;

    write_coordinates(w, tag, point.coordinates).write_inner_content(|w| {
        number(w, "ele", point.ele)?;
        if options.time {
            time(w, point.time)?;
        }
        if !has_track_point_extension && power.is_none() && path.is_empty() {
            return Ok(());
        }
        w.create_element("extensions").write_inner_content(|w| {
            if has_track_point_extension {
                w.create_element("gpxtpx:TrackPointExtension")
                    .write_inner_content(|w| {
                        if let Some(atemp) = atemp {
                            number(w, "gpxtpx:atemp", atemp)?;
                        }
                        if let Some(hr) = hr {
                            number(w, "gpxtpx:hr", hr)?;
                        }
                        if let Some(cad) = cad {
                            number(w, "gpxtpx:cad", cad)?;
                        }
                        if has_osm {
                            w.create_element("gpxtpx:Extensions")
                                .write_inner_content(|w| {
                                    for (name, value) in osm {
                                        text(w, name, value.unwrap_or_default())?;
                                    }
                                    Ok(())
                                })?;
                        }
                        Ok(())
                    })?;
            }
            if let Some(power) = power {
                w.create_element("gpxpx:PowerExtension")
                    .write_inner_content(|w| number(w, "gpxpx:PowerInWatts", power))?;
            }
            if !path.is_empty() {
                w.create_element("gpxx:RoutePointExtension")
                    .write_inner_content(|w| {
                        for point in path {
                            write_coordinates(w, "gpxx:rpt", point.coordinates).write_empty()?;
                        }
                        Ok(())
                    })?;
            }
            Ok(())
        })?;
        Ok(())
    })?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use crate::parse;

    use super::*;

    fn read(name: &str) -> (File, TrackpointCategories) {
        let mut categories = TrackpointCategories::default();
        let data = std::fs::read(format!("data/{name}.gpx")).unwrap();
        (parse(&data, &mut categories).unwrap(), categories)
    }

    fn written_text(
        file: &File,
        categories: &TrackpointCategories,
        options: ExportOptions,
    ) -> String {
        String::from_utf8(write(file, categories, options)).unwrap()
    }

    /// Writes a file and reads it again.
    fn round_trip(name: &str, options: ExportOptions) -> (File, File, TrackpointCategories) {
        let (file, mut categories) = read(name);
        let written = write(&file, &categories, options);
        let again = parse(&written, &mut categories).unwrap();
        (file, again, categories)
    }

    fn points(file: &File) -> Vec<Trackpoint> {
        file.trk
            .iter()
            .flat_map(|trk| &trk.trkseg)
            .flat_map(|seg| seg.iter().cloned())
            .collect()
    }

    fn same_points(a: &[Trackpoint], b: &[Trackpoint]) {
        assert_eq!(a.len(), b.len());
        for (a, b) in a.iter().zip(b) {
            assert_eq!(a.coordinates.lat, b.coordinates.lat);
            assert_eq!(a.coordinates.lng, b.coordinates.lng);
            assert_eq!(a.ele, b.ele);
            assert_eq!(a.time, b.time);
            assert_eq!(a.atemp, b.atemp);
            assert_eq!(a.hr, b.hr);
            assert_eq!(a.cad, b.cad);
            assert_eq!(a.power, b.power);
            assert_eq!(a.surface, b.surface);
            assert_eq!(a.highway, b.highway);
            assert_eq!(a.sac_scale, b.sac_scale);
            assert_eq!(a.mtb_scale, b.mtb_scale);
        }
    }

    #[test]
    fn test_links_and_the_email_are_written() {
        let data = std::fs::read("data/with_links.gpx").unwrap();
        let file = parse(&data, &mut Default::default()).unwrap();
        let again = parse(
            &write(&file, &Default::default(), ExportOptions::ALL),
            &mut Default::default(),
        )
        .unwrap();

        assert_eq!(again.info.links, file.info.links);
        assert_eq!(again.info.links.len(), 2);
        assert_eq!(again.info.author, file.info.author);
        assert_eq!(
            again.info.author.as_ref().unwrap().email.as_deref(),
            Some("someone@example.com")
        );
        let waypoints = |file: &File| file.wpt.iter().map(|w| w.links.clone()).collect::<Vec<_>>();
        assert_eq!(waypoints(&again), waypoints(&file));
        assert_eq!(again.wpt.iter().next().unwrap().links.len(), 3);
        for (a, b) in again.trk.iter().zip(&file.trk) {
            assert_eq!(a.info.links, b.info.links);
            assert_eq!(a.info.links.len(), 2);
        }
    }

    #[test]
    fn test_files_survive_a_round_trip() {
        for name in [
            "simple",
            "with_links",
            "with_time",
            "with_hr",
            "with_cad",
            "with_temp",
            "with_power_1",
            "with_power_2",
            "with_surface",
            "with_highway",
            "with_style",
            "with_waypoint",
            "with_tracks_and_segments",
            "self_closing_points",
        ] {
            let (file, again, _) = round_trip(name, ExportOptions::ALL);
            assert_eq!(file.info.name, again.info.name, "{name}");
            assert_eq!(file.info.desc, again.info.desc, "{name}");
            assert_eq!(file.info.author, again.info.author, "{name}");
            assert_eq!(file.trk.len(), again.trk.len(), "{name}");
            for (a, b) in file.trk.iter().zip(&again.trk) {
                assert_eq!(a.info, b.info, "{name}");
                assert_eq!(a.trkseg.len(), b.trkseg.len(), "{name}");
            }
            same_points(&points(&file), &points(&again));
            let waypoints: Vec<_> = file.wpt.iter().collect();
            let again_waypoints: Vec<_> = again.wpt.iter().collect();
            assert_eq!(waypoints.len(), again_waypoints.len(), "{name}");
            for (a, b) in waypoints.iter().zip(&again_waypoints) {
                assert!(a.same_content(b), "{name}");
            }
        }
    }

    #[test]
    fn test_options_leave_data_out() {
        let (file, categories) = read("with_hr");
        assert!(points(&file).iter().any(|p| p.hr.is_some()));
        let options = ExportOptions {
            hr: false,
            ..ExportOptions::ALL
        };
        let written = written_text(&file, &categories, options);
        assert!(!written.contains("hr>"));

        let (file, categories) = read("with_time");
        let options = ExportOptions {
            time: false,
            ..ExportOptions::ALL
        };
        assert!(!written_text(&file, &categories, options).contains("<time>"));
        assert!(
            written_text(&file, &categories, ExportOptions::ALL)
                .contains("<time>2023-12-31T23:00:00.000Z</time>")
        );
    }

    #[test]
    fn test_text_is_escaped_and_the_single_track_gets_the_name_of_the_file() {
        let (mut file, categories) = read("simple");
        file.info.name = "a <b> & c".into();
        file.trk.truncate(1);
        file.trk[0].info.name = None;
        let written = write(&file, &categories, ExportOptions::ALL);
        let text = String::from_utf8(written.clone()).unwrap();
        assert!(text.contains("a &lt;b&gt; &amp; c"));
        // the track has the name of the file
        assert_eq!(text.matches("a &lt;b&gt; &amp; c").count(), 2);
        // and it is read back as it was
        let mut categories = categories;
        let again = parse(&written, &mut categories).unwrap();
        assert_eq!(again.info.name, "a <b> & c");
        assert_eq!(again.trk[0].info.name.as_deref(), Some("a <b> & c"));
    }

    #[test]
    fn test_exportable_data() {
        let (file, _) = read("with_time");
        let data = file.exportable_data();
        assert!(data.time && !data.hr && !data.osm);
        let (file, _) = read("with_surface");
        assert!(file.exportable_data().osm);
        let (file, _) = read("with_power_2");
        assert!(file.exportable_data().power);
    }

    fn as_route() -> ExportOptions {
        ExportOptions {
            as_route: true,
            ..ExportOptions::ALL
        }
    }

    fn count(text: &str, pattern: &str) -> usize {
        text.matches(pattern).count()
    }

    #[test]
    fn test_export_as_route_writes_routes_instead_of_tracks() {
        let (file, categories) = read("with_route_points");
        let text = written_text(&file, &categories, as_route());

        assert_eq!(count(&text, "<rte>"), 1);
        assert_eq!(count(&text, "<trk>"), 0);
        assert_eq!(count(&text, "<trkseg>"), 0);
        assert_eq!(count(&text, "<trkpt"), 0);
        // the anchors are the route points, the trackpoints between them the points of their path
        assert_eq!(count(&text, "<rtept"), 3);
        assert_eq!(count(&text, "<gpxx:rpt"), 4);
        assert_eq!(count(&text, "<gpxx:RoutePointExtension>"), 2);
        // a route has the information of its track
        assert!(text.contains("<name>Lausanne</name>"));
        assert!(text.contains("<cmt>comment</cmt>"));
        assert!(text.contains("<desc>description</desc>"));
        assert!(text.contains("<type>Cycling</type>"));
        // and its points only have a position in the path, and an elevation as route points
        let first_rtept = &text[text.find("<rtept").unwrap()..];
        let (lat, lng) = (46.54462809674442_f64, 6.658079791814089_f64);
        assert!(first_rtept.starts_with(&format!("<rtept lat=\"{lat}\" lon=\"{lng}\">")));
        assert!(first_rtept.contains("<ele>500</ele>"));
        let (lat, lng) = (46.54441595077515_f64, 6.658358573913574_f64);
        assert!(text.contains(&format!("<gpxx:rpt lat=\"{lat}\" lon=\"{lng}\"/>")));
    }

    #[test]
    fn test_a_route_survives_being_exported_as_a_route() {
        let (file, mut categories) = read("with_route_points");
        let written = write(&file, &categories, as_route());
        let again = parse(&written, &mut categories).unwrap();

        assert_eq!(again.trk.len(), 1);
        assert_eq!(again.trk[0].info, file.trk[0].info);
        let (a, b) = (&file.trk[0].trkseg[0], &again.trk[0].trkseg[0]);
        assert_eq!(a.len(), b.len());
        for (a, b) in a.iter().zip(b.iter()) {
            assert_eq!(a.coordinates.lat, b.coordinates.lat);
            assert_eq!(a.coordinates.lng, b.coordinates.lng);
            assert_eq!(a.anchor, b.anchor);
        }
        // the elevation of the route points is kept, the other ones are worked out again
        let anchors = |s: &crate::TrackSegment| {
            s.iter()
                .filter(|p| p.anchor.is_some())
                .map(|p| p.ele)
                .collect::<Vec<_>>()
        };
        assert_eq!(anchors(a), anchors(b));
    }

    #[test]
    fn test_tracks_become_one_route_per_segment_with_the_information_of_the_track() {
        let (file, mut categories) = read("with_tracks_and_segments");
        let segments: usize = file.trk.iter().map(|t| t.trkseg.len()).sum();
        assert!(segments > 2);
        let written = write(&file, &categories, as_route());
        let text = String::from_utf8(written.clone()).unwrap();
        assert_eq!(count(&text, "<rte>"), segments);
        assert_eq!(count(&text, "<trk>"), 0);
        // every route starts and ends with a route point
        assert_eq!(count(&text, "</rte>"), segments);

        let again = parse(&written, &mut categories).unwrap();
        assert_eq!(again.trk.len(), segments);
        let mut routes = again.trk.iter();
        for track in &file.trk {
            for segment in &track.trkseg {
                let route = routes.next().unwrap();
                // the information of the track, repeated for each of its segments
                assert_eq!(route.info.name, track.info.name);
                assert_eq!(route.info.type_, track.info.type_);
                let (a, b) = (segment, &route.trkseg[0]);
                assert_eq!(a.len(), b.len());
                for (a, b) in a.iter().zip(b.iter()) {
                    assert_eq!(
                        (a.coordinates.lat, a.coordinates.lng),
                        (b.coordinates.lat, b.coordinates.lng)
                    );
                }
                // the anchors of the segment are the ones of its route
                let anchors = |s: &crate::TrackSegment| {
                    s.iter()
                        .enumerate()
                        .filter(|(_, p)| p.anchor.is_some())
                        .map(|(i, _)| i)
                        .collect::<Vec<_>>()
                };
                assert_eq!(anchors(a), anchors(b));
            }
        }
    }

    #[test]
    fn test_the_ends_of_a_route_are_route_points_even_without_anchors() {
        let (mut file, categories) = read("simple");
        file.trk[0].trkseg[0].update_all(|_, point| point.anchor = None);
        let len = file.trk[0].trkseg[0].len();
        let text = written_text(&file, &categories, as_route());
        assert_eq!(count(&text, "<rtept"), 2);
        assert_eq!(count(&text, "<gpxx:rpt"), len - 2);
        // and a single trackpoint is a route of one point
        file.trk[0].trkseg[0].splice(1, len, vec![]);
        let text = written_text(&file, &categories, as_route());
        assert_eq!(count(&text, "<rtept"), 1);
        assert_eq!(count(&text, "<gpxx:rpt"), 0);
    }

    #[test]
    fn test_empty_segments_are_not_routes() {
        let (mut file, categories) = read("simple");
        file.trk[0].trkseg.push(crate::TrackSegment::default());
        let text = written_text(&file, &categories, as_route());
        assert_eq!(count(&text, "<rte>"), 1);
    }

    #[test]
    fn test_routes_have_the_style_of_their_track() {
        let (file, categories) = read("with_style");
        let text = written_text(&file, &categories, as_route());
        assert!(count(&text, "<gpx_style:line>") >= 1);
        assert_eq!(count(&text, "<gpx_style:line>"), count(&text, "<rte>"));
        let again = parse(text.as_bytes(), &mut Default::default()).unwrap();
        assert_eq!(again.trk[0].info.color, file.trk[0].info.color);
        assert_eq!(again.trk[0].info.width, file.trk[0].info.width);
    }

    #[test]
    fn test_route_points_keep_their_data_and_the_options_apply_to_them() {
        let (file, categories) = read("with_hr");
        let with_all = written_text(&file, &categories, as_route());
        assert!(with_all.contains("<gpxtpx:hr>"));
        let without = written_text(
            &file,
            &categories,
            ExportOptions {
                hr: false,
                time: false,
                as_route: true,
                ..ExportOptions::ALL
            },
        );
        assert!(!without.contains("<gpxtpx:hr>"));
        assert!(!without.contains("<time>"));
    }

    #[test]
    fn test_the_route_option_is_not_data() {
        let (file, _) = read("with_route_points");
        assert!(!file.exportable_data().as_route);
        // it is a way to write the data, never part of them
        let all = std::hint::black_box(ExportOptions::ALL);
        assert!(!all.as_route && !ExportOptions::NONE.as_route);
        assert!(as_route().union(ExportOptions::NONE).as_route);
        assert!(!ExportOptions::ALL.union(ExportOptions::NONE).as_route);
    }
}
