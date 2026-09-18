use crate::gpx::{Author, GPXFile, Link, Track, TrackPoint, TrackSegment};
use quick_xml::Error;
use quick_xml::events::Event;
use quick_xml::reader::Reader;

enum GPXElement {
    METADATA,
    NAME,
    COMMENT,
    DESCRIPTION,
    SOURCE,
    AUTHOR(Author),
    LINK(Link),
    TEXT,
    TRACK(Track),
    SEGMENT(TrackSegment),
    TRACKPOINT(TrackPoint),
    ELEVATION,
}

pub fn parse(data: &[u8]) -> Result<GPXFile, Error> {
    let mut reader = Reader::from_reader(data);
    let mut buf = vec![];
    let mut gpx = GPXFile::default();
    let mut stack: Vec<GPXElement> = vec![];
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => match e.name().as_ref() {
                "metadata" => stack.push(GPXElement::METADATA),
                "name" => stack.push(GPXElement::NAME),
                "cmt" => stack.push(GPXElement::COMMENT),
                "desc" => stack.push(GPXElement::DESCRIPTION),
                "src" => stack.push(GPXElement::SOURCE),
                "author" => stack.push(GPXElement::AUTHOR(Author::default())),
                "link" => {
                    let mut link = Link::default();
                    for attr in e.attributes() {
                        if let Ok(attr) = attr {
                            if attr.key.as_ref() == "href" {
                                link.href = attr.value.to_string();
                            }
                        }
                    }
                    stack.push(GPXElement::LINK(link));
                }
                "text" => stack.push(GPXElement::TEXT),
                "trk" => stack.push(GPXElement::TRACK(Track::default())),
                "trkseg" => stack.push(GPXElement::SEGMENT(TrackSegment::default())),
                "trkpt" => {
                    let mut trkpt = TrackPoint::default();
                    for attr in e.attributes() {
                        if let Ok(attr) = attr {
                            match attr.key.as_ref() {
                                "lat" => {
                                    trkpt.coordinates.lat = attr.value.parse().unwrap_or_default()
                                }
                                "lon" => {
                                    trkpt.coordinates.lng = attr.value.parse().unwrap_or_default()
                                }
                                _ => (),
                            }
                        }
                    }
                    stack.push(GPXElement::TRACKPOINT(trkpt));
                }
                "ele" => stack.push(GPXElement::ELEVATION),
                _ => println!("{:?}", e),
            },
            Ok(Event::End(e)) => match e.name().as_ref() {
                "metadata" => {
                    stack.pop();
                }
                "author" => {
                    if let Some(GPXElement::AUTHOR(author)) = stack.pop() {
                        gpx.info.author = Some(author);
                    }
                }
                "link" => {
                    if let Some(GPXElement::LINK(link)) = stack.pop() {
                        match stack.last_mut() {
                            Some(GPXElement::AUTHOR(author)) => {
                                author.link = Some(link);
                            }
                            Some(GPXElement::TRACK(trk)) => {
                                trk.info.link = Some(link);
                            }
                            _ => (),
                        }
                    }
                }
                "trk" => {
                    if let Some(GPXElement::TRACK(trk)) = stack.pop() {
                        gpx.trk.push(trk);
                    }
                }
                "trkseg" => {
                    if let Some(GPXElement::SEGMENT(trkseg)) = stack.pop() {
                        if let Some(GPXElement::TRACK(trk)) = stack.last_mut() {
                            trk.trkseg.push(trkseg);
                        }
                    }
                }
                "trkpt" => {
                    if let Some(GPXElement::TRACKPOINT(trkpt)) = stack.pop() {
                        if let Some(GPXElement::SEGMENT(trkseg)) = stack.last_mut() {
                            trkseg.append(trkpt);
                        }
                    }
                }
                _ => (),
            },
            Ok(Event::Text(e)) => match stack.last_mut() {
                Some(GPXElement::NAME) => {
                    stack.pop();
                    match stack.last_mut() {
                        Some(GPXElement::METADATA) => {
                            gpx.info.name = e.to_string();
                        }
                        Some(GPXElement::AUTHOR(author)) => {
                            author.name = Some(e.to_string());
                        }
                        Some(GPXElement::TRACK(trk)) => {
                            trk.info.name = Some(e.to_string());
                        }
                        _ => (),
                    }
                }
                Some(GPXElement::COMMENT) => {
                    stack.pop();
                    match stack.last_mut() {
                        Some(GPXElement::TRACK(trk)) => {
                            trk.info.cmt = Some(e.to_string());
                        }
                        _ => (),
                    }
                }
                Some(GPXElement::DESCRIPTION) => {
                    stack.pop();
                    match stack.last_mut() {
                        Some(GPXElement::METADATA) => {
                            gpx.info.desc = Some(e.to_string());
                        }
                        Some(GPXElement::TRACK(trk)) => {
                            trk.info.desc = Some(e.to_string());
                        }
                        _ => (),
                    }
                }
                Some(GPXElement::SOURCE) => {
                    stack.pop();
                    match stack.last_mut() {
                        Some(GPXElement::TRACK(trk)) => {
                            trk.info.src = Some(e.to_string());
                        }
                        _ => (),
                    }
                }
                Some(GPXElement::TEXT) => {
                    stack.pop();
                    if let Some(GPXElement::LINK(link)) = stack.last_mut() {
                        link.text = Some(e.to_string());
                    }
                }
                Some(GPXElement::ELEVATION) => {
                    stack.pop();
                    if let Some(GPXElement::TRACKPOINT(trkpt)) = stack.last_mut() {
                        trkpt.ele = e.parse().unwrap_or_default();
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
    use std::{fs::File, io::Read};

    use super::*;

    #[test]
    fn test_parse() {
        let mut f = File::open("data/simple.gpx").unwrap();
        let mut data = String::new();
        let _ = f.read_to_string(&mut data);
        let gpx = parse(data.as_bytes()).unwrap();
        println!("{:?}", gpx);

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
                .is_some_and(|n| n == "track description")
        );
        assert!(trk.info.src.as_ref().is_some_and(|n| n == "track source"));
        assert!(trk.info.link.is_some());
        let link = trk.info.link.as_ref().unwrap();
        assert_eq!(link.href, "https://gpx.studio");
        assert!(link.text.as_ref().is_some_and(|t| t == "track link text"));

        assert_eq!(gpx.trk[0].trkseg.len(), 1);
        let trkseg = &gpx.trk[0].trkseg[0];
        assert_eq!(trkseg.chunks.len(), 1);
        let chunk = trkseg.chunks[0].borrow();
        assert_eq!(chunk.trkpt.len(), 80);
        let trkpt = &chunk.trkpt[0];
        assert_eq!(trkpt.coordinates.lat, 50.790867);
        assert_eq!(trkpt.coordinates.lng, 4.404968);
        assert_eq!(trkpt.ele, 109.0);
    }
}
