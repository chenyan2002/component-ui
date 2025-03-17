use anyhow::Result;
use crate::source::Source;
use heck::{ToLowerCamelCase, ToUpperCamelCase};
use wit_component::DecodedWasm;
use wit_parser::{WorldKey, WorldItem, Resolve, InterfaceId, Function, Type, TypeDefKind};

struct Bindgen<'a> {
    src: Source,
    resolve: &'a Resolve,
    export_interfaces: Vec<String>,
}
impl<'a> Bindgen<'a> {
    fn pp_ty(&mut self, ty: &Type) {
        match ty {
            Type::U32 => self.src.push_str("IDL.U32"),
            Type::Id(id) => {
                let ty = &self.resolve.types[*id];
                if let Some(name) = &ty.name {
                    self.src.push_str(&name.to_upper_camel_case());
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
            let name = name.to_upper_camel_case();
            self.src.push_str(&format!("const {name} = "));
            let ty = &self.resolve.types[*id];
            match &ty.kind {
                TypeDefKind::Enum(enum_) => {
                    self.src.push_str("IDL.Enum([");
                    self.src.push_str(&enum_.cases.iter().map(|e| format!("'{}'", e.name)).collect::<Vec<_>>().join(", "));
                    self.src.push_str("])");
                }
                _ => self.src.push_str(&format!("{ty:?}")),
            }
            self.src.push_str(";\n");
        }
    }
    fn func(&mut self, func: &Function, _is_async: bool) {
        let out_name = func.item_name().to_lower_camel_case();
        self.src.push_str(&format!("'{out_name}': IDL.Func(["));
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
        let identifier = interface_type_name(&id_name);
        self.type_defs(id);
        self.src.push_str(&format!("const {identifier} = IDL.Interface('{id_name}', {{\n"));
        let iface = &resolve.interfaces[id];
        for (_, func) in &iface.functions {
            self.func(func, true);
        }
        self.src.push_str("});\n");
        self.export_interfaces.push(identifier);
    }
    fn exported_funcs(&mut self, funcs: &[&Function]) {
        if funcs.is_empty() {
            return;
        }
        let unnamed = "UNNAMED".to_string();
        self.src.push_str(&format!("const {unnamed} = IDL.Interface('{unnamed}', {{\n"));
        for func in funcs {
            self.func(func, true);
        }
        self.src.push_str("});\n");
        self.export_interfaces.push(unnamed);
    }
}

pub fn generate_ast(component: &[u8]) -> Result<String> {
    let decoded = wit_component::decode(component)?;
    let (resolve, id) = match decoded {
        DecodedWasm::Component(resolve, world_id) => (resolve, world_id),
        _ => unimplemented!(),
    };
    let world = &resolve.worlds[id];
    let mut bindgen = Bindgen { src: Source::default(), resolve: &resolve, export_interfaces: Vec::new() };
    bindgen.src.push_str("export const Factory = ({IDL}) => {\n");
    let mut funcs = Vec::new();
    for (name, export) in &world.exports {
        match export {
            WorldItem::Interface { id, .. } => {
                let name = match name {
                    WorldKey::Name(export) => export,
                    WorldKey::Interface(interface) => &resolve.id_of(*interface).unwrap(),
                };
                bindgen.interface(&resolve, name, *id);
            }
            WorldItem::Function(f) => funcs.push(f),
            WorldItem::Type(_) => unimplemented!(),
        }
    }
    bindgen.exported_funcs(&funcs);
    bindgen.src.push_str("return [");
    bindgen.src.push_str(&bindgen.export_interfaces.join(", "));
    bindgen.src.push_str("];\n}\n");
    Ok(bindgen.src.to_string())
}

fn interface_type_name(iface_name: &str) -> String {
    let iface_name_sans_version = match iface_name.find('@') {
        Some(version_idx) => &iface_name[0..version_idx],
        None => iface_name,
    };
    iface_name_sans_version
        .replace(['/', ':'], "-")
        .to_upper_camel_case()
}
