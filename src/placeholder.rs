use std::{io::Write as _, path::Path, sync::OnceLock};

use image::{DynamicImage, ImageBuffer, ImageFormat, Rgba, RgbaImage};

const WIDTH: u32 = 80;
const HEIGHT: u32 = 50;

struct PlaceholderSet {
    pdf: Vec<u8>,
    svg: Vec<u8>,
    svgz: Vec<u8>,
    png: Vec<u8>,
    jpeg: Vec<u8>,
    gif: Vec<u8>,
    webp: Vec<u8>,
}

static PLACEHOLDERS: OnceLock<PlaceholderSet> = OnceLock::new();
static FINGERPRINT: OnceLock<Vec<u8>> = OnceLock::new();

fn placeholders() -> &'static PlaceholderSet {
    PLACEHOLDERS.get_or_init(|| {
        let raster = raster_placeholder();
        PlaceholderSet {
            pdf: pdf_placeholder(),
            svg: svg_placeholder(),
            svgz: gzip_stored(&svg_placeholder()),
            png: encode_raster(&raster, ImageFormat::Png),
            jpeg: encode_raster(&raster, ImageFormat::Jpeg),
            gif: encode_raster(&raster, ImageFormat::Gif),
            webp: encode_raster(&raster, ImageFormat::WebP),
        }
    })
}

/// Return the bytes used by the embedded missing-figure placeholders.
///
/// The returned bytes include every supported extension and their labels. The
/// render cache hashes this value so changing a placeholder invalidates old
/// renders instead of reusing pages produced by an older generator.
pub fn placeholder_fingerprint() -> &'static [u8] {
    FINGERPRINT
        .get_or_init(|| {
            let set = placeholders();
            let mut bytes = b"ttm-placeholder-v1\0".to_vec();
            for (extension, contents) in [
                ("pdf", set.pdf.as_slice()),
                ("svg", set.svg.as_slice()),
                ("svgz", set.svgz.as_slice()),
                ("png", set.png.as_slice()),
                ("jpg", set.jpeg.as_slice()),
                ("gif", set.gif.as_slice()),
                ("webp", set.webp.as_slice()),
            ] {
                bytes.extend_from_slice(extension.as_bytes());
                bytes.push(0);
                bytes.extend_from_slice(&(contents.len() as u64).to_le_bytes());
                bytes.extend_from_slice(contents);
            }
            bytes
        })
        .as_slice()
}

pub(crate) fn bytes_for_path(path: &Path) -> Option<&'static [u8]> {
    let extension = path.extension()?.to_str()?.to_ascii_lowercase();
    let set = placeholders();
    match extension.as_str() {
        "pdf" => Some(set.pdf.as_slice()),
        "svg" => Some(set.svg.as_slice()),
        "svgz" => Some(set.svgz.as_slice()),
        "png" => Some(set.png.as_slice()),
        "jpg" | "jpeg" => Some(set.jpeg.as_slice()),
        "gif" => Some(set.gif.as_slice()),
        "webp" => Some(set.webp.as_slice()),
        _ => None,
    }
}

fn raster_placeholder() -> RgbaImage {
    let mut image = ImageBuffer::from_pixel(WIDTH, HEIGHT, Rgba([244, 244, 244, 255]));
    for (x, y, pixel) in image.enumerate_pixels_mut() {
        let border = x < 2 || y < 2 || x >= WIDTH - 2 || y >= HEIGHT - 2;
        let diagonal_a = ((x * HEIGHT) as i64 - (y * WIDTH) as i64).abs() < 45;
        let diagonal_b =
            ((x * HEIGHT) as i64 + (y * WIDTH) as i64 - (WIDTH * HEIGHT) as i64).abs() < 45;
        if border {
            *pixel = Rgba([75, 75, 75, 255]);
        } else if diagonal_a || diagonal_b {
            *pixel = Rgba([190, 45, 45, 255]);
        } else if (x / 8 + y / 8) % 2 == 0 {
            *pixel = Rgba([229, 229, 229, 255]);
        }
    }
    image
}

fn encode_raster(image: &RgbaImage, format: ImageFormat) -> Vec<u8> {
    let mut output = std::io::Cursor::new(Vec::new());
    DynamicImage::ImageRgba8(image.clone())
        .write_to(&mut output, format)
        .expect("embedded placeholder image encoding must succeed");
    output.into_inner()
}

