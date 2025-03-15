use std::io::Read;
use std::fs::File;
use std::path::Path;

mod source;
mod ast;

#[macro_export]
macro_rules! uwrite {
    ($dst:expr, $($arg:tt)*) => {
        write!($dst, $($arg)*).unwrap()
    };
}
#[macro_export]
macro_rules! uwriteln {
    ($dst:expr, $($arg:tt)*) => {
        writeln!($dst, $($arg)*).unwrap()
    };
}

fn main() -> anyhow::Result<()> {
    let path = Path::new("../../public/calculator.wasm");
    let mut file = File::open(path)?;
    let mut buf = Vec::new();
    file.read_to_end(&mut buf)?;
    let res = ast::generate_ast(&buf)?;
    println!("{res}");
    Ok(())
}
