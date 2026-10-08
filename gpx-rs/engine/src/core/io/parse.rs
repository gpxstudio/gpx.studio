use crate::{
    Author, Chunk, File, Link, LngLat, Track, TrackSegment, Trackpoint, TrackpointCategories,
    TrackpointChunk, Waypoint, WaypointChunk,
};
use chrono::DateTime;
use quick_xml::Error;
use quick_xml::escape::resolve_predefined_entity;
use quick_xml::events::Event;
use quick_xml::events::attributes::Attributes;
use quick_xml::reader::Reader;

enum GPXElement {
    Metadata,
    Name,
    Comment,
    Description,
    Source,
    Author(Author),
    Link(Link),
    Text,
    Track(Track),
    Segment(TrackSegment),
    Trackpoint(Trackpoint),
    RoutePoint(LngLat),
    Waypoint(Waypoint),
    Elevation,
    Time,
    Temperature,
    Heartrate,
    Cadence,
    Power,
    Surface,
    Highway,
    SacScale,
    MtbScale,
    Symbol,
    Type,
    Color,
    Opacity,
    Width,
}

fn parse_coordinates(attributes: Attributes<'_>) -> LngLat {
    let mut coordinates = LngLat::default();
    for attr in attributes.flatten() {
        match attr.key.as_ref() {
            "lat" => coordinates.lat = attr.value.parse().unwrap_or_default(),
            "lon" => coordinates.lng = attr.value.parse().unwrap_or_default(),
            _ => (),
        }
    }
    coordinates
}

/// Whether the element is a point of the detailed path of a route point (`gpxx:rpt`).
fn is_route_point_extension(name: &str) -> bool {
    name == "rpt" || name.ends_with(":rpt")
}

/// Whether the element holds a value, which is its text.
fn holds_text(element: Option<&GPXElement>) -> bool {
    matches!(
        element,
        Some(
            GPXElement::Name
                | GPXElement::Comment
                | GPXElement::Description
                | GPXElement::Source
                | GPXElement::Text
                | GPXElement::Elevation
                | GPXElement::Time
                | GPXElement::Temperature
                | GPXElement::Heartrate
                | GPXElement::Cadence
                | GPXElement::Power
                | GPXElement::Surface
                | GPXElement::Highway
                | GPXElement::SacScale
                | GPXElement::MtbScale
                | GPXElement::Symbol
                | GPXElement::Type
                | GPXElement::Color
                | GPXElement::Opacity
                | GPXElement::Width
        )
    )
}

