use anyhow::Result;
use crate::source::Source;
use wit_component::DecodedWasm;
use wit_parser::{WorldKey, WorldItem, Resolve, InterfaceId, Function, Type, TypeDefKind};

struct Bindgen<'a> {
    src: Source,
    resolve: &'a Resolve,
}
impl<'a> Bindgen<'a> {
    fn pp_ty(&mut self, ty: &Type) {
        match ty {
            Type::U32 => self.src.push_str("U32"),
            Type::Id(id) => {
                let ty = &self.resolve.types[*id];
                if let Some(name) = &ty.name {
                    self.src.push_str(&name);
                } else {
                    self.src.push_str(&format!("{ty:?}"));
                }
            }
            _ => self.src.push_str(&format!("{ty:?}")),
        }
    }
    fn type_defs(&mut self, iface_id: InterfaceId) {
        let iface = &self.resolve.interfaces[iface_id];
        for (name, id) in &iface.types {
            self.src.push_str(&format!("export const {name} = "));
            let ty = &self.resolve.types[*id];
            match &ty.kind {
                TypeDefKind::Enum(enum_) => {
                    self.src.push_str("Enum([");
                    for case in &enum_.cases {
                        self.src.push_str(&format!("'{}'", case.name));
                        self.src.push_str(", ");
                    }
                    self.src.push_str("])");
                }
                _ => self.src.push_str(&format!("{ty:?}")),
            }
            self.src.push_str(";\n");
        }
    }
    fn func(&mut self, func: &Function, _is_async: bool) {
        let out_name = func.item_name();
        self.src.push_str(&format!("'{out_name}': Func(["));
        for (name, ty) in &func.params {
            self.src.push_str(&format!("['{name}', "));
            self.pp_ty(ty);
            self.src.push_str("], ");
        }
        self.src.push_str("], [");
        if let Some(ty) = func.result {
            self.pp_ty(&ty);
        }
        self.src.push_str("]");
        self.src.push_str(")\n");
    }
    fn interface(&mut self, resolve: &Resolve, name: &str, id: InterfaceId) {
        let id_name = resolve.id_of(id).unwrap_or_else(|| name.to_string());
        self.type_defs(id);
        self.src.push_str(&format!("export default Interface('{id_name}', {{\n"));
        let iface = &resolve.interfaces[id];
        for (_, func) in &iface.functions {
            self.func(func, true);
        }
        self.src.push_str("})\n");
    }
}

pub fn generate_ast(component: &[u8]) -> Result<String> {
    let decoded = wit_component::decode(component)?;
    let (resolve, id) = match decoded {
        DecodedWasm::Component(resolve, world_id) => (resolve, world_id),
        _ => unimplemented!(),
    };
    let world = &resolve.worlds[id];
    let mut bindgen = Bindgen { src: Source::default(), resolve: &resolve };
    for (name, export) in &world.exports {
        match export {
            WorldItem::Function(f) => {
                /*let name = match name {
                    WorldKey::Name(name) => name,
                    _ => unreachable!(),
                };*/
                // TODO
                bindgen.func(f, true);
            }
            WorldItem::Interface { id, .. } => {
                let name = match name {
                    WorldKey::Name(export) => export,
                    WorldKey::Interface(interface) => &resolve.id_of(*interface).unwrap(),
                };
                bindgen.interface(&resolve, name, *id);
            }
            WorldItem::Type(_) => unimplemented!(),
        }
    }
    Ok(bindgen.src.to_string())
}
