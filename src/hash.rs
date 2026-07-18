pub fn lower_hex(bytes: impl AsRef<[u8]>) -> String {
    const DIGITS: &[u8; 16] = b"0123456789abcdef";

    let bytes = bytes.as_ref();
    let mut encoded = String::with_capacity(bytes.len() * 2);
    for &byte in bytes {
        encoded.push(DIGITS[(byte >> 4) as usize] as char);
        encoded.push(DIGITS[(byte & 0x0f) as usize] as char);
    }
    encoded
}

#[cfg(test)]
mod tests {
    use super::lower_hex;

    #[test]
    fn encodes_lowercase_hex_with_leading_zeroes() {
        assert_eq!(lower_hex([0x00, 0x0f, 0x10, 0xab, 0xff]), "000f10abff");
    }
}
