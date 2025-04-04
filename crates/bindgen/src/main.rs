use std::fs::File;
use std::io::Read;
use std::path::Path;

mod ast;
mod source;

fn main() -> anyhow::Result<()> {
    let path = Path::new("../../public/wasi-http.wasm");
    let mut file = File::open(path)?;
    let mut buf = Vec::new();
    file.read_to_end(&mut buf)?;
    let res = ast::generate_ast(&buf)?;
    println!("{res}");
    Ok(())
}
