use std::rc::Rc;

use crate::{
    Author, File, Link, LngLat, Track, TrackSegment, Trackpoint, TrackpointChunk, Waypoint,
    WaypointChunk,
};
use chrono::DateTime;
use quick_xml::Error;
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
    Waypoint(Waypoint),
    Elevation,
    Time,
    Temperature,
    Heartrate,
    Cadence,
    Power,
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

pub fn parse(data: &[u8]) -> Result<File, Error> {
    let mut reader = Reader::from_reader(data);
    let mut buf = vec![];
    let mut gpx = File::default();
    let mut stack: Vec<GPXElement> = vec![];
    let mut trkpt_chunk = TrackpointChunk::default();
    let mut wpt_chunk = WaypointChunk::default();
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => match e.name().as_ref() {
                "metadata" => stack.push(GPXElement::Metadata),
                "name" => stack.push(GPXElement::Name),
                "cmt" => stack.push(GPXElement::Comment),
                "desc" => stack.push(GPXElement::Description),
                "src" => stack.push(GPXElement::Source),
                "author" => stack.push(GPXElement::Author(Author::default())),
                "link" => {
                    let mut link = Link::default();
                    for attr in e.attributes().flatten() {
                        if attr.key.as_ref() == "href" {
                            link.href = attr.value.to_string();
                        }
                    }
                    stack.push(GPXElement::Link(link));
                }
                "text" => stack.push(GPXElement::Text),
                "trk" => stack.push(GPXElement::Track(Track::default())),
                "trkseg" => {
                    stack.push(GPXElement::Segment(TrackSegment::default()));
                }
                "trkpt" => {
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
                "ele" => stack.push(GPXElement::Elevation),
                "time" => stack.push(GPXElement::Time),
                e if e.ends_with("atemp") => stack.push(GPXElement::Temperature),
                e if e.ends_with("hr") => stack.push(GPXElement::Heartrate),
                e if e.ends_with("cad") => stack.push(GPXElement::Cadence),
                "power" => stack.push(GPXElement::Power),
                e if e.ends_with("PowerInWatts") => stack.push(GPXElement::Power),
                "sym" => stack.push(GPXElement::Symbol),
                "type" => stack.push(GPXElement::Type),
                e if e.ends_with("color") => stack.push(GPXElement::Color),
                e if e.ends_with("opacity") => stack.push(GPXElement::Opacity),
                e if e.ends_with("width") => stack.push(GPXElement::Width),
                _ => (),
            },
            Ok(Event::End(e)) => match e.name().as_ref() {
                "gpx" => {
                    if !wpt_chunk.wpt.is_empty() {
                        gpx.wpt.push(Rc::new(std::mem::take(&mut wpt_chunk)));
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
                        match stack.last_mut() {
                            Some(GPXElement::Author(author)) => {
                                author.link = Some(link);
                            }
                            Some(GPXElement::Track(trk)) => {
                                trk.info.link = Some(link);
                            }
                            Some(GPXElement::Waypoint(wpt)) => {
                                wpt.link = Some(link);
                            }
                            _ => (),
                        }
                    }
                }
                "trk" => {
                    if let Some(GPXElement::Track(trk)) = stack.pop() {
                        gpx.trk.push(trk);
                    }
                }
                "trkseg" => {
                    if let Some(GPXElement::Segment(mut trkseg)) = stack.pop()
                        && let Some(GPXElement::Track(trk)) = stack.last_mut()
                    {
                        // `push` ignores the chunk if it is empty
                        trkseg.push(std::mem::take(&mut trkpt_chunk));
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
                            gpx.wpt.push(Rc::new(std::mem::take(&mut wpt_chunk)));
                        }
                    }
                }
                _ => (),
            },
            Ok(Event::Text(e)) => match stack.last_mut() {
                Some(GPXElement::Name) => {
                    stack.pop();
                    match stack.last_mut() {
                        Some(GPXElement::Metadata) => {
                            gpx.info.name = e.to_string();
                        }
                        Some(GPXElement::Author(author)) => {
                            author.name = Some(e.to_string());
                        }
                        Some(GPXElement::Track(trk)) => {
                            trk.info.name = Some(e.to_string());
                        }
                        Some(GPXElement::Waypoint(wpt)) => {
                            wpt.name = Some(e.to_string());
                        }
                        _ => (),
                    }
                }
                Some(GPXElement::Comment) => {
                    stack.pop();
                    match stack.last_mut() {
                        Some(GPXElement::Track(trk)) => {
                            trk.info.cmt = Some(e.to_string());
                        }
                        Some(GPXElement::Waypoint(wpt)) => {
                            wpt.cmt = Some(e.to_string());
                        }
                        _ => (),
                    }
                }
                Some(GPXElement::Description) => {
                    stack.pop();
                    match stack.last_mut() {
                        Some(GPXElement::Metadata) => {
                            gpx.info.desc = Some(e.to_string());
                        }
                        Some(GPXElement::Track(trk)) => {
                            trk.info.desc = Some(e.to_string());
                        }
                        Some(GPXElement::Waypoint(wpt)) => {
                            wpt.desc = Some(e.to_string());
                        }
                        _ => (),
                    }
                }
                Some(GPXElement::Source) => {
                    stack.pop();
                    if let Some(GPXElement::Track(trk)) = stack.last_mut() {
                        trk.info.src = Some(e.to_string());
                    }
                }
                Some(GPXElement::Text) => {
                    stack.pop();
                    if let Some(GPXElement::Link(link)) = stack.last_mut() {
                        link.text = Some(e.to_string());
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
                        trkpt.time = DateTime::parse_from_rfc3339(e.as_ref())
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
                Some(GPXElement::Symbol) => {
                    stack.pop();
                    if let Some(GPXElement::Waypoint(wpt)) = stack.last_mut() {
                        wpt.sym = Some(e.to_string());
                    }
                }
                Some(GPXElement::Type) => {
                    stack.pop();
                    match stack.last_mut() {
                        Some(GPXElement::Track(trk)) => {
                            trk.info.type_ = Some(e.to_string());
                        }
                        Some(GPXElement::Waypoint(wpt)) => {
                            wpt.type_ = Some(e.to_string());
                        }
                        _ => (),
                    }
                }
                Some(GPXElement::Color) => {
                    stack.pop();
                    if let Some(GPXElement::Track(trk)) = stack.last_mut() {
                        trk.info.color = Some(format!("#{}", &*e));
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
            },
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
        parse(&std::fs::read(format!("data/{name}.gpx")).unwrap()).unwrap()
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
        assert!(trk.info.link.is_some());
        let link = trk.info.link.as_ref().unwrap();
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
        let chunk = &gpx.wpt[0];
        assert_eq!(chunk.wpt.len(), 1);
        let wpt = &chunk.wpt[0];
        assert_eq!(wpt.coordinates.lat, 50.7836710064975);
        assert_eq!(wpt.coordinates.lng, 4.410764082658738);
        assert!(wpt.name.as_ref().is_some_and(|n| n == "waypoint name"));
        assert!(wpt.cmt.as_ref().is_some_and(|c| c == "waypoint comment"));
        assert!(
            wpt.desc
                .as_ref()
                .is_some_and(|d| d == "waypoint description")
        );
        assert!(wpt.link.is_some());
        let link = wpt.link.as_ref().unwrap();
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
        assert!(trk.info.color.as_ref().is_some_and(|c| c == "#2d3ee9"));
        assert!(trk.info.opacity.is_some_and(|o| o == 0.5));
        assert!(trk.info.width.is_some_and(|w| w == 6.0));
    }
}