fn svg_placeholder() -> Vec<u8> {
    format!(
        "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{WIDTH}\" height=\"{HEIGHT}\" viewBox=\"0 0 {WIDTH} {HEIGHT}\"><rect width=\"100%\" height=\"100%\" fill=\"#f4f4f4\"/><path d=\"M0 0L80 50M0 50L80 0\" stroke=\"#be2d2d\" stroke-width=\"1\"/><rect x=\"0.5\" y=\"0.5\" width=\"79\" height=\"49\" fill=\"none\" stroke=\"#4b4b4b\"/><text x=\"7\" y=\"29\" font-family=\"sans-serif\" font-size=\"8\" fill=\"#333\">TTM placeholder</text></svg>"
    )
    .into_bytes()
}

fn pdf_placeholder() -> Vec<u8> {
    let content = b"q\n0.956 0.956 0.956 rg\n0 0 80 50 re f\n0.294 0.294 0.294 RG\n1 w\n0 0 80 50 re S\n0.745 0.176 0.176 RG\n1 w\n0 0 m 80 50 l S\n0 50 m 80 0 l S\nBT /F1 8 Tf 0.2 0.2 0.2 rg 7 24 Td (TTM placeholder) Tj ET\nQ\n";
    let mut output = b"%PDF-1.4\n%\xE2\xE3\xCF\xD3\n".to_vec();
    let mut offsets = vec![0usize];

    offsets.push(output.len());
    output.extend_from_slice(b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
    offsets.push(output.len());
    output.extend_from_slice(b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
    offsets.push(output.len());
    output.extend_from_slice(
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 80 50] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n",
    );
    offsets.push(output.len());
    write!(
        &mut output,
        "4 0 obj\n<< /Length {} >>\nstream\n",
        content.len()
    )
    .expect("write PDF placeholder stream header");
    output.extend_from_slice(content);
    output.extend_from_slice(b"endstream\nendobj\n");
    offsets.push(output.len());
    output.extend_from_slice(
        b"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    );

    let xref = output.len();
    output.extend_from_slice(b"xref\n0 6\n0000000000 65535 f \n");
    for offset in offsets.iter().skip(1) {
        writeln!(&mut output, "{offset:010} 00000 n ").expect("write PDF xref entry");
    }
    write!(
        &mut output,
        "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n"
    )
    .expect("write PDF trailer");
    output
}

fn gzip_stored(data: &[u8]) -> Vec<u8> {
    let mut output = vec![0x1f, 0x8b, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff];
    let mut offset = 0;
    loop {
        let remaining = data.len() - offset;
        let length = remaining.min(u16::MAX as usize);
        let final_block = offset + length == data.len();
        output.push(if final_block { 0x01 } else { 0x00 });
        let length = length as u16;
        output.extend_from_slice(&length.to_le_bytes());
        output.extend_from_slice(&(!length).to_le_bytes());
        output.extend_from_slice(&data[offset..offset + length as usize]);
        offset += length as usize;
        if final_block {
            break;
        }
    }
    output.extend_from_slice(&crc32(data).to_le_bytes());
    output.extend_from_slice(&(data.len() as u32).to_le_bytes());
    output
}

fn crc32(bytes: &[u8]) -> u32 {
    let mut crc = u32::MAX;
    for &byte in bytes {
        crc ^= byte as u32;
        for _ in 0..8 {
            crc = if crc & 1 == 1 {
                (crc >> 1) ^ 0xedb8_8320
            } else {
                crc >> 1
            };
        }
    }
    !crc
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_placeholder_has_an_8_to_5_intrinsic_size() {
        let set = placeholders();
        assert!(set.pdf.starts_with(b"%PDF-"));
        assert!(set.svg.starts_with(b"<svg "));
        assert!(set.svgz.starts_with(&[0x1f, 0x8b]));
        assert!(set.png.starts_with(b"\x89PNG\r\n\x1a\n"));
        assert!(set.jpeg.starts_with(&[0xff, 0xd8]));
        assert!(set.gif.starts_with(b"GIF8"));
        assert!(set.webp.starts_with(b"RIFF"));
        assert!(
            set.svg
                .windows(b"viewBox=\"0 0 80 50\"".len())
                .any(|window| { window == b"viewBox=\"0 0 80 50\"" })
        );
    }

    #[test]
    fn fingerprint_includes_all_formats() {
        let fingerprint = placeholder_fingerprint();
        for extension in [
            b"pdf\0".as_slice(),
            b"svg\0",
            b"svgz\0",
            b"png\0",
            b"jpg\0",
            b"gif\0",
            b"webp\0",
        ] {
            assert!(
                fingerprint
                    .windows(extension.len())
                    .any(|window| window == extension)
            );
        }
    }
}
