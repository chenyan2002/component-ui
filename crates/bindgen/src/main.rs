use std::io::Read;
use std::fs::File;
use std::path::Path;

mod source;
mod ast;

fn main() -> anyhow::Result<()> {
    let path = Path::new("../../public/calculator.wasm");
    let mut file = File::open(path)?;
    let mut buf = Vec::new();
    file.read_to_end(&mut buf)?;
    let res = ast::generate_ast(&buf)?;
    println!("{res}");
    Ok(())
}
