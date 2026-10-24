mod ast;
mod names;
mod source;
mod wave;

wit_bindgen::generate!({ path: "wit/bindgen.wit", world: "bindgen" });

use exports::local::bindgen::wave::{TypeNode, ValueNode};

struct Component;
impl Guest for Component {
    fn generate_ast(component: Vec<u8>) -> Result<String, String> {
        ast::generate_ast(&component).map_err(|e| e.to_string())
    }
}

impl exports::local::bindgen::wave::Guest for Component {
    fn format(ty: Vec<TypeNode>, value: Vec<ValueNode>) -> Result<String, String> {
        wave::format(&ty, &value)
    }
    fn parse(ty: Vec<TypeNode>, text: String) -> Result<Vec<ValueNode>, String> {
        wave::parse(&ty, &text)
    }
}

export!(Component);
