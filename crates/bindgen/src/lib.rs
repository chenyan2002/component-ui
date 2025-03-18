mod ast;
#[allow(warnings)]
mod bindings;
mod source;

use bindings::Guest;

struct Component;
impl Guest for Component {
    fn generate_ast(component: Vec<u8>) -> Result<String, String> {
        ast::generate_ast(&component).map_err(|e| e.to_string())
    }
}

bindings::export!(Component with_types_in bindings);