/// Gives the text `e` of the element at the top of the stack, which is removed, to what holds it.
fn apply_text(
    stack: &mut Vec<GPXElement>,
    gpx: &mut File,
    categories: &mut TrackpointCategories,
    e: &str,
) {
    match stack.last_mut() {
        Some(GPXElement::Name) => {
            stack.pop();
            match stack.last_mut() {
                Some(GPXElement::Metadata) => {
                    gpx.info.name = e.to_owned();
                }
                Some(GPXElement::Author(author)) => {
                    author.name = Some(e.to_owned());
                }
                Some(GPXElement::Track(trk)) => {
                    trk.info.name = Some(e.to_owned());
                }
                Some(GPXElement::Waypoint(wpt)) => {
                    wpt.name = Some(e.to_owned());
                }
                _ => (),
            }
        }
        Some(GPXElement::Comment) => {
            stack.pop();
            match stack.last_mut() {
                Some(GPXElement::Track(trk)) => {
                    trk.info.cmt = Some(e.to_owned());
                }
                Some(GPXElement::Waypoint(wpt)) => {
                    wpt.cmt = Some(e.to_owned());
                }
                _ => (),
            }
        }
        Some(GPXElement::Description) => {
            stack.pop();
            match stack.last_mut() {
                Some(GPXElement::Metadata) => {
                    gpx.info.desc = Some(e.to_owned());
                }
                Some(GPXElement::Track(trk)) => {
                    trk.info.desc = Some(e.to_owned());
                }
                Some(GPXElement::Waypoint(wpt)) => {
                    wpt.desc = Some(e.to_owned());
                }
                _ => (),
            }
        }
        Some(GPXElement::Source) => {
            stack.pop();
            if let Some(GPXElement::Track(trk)) = stack.last_mut() {
                trk.info.src = Some(e.to_owned());
            }
        }
        Some(GPXElement::Text) => {
            stack.pop();
            if let Some(GPXElement::Link(link)) = stack.last_mut() {
                link.text = Some(e.to_owned());
            }
        }
        Some(GPXElement::Elevation) => {
            stack.pop();
            match stack.last_mut() {
                Some(GPXElement::Trackpoint(trkpt)) => {
                    trkpt.ele = e.parse().unwrap_or_default();
                }
                Some(GPXElement::Waypoint(wpt)) => {
                    wpt.ele = e.parse().unwrap_or_default();
                }
                _ => (),
            }
        }
        Some(GPXElement::Time) => {
            stack.pop();
            if let Some(GPXElement::Trackpoint(trkpt)) = stack.last_mut() {
                trkpt.time = DateTime::parse_from_rfc3339(e)
                    .ok()
                    .map(|time| time.timestamp_millis());
            }
        }
        Some(GPXElement::Temperature) => {
            stack.pop();
            if let Some(GPXElement::Trackpoint(trkpt)) = stack.last_mut() {
                trkpt.atemp = e.parse().ok();
            }
        }
        Some(GPXElement::Heartrate) => {
            stack.pop();
            if let Some(GPXElement::Trackpoint(trkpt)) = stack.last_mut() {
                trkpt.hr = e.parse().ok();
            }
        }
        Some(GPXElement::Cadence) => {
            stack.pop();
            if let Some(GPXElement::Trackpoint(trkpt)) = stack.last_mut() {
                trkpt.cad = e.parse().ok();
            }
        }
        Some(GPXElement::Power) => {
            stack.pop();
            if let Some(GPXElement::Trackpoint(trkpt)) = stack.last_mut() {
                trkpt.power = e.parse().ok();
            }
        }
        Some(GPXElement::Surface) => {
            stack.pop();
            if let Some(GPXElement::Trackpoint(trkpt)) = stack.last_mut() {
                trkpt.surface = categories.surface.code(e);
            }
        }
        Some(GPXElement::Highway) => {
            stack.pop();
            if let Some(GPXElement::Trackpoint(trkpt)) = stack.last_mut() {
                trkpt.highway = categories.highway.code(e);
            }
        }
        Some(GPXElement::SacScale) => {
            stack.pop();
            if let Some(GPXElement::Trackpoint(trkpt)) = stack.last_mut() {
                trkpt.sac_scale = categories.sac_scale.code(e);
            }
        }
        Some(GPXElement::MtbScale) => {
            stack.pop();
            if let Some(GPXElement::Trackpoint(trkpt)) = stack.last_mut() {
                trkpt.mtb_scale = categories.mtb_scale.code(e);
            }
        }
        Some(GPXElement::Symbol) => {
            stack.pop();
            if let Some(GPXElement::Waypoint(wpt)) = stack.last_mut() {
                wpt.sym = Some(e.to_owned());
            }
        }
        Some(GPXElement::Type) => {
            stack.pop();
            match stack.last_mut() {
                Some(GPXElement::Track(trk)) => {
                    trk.info.type_ = Some(e.to_owned());
                }
                Some(GPXElement::Waypoint(wpt)) => {
                    wpt.type_ = Some(e.to_owned());
                }
                _ => (),
            }
        }
        Some(GPXElement::Color) => {
            stack.pop();
            if let Some(GPXElement::Track(trk)) = stack.last_mut() {
                trk.info.color = Some(e.to_owned());
            }
        }
        Some(GPXElement::Opacity) => {
            stack.pop();
            if let Some(GPXElement::Track(trk)) = stack.last_mut() {
                trk.info.opacity = e.parse().ok();
            }
        }
        Some(GPXElement::Width) => {
            stack.pop();
            if let Some(GPXElement::Track(trk)) = stack.last_mut() {
                trk.info.width = e.parse().ok();
            }
        }
        _ => (),
    }
}

/// The email of the author, given as the `id` and `domain` attributes of the element.
fn set_email(stack: &mut [GPXElement], attributes: Attributes<'_>) {
    let Some(GPXElement::Author(author)) = stack.last_mut() else {
        return;
    };
    let (mut id, mut domain) = (None, None);
    for attr in attributes.flatten() {
        match attr.key.as_ref() {
            "id" => id = Some(attr.value.to_string()),
            "domain" => domain = Some(attr.value.to_string()),
            _ => (),
        }
    }
    if let (Some(id), Some(domain)) = (id, domain) {
        author.email = Some(format!("{id}@{domain}"));
    }
}

/// The link with the given `href`, if it is an attribute of the element.
fn parse_link(attributes: Attributes<'_>) -> Link {
    let mut link = Link::default();
    for attr in attributes.flatten() {
        if attr.key.as_ref() == "href" {
            link.href = attr.value.to_string();
        }
    }
    link
}

/// Gives a link to what holds it, which is at the top of the stack.
fn attach_link(stack: &mut [GPXElement], gpx: &mut File, link: Link) {
    match stack.last_mut() {
        // the author has a single link, the other elements have as many as they want
        Some(GPXElement::Author(author)) => author.link = Some(link),
        Some(GPXElement::Track(trk)) => trk.info.links.push(link),
        Some(GPXElement::Waypoint(wpt)) => wpt.links.push(link),
        Some(GPXElement::Metadata) => gpx.info.links.push(link),
        _ => (),
    }
}

