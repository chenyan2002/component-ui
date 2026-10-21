mod ast;
mod names;
mod source;

wit_bindgen::generate!({ path: "wit/bindgen.wit", world: "bindgen" });

struct Component;
impl Guest for Component {
    fn generate_ast(component: Vec<u8>) -> Result<String, String> {
        ast::generate_ast(&component).map_err(|e| e.to_string())
    }
}

export!(Component);