/// Parses a GPX file. The surface, highway, SAC scale and MTB scale of the trackpoints are stored as codes of
/// `categories`, which learns the values it does not know yet.
pub fn parse(data: &[u8], categories: &mut TrackpointCategories) -> Result<File, Error> {
    let mut reader = Reader::from_reader(data);
    let mut buf = vec![];
    let mut gpx = File::default();
    let mut stack: Vec<GPXElement> = vec![];
    let mut trkpt_chunk = TrackpointChunk::default();
    let mut wpt_chunk = WaypointChunk::default();
    // Routes are read as tracks of a single segment, which is what `rte_segment` collects the points of. A route
    // point that comes with the detailed path of the route to the next one (`gpxx:rpt`) is replaced by it.
    let mut rte_segment = TrackSegment::default();
    let mut rpt_points: Vec<Trackpoint> = vec![];
    // the text of the element at the top of the stack, up to now
    let mut text = String::new();
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => match e.name().as_ref() {
                "metadata" => stack.push(GPXElement::Metadata),
                "name" => stack.push(GPXElement::Name),
                "cmt" => stack.push(GPXElement::Comment),
                "desc" => stack.push(GPXElement::Description),
                "src" => stack.push(GPXElement::Source),
                "author" => stack.push(GPXElement::Author(Author::default())),
                "link" => stack.push(GPXElement::Link(parse_link(e.attributes()))),
                "email" => set_email(&mut stack, e.attributes()),
                "text" => stack.push(GPXElement::Text),
                "trk" | "rte" => stack.push(GPXElement::Track(Track::default())),
                "trkseg" => {
                    stack.push(GPXElement::Segment(TrackSegment::default()));
                }
                "trkpt" | "rtept" => {
                    stack.push(GPXElement::Trackpoint(Trackpoint {
                        coordinates: parse_coordinates(e.attributes()),
                        ..Default::default()
                    }));
                }
                "wpt" => {
                    stack.push(GPXElement::Waypoint(Waypoint {
                        coordinates: parse_coordinates(e.attributes()),
                        ..Default::default()
                    }));
                }
                name if is_route_point_extension(name) => {
                    stack.push(GPXElement::RoutePoint(parse_coordinates(e.attributes())));
                }
                "ele" => stack.push(GPXElement::Elevation),
                "time" => stack.push(GPXElement::Time),
                e if e.ends_with("atemp") => stack.push(GPXElement::Temperature),
                e if e.ends_with("hr") => stack.push(GPXElement::Heartrate),
                e if e.ends_with("cad") => stack.push(GPXElement::Cadence),
                e if e.ends_with("power") => stack.push(GPXElement::Power),
                e if e.ends_with("PowerInWatts") => stack.push(GPXElement::Power),
                "surface" => stack.push(GPXElement::Surface),
                "highway" => stack.push(GPXElement::Highway),
                "sac_scale" => stack.push(GPXElement::SacScale),
                "mtb_scale" => stack.push(GPXElement::MtbScale),
                "sym" => stack.push(GPXElement::Symbol),
                "type" => stack.push(GPXElement::Type),
                e if e.ends_with("color") => stack.push(GPXElement::Color),
                e if e.ends_with("opacity") => stack.push(GPXElement::Opacity),
                e if e.ends_with("width") => stack.push(GPXElement::Width),
                _ => (),
            },
            // Self-closing points (`<trkpt lat=".." lon=".."/>`), which have no children
            Ok(Event::Empty(e)) => match e.name().as_ref() {
                "link" => attach_link(&mut stack, &mut gpx, parse_link(e.attributes())),
                "email" => set_email(&mut stack, e.attributes()),
                "trkpt" => {
                    if let Some(GPXElement::Segment(trkseg)) = stack.last_mut() {
                        trkpt_chunk.trkpt.push(Trackpoint {
                            coordinates: parse_coordinates(e.attributes()),
                            ..Default::default()
                        });
                        if trkpt_chunk.is_full() {
                            trkseg.push(std::mem::take(&mut trkpt_chunk));
                        }
                    }
                }
                "rtept" => {
                    if let Some(GPXElement::Track(_)) = stack.last() {
                        trkpt_chunk.trkpt.push(Trackpoint {
                            coordinates: parse_coordinates(e.attributes()),
                            ..Default::default()
                        });
                        if trkpt_chunk.is_full() {
                            rte_segment.push(std::mem::take(&mut trkpt_chunk));
                        }
                    }
                }
                name if is_route_point_extension(name) => {
                    if let Some(GPXElement::Trackpoint(_)) = stack.last() {
                        rpt_points.push(Trackpoint {
                            coordinates: parse_coordinates(e.attributes()),
                            ..Default::default()
                        });
                    }
                }
                "wpt" => {
                    wpt_chunk.wpt.push(Waypoint {
                        coordinates: parse_coordinates(e.attributes()),
                        ..Default::default()
                    });
                    if wpt_chunk.is_full() {
                        gpx.wpt.push(std::mem::take(&mut wpt_chunk));
                    }
                }
                _ => (),
            },
            Ok(Event::End(e)) => {
                if holds_text(stack.last()) {
                    let value = std::mem::take(&mut text);
                    if value.is_empty() {
                        stack.pop();
                    } else {
                        apply_text(&mut stack, &mut gpx, categories, &value);
                    }
                }
                match e.name().as_ref() {
                    "gpx" => {
                        if !wpt_chunk.wpt.is_empty() {
                            gpx.wpt.push(std::mem::take(&mut wpt_chunk));
                        }
                    }
                    "metadata" => {
                        stack.pop();
                    }
                    "author" => {
                        if let Some(GPXElement::Author(author)) = stack.pop() {
                            gpx.info.author = Some(author);
                        }
                    }
                    "link" => {
                        if let Some(GPXElement::Link(link)) = stack.pop() {
                            attach_link(&mut stack, &mut gpx, link);
                        }
                    }
                    "trk" => {
                        if let Some(GPXElement::Track(trk)) = stack.pop() {
                            gpx.trk.push(trk);
                        }
                    }
                    "rte" => {
                        if let Some(GPXElement::Track(mut trk)) = stack.pop() {
                            rte_segment.push(std::mem::take(&mut trkpt_chunk));
                            if !rte_segment.is_empty() {
                                let mut trkseg = std::mem::take(&mut rte_segment);
                                trkseg.compute_anchors();
                                trk.trkseg.push(trkseg);
                            }
                            gpx.trk.push(trk);
                        }
                    }
                    "rtept" => {
                        if let Some(GPXElement::Trackpoint(rtept)) = stack.pop()
                            && let Some(GPXElement::Track(_)) = stack.last()
                        {
                            let points = if rpt_points.is_empty() {
                                vec![rtept]
                            } else {
                                std::mem::take(&mut rpt_points)
                            };
                            for point in points {
                                trkpt_chunk.trkpt.push(point);
                                if trkpt_chunk.is_full() {
                                    rte_segment.push(std::mem::take(&mut trkpt_chunk));
                                }
                            }
                        }
                    }
                    name if is_route_point_extension(name) => {
                        if let Some(GPXElement::RoutePoint(coordinates)) = stack.pop() {
                            rpt_points.push(Trackpoint {
                                coordinates,
                                ..Default::default()
                            });
                        }
                    }
                    "trkseg" => {
                        if let Some(GPXElement::Segment(mut trkseg)) = stack.pop()
                            && let Some(GPXElement::Track(trk)) = stack.last_mut()
                        {
                            // `push` ignores the chunk if it is empty
                            trkseg.push(std::mem::take(&mut trkpt_chunk));
                            trkseg.compute_anchors();
                            trk.trkseg.push(trkseg);
                        }
                    }
                    "trkpt" => {
                        if let Some(GPXElement::Trackpoint(trkpt)) = stack.pop()
                            && let Some(GPXElement::Segment(trkseg)) = stack.last_mut()
                        {
                            trkpt_chunk.trkpt.push(trkpt);
                            if trkpt_chunk.is_full() {
                                trkseg.push(std::mem::take(&mut trkpt_chunk));
                            }
                        }
                    }
                    "wpt" => {
                        if let Some(GPXElement::Waypoint(wpt)) = stack.pop() {
                            wpt_chunk.wpt.push(wpt);
                            if wpt_chunk.is_full() {
                                gpx.wpt.push(std::mem::take(&mut wpt_chunk));
                            }
                        }
                    }
                    _ => (),
                }
            }
            // The text of an element comes in pieces: the entities (`&amp;`) are events of their own
            Ok(Event::Text(e)) => {
                if holds_text(stack.last()) {
                    text.push_str(&e);
                }
            }
            Ok(Event::CData(e)) => {
                if holds_text(stack.last()) {
                    text.push_str(&e);
                }
            }
            Ok(Event::GeneralRef(e)) => {
                if holds_text(stack.last()) {
                    if let Some(c) = e.resolve_char_ref()? {
                        text.push(c);
                    } else if let Some(entity) = resolve_predefined_entity(&e) {
                        text.push_str(entity);
                    }
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(e),
            _ => (),
        }
        buf.clear();
    }
    Ok(gpx)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse_data(name: &str) -> File {
        parse(
            &std::fs::read(format!("data/{name}.gpx")).unwrap(),
            &mut Default::default(),
        )
        .unwrap()
    }

    #[test]
    fn test_parse_entities_and_cdata_in_text() {
        let data = r#"<gpx><metadata><name>Tom &amp; Jerry &lt;3 &#233;&#x41; &quot;x&quot; &apos;y&apos;</name>
            <desc><![CDATA[a <b> & c]]> and &gt; more</desc></metadata>
            <wpt lat="1" lon="2"><name></name><desc/><ele>3</ele><cmt>&amp;</cmt></wpt>
            <trk><name>t &amp; u</name><trkseg><trkpt lat="1" lon="2"><ele>4</ele></trkpt></trkseg></trk>
            </gpx>"#;
        let gpx = parse(data.as_bytes(), &mut Default::default()).unwrap();
        assert_eq!(gpx.info.name, "Tom & Jerry <3 éA \"x\" 'y'");
        assert_eq!(gpx.info.desc.as_deref(), Some("a <b> & c and > more"));
        let wpt = gpx.wpt.iter().next().unwrap();
        // empty elements leave the value unknown, and do not get in the way of the next ones
        assert_eq!(wpt.name, None);
        assert_eq!(wpt.desc, None);
        assert_eq!(wpt.ele, 3.0);
        assert_eq!(wpt.cmt.as_deref(), Some("&"));
        assert_eq!(gpx.trk[0].info.name.as_deref(), Some("t & u"));
        assert_eq!(gpx.trk[0].trkseg[0][0].ele, 4.0);
    }

    #[test]
    fn test_parse_self_closing_points() {
        let gpx = parse_data("self_closing_points");

        assert_eq!(gpx.info.name, "self closing points");
        let wpt: Vec<_> = gpx.wpt.iter().collect();
        assert_eq!(wpt.len(), 3);
        assert_eq!(wpt[0].coordinates.lat, 50.0);
        assert_eq!(wpt[0].name, None);
        assert_eq!(wpt[1].name.as_deref(), Some("with children"));
        assert_eq!(wpt[2].coordinates.lng, 4.2);

        assert_eq!(gpx.trk.len(), 1);
        let trk = &gpx.trk[0];
        assert_eq!(trk.trkseg.len(), 2);
        let seg = &trk.trkseg[0];
        assert_eq!(seg.len(), 3);
        assert_eq!(seg[0].coordinates.lat, 50.0);
        assert_eq!(seg[0].ele, 0.0);
        assert_eq!(seg[1].ele, 12.5);
        assert_eq!(seg[2].coordinates.lng, 4.02);
        assert_eq!(trk.trkseg[1].len(), 1);
    }

    #[test]
    fn test_parse_simple() {
        let gpx = parse_data("simple");

        assert_eq!(gpx.info.name, "simple");
        assert!(gpx.info.desc.is_some_and(|d| d == "description"));
        assert!(gpx.info.author.is_some());
        let author = gpx.info.author.as_ref().unwrap();
        assert!(author.name.as_ref().is_some_and(|n| n == "gpx.studio"));
        assert!(author.link.is_some());
        let link = author.link.as_ref().unwrap();
        assert_eq!(link.href, "https://gpx.studio");
        assert!(link.text.as_ref().is_some_and(|t| t == "link text"));

        assert_eq!(gpx.trk.len(), 1);
        let trk = &gpx.trk[0];
        assert!(trk.info.name.as_ref().is_some_and(|n| n == "track name"));
        assert!(trk.info.cmt.as_ref().is_some_and(|c| c == "track comment"));
        assert!(
            trk.info
                .desc
                .as_ref()
                .is_some_and(|d| d == "track description")
        );
        assert!(trk.info.src.as_ref().is_some_and(|s| s == "track source"));
        assert_eq!(trk.info.links.len(), 1);
        let link = &trk.info.links[0];
        assert_eq!(link.href, "https://gpx.studio");
        assert!(link.text.as_ref().is_some_and(|t| t == "track link text"));
        assert!(trk.info.type_.as_ref().is_some_and(|c| c == "Cycling"));

        assert_eq!(trk.trkseg.len(), 1);
        let trkseg = &trk.trkseg[0];
        assert_eq!(trkseg.len(), 80);
        let trkpt = &trkseg[0];
        assert_eq!(trkpt.coordinates.lat, 50.790867);
        assert_eq!(trkpt.coordinates.lng, 4.404968);
        assert_eq!(trkpt.ele, 109.0);
    }

    #[test]
    fn test_parse_tracks() {
        let gpx = parse_data("with_tracks");

        assert_eq!(gpx.trk.len(), 2);
        let trk = &gpx.trk[0];
        assert!(trk.info.name.as_ref().is_some_and(|n| n == "track 1"));
        assert!(trk.info.type_.as_ref().is_some_and(|c| c == "Cycling"));

        assert_eq!(trk.trkseg.len(), 1);
        let trkseg = &trk.trkseg[0];
        assert_eq!(trkseg.len(), 49);
        let trkpt = &trkseg[0];
        assert_eq!(trkpt.coordinates.lat, 50.790867);
        assert_eq!(trkpt.coordinates.lng, 4.404968);
        assert_eq!(trkpt.ele, 109.0);

        let trk = &gpx.trk[1];
        assert!(trk.info.name.as_ref().is_some_and(|n| n == "track 2"));
        assert!(trk.info.type_.as_ref().is_some_and(|c| c == "Cycling"));

        assert_eq!(trk.trkseg.len(), 1);
        let trkseg = &trk.trkseg[0];
        assert_eq!(trkseg.len(), 28);
        let trkpt = &trkseg[0];
        assert_eq!(trkpt.coordinates.lat, 50.782212);
        assert_eq!(trkpt.coordinates.lng, 4.406377);
        assert_eq!(trkpt.ele, 115.5);
    }

    #[test]
    fn test_parse_routes_as_tracks() {
        let gpx = parse_data("with_routes");

        assert_eq!(gpx.trk.len(), 2);
        let trk = &gpx.trk[0];
        assert_eq!(trk.info.name.as_deref(), Some("route 1"));
        assert_eq!(trk.info.type_.as_deref(), Some("Cycling"));
        assert_eq!(trk.trkseg.len(), 1);
        let trkseg = &trk.trkseg[0];
        assert_eq!(trkseg.len(), 49);
        let trkpt = &trkseg[0];
        assert_eq!(trkpt.coordinates.lat, 50.790867);
        assert_eq!(trkpt.coordinates.lng, 4.404968);
        assert_eq!(trkpt.ele, 109.0);

        let trk = &gpx.trk[1];
        assert_eq!(trk.info.name.as_deref(), Some("route 2"));
        assert_eq!(trk.trkseg[0].len(), 28);
    }

    #[test]
    fn test_parse_route_point_extensions() {
        let gpx = parse_data("with_route_extensions");

        // a route without points has no segment
        assert_eq!(gpx.trk.len(), 2);
        assert!(gpx.trk[1].trkseg.is_empty());

        let trk = &gpx.trk[0];
        assert_eq!(trk.info.name.as_deref(), Some("with extensions"));
        assert_eq!(trk.trkseg.len(), 1);
        let points: Vec<_> = trk.trkseg[0].iter().collect();
        // the detailed path replaces the route point it comes with
        let coordinates: Vec<_> = points
            .iter()
            .map(|p| (p.coordinates.lat, p.coordinates.lng))
            .collect();
        assert_eq!(
            coordinates,
            [(1.1, 1.1), (1.2, 1.2), (2.0, 2.0), (3.0, 3.0)]
        );
        assert_eq!(points[2].ele, 20.0);
        assert!(points[2].time.is_some());
    }

    #[test]
    fn test_parse_every_link_and_the_email() {
        let gpx = parse_data("with_links");

        // the file has as many links as it says, self-closing or not
        let hrefs = |links: &[Link]| links.iter().map(|l| l.href.clone()).collect::<Vec<_>>();
        assert_eq!(
            hrefs(&gpx.info.links),
            ["https://example.com/file-1", "https://example.com/file-2"]
        );
        assert_eq!(gpx.info.links[0].text.as_deref(), Some("first"));
        assert_eq!(gpx.info.links[1].text, None);

        // the author has one link and an email, which is given by two attributes
        let author = gpx.info.author.as_ref().unwrap();
        assert_eq!(author.name.as_deref(), Some("someone"));
        assert_eq!(author.email.as_deref(), Some("someone@example.com"));
        assert_eq!(
            author.link.as_ref().unwrap().href,
            "https://example.com/author"
        );

        let waypoints: Vec<_> = gpx.wpt.iter().collect();
        assert_eq!(
            hrefs(&waypoints[0].links),
            [
                "https://example.com/wpt-1",
                "https://example.com/wpt-2",
                "https://example.com/wpt-3"
            ]
        );
        assert_eq!(waypoints[0].links[2].text.as_deref(), Some("three"));
        assert!(waypoints[1].links.is_empty());

        // tracks, and routes which are read as tracks
        assert_eq!(gpx.trk.len(), 2);
        assert_eq!(
            hrefs(&gpx.trk[0].info.links),
            ["https://example.com/trk-1", "https://example.com/trk-2"]
        );
        assert_eq!(
            hrefs(&gpx.trk[1].info.links),
            ["https://example.com/rte-1", "https://example.com/rte-2"]
        );
    }

    #[test]
    fn test_parse_email_variants() {
        let author = |xml: &str| {
            let data = format!("<gpx><metadata><author>{xml}</author></metadata></gpx>");
            parse(data.as_bytes(), &mut Default::default())
                .unwrap()
                .info
                .author
                .unwrap()
        };
        assert_eq!(
            author(r#"<email id="a" domain="b.c"></email>"#)
                .email
                .as_deref(),
            Some("a@b.c")
        );
        assert_eq!(
            author(r#"<name>n</name><email id="a" domain="b.c"/>"#)
                .email
                .as_deref(),
            Some("a@b.c")
        );
        // an email that is not complete is not one
        assert_eq!(author(r#"<email id="a"/>"#).email, None);
        assert_eq!(author("<name>n</name>").email, None);
        // outside of an author it means nothing
        let gpx = parse(
            br#"<gpx><metadata><name>n</name><email id="a" domain="b.c"/></metadata></gpx>"#,
            &mut Default::default(),
        )
        .unwrap();
        assert!(gpx.info.author.is_none());
    }

    #[test]
    fn test_parse_segments() {
        let gpx = parse_data("with_segments");

        assert_eq!(gpx.trk.len(), 1);
        let trk = &gpx.trk[0];

        assert_eq!(trk.trkseg.len(), 2);
        let trkseg = &trk.trkseg[0];
        assert_eq!(trkseg.len(), 49);
        let trkpt = &trkseg[0];
        assert_eq!(trkpt.coordinates.lat, 50.790867);
        assert_eq!(trkpt.coordinates.lng, 4.404968);
        assert_eq!(trkpt.ele, 109.0);

        let trkseg = &trk.trkseg[1];
        assert_eq!(trkseg.len(), 28);
        let trkpt = &trkseg[0];
        assert_eq!(trkpt.coordinates.lat, 50.782212);
        assert_eq!(trkpt.coordinates.lng, 4.406377);
        assert_eq!(trkpt.ele, 115.5);
    }

    #[test]
    fn test_parse_tracks_and_segments() {
        let gpx = parse_data("with_tracks_and_segments");

        assert_eq!(gpx.trk.len(), 2);
        let trk = &gpx.trk[0];

        assert_eq!(trk.trkseg.len(), 2);
        let trkseg = &trk.trkseg[0];
        assert_eq!(trkseg.len(), 16);
        let trkpt = &trkseg[0];
        assert_eq!(trkpt.coordinates.lat, 50.790867);
        assert_eq!(trkpt.coordinates.lng, 4.404968);
        assert_eq!(trkpt.ele, 109.0);

        let trkseg = &trk.trkseg[1];
        assert_eq!(trkseg.len(), 34);
        let trkpt = &trkseg[0];
        assert_eq!(trkpt.coordinates.lat, 50.78727108169855);
        assert_eq!(trkpt.coordinates.lng, 4.406133681127736);
        assert_eq!(trkpt.ele, 115.0);

        let trk = &gpx.trk[1];

        assert_eq!(trk.trkseg.len(), 2);
        let trkseg = &trk.trkseg[0];
        assert_eq!(trkseg.len(), 19);
        let trkpt = &trkseg[0];
        assert_eq!(trkpt.coordinates.lat, 50.782212);
        assert_eq!(trkpt.coordinates.lng, 4.406377);
        assert_eq!(trkpt.ele, 115.5);

        let trkseg = &trk.trkseg[1];
        assert_eq!(trkseg.len(), 10);
        let trkpt = &trkseg[0];
        assert_eq!(trkpt.coordinates.lat, 50.77906316558724);
        assert_eq!(trkpt.coordinates.lng, 4.412547477922485);
        assert_eq!(trkpt.ele, 133.3);
    }

    #[test]
    fn test_parse_waypoint() {
        let gpx = parse_data("with_waypoint");

        assert_eq!(gpx.wpt.len(), 1);
        let wpt = &gpx.wpt[0];
        assert_eq!(wpt.coordinates.lat, 50.7836710064975);
        assert_eq!(wpt.coordinates.lng, 4.410764082658738);
        assert!(wpt.name.as_ref().is_some_and(|n| n == "waypoint name"));
        assert!(wpt.cmt.as_ref().is_some_and(|c| c == "waypoint comment"));
        assert!(
            wpt.desc
                .as_ref()
                .is_some_and(|d| d == "waypoint description")
        );
        assert_eq!(wpt.links.len(), 1);
        let link = &wpt.links[0];
        assert_eq!(link.href, "https://gpx.studio");
        assert!(
            link.text
                .as_ref()
                .is_some_and(|t| t == "waypoint link text")
        );
        assert!(wpt.sym.as_ref().is_some_and(|s| s == "Bike Trail"));
        assert!(wpt.type_.as_ref().is_some_and(|t| t == "Bike Trail"));
    }

    #[test]
    fn test_parse_trackpoint_time() {
        let gpx = parse_data("with_time");

        assert_eq!(gpx.trk.len(), 1);
        let trk = &gpx.trk[0];
        assert_eq!(trk.trkseg.len(), 1);
        let trkseg = &trk.trkseg[0];
        assert!(!trkseg.is_empty());
        let trkpt = &trkseg[0];
        assert!(trkpt.time.is_some_and(|t| t == 1704063600000));
    }

    #[test]
    fn test_parse_trackpoint_hr() {
        let gpx = parse_data("with_hr");

        assert_eq!(gpx.trk.len(), 1);
        let trk = &gpx.trk[0];
        assert_eq!(trk.trkseg.len(), 1);
        let trkseg = &trk.trkseg[0];
        assert!(!trkseg.is_empty());
        let trkpt = &trkseg[0];
        assert!(trkpt.hr.is_some_and(|h| h == 150));
    }

    fn parse_data_with_categories(name: &str) -> (File, TrackpointCategories) {
        let mut categories = TrackpointCategories::default();
        let file = parse(
            &std::fs::read(format!("data/{name}.gpx")).unwrap(),
            &mut categories,
        )
        .unwrap();
        (file, categories)
    }

    #[test]
    fn test_parse_trackpoint_surface() {
        let (gpx, categories) = parse_data_with_categories("with_surface");

        let trkseg = &gpx.trk[0].trkseg[0];
        assert_eq!(trkseg.len(), 80);
        // the codes follow the order of appearance in the file
        assert_eq!(categories.surface.names(), ["asphalt", "cobblestone"]);
        let asphalt = Some(0);
        let cobblestone = Some(1);
        assert_eq!(trkseg.iter().filter(|p| p.surface == asphalt).count(), 79);
        assert_eq!(
            trkseg.iter().filter(|p| p.surface == cobblestone).count(),
            1
        );
        // no highway in this file
        assert!(trkseg.iter().all(|trkpt| trkpt.highway.is_none()));
        assert!(categories.highway.names().is_empty());
    }

    #[test]
    fn test_parse_trackpoint_surface_highway_and_scales() {
        let (gpx, categories) = parse_data_with_categories("with_highway");

        let trkseg = &gpx.trk[0].trkseg[0];
        let names = |code: Option<u8>, names: &crate::Categories| {
            code.and_then(|code| names.name(code)).map(str::to_owned)
        };
        let values: Vec<_> = trkseg
            .iter()
            .map(|trkpt| {
                [
                    names(trkpt.surface, &categories.surface),
                    names(trkpt.highway, &categories.highway),
                    names(trkpt.sac_scale, &categories.sac_scale),
                    names(trkpt.mtb_scale, &categories.mtb_scale),
                ]
            })
            .collect();
        let some = |s: &str| Some(s.to_owned());
        assert_eq!(
            values,
            [
                [some("asphalt"), some("residential"), None, None],
                [some("asphalt"), some("residential"), None, None],
                [None, None, None, None],
                [
                    some("gravel"),
                    some("track"),
                    some("mountain_hiking"),
                    some("1")
                ],
                [some("gravel"), None, some("hiking"), some("1")],
            ]
        );
        // the tables are separate
        assert_eq!(categories.sac_scale.names(), ["mountain_hiking", "hiking"]);
        assert_eq!(categories.mtb_scale.names(), ["1"]);
    }

    #[test]
    fn test_parse_shares_the_categories_between_files() {
        let mut categories = TrackpointCategories::default();
        let mut parsed = |name: &str| {
            parse(
                &std::fs::read(format!("data/{name}.gpx")).unwrap(),
                &mut categories,
            )
            .unwrap()
        };
        let first = parsed("with_highway");
        let second = parsed("with_surface");
        let code = |file: &File, i: usize| file.trk[0].trkseg[0][i].surface;
        // "asphalt" is the same in both, "cobblestone" comes after "gravel"
        assert_eq!(code(&first, 0), Some(0));
        assert_eq!(code(&second, 0), Some(0));
        assert_eq!(
            categories.surface.names(),
            ["asphalt", "gravel", "cobblestone"]
        );
    }

    #[test]
    fn test_parse_trackpoint_cad() {
        let gpx = parse_data("with_cad");

        assert_eq!(gpx.trk.len(), 1);
        let trk = &gpx.trk[0];
        assert_eq!(trk.trkseg.len(), 1);
        let trkseg = &trk.trkseg[0];
        assert!(!trkseg.is_empty());
        let trkpt = &trkseg[0];
        assert!(trkpt.cad.is_some_and(|c| c == 80));
    }

    #[test]
    fn test_parse_trackpoint_power_1() {
        let gpx = parse_data("with_power_1");

        assert_eq!(gpx.trk.len(), 1);
        let trk = &gpx.trk[0];
        assert_eq!(trk.trkseg.len(), 1);
        let trkseg = &trk.trkseg[0];
        assert!(!trkseg.is_empty());
        let trkpt = &trkseg[0];
        assert!(trkpt.power.is_some_and(|p| p == 200));
    }

    #[test]
    fn test_parse_trackpoint_power_2() {
        let gpx = parse_data("with_power_2");

        assert_eq!(gpx.trk.len(), 1);
        let trk = &gpx.trk[0];
        assert_eq!(trk.trkseg.len(), 1);
        let trkseg = &trk.trkseg[0];
        assert!(!trkseg.is_empty());
        let trkpt = &trkseg[0];
        assert!(trkpt.power.is_some_and(|p| p == 200));
    }

    #[test]
    fn test_parse_trackpoint_atemp() {
        let gpx = parse_data("with_temp");

        assert_eq!(gpx.trk.len(), 1);
        let trk = &gpx.trk[0];
        assert_eq!(trk.trkseg.len(), 1);
        let trkseg = &trk.trkseg[0];
        assert!(!trkseg.is_empty());
        let trkpt = &trkseg[0];
        assert!(trkpt.atemp.is_some_and(|t| t == 21));
    }

    #[test]
    fn test_parse_track_style() {
        let gpx = parse_data("with_style");

        assert_eq!(gpx.trk.len(), 1);
        let trk = &gpx.trk[0];
        assert_eq!(trk.trkseg.len(), 1);
        assert!(trk.info.color.as_ref().is_some_and(|c| c == "2d3ee9"));
        assert!(trk.info.opacity.is_some_and(|o| o == 0.5));
        assert!(trk.info.width.is_some_and(|w| w == 6.0));
    }
}
